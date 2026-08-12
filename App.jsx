import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { ctx, pluck, playClick, blip } from "./audio.js";
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
  TIME_SIGS,
  FUNC_COLOUR,
  SCALE_ORDER,
  CHORD_ORDER,
} from "./theory.js";
import { useGeometry, Fretboard, ChordDiagram } from "./fretboard.jsx";
import { VIEW_META, pathForMode, modeForPath } from "./lib/routing.js";
import { track } from "./lib/analytics.js";
import { shareLinkFromParams } from "./lib/share.js";
import { groupItems } from "./lib/utils.js";
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
import { IntervalView } from "./views/IntervalView.jsx";
import { CHORD_GROUPS, SCALE_GROUPS } from "./data/groups.js";
import { Seg } from "./components/Seg.jsx";
import { Field } from "./components/Field.jsx";
import { IntervalGrid } from "./components/IntervalGrid.jsx";
import { KeyPicker } from "./components/KeyPicker.jsx";
import { CatPicker } from "./components/CatPicker.jsx";
import { DualRange } from "./components/DualRange.jsx";
import { StarSave, KnownButton } from "./components/SaveButtons.jsx";
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
  const { settings, setSettings, capo, setCapo, midis, n, fretCount, flatsFor, settingsHydrated } = useSettings();
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
    saveBank,
    toggleKnown,
    saveToBank,
    saveCustomProgs,
    saveMelodies,
    saveChgRecords,
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
  const [scalePos, setScalePos] = useState(null);
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
    voiceIdx,
    setVoiceIdx,
    chordArea,
    setChordArea,
    ivRoot,
    setIvRoot,
    ivOn,
    setIvOn,
    toggleIv,
    restorePosRef,
    restoreVoiceRef,
    posNonce,
    setPosNonce,
  } = useSelection();
  const {
    playing,
    setPlaying,
    progPlaying,
    setProgPlaying,
    melPlayIdx,
    setMelPlayIdx,
    strumOn,
    setStrumOn,
    strumStep,
    setStrumStep,
    metroOn,
    setMetroOn,
    beat,
    playTimers,
    strumLoopRef,
    scheduleStrumRef,
    melLoopRef,
    playMelodyRef,
    playNote,
    stopPlayback,
  } = usePlayback();

  const [scaleLabel, setScaleLabel] = useState("name");

  const [arpRoot, setArpRoot] = useState(0);
  const [arpId, setArpId] = useState("maj");
  const [arpDir, setArpDir] = useState("up");
  const [arpPos, setArpPos] = useState(null);
  const [arpLabel, setArpLabel] = useState("name");

  const [showAllTones, setShowAllTones] = useState(true);
  const [chordLabel, setChordLabel] = useState("finger");

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
  const [strumPatId, setStrumPatId] = useState("oldfaithful");
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

  /* "things you know": items the player has marked with the lightbulb, plus the
     last star rating a practice routine gave each, which weights future routines */
  const [routineDur, setRoutineDur] = useState(10); // minutes
  const [routine, setRoutine] = useState(null); // null | { phase:'running'|'rate', segments:[{item,seconds,stretch}], idx, remaining, duration }

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
  /* the active view can publish the neck's per-mode config; null = use the
     shell fallbacks below (still in place until every fretboard view is moved) */
  const fbConfig = useFretboardConfig();

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
  const [chgEntry, setChgEntry] = useState("");

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

  /* persisted state */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await store.get("fretboard:stats");
        if (!cancelled && r && r.value) {
          const v = JSON.parse(r.value);
          setQuiz((q) => ({ ...q, correct: v.correct || 0, wrong: v.wrong || 0, best: v.best || 0, rounds: v.rounds || 0 }));
        }
      } catch (e) {
        /* no stats yet */
      }
      if (!cancelled) setRestLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveStats = useCallback((q) => {
    store.set("fretboard:stats", JSON.stringify({ correct: q.correct, wrong: q.wrong, best: q.best, rounds: q.rounds })).catch(() => {});
  }, []);

  const shareBankItem = useCallback(
    async (item) => {
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
    },
    [setToast],
  );

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
    [customProgs, setCapo, restorePosRef, restoreVoiceRef, setChordArea, setChordId, setChordRoot, setPosNonce, setScaleId, setScaleRoot],
  );

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
  }, [scaleId, scaleRoot, settings.tuningId, capo, fretCount, posNonce, restorePosRef]);
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
  }, [arpId, arpRoot, settings.tuningId, capo, fretCount, posNonce, restorePosRef]);
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
  }, [chordAreas, chordArea, setChordArea]);

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

  const activeProgVoicing = progVoicings[Math.min(progIdx, progVoicings.length - 1)] || null;

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
  }, [
    strumPatId,
    settings.bpm,
    settings.clickSound,
    settings.sound,
    strumClick,
    strumChord,
    playTimers,
    scheduleStrumRef,
    setStrumStep,
    strumLoopRef,
  ]);
  useEffect(() => {
    scheduleStrumRef.current = scheduleStrumCycle;
  }, [scheduleStrumCycle, scheduleStrumRef]);

  const playStrum = useCallback(() => {
    if (!activeVoicing) return;
    stopPlayback();
    setStrumOn(true);
    strumLoopRef.current = true;
    scheduleStrumCycle();
  }, [activeVoicing, stopPlayback, scheduleStrumCycle, setStrumOn, strumLoopRef]);

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
  }, [scaleDef, scaleRoot, midis, playNote, stopPlayback, scalePos, positions, positionsFor, playTimers, setPlaying]);

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
  }, [stopPlayback, midis, arpRoot, arpDef, arpDir, settings.bpm, playNote, arpPos, arpPositions, positionsFor, playTimers, setPlaying]);

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
    [ear.source, lastActiveRef],
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
    [ear, settings.sound, setGamify],
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
    saveChgRecords(next);
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
  }, [chgEntry, chg.chords, chg.duration, chgRecords, saveChgRecords, setToast, setGamify]);

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
    [setChordId, setChordRoot, setScaleId, setScaleRoot],
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
                capo={capo}
                onCapo={setCapo}
                flash={flash}
                marks={fbConfig ? fbConfig.marks : marks}
                onCell={fbConfig ? fbConfig.onCell : onCell}
                flats={fbConfig ? fbConfig.flats : effFlats}
                labelMode={
                  fbConfig
                    ? fbConfig.labelMode
                    : mode === "chord" || mode === "prog"
                      ? chordLabel
                      : mode === "scale"
                        ? scaleLabel
                        : mode === "arp"
                          ? arpLabel
                          : settings.labelMode
                }
                colourMode={fbConfig ? fbConfig.colourMode : mode === "interval" ? "interval" : settings.colourMode}
                barre={
                  fbConfig
                    ? fbConfig.barre
                    : (() => {
                        const v = mode === "chord" ? activeVoicing : mode === "prog" ? activeProgVoicing : null;
                        return v && v.barreFret != null ? { fret: v.barreFret, from: v.barreFrom, to: v.barreTo } : null;
                      })()
                }
                ghosts={fbConfig ? fbConfig.ghosts : ghosts}
                quizRange={fbConfig ? fbConfig.quizRange : quiz.range}
                quizActive={fbConfig ? fbConfig.quizActive : mode === "quiz"}
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

          {mode === "interval" && <IntervalView />}

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

          {mode === "plog" && <PracticeLogView />}

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
                    <App />
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
