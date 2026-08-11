import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { ctx, pluck, playClick, blip } from "./audio.js";
import { findVoicings } from "./voicings.js";
import {
  SHARP,
  FLAT,
  DEG,
  nameOf,
  FLAT_MAJORS,
  keyPrefersFlats,
  SCALES,
  CHORDS,
  TUNINGS,
  PRACTICE_MODES,
  localDay,
  parseTab,
  EAR_INTERVALS,
  EAR_INTERVALS_SIMPLE,
  EAR_CHORDS,
  EAR_CHORDS_SIMPLE,
  MINOR_STARTS,
  ROMAN,
  PROGRESSIONS,
  SIMPLE_SCALES,
  SIMPLE_CHORDS,
  SIMPLE_PROGS,
  SIMPLE_HIDDEN,
  CAT_OF,
  MEL_SLOTS,
  MEL_MAX_BARS,
  STRUM_PATTERNS,
  simpleList,
  INTERVAL_PRESETS,
  TIME_SIGS,
  FUNC_COLOUR,
  LOWERED,
  SINGLE_DOTS,
  DOUBLE_DOTS,
  SCALE_ORDER,
  CHORD_ORDER,
} from "./theory.js";
import { useGeometry, Fretboard, ChordDiagram } from "./fretboard.jsx";
import { FAQ_SECTIONS, FAQS } from "./data/faq.js";
import { CHANGELOG } from "./data/changelog.js";
import { RESOURCES } from "./data/resources.js";
import { BADGES, badgeTier, pointsFor, levelProgress, mergeGamify } from "./gamify.js";

/* small persistence shim: Claude artifacts expose window.storage,
   everywhere else falls back to localStorage */
const store = {
  async get(key) {
    if (typeof window === "undefined") throw new Error("no window");
    if (window.storage) return window.storage.get(key);
    const v = window.localStorage.getItem(key);
    if (v === null) throw new Error("not set");
    return { value: v };
  },
  async set(key, value) {
    if (typeof window === "undefined") return;
    if (window.storage) return window.storage.set(key, value);
    window.localStorage.setItem(key, value);
  },
};

/* A friendly synthetic path and title for each in-app view. The app is a
   single page, so GA and Amplitude never see navigation on their own: we send
   a page_view per view change instead, keyed off these. Keep every `mode`
   value covered, or its path falls back to a raw, opaque "/mode". */
const VIEW_META = {
  chord: { path: "/chords", title: "Chords" },
  scale: { path: "/scales", title: "Scales" },
  arp: { path: "/arpeggios", title: "Arpeggios" },
  interval: { path: "/intervals", title: "Intervals" },
  prog: { path: "/progressions", title: "Progressions" },
  changes: { path: "/chord-changes", title: "Chord changes" },
  routine: { path: "/practice-routine", title: "Practice routine" },
  strum: { path: "/strumming", title: "Strumming" },
  melody: { path: "/melodies", title: "Melodies" },
  quiz: { path: "/quiz", title: "Fretboard Quiz" },
  ear: { path: "/ear-training", title: "Ear training" },
  finder: { path: "/chord-finder", title: "Chord finder" },
  tuner: { path: "/tuner", title: "Tuner" },
  bank: { path: "/bank", title: "Bank" },
  about: { path: "/about", title: "About" },
  faq: { path: "/faq", title: "FAQ" },
  account: { path: "/account", title: "Account" },
  settings: { path: "/settings", title: "Settings" },
  plog: { path: "/practice-log", title: "Practice log" },
};

/* Real URL routing. Every view has its own path, so views can be linked,
   bookmarked, shared and crawled as distinct pages. The default view (chord) is
   the site root "/", keeping a single canonical home rather than a "/chords"
   duplicate of it. */
function pathForMode(m) {
  return m === "chord" ? "/" : (VIEW_META[m] && VIEW_META[m].path) || "/";
}
function modeForPath(p) {
  if (!p || p === "/") return "chord";
  for (const m in VIEW_META) if (m !== "chord" && VIEW_META[m].path === p) return m;
  return null;
}

/* Event helper: forwards to Google Analytics and Amplitude. Each sink has its
   own try/catch so one failing never skips the other, and analytics never
   breaks the app. Amplitude is only present in production (set in main.jsx). */
/* GA4 treats these event-parameter names as manual campaign fields. Sending one
   (e.g. source: "interval") rewrites the session's traffic source and forces a
   new session mid-visit, which splits sessions and destroys attribution. Never
   let an app parameter reach gtag under one of these names. */
const GA_RESERVED = new Set([
  "source",
  "medium",
  "campaign",
  "term",
  "content",
  "campaign_id",
  "source_platform",
  "creative_format",
  "marketing_tactic",
  "gclid",
]);
function gaSafeParams(params) {
  if (!params || typeof params !== "object") return params || {};
  let out = params;
  for (const k of Object.keys(params)) {
    if (GA_RESERVED.has(k)) {
      if (out === params) out = { ...params };
      out["app_" + k] = out[k];
      delete out[k];
    }
  }
  return out;
}
function track(name, params) {
  try {
    /* GA4 gets campaign-safe params; Amplitude keeps the original names */
    if (typeof window !== "undefined" && typeof window.gtag === "function") window.gtag("event", name, gaSafeParams(params));
  } catch (e) {
    /* analytics must never break the app */
  }
  try {
    if (typeof window !== "undefined" && window.amplitude) window.amplitude.track(name, params || {});
  } catch (e) {
    /* analytics must never break the app */
  }
}

/* ============================================================
   SMALL UI PIECES
   ============================================================ */

function useNarrow(bp = 700) {
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.innerWidth <= bp);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(`(max-width:${bp}px)`);
    const handle = (e) => setNarrow(e.matches);
    setNarrow(mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", handle);
    else mq.addListener(handle);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handle);
      else mq.removeListener(handle);
    };
  }, [bp]);
  return narrow;
}

function Seg({ options, value, onChange, small, responsive = true, ariaLabel }) {
  const narrow = useNarrow();
  if (responsive && narrow) {
    const idx = options.findIndex((o) => o.v === value);
    return (
      <select className="segsel" aria-label={ariaLabel} value={idx < 0 ? 0 : idx} onChange={(e) => onChange(options[+e.target.value].v)}>
        {options.map((o, i) => (
          <option key={i} value={i}>
            {o.l}
          </option>
        ))}
      </select>
    );
  }
  return (
    <div className={`seg ${small ? "sm" : ""}`} role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={String(o.v)} aria-pressed={value === o.v} className={value === o.v ? "on" : ""} onClick={() => onChange(o.v)}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children, id, tip }) {
  /* Borrow the Field's label for a Seg child that has no ariaLabel of its own, so
     its mobile <select> and its button group are named for screen readers. */
  const kid =
    React.isValidElement(children) && children.type === Seg && !children.props.ariaLabel && typeof label === "string"
      ? React.cloneElement(children, { ariaLabel: label })
      : children;
  return (
    <div className="field">
      {id ? (
        <label className="flabel" htmlFor={id} data-tip={tip}>
          {label}
        </label>
      ) : (
        <span className="flabel" data-tip={tip}>
          {label}
        </span>
      )}
      {kid}
    </div>
  );
}

function IntervalGrid({ root, on, onToggle, flats }) {
  return (
    <div className="ivgrid">
      {DEG.map((d, i) => {
        const active = on.has(i);
        const c = FUNC_COLOUR[i];
        return (
          <button
            key={i}
            className={`iv ${active ? "on" : ""} ${LOWERED.has(i) ? "low" : ""}`}
            aria-pressed={active}
            style={
              active
                ? { background: LOWERED.has(i) ? "transparent" : c, borderColor: c, color: LOWERED.has(i) ? c : "#FFFFFF" }
                : { borderColor: "var(--fret)" }
            }
            onClick={() => onToggle(i)}
          >
            <b>{d}</b>
            <em>{nameOf(root + i, flats)}</em>
          </button>
        );
      })}
    </div>
  );
}

