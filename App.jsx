import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { pluck } from "./audio.js";
import { findVoicings } from "./voicings.js";
import {
  DEG,
  nameOf,
  keyPrefersFlats,
  SCALES,
  CHORDS,
  TUNINGS,
  PRACTICE_MODES,
  localDay,
  parseTab,
  MINOR_STARTS,
  ROMAN,
  PROGRESSIONS,
  SIMPLE_PROGS,
  SIMPLE_HIDDEN,
  CAT_OF,
  MEL_SLOTS,
  MEL_MAX_BARS,
  simpleList,
  TIME_SIGS,
  SCALE_ORDER,
  CHORD_ORDER,
} from "./theory.js";
import { useGeometry, Fretboard, ChordDiagram } from "./fretboard.jsx";
import { VIEW_META, pathForMode, modeForPath } from "./lib/routing.js";
import { track } from "./lib/analytics.js";
import { store } from "./lib/store.js";
import { supabase } from "./lib/supabase.js";
import { ToastProvider, useToast } from "./state/ToastContext.jsx";
import { SettingsProvider, useSettings } from "./state/SettingsContext.jsx";
import { AuthSyncProvider, useAuthSync } from "./state/AuthSyncContext.jsx";
import { LibraryProvider, useLibrary } from "./state/LibraryContext.jsx";
import { ProgressProvider, useProgress } from "./state/ProgressContext.jsx";
import { SelectionProvider, useSelection } from "./state/SelectionContext.jsx";
import { PlaybackProvider, usePlayback } from "./state/PlaybackContext.jsx";
import { FaqView } from "./views/FaqView.jsx";
import { SettingsView } from "./views/SettingsView.jsx";
import { PracticeLogView } from "./views/PracticeLogView.jsx";
import { AboutView } from "./views/AboutView.jsx";
import { AccountView } from "./views/AccountView.jsx";
import { TunerView } from "./views/TunerView.jsx";
import { FretboardProvider, useFretboardConfig } from "./state/FretboardContext.jsx";
import { ReadoutProvider, useReadout } from "./state/ReadoutContext.jsx";
import { IntervalView } from "./views/IntervalView.jsx";
import { ScaleView } from "./views/ScaleView.jsx";
import { ArpView } from "./views/ArpView.jsx";
import { ChordView } from "./views/ChordView.jsx";
import { FinderView } from "./views/FinderView.jsx";
import { QuizView } from "./views/QuizView.jsx";
import { EarView } from "./views/EarView.jsx";
import { ChangesView } from "./views/ChangesView.jsx";
import { StrumView } from "./views/StrumView.jsx";
import { BankView } from "./views/BankView.jsx";
import { RoutineView } from "./views/RoutineView.jsx";
import { Seg } from "./components/Seg.jsx";
import { Field } from "./components/Field.jsx";
import { KeyPicker } from "./components/KeyPicker.jsx";
import { CatPicker } from "./components/CatPicker.jsx";
import { HeadIcon } from "./components/HeadIcon.jsx";

/* ============================================================
   SMALL UI PIECES
   ============================================================ */

/* ============================================================
   BANK: star-save and sharing helpers
   ============================================================ */

/* ============================================================
   ABOUT: resources, feedback, donate
   ============================================================ */

/* ============================================================
   ACCOUNTS: username-only auth over Supabase
   ============================================================ */

/* ============================================================
   APP
   ============================================================ */