function KeyPicker({ value, onChange, flats, tip }) {
  const [open, setOpen] = useState(false);
  const [upK, setUpK] = useState(false);
  const boxRef = useRef(null);
  const btnRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    if (btnRef.current) {
      const b = btnRef.current.getBoundingClientRect();
      const below = window.innerHeight - b.bottom;
      setUpK(below < 240 && b.top > below);
    }
    /* close on any pointerdown outside this picker, including on another picker */
    const close = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        if (btnRef.current) btnRef.current.focus();
      }
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className="picker" ref={boxRef}>
      <button
        ref={btnRef}
        className={`pickbtn ${open ? "open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        data-tip={tip}
      >
        <span>{nameOf(value, flats)}</span>
        <i className="caret" aria-hidden="true" />
      </button>
      {open && (
        <div className={`pickmenu ${upK ? "up" : ""}`} role="listbox" aria-label="Notes">
          {Array.from({ length: 12 }, (_, i) => i).map((pc) => (
            <button
              key={pc}
              role="option"
              aria-selected={pc === value}
              className={pc === value ? "key on" : "key"}
              onClick={() => {
                onChange(pc);
                setOpen(false);
              }}
            >
              {nameOf(pc, flats)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* Categorized picker: the same compact pattern as KeyPicker, for entities
   with families. One button, a multi-column panel grouped under headings. */
function CatPicker({ value, groups, onChange, label, tip }) {
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(0);
  const [up, setUp] = useState(false);
  const boxRef = useRef(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const uid = useRef(`cp${Math.floor(performance.now() * 1000) % 1e9}`);
  useEffect(() => {
    if (!open) return;
    /* keep the panel inside the viewport: shift left when it would overflow,
       and open upward when there is more room above than below */
    if (menuRef.current && btnRef.current) {
      const b = btnRef.current.getBoundingClientRect();
      const m = menuRef.current.getBoundingClientRect();
      const overflow = b.left + m.width - (window.innerWidth - 16);
      setShift(overflow > 0 ? -Math.min(overflow, b.left - 16) : 0);
      const below = window.innerHeight - b.bottom;
      setUp(below < Math.min(m.height, 320) && b.top > below);
    }
    const close = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      const insidePicker = boxRef.current && boxRef.current.contains(document.activeElement);
      if (e.key === "Escape") {
        setOpen(false);
        if (btnRef.current) btnRef.current.focus();
        return;
      }
      /* arrows drive the menu only while focus is actually in this picker */
      if (!insidePicker) return;
      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && menuRef.current) {
        const opts = [...menuRef.current.querySelectorAll("[role=option]")];
        const i = opts.indexOf(document.activeElement);
        const next = e.key === "ArrowDown" ? Math.min(opts.length - 1, i + 1) : Math.max(0, i - 1);
        if (opts[next]) opts[next].focus();
        e.preventDefault();
      }
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const current = groups.flatMap((g) => g.items).find((x) => x.id === value);
  return (
    <div
      className="picker"
      ref={boxRef}
      onBlur={(e) => {
        /* keyboard users tabbing out should not leave the panel hanging open */
        if (open && boxRef.current && !boxRef.current.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={btnRef}
        className={`pickbtn txt ${open ? "open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        data-tip={tip}
      >
        <span>{current ? current.name : "Choose"}</span>
        <i className="caret" aria-hidden="true" />
      </button>
      {open && (
        <div
          className={`pickmenu catmenu ${up ? "up" : ""}`}
          role="listbox"
          aria-label={label}
          ref={menuRef}
          style={shift ? { left: shift } : undefined}
        >
          {groups
            .filter((g) => g.items.length > 0)
            .map((g, gi) => (
              <div className="catgroup" role="group" aria-labelledby={`${uid.current}-g${gi}`} key={g.label}>
                <p className="cathead" id={`${uid.current}-g${gi}`}>
                  {g.label}
                </p>
                <div className="catitems">
                  {g.items.map((it) => (
                    <button
                      key={it.id}
                      role="option"
                      aria-selected={it.id === value}
                      className={it.id === value ? "catitem on" : "catitem"}
                      onClick={() => {
                        onChange(it.id);
                        setOpen(false);
                        if (btnRef.current) btnRef.current.focus();
                      }}
                    >
                      {it.name}
                      {it.sub && <em>{it.sub}</em>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

/* family groupings for the pickers */
const CHORD_GROUPS = [
  { label: "Triads", ids: ["maj", "min", "5", "dim", "aug", "sus2", "sus4"] },
  { label: "Sixths", ids: ["6", "m6"] },
  { label: "Sevenths", ids: ["7", "maj7", "m7", "m7b5", "dim7", "mmaj7", "7sus4"] },
  { label: "Extended", ids: ["add9", "9", "maj9", "m9", "11", "13"] },
  { label: "Altered", ids: ["7b9", "7s9", "7s5", "7b5"] },
];
const SCALE_GROUPS = [
  { label: "Essentials", ids: ["major", "minor", "majpent", "minpent", "blues", "majblues"] },
  { label: "Minor colours", ids: ["harmmin", "melmin"] },
  { label: "Modes", ids: ["dorian", "phrygian", "lydian", "mixo", "locrian"] },
  { label: "Jazz and exotic", ids: ["phrydom", "lydb7", "altered", "wholetone", "dimhw", "dimwh", "chromatic"] },
];

/* materialize groups from defs, respecting Simple mode like simpleList does */
function groupItems(groups, defs, allow, simpleOn, keepId) {
  return groups
    .map((g) => ({
      label: g.label,
      items: g.ids
        .map((id) => defs.find((d) => d.id === id))
        .filter(Boolean)
        .filter((d) => !simpleOn || allow.has(d.id) || d.id === keepId)
        .map((d) => ({ id: d.id, name: d.name })),
    }))
    .filter((g) => g.items.length > 0);
}

/* One track, two draggers. Thumbs are buttons: draggable by pointer,
   steppable by arrow keys, and announced as sliders. */
function DualRange({ min, max, lo, hi, onChange }) {
  const trackRef = useRef(null);
  const dragRef = useRef(null); // "lo" | "hi" | null
  const clamp = (v) => Math.min(max, Math.max(min, v));
  const valFromX = (clientX) => {
    const r = trackRef.current.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return Math.round(min + t * (max - min));
  };
  const move = (which, v) => {
    v = clamp(v);
    if (which === "lo") onChange([Math.min(v, hi - 1), hi]);
    else onChange([lo, Math.max(v, lo + 1)]);
  };
  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current) return;
      move(dragRef.current, valFromX(e.clientX));
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lo, hi, min, max, onChange]);
  const pct = (v) => ((v - min) / (max - min)) * 100;
  const thumb = (which, v, lab) => (
    <button
      type="button"
      className="drthumb"
      style={{ left: `${pct(v)}%` }}
      role="slider"
      aria-label={lab}
      aria-valuemin={which === "hi" ? lo + 1 : min}
      aria-valuemax={which === "lo" ? hi - 1 : max}
      aria-valuenow={v}
      aria-valuetext={`fret ${v}`}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        dragRef.current = which;
        e.currentTarget.focus();
        e.preventDefault();
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
          move(which, v - 1);
          e.preventDefault();
        }
        if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          move(which, v + 1);
          e.preventDefault();
        }
        if (e.key === "Home") {
          move(which, which === "lo" ? min : lo + 1);
          e.preventDefault();
        }
        if (e.key === "End") {
          move(which, which === "lo" ? hi - 1 : max);
          e.preventDefault();
        }
      }}
    >
      {v}
    </button>
  );
  return (
    <div
      className="dualrange"
      ref={trackRef}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        if (e.target.closest && e.target.closest(".drthumb")) return;
        const v = valFromX(e.clientX);
        const which = Math.abs(v - lo) <= Math.abs(v - hi) ? "lo" : "hi";
        dragRef.current = which;
        move(which, v);
      }}
    >
      <div className="drtrack" aria-hidden="true" />
      <div className="drfill" style={{ left: `${pct(lo)}%`, width: `${Math.max(0, pct(hi) - pct(lo))}%` }} aria-hidden="true" />
      {thumb("lo", lo, "Lowest fret")}
      {thumb("hi", hi, "Highest fret")}
    </div>
  );
}

/* ============================================================
   BANK: star-save and sharing helpers
   ============================================================ */

function shareLinkFromParams(p) {
  const enc = btoa(encodeURIComponent(JSON.stringify(p)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${window.location.origin}/#s=${enc}`;
}

/* round star button: fills when the current thing is already in the Bank */
function StarSave({ saved, onClick, label }) {
  return (
    <button
      type="button"
      className={`starsave ${saved ? "on" : ""}`}
      onClick={onClick}
      aria-pressed={saved}
      data-tip={saved ? "In your Bank" : "Save to Bank"}
      aria-label={saved ? `${label} is saved to your Bank` : `Save ${label} to your Bank`}
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3.2l2.6 5.7 6.2.6-4.7 4.2 1.4 6.1L12 16.8 6.5 19.8l1.4-6.1L3.2 9.5l6.2-.6z" />
      </svg>
    </button>
  );
}

/* the lightbulb: mark a scale/chord/arpeggio as something you know, which feeds
   the practice-routine builder */
function BulbSave({ known, onClick, label }) {
  return (
    <button
      type="button"
      className={`bulbsave ${known ? "on" : ""}`}
      onClick={onClick}
      aria-pressed={known}
      data-tip={known ? "You know this" : "Mark as known"}
      aria-label={known ? `${label} is marked as known` : `Mark ${label} as known`}
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill={known ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.6 1 1.3 1 2.1v.4h6v-.4c0-.8.3-1.5 1-2.1A6 6 0 0 0 12 3z" />
      </svg>
    </button>
  );
}

/* the same "known" toggle, but labelled and prominent at the top of a view */
function KnownButton({ known, onClick }) {
  return (
    <button type="button" className={`knownbtn ${known ? "on" : ""}`} aria-pressed={known} onClick={onClick}>
      <svg
        viewBox="0 0 24 24"
        width="17"
        height="17"
        fill={known ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.6 1 1.3 1 2.1v.4h6v-.4c0-.8.3-1.5 1-2.1A6 6 0 0 0 12 3z" />
      </svg>
      {known ? "You know this" : "Mark as known"}
    </button>
  );
}

/* ============================================================
   ABOUT: resources, feedback, donate
   ============================================================ */

/* Supabase endpoint. The publishable key is a public client key by design;
   env vars override it in other environments. */
const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || "https://wibxytuvqcihbczlwjqq.supabase.co";
const SUPA_KEY = import.meta.env.VITE_SUPABASE_KEY || "sb_publishable_lqSKKddY4wNxxe2cpbLq3Q_aD_aF92x";
const supabase = createClient(SUPA_URL, SUPA_KEY);

/* ============================================================
   ACCOUNTS: username-only auth over Supabase
   ============================================================ */

/* Supabase Auth requires an email field, so usernames get a synthesized
   address at a domain we control. No mail is ever sent to it. */
const FAKE_MAIL = "@u.fretwork-practice.app";
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

/* Where Supabase auth emails (email linking, password reset) should land the
   user. Always the canonical production domain from any deployment, so a
   confirmation opened from a vercel.app preview or the raw project URL still
   returns to www.fretwork-practice.app. Localhost stays local for dev testing.
   The target must also be on Supabase's Redirect URLs allowlist. */
const CANONICAL_URL = "https://www.fretwork-practice.app";
const authRedirect = () => {
  if (typeof window === "undefined") return CANONICAL_URL;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" ? window.location.origin : CANONICAL_URL;
};

/* Obscene or hateful usernames are blocked. Normalisation catches leetspeak
   and separators; the stems intentionally over-block edge cases. */
const BLOCKED_STEMS = [
  "fuck",
  "shit",
  "cunt",
  "bitch",
  "wank",
  "twat",
  "prick",
  "bollock",
  "cock",
  "dick",
  "penis",
  "vagina",
  "boob",
  "tits",
  "jizz",
  "dildo",
  "whore",
  "slut",
  "porn",
  "rape",
  "nonce",
  "pedo",
  "paedo",
  "nigg",
  "fagg",
  "spic",
  "kike",
  "chink",
  "paki",
  "tranny",
  "retard",
  "nazi",
  "hitler",
];
const LEET = { 4: "a", "@": "a", 8: "b", 3: "e", 6: "g", 9: "g", 1: "i", "!": "i", 0: "o", 5: "s", $: "s", 7: "t", "+": "t", 2: "z" };
function usernameProblem(u) {
  if (!USERNAME_RE.test(u)) return "Usernames are 3 to 20 letters, numbers or underscores.";
  const lower = u.toLowerCase();
  const leeted = lower
    .split("")
    .map((c) => LEET[c] || c)
    .join("")
    .replace(/[^a-z]/g, "");
  const candidates = [
    leeted,
    leeted.replace(/(.)\1+/g, "$1"), // collapse doubled letters: fuuck
    lower.replace(/[^a-z]/g, ""), // digits stripped entirely: f0o0ul words hiding behind separators
  ];
  if (BLOCKED_STEMS.some((stem) => candidates.some((c) => c.includes(stem)))) return "That username is not available.";
  return null;
}

/* which open string a detected pitch is closest to, and which way to tune */
function nearestStringTarget(midi, midis) {
  let best = null;
  for (let i = 0; i < midis.length; i++) {
    const diff = midi - midis[i];
    if (!best || Math.abs(diff) < Math.abs(best.diff)) best = { i, diff, target: midis[i] };
  }
  if (!best) return null;
  const roundedDiff = Math.round(best.diff);
  return { label: `string ${midis.length - best.i}`, diff: Math.abs(roundedDiff) <= 0 ? 0 : roundedDiff };
}

/* auth calls fail very differently offline; say so instead of blaming the password */
function isNetErr(er) {
  return !!er && (er.status === 0 || er.name === "AuthRetryableFetchError" || /fetch|network/i.test(er.message || ""));
}

/* PayPal hosted donate button, injected only when About is open. If the SDK
   cannot load or render (offline, blocked scripts), fall back to a plain link. */
const DONATE_URL = "https://www.paypal.com/donate/?hosted_button_id=YTQGVLV25V94A";
/* hidden until there is an audience worth asking; flip to true to bring the
   Support section back */
const SHOW_DONATE = false;
function DonateButton() {
  const boxRef = useRef(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const fail = () => {
      if (!cancelled) setFailed(true);
    };
    const render = () => {
      if (cancelled || !boxRef.current) return;
      const D = window.PayPal && window.PayPal.Donation;
      if (!D) return fail();
      try {
        boxRef.current.innerHTML = "";
        /* the donate SDK resolves a selector string, not a DOM node; it also
           copies the id onto its injected img, so the container id must differ */
        D.Button({
          env: "production",
          hosted_button_id: "YTQGVLV25V94A",
          image: {
            src: "https://www.paypalobjects.com/en_GB/i/btn/btn_donate_LG.gif",
            alt: "Donate with PayPal button",
            title: "PayPal - The safer, easier way to pay online!",
          },
        }).render("#donate-box");
        track("donate_shown");
      } catch (e) {
        fail();
      }
    };
    if (window.PayPal) {
      render();
      return () => {
        cancelled = true;
      };
    }
    let s = document.getElementById("paypal-donate-sdk");
    if (!s) {
      s = document.createElement("script");
      s.id = "paypal-donate-sdk";
      s.src = "https://www.paypalobjects.com/donate/sdk/donate-sdk.js";
      s.charset = "UTF-8";
      document.head.appendChild(s);
    }
    s.addEventListener("load", render);
    s.addEventListener("error", fail);
    const slow = setTimeout(() => {
      if (!window.PayPal) fail();
    }, 6000);
    return () => {
      cancelled = true;
      clearTimeout(slow);
      s.removeEventListener("load", render);
      s.removeEventListener("error", fail);
    };
  }, []);
  if (failed)
    return (
      <p className="note">
        <a className="donatelink" href={DONATE_URL} target="_blank" rel="noopener noreferrer">
          Donate with PayPal
        </a>
      </p>
    );
  return <div id="donate-box" className="donatebox" ref={boxRef} />;
}

/* Feedback form posting straight to the Supabase feedback table */
function FeedbackForm() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  const [trap, setTrap] = useState(""); // honeypot; bots fill it, people never see it

  const submit = async (e) => {
    e.preventDefault();
    if (trap || !message.trim() || state === "sending") return;
    setState("sending");
    try {
      let uid = null;
      let bearer = SUPA_KEY;
      try {
        const { data } = await supabase.auth.getSession();
        if (data && data.session) {
          uid = data.session.user.id;
          bearer = data.session.access_token;
        }
      } catch (err) {
        /* signed out */
      }
      const res = await fetch(`${SUPA_URL}/rest/v1/feedback`, {
        method: "POST",
        headers: {
          apikey: SUPA_KEY,
          Authorization: `Bearer ${bearer}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ name: name.trim() || null, message: message.trim(), user_id: uid }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      track("feedback_submit");
      setState("sent");
      setName("");
      setMessage("");
    } catch (err) {
      setState("error");
    }
  };

  if (state === "sent")
    return (
      <div className="feedback">
        <p className="done" role="status">
          Thank you. Your feedback has been sent.
        </p>
        <button className="btn ghost" type="button" onClick={() => setState("idle")}>
          Send another
        </button>
      </div>
    );

  return (
    <form className="feedback" onSubmit={submit}>
      <Field label="Name (optional)">
        <input type="text" aria-label="Name (optional)" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Suggestion or feedback">
        <textarea
          aria-label="Suggestion or feedback"
          value={message}
          required
          maxLength={2000}
          rows={4}
          placeholder="A feature you would like, or something that is not working for you"
          onChange={(e) => setMessage(e.target.value)}
        />
      </Field>
      <input
        type="text"
        value={trap}
        onChange={(e) => setTrap(e.target.value)}
        className="trap"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      <div className="row">
        <button className="btn" type="submit" disabled={state === "sending" || !message.trim()}>
          {state === "sending" ? "Sending" : "Send feedback"}
        </button>
        <p className="empty" role="status" aria-live="polite">
          {state === "error" ? "That did not send. Please try again in a minute." : ""}
        </p>
      </div>
    </form>
  );
}

/* small decorative icons for the nav section headings */
function HeadIcon({ kind }) {
  const shapes = {
    learn: <path d="M2 3.5c2-1.2 4-1.2 6 0v9c-2-1.2-4-1.2-6 0zM8 3.5c2-1.2 4-1.2 6 0v9c-2-1.2-4-1.2-6 0z" />,
    practice: (
      <>
        <circle cx="8" cy="8" r="5.5" />
        <circle cx="8" cy="8" r="2" />
      </>
    ),
    profile: (
      <>
        <circle cx="8" cy="5" r="3" />
        <path d="M2.5 14c1-3 3-4.5 5.5-4.5s4.5 1.5 5.5 4.5" />
      </>
    ),
    tools: (
      <>
        <path d="M2 4.5h6M12.5 4.5H14M2 11.5h1.5M8 11.5h6" />
        <circle cx="10" cy="4.5" r="1.8" />
        <circle cx="5.5" cy="11.5" r="1.8" />
      </>
    ),
  };
  return (
    <svg
      className="dicon"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {shapes[kind]}
    </svg>
  );
}

/* ============================================================
   APP
   ============================================================ */

const DEFAULT_SETTINGS = {
  fretCount: 22,
  tuningId: "std",
  midis: TUNINGS[0].midi,
  flats: false,
  noteNames: "auto",
  leftHanded: false,
  highOnTop: true,
  labelMode: "name",
  colourMode: "interval",
  sound: true,
  zoom: 1,
  bpm: 90,
  beats: 4,
  clickSound: "click",
  accent: "down",
  subdiv: "1",
  dark: false,
  simple: false,
  highContrast: false,
  lowMotion: false,
  span: 4,
  inversions: false,
  barres: true,
};

export default function App() {
  /* start brand-new visitors in Simple mode (no settings saved yet). Read
     synchronously so a mount-time persist cannot mask first run. */
  const [settings, setSettings] = useState(() => {
    const firstRun = typeof window !== "undefined" && !window.localStorage.getItem("fretboard:settings");
    return firstRun ? { ...DEFAULT_SETTINGS, simple: true } : DEFAULT_SETTINGS;
  });
  const [loaded, setLoaded] = useState(false);
  /* true once there is nothing left to reconcile: signed out, or the sign-in
     merge has finished. The badge baseline waits for this so a returning player
     on a fresh device is not spammed with toasts for already-earned progress. */
  const [progressSynced, setProgressSynced] = useState(false);
  const [mode, setMode] = useState(() => {
    if (typeof window === "undefined") return "chord";
    /* a share link (#s=...) resolves its own view after hydration */
    if (/^#s=/.test(window.location.hash || "")) return "chord";
    return modeForPath(window.location.pathname) || "chord";
  });
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  const [capo, setCapo] = useState(0);
  const [openPanel, setOpenPanel] = useState(null);
  const [drawer, setDrawer] = useState(false);
  /* nav accordions: Learn open by default to cut the visual noise */
  const [openCats, setOpenCats] = useState({ learn: true, practice: false, tools: false, profile: false });
  const toggleCat = (c) => setOpenCats((o) => ({ ...o, [c]: !o[c] }));
  /* Simple mode turning on leaves any now-hidden view; opening the menu reveals
     the active view's group so you can always see where you are. */
  useEffect(() => {
    if (settings.simple && SIMPLE_HIDDEN.has(mode)) setMode("chord"); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [settings.simple]);
  useEffect(() => {
    if (drawer) {
      const c = CAT_OF[mode];
      if (c) setOpenCats((o) => (o[c] ? o : { ...o, [c]: true }));
    } /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [drawer]);
  const burgerRef = useRef(null);
  const [scalePos, setScalePos] = useState(null);
  const [chordArea, setChordArea] = useState(null);
  const [toast, setToast] = useState("");

  const [scaleRoot, setScaleRoot] = useState(0);
  const [scaleId, setScaleId] = useState("major");
  const [scaleLabel, setScaleLabel] = useState("name");
  const [playing, setPlaying] = useState(null);

  const [arpRoot, setArpRoot] = useState(0);
  const [arpId, setArpId] = useState("maj");
  const [arpDir, setArpDir] = useState("up");
  const [arpPos, setArpPos] = useState(null);
  const [arpLabel, setArpLabel] = useState("name");

  const [chordRoot, setChordRoot] = useState(0);
  const [chordId, setChordId] = useState("maj");
  const [voiceIdx, setVoiceIdx] = useState(0);

  const [showAllTones, setShowAllTones] = useState(true);
  const [chordLabel, setChordLabel] = useState("finger");

  const [ivRoot, setIvRoot] = useState(0);
  const [ivOn, setIvOn] = useState(() => new Set([0, 4, 7]));
  const toggleIv = useCallback((i) => {
    setIvOn((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }, []);

  const [progRoot, setProgRoot] = useState(0);
  const [progId, setProgId] = useState("p1564");
  const [progIdx, setProgIdx] = useState(0);
  const [progPlaying, setProgPlaying] = useState(false);
  const [customProgs, setCustomProgs] = useState([]);
  const [builder, setBuilder] = useState({ bars: [], name: "", sections: {} });
  const [builderKeyQual, setBuilderKeyQual] = useState("major"); // major/minor, for the "add by chord name" picker

  const [melSteps, setMelSteps] = useState([]); // [{s, f}]
  const [melName, setMelName] = useState("");
  const [melImport, setMelImport] = useState(false);
  const [melImportText, setMelImportText] = useState("");
  const [melodies, setMelodies] = useState([]);
  const [melPlayIdx, setMelPlayIdx] = useState(null);
  const [melRate, setMelRate] = useState(2); // slots per beat on playback (2 = eighths)
  const [melBars, setMelBars] = useState(2); // timeline length in bars
  const [melCursor, setMelCursor] = useState(0); // slot the next tapped note lands on
  const [melLoop, setMelLoop] = useState(false); // repeat the melody until Stop
  const [strumPatId, setStrumPatId] = useState("oldfaithful");
  const [strumStep, setStrumStep] = useState(null); // current eighth slot during playback
  const [strumOn, setStrumOn] = useState(false);
  const [strumClick, setStrumClick] = useState(false); // play the metronome click along with the strum

  const [ear, setEar] = useState({
    source: "interval", // interval | chord
    dir: "quiz", // quiz | explore
    level: "simple", // simple | all
    current: null, // { root, answer }
    picked: null,
    started: false, // true once the user presses Start, so entering the view does not auto-play
    correct: 0,
    wrong: 0,
    streak: 0,
  });
  const [finderSel, setFinderSel] = useState(new Set()); // "s:f" positions tapped in the chord finder

  const [bank, setBank] = useState([]);
  /* "things you know": items the player has marked with the lightbulb, plus the
     last star rating a practice routine gave each, which weights future routines */
  const [known, setKnown] = useState([]); // [{ sig, kind, root, id, label }]
  const [routineRatings, setRoutineRatings] = useState({}); // sig -> 1..3
  const [routineDur, setRoutineDur] = useState(10); // minutes
  const [routine, setRoutine] = useState(null); // null | { phase:'running'|'rate', segments:[{item,seconds,stretch}], idx, remaining, duration }
  const [metroOn, setMetroOn] = useState(false);
  const [beat, setBeat] = useState(-1);

  const [quiz, setQuiz] = useState({
    source: "scale",
    difficulty: 0.35,
    range: [0, 12],
    hidden: null,
    found: new Set(),
    correct: 0,
    wrong: 0,
    streak: 0,
    best: 0,
    rounds: 0,
    done: false,
  });
  const [flash, setFlash] = useState(null);

  /* one-minute chord change trainer */
  const [chg, setChg] = useState({
    chords: [
      { root: 9, id: "maj" },
      { root: 2, id: "maj" },
    ], // A, D, the classic first pair
    duration: 60,
    phase: "idle", // idle | running | done
    remaining: 60,
  });
  const [chgRecords, setChgRecords] = useState({}); // key -> { best, last, tries }
  const [chgEntry, setChgEntry] = useState("");

  /* ---- account ---- */
  const [authUser, setAuthUser] = useState(null);
  const [authMode, setAuthMode] = useState("create"); // signin | create
  const [authName, setAuthName] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authErr, setAuthErr] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [linkEmail, setLinkEmail] = useState("");
  const [linkState, setLinkState] = useState("idle"); // idle | busy | sent | err
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPass, setNewPass] = useState("");
  const syncTimers = useRef({});
  const authTokenRef = useRef(null);

  /* mic tuner: nothing here touches the microphone until the user starts it */
  const [tuner, setTuner] = useState({ on: false, note: null, cents: 0, freq: 0, error: null });
  const micRef = useRef(null); // { stream, ctx, raf }
  const [capoShape, setCapoShape] = useState(7); // chords you know (G shapes)
  const [capoTarget, setCapoTarget] = useState(9); // key you want to hear (A)

  const [practiceLog, setPracticeLog] = useState({}); // { 'YYYY-MM-DD': { total, byMode: {} } }
  const lastActiveRef = useRef(Date.now());
  const modeRef = useRef("chord");
  /* gamification: durable counters that feed points/level/badges, plus `acked`
     (which badge tiers and level have already been celebrated so we do not
     re-toast or re-fire GA on reload). Practice minutes come from practiceLog. */
  const [gamify, setGamify] = useState({
    counters: {
      earCorrect: 0,
      earStreakInterval: 0,
      earStreakChord: 0,
      tourTaken: 0,
      triedSimple: 0,
      tunings: [],
      metronomeSeconds: 0,
      chordChangesTotal: 0,
      chordChangeBest: 0,
      bestDayStreak: 0,
    },
    acked: {},
  });
  const gamifyReadyRef = useRef(false);
  const [celebrate, setCelebrate] = useState(null); // { type:'badge'|'level', ... } shown as a reward popup
  useEffect(() => {
    if (!celebrate) return;
    const t = setTimeout(() => setCelebrate(null), 3600);
    return () => clearTimeout(t);
  }, [celebrate]);
  /* persist gamify only after the initial load, so the empty default never
     overwrites saved progress on mount */
  useEffect(() => {
    if (loaded) store.set("fretboard:gamify", JSON.stringify(gamify)).catch(() => {});
  }, [gamify, loaded]);

  const [tour, setTour] = useState(-1);
  const [tourRect, setTourRect] = useState(null);
  const tourRef = useRef(-1);
  useEffect(() => {
    tourRef.current = tour;
  }, [tour]);
  const tourCardRef = useRef(null);
  const hadShareHashRef = useRef(typeof window !== "undefined" && /^#s=/.test(window.location.hash || ""));

  /* SPA page views: send a real page_view (and Amplitude screen_view) per view
     change, since GA/Amplitude cannot see our state-only navigation. GA4 counts
     a session with 2+ page_views as engaged, so this is what lifts engagement
     off the floor and populates the per-view usage reports. */
  const lastPVRef = useRef(null); // last emitted path; dedupes StrictMode double-invoke and same-view re-entry
  /* strict: a well-formed share hash means the share effect will resolve the
     landing view and own its page_view, so the [mode] effect must stay quiet
     until then. A loosely-shaped hash (#s= with bad chars) fails this regex, so
     the [mode] effect emits the landing normally rather than recording nothing. */
  const strictShareRef = useRef(typeof window !== "undefined" && /^#s=[A-Za-z0-9_-]+$/.test(window.location.hash || ""));
  const shareHandledRef = useRef(false); // set once the share effect has emitted the share-load page_view
  const routedRef = useRef(false); // true once the router has reconciled the URL at least once
  const fromPopRef = useRef(false); // the current mode change came from Back/Forward, so do not write history
  const firePageView = useCallback((m) => {
    /* page_location uses the real routed path so analytics matches the URL bar */
    const path = pathForMode(m);
    const title = (VIEW_META[m] && VIEW_META[m].title) || m;
    if (path === lastPVRef.current) return;
    const loc = window.location.origin + path;
    const referrer = lastPVRef.current ? window.location.origin + lastPVRef.current : document.referrer || undefined;
    lastPVRef.current = path;
    try {
      if (typeof window.gtag === "function")
        window.gtag("event", "page_view", { page_title: title, page_location: loc, page_referrer: referrer });
    } catch (e) {
      /* analytics must never break the app */
    }
    try {
      if (window.amplitude) window.amplitude.track("screen_view", { screen: m, path, title });
    } catch (e) {
      /* analytics must never break the app */
    }
  }, []);

  /* Publish FAQPage structured data ONLY while the Help & FAQ view is showing, so
     the markup is present exactly when its questions are in the DOM. Google
     requires FAQ structured data to match content visible on the page, and this
     is a single-page app, so tying the schema to the view keeps them honest and
     in step. Built from the same FAQS the view renders. The static
     WebApplication schema in index.html always applies. */
  useEffect(() => {
    if (typeof document === "undefined") return;
    const existing = document.getElementById("faq-jsonld");
    if (mode !== "faq") {
      if (existing) existing.remove();
      return;
    }
    const data = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    };
    let el = existing;
    if (!el) {
      el = document.createElement("script");
      el.type = "application/ld+json";
      el.id = "faq-jsonld";
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
  }, [mode]);

  /* Give each in-app view its own browser tab and history title. The default
     landing (chord) keeps the keyword-rich homepage title so search results are
     not weakened; other views read "<View> · Fretwork". */
  useEffect(() => {
    if (typeof document === "undefined") return;
    const m = VIEW_META[mode];
    document.title =
      mode === "chord" ? "Fretwork: Guitar Fretboard Trainer for Scales and Chords" : m ? `${m.title} · Fretwork` : "Fretwork";
  }, [mode]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      authTokenRef.current = data.session ? data.session.access_token : null;
      setAuthUser(data.session ? data.session.user : null);
      if (!data.session) setProgressSynced(true);
    });
    const { data } = supabase.auth.onAuthStateChange((evt, session) => {
      authTokenRef.current = session ? session.access_token : null;
      setAuthUser(session ? session.user : null);
      if (!session) setProgressSynced(true);
      if (evt === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
        setMode("account");
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const uname = authUser ? authUser.user_metadata?.username || (authUser.email || "").split("@")[0] : null;
  const linkedEmail = authUser && authUser.email && !authUser.email.endsWith(FAKE_MAIL) ? authUser.email : null;

  /* push a field to the synced row, debounced; local storage stays the source
     of truth when signed out */
  const syncField = useCallback(
    (field, value) => {
      if (!authUser) return;
      const prev = syncTimers.current[field];
      if (prev) clearTimeout(prev.timer);
      const entry = { value, uid: authUser.id };
      entry.timer = setTimeout(() => {
        delete syncTimers.current[field];
        supabase
          .from("user_data")
          .upsert({ user_id: entry.uid, [field]: value, updated_at: new Date().toISOString() })
          .then(({ error }) => {
            if (error && authTokenRef.current) setToast("Sync failed, saved locally");
          });
      }, 700);
      syncTimers.current[field] = entry;
    },
    [authUser],
  );

  /* run any pending debounced syncs immediately (sign-out, page hide) */
  const flushSync = useCallback(async () => {
    const entries = Object.entries(syncTimers.current);
    syncTimers.current = {};
    await Promise.all(
      entries.map(([field, entry]) => {
        clearTimeout(entry.timer);
        return supabase.from("user_data").upsert({ user_id: entry.uid, [field]: entry.value, updated_at: new Date().toISOString() });
      }),
    );
  }, []);

  /* sync gamification progress to the account. Kept separate from the main
     sync and self-disabling, so if the `gamify` column has not been added yet
     it fails once quietly rather than nagging or breaking the other syncs. */
  const gamifySyncOffRef = useRef(false);
  /* only push gamify after the account's copy has been folded in, so an empty
     local default cannot overwrite real server progress before the merge lands */
  const [gamifyMerged, setGamifyMerged] = useState(false);
  useEffect(() => {
    setGamifyMerged(false);
  }, [authUser && authUser.id]);
  /* current values for the pagehide keepalive (effect closes over mount-time values) */
  const gamifyRef = useRef(gamify);
  const uidRef = useRef(null);
  const gamifyMergedRef = useRef(false);
  useEffect(() => {
    gamifyRef.current = gamify;
  }, [gamify]);
  useEffect(() => {
    uidRef.current = authUser ? authUser.id : null;
  }, [authUser]);
  useEffect(() => {
    gamifyMergedRef.current = gamifyMerged;
  }, [gamifyMerged]);
  useEffect(() => {
    if (!loaded || !authUser || gamifySyncOffRef.current || !gamifyMerged) return;
    const t = setTimeout(() => {
      supabase
        .from("user_data")
        .upsert({ user_id: authUser.id, gamify, updated_at: new Date().toISOString() })
        .then(({ error }) => {
          if (error && /column|gamify|schema/i.test(error.message || "")) gamifySyncOffRef.current = true;
        });
    }, 900);
    return () => clearTimeout(t);
  }, [gamify, loaded, authUser, gamifyMerged]);

  /* on sign-in, fold the account's saved progress into the local copy (higher
     counters, union of tunings, highest badge tiers). Guarded so a missing
     column cannot break sign-in. */
  useEffect(() => {
    if (!authUser) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.from("user_data").select("gamify").eq("user_id", authUser.id).maybeSingle();
        if (!cancelled && !error && data && data.gamify) setGamify((local) => mergeGamify(local, data.gamify));
      } catch (e) {
        /* the gamify column may not exist yet */
      } finally {
        if (!cancelled) setGamifyMerged(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authUser && authUser.id]);

  /* on page hide, push pending syncs with keepalive requests that outlive the tab */
  useEffect(() => {
    const onHide = () => {
      const token = authTokenRef.current;
      const entries = Object.entries(syncTimers.current);
      syncTimers.current = {};
      if (!token) return;
      for (const [field, entry] of entries) {
        clearTimeout(entry.timer);
        fetch(`${SUPA_URL}/rest/v1/user_data?on_conflict=user_id`, {
          method: "POST",
          keepalive: true,
          headers: {
            apikey: SUPA_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates",
          },
          body: JSON.stringify({ user_id: entry.uid, [field]: entry.value, updated_at: new Date().toISOString() }),
        }).catch(() => {});
      }
      /* flush the latest gamify too (its sync is a bare debounce, not in syncTimers) */
      if (uidRef.current && gamifyMergedRef.current && !gamifySyncOffRef.current) {
        fetch(`${SUPA_URL}/rest/v1/user_data?on_conflict=user_id`, {
          method: "POST",
          keepalive: true,
          headers: {
            apikey: SUPA_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates",
          },
          body: JSON.stringify({ user_id: uidRef.current, gamify: gamifyRef.current, updated_at: new Date().toISOString() }),
        }).catch(() => {});
      }
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  /* on sign-in, the account's data wins; a brand-new account adopts what is
     already on this device so nothing is lost by signing up */
  useEffect(() => {
    if (!authUser || !loaded) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("user_data")
        .select("bank,changes,custom_progs,melodies,practice_log")
        .eq("user_id", authUser.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setToast("Could not load synced data");
        setProgressSynced(true);
        return;
      }
      if (data) {
        if (Array.isArray(data.bank)) {
          setBank(data.bank);
          store.set("fretboard:bank", JSON.stringify(data.bank)).catch(() => {});
        }
        if (data.changes && typeof data.changes === "object") {
          setChgRecords(data.changes);
          store.set("fretboard:changes", JSON.stringify(data.changes)).catch(() => {});
        }
        if (Array.isArray(data.custom_progs)) {
          setCustomProgs(data.custom_progs);
          store.set("fretboard:customprogs", JSON.stringify(data.custom_progs)).catch(() => {});
        }
        if (Array.isArray(data.melodies)) {
          setMelodies(data.melodies);
          store.set("fretboard:melodies", JSON.stringify(data.melodies)).catch(() => {});
        }
        if (data.practice_log && typeof data.practice_log === "object" && !Array.isArray(data.practice_log)) {
          /* merge server and local by taking the higher total per day */
          setPracticeLog((local) => {
            const merged = { ...local };
            let localWonADay = false;
            for (const [k, v] of Object.entries(data.practice_log)) {
              if (!merged[k] || v.total > merged[k].total) merged[k] = v;
            }
            for (const k of Object.keys(local))
              if (!data.practice_log[k] || local[k].total > (data.practice_log[k].total || 0)) localWonADay = true;
            store.set("fretboard:practicelog", JSON.stringify(merged)).catch(() => {});
            /* if the local copy had days the server lacked or beat, push the reconciled log back now */
            if (localWonADay) syncField("practice_log", merged);
            return merged;
          });
        }
        setToast("Synced");
      } else {
        const { error: insErr } = await supabase
          .from("user_data")
          .upsert({ user_id: authUser.id, bank, changes: chgRecords, custom_progs: customProgs, melodies, practice_log: practiceLog });
        setToast(insErr ? "Sync failed, saved locally" : "Account ready, this device's saves are now synced");
      }
      if (!cancelled) setProgressSynced(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser && authUser.id, loaded]);

  const doAuth = async (e) => {
    e.preventDefault();
    setAuthErr("");
    const name = authName.trim();
    if (authMode === "create") {
      const prob = usernameProblem(name);
      if (prob) return setAuthErr(prob);
      if (authPass.length < 8) return setAuthErr("Password needs at least 8 characters.");
      setAuthBusy(true);
      const { error } = await supabase.auth.signUp({
        email: name.toLowerCase() + FAKE_MAIL,
        password: authPass,
        options: { data: { username: name } },
      });
      setAuthBusy(false);
      if (error)
        return setAuthErr(
          isNetErr(error)
            ? "Could not reach the server. Check your connection and try again."
            : /already|registered/i.test(error.message)
              ? "That username is taken."
              : error.message,
        );
      track("sign_up");
      setToast("Account created");
    } else {
      setAuthBusy(true);
      const email = name.includes("@") ? name : name.toLowerCase() + FAKE_MAIL;
      const { error } = await supabase.auth.signInWithPassword({ email, password: authPass });
      setAuthBusy(false);
      if (error)
        return setAuthErr(
          isNetErr(error) ? "Could not reach the server. Check your connection and try again." : "Wrong username or password.",
        );
      track("sign_in");
    }
    setAuthName("");
    setAuthPass("");
  };

  const doSignOut = async () => {
    await flushSync();
    await supabase.auth.signOut();
    track("sign_out");
    /* clear this account's data locally so it cannot bleed into the next
       sign-in on the same browser (the server copy was just flushed) */
    setGamify({
      counters: {
        earCorrect: 0,
        earStreakInterval: 0,
        earStreakChord: 0,
        tourTaken: 0,
        triedSimple: 0,
        tunings: [],
        metronomeSeconds: 0,
        chordChangesTotal: 0,
        chordChangeBest: 0,
      },
      acked: {},
    });
    setPracticeLog({});
    setBank([]);
    setChgRecords({});
    setCustomProgs([]);
    setMelodies([]);
    gamifyReadyRef.current = false;
    gamifySyncOffRef.current = false;
    store.set("fretboard:gamify", JSON.stringify({ counters: {}, acked: {} })).catch(() => {});
    store.set("fretboard:practicelog", "{}").catch(() => {});
    store.set("fretboard:bank", "[]").catch(() => {});
    store.set("fretboard:changes", "{}").catch(() => {});
    store.set("fretboard:customprogs", "[]").catch(() => {});
    store.set("fretboard:melodies", "[]").catch(() => {});
    setAuthMode("signin");
    setLinkEmail("");
    setLinkState("idle");
    setRecoveryMode(false);
    setToast("Signed out");
  };

  const [linkErrMsg, setLinkErrMsg] = useState("");
  const doLinkEmail = async (e) => {
    e.preventDefault();
    const em = linkEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(em) || em.endsWith(FAKE_MAIL)) {
      setLinkErrMsg("That does not look like a usable email address.");
      return setLinkState("err");
    }
    setLinkState("busy");
    const { error } = await supabase.auth.updateUser({ email: em }, { emailRedirectTo: authRedirect() });
    if (error) {
      setLinkErrMsg(
        isNetErr(error)
          ? "Could not reach the server. Try again when you are online."
          : /already|registered|exists/i.test(error.message)
            ? "That address is already in use."
            : "That did not work. Check the address and try again.",
      );
      return setLinkState("err");
    }
    track("email_linked");
    setLinkState("sent");
  };

  /* forgot password: needs a linked email, sends the Supabase recovery mail */
  const doForgot = async () => {
    const name = authName.trim();
    if (!name.includes("@")) {
      setAuthErr("Recovery needs a linked email. Enter that email address above, then press Forgot password.");
      return;
    }
    setAuthBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(name.toLowerCase(), {
      redirectTo: authRedirect(),
    });
    setAuthBusy(false);
    if (error && isNetErr(error)) {
      setAuthErr("Could not reach the server. Check your connection and try again.");
      return;
    }
    setAuthErr("");
    setToast("If that address is linked to an account, a reset email is on its way");
  };

  /* recovery redirect lands signed in; the user sets a fresh password */
  const doSetNewPassword = async (e) => {
    e.preventDefault();
    if (newPass.length < 8) return setAuthErr("Password needs at least 8 characters.");
    setAuthBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPass });
    setAuthBusy(false);
    if (error) return setAuthErr(error.message);
    setAuthErr("");
    setNewPass("");
    setRecoveryMode(false);
    setToast("Password updated");
  };

  /* autocorrelation pitch detection over a mono buffer */
  const detectPitch = (buf, sr) => {
    let rms = 0;
    for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / buf.length);
    if (rms < 0.01) return -1; // too quiet
    let r1 = 0,
      r2 = buf.length - 1;
    const thr = 0.2;
    for (let i = 0; i < buf.length / 2; i++)
      if (Math.abs(buf[i]) < thr) {
        r1 = i;
        break;
      }
    for (let i = 1; i < buf.length / 2; i++)
      if (Math.abs(buf[buf.length - i]) < thr) {
        r2 = buf.length - i;
        break;
      }
    const b = buf.slice(r1, r2);
    /* only correlate lags in the guitar band (about 40 to 1200 Hz), which cuts
       the work from O(n^2) to a narrow strip */
    const minLag = Math.max(1, Math.floor(sr / 1200));
    const maxLag = Math.min(b.length - 1, Math.ceil(sr / 40));
    const c = new Array(maxLag + 1).fill(0);
    for (let lag = minLag; lag <= maxLag; lag++) for (let i = 0; i < b.length - lag; i++) c[lag] += b[i] * b[i + lag];
    let maxv = -1,
      maxp = -1;
    for (let i = minLag; i <= maxLag; i++)
      if (c[i] > maxv) {
        maxv = c[i];
        maxp = i;
      }
    if (maxp <= 0) return -1;
    // parabolic interpolation around the peak
    const x1 = c[maxp - 1] || 0,
      x2 = c[maxp],
      x3 = c[maxp + 1] || 0;
    const a = (x1 + x3 - 2 * x2) / 2,
      bb = (x3 - x1) / 2;
    const period = a ? maxp - bb / (2 * a) : maxp;
    return sr / period;
  };

  const stopTuner = useCallback(() => {
    const m = micRef.current;
    if (m) {
      cancelAnimationFrame(m.raf);
      if (m.stream) m.stream.getTracks().forEach((t) => t.stop());
      if (m.ctx && m.ctx.state !== "closed") m.ctx.close();
      micRef.current = null;
    }
    setTuner({ on: false, note: null, cents: 0, freq: 0, error: null });
  }, []);

  const startTuner = useCallback(async () => {
    if (micRef.current) return; // already listening: ignore a second press
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      /* a second press won the race, or the user left the tuner during the await; release this one */
      if (micRef.current || modeRef.current !== "tuner") {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      const ac = new AC();
      const src = ac.createMediaStreamSource(stream);
      const an = ac.createAnalyser();
      an.fftSize = 2048;
      src.connect(an);
      const buf = new Float32Array(an.fftSize);
      micRef.current = { stream, ctx: ac, raf: 0 };
      setTuner((t) => ({ ...t, on: true, error: null }));
      track("tuner_start");
      let smooth = 0;
      let frame = 0;
      const tick = () => {
        if (!micRef.current) return;
        if (frame++ % 2 === 0) {
          // detection every other frame is plenty and halves the CPU
          an.getFloatTimeDomainData(buf);
          const f = detectPitch(buf, ac.sampleRate);
          if (f > 40 && f < 1200) {
            smooth = smooth ? smooth * 0.8 + f * 0.2 : f;
            const midi = 69 + 12 * Math.log2(smooth / 440);
            const nearest = Math.round(midi);
            const cents = Math.round((midi - nearest) * 100);
            setTuner((t) => ({ ...t, note: nearest, cents, freq: Math.round(smooth) }));
          }
        }
        micRef.current.raf = requestAnimationFrame(tick);
      };
      micRef.current.raf = requestAnimationFrame(tick);
    } catch (e) {
      if (stream) stream.getTracks().forEach((t) => t.stop()); // release an orphaned mic on any post-acquire failure
      setTuner({
        on: false,
        note: null,
        cents: 0,
        freq: 0,
        error: e && e.name === "NotAllowedError" ? "Microphone permission was declined." : "Could not access the microphone.",
      });
    }
  }, []);

  /* release the mic whenever the tuner view is left or the app unmounts */
  useEffect(() => {
    if (mode !== "tuner") stopTuner();
    return () => stopTuner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  /* fonts */
  useEffect(() => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href =
      "https://fonts.googleapis.com/css2?family=Antonio:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap";
    document.head.appendChild(l);
    return () => {
      if (l.parentNode) l.parentNode.removeChild(l);
    };
  }, []);

  /* persisted state */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await store.get("fretboard:settings");
        if (!cancelled && r && r.value) {
          const v = JSON.parse(r.value);
          /* migrate the old sharps/flats toggle: an explicit Flats choice is kept,
             everyone else moves to key-aware Auto */
          if (!v.noteNames && v.flats === true) v.noteNames = "flats";
          setSettings((s) => ({ ...s, ...v }));
        }
      } catch (e) {
        /* first run, nothing stored (Simple mode was set in the state initializer) */
      }
      try {
        const r = await store.get("fretboard:bank");
        if (!cancelled && r && r.value) {
          const v = JSON.parse(r.value);
          if (Array.isArray(v)) setBank(v);
        }
      } catch (e) {
        /* nothing saved yet */
      }
      try {
        const r = await store.get("fretboard:known");
        if (!cancelled && r && r.value) {
          const v = JSON.parse(r.value);
          if (Array.isArray(v)) setKnown(v);
        }
      } catch (e) {
        /* none yet */
      }
      try {
        const r = await store.get("fretboard:routineratings");
        if (!cancelled && r && r.value) {
          const v = JSON.parse(r.value);
          if (v && typeof v === "object") setRoutineRatings(v);
        }
      } catch (e) {
        /* none yet */
      }
      try {
        const r = await store.get("fretboard:stats");
        if (!cancelled && r && r.value) {
          const v = JSON.parse(r.value);
          setQuiz((q) => ({ ...q, correct: v.correct || 0, wrong: v.wrong || 0, best: v.best || 0, rounds: v.rounds || 0 }));
        }
      } catch (e) {
        /* no stats yet */
      }
      try {
        const r = await store.get("fretboard:customprogs");
        if (!cancelled && r && r.value) {
          const v = JSON.parse(r.value);
          if (Array.isArray(v)) setCustomProgs(v);
        }
      } catch (e) {
        /* none yet */
      }
      try {
        const r = await store.get("fretboard:melodies");
        if (!cancelled && r && r.value) {
          const v = JSON.parse(r.value);
          if (Array.isArray(v)) setMelodies(v);
        }
      } catch (e) {
        /* none yet */
      }
      try {
        const r = await store.get("fretboard:practicelog");
        if (!cancelled && r && r.value) {
          const v = JSON.parse(r.value);
          if (v && typeof v === "object" && !Array.isArray(v)) {
            /* max-merge so this cannot clobber a sign-in merge that raced ahead */
            setPracticeLog((cur) => {
              const merged = { ...cur };
              for (const [k, dv] of Object.entries(v)) if (!merged[k] || dv.total > merged[k].total) merged[k] = dv;
              return merged;
            });
          }
        }
      } catch (e) {
        /* none yet */
      }
      try {
        const r = await store.get("fretboard:gamify");
        if (!cancelled && r && r.value) {
          const v = JSON.parse(r.value);
          if (v && typeof v === "object") {
            /* max-merge so a counter bumped before this async load resolves is not clobbered */
            setGamify((g) => mergeGamify(g, v));
          }
        }
      } catch (e) {
        /* no progress yet */
      }
      try {
        const r = await store.get("fretboard:changes");
        if (!cancelled && r && r.value) {
          const v = JSON.parse(r.value);
          if (v && typeof v === "object") setChgRecords(v);
        }
      } catch (e) {
        /* no change-trainer scores yet */
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      store.set("fretboard:settings", JSON.stringify(settings)).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [settings, loaded]);

  const saveStats = useCallback((q) => {
    store.set("fretboard:stats", JSON.stringify({ correct: q.correct, wrong: q.wrong, best: q.best, rounds: q.rounds })).catch(() => {});
  }, []);

  const saveBank = useCallback(
    (next) => {
      setBank(next);
      store.set("fretboard:bank", JSON.stringify(next)).catch(() => {});
      syncField("bank", next);
    },
    [syncField],
  );

  const saveKnown = useCallback((next) => {
    setKnown(next);
    store.set("fretboard:known", JSON.stringify(next)).catch(() => {});
  }, []);
  const toggleKnown = useCallback(
    (item) => {
      const exists = known.some((k) => k.sig === item.sig);
      const next = exists ? known.filter((k) => k.sig !== item.sig) : [item, ...known];
      saveKnown(next);
      setToast(exists ? "Removed from what you know" : "Marked as known");
    },
    [known, saveKnown],
  );

  const saveToBank = useCallback(
    (item) => {
      if (bank.some((b) => b.sig === item.sig)) {
        setToast("Already in your Bank");
        return;
      }
      saveBank([item, ...bank]);
      track("bank_save", { kind: item.kind });
      setToast("Saved to Bank");
    },
    [bank, saveBank],
  );

  const shareBankItem = useCallback(async (item) => {
    const p = {};
    if (item.kind === "chord") Object.assign(p, { m: "chord", r: item.root, id: item.chordId });
    else if (item.kind === "scale") Object.assign(p, { m: "scale", r: item.root, id: item.scaleId });
    else if (item.kind === "arp") Object.assign(p, { m: "arp", r: item.root, id: item.arpId });
    else if (item.kind === "prog") {
      Object.assign(p, { m: "prog", r: item.root, id: item.progId });
      const isPreset = PROGRESSIONS.some((x) => x.id === item.progId);
      if (!isPreset && item.bars) Object.assign(p, { bars: item.bars, nm: item.name || item.label, sec: item.sections });
    }
    if (item.capo) p.capo = item.capo;
    if (item.tun && item.tun !== "std" && item.tun !== "custom") p.tun = item.tun;
    const url = shareLinkFromParams(p);
    try {
      await navigator.clipboard.writeText(url);
      setToast("Link copied");
    } catch (e) {
      window.prompt("Copy this link", url);
    }
    track("bank_share", { kind: item.kind });
  }, []);

  /* one-shot position restore for Bank opens: the reset effects below clear
     scale/arp position on any scale change, so a bank open stashes the wanted
     position here and bumps the nonce to let the matching effect apply it. */
  const restorePosRef = useRef(null);
  const restoreVoiceRef = useRef(null); // key of the saved chord shape to reselect on Bank open
  const [posNonce, setPosNonce] = useState(0);
  const openBankItem = useCallback(
    (item) => {
      if (item.kind === "chord") {
        restoreVoiceRef.current = (item.voicing && item.voicing.key) || null;
        setPosNonce((k) => k + 1);
        setChordArea(null);
        setChordRoot(item.root);
        setChordId(item.chordId);
        setCapo(item.capo || 0);
        setMode("chord");
      } else if (item.kind === "scale") {
        restorePosRef.current = { kind: "scale", pos: item.pos == null ? null : item.pos };
        setPosNonce((k) => k + 1);
        setScaleRoot(item.root);
        setScaleId(item.scaleId);
        setMode("scale");
      } else if (item.kind === "arp") {
        restorePosRef.current = { kind: "arp", pos: item.pos == null ? null : item.pos };
        setPosNonce((k) => k + 1);
        setArpRoot(item.root);
        setArpId(item.arpId);
        if (item.dir) setArpDir(item.dir);
        setMode("arp");
      } else if (item.kind === "prog") {
        setProgRoot(item.root);
        if (PROGRESSIONS.some((x) => x.id === item.progId) || customProgs.some((x) => x.id === item.progId)) setProgId(item.progId);
        else if (item.bars) {
          setBuilder({ bars: item.bars, name: item.name || item.label, sections: item.sections || {} });
          setProgId("custom");
        }
        setMode("prog");
      }
    },
    [customProgs],
  );

  /* derived */
  const midis = settings.midis;
  const n = midis.length;
  const fretCount = settings.fretCount;
  /* keep the capo on the neck if the fret count is lowered under it */
  useEffect(() => {
    setCapo((c) => Math.min(c, fretCount));
  }, [fretCount]);
  const rowToString = useCallback((r) => (settings.highOnTop ? n - 1 - r : r), [n, settings.highOnTop]);
  const geo = useGeometry(fretCount, n, settings.zoom, settings.leftHanded);

  const scaleDef = SCALES.find((s) => s.id === scaleId) || SCALES[0];

  /* One position per scale degree that falls on the lowest string, four frets
     wide. For a pentatonic this reproduces the five familiar boxes; for a
     seven note scale it gives the seven three-note-per-string shapes. Derived
     from the tuning, so it holds up in any tuning. */
  const positions = useMemo(() => {
    const set = new Set(scaleDef.iv.map((i) => i % 12));
    const span = 4;
    const out = [];
    for (let f = capo; f <= fretCount - span && out.length < set.size; f++) {
      const semis = (((midis[0] + f) % 12) - scaleRoot + 24) % 12;
      if (!set.has(semis)) continue;
      out.push({ from: f, to: f + span, deg: semis });
    }
    return out;
  }, [scaleDef, scaleRoot, midis, fretCount, capo]);

  useEffect(() => {
    const r = restorePosRef.current;
    if (r && r.kind === "scale") {
      setScalePos(r.pos);
      restorePosRef.current = null;
      return;
    }
    setScalePos(null);
  }, [scaleId, scaleRoot, settings.tuningId, capo, fretCount, posNonce]);
  const chordDef = CHORDS.find((c) => c.id === chordId) || CHORDS[0];
  const arpDef = CHORDS.find((c) => c.id === arpId) || CHORDS[0];
  const arpPositions = useMemo(() => {
    const set = new Set(arpDef.iv.map((i) => i % 12));
    const span = 4;
    const out = [];
    for (let f = capo; f <= fretCount - span && out.length < set.size; f++) {
      const semis = (((midis[0] + f) % 12) - arpRoot + 24) % 12;
      if (!set.has(semis)) continue;
      out.push({ from: f, to: f + span, deg: semis });
    }
    return out;
  }, [arpDef, arpRoot, midis, fretCount, capo]);
  useEffect(() => {
    const r = restorePosRef.current;
    if (r && r.kind === "arp") {
      setArpPos(r.pos);
      restorePosRef.current = null;
      return;
    }
    setArpPos(null);
  }, [arpId, arpRoot, settings.tuningId, capo, fretCount, posNonce]);
  useEffect(() => {
    if (settings.simple && (arpDir === "thirds" || arpDir === "pedal")) setArpDir("up");
  }, [settings.simple, arpDir]);
  useEffect(() => {
    if (settings.simple) {
      const p = STRUM_PATTERNS.find((x) => x.id === strumPatId);
      if (p && !p.simple) setStrumPatId("oldfaithful");
    }
  }, [settings.simple, strumPatId]);

  const vopt = useMemo(
    () => ({ span: settings.span, inversions: settings.inversions, barres: settings.barres }),
    [settings.span, settings.inversions, settings.barres],
  );

  const voicings = useMemo(() => {
    if (mode !== "chord" && mode !== "strum") return [];
    return findVoicings(chordRoot, chordDef.iv, midis, fretCount, capo, vopt);
  }, [mode, chordRoot, chordDef, midis, fretCount, capo, vopt]);

  /* the frets a shape can start on, so you can jump to shapes near your hand */
  const chordAreas = useMemo(() => [...new Set(voicings.map((v) => v.lowest))].sort((a, b) => a - b), [voicings]);

  const shownVoicings = useMemo(
    () => (chordArea == null ? voicings : voicings.filter((v) => v.lowest === chordArea)),
    [voicings, chordArea],
  );

  useEffect(() => {
    /* a Bank open of a specific shape stashes its key; reselect it, else reset to the first */
    const key = restoreVoiceRef.current;
    if (key) {
      restoreVoiceRef.current = null;
      const idx = shownVoicings.findIndex((v) => v.key === key);
      setVoiceIdx(idx >= 0 ? idx : 0);
    } else {
      setVoiceIdx(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chordRoot, chordId, vopt, capo, settings.tuningId, settings.fretCount, chordArea, posNonce]);

  useEffect(() => {
    if (chordArea != null && !chordAreas.includes(chordArea)) setChordArea(null);
  }, [chordAreas, chordArea]);

  const activeVoicing = shownVoicings[Math.min(voiceIdx, Math.max(0, shownVoicings.length - 1))] || null;

  const progDef = useMemo(() => {
    const preset = PROGRESSIONS.find((p) => p.id === progId);
    if (preset) return preset;
    const saved = customProgs.find((p) => p.id === progId);
    if (saved) return saved;
    if (progId === "custom") {
      const minorish = MINOR_STARTS.has(builder.bars[0]);
      return {
        id: "custom",
        name: builder.name.trim() || "Custom",
        note: "Build your own",
        tonality: minorish ? "minor" : "major",
        bars: builder.bars,
        sections: builder.sections,
      };
    }
    return PROGRESSIONS[0];
  }, [progId, customProgs, builder]);

  const saveCustomProgs = useCallback(
    (next) => {
      setCustomProgs(next);
      store.set("fretboard:customprogs", JSON.stringify(next)).catch(() => {});
      syncField("custom_progs", next);
    },
    [syncField],
  );

  const saveMelodies = useCallback(
    (next) => {
      setMelodies(next);
      store.set("fretboard:melodies", JSON.stringify(next)).catch(() => {});
      syncField("melodies", next);
    },
    [syncField],
  );

  const savePracticeLog = useRef(null);
  useEffect(() => {
    savePracticeLog.current = (next) => {
      store.set("fretboard:practicelog", JSON.stringify(next)).catch(() => {});
      syncField("practice_log", next);
    };
  }, [syncField]);

  /* accumulate practice time: count a tick only when the tab is visible, the
     view is a practice activity, and the player actually did something musical
     recently (played a note, strummed, ran the metronome or a drill). Merely
     sitting on a screen does not tick up, which keeps points honest. */
  useEffect(() => {
    const TICK = 10;
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      if (Date.now() - lastActiveRef.current > 45000) return;
      const m = modeRef.current;
      if (!PRACTICE_MODES[m]) return;
      setPracticeLog((log) => {
        const key = localDay(new Date());
        const day = log[key] || { total: 0, byMode: {} };
        const next = {
          ...log,
          [key]: { total: day.total + TICK, byMode: { ...day.byMode, [m]: (day.byMode[m] || 0) + TICK } },
        };
        if (savePracticeLog.current) savePracticeLog.current(next);
        return next;
      });
    }, TICK * 1000);
    return () => clearInterval(id);
  }, []);

  /* derived practice stats */
  const practiceStats = useMemo(() => {
    const days = Object.keys(practiceLog).sort();
    const today = localDay(new Date());
    let streak = 0;
    for (let i = 0; ; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = localDay(d);
      if (practiceLog[k] && practiceLog[k].total >= 30) streak++;
      else if (k === today)
        continue; // today not practised yet: the streak still stands from yesterday
      else break;
    }
    const week = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = localDay(d);
      week.push({ k, total: practiceLog[k] ? practiceLog[k].total : 0, label: d.toLocaleDateString("en-GB", { weekday: "short" }) });
    }
    const byMode = {};
    let allTime = 0;
    for (const k of days) {
      allTime += practiceLog[k].total;
      for (const [m, sec] of Object.entries(practiceLog[k].byMode || {})) byMode[m] = (byMode[m] || 0) + sec;
    }
    const weekTotal = week.reduce((a, b) => a + b.total, 0);
    const modeRows = Object.entries(byMode).sort((a, b) => b[1] - a[1]);
    const maxDay = Math.max(60, ...week.map((w) => w.total));
    return { streak, week, weekTotal, allTime, modeRows, maxDay, todayTotal: practiceLog[today] ? practiceLog[today].total : 0 };
  }, [practiceLog]);

  /* the snapshot the gamification module scores: durable counters plus per-mode
     practice minutes derived from the practice log */
  const gStats = useMemo(() => {
    const c = gamify.counters;
    const byMode = {};
    for (const day of Object.values(practiceLog))
      for (const [m, sec] of Object.entries(day.byMode || {})) byMode[m] = (byMode[m] || 0) + sec;
    return {
      earCorrect: c.earCorrect || 0,
      earStreakInterval: c.earStreakInterval || 0,
      earStreakChord: c.earStreakChord || 0,
      tourTaken: c.tourTaken || 0,
      triedSimple: c.triedSimple || 0,
      tuningCount: (c.tunings || []).length,
      metronomeMin: Math.floor((c.metronomeSeconds || 0) / 60),
      chordChangeBest: c.chordChangeBest || 0,
      chordChangesTotal: c.chordChangesTotal || 0,
      minScale: Math.floor((byMode.scale || 0) / 60),
      minChord: Math.floor((byMode.chord || 0) / 60),
      minArp: Math.floor((byMode.arp || 0) / 60),
      /* best-ever streak, so the habit badge and points never regress when a streak breaks */
      dayStreak: Math.max(c.bestDayStreak || 0, practiceStats.streak),
      practiceSeconds: practiceStats.allTime,
    };
  }, [gamify.counters, practiceLog, practiceStats.streak, practiceStats.allTime]);

  /* remember the best day streak reached so a missed day cannot drop points */
  useEffect(() => {
    setGamify((g) =>
      practiceStats.streak > (g.counters.bestDayStreak || 0)
        ? { ...g, counters: { ...g.counters, bestDayStreak: practiceStats.streak } }
        : g,
    );
  }, [practiceStats.streak]);

  const gPoints = useMemo(() => pointsFor(gStats), [gStats]);
  const gLevel = useMemo(() => levelProgress(gPoints), [gPoints]);

  /* celebrate newly earned badge tiers and level-ups exactly once. On the first
     pass after load we silently baseline what is already earned so returning
     players are not spammed for past progress. */
  useEffect(() => {
    if (!loaded || !progressSynced) return;
    if (!gamifyReadyRef.current) {
      gamifyReadyRef.current = true;
      setGamify((g) => {
        const a = { ...g.acked };
        let ch = false;
        for (const b of BADGES) {
          const t = badgeTier(b, gStats);
          if (t > (a[b.id] || 0)) {
            a[b.id] = t;
            ch = true;
          }
        }
        if (gLevel.level > (a.__level || 1)) {
          a.__level = gLevel.level;
          ch = true;
        }
        return ch ? { ...g, acked: a } : g;
      });
      return;
    }
    const acked = gamify.acked || {};
    const newly = [];
    for (const b of BADGES) {
      const t = badgeTier(b, gStats);
      if (t > (acked[b.id] || 0)) newly.push({ b, tier: t });
    }
    const levelUp = gLevel.level > (acked.__level || 1);
    if (!newly.length && !levelUp) return;
    setGamify((g) => {
      const a = { ...g.acked };
      for (const { b, tier } of newly) a[b.id] = tier;
      if (levelUp) a.__level = gLevel.level;
      return { ...g, acked: a };
    });
    newly.forEach(({ b, tier }) => track("badge_earned", { badge: b.id, tier }));
    if (levelUp) track("level_up", { level: gLevel.level });
    /* a proper reward moment: a popup that lingers, not just a fleeting toast */
    if (levelUp) setCelebrate({ type: "level", level: gLevel.level });
    else if (newly.length === 1)
      setCelebrate({ type: "badge", name: newly[0].b.name, tier: newly[0].tier, tiers: newly[0].b.tiers.length });
    else setCelebrate({ type: "badges", count: newly.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gStats, gLevel.level, loaded, progressSynced]);

  /* shift every note by semitones on its own string; refuse if any falls off the neck */
  const transposeMelody = useCallback(
    (delta) => {
      const moved = melSteps.map((st) => (st.rest ? st : { s: st.s, f: st.f + delta }));
      if (moved.some((st) => !st.rest && (st.f < 0 || st.f > fretCount))) {
        setToast("That transposition falls off the neck");
        return;
      }
      setMelSteps(moved);
    },
    [melSteps, fretCount],
  );

  const progChords = useMemo(
    () =>
      progDef.bars.map((rn) => {
        const entry = ROMAN[rn] || [0, "maj"];
        const def = CHORDS.find((c) => c.id === entry[1]) || CHORDS[0];
        return { roman: rn, rootPc: (progRoot + entry[0]) % 12, chordId: entry[1], def };
      }),
    [progDef, progRoot],
  );

  const progVoicings = useMemo(() => {
    if (mode !== "prog") return [];
    const cache = new Map();
    return progChords.map((c) => {
      const key = `${c.rootPc}:${c.chordId}`;
      if (!cache.has(key)) {
        const v = findVoicings(c.rootPc, c.def.iv, midis, fretCount, capo, { span: 4, inversions: false, barres: true });
        cache.set(key, v[0] || null);
      }
      return cache.get(key);
    });
  }, [mode, progChords, midis, fretCount, capo]);

  useEffect(() => {
    setProgIdx(0);
  }, [progId, progRoot]);

  const activeProg = progChords[Math.min(progIdx, progChords.length - 1)] || null;

  /* collapse runs of identical bars, so a 12-bar blues reads as three charts
     with bar counts rather than twelve repeats */
  const progGroups = useMemo(() => {
    const sections = progDef.sections || {};
    const out = [];
    progChords.forEach((c, i) => {
      const last = out[out.length - 1];
      const sec = sections[i];
      if (last && !sec && progChords[last.start].roman === c.roman) last.count += 1;
      else out.push({ start: i, count: 1, section: sec || null });
    });
    return out;
  }, [progChords, progDef]);

  /* split the collapsed groups into named song sections */
  const songBlocks = useMemo(() => {
    const blocks = [];
    progGroups.forEach((g) => {
      if (g.section || blocks.length === 0) blocks.push({ name: g.section || null, groups: [g] });
      else blocks[blocks.length - 1].groups.push(g);
    });
    return blocks;
  }, [progGroups]);
  const hasSections = progGroups.some((g) => g.section);

  /* which major key covers the melody's notes best */
  const melKeyHint = useMemo(() => {
    if (!melSteps.length) return null;
    const notes = melSteps.filter((st) => !st.rest);
    if (!notes.length) return null;
    const pcs = [...new Set(notes.map((st) => (settings.midis[st.s] + st.f) % 12))];
    const majorIv = [0, 2, 4, 5, 7, 9, 11];
    let best = null;
    for (let root = 0; root < 12; root++) {
      const set = new Set(majorIv.map((i) => (root + i) % 12));
      const hits = pcs.filter((pc) => set.has(pc)).length;
      if (!best || hits > best.hits) best = { root, hits };
    }
    if (!best || best.hits < pcs.length) return best && best.hits >= pcs.length - 1 ? { ...best, loose: true } : null;
    return best;
  }, [melSteps, settings.midis]);

  /* effective accidental spelling: Auto follows the key of whatever is on screen */
  /* chord finder: turn the tapped positions into pitch classes and name any chords that fit */
  const finderInfo = useMemo(() => {
    const positionsList = [...finderSel];
    const pcs = [
      ...new Set(
        positionsList.map((k) => {
          const [s, f] = k.split(":").map(Number);
          return (midis[s] + f) % 12;
        }),
      ),
    ];
    const pcSet = new Set(pcs);
    const bassKey = positionsList
      .map((k) => {
        const [s, f] = k.split(":").map(Number);
        return { pc: (midis[s] + f) % 12, midi: midis[s] + f };
      })
      .sort((a, b) => a.midi - b.midi)[0];
    const exact = [];
    const partial = [];
    if (pcs.length >= 2) {
      for (let root = 0; root < 12; root++) {
        for (const c of CHORDS) {
          const chordPcs = c.iv.map((i) => (root + i) % 12);
          const chordSet = new Set(chordPcs);
          const covers = pcs.every((pc) => chordSet.has(pc));
          if (!covers) continue;
          const entry = {
            root,
            id: c.id,
            name: `${nameOf(root, keyPrefersFlats(root, c.iv))}${c.suffix}`,
            size: chordPcs.length,
            bass: bassKey && bassKey.pc === root,
          };
          if (chordSet.size === pcSet.size) exact.push(entry);
          else partial.push(entry);
        }
      }
    }
    /* prefer chords whose root is the lowest note, then the smallest superset */
    const rank = (a, b) => b.bass - a.bass || a.size - b.size;
    return { pcs, exact: exact.sort(rank).slice(0, 6), partial: partial.sort(rank).slice(0, 6), bassPc: bassKey ? bassKey.pc : null };
  }, [finderSel, midis]);

  const effFlats = useMemo(() => {
    if (settings.noteNames === "sharps") return false;
    if (settings.noteNames === "flats") return true;
    if (mode === "scale") return keyPrefersFlats(scaleRoot, scaleDef.iv);
    if (mode === "chord" || mode === "bank") return keyPrefersFlats(chordRoot, chordDef.iv);
    if (mode === "arp") return keyPrefersFlats(arpRoot, arpDef.iv);
    if (mode === "prog") return keyPrefersFlats(progRoot, progDef.tonality === "minor" ? [3] : [4]);
    if (mode === "interval") return keyPrefersFlats(ivRoot, ivOn);
    if (mode === "melody") return melKeyHint ? keyPrefersFlats(melKeyHint.root, [0, 2, 4, 5, 7, 9, 11]) : false;
    if (mode === "changes") {
      const c0 = chg.chords[0];
      const d0 = c0 ? CHORDS.find((x) => x.id === c0.id) : null;
      return c0 ? keyPrefersFlats(c0.root, d0 ? d0.iv : [4]) : false;
    }
    if (mode === "quiz")
      return quiz.source === "scale"
        ? keyPrefersFlats(scaleRoot, scaleDef.iv)
        : quiz.source === "chord"
          ? keyPrefersFlats(chordRoot, chordDef.iv)
          : keyPrefersFlats(ivRoot, ivOn);
    if (mode === "finder") {
      const best = finderInfo.exact[0] || finderInfo.partial[0];
      const bestDef = best ? CHORDS.find((x) => x.id === best.id) : null;
      const r = best ? best.root : finderInfo.bassPc;
      return r == null ? false : keyPrefersFlats(r, bestDef ? bestDef.iv : [4]);
    }
    return false;
  }, [
    settings.noteNames,
    mode,
    scaleRoot,
    scaleDef,
    chordRoot,
    chordDef,
    progRoot,
    progDef,
    ivRoot,
    ivOn,
    chg.chords,
    quiz.source,
    melKeyHint,
    arpRoot,
    arpDef,
    finderInfo,
  ]);

  /* per-item spelling for saved things rendered outside their own key context */
  const flatsFor = useCallback(
    (rootPc, iv) => (settings.noteNames === "auto" ? keyPrefersFlats(rootPc, iv) : settings.noteNames === "flats"),
    [settings.noteNames],
  );
  const activeProgVoicing = progVoicings[Math.min(progIdx, progVoicings.length - 1)] || null;

  const playNote = useCallback(
    (midi, when = 0, gain = 0.5) => {
      lastActiveRef.current = Date.now(); // playing a note counts as active practice
      if (settings.sound) pluck(midi, when, gain);
    },
    [settings.sound],
  );

  /* ---- which positions light up ---- */
  const positionsFor = useCallback(
    (rootPc, ivSet, from = 0, to = fretCount) => {
      const out = [];
      const hi = Math.min(to, fretCount);
      for (let s = 0; s < n; s++) {
        for (let f = Math.max(from, capo); f <= hi; f++) {
          const pc = (midis[s] + f) % 12;
          const semis = (pc - rootPc + 24) % 12;
          if (ivSet.has(semis)) out.push({ s, f, pc, semis });
        }
      }
      return out;
    },
    [midis, n, fretCount, capo],
  );

  const marks = useMemo(() => {
    const map = new Map();
    const add = (s, f, pc, semis, tone, state, finger) => {
      map.set(`${s}:${f}`, { pc, semis, tone, state: state || "on", finger: finger == null ? null : finger });
    };

    if (mode === "scale") {
      const set = new Set(scaleDef.iv.map((i) => i % 12));
      const win = scalePos != null ? positions[scalePos] : null;
      for (const p of positionsFor(scaleRoot, set)) {
        const outside = win && (p.f < win.from || p.f > win.to);
        const state = outside ? "dim" : playing != null ? (p.semis === playing ? "lit" : "dim") : null;
        add(p.s, p.f, p.pc, p.semis, "scale", state);
      }
    }

    if (mode === "interval") {
      for (const p of positionsFor(ivRoot, ivOn)) add(p.s, p.f, p.pc, p.semis, "interval");
    }

    if (mode === "chord") {
      if (activeVoicing) {
        for (let s = 0; s < n; s++) {
          const f = activeVoicing.frets[s];
          if (f === null) continue;
          const pc = (midis[s] + f) % 12;
          add(s, f, pc, (pc - chordRoot + 24) % 12, "chord", null, activeVoicing.fingering[s]);
        }
      }
    }

    if (mode === "prog" && activeProg && activeProgVoicing) {
      for (let s2 = 0; s2 < n; s2++) {
        const f = activeProgVoicing.frets[s2];
        if (f === null) continue;
        const pc = (midis[s2] + f) % 12;
        add(s2, f, pc, (pc - activeProg.rootPc + 24) % 12, "chord", null, activeProgVoicing.fingering[s2]);
      }
    }

    if (mode === "quiz" && quiz.hidden) {
      const target = quiz.target;
      for (const p of target) {
        const k = `${p.s}:${p.f}`;
        if (!quiz.hidden.has(k)) add(p.s, p.f, p.pc, p.semis, "quiz");
        else if (quiz.found.has(k)) add(p.s, p.f, p.pc, p.semis, "quiz", "found");
      }
    }

    if (mode === "arp") {
      const set = new Set(arpDef.iv.map((i) => i % 12));
      const win = arpPos != null ? arpPositions[arpPos] : null;
      const inWindow = [];
      for (const p of positionsFor(arpRoot, set)) {
        const outside = win && (p.f < win.from || p.f > win.to);
        const state = outside ? "dim" : playing != null ? (p.semis === playing ? "lit" : "dim") : null;
        add(p.s, p.f, p.pc, p.semis, "arp", state);
        if (!outside) inWindow.push({ key: `${p.s}:${p.f}`, midi: midis[p.s] + p.f });
      }
      /* play-order numbers reflect the chosen direction: ascending for up, descending for down */
      if (arpLabel === "order") {
        const sorted = [...inWindow].sort((a, b) => a.midi - b.midi);
        const down = arpDir === "down" || arpDir === "downup";
        sorted.forEach((nt, idx) => {
          const m = map.get(nt.key);
          if (m) m.custom = String(down ? sorted.length - idx : idx + 1);
        });
      }
    }

    if (mode === "melody") {
      /* the neck is just the note picker now: highlight the note sitting on the
         selected slot, and the note playing back. The sequence lives in the
         timeline below, so no more order numbers scattered across the board. */
      const cur = melSteps[melCursor];
      if (cur && !cur.rest) {
        const pc = (midis[cur.s] + cur.f) % 12;
        add(cur.s, cur.f, pc, (pc - (melKeyHint ? melKeyHint.root : 0) + 12) % 12, "melody", "on");
      }
      const p = melPlayIdx != null ? melSteps[melPlayIdx] : null;
      if (p && !p.rest) {
        const pc = (midis[p.s] + p.f) % 12;
        add(p.s, p.f, pc, (pc - (melKeyHint ? melKeyHint.root : 0) + 12) % 12, "melody", "lit");
      }
    }

    if (mode === "strum" && activeVoicing) {
      /* show the chord shape being strummed on the neck */
      for (let s = 0; s < n; s++) {
        const f = activeVoicing.frets[s];
        if (f === null) continue;
        const pc = (midis[s] + f) % 12;
        add(s, f, pc, (pc - chordRoot + 12) % 12, "chord", "on");
      }
    }

    if (mode === "finder") {
      const rootPc = finderInfo.exact[0] ? finderInfo.exact[0].root : finderInfo.bassPc;
      for (const k of finderSel) {
        const [fs, ff] = k.split(":").map(Number);
        const pc = (midis[fs] + ff) % 12;
        add(fs, ff, pc, rootPc == null ? pc : (pc - rootPc + 12) % 12, "chord", "lit");
      }
    }

    return map;
  }, [
    mode,
    scaleDef,
    scaleRoot,
    ivRoot,
    ivOn,
    activeVoicing,
    chordRoot,
    midis,
    n,
    quiz,
    positionsFor,
    playing,
    activeProg,
    activeProgVoicing,
    scalePos,
    positions,
    melSteps,
    melPlayIdx,
    melCursor,
    melKeyHint,
    arpRoot,
    arpDef,
    arpPos,
    arpPositions,
    arpLabel,
    arpDir,
    finderSel,
    finderInfo,
  ]);

  const ghosts = useMemo(() => {
    if (mode !== "chord" || !showAllTones) return null;
    const set = new Set(chordDef.iv.map((i) => i % 12));
    const g = new Set();
    for (const p of positionsFor(chordRoot, set)) g.add(`${p.s}:${p.f}`);
    return g;
  }, [mode, showAllTones, chordDef, chordRoot, positionsFor]);

  /* ---- quiz ---- */
  const quizTargetSet = useCallback(() => {
    if (quiz.source === "scale") {
      const set = new Set(scaleDef.iv.map((i) => i % 12));
      return positionsFor(scaleRoot, set, quiz.range[0], quiz.range[1]);
    }
    if (quiz.source === "interval") {
      return positionsFor(ivRoot, ivOn, quiz.range[0], quiz.range[1]);
    }
    const set = new Set(chordDef.iv.map((i) => i % 12));
    return positionsFor(chordRoot, set, quiz.range[0], quiz.range[1]);
  }, [quiz.source, quiz.range, scaleDef, scaleRoot, chordDef, chordRoot, ivRoot, ivOn, positionsFor]);

  const newRound = useCallback(() => {
    const target = quizTargetSet();
    if (!target.length) {
      setQuiz((q) => ({ ...q, target: [], hidden: new Set(), found: new Set(), done: false }));
      return;
    }
    const total = target.length;
    const count = Math.max(1, Math.round(1 + (total - 1) * quiz.difficulty));
    const pool = target.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = pool[i];
      pool[i] = pool[j];
      pool[j] = t;
    }
    const hidden = new Set(pool.slice(0, count).map((p) => `${p.s}:${p.f}`));
    setQuiz((q) => ({ ...q, target, hidden, found: new Set(), done: false }));
  }, [quizTargetSet, quiz.difficulty]);

  useEffect(() => {
    if (mode === "quiz") newRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mode,
    quiz.source,
    quiz.difficulty,
    quiz.range[0],
    quiz.range[1],
    scaleRoot,
    scaleId,
    chordRoot,
    chordId,
    ivRoot,
    ivOn,
    capo,
    settings.tuningId,
    settings.fretCount,
  ]);

  const onCell = useCallback(
    (s, f, midi) => {
      if (capo > 0 && f > 0 && f < capo) return;
      if (mode === "melody") {
        playNote(midi);
        const i = melCursor;
        setMelSteps((st) => {
          const n = st.slice();
          while (n.length <= i) n.push({ rest: true });
          n[i] = { s, f };
          return n;
        });
        const total = melBars * MEL_SLOTS;
        if (i + 1 >= total && melBars < MEL_MAX_BARS) setMelBars(melBars + 1);
        setMelCursor(Math.min(i + 1, (melBars < MEL_MAX_BARS ? melBars + 1 : melBars) * MEL_SLOTS - 1));
        return;
      }
      if (mode === "finder") {
        playNote(midi);
        const k = `${s}:${f}`;
        setFinderSel((sel) => {
          const next = new Set(sel);
          if (next.has(k)) next.delete(k);
          else next.add(k);
          return next;
        });
        return;
      }
      if (mode !== "quiz" || !quiz.hidden) {
        playNote(midi);
        return;
      }
      /* nothing to find (empty selection or round complete): sound the note, do not score */
      if (quiz.done || quiz.hidden.size === 0) {
        playNote(midi);
        return;
      }
      const k = `${s}:${f}`;
      if (quiz.found.has(k)) return;
      if (quiz.hidden.has(k)) {
        playNote(midi);
        setFlash({ key: k, ok: true, t: Date.now() });
        setQuiz((q) => {
          const found = new Set(q.found);
          found.add(k);
          const done = found.size >= q.hidden.size;
          const streak = q.streak + 1;
          const next = {
            ...q,
            found,
            done,
            correct: q.correct + 1,
            streak,
            best: Math.max(q.best, streak),
            rounds: done ? q.rounds + 1 : q.rounds,
          };
          saveStats(next);
          return next;
        });
      } else {
        if (settings.sound) blip(false);
        setFlash({ key: k, ok: false, t: Date.now() });
        setQuiz((q) => {
          const next = { ...q, wrong: q.wrong + 1, streak: 0 };
          saveStats(next);
          return next;
        });
      }
    },
    [mode, quiz.hidden, quiz.found, quiz.done, capo, playNote, saveStats, settings.sound, melCursor, melBars],
  );

  useEffect(() => {
    setQuiz((q) =>
      q.range[1] <= fretCount && q.range[0] < fretCount
        ? q
        : { ...q, range: [Math.min(q.range[0], fretCount - 1), Math.min(q.range[1], fretCount)] },
    );
  }, [fretCount]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 480);
    return () => clearTimeout(t);
  }, [flash]);

  const strumVoicing = useCallback(() => {
    if (!activeVoicing) return;
    let i = 0;
    for (let s = 0; s < n; s++) {
      const f = activeVoicing.frets[s];
      if (f === null) continue;
      playNote(midis[s] + f, i * 0.035);
      i++;
    }
  }, [activeVoicing, midis, n, playNote]);

  const playTimers = useRef([]);
  const strumLoopRef = useRef(false);
  const scheduleStrumRef = useRef(() => {});
  const melLoopRef = useRef(false);
  const playMelodyRef = useRef(() => {});
  const stopPlayback = useCallback(() => {
    strumLoopRef.current = false;
    melLoopRef.current = false;
    playTimers.current.forEach(clearTimeout);
    playTimers.current = [];
    setPlaying(null);
    setProgPlaying(false);
    setMelPlayIdx(null);
    setStrumOn(false);
    setStrumStep(null);
  }, []);

  /* one strum of the current chord: down runs low string to high, up reverses */
  const strumChord = useCallback(
    (dir, accent = false, at = 0) => {
      if (!activeVoicing) return;
      const notes = [];
      for (let s = 0; s < n; s++) {
        const f = activeVoicing.frets[s];
        if (f !== null) notes.push(midis[s] + f);
      }
      const seq = dir === "u" ? notes.slice().reverse() : notes;
      const gain = accent ? 0.7 : 0.4;
      seq.forEach((m, i) => playNote(m, at + i * 0.024, gain));
    },
    [activeVoicing, midis, n, playNote],
  );

  /* schedule one cycle of bars, then re-arm the next so the groove loops until
     Stop (re-syncing to the audio clock each cycle keeps the timing honest) */
  const scheduleStrumCycle = useCallback(() => {
    const pat = STRUM_PATTERNS.find((p) => p.id === strumPatId) || STRUM_PATTERNS[0];
    const slotSec = 60 / settings.bpm / 2; // an eighth note
    const BARS = 8;
    for (let loop = 0; loop < BARS; loop++) {
      for (let sl = 0; sl < 8; sl++) {
        const idx = loop * 8 + sl;
        const stroke = pat.slots[sl];
        playTimers.current.push(
          setTimeout(
            () => {
              setStrumStep(sl);
              /* an uppercase slot (D/U) is an accented, louder strum */
              if (stroke) strumChord(stroke.toLowerCase(), stroke === stroke.toUpperCase());
              /* click on each beat (every second eighth), accented on the downbeat */
              if (strumClick && settings.sound && sl % 2 === 0) {
                const ac = ctx();
                if (ac) playClick(settings.clickSound, ac.currentTime, sl === 0);
              }
            },
            idx * slotSec * 1000,
          ),
        );
      }
    }
    playTimers.current.push(
      setTimeout(
        () => {
          if (strumLoopRef.current) scheduleStrumRef.current();
        },
        BARS * 8 * slotSec * 1000,
      ),
    );
  }, [strumPatId, settings.bpm, settings.clickSound, settings.sound, strumClick, strumChord]);
  useEffect(() => {
    scheduleStrumRef.current = scheduleStrumCycle;
  }, [scheduleStrumCycle]);

  const playStrum = useCallback(() => {
    if (!activeVoicing) return;
    stopPlayback();
    setStrumOn(true);
    strumLoopRef.current = true;
    scheduleStrumCycle();
  }, [activeVoicing, stopPlayback, scheduleStrumCycle]);

  const doImportTab = useCallback(
    (text) => {
      /* keep notes on the neck and within the timeline the grid can render */
      const steps = parseTab(text, settings.midis.length)
        .filter((st) => st.f <= fretCount)
        .slice(0, MEL_MAX_BARS * MEL_SLOTS);
      if (!steps.length) {
        setToast("Could not read a tab there. Check the format.");
        return;
      }
      stopPlayback();
      setMelSteps(steps);
      const bars = Math.max(2, Math.min(MEL_MAX_BARS, Math.ceil((steps.length + 1) / MEL_SLOTS)));
      setMelBars(bars);
      setMelCursor(Math.min(steps.length, bars * MEL_SLOTS - 1));
      setMelImport(false);
      setMelImportText("");
      track("melody_import", { notes: steps.length });
      setToast(`Imported ${steps.length} notes`);
    },
    [settings.midis.length, fretCount, stopPlayback],
  );

  const importTabFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        doImportTab(text);
        return;
      }
      setToast("Clipboard is empty. Paste your tab below.");
    } catch (e) {
      /* clipboard read blocked: fall back to the paste box */
    }
    setMelImport(true);
  }, [doImportTab]);

  const playScale = useCallback(() => {
    stopPlayback();
    const set = new Set(scaleDef.iv.map((i) => i % 12));
    const win = scalePos != null ? positions[scalePos] : null;
    let seq;
    if (win) {
      /* play the notes as they lie in the chosen position, low to high */
      const seen = new Set();
      seq = positionsFor(scaleRoot, set, win.from, win.to)
        .map((p) => ({ midi: midis[p.s] + p.f, semis: p.semis }))
        .filter((nt) => (seen.has(nt.midi) ? false : (seen.add(nt.midi), true)))
        .sort((a, b) => a.midi - b.midi);
    } else {
      const rootMidi = midis[0] + ((scaleRoot - (midis[0] % 12) + 24) % 12) + 12;
      seq = scaleDef.iv
        .map((i) => i % 12)
        .concat([0])
        .map((iv, i, arr) => ({ midi: rootMidi + (i === arr.length - 1 ? 12 : iv), semis: iv }));
    }
    const STEP = win ? 0.34 : 0.52;
    seq.forEach((nt, i) => {
      playNote(nt.midi, i * STEP);
      playTimers.current.push(setTimeout(() => setPlaying(nt.semis), i * STEP * 1000));
    });
    playTimers.current.push(setTimeout(() => setPlaying(null), seq.length * STEP * 1000));
  }, [scaleDef, scaleRoot, midis, playNote, stopPlayback, scalePos, positions, positionsFor]);

  const playProgression = useCallback(() => {
    stopPlayback();
    if (!progChords.length) return;
    setProgPlaying(true);
    const barSec = (60 / settings.bpm) * settings.beats;
    playTimers.current.push(setTimeout(() => setProgPlaying(false), progChords.length * barSec * 1000));
    progChords.forEach((c, i) => {
      const v = progVoicings[i];
      if (v) {
        let j = 0;
        for (let st = 0; st < n; st++) {
          const f = v.frets[st];
          if (f === null) continue;
          playNote(midis[st] + f, i * barSec + j * 0.028);
          j++;
        }
      }
      playTimers.current.push(setTimeout(() => setProgIdx(i), i * barSec * 1000));
    });
  }, [stopPlayback, settings.bpm, settings.beats, progChords, progVoicings, midis, n, playNote]);

  const scheduleMelody = useCallback(() => {
    if (!melSteps.some((st) => st && !st.rest)) return;
    /* play the whole timeline including trailing empty slots, so rests keep time */
    const total = Math.max(melBars * MEL_SLOTS, melSteps.length);
    const grid = Array.from({ length: total }, (_, i) => melSteps[i] || { rest: true });
    const stepSec = 60 / settings.bpm / melRate;
    grid.forEach((st, i) => {
      playTimers.current.push(
        setTimeout(
          () => {
            if (!st.rest) {
              playNote(settings.midis[st.s] + st.f);
              setFlash({ key: `${st.s}:${st.f}`, ok: true, t: i });
            }
            setMelPlayIdx(i);
          },
          i * stepSec * 1000,
        ),
      );
    });
    playTimers.current.push(
      setTimeout(
        () => {
          if (melLoopRef.current) playMelodyRef.current();
          else {
            setMelPlayIdx(null);
            setFlash(null);
          }
        },
        total * stepSec * 1000,
      ),
    );
  }, [melSteps, melBars, settings.bpm, settings.midis, melRate, playNote]);
  useEffect(() => {
    playMelodyRef.current = scheduleMelody;
  }, [scheduleMelody]);

  const playMelody = useCallback(() => {
    stopPlayback();
    if (!melSteps.some((st) => st && !st.rest)) return;
    melLoopRef.current = melLoop;
    scheduleMelody();
  }, [stopPlayback, scheduleMelody, melLoop, melSteps]);

  const playArpeggio = useCallback(() => {
    stopPlayback();
    const set = new Set(arpDef.iv.map((i) => i % 12));
    const win = arpPos != null ? arpPositions[arpPos] : null;
    let up;
    if (win) {
      /* play the chord tones as they lie in the chosen position, low to high */
      const seen = new Set();
      up = positionsFor(arpRoot, set, win.from, win.to)
        .map((p) => midis[p.s] + p.f)
        .filter((m) => (seen.has(m) ? false : (seen.add(m), true)))
        .sort((a, b) => a - b);
    } else {
      let base = midis[0];
      let guard = 0;
      while (base % 12 !== arpRoot && guard++ < 12) base++;
      up = [];
      for (let oct = 0; oct < 2; oct++) arpDef.iv.forEach((i) => up.push(base + oct * 12 + i));
      up.push(base + 24);
    }
    let seq = up;
    if (arpDir === "down") seq = [...up].reverse();
    else if (arpDir === "updown") seq = [...up, ...[...up].reverse().slice(1)];
    else if (arpDir === "downup") seq = [...[...up].reverse(), ...up.slice(1)];
    else if (arpDir === "thirds") {
      seq = [];
      for (let i = 0; i + 2 < up.length; i++) seq.push(up[i], up[i + 2]);
    } else if (arpDir === "pedal") {
      seq = [];
      for (let i = 1; i < up.length; i++) seq.push(up[0], up[i]);
    }
    const STEP = 60 / settings.bpm / 2;
    seq.forEach((m, i) => {
      playTimers.current.push(
        setTimeout(
          () => {
            playNote(m);
            setPlaying(((((m % 12) - arpRoot) % 12) + 12) % 12);
          },
          i * STEP * 1000,
        ),
      );
    });
    playTimers.current.push(setTimeout(() => setPlaying(null), seq.length * STEP * 1000));
  }, [stopPlayback, midis, arpRoot, arpDef, arpDir, settings.bpm, playNote, arpPos, arpPositions, positionsFor]);

  /* ---- ear training ---- */
  const earPool = useMemo(
    () =>
      ear.source === "interval"
        ? EAR_INTERVALS.filter((x) => ear.level === "all" || EAR_INTERVALS_SIMPLE.has(x.v))
        : EAR_CHORDS.filter((x) => ear.level === "all" || EAR_CHORDS_SIMPLE.has(x.v)),
    [ear.source, ear.level],
  );

  const earPlay = useCallback(
    (root, answer) => {
      lastActiveRef.current = Date.now();
      if (ear.source === "interval") {
        pluck(root, 0, 0.5);
        pluck(root + answer, 0.55, 0.5);
        pluck(root, 1.15, 0.4);
        pluck(root + answer, 1.15, 0.4);
      } else {
        const def = CHORDS.find((c) => c.id === answer);
        (def ? def.iv : [0, 4, 7]).forEach((i, j) => pluck(root + i, j * 0.08, 0.45));
      }
    },
    [ear.source],
  );

  const earNext = useCallback(() => {
    const pool = earPool;
    const item = pool[Math.floor(Math.random() * pool.length)];
    const root = 45 + Math.floor(Math.random() * 15); // A2 to B3, guitar-friendly
    const cur = { root, answer: item.v };
    setEar((e) => ({ ...e, current: cur, picked: null, started: true }));
    earPlay(root, item.v);
  }, [earPool, earPlay]);

  const earAnswer = useCallback(
    (v) => {
      /* read once, then run side effects exactly once outside the state updater
         (which can run twice under StrictMode) */
      if (!ear.current || ear.picked != null) return;
      const right = v === ear.current.answer;
      track("ear_answer", { app_mode: ear.source, right });
      if (settings.sound) blip(right);
      if (right) {
        const streak = ear.streak + 1;
        const key = ear.source === "chord" ? "earStreakChord" : "earStreakInterval";
        setGamify((g) => ({
          ...g,
          counters: { ...g.counters, earCorrect: (g.counters.earCorrect || 0) + 1, [key]: Math.max(g.counters[key] || 0, streak) },
        }));
      }
      setEar((e) => ({
        ...e,
        picked: v,
        correct: e.correct + (right ? 1 : 0),
        wrong: e.wrong + (right ? 0 : 1),
        streak: right ? e.streak + 1 : 0,
      }));
    },
    [ear, settings.sound],
  );

  /* fresh question after an answer settles or the pool changes, but only once
     the user has pressed Start (entering the view must not auto-play) */
  useEffect(() => {
    if (mode !== "ear" || ear.dir !== "quiz" || !ear.started) return;
    if (ear.picked == null && ear.current) return;
    const t = setTimeout(() => earNext(), ear.picked != null ? 1100 : 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, ear.dir, ear.picked, ear.source, ear.level, ear.started]);

  /* leaving ear training ends the session, so returning shows Start again rather than auto-playing */
  useEffect(() => {
    if (mode !== "ear") setEar((e) => (e.started || e.current ? { ...e, started: false, current: null, picked: null } : e));
  }, [mode]);

  /* metronome: schedule ahead of the audio clock rather than trusting setInterval */
  const nextClick = useRef(0);
  const beatCount = useRef(0);
  useEffect(() => {
    if (!metroOn) {
      setBeat(-1);
      return;
    }
    const ac = ctx();
    if (!ac) return;
    nextClick.current = ac.currentTime + 0.08;
    beatCount.current = 0;
    /* all clicks for this run route through one gain bus, so stopping or
       retuning the metronome silences anything already scheduled ahead */
    const bus = ac.createGain();
    bus.connect(ac.destination);
    /* quieter clicks inside each beat; swing pushes the off-beat to the back
       of the beat. Simple mode plays plain quarters: its panel hides the
       subdivision control, so the setting must not act invisibly. */
    const SUBS = { 2: [0.5], swing: [2 / 3], 3: [1 / 3, 2 / 3], 4: [0.25, 0.5, 0.75] };
    const subs = settings.simple ? [] : SUBS[settings.subdiv] || [];
    const beatTimers = [];
    const id = setInterval(() => {
      const now = ctx();
      if (!now) return;
      while (nextClick.current < now.currentTime + 0.15) {
        lastActiveRef.current = Date.now();
        const b = beatCount.current;
        const isAccent = settings.accent === "down" ? b === 0 : settings.accent === "back" ? b % 2 === 1 : false;
        playClick(settings.clickSound, nextClick.current, isAccent, 0.7, bus);
        const beatSec = 60 / settings.bpm;
        for (const f of subs) playClick(settings.clickSound, nextClick.current + f * beatSec, false, 0.32, bus);
        const lead = Math.max(0, (nextClick.current - now.currentTime) * 1000);
        beatTimers.push(setTimeout(() => setBeat(b), lead));
        nextClick.current += beatSec;
        beatCount.current = (b + 1) % settings.beats;
      }
    }, 25);
    return () => {
      clearInterval(id);
      beatTimers.forEach(clearTimeout);
      bus.disconnect();
    };
  }, [metroOn, settings.bpm, settings.beats, settings.clickSound, settings.accent, settings.subdiv, settings.simple]);

  /* count metronome time towards the "In time" badge while it is running and visible */
  useEffect(() => {
    if (!metroOn) return;
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      setGamify((g) => ({ ...g, counters: { ...g.counters, metronomeSeconds: (g.counters.metronomeSeconds || 0) + 10 } }));
    }, 10000);
    return () => clearInterval(id);
  }, [metroOn]);

  /* ---- one-minute chord change trainer ---- */
  const chgKey = (chords) =>
    chords
      .map((c) => `${c.root}:${c.id}`)
      .sort()
      .join(">");
  const chordName = (c) => `${nameOf(c.root, effFlats)}${(CHORDS.find((x) => x.id === c.id) || {}).suffix || ""}`;
  const chgLabel = chg.chords.map(chordName).join("  ·  ");
  const chgRecord = chgRecords[chgKey(chg.chords)] || { best: 0, last: 0, tries: 0 };

  const chgVoicings = useMemo(() => {
    if (mode !== "changes") return [];
    return chg.chords.map((c) => {
      const def = CHORDS.find((x) => x.id === c.id) || CHORDS[0];
      const vs = findVoicings(c.root, def.iv, midis, fretCount, 0, vopt); // trainer ignores the capo; no neck/capo control in this mode
      return vs[0] || null;
    });
  }, [mode, chg.chords, midis, fretCount, vopt]);

  const startRun = useCallback(() => {
    setChgEntry("");
    track("changes_start", { chords: chgLabel, duration: chg.duration });
    setChg((c) => ({ ...c, phase: "running", remaining: c.duration }));
    const ac = ctx();
    if (ac && settings.sound) playClick(settings.clickSound, ac.currentTime, true);
  }, [settings.sound, settings.clickSound, chgLabel, chg.duration]);

  const stopRun = useCallback(() => {
    setChg((c) => ({ ...c, phase: "idle", remaining: c.duration }));
  }, []);

  /* Countdown: fix the end time when the run starts, then tick against the audio-free
     wall clock. Gated on mode so leaving the drill tears the interval down, no beeps
     or state changes fire off-screen. */
  useEffect(() => {
    if (mode !== "changes" || chg.phase !== "running" || chg.duration === 0) return;
    const end = performance.now() + chg.remaining * 1000;
    const id = setInterval(() => {
      lastActiveRef.current = Date.now(); // a running changes drill is active practice
      const rem = Math.max(0, Math.ceil((end - performance.now()) / 1000));
      if (rem <= 0) {
        clearInterval(id);
        const ac = ctx();
        if (ac && settings.sound) {
          playClick("beep", ac.currentTime, true);
          playClick("beep", ac.currentTime + 0.22, true);
          playClick("beep", ac.currentTime + 0.44, true);
        }
        setChg((c) => ({ ...c, phase: "done", remaining: 0 }));
      } else {
        setChg((c) => (c.phase === "running" ? { ...c, remaining: rem } : c));
      }
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, chg.phase, settings.sound]);

  /* leaving the drill mid-run abandons it cleanly back to idle */
  useEffect(() => {
    if (mode !== "changes") setChg((c) => (c.phase === "idle" ? c : { ...c, phase: "idle", remaining: c.duration }));
  }, [mode]);

  const saveChangeScore = useCallback(() => {
    const count = Math.max(0, Math.min(9999, parseInt(chgEntry, 10) || 0));
    const key = chgKey(chg.chords);
    const cur = chgRecords[key] || { best: 0, last: 0, tries: 0 };
    const beat = count > cur.best;
    const next = { ...chgRecords, [key]: { best: Math.max(cur.best, count), last: count, tries: cur.tries + 1 } };
    setChgRecords(next);
    store.set("fretboard:changes", JSON.stringify(next)).catch(() => {});
    syncField("changes", next);
    const perMin = chg.duration > 0 ? Math.round((count * 60) / chg.duration) : count;
    setGamify((g) => ({
      ...g,
      counters: {
        ...g.counters,
        chordChangesTotal: (g.counters.chordChangesTotal || 0) + count,
        chordChangeBest: Math.max(g.counters.chordChangeBest || 0, perMin),
      },
    }));
    track("changes_save", { count, new_best: beat });
    setToast(beat && count > 0 ? `New best · ${count} changes` : `Saved · ${count} changes`);
    setChg((c) => ({ ...c, phase: "idle", remaining: c.duration }));
    setChgEntry("");
  }, [chgEntry, chg.chords, chg.duration, chgRecords, syncField]);

  const setChgChord = (i, patch) => setChg((c) => ({ ...c, chords: c.chords.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const addChgChord = () => setChg((c) => (c.chords.length >= 8 ? c : { ...c, chords: [...c.chords, { root: 7, id: "maj" }] }));
  const removeChgChord = (i) => setChg((c) => (c.chords.length <= 2 ? c : { ...c, chords: c.chords.filter((_, j) => j !== i) }));

  /* ---- share links: current view encoded in the URL hash ---- */
  const buildShareLink = useCallback(() => {
    const p = { m: mode };
    if (mode === "scale") Object.assign(p, { r: scaleRoot, id: scaleId });
    else if (mode === "arp") Object.assign(p, { r: arpRoot, id: arpId });
    else if (mode === "chord") Object.assign(p, { r: chordRoot, id: chordId });
    else if (mode === "prog") {
      Object.assign(p, { r: progRoot, id: progId });
      const cust = customProgs.find((x) => x.id === progId);
      if (cust) Object.assign(p, { bars: cust.bars, nm: cust.name, sec: cust.sections });
    } else if (mode === "interval") Object.assign(p, { r: ivRoot, iv: [...ivOn] });
    else if (mode === "melody")
      Object.assign(p, { steps: melSteps.map((st) => (st.rest ? null : [st.s, st.f])), nm: melName.trim() || undefined });
    if (capo) p.capo = capo;
    if (settings.tuningId !== "std" && settings.tuningId !== "custom") p.tun = settings.tuningId;
    const enc = btoa(encodeURIComponent(JSON.stringify(p)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    return `${window.location.origin}/#s=${enc}`;
  }, [
    mode,
    scaleRoot,
    scaleId,
    chordRoot,
    chordId,
    progRoot,
    progId,
    customProgs,
    ivRoot,
    ivOn,
    melSteps,
    melName,
    capo,
    settings.tuningId,
    arpRoot,
    arpId,
  ]);

  const shareable = ["scale", "chord", "prog", "interval", "melody", "arp"].includes(mode);
  const doShare = useCallback(async () => {
    const url = buildShareLink();
    try {
      await navigator.clipboard.writeText(url);
      setToast("Link copied");
    } catch (e) {
      window.prompt("Copy this link", url);
    }
    track("share_link", { mode });
  }, [buildShareLink, mode]);

  /* apply an incoming share once local state has hydrated */
  useEffect(() => {
    if (!loaded) return;
    const mt = window.location.hash.match(/^#s=([A-Za-z0-9_-]+)$/);
    if (!mt) return;
    /* This runs only on share loads, where the [mode] mount effect deliberately
       skips its landing emit. So this effect owns the share view's page_view,
       set from pvMode and fired even if the link is malformed (falls back to
       the current view) so a share load never records zero page_views. */
    let pvMode = mode;
    try {
      const pad = mt[1].length % 4 === 0 ? "" : "=".repeat(4 - (mt[1].length % 4));
      const p = JSON.parse(decodeURIComponent(atob(mt[1].replace(/-/g, "+").replace(/_/g, "/") + pad)));
      const pc = (v) => Number.isInteger(v) && v >= 0 && v < 12;
      if (p.m === "scale" && pc(p.r) && SCALES.some((x) => x.id === p.id)) {
        setScaleRoot(p.r);
        setScaleId(p.id);
        setMode("scale");
        pvMode = "scale";
      } else if (p.m === "arp" && pc(p.r) && CHORDS.some((x) => x.id === p.id)) {
        setArpRoot(p.r);
        setArpId(p.id);
        setMode("arp");
        pvMode = "arp";
      } else if (p.m === "chord" && pc(p.r) && CHORDS.some((x) => x.id === p.id)) {
        setChordRoot(p.r);
        setChordId(p.id);
        setMode("chord");
        pvMode = "chord";
      } else if (p.m === "prog" && pc(p.r)) {
        setProgRoot(p.r);
        if (
          Array.isArray(p.bars) &&
          p.bars.length &&
          p.bars.every((b) => typeof b === "string" && Object.prototype.hasOwnProperty.call(ROMAN, b))
        ) {
          const sec = {};
          if (p.sec && typeof p.sec === "object")
            for (const [k, v] of Object.entries(p.sec)) if (/^[0-9]+$/.test(k) && typeof v === "string") sec[+k] = v.slice(0, 16);
          setBuilder({ bars: p.bars.slice(0, 64), name: typeof p.nm === "string" ? p.nm.slice(0, 40) : "", sections: sec });
          setProgId("custom");
        } else if (PROGRESSIONS.some((x) => x.id === p.id)) {
          setProgId(p.id);
        }
        setMode("prog");
        pvMode = "prog";
      } else if (p.m === "interval" && pc(p.r) && Array.isArray(p.iv)) {
        setIvRoot(p.r);
        setIvOn(new Set(p.iv.filter((i) => Number.isInteger(i) && i >= 0 && i < 12)));
        setMode("interval");
        pvMode = "interval";
      } else if (p.m === "melody" && Array.isArray(p.steps)) {
        const steps = p.steps
          .filter(
            (st) =>
              st === null ||
              (Array.isArray(st) &&
                Number.isInteger(st[0]) &&
                Number.isInteger(st[1]) &&
                st[0] >= 0 &&
                st[0] < settings.midis.length &&
                st[1] >= 0 &&
                st[1] <= fretCount),
          )
          .slice(0, MEL_MAX_BARS * MEL_SLOTS)
          .map((st) => (st === null ? { rest: true } : { s: st[0], f: st[1] }));
        if (steps.length) {
          setMelSteps(steps);
          setMelBars(Math.max(2, Math.min(MEL_MAX_BARS, Math.ceil(steps.length / MEL_SLOTS))));
          setMelCursor(0);
          if (typeof p.nm === "string") setMelName(p.nm.slice(0, 60));
          setMode("melody");
          pvMode = "melody";
        }
      }
      if (Number.isInteger(p.capo) && p.capo >= 0 && p.capo <= 12) setCapo(p.capo);
      if (typeof p.tun === "string" && TUNINGS.some((t) => t.id === p.tun)) setTuning(p.tun);
      track("share_open", { mode: p.m });
    } catch (e) {
      /* malformed link, ignore */
    }
    /* own the landing page_view for this share load; the [mode] effect stayed
       quiet waiting for this, and unblocks once shareHandledRef is set */
    shareHandledRef.current = true;
    firePageView(pvMode);
    /* apply once: land on the shared view's real path and drop the hash, so a
       reload reflects the current view rather than re-applying the link */
    if (window.history && window.history.replaceState) window.history.replaceState(null, "", pathForMode(pvMode) + window.location.search);
    routedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  /* Emit a page_view on the initial view and on every view change. This is the
     single, complete source of view transitions (covers nav, Bank open, finder,
     tour and the account redirect). On a share load the mount emit is skipped:
     the share effect above owns that first page_view once it resolves the target. */
  useEffect(() => {
    /* On a share load, stay quiet until the share effect resolves and emits the
       real target view. This is robust to StrictMode's double mount invoke: both
       invocations see the share unhandled and skip, so no phantom landing fires. */
    if (strictShareRef.current && !shareHandledRef.current) return;
    firePageView(mode);
  }, [mode, firePageView]);

  /* Back and Forward: move to the view named by the URL. */
  useEffect(() => {
    const onPop = () => {
      const m = modeForPath(window.location.pathname);
      if (m) {
        fromPopRef.current = true;
        setMode(m);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /* Keep the address bar in step with the current view, so every view is a real,
     shareable, bookmarkable URL. Skipped while a share link is still resolving
     (the share effect owns that first URL) and after a Back/Forward move (the URL
     already changed). The first reconciliation replaces rather than pushes, so no
     phantom history entry is created on load. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (strictShareRef.current && !shareHandledRef.current) return;
    if (fromPopRef.current) {
      fromPopRef.current = false;
      routedRef.current = true;
      return;
    }
    const path = pathForMode(mode);
    if (window.location.pathname !== path) {
      const url = path + window.location.search;
      if (routedRef.current) window.history.pushState({ mode }, "", url);
      else window.history.replaceState({ mode }, "", url);
    }
    routedRef.current = true;
  }, [mode]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => stopPlayback, [stopPlayback]);
  useEffect(() => {
    stopPlayback();
  }, [mode, scaleId, scaleRoot, chordId, chordRoot, capo, progId, progRoot, arpRoot, arpId, arpDir, melSteps, stopPlayback]);

  /* ---- readout ---- */
  const readout = useMemo(() => {
    if (mode === "scale") return `${nameOf(scaleRoot, effFlats)} ${scaleDef.name} · ${scaleDef.iv.length} notes`;
    if (mode === "chord") return `${nameOf(chordRoot, effFlats)}${chordDef.suffix || ""} · ${shownVoicings.length} voicings`;
    if (mode === "prog") return `${nameOf(progRoot, effFlats)} \u00b7 ${progDef.name} \u00b7 ${progDef.bars.length} bars`;
    if (mode === "bank") return `Bank \u00b7 ${bank.length} saved`;
    if (mode === "interval")
      return `${nameOf(ivRoot, effFlats)} root · ${[...ivOn]
        .sort((a, b) => a - b)
        .map((i) => DEG[i])
        .join(" ")}`;
    if (mode === "changes") return `Chord changes · ${chgLabel}`;
    if (mode === "about") return "About";
    if (mode === "faq") return "FAQ";
    if (mode === "strum") return `Strumming \u00b7 ${nameOf(chordRoot, effFlats)}${chordDef.suffix}`;
    if (mode === "melody") {
      const nn = melSteps.filter((s) => s && !s.rest).length;
      return `Melody \u00b7 ${nn} ${nn === 1 ? "note" : "notes"}`;
    }
    if (mode === "arp") return `${nameOf(arpRoot, effFlats)}${arpDef.suffix || ""} arpeggio \u00b7 ${arpDef.iv.length} tones`;
    if (mode === "ear")
      return `Ear training \u00b7 ${ear.correct + ear.wrong ? Math.round((ear.correct / (ear.correct + ear.wrong)) * 100) + "%" : "ready"}`;
    if (mode === "plog") return `Practice log \u00b7 ${practiceStats.streak} day streak`;
    if (mode === "routine") return `Practice routine \u00b7 ${known.length} known`;
    if (mode === "finder")
      return finderInfo.exact.length
        ? `Chord finder \u00b7 ${finderInfo.exact[0].name}`
        : finderSel.size
          ? "Chord finder \u00b7 no exact match"
          : "Chord finder";
    if (mode === "settings") return "Settings";
    if (mode === "tuner") {
      const t = TUNINGS.find((x) => x.id === settings.tuningId);
      return `Tuner \u00b7 ${t ? t.name : "Custom"}`;
    }
    if (mode === "account") return authUser ? `Account · ${uname}` : "Create an account";
    const src =
      quiz.source === "scale"
        ? `${nameOf(scaleRoot, effFlats)} ${scaleDef.name}`
        : quiz.source === "interval"
          ? `${nameOf(ivRoot, effFlats)} · ${[...ivOn]
              .sort((a, b) => a - b)
              .map((i) => DEG[i])
              .join(" ")}`
          : `${nameOf(chordRoot, effFlats)}${chordDef.suffix || ""}`;
    return `Fretboard Quiz · ${src} · ${quiz.hidden ? quiz.hidden.size - quiz.found.size : 0} to find`;
  }, [
    mode,
    scaleRoot,
    scaleDef,
    chordRoot,
    chordDef,
    ivRoot,
    ivOn,
    shownVoicings.length,
    effFlats,
    quiz,
    progRoot,
    progDef,
    bank.length,
    chgLabel,
    authUser,
    uname,
    settings.tuningId,
    melSteps,
    ear.correct,
    ear.wrong,
    arpRoot,
    arpDef,
    practiceStats.streak,
    finderInfo,
    finderSel.size,
    known.length,
  ]);

  const total = quiz.correct + quiz.wrong;
  const accuracy = total ? Math.round((quiz.correct / total) * 100) : 0;

  const setTuning = (id) => {
    const t = TUNINGS.find((x) => x.id === id);
    if (!t) return;
    setSettings((s) => ({ ...s, tuningId: id, midis: t.midi }));
    if (id !== "std" && id !== "custom") {
      setGamify((g) => (g.counters.tunings.includes(id) ? g : { ...g, counters: { ...g.counters, tunings: [...g.counters.tunings, id] } }));
    }
  };

  const setStringNote = (idx, midi) => {
    setSettings((s) => {
      const midis2 = s.midis.slice();
      midis2[idx] = midi;
      return { ...s, midis: midis2, tuningId: "custom" };
    });
  };

  /* carry the current root into another view, so one working key flows across
     Scales, Chords, Arpeggios, Progressions and Intervals */
  const carryKey = (targetMode, root) => {
    if (targetMode === "chord") setChordRoot(root);
    else if (targetMode === "scale") setScaleRoot(root);
    else if (targetMode === "arp") setArpRoot(root);
    else if (targetMode === "prog") setProgRoot(root);
    else if (targetMode === "interval") setIvRoot(root);
    setMode(targetMode);
  };

  /* ---- guided practice routine, built from what you know ---- */
  const gotoSegment = useCallback((item) => {
    if (!item) return;
    if (item.kind === "scale") {
      setScaleRoot(item.root);
      setScaleId(item.id);
      setMode("scale");
    } else if (item.kind === "chord") {
      setChordRoot(item.root);
      setChordId(item.id);
      setMode("chord");
    } else if (item.kind === "arp") {
      setArpRoot(item.root);
      setArpId(item.id);
      setMode("arp");
    }
  }, []);

  const pickStretch = (knownList) => {
    const counts = {};
    knownList.forEach((k) => {
      counts[k.kind] = (counts[k.kind] || 0) + 1;
    });
    const kind = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || "chord";
    const order = kind === "scale" ? SCALE_ORDER : CHORD_ORDER;
    const knownIds = new Set(knownList.filter((k) => k.kind === kind).map((k) => k.id));
    const nextId = order.find((id) => !knownIds.has(id));
    if (!nextId) return null;
    const root = knownList.find((k) => k.kind === kind)?.root ?? 0;
    const def = kind === "scale" ? SCALES.find((s) => s.id === nextId) : CHORDS.find((c) => c.id === nextId);
    if (!def) return null;
    const label =
      kind === "scale" ? `${nameOf(root, false)} ${def.name}` : `${nameOf(root, false)}${def.suffix}${kind === "arp" ? " arpeggio" : ""}`;
    return { sig: `k-${kind}:${root}:${nextId}`, kind, root, id: nextId, label, isStretch: true };
  };

  const buildRoutine = () => {
    if (!known.length) return;
    stopPlayback();
    const totalSec = routineDur * 60;
    const stretch = pickStretch(known);
    /* practise the shaky ones (low past rating) for longer, then one stretch */
    const list = [...known];
    if (stretch) list.push(stretch);
    const weightOf = (it) => {
      if (it.isStretch) return 1.3;
      const r = routineRatings[it.sig];
      return r === 1 ? 2 : r === 2 ? 1.4 : 1;
    };
    const weights = list.map(weightOf);
    const wSum = weights.reduce((a, b) => a + b, 0) || 1;
    const segments = list.map((it, i) => ({
      item: it,
      seconds: Math.max(30, Math.round((totalSec * weights[i]) / wSum)),
      stretch: !!it.isStretch,
    }));
    track("routine_start", { minutes: routineDur, items: segments.length });
    setRoutine({ phase: "running", segments, idx: 0, remaining: segments[0].seconds, duration: routineDur });
  };

  const routineNext = () => {
    setRoutine((r) => {
      if (!r) return r;
      const ni = r.idx + 1;
      if (ni >= r.segments.length) return { ...r, phase: "rate" };
      return { ...r, idx: ni, remaining: r.segments[ni].seconds };
    });
  };

  const rateRoutine = (stars) => {
    const next = { ...routineRatings };
    if (routine)
      routine.segments.forEach((seg) => {
        if (!seg.stretch) next[seg.item.sig] = stars;
      });
    setRoutineRatings(next);
    store.set("fretboard:routineratings", JSON.stringify(next)).catch(() => {});
    track("routine_done", { minutes: routine ? routine.duration : 0, stars });
    setRoutine(null);
    setToast(stars >= 3 ? "Great session!" : stars === 2 ? "Good work, keep at it" : "Noted, those will come round again");
  };

  /* count the current segment down; advance or finish at zero */
  useEffect(() => {
    if (!routine || routine.phase !== "running") return;
    const id = setInterval(() => {
      setRoutine((r) => {
        if (!r || r.phase !== "running") return r;
        if (r.remaining > 1) return { ...r, remaining: r.remaining - 1 };
        const ni = r.idx + 1;
        if (ni >= r.segments.length) return { ...r, phase: "rate" };
        return { ...r, idx: ni, remaining: r.segments[ni].seconds };
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routine && routine.phase]);

  /* show each segment's item on the neck as the routine reaches it */
  useEffect(() => {
    if (routine && routine.phase === "running") gotoSegment(routine.segments[routine.idx] && routine.segments[routine.idx].item);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routine && routine.idx, routine && routine.phase]);

  const navItem = (id, label, extra) => (
    <button
      className={`dnav ${mode === id ? "on" : ""}`}
      aria-current={mode === id ? "page" : undefined}
      onClick={() => {
        setMode(id);
        setOpenPanel(null);
        closeNav();
      }}
    >
      {label}
      {extra}
    </button>
  );

  /* app-like nav: on a phone, choosing anything closes the drawer. On desktop the
     drawer is a persistent sidebar, so it stays put. Focus moves to the burger
     before the drawer goes inert, so it is never stranded on a hidden control. */
  const renderProgDiagram = (g) => {
    const i = g.start;
    const c = progChords[i];
    if (!progVoicings[i]) return null;
    return (
      <ChordDiagram
        key={i}
        voicing={progVoicings[i]}
        lefty={settings.leftHanded}
        midis={midis}
        rootPc={c.rootPc}
        capo={capo}
        flats={effFlats}
        showDegrees={false}
        selected={progIdx >= i && progIdx < i + g.count}
        title={`${nameOf(c.rootPc, effFlats)}${c.def.suffix}`}
        caption={g.count > 1 ? `${c.roman} · ${g.count} bars` : c.roman}
        onSelect={() => {
          setProgIdx(i);
          const v = progVoicings[i];
          if (v && settings.sound) {
            let j = 0;
            for (let st = 0; st < n; st++) {
              const f = v.frets[st];
              if (f === null) continue;
              pluck(midis[st] + f, j * 0.03);
              j++;
            }
          }
        }}
      />
    );
  };

  /* live-app guided tour: each step sets up the real view, then spotlights it */
  const tourSteps = [
    {
      title: "Welcome to Fretwork",
      body: "A quick tour of the neck and the practice tools. About a minute, and you can skip any time.",
      target: null,
      before: () => setDrawer(false),
    },
    {
      title: "The menu",
      body: "Everything lives here, grouped into Learn, Practice, Tools and your Profile. Simple mode at the top keeps things focused while you find your feet; flip it off any time to unlock everything.",
      target: ".drawer",
      before: () => setDrawer(true),
    },
    {
      title: "The fretboard",
      body: "Every view shares this neck. Tap any note to hear it, or drag the capo along the top. It is fully keyboard operable too.",
      target: ".neckwrap",
      before: () => {
        setDrawer(false);
        setMode("chord");
        setOpenPanel(null);
      },
    },
    {
      title: "Pick anything",
      body: "Choose a root and a chord, scale or arpeggio with the same compact pickers. Tap the star to keep anything in your Bank.",
      target: ".pane .row.wrap",
      before: () => {
        setDrawer(false);
        setMode("chord");
      },
    },
    {
      title: "Share it",
      body: "The share button copies a link to exactly what you are looking at, so you can send a shape or a progression to anyone.",
      target: ".sharebtn",
      before: () => {
        setDrawer(false);
        setMode("chord");
      },
    },
    {
      title: "Practise",
      body: "Quiz yourself, drill chord changes, train your ear, and write or paste in melodies from tab. Your practice time builds a streak.",
      target: "[data-tour=practice]",
      before: () => setDrawer(true),
    },
    {
      title: "Tools",
      body: "A metronome with subdivisions, a real microphone tuner that listens to your guitar, and a chord finder that names the shapes you tap on the neck.",
      target: "[data-tour=tools]",
      before: () => setDrawer(true),
    },
    {
      title: "That is the tour",
      body: "Have a play. The About page has learning resources and a place to send feedback. Enjoy.",
      target: null,
      before: () => setDrawer(false),
    },
  ];

  const startTour = useCallback(() => {
    setTour(0);
    track("tour_start");
    setGamify((g) => (g.counters.tourTaken ? g : { ...g, counters: { ...g.counters, tourTaken: 1 } }));
  }, []);
  const endTour = useCallback(() => {
    setTour(-1);
    setTourRect(null);
    store.set("fretboard:tourdone", "1").catch(() => {});
  }, []);

  useEffect(() => {
    if (tour < 0) return;
    const step = tourSteps[tour];
    if (step.before) step.before();
    let raf = 0;
    const measure = () => {
      if (!step.target) {
        setTourRect(null);
        return;
      }
      const el = document.querySelector(step.target);
      if (el) {
        const r = el.getBoundingClientRect();
        setTourRect({ x: r.left, y: r.top, w: r.width, h: r.height });
      } else setTourRect(null);
    };
    const t = setTimeout(() => {
      measure();
      raf = requestAnimationFrame(measure);
    }, 320);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour]);

  /* offer the tour once, after first load. Branch on the resolved value, not on
     a rejection, so it works on every storage backend; skip it for share links. */
  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    (async () => {
      let seen = false;
      try {
        const r = await store.get("fretboard:tourdone");
        seen = !!(r && r.value);
      } catch (e) {
        seen = false;
      }
      if (!cancelled && !seen && !hadShareHashRef.current) startTour();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  /* tour as an operable modal: focus in, trap Tab, Escape closes */
  useEffect(() => {
    if (tour < 0) return;
    const t = setTimeout(() => {
      if (tourCardRef.current) tourCardRef.current.focus();
    }, 60);
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        endTour();
        return;
      }
      if (e.key !== "Tab" || !tourCardRef.current) return;
      const f = tourCardRef.current.querySelectorAll("button");
      if (!f.length) return;
      const first = f[0],
        last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour]);

  const closeNav = () => {
    if (typeof window === "undefined" || !window.matchMedia("(max-width: 700px)").matches) return;
    if (burgerRef.current) burgerRef.current.focus();
    setDrawer(false);
  };

  /* Escape closes the drawer and hands focus back to the burger */
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e) => {
      if (e.key !== "Escape" || tourRef.current >= 0) return; // the tour handles Escape while it is open
      setDrawer(false);
      if (burgerRef.current) burgerRef.current.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  return (
    <div className={`app ${settings.dark ? "dark" : ""} ${settings.highContrast ? "hc" : ""} ${settings.lowMotion ? "lowmotion" : ""}`}>
      <nav className={`drawer ${drawer ? "open" : ""}`} aria-label="Main menu" inert={drawer ? undefined : ""}>
        <div className="dinner">
          <button
            className={`simpletoggle ${settings.simple ? "on" : ""}`}
            role="switch"
            aria-checked={settings.simple}
            onClick={() => {
              track("simple_toggle", { on: !settings.simple });
              setSettings((s) => ({ ...s, simple: !s.simple }));
              setGamify((g) => (g.counters.triedSimple ? g : { ...g, counters: { ...g.counters, triedSimple: 1 } }));
            }}
            data-tip="Fewer menus and options, for starting out"
          >
            <span className="simplelabel">Simple mode</span>
            <span className="simpletrack" aria-hidden="true">
              <span className="simpleknob" />
            </span>
          </button>

          <button className="dhead dcat" aria-expanded={openCats.learn} onClick={() => toggleCat("learn")}>
            <HeadIcon kind="learn" />
            Learn
            <span className={`dcaret ${openCats.learn ? "open" : ""}`} aria-hidden="true">
              &#8250;
            </span>
          </button>
          {openCats.learn && (
            <div className="dcatbody">
              {navItem("scale", "Scales")}
              {navItem("arp", "Arpeggios")}
              {(!settings.simple || mode === "interval") && navItem("interval", "Intervals")}
              {navItem("chord", "Chords")}
              {(!settings.simple || mode === "prog") && navItem("prog", "Progressions")}
            </div>
          )}

          <button className="dhead dcat" data-tour="practice" aria-expanded={openCats.practice} onClick={() => toggleCat("practice")}>
            <HeadIcon kind="practice" />
            Practice
            <span className={`dcaret ${openCats.practice ? "open" : ""}`} aria-hidden="true">
              &#8250;
            </span>
          </button>
          {openCats.practice && (
            <div className="dcatbody">
              {navItem("routine", "Practice routine", known.length > 0 ? <span className="badge">{known.length}</span> : null)}
              {navItem("changes", "Chord changes")}
              {navItem("strum", "Strumming")}
              {navItem("melody", "Melodies", melodies.length > 0 ? <span className="badge">{melodies.length}</span> : null)}
              {navItem("quiz", "Fretboard Quiz")}
              {(!settings.simple || mode === "ear") && navItem("ear", "Ear training")}
            </div>
          )}

          <button className="dhead dcat" data-tour="tools" aria-expanded={openCats.tools} onClick={() => toggleCat("tools")}>
            <HeadIcon kind="tools" />
            Tools
            <span className={`dcaret ${openCats.tools ? "open" : ""}`} aria-hidden="true">
              &#8250;
            </span>
          </button>
          {openCats.tools && (
            <div className="dcatbody">
              <button
                className={`dnav ${openPanel === "metro" ? "on" : ""}`}
                onClick={() => {
                  setOpenPanel((v) => (v === "metro" ? null : "metro"));
                  closeNav();
                }}
                aria-expanded={openPanel === "metro"}
              >
                Metronome
                {metroOn && <span className="badge">{settings.bpm}</span>}
              </button>
              {navItem("tuner", "Tuner")}
              {(!settings.simple || mode === "finder") && navItem("finder", "Chord finder")}
            </div>
          )}

          <button className="dhead dcat" aria-expanded={openCats.profile} onClick={() => toggleCat("profile")}>
            <HeadIcon kind="profile" />
            Profile
            <span className={`dcaret ${openCats.profile ? "open" : ""}`} aria-hidden="true">
              &#8250;
            </span>
          </button>
          {openCats.profile && (
            <div className="dcatbody">
              {navItem("account", authUser ? "Account" : "Create account", authUser ? <span className="badge">{uname}</span> : null)}
              {navItem("plog", "Practice log", practiceStats.streak > 0 ? <span className="badge">{practiceStats.streak}d</span> : null)}
              {navItem("settings", "Settings")}
            </div>
          )}

          <div className="dbank">{navItem("bank", "Bank", bank.length > 0 ? <span className="badge">{bank.length}</span> : null)}</div>

          <div className="dspacer" aria-hidden="true" />
          <div className="dfoot">
            <button
              className={`dnav soft ${mode === "about" ? "on" : ""}`}
              aria-current={mode === "about" ? "page" : undefined}
              onClick={() => {
                setMode("about");
                setOpenPanel(null);
                closeNav();
              }}
            >
              About
            </button>
            <button
              className={`dnav soft ${mode === "faq" ? "on" : ""}`}
              aria-current={mode === "faq" ? "page" : undefined}
              onClick={() => {
                setMode("faq");
                setOpenPanel(null);
                closeNav();
              }}
            >
              FAQ
            </button>
            <button
              className="dnav soft"
              onClick={() => {
                startTour();
                closeNav();
              }}
            >
              Tour
            </button>
          </div>
        </div>
      </nav>
      <div
        className={`scrim ${drawer ? "on" : ""}`}
        onClick={() => {
          if (burgerRef.current) burgerRef.current.focus();
          setDrawer(false);
        }}
        aria-hidden="true"
      />

      <div className="stage">
        <header className="chassis">
          <button
            ref={burgerRef}
            className={`burger ${drawer ? "on" : ""}`}
            onClick={() => setDrawer((v) => !v)}
            aria-expanded={drawer}
            aria-label={drawer ? "Close menu" : "Open menu"}
            data-tip={drawer ? "Close menu" : "Menu"}
          >
            <i />
            <i />
            <i />
          </button>
          <div className="brand">
            <span className="mark" aria-hidden="true" />
            <h1>Fretwork</h1>
          </div>
          <div className="readout" aria-live="polite" role="heading" aria-level="2">
            <span className="rdot" />
            {readout}
          </div>
          {shareable && (
            <button className="gear sharebtn" onClick={doShare} data-tip="Copy a link to this exact view" aria-label="Copy share link">
              <svg
                viewBox="0 0 16 16"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="4" cy="8" r="2.2" />
                <circle cx="12" cy="3.5" r="2.2" />
                <circle cx="12" cy="12.5" r="2.2" />
                <path d="M6 7l4-2.6M6 9l4 2.6" />
              </svg>
              <span className="sharetxt">Share</span>
            </button>
          )}
        </header>

        {openPanel === "metro" && (
          <section className="setup" aria-label="Metronome">
            <div className="metrorow">
              <button
                className={`transport ${metroOn ? "on" : ""}`}
                onClick={() => {
                  track("metronome_toggle", { on: !metroOn, bpm: settings.bpm });
                  setMetroOn((v) => !v);
                }}
                aria-pressed={metroOn}
              >
                {metroOn ? "Stop" : "Start"}
              </button>
              <div className="beats" aria-hidden="true">
                {Array.from({ length: settings.beats }, (_, i) => (
                  <span
                    key={i}
                    className={`bdot ${beat === i ? "lit" : ""} ${
                      (settings.accent === "down" && i === 0) || (settings.accent === "back" && i % 2 === 1) ? "acc" : ""
                    }`}
                  />
                ))}
              </div>
              <div className="bpmbox">
                <button
                  className="mini"
                  aria-label="Slower by five beats per minute"
                  onClick={() => setSettings((s2) => ({ ...s2, bpm: Math.max(30, s2.bpm - 5) }))}
                >
                  {"\u2212"}
                </button>
                <input
                  type="range"
                  min="30"
                  max="240"
                  value={settings.bpm}
                  aria-label="Tempo in beats per minute"
                  onChange={(e) => setSettings((s2) => ({ ...s2, bpm: +e.target.value }))}
                />
                <button
                  className="mini"
                  aria-label="Faster by five beats per minute"
                  onClick={() => setSettings((s2) => ({ ...s2, bpm: Math.min(240, s2.bpm + 5) }))}
                >
                  +
                </button>
                <span className="bpmval">{settings.bpm} bpm</span>
              </div>
              <Field label="Time">
                <select
                  value={settings.beats}
                  aria-label="Time signature"
                  onChange={(e) => setSettings((s2) => ({ ...s2, beats: +e.target.value }))}
                >
                  {TIME_SIGS.map((t) => (
                    <option key={t.v} value={t.v}>
                      {t.l}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Click sound">
                <Seg
                  small
                  options={[
                    { v: "click", l: "Click" },
                    { v: "beep", l: "Beep" },
                    { v: "woodblock", l: "Wood" },
                    { v: "rim", l: "Rim" },
                  ]}
                  value={settings.clickSound}
                  onChange={(v) => setSettings((s2) => ({ ...s2, clickSound: v }))}
                />
              </Field>
              <Field label="Accent">
                <Seg
                  small
                  options={[
                    { v: "down", l: "Downbeat" },
                    { v: "back", l: "Backbeat" },
                    { v: "none", l: "Even" },
                  ]}
                  value={settings.accent}
                  onChange={(v) => setSettings((s2) => ({ ...s2, accent: v }))}
                />
              </Field>
              {!settings.simple && (
                <Field label="Subdivision">
                  <Seg
                    small
                    options={[
                      { v: "1", l: "Quarter" },
                      { v: "2", l: "Eighth" },
                      { v: "swing", l: "Swing" },
                      { v: "3", l: "Triplet" },
                      { v: "4", l: "16th" },
                    ]}
                    value={settings.subdiv}
                    onChange={(v) => {
                      track("metronome_subdiv", { subdiv: v });
                      setSettings((s2) => ({ ...s2, subdiv: v }));
                    }}
                  />
                </Field>
              )}
            </div>
          </section>
        )}

        {!["changes", "about", "faq", "account", "settings", "tuner", "ear", "plog"].includes(mode) && (
          <section className="neckwrap" aria-label="Fretboard">
            <div className="neckscroll">
              <Fretboard
                fretCount={fretCount}
                midis={midis}
                rowToString={rowToString}
                geo={geo}
                marks={marks}
                capo={capo}
                onCapo={setCapo}
                onCell={onCell}
                flats={effFlats}
                labelMode={
                  mode === "chord" || mode === "prog"
                    ? chordLabel
                    : mode === "scale"
                      ? scaleLabel
                      : mode === "arp"
                        ? arpLabel
                        : settings.labelMode
                }
                colourMode={mode === "interval" ? "interval" : settings.colourMode}
                barre={(() => {
                  const v = mode === "chord" ? activeVoicing : mode === "prog" ? activeProgVoicing : null;
                  return v && v.barreFret != null ? { fret: v.barreFret, from: v.barreFrom, to: v.barreTo } : null;
                })()}
                ghosts={ghosts}
                flash={flash}
                quizRange={quiz.range}
                quizActive={mode === "quiz"}
              />
            </div>
            <div className="neckfoot">
              <span className="hint">{capo > 0 ? `Capo at fret ${capo}` : "Drag the capo onto the neck"}</span>
              {capo > 0 && (
                <button className="mini" onClick={() => setCapo(0)}>
                  Remove capo
                </button>
              )}
            </div>
          </section>
        )}

        <main className="panel" key={mode}>
          {mode === "scale" && (
            <div className="pane">
              <p className="panelead">
                Map out any scale across the fretboard in any key, hear it played, and learn its shapes position by position.
              </p>
              <div className="knownrow">
                <KnownButton
                  known={known.some((k) => k.sig === `k-scale:${scaleRoot}:${scaleId}`)}
                  onClick={() =>
                    toggleKnown({
                      sig: `k-scale:${scaleRoot}:${scaleId}`,
                      kind: "scale",
                      root: scaleRoot,
                      id: scaleId,
                      label: `${nameOf(scaleRoot, effFlats)} ${scaleDef.name}`,
                    })
                  }
                />
              </div>
              <div className="row wrap">
                <Field label="Key">
                  <KeyPicker value={scaleRoot} onChange={setScaleRoot} flats={effFlats} />
                </Field>
                <Field label="Scale">
                  <CatPicker
                    value={scaleId}
                    onChange={setScaleId}
                    label="Scale"
                    groups={groupItems(SCALE_GROUPS, SCALES, SIMPLE_SCALES, settings.simple, scaleId)}
                  />
                </Field>
                <button
                  className={`btn primary ${playing != null ? "live" : ""}`}
                  onClick={
                    playing != null
                      ? stopPlayback
                      : () => {
                          track("hear_scale", { scale: scaleId });
                          playScale();
                        }
                  }
                  data-tip="Play the scale and light each note as it sounds"
                >
                  {playing != null ? "Stop" : "Hear it"}
                </button>
                <StarSave
                  label={`${nameOf(scaleRoot, effFlats)} ${scaleDef.name}`}
                  saved={bank.some((b) => b.sig === `scale:${scaleRoot}:${scaleId}:${scalePos == null ? "all" : scalePos}`)}
                  onClick={() =>
                    saveToBank({
                      id: `b${Date.now()}`,
                      sig: `scale:${scaleRoot}:${scaleId}:${scalePos == null ? "all" : scalePos}`,
                      kind: "scale",
                      root: scaleRoot,
                      scaleId,
                      pos: scalePos,
                      tun: settings.tuningId,
                      label: `${nameOf(scaleRoot, effFlats)} ${scaleDef.name}${scalePos == null ? "" : ` · pos ${scalePos + 1}`}`,
                    })
                  }
                />
              </div>

              <Field label="Position">
                <div className="posrow">
                  <button
                    className={`poschip ${scalePos == null ? "on" : ""}`}
                    onClick={() => setScalePos(null)}
                    data-tip="Every position at once"
                  >
                    Whole neck
                  </button>
                  {positions.map((pos, i) => (
                    <button
                      key={i}
                      className={`poschip ${scalePos === i ? "on" : ""}`}
                      onClick={() => setScalePos(i)}
                      data-tip={`Frets ${pos.from} to ${pos.to}, starting on the ${DEG[pos.deg]}`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  {scalePos != null && positions[scalePos] && (
                    <span className="poshint">
                      Frets {positions[scalePos].from} to {positions[scalePos].to}
                    </span>
                  )}
                </div>
              </Field>
              <Field label="Neck shows">
                <Seg
                  small
                  options={[
                    { v: "both", l: "Degree + note" },
                    { v: "name", l: "Notes" },
                    { v: "degree", l: "Degrees" },
                    { v: "none", l: "Blank" },
                  ]}
                  value={scaleLabel}
                  onChange={setScaleLabel}
                />
              </Field>
              <div className="degrees">
                {scaleDef.iv.map((iv) => (
                  <span key={iv} className="chip" style={{ borderColor: FUNC_COLOUR[iv % 12] }}>
                    <b style={{ color: FUNC_COLOUR[iv % 12] }}>{DEG[iv % 12]}</b>
                    {nameOf(scaleRoot + iv, effFlats)}
                  </span>
                ))}
              </div>
              <div className="keyjump">
                <span className="note">In {nameOf(scaleRoot, effFlats)}:</span>
                <button className="jumpchip" onClick={() => carryKey("chord", scaleRoot)}>
                  Chords
                </button>
                <button className="jumpchip" onClick={() => carryKey("arp", scaleRoot)}>
                  Arpeggios
                </button>
                {!settings.simple && (
                  <button className="jumpchip" onClick={() => carryKey("prog", scaleRoot)}>
                    Progressions
                  </button>
                )}
              </div>
            </div>
          )}

          {mode === "chord" && (
            <div className="pane">
              <p className="panelead">Find playable shapes for any chord in any key, then hear and save the ones you want to learn.</p>
              <div className="knownrow">
                <KnownButton
                  known={known.some((k) => k.sig === `k-chord:${chordRoot}:${chordId}`)}
                  onClick={() =>
                    toggleKnown({
                      sig: `k-chord:${chordRoot}:${chordId}`,
                      kind: "chord",
                      root: chordRoot,
                      id: chordId,
                      label: `${nameOf(chordRoot, effFlats)}${chordDef.suffix}`,
                    })
                  }
                />
              </div>
              {shownVoicings.length === 0 ? (
                <p className="empty">
                  No playable shape for {nameOf(chordRoot, effFlats)}
                  {chordDef.suffix} in this tuning at this stretch. In Settings, widen Chord stretch or turn on Inversions.
                </p>
              ) : (
                <div className="voicings">
                  {shownVoicings.map((v, i) => {
                    const vsig = `chord:${chordRoot}:${chordId}:${v.key || ""}`;
                    const label = `${nameOf(chordRoot, effFlats)}${chordDef.suffix} shape ${i + 1}`;
                    return (
                      <div key={v.key} className="voicewrap">
                        <ChordDiagram
                          voicing={v}
                          lefty={settings.leftHanded}
                          midis={midis}
                          rootPc={chordRoot}
                          capo={capo}
                          flats={effFlats}
                          showDegrees={settings.labelMode === "degree"}
                          selected={i === Math.min(voiceIdx, shownVoicings.length - 1)}
                          onSelect={() => {
                            lastActiveRef.current = Date.now();
                            setVoiceIdx(i);
                            if (settings.sound) {
                              let j = 0;
                              for (let st = 0; st < n; st++) {
                                const f = v.frets[st];
                                if (f === null) continue;
                                pluck(midis[st] + f, j * 0.035);
                                j++;
                              }
                            }
                          }}
                        />
                        <span className="voicestar">
                          <StarSave
                            label={label}
                            saved={bank.some((b) => b.sig === vsig)}
                            onClick={() =>
                              saveToBank({
                                id: `b${Date.now()}`,
                                sig: vsig,
                                kind: "chord",
                                root: chordRoot,
                                chordId,
                                voicing: v,
                                midis,
                                capo,
                                tun: settings.tuningId,
                                label,
                              })
                            }
                          />
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {!settings.simple && chordAreas.length > 1 && (
                <Field label="Neck area">
                  <div className="posrow">
                    <button
                      className={`poschip ${chordArea == null ? "on" : ""}`}
                      onClick={() => setChordArea(null)}
                      data-tip="Every shape, all the way up the neck"
                    >
                      Anywhere
                    </button>
                    {chordAreas.map((f) => (
                      <button
                        key={f}
                        className={`poschip ${chordArea === f ? "on" : ""}`}
                        onClick={() => setChordArea(f)}
                        data-tip={f === capo ? "Shapes using open strings" : `Shapes starting at fret ${f}`}
                      >
                        {f === capo ? "Open" : f}
                      </button>
                    ))}
                  </div>
                </Field>
              )}

              <p className="note">
                Numbers on the dots are fingers: 1 index, 2 middle, 3 ring, 4 little. A dark bar means one finger lies flat across those
                strings.
              </p>

              <div className="row wrap">
                <Field label="Root">
                  <KeyPicker value={chordRoot} onChange={setChordRoot} flats={effFlats} />
                </Field>
                <Field label="Chord">
                  <CatPicker
                    value={chordId}
                    onChange={setChordId}
                    label="Chord type"
                    groups={groupItems(CHORD_GROUPS, CHORDS, SIMPLE_CHORDS, settings.simple, chordId)}
                  />
                </Field>
                <button
                  className="btn primary"
                  onClick={() => {
                    track("strum_chord", { chord: chordId });
                    strumVoicing();
                  }}
                  disabled={!activeVoicing}
                  data-tip="Hear the selected shape"
                >
                  Strum
                </button>
              </div>

              <div className="keyjump">
                <span className="note">In {nameOf(chordRoot, effFlats)}:</span>
                <button className="jumpchip" onClick={() => carryKey("scale", chordRoot)}>
                  Scale
                </button>
                <button className="jumpchip" onClick={() => carryKey("arp", chordRoot)}>
                  Arpeggio
                </button>
                <button className="jumpchip" onClick={() => carryKey("strum", chordRoot)}>
                  Strum along
                </button>
              </div>

              {!settings.simple && (
                <div className="optrow">
                  <Field label="Neck shows">
                    <Seg
                      small
                      options={[
                        { v: "finger", l: "Fingers" },
                        { v: "name", l: "Notes" },
                        { v: "degree", l: "Degrees" },
                      ]}
                      value={chordLabel}
                      onChange={setChordLabel}
                    />
                  </Field>
                  <Field label="Other tones">
                    <Seg
                      small
                      options={[
                        { v: true, l: "Ghost" },
                        { v: false, l: "Hide" },
                      ]}
                      value={showAllTones}
                      onChange={setShowAllTones}
                    />
                  </Field>
                </div>
              )}
            </div>
          )}

          {mode === "prog" && (
            <div className="pane">
              <p className="panelead">
                Play through common chord progressions in any key, seeing every chord shape as the sequence moves along.
              </p>
              {progVoicings.some(Boolean) ? (
                hasSections ? (
                  <div className="songsheet">
                    {songBlocks.map((blk, bi) => (
                      <div className="songsec" key={bi}>
                        {blk.name && <p className="secname">{blk.name}</p>}
                        <div className="voicings">{blk.groups.map(renderProgDiagram)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="voicings">{progGroups.map(renderProgDiagram)}</div>
                )
              ) : (
                <p className="empty">No playable shapes for this progression in the current tuning.</p>
              )}

              <div className="row wrap actions">
                <button
                  className={`btn primary ${progPlaying ? "live" : ""}`}
                  onClick={progPlaying ? stopPlayback : playProgression}
                  disabled={!progChords.length}
                >
                  {progPlaying ? "Stop" : "Preview"}
                </button>
                <span className="actspacer" aria-hidden="true" />
                <button
                  className="btn ghost iconbtn"
                  onClick={() =>
                    saveToBank({
                      id: `b${Date.now()}`,
                      sig: `prog:${progRoot}:${progId}:${progDef.bars.join(",")}`,
                      kind: "prog",
                      root: progRoot,
                      progId,
                      bars: progDef.bars,
                      sections: progDef.sections,
                      name: progDef.name,
                      label: `${nameOf(progRoot, effFlats)} \u00b7 ${progDef.name}`,
                    })
                  }
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="14"
                    height="14"
                    fill={bank.some((b) => b.sig === `prog:${progRoot}:${progId}:${progDef.bars.join(",")}`) ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 3.2l2.6 5.7 6.2.6-4.7 4.2 1.4 6.1L12 16.8 6.5 19.8l1.4-6.1L3.2 9.5l6.2-.6z" />
                  </svg>
                  Save to Bank
                </button>
                <button
                  className="btn ghost iconbtn"
                  onClick={() => {
                    const c = progChords[progIdx];
                    if (!c) return;
                    setChordRoot(c.rootPc);
                    setChordId(c.chordId);
                    setMode("chord");
                  }}
                >
                  <svg
                    viewBox="0 0 16 16"
                    width="13"
                    height="13"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M6 3h7v7M13 3L7 9M6 13H3V3" />
                  </svg>
                  Open in chords
                </button>
              </div>

              <div className="row wrap">
                <Field label="Key">
                  <KeyPicker value={progRoot} onChange={setProgRoot} flats={effFlats} />
                </Field>
                <Field label="Progression">
                  <CatPicker
                    value={progId}
                    onChange={setProgId}
                    label="Progression"
                    groups={[
                      ...["major", "minor"].map((t) => ({
                        label: t === "major" ? "Major keys" : "Minor keys",
                        items: simpleList(PROGRESSIONS, SIMPLE_PROGS, settings.simple, progId)
                          .filter((x) => x.tonality === t)
                          .map((x) => ({ id: x.id, name: x.name, sub: x.note })),
                      })),
                      ...(customProgs.length
                        ? [
                            {
                              label: "Your progressions",
                              items: customProgs.map((x) => ({ id: x.id, name: x.name, sub: `${x.bars.length} bars` })),
                            },
                          ]
                        : []),
                      { label: "Build", items: [{ id: "custom", name: "Custom progression", sub: "Choose your own chords, bar by bar" }] },
                    ]}
                  />
                </Field>
              </div>

              {progId === "custom" && (
                <div className="builderbox">
                  <Field label={`Bars \u00b7 ${builder.bars.length}`}>
                    <div className="barstrip">
                      {builder.bars.length === 0 && (
                        <span className="note">
                          Tap chords below to add bars. The same chord can repeat as many times as the song needs.
                        </span>
                      )}
                      {builder.bars.map((b, i) => (
                        <React.Fragment key={i}>
                          {builder.sections && builder.sections[i] && (
                            <button
                              className="secchip"
                              onClick={() =>
                                setBuilder((bl) => {
                                  const sc = { ...bl.sections };
                                  delete sc[i];
                                  return { ...bl, sections: sc };
                                })
                              }
                              data-tip="Remove this section marker"
                            >
                              {builder.sections[i]}
                            </button>
                          )}
                          <button
                            className="barchip"
                            onClick={() =>
                              setBuilder((bl) => {
                                const sections = {};
                                Object.entries(bl.sections || {}).forEach(([k, v]) => {
                                  const idx = +k;
                                  if (idx < i) sections[idx] = v;
                                  else if (idx > i) sections[idx - 1] = v;
                                });
                                return { ...bl, bars: bl.bars.filter((_, j) => j !== i), sections };
                              })
                            }
                            aria-label={`Remove bar ${i + 1}, ${b}`}
                          >
                            {b}
                            <span aria-hidden="true">{"\u00d7"}</span>
                          </button>
                        </React.Fragment>
                      ))}
                    </div>
                  </Field>
                  <Field label="Song sections (optional)">
                    <div className="posrow">
                      {["Intro", "Verse", "Chorus", "Bridge", "Solo", "Outro"].map((sec) => (
                        <button
                          key={sec}
                          className="poschip"
                          onClick={() => setBuilder((bl) => ({ ...bl, sections: { ...bl.sections, [bl.bars.length]: sec } }))}
                          data-tip={`Start a ${sec} section at the next bar`}
                        >
                          + {sec}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Add chords by name in this key">
                    <Seg
                      small
                      ariaLabel="Key type for the chord names"
                      options={[
                        { v: "major", l: "Major key" },
                        { v: "minor", l: "Minor key" },
                      ]}
                      value={builderKeyQual}
                      onChange={setBuilderKeyQual}
                    />
                    <p className="note keyhint">
                      These are the chords that belong to{" "}
                      {nameOf(progRoot, keyPrefersFlats(progRoot, builderKeyQual === "minor" ? [3] : [4]))} {builderKeyQual}. Tap one to add
                      it.
                    </p>
                    <div className="romangrid">
                      {(builderKeyQual === "minor"
                        ? ["i", "ii°", "III", "iv", "v", "VI", "VII"]
                        : ["I", "ii", "iii", "IV", "V", "vi", "vii°"]
                      ).map((rn) => {
                        const [off, q] = ROMAN[rn];
                        const cd = CHORDS.find((c) => c.id === q);
                        const nmFlats = keyPrefersFlats(progRoot, builderKeyQual === "minor" ? [3] : [4]);
                        const nm = nameOf((progRoot + off) % 12, nmFlats) + (cd ? cd.suffix : "");
                        return (
                          <button
                            key={rn}
                            className="key chordkey"
                            data-tip={`${rn} in the key of ${nameOf(progRoot, nmFlats)} ${builderKeyQual}`}
                            onClick={() => setBuilder((bl) => ({ ...bl, bars: [...bl.bars, rn] }))}
                          >
                            {nm}
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                  <Field label="Or add by Roman numeral (advanced)">
                    <div className="romangrid">
                      {Object.keys(ROMAN).map((rn) => (
                        <button key={rn} className="key" onClick={() => setBuilder((bl) => ({ ...bl, bars: [...bl.bars, rn] }))}>
                          {rn}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <div className="row wrap">
                    <Field id="progname" label="Name">
                      <input
                        id="progname"
                        type="text"
                        value={builder.name}
                        maxLength={40}
                        placeholder="My song"
                        onChange={(e) => setBuilder((bl) => ({ ...bl, name: e.target.value }))}
                      />
                    </Field>
                    <button
                      className="btn primary"
                      disabled={!builder.bars.length || !builder.name.trim()}
                      onClick={() => {
                        const def = {
                          id: `c${Date.now()}`,
                          name: builder.name.trim(),
                          note: "Custom",
                          tonality: MINOR_STARTS.has(builder.bars[0]) ? "minor" : "major",
                          bars: builder.bars,
                          sections: builder.sections,
                        };
                        saveCustomProgs([...customProgs, def]);
                        setProgId(def.id);
                        setBuilder({ bars: [], name: "", sections: {} });
                        track("custom_prog_save", { bars: def.bars.length });
                        setToast("Progression saved");
                      }}
                    >
                      Save progression
                    </button>
                    <button
                      className="btn ghost"
                      disabled={!builder.bars.length}
                      onClick={() => setBuilder((bl) => ({ ...bl, bars: [], sections: {} }))}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              {customProgs.some((p) => p.id === progId) && (
                <div className="row">
                  <button
                    className="btn ghost danger"
                    onClick={() => {
                      saveCustomProgs(customProgs.filter((p) => p.id !== progId));
                      setProgId("p1564");
                      setToast("Progression deleted");
                    }}
                  >
                    Delete this progression
                  </button>
                </div>
              )}

              <p className="note">Preview follows the metronome tempo, one bar per chord.</p>
            </div>
          )}

          {mode === "bank" && (
            <div className="pane">
              {bank.length === 0 ? (
                <p className="note">
                  Nothing saved yet. Tap the star on a chord, scale, arpeggio or progression to keep it here, grouped by type and ready to
                  practise. You can share any saved item from here too.
                </p>
              ) : (
                [
                  { kind: "chord", label: "Chords" },
                  { kind: "scale", label: "Scales" },
                  { kind: "arp", label: "Arpeggios" },
                  { kind: "prog", label: "Progressions" },
                ].map((group) => {
                  const items = bank.filter((b) => (b.kind || "chord") === group.kind);
                  if (!items.length) return null;
                  return (
                    <section className="banksec" key={group.kind}>
                      <h2 className="abouthead">{group.label}</h2>
                      <div className="banklist">
                        {items.map((item) => (
                          <div className="bankitem" key={item.id}>
                            {item.kind === "chord" && item.voicing ? (
                              <ChordDiagram
                                voicing={item.voicing}
                                lefty={settings.leftHanded}
                                midis={item.midis || midis}
                                rootPc={item.root}
                                capo={item.capo || 0}
                                flats={flatsFor(item.root, (CHORDS.find((c) => c.id === item.chordId) || CHORDS[0]).iv)}
                                showDegrees={false}
                                selected={false}
                                onSelect={() => openBankItem(item)}
                              />
                            ) : null}
                            <div className="bankmeta">
                              <b>{item.label}</b>
                              <div className="row wrap">
                                <button className="mini" onClick={() => openBankItem(item)}>
                                  Open
                                </button>
                                <button className="mini" onClick={() => shareBankItem(item)} aria-label={`Share ${item.label}`}>
                                  Share
                                </button>
                                <button
                                  className="mini"
                                  onClick={() => saveBank(bank.filter((b) => b.id !== item.id))}
                                  aria-label={`Remove ${item.label}`}
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })
              )}
            </div>
          )}

          {mode === "interval" && (
            <div className="pane">
              <p className="panelead">
                See how each interval sits against the root across the fretboard, so the distances between notes become familiar.
              </p>
              <Field label="Root">
                <KeyPicker value={ivRoot} onChange={setIvRoot} flats={effFlats} />
              </Field>
              {settings.simple ? (
                <Field label="Show">
                  <div className="posrow">
                    {INTERVAL_PRESETS.map((pr) => {
                      const on = pr.iv.length === ivOn.size && pr.iv.every((i) => ivOn.has(i));
                      return (
                        <button
                          key={pr.id}
                          className={`poschip wide ${on ? "on" : ""}`}
                          aria-pressed={on}
                          onClick={() => setIvOn(new Set(pr.iv))}
                        >
                          {pr.label}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              ) : (
                <Field label="Intervals from the root">
                  <IntervalGrid root={ivRoot} on={ivOn} onToggle={toggleIv} flats={effFlats} />
                </Field>
              )}

              <div className="degrees">
                {[...ivOn]
                  .sort((a, b) => a - b)
                  .map((i) => (
                    <span key={i} className="chip" style={{ borderLeftColor: FUNC_COLOUR[i] }}>
                      <b style={{ color: FUNC_COLOUR[i] }}>{DEG[i]}</b>
                      {nameOf(ivRoot + i, effFlats)}
                    </span>
                  ))}
              </div>
              {!settings.simple && (
                <div className="row wrap">
                  {[
                    { l: "Root only", iv: [0] },
                    { l: "Major triad", iv: [0, 4, 7] },
                    { l: "Minor triad", iv: [0, 3, 7] },
                    { l: "Dominant 7th", iv: [0, 4, 7, 10] },
                    { l: "All twelve", iv: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
                  ].map((pr) => {
                    const on = pr.iv.length === ivOn.size && pr.iv.every((i) => ivOn.has(i));
                    return (
                      <button
                        key={pr.l}
                        className={`btn ghost ${on ? "sel" : ""}`}
                        aria-pressed={on}
                        onClick={() => setIvOn(new Set(pr.iv))}
                      >
                        {pr.l}
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="note" hidden={settings.simple}>
                Filled dots are natural degrees. Rings are flattened ones. Colour groups intervals by function: seconds, thirds, fourths,
                fifths, sixths, sevenths.
              </p>
            </div>
          )}

          {mode === "quiz" && (
            <div className="pane">
              <p className="panelead">Quiz yourself on scales, chords and intervals by naming the notes Fretwork lights up on the neck.</p>
              <div className="scoreboard">
                <div className="score">
                  <b>{quiz.correct}</b>
                  <span>correct</span>
                </div>
                <div className="score">
                  <b className="bad">{quiz.wrong}</b>
                  <span>wrong</span>
                </div>
                <div className="score">
                  <b>{accuracy}%</b>
                  <span>accuracy</span>
                </div>
                <div className="score">
                  <b>{quiz.streak}</b>
                  <span>streak</span>
                </div>
                <div className="score">
                  <b>{quiz.best}</b>
                  <span>best run</span>
                </div>
                <div className="score">
                  <b>{quiz.rounds}</b>
                  <span>rounds</span>
                </div>
              </div>

              <div className="row wrap">
                <Field label="Test me on">
                  <Seg
                    small
                    options={[
                      { v: "scale", l: "A scale" },
                      { v: "chord", l: "A chord" },
                      { v: "interval", l: "Intervals" },
                    ]}
                    value={quiz.source}
                    onChange={(v) => setQuiz((q) => ({ ...q, source: v }))}
                  />
                </Field>
                {quiz.source === "scale" && (
                  <Field label="Scale">
                    <CatPicker
                      value={scaleId}
                      onChange={setScaleId}
                      label="Scale"
                      groups={groupItems(SCALE_GROUPS, SCALES, SIMPLE_SCALES, settings.simple, scaleId)}
                    />
                  </Field>
                )}
                {quiz.source === "chord" && (
                  <Field label="Chord">
                    <CatPicker
                      value={chordId}
                      onChange={setChordId}
                      label="Chord type"
                      groups={groupItems(CHORD_GROUPS, CHORDS, SIMPLE_CHORDS, settings.simple, chordId)}
                    />
                  </Field>
                )}
              </div>

              <Field label={quiz.source === "scale" ? "Key" : "Root"}>
                <KeyPicker
                  value={quiz.source === "scale" ? scaleRoot : quiz.source === "interval" ? ivRoot : chordRoot}
                  onChange={quiz.source === "scale" ? setScaleRoot : quiz.source === "interval" ? setIvRoot : setChordRoot}
                  flats={effFlats}
                />
              </Field>

              {quiz.source === "interval" && (
                <Field label="Intervals to find">
                  <IntervalGrid root={ivRoot} on={ivOn} onToggle={toggleIv} flats={effFlats} />
                </Field>
              )}

              <div className="row">
                <Field label={`Difficulty · ${quiz.hidden ? quiz.hidden.size : 0} of ${quiz.target ? quiz.target.length : 0} hidden`}>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={quiz.difficulty}
                    aria-label="Quiz difficulty"
                    onChange={(e) => setQuiz((q) => ({ ...q, difficulty: +e.target.value }))}
                  />
                  <output>
                    {quiz.difficulty < 0.2 ? "Easy" : quiz.difficulty < 0.5 ? "Steady" : quiz.difficulty < 0.85 ? "Hard" : "Blank neck"}
                  </output>
                </Field>
              </div>

              <Field label={`Frets ${quiz.range[0]} to ${quiz.range[1]}`}>
                <DualRange
                  min={0}
                  max={fretCount}
                  lo={quiz.range[0]}
                  hi={quiz.range[1]}
                  onChange={(r) => setQuiz((q) => ({ ...q, range: r }))}
                />
              </Field>

              <p
                role="status"
                aria-live="polite"
                className={quiz.source === "interval" && ivOn.size === 0 ? "empty" : quiz.done ? "done" : "note"}
              >
                {quiz.source === "interval" && ivOn.size === 0
                  ? "Pick at least one interval to be tested on."
                  : quiz.done
                    ? `Round complete. ${quiz.hidden ? quiz.hidden.size : 0} found, streak of ${quiz.streak}.`
                    : "Tap every hidden position on the neck. Wrong taps count against you."}
              </p>

              <div className="row actionbar">
                <button
                  className="btn primary"
                  onClick={() => {
                    track("quiz_new_round", { app_mode: quiz.source });
                    newRound();
                  }}
                >
                  New round
                </button>
                <button
                  className="btn ghost danger"
                  onClick={() => {
                    const cleared = { ...quiz, correct: 0, wrong: 0, streak: 0, best: 0, rounds: 0 };
                    setQuiz(cleared);
                    saveStats(cleared);
                  }}
                >
                  Reset score
                </button>
              </div>
            </div>
          )}

          {mode === "changes" && (
            <div className="pane">
              <p className="panelead">
                Build speed by counting how many clean chord changes you can make between two shapes before the clock runs out.
              </p>
              <div className="chgstage">
                <div
                  role="timer"
                  aria-label="Time remaining"
                  className={`chgclock ${
                    chg.phase === "running" ? (chg.duration === 0 || chg.remaining > 10 ? "run" : "low") : chg.phase === "done" ? "low" : ""
                  }`}
                >
                  {chg.phase === "done"
                    ? "Time!"
                    : chg.duration === 0
                      ? chg.phase === "running"
                        ? "Free"
                        : "\u221e"
                      : `${Math.floor(chg.remaining / 60)}:${String(chg.remaining % 60).padStart(2, "0")}`}
                </div>
                <div className="chgnames">{chgLabel}</div>
                <div className="chgstatus" role="status" aria-live="assertive">
                  {chg.phase === "done" ? "Time. Enter how many changes you got." : ""}
                </div>
                {(chgRecord.best > 0 || chgRecord.tries > 0) && (
                  <div className="chgbest">
                    <span>
                      best <b>{chgRecord.best}</b>
                    </span>
                    <span>
                      last <b>{chgRecord.last}</b>
                    </span>
                    <span>
                      tries <b>{chgRecord.tries}</b>
                    </span>
                  </div>
                )}
              </div>

              {chgVoicings.some(Boolean) ? (
                <div className="voicings">
                  {chg.chords.map((c, i) =>
                    chgVoicings[i] ? (
                      <ChordDiagram
                        key={i}
                        voicing={chgVoicings[i]}
                        lefty={settings.leftHanded}
                        midis={midis}
                        rootPc={c.root}
                        capo={0}
                        flats={effFlats}
                        showDegrees={false}
                        title={chordName(c)}
                        onSelect={() => {
                          if (!settings.sound) return;
                          let j = 0;
                          for (let st = 0; st < n; st++) {
                            const f = chgVoicings[i].frets[st];
                            if (f === null) continue;
                            pluck(midis[st] + f, j * 0.035);
                            j++;
                          }
                        }}
                      />
                    ) : (
                      <p className="empty" key={i}>
                        No easy shape for {chordName(c)} in this tuning.
                      </p>
                    ),
                  )}
                </div>
              ) : (
                <p className="empty">No playable shapes for these chords in this tuning.</p>
              )}

              {chg.phase === "idle" && (
                <>
                  <Field label="Chords to switch between">
                    <div className="chgslots">
                      {chg.chords.map((c, i) => (
                        <div className="chgslot" key={i}>
                          <KeyPicker value={c.root} onChange={(v) => setChgChord(i, { root: v })} flats={effFlats} />
                          <div className="chgslotbtm">
                            <CatPicker
                              value={c.id}
                              onChange={(v) => setChgChord(i, { id: v })}
                              label="Chord type"
                              groups={groupItems(CHORD_GROUPS, CHORDS, SIMPLE_CHORDS, settings.simple, c.id)}
                            />
                            <button
                              className="mini"
                              onClick={() => removeChgChord(i)}
                              disabled={chg.chords.length <= 2}
                              data-tip="Remove this chord"
                              aria-label={`Remove ${chordName(c)}`}
                            >
                              {"✕"}
                            </button>
                          </div>
                        </div>
                      ))}
                      {chg.chords.length < 8 && (
                        <button className="btn ghost wide" onClick={addChgChord}>
                          + Add a chord
                        </button>
                      )}
                    </div>
                  </Field>

                  <div className="row">
                    <Field label="Length">
                      <Seg
                        small
                        options={[
                          { v: 30, l: "0:30" },
                          { v: 60, l: "1:00" },
                          { v: 120, l: "2:00" },
                          { v: 0, l: "Free" },
                        ]}
                        value={chg.duration}
                        onChange={(v) => setChg((c) => ({ ...c, duration: v, remaining: v }))}
                      />
                    </Field>
                    <button className="transport" onClick={startRun} disabled={!chgVoicings.some(Boolean)}>
                      Start
                    </button>
                  </div>
                  <p className="note">
                    Change between the chords as many times as you can before the clock runs out. Count each clean change, then enter your
                    total when time is up, and beat your best.
                  </p>
                </>
              )}

              {chg.phase === "running" && (
                <div className="row">
                  <button className="transport on" onClick={stopRun}>
                    Stop
                  </button>
                  <p className="note">
                    {chg.duration === 0
                      ? `Practise switching between ${chgLabel} at your own pace. Stop whenever you are done.`
                      : `Switch between ${chgLabel}. Count each clean change.`}
                  </p>
                </div>
              )}

              {chg.phase === "done" && (
                <div className="chgentry">
                  <Field label="How many changes did you get?">
                    <input
                      type="number"
                      aria-label="How many changes did you get?"
                      min="0"
                      inputMode="numeric"
                      value={chgEntry}
                      autoFocus
                      onChange={(e) => setChgEntry(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveChangeScore();
                      }}
                    />
                  </Field>
                  <button className="btn" onClick={saveChangeScore}>
                    Save
                  </button>
                  <button className="btn ghost" onClick={stopRun}>
                    Discard
                  </button>
                </div>
              )}
            </div>
          )}

          {mode === "about" && (
            <div className="pane about">
              <section className="aboutblock">
                <h2 className="abouthead">About Fretwork</h2>
                <p className="note">
                  Fretwork is a free, interactive guitar fretboard for learning the neck: scales, chords with fingerings, intervals,
                  progressions, and practice drills with a metronome. It works offline and you can install it on your home screen.
                </p>
                <p className="note freeline">Fretwork is, and always will be, free and without ads.</p>
              </section>

              <section className="aboutblock">
                <h2 className="abouthead">New to guitar, or to Fretwork?</h2>
                <p className="note">
                  The FAQ is a plain-language guide to chords, scales, intervals, rhythm and reading the fretboard, alongside how each tool
                  in Fretwork works. It is written for beginners.
                </p>
                <button
                  className="btn"
                  onClick={() => {
                    setMode("faq");
                    setOpenPanel(null);
                  }}
                >
                  Open the FAQ
                </button>
              </section>

              <section className="aboutblock">
                <h2 className="abouthead">What's new</h2>
                {CHANGELOG.map((rel) => (
                  <div key={rel.date} className="release">
                    <h3 className="releasedate">{rel.date}</h3>
                    <ul className="releaselist">
                      {rel.items.map((it) => (
                        <li key={it} className="note">
                          {it}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>

              <section className="aboutblock">
                <h2 className="abouthead">Your data</h2>
                <p className="note">
                  Fretwork uses Google Analytics, Vercel Analytics and Amplitude to understand how the app is used and improve it. There is
                  no session recording. Feedback sent from this page is stored so it can be acted on. No account or personal details are
                  required to use the app.
                </p>
              </section>

              <section className="aboutblock">
                <h2 className="abouthead">Good places to learn</h2>
                <p className="note">
                  These are the resources most often recommended across the guitar-learning world. Fretwork sits alongside them as your
                  reference and practice companion.
                </p>
                <ul className="resources">
                  {RESOURCES.map((r) => (
                    <li key={r.name}>
                      <a href={r.url} target="_blank" rel="noopener noreferrer" onClick={() => track("resource_click", { site: r.name })}>
                        {r.name}
                      </a>
                      <span>{r.blurb}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="aboutblock">
                <h2 className="abouthead">New here?</h2>
                <p className="note">Take a quick guided tour of the neck and the practice tools.</p>
                <button
                  className="btn"
                  onClick={() => {
                    setMode("chord");
                    startTour();
                  }}
                >
                  Take the tour
                </button>
              </section>

              <section className="aboutblock">
                <h2 className="abouthead">Accessibility</h2>
                <p className="note">
                  Music should be for everyone, and Fretwork aims to be usable by everyone. What works today: the whole app can be driven
                  from a keyboard alone, including moving around the fretboard with the arrow keys; menus and dialogs manage focus properly
                  and close with Escape; controls carry screen-reader labels and important changes are announced; and Settings offers high
                  contrast, reduced animation and zoom, alongside the system reduced-motion preference, which is always respected.
                </p>
                <p className="note">
                  Known gaps: some audio feedback has no visual equivalent yet, and the app has not had a formal WCAG audit. Chord shapes
                  are described string by string to screen readers. If something gets in your way, please say so in the form below, and it
                  will be treated as a bug.
                </p>
              </section>

              <section className="aboutblock">
                <h2 className="abouthead">Suggest a feature</h2>
                <FeedbackForm />
              </section>

              {SHOW_DONATE && (
                <section className="aboutblock">
                  <h2 className="abouthead">Support Fretwork</h2>
                  <p className="note">
                    This web app is a personal project created by Jonathan Courtney. Donate £2 to help with hosting costs if you enjoy it.
                  </p>
                  <DonateButton />
                </section>
              )}
            </div>
          )}

          {mode === "faq" && (
            <div className="pane about faq-pane">
              <section className="aboutblock">
                <h2 className="abouthead">FAQ</h2>
                <p className="note">
                  A plain-language guide for anyone learning guitar. It explains the words you will meet, such as chords, intervals, keys
                  and time signatures, shows how to read a chord chart and the fretboard, and covers how each tool in Fretwork works. Tap a
                  question to see the answer.
                </p>
                <div className="row wrap faqtoc" aria-label="Jump to a section">
                  {FAQ_SECTIONS.map((s) => (
                    <button
                      key={s.id}
                      className="jumpchip"
                      onClick={() => {
                        const el = document.getElementById(`faq-${s.id}`);
                        if (el)
                          el.scrollIntoView({
                            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
                            block: "start",
                          });
                      }}
                    >
                      {s.title}
                    </button>
                  ))}
                </div>
              </section>

              {FAQ_SECTIONS.map((s) => (
                <section className="aboutblock" id={`faq-${s.id}`} key={s.id}>
                  <h2 className="abouthead">{s.title}</h2>
                  <div className="faq">
                    {s.items.map((f) => (
                      <details className="faqitem" key={f.q}>
                        <summary>{f.q}</summary>
                        <p className="note">{f.a}</p>
                        {f.view && VIEW_META[f.view] && (
                          <button
                            className="jumpchip faqjump"
                            onClick={() => {
                              setMode(f.view);
                              setOpenPanel(null);
                              if (typeof window !== "undefined") window.scrollTo({ top: 0 });
                            }}
                          >
                            Open {VIEW_META[f.view].title}
                          </button>
                        )}
                      </details>
                    ))}
                  </div>
                </section>
              ))}

              <section className="aboutblock">
                <h2 className="abouthead">Still stuck?</h2>
                <p className="note">
                  If your question is not answered here, suggest it from the About page and it will be treated as feedback.
                </p>
                <button
                  className="btn"
                  onClick={() => {
                    setMode("about");
                    setOpenPanel(null);
                  }}
                >
                  Go to About
                </button>
              </section>
            </div>
          )}

          {mode === "arp" && (
            <div className="pane">
              <p className="panelead">
                Hear and see any arpeggio across the neck in any key, moving up, down or through the shape you choose.
              </p>
              <div className="knownrow">
                <KnownButton
                  known={known.some((k) => k.sig === `k-arp:${arpRoot}:${arpId}`)}
                  onClick={() =>
                    toggleKnown({
                      sig: `k-arp:${arpRoot}:${arpId}`,
                      kind: "arp",
                      root: arpRoot,
                      id: arpId,
                      label: `${nameOf(arpRoot, effFlats)}${arpDef.suffix} arpeggio`,
                    })
                  }
                />
              </div>
              <div className="row wrap">
                <Field label="Root">
                  <KeyPicker value={arpRoot} onChange={setArpRoot} flats={effFlats} />
                </Field>
                <Field label="Arpeggio">
                  <CatPicker
                    value={arpId}
                    onChange={setArpId}
                    label="Arpeggio type"
                    groups={groupItems(CHORD_GROUPS, CHORDS, SIMPLE_CHORDS, settings.simple, arpId)}
                  />
                </Field>
                <Field label="Direction">
                  <Seg
                    small
                    ariaLabel="Arpeggio direction"
                    options={[
                      { v: "up", l: "Up" },
                      { v: "down", l: "Down" },
                      { v: "updown", l: "Up-down" },
                      { v: "downup", l: "Down-up" },
                      ...(settings.simple
                        ? []
                        : [
                            { v: "thirds", l: "In thirds" },
                            { v: "pedal", l: "Pedal root" },
                          ]),
                    ]}
                    value={arpDir}
                    onChange={setArpDir}
                  />
                </Field>
                <button
                  className={`btn primary ${playing != null ? "live" : ""}`}
                  onClick={
                    playing != null
                      ? stopPlayback
                      : () => {
                          track("hear_arp", { arp: arpId, dir: arpDir });
                          playArpeggio();
                        }
                  }
                  data-tip="Play the arpeggio and light each tone, following the chosen position and direction"
                >
                  {playing != null ? "Stop" : "Hear it"}
                </button>
                <StarSave
                  label={`${nameOf(arpRoot, effFlats)}${arpDef.suffix} arpeggio`}
                  saved={bank.some((b) => b.sig === `arp:${arpRoot}:${arpId}:${arpDir}:${arpPos == null ? "all" : arpPos}`)}
                  onClick={() =>
                    saveToBank({
                      id: `b${Date.now()}`,
                      sig: `arp:${arpRoot}:${arpId}:${arpDir}:${arpPos == null ? "all" : arpPos}`,
                      kind: "arp",
                      root: arpRoot,
                      arpId,
                      dir: arpDir,
                      pos: arpPos,
                      tun: settings.tuningId,
                      label: `${nameOf(arpRoot, effFlats)}${arpDef.suffix} arpeggio${arpPos == null ? "" : ` · pos ${arpPos + 1}`}`,
                    })
                  }
                />
              </div>

              <div className="keyjump">
                <span className="note">In {nameOf(arpRoot, effFlats)}:</span>
                <button className="jumpchip" onClick={() => carryKey("scale", arpRoot)}>
                  Scale
                </button>
                <button className="jumpchip" onClick={() => carryKey("chord", arpRoot)}>
                  Chords
                </button>
              </div>

              <Field label="Position">
                <div className="posrow">
                  <button
                    className={`poschip ${arpPos == null ? "on" : ""}`}
                    onClick={() => setArpPos(null)}
                    data-tip="Every position at once"
                  >
                    Whole neck
                  </button>
                  {arpPositions.map((pos, i) => (
                    <button
                      key={i}
                      className={`poschip ${arpPos === i ? "on" : ""}`}
                      onClick={() => setArpPos(i)}
                      data-tip={`Frets ${pos.from} to ${pos.to}, starting on the ${DEG[pos.deg]}`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  {arpPos != null && arpPositions[arpPos] && (
                    <span className="poshint">
                      Frets {arpPositions[arpPos].from} to {arpPositions[arpPos].to}
                    </span>
                  )}
                </div>
              </Field>
              <Field label="Neck shows">
                <Seg
                  small
                  options={[
                    { v: "both", l: "Degree + note" },
                    { v: "name", l: "Notes" },
                    { v: "degree", l: "Degrees" },
                    { v: "order", l: "Play order" },
                    { v: "none", l: "Blank" },
                  ]}
                  value={arpLabel}
                  onChange={setArpLabel}
                />
              </Field>

              <div className="degrees">
                {arpDef.iv.map((i) => (
                  <span key={i} className="chip" style={{ borderLeftColor: FUNC_COLOUR[i % 12] }}>
                    <b style={{ color: FUNC_COLOUR[i % 12] }}>{DEG[i % 12]}</b>
                    {nameOf(arpRoot + i, effFlats)}
                  </span>
                ))}
              </div>

              <p className="note">
                Every place these chord tones live on the neck. Narrow to one position, then follow the playback direction with your pick.
              </p>
            </div>
          )}

          {mode === "routine" && (
            <div className="pane">
              <p className="note">
                Mark scales, chords and arpeggios you know with the lightbulb, then build a short routine here. Fretwork practises the ones
                you rated shaky for longer and adds one new "stretch" item. Rate the session afterwards to shape the next one.
              </p>
              {known.length === 0 ? (
                <p className="empty">
                  Nothing marked yet. On the Scales, Chords or Arpeggios views, tap the lightbulb next to the star to mark something you
                  know, then come back to build a routine.
                </p>
              ) : (
                <>
                  <div className="row wrap actions">
                    <Field label="How long?">
                      <Seg
                        small
                        ariaLabel="Routine length"
                        options={[
                          { v: 5, l: "5 min" },
                          { v: 10, l: "10 min" },
                          { v: 15, l: "15 min" },
                          { v: 20, l: "20 min" },
                        ]}
                        value={routineDur}
                        onChange={setRoutineDur}
                      />
                    </Field>
                    <button className="btn primary" onClick={buildRoutine}>
                      Build and start
                    </button>
                  </div>
                  <p className="note">
                    You know {known.length} thing{known.length === 1 ? "" : "s"}. Your {routineDur} minute routine will run through{" "}
                    {known.length === 1 ? "it" : "them"} plus one new stretch to grow into.
                  </p>
                  <Field label="Things you know">
                    <div className="knownlist">
                      {known.map((k) => (
                        <div className="knownitem" key={k.sig}>
                          <span className="knowndot" aria-hidden="true" />
                          <b>{k.label}</b>
                          {routineRatings[k.sig] ? <em className="knownrate">{"★".repeat(routineRatings[k.sig])}</em> : null}
                          <button className="mini" aria-label={`Forget ${k.label}`} onClick={() => toggleKnown(k)}>
                            {"✕"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </Field>
                </>
              )}
            </div>
          )}

          {mode === "strum" && (
            <div className="pane">
              <p className="note">
                Pick a chord and a strumming pattern, hit Play, and strum along in time. A down arrow is a downstroke (low strings to high),
                an up arrow is an upstroke. Set the tempo to suit you.
              </p>

              <div className="row wrap">
                <Field label="Root">
                  <KeyPicker value={chordRoot} onChange={setChordRoot} flats={effFlats} />
                </Field>
                <Field label="Chord">
                  <CatPicker
                    value={chordId}
                    onChange={setChordId}
                    label="Chord type"
                    groups={groupItems(CHORD_GROUPS, CHORDS, SIMPLE_CHORDS, settings.simple, chordId)}
                  />
                </Field>
              </div>

              {activeVoicing && (
                <div className="voicings">
                  <div className="voicewrap">
                    <ChordDiagram
                      voicing={activeVoicing}
                      lefty={settings.leftHanded}
                      midis={midis}
                      rootPc={chordRoot}
                      capo={capo}
                      flats={effFlats}
                      showDegrees={false}
                      selected
                    />
                  </div>
                </div>
              )}

              <Field label="Pattern">
                <div className="row wrap">
                  {STRUM_PATTERNS.filter((p) => !settings.simple || p.simple).map((p) => (
                    <button
                      key={p.id}
                      aria-pressed={strumPatId === p.id}
                      className={`btn ${strumPatId === p.id ? "primary" : "ghost"}`}
                      onClick={() => {
                        if (strumOn) stopPlayback();
                        setStrumPatId(p.id);
                      }}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </Field>

              <div className="strumbar" role="group" aria-label="Strum pattern. Bold arrows are accented.">
                {(STRUM_PATTERNS.find((p) => p.id === strumPatId) || STRUM_PATTERNS[0]).slots.map((st, i) => {
                  const dir = st ? st.toLowerCase() : null;
                  const accent = st && st === st.toUpperCase();
                  return (
                    <div
                      key={i}
                      className={`strumslot ${strumStep === i ? "on" : ""} ${i % 2 === 0 ? "beat" : ""} ${accent ? "accent" : ""}`}
                    >
                      <span className="strumarrow" aria-hidden="true">
                        {dir === "d" ? "↓" : dir === "u" ? "↑" : ""}
                      </span>
                      <span className="strumcount">{i % 2 === 0 ? String(i / 2 + 1) : "&"}</span>
                    </div>
                  );
                })}
              </div>

              <div className="row wrap actions">
                <button
                  className={`btn primary ${strumOn ? "live" : ""}`}
                  onClick={strumOn ? stopPlayback : playStrum}
                  disabled={!activeVoicing}
                >
                  {strumOn ? "Stop" : "Play"}
                </button>
                <Field label="Tempo">
                  <div className="row">
                    <button
                      className="mini"
                      aria-label="Slower"
                      onClick={() => setSettings((s) => ({ ...s, bpm: Math.max(40, s.bpm - 5) }))}
                    >
                      {"−"}5
                    </button>
                    <b className="barcount">{settings.bpm}</b>
                    <button
                      className="mini"
                      aria-label="Faster"
                      onClick={() => setSettings((s) => ({ ...s, bpm: Math.min(240, s.bpm + 5) }))}
                    >
                      +5
                    </button>
                  </div>
                </Field>
                <button
                  className={`btn ${strumClick ? "primary" : "ghost"}`}
                  aria-pressed={strumClick}
                  onClick={() => setStrumClick((v) => !v)}
                  data-tip="Play the metronome click on each beat, at this tempo"
                >
                  Click: {strumClick ? "on" : "off"}
                </button>
              </div>
            </div>
          )}

          {mode === "melody" && (
            <div className="pane">
              <p className="note">
                Tap notes on the neck to drop them onto the timeline below, one eighth-note slot at a time. Tap a slot to move the cursor
                there, or tap a filled slot again to clear it back to a rest. An empty slot is a rest, the same note in two slots is a
                repeat.
              </p>

              <Field
                label={`Timeline \u00b7 ${melSteps.filter((s) => s && !s.rest).length} ${melSteps.filter((s) => s && !s.rest).length === 1 ? "note" : "notes"}`}
              >
                <div className="timeline" role="group" aria-label="Melody timeline. Tap the neck to add a note at the cursor.">
                  {Array.from({ length: melBars }, (_, b) => (
                    <div className="tbar" key={b}>
                      {Array.from({ length: MEL_SLOTS }, (_, sc) => {
                        const i = b * MEL_SLOTS + sc;
                        const cell = melSteps[i];
                        const filled = cell && !cell.rest;
                        const nm = filled ? nameOf((settings.midis[cell.s] + cell.f) % 12, effFlats) : "";
                        return (
                          <button
                            key={i}
                            type="button"
                            className={`tslot ${filled ? "filled" : "rest"} ${i === melCursor ? "cursor" : ""} ${melPlayIdx === i ? "playing" : ""} ${sc % 2 === 0 ? "beat" : ""}`}
                            aria-label={
                              filled ? `Slot ${i + 1}, ${nm}. Tap to select, tap again to clear.` : `Slot ${i + 1}, rest. Tap to select.`
                            }
                            aria-current={i === melCursor ? "true" : undefined}
                            onClick={() => {
                              if (i === melCursor && filled) {
                                setMelSteps((st) => {
                                  const n = st.slice();
                                  while (n.length <= i) n.push({ rest: true });
                                  n[i] = { rest: true };
                                  return n;
                                });
                              } else {
                                setMelCursor(i);
                                if (filled) playNote(settings.midis[cell.s] + cell.f);
                              }
                            }}
                          >
                            <span className="tslotname">{nm}</span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </Field>

              <div className="row wrap barctl">
                <span className="note">Bars</span>
                <button
                  className="mini"
                  aria-label="Remove a bar"
                  disabled={melBars <= 1}
                  onClick={() => {
                    const nb = Math.max(1, melBars - 1);
                    setMelBars(nb);
                    setMelSteps((st) => st.slice(0, nb * MEL_SLOTS));
                    setMelCursor((c) => Math.min(c, nb * MEL_SLOTS - 1));
                  }}
                >
                  {"\u2212"}
                </button>
                <b className="barcount">{melBars}</b>
                <button
                  className="mini"
                  aria-label="Add a bar"
                  disabled={melBars >= MEL_MAX_BARS}
                  onClick={() => setMelBars((b) => Math.min(MEL_MAX_BARS, b + 1))}
                >
                  +
                </button>
                <button
                  className="btn ghost"
                  onClick={() => {
                    setMelSteps((st) => {
                      const n = st.slice();
                      while (n.length <= melCursor) n.push({ rest: true });
                      n[melCursor] = { rest: true };
                      return n;
                    });
                    setMelCursor((c) => Math.min(c + 1, melBars * MEL_SLOTS - 1));
                  }}
                >
                  Add rest
                </button>
                <button
                  className="btn ghost"
                  disabled={melCursor === 0}
                  onClick={() => {
                    const j = Math.max(0, melCursor - 1);
                    setMelSteps((st) => {
                      if (j >= st.length) return st;
                      const n = st.slice();
                      n[j] = { rest: true };
                      return n;
                    });
                    setMelCursor(j);
                  }}
                >
                  Back
                </button>
              </div>

              {melKeyHint && (
                <p className="note" role="status">
                  {melKeyHint.loose ? "Mostly fits" : "Fits"}{" "}
                  {nameOf(melKeyHint.root, keyPrefersFlats(melKeyHint.root, [0, 2, 4, 5, 7, 9, 11]))} major
                  {" / "}
                  {nameOf((melKeyHint.root + 9) % 12, keyPrefersFlats(melKeyHint.root, [0, 2, 4, 5, 7, 9, 11]))} minor.
                </p>
              )}

              <div className="row wrap actions">
                <button
                  className={`btn primary ${melPlayIdx != null ? "live" : ""}`}
                  onClick={melPlayIdx != null ? stopPlayback : playMelody}
                  disabled={!melSteps.some((s) => s && !s.rest)}
                >
                  {melPlayIdx != null ? "Stop" : "Play"}
                </button>
                <button
                  className={`btn ${melLoop ? "primary" : "ghost"}`}
                  aria-pressed={melLoop}
                  onClick={() => {
                    const nv = !melLoop;
                    setMelLoop(nv);
                    melLoopRef.current = nv;
                  }}
                  data-tip="Repeat the melody until you press Stop"
                >
                  Loop: {melLoop ? "on" : "off"}
                </button>
                <Field label="Speed">
                  <Seg
                    small
                    ariaLabel="Playback speed"
                    options={[
                      { v: 1, l: "Slow" },
                      { v: 2, l: "Normal" },
                      { v: 4, l: "Fast" },
                    ]}
                    value={melRate}
                    onChange={setMelRate}
                  />
                </Field>
                <Field label="Transpose">
                  <div className="row">
                    <button
                      className="mini"
                      aria-label="Down one semitone"
                      onClick={() => transposeMelody(-1)}
                      disabled={!melSteps.some((s) => s && !s.rest)}
                    >
                      {"\u2212"}1
                    </button>
                    <button
                      className="mini"
                      aria-label="Up one semitone"
                      onClick={() => transposeMelody(1)}
                      disabled={!melSteps.some((s) => s && !s.rest)}
                    >
                      +1
                    </button>
                  </div>
                </Field>
                <span className="actspacer" aria-hidden="true" />
                <button
                  className="btn ghost danger"
                  onClick={() => {
                    setMelSteps([]);
                    setMelBars(2);
                    setMelCursor(0);
                  }}
                  disabled={!melSteps.length}
                >
                  Clear
                </button>
              </div>

              <div className="row wrap">
                <Field id="melname" label="Name">
                  <input
                    id="melname"
                    type="text"
                    value={melName}
                    maxLength={60}
                    placeholder="Riff I am learning"
                    onChange={(e) => setMelName(e.target.value)}
                    className="melinput"
                  />
                </Field>
                <button
                  className="btn"
                  disabled={!melSteps.some((s) => s && !s.rest) || !melName.trim()}
                  onClick={() => {
                    saveMelodies([{ id: `m${Date.now()}`, name: melName.trim(), steps: melSteps, bars: melBars }, ...melodies]);
                    track("melody_save", { notes: melSteps.filter((s) => s && !s.rest).length });
                    setToast("Melody saved");
                    setMelName("");
                  }}
                >
                  Save melody
                </button>
              </div>

              <div className="row wrap">
                <button className="btn ghost" onClick={importTabFromClipboard}>
                  Import tab from clipboard
                </button>
                <button className="btn ghost" onClick={() => setMelImport((v) => !v)}>
                  {melImport ? "Hide paste box" : "Paste a tab"}
                </button>
              </div>
              {melImport && (
                <Field id="tabpaste" label="Paste a tab, then Import">
                  <textarea
                    id="tabpaste"
                    className="melinput tabbox"
                    rows={7}
                    value={melImportText}
                    onChange={(e) => setMelImportText(e.target.value)}
                    placeholder={"e|--0--3--0--|\nB|--1-----1--|\nG|--0-----0--|\nD|--2-----2--|\nA|--3--3--3--|\nE|-----------|"}
                  />
                  <div className="row">
                    <button className="btn primary" onClick={() => doImportTab(melImportText)} disabled={!melImportText.trim()}>
                      Import
                    </button>
                  </div>
                </Field>
              )}

              {melodies.length > 0 && (
                <Field label="Saved melodies">
                  <div className="mellist">
                    {melodies.map((m) => (
                      <div className="melitem" key={m.id}>
                        <button
                          className="melload"
                          onClick={() => {
                            /* drop notes that fall off the current tuning/neck (fewer strings or frets) */
                            const steps = m.steps
                              .slice(0, MEL_MAX_BARS * MEL_SLOTS)
                              .map((st) => (st && !st.rest && (st.s >= settings.midis.length || st.f > fretCount) ? { rest: true } : st));
                            setMelSteps(steps);
                            setMelBars(Math.max(2, Math.min(MEL_MAX_BARS, m.bars || Math.ceil(steps.length / MEL_SLOTS))));
                            setMelCursor(0);
                            setMelName(m.name);
                            setToast(`Loaded ${m.name}`);
                          }}
                        >
                          <b>{m.name}</b>
                          <em>{m.steps.filter((s) => s && !s.rest).length} notes</em>
                        </button>
                        <button
                          className="mini"
                          aria-label={`Delete ${m.name}`}
                          onClick={() => saveMelodies(melodies.filter((x) => x.id !== m.id))}
                        >
                          {"\u2715"}
                        </button>
                      </div>
                    ))}
                  </div>
                </Field>
              )}
            </div>
          )}

          {mode === "ear" && (
            <div className="pane">
              <p className="panelead">
                Train your ear to recognise intervals and chord types by sound, then check yourself against the answer.
              </p>
              <div className="scoreboard">
                <div className="score">
                  <b>{ear.correct}</b>
                  <span>correct</span>
                </div>
                <div className="score">
                  <b className="bad">{ear.wrong}</b>
                  <span>wrong</span>
                </div>
                <div className="score">
                  <b>{ear.streak}</b>
                  <span>streak</span>
                </div>
              </div>

              <div className="row wrap">
                <Field label="Mode" tip="Identify what you hear, or choose a sound and listen to it">
                  <Seg
                    small
                    ariaLabel="Ear training mode"
                    options={[
                      { v: "quiz", l: "Hear and identify" },
                      { v: "explore", l: "Choose and hear" },
                    ]}
                    value={ear.dir}
                    onChange={(v) => setEar((e) => ({ ...e, dir: v, current: null, picked: null, streak: 0 }))}
                  />
                </Field>
                <Field label="Sounds">
                  <Seg
                    small
                    ariaLabel="Interval or chord sounds"
                    options={[
                      { v: "interval", l: "Intervals" },
                      { v: "chord", l: "Chord types" },
                    ]}
                    value={ear.source}
                    onChange={(v) => setEar((e) => ({ ...e, source: v, current: null, picked: null, streak: 0 }))}
                  />
                </Field>
                <Field label="Difficulty">
                  <Seg
                    small
                    ariaLabel="Difficulty"
                    options={[
                      { v: "simple", l: "Common" },
                      { v: "all", l: "Everything" },
                    ]}
                    value={ear.level}
                    onChange={(v) => setEar((e) => ({ ...e, level: v, current: null, picked: null, streak: 0 }))}
                  />
                </Field>
              </div>

              {ear.dir === "quiz" ? (
                <>
                  <div className="row">
                    <button
                      className="btn primary"
                      onClick={() => (ear.current ? earPlay(ear.current.root, ear.current.answer) : earNext())}
                    >
                      {ear.current ? "Play again" : "Start"}
                    </button>
                  </div>
                  <div className="earopts">
                    {earPool.map((o) => {
                      const answered = ear.picked != null;
                      const isPick = ear.picked === o.v;
                      const isRight = answered && ear.current && o.v === ear.current.answer;
                      return (
                        <button
                          key={String(o.v)}
                          className={`earopt ${isRight ? "right" : isPick ? "wrongpick" : ""}`}
                          disabled={!ear.current || answered}
                          onClick={() => earAnswer(o.v)}
                        >
                          {o.l}
                        </button>
                      );
                    })}
                  </div>
                  <p className="note" role="status" aria-live="polite">
                    {ear.picked != null && ear.current
                      ? ear.picked === ear.current.answer
                        ? "Right. Next one coming up."
                        : `It was ${earPool.find((o) => o.v === ear.current.answer)?.l}. Next one coming up.`
                      : ear.current
                        ? "What did you hear?"
                        : "Press Start and identify what you hear."}
                  </p>
                </>
              ) : (
                <>
                  <p className="note">Tap a sound to hear it from a random root. Learn the colour, then flip to Hear and identify.</p>
                  <div className="earopts">
                    {earPool.map((o) => (
                      <button
                        key={String(o.v)}
                        className="earopt"
                        onClick={() => {
                          const root = 45 + Math.floor(Math.random() * 15);
                          earPlay(root, o.v);
                        }}
                      >
                        {o.l}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className="row">
                <button
                  className="btn ghost danger"
                  onClick={() => setEar((e) => ({ ...e, correct: 0, wrong: 0, streak: 0 }))}
                  disabled={!ear.correct && !ear.wrong}
                >
                  Reset score
                </button>
              </div>
            </div>
          )}

          {mode === "plog" && (
            <div className="pane about">
              {(() => {
                const fmt = (sec) => {
                  const m = Math.round(sec / 60);
                  if (m < 60) return `${m} min`;
                  return `${Math.floor(m / 60)}h ${m % 60}m`;
                };
                return (
                  <>
                    <section className="progress">
                      <div className="levelcard">
                        <div className="levelring">
                          <svg viewBox="0 0 44 44" width="72" height="72" aria-hidden="true">
                            <circle cx="22" cy="22" r="19" className="lr-track" />
                            <circle
                              cx="22"
                              cy="22"
                              r="19"
                              className="lr-fill"
                              style={{ strokeDasharray: `${(gLevel.pct / 100) * 119.4} 119.4` }}
                            />
                          </svg>
                          <div className="levelnum">
                            <b>{gLevel.level}</b>
                            <span>level</span>
                          </div>
                        </div>
                        <div className="levelmeta">
                          <div className="levelpts">
                            {gPoints.toLocaleString("en-GB")} <span>points</span>
                          </div>
                          <div className="levelbar">
                            <div className="levelbarfill" style={{ width: `${gLevel.pct}%` }} />
                          </div>
                          <div className="levelnext">
                            {gLevel.toNext.toLocaleString("en-GB")} points to level {gLevel.level + 1}
                          </div>
                        </div>
                      </div>

                      <h2 className="abouthead">Badges</h2>
                      <div className="badgegrid">
                        {[...BADGES]
                          .sort((a, b) => (badgeTier(b, gStats) > 0) - (badgeTier(a, gStats) > 0))
                          .map((b) => {
                            const tier = badgeTier(b, gStats);
                            const max = b.tiers.length;
                            const earned = tier > 0;
                            const nextAt = tier < max ? b.tiers[tier] : null;
                            return (
                              <div key={b.id} className={`badge2 ${earned ? "earned" : "locked"}`}>
                                <svg className="badgemedal" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
                                  <path d="M12 2.5l2.7 5.9 6.3.6-4.8 4.3 1.4 6.2L12 16.9 6.2 19.5l1.4-6.2L2.8 9l6.3-.6z" />
                                </svg>
                                <b className="badgename">{b.name}</b>
                                <span className="badgetier">
                                  {!earned
                                    ? `Reach ${b.tiers[0]} ${b.unit}`
                                    : max > 1
                                      ? tier < max
                                        ? `Level ${tier} of ${max}`
                                        : "Maxed"
                                      : "Earned"}
                                </span>
                                {nextAt != null && earned && (
                                  <span className="badgenext">
                                    Next at {nextAt} {b.unit}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </section>

                    <div className="scoreboard">
                      <div className="score">
                        <b>{practiceStats.streak}</b>
                        <span>day streak</span>
                      </div>
                      <div className="score">
                        <b>{fmt(practiceStats.todayTotal)}</b>
                        <span>today</span>
                      </div>
                      <div className="score">
                        <b>{fmt(practiceStats.weekTotal)}</b>
                        <span>last 14 days</span>
                      </div>
                      <div className="score">
                        <b>{fmt(practiceStats.allTime)}</b>
                        <span>all time</span>
                      </div>
                    </div>

                    <section className="aboutblock">
                      <h2 className="abouthead">Last 14 days</h2>
                      <div
                        className="plogbars"
                        role="img"
                        aria-label={`Practice minutes over the last fourteen days, ${fmt(practiceStats.weekTotal)} total`}
                      >
                        {practiceStats.week.map((d, i) => (
                          <div className="plogday" key={d.k} title={`${d.label}: ${fmt(d.total)}`}>
                            <div className="plogbarwrap">
                              <div
                                className="plogbar"
                                style={{ height: `${d.total ? Math.max(4, (d.total / practiceStats.maxDay) * 100) : 0}%` }}
                              />
                            </div>
                            <span className="ploglabel">{i % 2 === 0 ? d.label[0] : ""}</span>
                          </div>
                        ))}
                      </div>
                    </section>

                    {practiceStats.modeRows.length > 0 ? (
                      <section className="aboutblock">
                        <h2 className="abouthead">By activity</h2>
                        <div className="plogmodes">
                          {practiceStats.modeRows.map(([m, sec]) => (
                            <div className="plogmode" key={m}>
                              <span className="plogmname">{PRACTICE_MODES[m] || m}</span>
                              <div className="plogtrack">
                                <div className="plogfill" style={{ width: `${(sec / practiceStats.modeRows[0][1]) * 100}%` }} />
                              </div>
                              <span className="plogmtime">{fmt(sec)}</span>
                            </div>
                          ))}
                        </div>
                      </section>
                    ) : (
                      <p className="note">
                        No practice recorded yet. Time spent in Scales, Chords, drills and the other practice views is logged here
                        automatically, so you can see your streak build.
                      </p>
                    )}
                    <p className="note">
                      Practice is counted only while the app is open and you are active in a practice view.{" "}
                      {authUser ? "Your log syncs to your account." : "Sign in to sync your log across devices."}
                    </p>
                  </>
                );
              })()}
            </div>
          )}

          {mode === "finder" && (
            <div className="pane">
              <p className="note">
                Tap the notes of a chord on the neck (or focus it and use the arrow keys and Enter) and Fretwork names it. Handy for the
                unfamiliar shapes you meet in tab.
              </p>
              <div className="degrees">
                {finderInfo.pcs.length === 0 ? (
                  <span className="note">No notes selected yet.</span>
                ) : (
                  finderInfo.pcs.map((pc) => (
                    <span key={pc} className="chip">
                      <b>{nameOf(pc, effFlats)}</b>
                    </span>
                  ))
                )}
              </div>

              {finderInfo.exact.length > 0 ? (
                <Field label="This chord is">
                  <div className="finderhits">
                    {finderInfo.exact.map((m) => (
                      <button
                        key={`${m.root}${m.id}`}
                        className="btn"
                        onClick={() => {
                          setChordRoot(m.root);
                          setChordId(m.id);
                          setMode("chord");
                          track("finder_open", { chord: m.id });
                        }}
                      >
                        {nameOf(m.root, effFlats)}
                        {(CHORDS.find((c) => c.id === m.id) || {}).suffix}
                      </button>
                    ))}
                  </div>
                </Field>
              ) : finderInfo.partial.length > 0 ? (
                <Field label="Could be part of">
                  <div className="finderhits">
                    {finderInfo.partial.map((m) => (
                      <button
                        key={`${m.root}${m.id}`}
                        className="btn ghost"
                        onClick={() => {
                          setChordRoot(m.root);
                          setChordId(m.id);
                          setMode("chord");
                        }}
                      >
                        {nameOf(m.root, effFlats)}
                        {(CHORDS.find((c) => c.id === m.id) || {}).suffix}
                      </button>
                    ))}
                  </div>
                </Field>
              ) : finderInfo.pcs.length >= 2 ? (
                <p className="empty" role="status">
                  No standard chord matches those notes. Try adding or removing one.
                </p>
              ) : (
                <p className="note">Add at least two notes to name a chord.</p>
              )}

              <div className="row">
                <button className="btn ghost danger" onClick={() => setFinderSel(new Set())} disabled={finderSel.size === 0}>
                  Clear
                </button>
              </div>
            </div>
          )}

          {mode === "tuner" && (
            <div className="pane">
              <div className="tunerbox">
                {!tuner.on ? (
                  <>
                    <p className="note">
                      Play a string and Fretwork shows how sharp or flat it is, so you can tune without relying on your ear. The microphone
                      is only used while you are tuning, and nothing is recorded or sent anywhere.
                    </p>
                    <button className="btn primary" onClick={startTuner}>
                      Start listening
                    </button>
                    {tuner.error && (
                      <p className="empty" role="status">
                        {tuner.error}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    {(() => {
                      const target = tuner.note != null ? nearestStringTarget(tuner.note, settings.midis) : null;
                      const inTune = tuner.note != null && Math.abs(tuner.cents) <= 5;
                      return (
                        <div className="tunelive" role="status" aria-live="polite">
                          <div className={`tunenote ${inTune ? "intune" : ""}`}>
                            {tuner.note != null ? nameOf(tuner.note % 12, effFlats) : "\u2014"}
                            <span className="tuneoct">{tuner.note != null ? Math.floor(tuner.note / 12) - 1 : ""}</span>
                          </div>
                          <div className="tunemeter" aria-hidden="true">
                            <div className="tunescale">
                              <span className="tunetick c" />
                              <div className="tuneneedle" style={{ left: `${50 + Math.max(-50, Math.min(50, tuner.cents))}%` }} />
                            </div>
                            <div className="tunecents">
                              {tuner.note == null
                                ? "listening"
                                : inTune
                                  ? "in tune"
                                  : `${tuner.cents > 0 ? "+" : ""}${tuner.cents} cents ${tuner.cents > 0 ? "sharp" : "flat"}`}
                            </div>
                          </div>
                          {target && (
                            <p className="note">
                              Closest string: {target.label}. {target.diff === 0 ? "In tune." : target.diff > 0 ? "Tune down." : "Tune up."}
                            </p>
                          )}
                        </div>
                      );
                    })()}
                    <button className="btn ghost danger" onClick={stopTuner}>
                      Stop listening
                    </button>
                  </>
                )}
              </div>

              <p className="note">Or set the strings and pick a preset tuning below.</p>
              <div className="grid">
                <Field label="Tuning">
                  <select aria-label="Tuning" value={settings.tuningId} onChange={(e) => setTuning(e.target.value)}>
                    {TUNINGS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                    {settings.tuningId === "custom" && <option value="custom">Custom</option>}
                  </select>
                </Field>
              </div>

              <div className="tuner">
                <span className="flabel">Strings, low to high</span>
                <div className="strings">
                  {midis.map((mv, i) => (
                    <div className="stringrow" key={i}>
                      <span className="sidx">{i + 1}</span>
                      <select
                        aria-label={`Note for string ${i + 1}`}
                        value={mv % 12}
                        onChange={(e) => setStringNote(i, Math.floor(mv / 12) * 12 + +e.target.value)}
                      >
                        {Array.from({ length: 12 }, (_, pc) => (
                          <option key={pc} value={pc}>
                            {nameOf(pc, effFlats)}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label={`Octave for string ${i + 1}`}
                        value={Math.floor(mv / 12) - 1}
                        onChange={(e) => setStringNote(i, (mv % 12) + (+e.target.value + 1) * 12)}
                      >
                        {[0, 1, 2, 3, 4, 5].map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                      <button className="mini" aria-label={`Play string ${i + 1}`} onClick={() => playNote(mv)}>
                        ▸
                      </button>
                    </div>
                  ))}
                </div>
                <div className="stringbtns">
                  <button
                    className="mini wide"
                    onClick={() => setSettings((s) => ({ ...s, midis: [s.midis[0] - 5, ...s.midis], tuningId: "custom" }))}
                    disabled={n >= 9}
                  >
                    Add low string
                  </button>
                  <button
                    className="mini wide"
                    onClick={() => setSettings((s) => ({ ...s, midis: s.midis.slice(1), tuningId: "custom" }))}
                    disabled={n <= 3}
                  >
                    Remove low string
                  </button>
                </div>
              </div>

              <div className="capocalc">
                <span className="flabel">Capo calculator</span>
                <div className="row wrap">
                  <Field label="Chords you play">
                    <KeyPicker value={capoShape} onChange={setCapoShape} flats={effFlats} />
                  </Field>
                  <Field label="Key you want to hear">
                    <KeyPicker value={capoTarget} onChange={setCapoTarget} flats={effFlats} />
                  </Field>
                </div>
                {(() => {
                  const fret = (((capoTarget - capoShape) % 12) + 12) % 12;
                  return (
                    <p className="note">
                      {fret === 0
                        ? `Play ${nameOf(capoShape, effFlats)} shapes with no capo to hear ${nameOf(capoTarget, effFlats)}.`
                        : `Play ${nameOf(capoShape, effFlats)} shapes with a capo at fret ${fret} to hear ${nameOf(capoTarget, effFlats)}.`}
                    </p>
                  );
                })()}
              </div>
            </div>
          )}

          {mode === "settings" && (
            <div className="pane">
              <div className="grid">
                <Field label="Frets" tip="How many frets the neck shows">
                  <input
                    type="range"
                    min="7"
                    max="27"
                    value={settings.fretCount}
                    aria-label="Frets shown"
                    onChange={(e) => setSettings((s) => ({ ...s, fretCount: +e.target.value }))}
                  />
                  <output>{settings.fretCount}</output>
                </Field>
              </div>

              <div className="toggles">
                <Field label="Note names" tip="Auto spells notes from the current key, so C minor reads Eb rather than D sharp">
                  <Seg
                    small
                    options={[
                      { v: "auto", l: "Auto" },
                      { v: "sharps", l: "Sharps" },
                      { v: "flats", l: "Flats" },
                    ]}
                    value={settings.noteNames}
                    onChange={(v) => setSettings((s) => ({ ...s, noteNames: v }))}
                  />
                </Field>
                <Field label="Dot labels" tip="What the dots on the neck display by default">
                  <Seg
                    small
                    options={[
                      { v: "name", l: "Names" },
                      { v: "degree", l: "Degrees" },
                      { v: "none", l: "Blank" },
                    ]}
                    value={settings.labelMode}
                    onChange={(v) => setSettings((s) => ({ ...s, labelMode: v }))}
                  />
                </Field>
                <Field label="Colour" tip="Colour dots by their interval from the root, by root only, or keep them plain">
                  <Seg
                    small
                    options={[
                      { v: "root", l: "Root" },
                      { v: "interval", l: "By interval" },
                      { v: "mono", l: "Mono" },
                    ]}
                    value={settings.colourMode}
                    onChange={(v) => setSettings((s) => ({ ...s, colourMode: v }))}
                  />
                </Field>
                <Field label="String order" tip="High on top reads like tab; low on top matches looking down at a guitar">
                  <Seg
                    small
                    options={[
                      { v: true, l: "High on top" },
                      { v: false, l: "Low on top" },
                    ]}
                    value={settings.highOnTop}
                    onChange={(v) => setSettings((s) => ({ ...s, highOnTop: v }))}
                  />
                </Field>
                <Field label="Handed" tip="Flips the neck for left-handed players">
                  <Seg
                    small
                    options={[
                      { v: false, l: "Right" },
                      { v: true, l: "Left" },
                    ]}
                    value={settings.leftHanded}
                    onChange={(v) => setSettings((s) => ({ ...s, leftHanded: v }))}
                  />
                </Field>
                <Field label="Chord stretch" tip="The widest fret span a suggested chord shape may use">
                  <Seg
                    small
                    options={[
                      { v: 3, l: "3 frets" },
                      { v: 4, l: "4" },
                      { v: 5, l: "5" },
                    ]}
                    value={settings.span}
                    onChange={(v) => setSettings((s2) => ({ ...s2, span: v }))}
                  />
                </Field>
                <Field label="Inversions" tip="Allow shapes whose lowest note is not the root">
                  <Seg
                    small
                    options={[
                      { v: false, l: "Root bass" },
                      { v: true, l: "Allow" },
                    ]}
                    value={settings.inversions}
                    onChange={(v) => setSettings((s2) => ({ ...s2, inversions: v }))}
                  />
                </Field>
                <Field label="Barres" tip="Allow shapes that lay one finger across several strings">
                  <Seg
                    small
                    options={[
                      { v: true, l: "Allow" },
                      { v: false, l: "Avoid" },
                    ]}
                    value={settings.barres}
                    onChange={(v) => setSettings((s2) => ({ ...s2, barres: v }))}
                  />
                </Field>
                <Field label="Theme" tip="Light or dark appearance">
                  <Seg
                    small
                    options={[
                      { v: false, l: "Light" },
                      { v: true, l: "Dark" },
                    ]}
                    value={settings.dark}
                    onChange={(v) => {
                      track("theme_set", { dark: v });
                      setSettings((s2) => ({ ...s2, dark: v }));
                    }}
                  />
                </Field>
                <Field label="Options shown" tip="Simple keeps only the scales, chords and controls a beginner needs">
                  <Seg
                    small
                    options={[
                      { v: true, l: "Simple" },
                      { v: false, l: "Everything" },
                    ]}
                    value={settings.simple}
                    onChange={(v) => {
                      track("simple_toggle", { on: v });
                      setSettings((s2) => ({ ...s2, simple: v }));
                      setGamify((g) => (g.counters.triedSimple ? g : { ...g, counters: { ...g.counters, triedSimple: 1 } }));
                    }}
                  />
                </Field>
                <Field label="Sound" tip="Note and click playback throughout the app">
                  <Seg
                    small
                    options={[
                      { v: true, l: "On" },
                      { v: false, l: "Off" },
                    ]}
                    value={settings.sound}
                    onChange={(v) => setSettings((s) => ({ ...s, sound: v }))}
                  />
                </Field>
              </div>

              <h3 className="sheetsec">Accessibility</h3>
              <div className="toggles">
                <Field label="High contrast" tip="Stronger borders and darker labels for readability">
                  <Seg
                    small
                    options={[
                      { v: false, l: "Off" },
                      { v: true, l: "On" },
                    ]}
                    value={settings.highContrast}
                    onChange={(v) => {
                      track("a11y_contrast", { on: v });
                      setSettings((s) => ({ ...s, highContrast: v }));
                    }}
                  />
                </Field>
                <Field label="Animation" tip="Reduced switches off movement effects; the system preference is always respected">
                  <Seg
                    small
                    options={[
                      { v: false, l: "Full" },
                      { v: true, l: "Reduced" },
                    ]}
                    value={settings.lowMotion}
                    onChange={(v) => {
                      track("a11y_motion", { reduced: v });
                      setSettings((s) => ({ ...s, lowMotion: v }));
                    }}
                  />
                </Field>
                <Field label="Zoom" tip="Scales the whole fretboard up for larger targets">
                  <input
                    type="range"
                    min="0.7"
                    max="2.2"
                    step="0.1"
                    value={settings.zoom}
                    aria-label="Fretboard zoom"
                    onChange={(e) => setSettings((s) => ({ ...s, zoom: +e.target.value }))}
                  />
                  <output>{settings.zoom.toFixed(1)}×</output>
                </Field>
              </div>
              <p className="note">The system reduced-motion preference is always respected. These controls apply on top of it.</p>
            </div>
          )}

          {mode === "account" && (
            <div className="pane about">
              {!authUser ? (
                <section className="aboutblock">
                  <h2 className="abouthead">{authMode === "create" ? "Create an account" : "Sign in"}</h2>
                  <p className="note">
                    An account syncs your Bank (saved chords and progressions) and your chord-change records across devices. Everything also
                    works without one, saved on this device only.
                  </p>
                  <Seg
                    small
                    ariaLabel="Sign in or create account"
                    options={[
                      { v: "signin", l: "Sign in" },
                      { v: "create", l: "Create account" },
                    ]}
                    value={authMode}
                    onChange={(v) => {
                      setAuthMode(v);
                      setAuthErr("");
                    }}
                  />
                  {authMode === "create" && (
                    <div className="warnbox" role="note">
                      <b>No email is required, so no recovery is possible.</b> If you lose your password, this account cannot be recovered.
                      You can link an email later to enable recovery.
                    </div>
                  )}
                  <form className="authform" onSubmit={doAuth}>
                    <Field id="auth-name" label={authMode === "create" ? "Choose a username" : "Username (or linked email)"}>
                      <input
                        id="auth-name"
                        type="text"
                        value={authName}
                        autoComplete="username"
                        maxLength={80}
                        onChange={(e) => setAuthName(e.target.value)}
                      />
                    </Field>
                    <Field id="auth-pass" label="Password">
                      <input
                        id="auth-pass"
                        type="password"
                        value={authPass}
                        autoComplete={authMode === "create" ? "new-password" : "current-password"}
                        maxLength={100}
                        onChange={(e) => setAuthPass(e.target.value)}
                      />
                    </Field>
                    <div className="row">
                      <button className="btn primary" type="submit" disabled={authBusy || !authName.trim() || !authPass}>
                        {authBusy ? "Working" : authMode === "create" ? "Create account" : "Sign in"}
                      </button>
                      {authMode === "signin" && (
                        <button className="btn ghost" type="button" onClick={doForgot} disabled={authBusy}>
                          Forgot password
                        </button>
                      )}
                    </div>
                    <p className="empty" role="status" aria-live="polite">
                      {authErr}
                    </p>
                  </form>
                </section>
              ) : (
                <>
                  {recoveryMode && (
                    <section className="aboutblock">
                      <h2 className="abouthead">Set a new password</h2>
                      <form className="authform" onSubmit={doSetNewPassword}>
                        <Field id="new-pass" label="New password">
                          <input
                            id="new-pass"
                            type="password"
                            value={newPass}
                            autoComplete="new-password"
                            maxLength={100}
                            onChange={(e) => setNewPass(e.target.value)}
                          />
                        </Field>
                        <div className="row">
                          <button className="btn primary" type="submit" disabled={authBusy || !newPass}>
                            {authBusy ? "Working" : "Save new password"}
                          </button>
                          <p className="empty" role="status" aria-live="polite">
                            {authErr}
                          </p>
                        </div>
                      </form>
                    </section>
                  )}
                  <section className="aboutblock">
                    <h2 className="abouthead">Account</h2>
                    <p className="note">
                      Signed in as <b className="unamechip">{uname}</b>. Your Bank and chord-change records sync to this account
                      automatically.
                    </p>
                    <div className="row">
                      <button className="btn ghost danger" onClick={doSignOut}>
                        Sign out
                      </button>
                    </div>
                  </section>
                  <section className="aboutblock">
                    <h2 className="abouthead">Account recovery</h2>
                    {linkedEmail ? (
                      <p className="note">
                        Recovery email linked: <b>{linkedEmail}</b>. Sign in with this address. If you lose your password, use Forgot
                        password on the sign-in screen to reset it by email.
                      </p>
                    ) : authUser.new_email ? (
                      <p className="note">
                        Email change pending for <b>{authUser.new_email}</b>. Click the link in that email to complete it. Until then, keep
                        signing in with your username.
                      </p>
                    ) : (
                      <>
                        <p className="note">
                          No email is linked, so this account cannot be recovered if the password is lost. Linking is optional. Once
                          confirmed, you sign in with the address instead of your username, and password reset by email becomes available.
                        </p>
                        <form className="authform" onSubmit={doLinkEmail}>
                          <Field id="link-email" label="Email address">
                            <input
                              id="link-email"
                              type="email"
                              value={linkEmail}
                              autoComplete="email"
                              maxLength={120}
                              onChange={(e) => setLinkEmail(e.target.value)}
                            />
                          </Field>
                          <div className="row">
                            <button className="btn" type="submit" disabled={linkState === "busy" || !linkEmail.trim()}>
                              {linkState === "busy" ? "Sending" : "Link email"}
                            </button>
                            <p className={linkState === "err" ? "empty" : "note"} role="status" aria-live="polite">
                              {linkState === "sent"
                                ? "Confirmation requested. If the email arrives, click its link to complete the change."
                                : linkState === "err"
                                  ? linkErrMsg
                                  : ""}
                            </p>
                          </div>
                        </form>
                      </>
                    )}
                  </section>
                </>
              )}
            </div>
          )}
        </main>
      </div>

      {tour >= 0 &&
        (() => {
          const step = tourSteps[tour];
          const pad = 6;
          const spot = tourRect
            ? { left: tourRect.x - pad, top: tourRect.y - pad, width: tourRect.w + pad * 2, height: tourRect.h + pad * 2 }
            : null;
          const vw = typeof window !== "undefined" ? window.innerWidth : 1000;
          const vh = typeof window !== "undefined" ? window.innerHeight : 800;
          const CARD_H = 214;
          const CARD_W = 320;
          let cardStyle;
          if (!spot || spot.height > vh * 0.7) {
            /* full-height or missing target: centre the card, drawer stays highlighted behind */
            cardStyle = { top: "50%", left: "50%", transform: "translate(-50%,-50%)" };
          } else {
            const placeBelow = vh - (spot.top + spot.height) > CARD_H + 24;
            const top = placeBelow ? spot.top + spot.height + 12 : Math.max(12, spot.top - CARD_H - 12);
            const left = Math.max(12, Math.min(spot.left, vw - CARD_W - 12));
            cardStyle = { top, left };
          }
          return (
            <div className="tour" role="dialog" aria-modal="true" aria-label="Guided tour">
              <div
                className="tourscrim"
                onClick={(e) => {
                  /* clicking the highlighted control should not dismiss the tour */
                  if (
                    spot &&
                    e.clientX >= spot.left &&
                    e.clientX <= spot.left + spot.width &&
                    e.clientY >= spot.top &&
                    e.clientY <= spot.top + spot.height
                  )
                    return;
                  endTour();
                }}
              />
              {spot && <div className="tourspot" style={spot} />}
              <div className="tourcard" style={cardStyle} ref={tourCardRef} tabIndex={-1}>
                <p className="tourstep">
                  Step {tour + 1} of {tourSteps.length}
                </p>
                <h3 className="tourtitle">{step.title}</h3>
                <p className="tourbody">{step.body}</p>
                <div className="tourbtns">
                  <button className="btn ghost" onClick={endTour}>
                    Skip
                  </button>
                  <span className="actspacer" />
                  {tour > 0 && (
                    <button className="btn ghost" onClick={() => setTour((t) => t - 1)}>
                      Back
                    </button>
                  )}
                  {tour < tourSteps.length - 1 ? (
                    <button className="btn primary" onClick={() => setTour((t) => t + 1)}>
                      Next
                    </button>
                  ) : (
                    <button className="btn primary" onClick={endTour}>
                      Done
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}

      {celebrate && (
        <div className="celebrate" role="status" onClick={() => setCelebrate(null)}>
          <div className="celebratecard">
            <svg className="celebratemedal" viewBox="0 0 24 24" width="52" height="52" aria-hidden="true">
              <path d="M12 2.5l2.7 5.9 6.3.6-4.8 4.3 1.4 6.2L12 16.9 6.2 19.5l1.4-6.2L2.8 9l6.3-.6z" />
            </svg>
            {celebrate.type === "level" ? (
              <>
                <b>Level {celebrate.level}</b>
                <span>Nicely done, keep going</span>
              </>
            ) : celebrate.type === "badge" ? (
              <>
                <b>Badge earned</b>
                <span>
                  {celebrate.name}
                  {celebrate.tiers > 1 ? ` · level ${celebrate.tier}` : ""}
                </span>
              </>
            ) : (
              <>
                <b>{celebrate.count} badges earned</b>
                <span>What a run</span>
              </>
            )}
          </div>
        </div>
      )}

      {routine &&
        routine.phase === "running" &&
        (() => {
          const seg = routine.segments[routine.idx];
          const mm = Math.floor(routine.remaining / 60);
          const ss = String(routine.remaining % 60).padStart(2, "0");
          return (
            <div className="routinehud" role="region" aria-label="Practice routine in progress">
              <div className="rhud-main">
                <b>{seg && seg.item.label}</b>
                <span>{seg && seg.stretch ? "Stretch · something new" : `Step ${routine.idx + 1} of ${routine.segments.length}`}</span>
              </div>
              <div className="rhud-time" aria-label={`${mm} minutes ${routine.remaining % 60} seconds left`}>
                {mm}:{ss}
              </div>
              <button className="btn ghost" onClick={routineNext}>
                {routine.idx + 1 >= routine.segments.length ? "Finish" : "Next"}
              </button>
              <button
                className="btn ghost danger"
                onClick={() => {
                  setRoutine(null);
                }}
              >
                Stop
              </button>
            </div>
          );
        })()}

      {routine && routine.phase === "rate" && (
        <div className="celebrate" role="dialog" aria-label="Rate your practice">
          <div className="celebratecard">
            <b>How did that feel?</b>
            <span>Your rating shapes the next routine</span>
            <div className="ratestars">
              {[
                { s: 1, l: "Shaky" },
                { s: 2, l: "Getting there" },
                { s: 3, l: "Solid" },
              ].map((o) => (
                <button
                  key={o.s}
                  className="ratestar"
                  onClick={() => rateRoutine(o.s)}
                  aria-label={`${o.l}, ${o.s} star${o.s > 1 ? "s" : ""}`}
                >
                  <span aria-hidden="true">{"★".repeat(o.s)}</span>
                  <em>{o.l}</em>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   STYLES
   ============================================================ */