function App() {
  const { settings, setSettings, capo, setCapo, midis, n, fretCount, settingsHydrated } = useSettings();
  /* the remaining storage slices hydrated by the effect below; combined with
     the provider's flag so every existing `loaded` reader keeps its meaning */
  const [restLoaded, setRestLoaded] = useState(false);
  const {
    bank,
    setBank,
    known,
    routineRatings,
    customProgs,
    setCustomProgs,
    melodies,
    setMelodies,
    chgRecords,
    setChgRecords,
    saveToBank,
    saveCustomProgs,
    saveMelodies,
    saveRoutineRatings,
    libraryHydrated,
  } = useLibrary();
  const {
    setGamify,
    practiceLog,
    setPracticeLog,
    celebrate,
    setCelebrate,
    practiceStats,
    lastActiveRef,
    savePracticeLog,
    progressHydrated,
  } = useProgress();
  const loaded = restLoaded && settingsHydrated && libraryHydrated && progressHydrated;
  const { authUser, uname, setProgressSynced, recoveryMode, syncField } = useAuthSync();
  const [mode, setMode] = useState(() => {
    if (typeof window === "undefined") return "chord";
    /* a share link (#s=...) resolves its own view after hydration */
    if (/^#s=/.test(window.location.hash || "")) return "chord";
    return modeForPath(window.location.pathname) || "chord";
  });
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
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
  const { toast, setToast } = useToast();
  const {
    scaleRoot,
    setScaleRoot,
    scaleId,
    setScaleId,
    chordRoot,
    setChordRoot,
    chordId,
    setChordId,
    setChordArea,
    arpRoot,
    setArpRoot,
    arpId,
    setArpId,
    ivRoot,
    setIvRoot,
    ivOn,
    setIvOn,
    restorePosRef,
    restoreVoiceRef,
    setPosNonce,
  } = useSelection();
  const {
    progPlaying,
    setProgPlaying,
    melPlayIdx,
    setMelPlayIdx,
    metroOn,
    setMetroOn,
    beat,
    playTimers,
    melLoopRef,
    playMelodyRef,
    playNote,
    stopPlayback,
  } = usePlayback();

  /* prog's neck label until ProgView owns its own; Chord's label moved with it */
  const [chordLabel] = useState("finger");

  const [progRoot, setProgRoot] = useState(0);
  const [progId, setProgId] = useState("p1564");
  const [progIdx, setProgIdx] = useState(0);
  const [builder, setBuilder] = useState({ bars: [], name: "", sections: {} });
  const [builderKeyQual, setBuilderKeyQual] = useState("major"); // major/minor, for the "add by chord name" picker

  const [melSteps, setMelSteps] = useState([]); // [{s, f}]
  const [melName, setMelName] = useState("");
  const [melImport, setMelImport] = useState(false);
  const [melImportText, setMelImportText] = useState("");
  const [melRate, setMelRate] = useState(2); // slots per beat on playback (2 = eighths)
  const [melBars, setMelBars] = useState(2); // timeline length in bars
  const [melCursor, setMelCursor] = useState(0); // slot the next tapped note lands on
  const [melLoop, setMelLoop] = useState(false); // repeat the melody until Stop

  /* "things you know": items the player has marked with the lightbulb, plus the
     last star rating a practice routine gave each, which weights future routines.
     routineDur (the length picker) lives in RoutineView; the runner state stays
     here because its HUD floats over whichever view the routine is stepping through */
  const [routine, setRoutine] = useState(null); // null | { phase:'running'|'rate', segments:[{item,seconds,stretch}], idx, remaining, duration }

  const [flash, setFlash] = useState(null);
  /* the active view can publish the neck's per-mode config; null = use the
     shell fallbacks below (still in place until every fretboard view is moved) */
  const fbConfig = useFretboardConfig();
  /* the active view's readout line, if it publishes one; else the shell falls
     back to the mode-branching memo below (still in place for the views whose
     readout reads only shared Selection state) */
  const publishedReadout = useReadout();

  /* one-minute chord change trainer */

  const modeRef = useRef("chord");
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

  /* Give each in-app view its own browser tab and history title. The default
     landing (chord) keeps the keyword-rich homepage title so search results are
     not weakened; other views read "<View> · Fretwork". */
  useEffect(() => {
    if (typeof document === "undefined") return;
    const m = VIEW_META[mode];
    document.title =
      mode === "chord" ? "Fretwork: Guitar Fretboard Trainer for Scales and Chords" : m ? `${m.title} · Fretwork` : "Fretwork";
  }, [mode]);

  /* password recovery: the provider raises the flag, the shell navigates
     (sanctioned split #2 in docs/REFACTOR-BLUEPRINT.md) */
  useEffect(() => {
    if (recoveryMode) setMode("account");
  }, [recoveryMode]);

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

  /* quiz stats now hydrate inside QuizView, so nothing else blocks first paint */
  useEffect(() => {
    setRestLoaded(true);
  }, []);

  /* one-shot position restore for Bank opens: the reset effects below clear
     scale/arp position on any scale change, so a bank open stashes the wanted
     position here and bumps the nonce to let the matching effect apply it. */
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
        restorePosRef.current = { kind: "arp", pos: item.pos == null ? null : item.pos, dir: item.dir };
        setPosNonce((k) => k + 1);
        setArpRoot(item.root);
        setArpId(item.arpId);
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
    [customProgs, setCapo, restorePosRef, restoreVoiceRef, setChordArea, setChordId, setChordRoot, setPosNonce, setScaleId, setScaleRoot],
  );

  const rowToString = useCallback((r) => (settings.highOnTop ? n - 1 - r : r), [n, settings.highOnTop]);
  const geo = useGeometry(fretCount, n, settings.zoom, settings.leftHanded);

  const scaleDef = SCALES.find((s) => s.id === scaleId) || SCALES[0];

  /* One position per scale degree that falls on the lowest string, four frets
     wide. For a pentatonic this reproduces the five familiar boxes; for a
     seven note scale it gives the seven three-note-per-string shapes. Derived
     from the tuning, so it holds up in any tuning. */
  const chordDef = CHORDS.find((c) => c.id === chordId) || CHORDS[0];
  const arpDef = CHORDS.find((c) => c.id === arpId) || CHORDS[0];

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
  }, [lastActiveRef, savePracticeLog, setPracticeLog]);

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
    [melSteps, fretCount, setToast],
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
  const effFlats = useMemo(() => {
    if (settings.noteNames === "sharps") return false;
    if (settings.noteNames === "flats") return true;
    if (mode === "scale") return keyPrefersFlats(scaleRoot, scaleDef.iv);
    if (mode === "chord" || mode === "bank") return keyPrefersFlats(chordRoot, chordDef.iv);
    if (mode === "arp") return keyPrefersFlats(arpRoot, arpDef.iv);
    if (mode === "prog") return keyPrefersFlats(progRoot, progDef.tonality === "minor" ? [3] : [4]);
    if (mode === "interval") return keyPrefersFlats(ivRoot, ivOn);
    if (mode === "melody") return melKeyHint ? keyPrefersFlats(melKeyHint.root, [0, 2, 4, 5, 7, 9, 11]) : false;
    return false;
  }, [settings.noteNames, mode, scaleRoot, scaleDef, chordRoot, chordDef, progRoot, progDef, ivRoot, ivOn, melKeyHint, arpRoot, arpDef]);

  const activeProgVoicing = progVoicings[Math.min(progIdx, progVoicings.length - 1)] || null;

  const marks = useMemo(() => {
    const map = new Map();
    const add = (s, f, pc, semis, tone, state, finger) => {
      map.set(`${s}:${f}`, { pc, semis, tone, state: state || "on", finger: finger == null ? null : finger });
    };

    if (mode === "prog" && activeProg && activeProgVoicing) {
      for (let s2 = 0; s2 < n; s2++) {
        const f = activeProgVoicing.frets[s2];
        if (f === null) continue;
        const pc = (midis[s2] + f) % 12;
        add(s2, f, pc, (pc - activeProg.rootPc + 24) % 12, "chord", null, activeProgVoicing.fingering[s2]);
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

    return map;
  }, [mode, midis, n, activeProg, activeProgVoicing, melSteps, melPlayIdx, melCursor, melKeyHint]);

  /* ---- quiz ---- */
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
      /* every other fretboard view either publishes its own onCell or just wants
         the note sounded; the quiz scoring handler now lives in QuizView */
      playNote(midi);
    },
    [mode, capo, playNote, melCursor, melBars],
  );

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 480);
    return () => clearTimeout(t);
  }, [flash]);

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
    [settings.midis.length, fretCount, stopPlayback, setToast],
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
  }, [doImportTab, setToast]);

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
  }, [stopPlayback, settings.bpm, settings.beats, progChords, progVoicings, midis, n, playNote, playTimers, setProgPlaying]);

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
  }, [melSteps, melBars, settings.bpm, settings.midis, melRate, playNote, melLoopRef, playMelodyRef, playTimers, setMelPlayIdx]);
  useEffect(() => {
    playMelodyRef.current = scheduleMelody;
  }, [scheduleMelody, playMelodyRef]);

  const playMelody = useCallback(() => {
    stopPlayback();
    if (!melSteps.some((st) => st && !st.rest)) return;
    melLoopRef.current = melLoop;
    scheduleMelody();
  }, [stopPlayback, scheduleMelody, melLoop, melSteps, melLoopRef]);

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
  }, [buildShareLink, mode, setToast]);

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
    stopPlayback();
  }, [mode, scaleId, scaleRoot, chordId, chordRoot, capo, progId, progRoot, arpRoot, arpId, melSteps, stopPlayback]);

  /* ---- readout ---- */
  const readout = useMemo(() => {
    if (mode === "scale") return `${nameOf(scaleRoot, effFlats)} ${scaleDef.name} · ${scaleDef.iv.length} notes`;
    if (mode === "prog") return `${nameOf(progRoot, effFlats)} \u00b7 ${progDef.name} \u00b7 ${progDef.bars.length} bars`;
    if (mode === "bank") return `Bank \u00b7 ${bank.length} saved`;
    if (mode === "interval")
      return `${nameOf(ivRoot, effFlats)} root · ${[...ivOn]
        .sort((a, b) => a - b)
        .map((i) => DEG[i])
        .join(" ")}`;
    if (mode === "about") return "About";
    if (mode === "faq") return "FAQ";
    if (mode === "melody") {
      const nn = melSteps.filter((s) => s && !s.rest).length;
      return `Melody \u00b7 ${nn} ${nn === 1 ? "note" : "notes"}`;
    }
    if (mode === "arp") return `${nameOf(arpRoot, effFlats)}${arpDef.suffix || ""} arpeggio \u00b7 ${arpDef.iv.length} tones`;
    if (mode === "plog") return `Practice log \u00b7 ${practiceStats.streak} day streak`;
    if (mode === "routine") return `Practice routine \u00b7 ${known.length} known`;
    if (mode === "settings") return "Settings";
    if (mode === "tuner") {
      const t = TUNINGS.find((x) => x.id === settings.tuningId);
      return `Tuner \u00b7 ${t ? t.name : "Custom"}`;
    }
    if (mode === "account") return authUser ? `Account · ${uname}` : "Create an account";
    /* Quiz and the other view-local readouts publish their own line through the
       readout slot; the shell only reaches here for modes without a branch */
    return "";
  }, [
    mode,
    scaleRoot,
    scaleDef,
    chordRoot,
    chordDef,
    ivRoot,
    ivOn,
    effFlats,
    progRoot,
    progDef,
    bank.length,
    authUser,
    uname,
    settings.tuningId,
    melSteps,
    arpRoot,
    arpDef,
    practiceStats.streak,
    known.length,
  ]);

  const setTuning = (id) => {
    const t = TUNINGS.find((x) => x.id === id);
    if (!t) return;
    setSettings((s) => ({ ...s, tuningId: id, midis: t.midi }));
    if (id !== "std" && id !== "custom") {
      setGamify((g) => (g.counters.tunings.includes(id) ? g : { ...g, counters: { ...g.counters, tunings: [...g.counters.tunings, id] } }));
    }
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
  const gotoSegment = useCallback(
    (item) => {
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
    },
    [setArpId, setArpRoot, setChordId, setChordRoot, setScaleId, setScaleRoot],
  );

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

  const buildRoutine = (dur) => {
    if (!known.length) return;
    stopPlayback();
    const totalSec = dur * 60;
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
    track("routine_start", { minutes: dur, items: segments.length });
    setRoutine({ phase: "running", segments, idx: 0, remaining: segments[0].seconds, duration: dur });
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
    saveRoutineRatings(next);
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
  }, [setGamify]);
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
            {publishedReadout != null ? publishedReadout : readout}
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
                capo={capo}
                onCapo={setCapo}
                flash={flash}
                marks={fbConfig ? fbConfig.marks : marks}
                onCell={fbConfig ? fbConfig.onCell : onCell}
                flats={fbConfig ? fbConfig.flats : effFlats}
                labelMode={fbConfig ? fbConfig.labelMode : mode === "prog" ? chordLabel : settings.labelMode}
                colourMode={fbConfig ? fbConfig.colourMode : mode === "interval" ? "interval" : settings.colourMode}
                barre={
                  fbConfig
                    ? fbConfig.barre
                    : (() => {
                        const v = mode === "prog" ? activeProgVoicing : null;
                        return v && v.barreFret != null ? { fret: v.barreFret, from: v.barreFrom, to: v.barreTo } : null;
                      })()
                }
                ghosts={fbConfig ? fbConfig.ghosts : null}
                quizRange={fbConfig ? fbConfig.quizRange : undefined}
                quizActive={fbConfig ? fbConfig.quizActive : false}
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
          {mode === "scale" && <ScaleView carryKey={carryKey} />}

          {mode === "chord" && <ChordView carryKey={carryKey} />}

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

          {mode === "bank" && <BankView onOpen={openBankItem} />}

          {mode === "interval" && <IntervalView />}

          {mode === "quiz" && <QuizView setFlash={setFlash} />}

          {mode === "changes" && <ChangesView />}

          {mode === "about" && (
            <AboutView
              onNavigate={(m) => {
                setMode(m);
                setOpenPanel(null);
              }}
              onStartTour={() => {
                setMode("chord");
                startTour();
              }}
            />
          )}

          {mode === "faq" && (
            <FaqView
              onNavigate={(m) => {
                setMode(m);
                setOpenPanel(null);
              }}
            />
          )}

          {mode === "arp" && <ArpView carryKey={carryKey} />}

          {mode === "routine" && <RoutineView onBuild={buildRoutine} />}

          {mode === "strum" && <StrumView />}

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

          {mode === "ear" && <EarView />}

          {mode === "plog" && <PracticeLogView />}

          {mode === "finder" && <FinderView onNavigate={setMode} />}

          {mode === "tuner" && <TunerView />}

          {mode === "settings" && <SettingsView />}

          {mode === "account" && <AccountView />}
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

/* Providers wrap the shell in the blueprint nesting order; each context lands
   here as it is extracted (see docs/REFACTOR-BLUEPRINT.md). */
export default function FretworkApp() {
  return (
    <ToastProvider>
      <SettingsProvider>
        <AuthSyncProvider>
          <LibraryProvider>
            <ProgressProvider>
              <SelectionProvider>
                <PlaybackProvider>
                  <FretboardProvider>
                    <ReadoutProvider>
                      <App />
                    </ReadoutProvider>
                  </FretboardProvider>
                </PlaybackProvider>
              </SelectionProvider>
            </ProgressProvider>
          </LibraryProvider>
        </AuthSyncProvider>
      </SettingsProvider>
    </ToastProvider>
  );
}
