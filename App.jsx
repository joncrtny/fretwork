import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  DEG,
  nameOf,
  keyPrefersFlats,
  SCALES,
  CHORDS,
  TUNINGS,
  PRACTICE_MODES,
  localDay,
  ROMAN,
  PROGRESSIONS,
  SIMPLE_HIDDEN,
  CAT_OF,
  MEL_SLOTS,
  MEL_MAX_BARS,
  TIME_SIGS,
} from "./theory.ts";
import { useGeometry, Fretboard } from "./fretboard.jsx";
import { VIEW_META, pathForMode, modeForPath } from "./lib/routing.ts";
import { track } from "./lib/analytics.ts";
import { shareLinkFromParams, decodeShareHash } from "./lib/share.ts";
import { store } from "./lib/store.ts";
import { supabase } from "./lib/supabase.ts";
import { ToastProvider, useToast } from "./state/ToastContext.tsx";
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
import { FretboardProvider, useFretboardConfig } from "./state/FretboardContext.tsx";
import { ReadoutProvider, useReadout } from "./state/ReadoutContext.tsx";
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
import { ProgView } from "./views/ProgView.jsx";
import { MelodyView } from "./views/MelodyView.jsx";
import { TourOverlay } from "./components/TourOverlay.jsx";
import { RoutineHud } from "./components/RoutineHud.jsx";
import { useTour } from "./hooks/useTour.js";
import { useRoutineRunner } from "./hooks/useRoutineRunner.js";
import { Seg } from "./components/Seg.jsx";
import { Field } from "./components/Field.jsx";
import { HeadIcon } from "./components/HeadIcon.jsx";

/* The shell: providers, routing and analytics, the nav and drawer, the
   metronome transport, share-link intake, Supabase sync, and the slot fallbacks
   the two non-publishing views (Bank, Routine) still use. Every actual view is
   its own module under views/; see docs/REFACTOR.md. */
function App() {
  const { settings, setSettings, capo, setCapo, midis, n, fretCount, settingsHydrated } = useSettings();
  /* the remaining storage slices hydrated by the effect below; combined with
     the provider's flag so every existing `loaded` reader keeps its meaning */
  const [restLoaded, setRestLoaded] = useState(false);
  const { bank, setBank, known, customProgs, setCustomProgs, melodies, setMelodies, chgRecords, setChgRecords, libraryHydrated } =
    useLibrary();
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
    progRoot,
    setProgRoot,
    progId,
    setProgId,
    setBuilder,
    melSteps,
    setMelSteps,
    melName,
    setMelName,
    setMelBars,
    ivRoot,
    setIvRoot,
    ivOn,
    setIvOn,
    restorePosRef,
    restoreVoiceRef,
    setPosNonce,
  } = useSelection();
  const { metroOn, setMetroOn, beat, playNote, stopPlayback } = usePlayback();

  /* the practice-routine runner steps the shell through views as it counts each
     segment down; its HUD floats above whatever view is active. The setup screen
     is RoutineView, which builds via the returned buildRoutine(duration). */
  const { routine, buildRoutine, routineNext, rateRoutine, stopRoutine } = useRoutineRunner({ setMode });

  const [flash, setFlash] = useState(null);
  /* the active fretboard view publishes its neck config here; null for the two
     views without a neck of their own (Bank, Routine), which fall back to the
     empty-neck marks/onCell below */
  const fbConfig = useFretboardConfig();
  /* the active view publishes its readout line here; null for Bank and Routine,
     whose readout the shell computes from bank/known counts below */
  const publishedReadout = useReadout();

  const modeRef = useRef("chord");
  const hadShareHashRef = useRef(typeof window !== "undefined" && /^#s=/.test(window.location.hash || ""));
  const { tour, setTour, tourRect, tourRef, tourCardRef, tourSteps, startTour, endTour } = useTour({
    setDrawer,
    setMode,
    setOpenPanel,
    setGamify,
    loaded,
    hadShareHash: hadShareHashRef.current,
  });

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

  /* effective accidental spelling: Auto follows the key of whatever is on screen */
  const effFlats = useMemo(() => {
    if (settings.noteNames === "sharps") return false;
    if (settings.noteNames === "flats") return true;
    if (mode === "scale") return keyPrefersFlats(scaleRoot, scaleDef.iv);
    if (mode === "chord" || mode === "bank") return keyPrefersFlats(chordRoot, chordDef.iv);
    if (mode === "arp") return keyPrefersFlats(arpRoot, arpDef.iv);
    if (mode === "interval") return keyPrefersFlats(ivRoot, ivOn);
    return false;
  }, [settings.noteNames, mode, scaleRoot, scaleDef, chordRoot, chordDef, ivRoot, ivOn, arpRoot, arpDef]);

  /* neck fallback for the non-publishing views (Bank, Routine show an empty
     neck); every fretboard view publishes its own marks through the slot */
  const marks = useMemo(() => new Map(), []);
  const onCell = useCallback(
    (s, f, midi) => {
      if (capo > 0 && f > 0 && f < capo) return;
      playNote(midi);
    },
    [capo, playNote],
  );

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 480);
    return () => clearTimeout(t);
  }, [flash]);

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
    return shareLinkFromParams(p);
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
    if (!/^#s=[A-Za-z0-9_-]+$/.test(window.location.hash || "")) return;
    /* This runs only on share loads, where the [mode] mount effect deliberately
       skips its landing emit. So this effect owns the share view's page_view,
       set from landingMode and fired even if the link is malformed (falls back to
       the current view) so a share load never records zero page_views. */
    let landingMode = mode;
    try {
      const p = decodeShareHash(window.location.hash);
      if (!p) throw new Error("bad share hash");
      const pc = (v) => Number.isInteger(v) && v >= 0 && v < 12;
      if (p.m === "scale" && pc(p.r) && SCALES.some((x) => x.id === p.id)) {
        setScaleRoot(p.r);
        setScaleId(p.id);
        setMode("scale");
        landingMode = "scale";
      } else if (p.m === "arp" && pc(p.r) && CHORDS.some((x) => x.id === p.id)) {
        setArpRoot(p.r);
        setArpId(p.id);
        setMode("arp");
        landingMode = "arp";
      } else if (p.m === "chord" && pc(p.r) && CHORDS.some((x) => x.id === p.id)) {
        setChordRoot(p.r);
        setChordId(p.id);
        setMode("chord");
        landingMode = "chord";
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
        landingMode = "prog";
      } else if (p.m === "interval" && pc(p.r) && Array.isArray(p.iv)) {
        setIvRoot(p.r);
        setIvOn(new Set(p.iv.filter((i) => Number.isInteger(i) && i >= 0 && i < 12)));
        setMode("interval");
        landingMode = "interval";
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
          if (typeof p.nm === "string") setMelName(p.nm.slice(0, 60));
          setMode("melody");
          landingMode = "melody";
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
    firePageView(landingMode);
    /* apply once: land on the shared view's real path and drop the hash, so a
       reload reflects the current view rather than re-applying the link */
    if (window.history && window.history.replaceState)
      window.history.replaceState(null, "", pathForMode(landingMode) + window.location.search);
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
    if (mode === "bank") return `Bank \u00b7 ${bank.length} saved`;
    if (mode === "interval")
      return `${nameOf(ivRoot, effFlats)} root · ${[...ivOn]
        .sort((a, b) => a - b)
        .map((i) => DEG[i])
        .join(" ")}`;
    if (mode === "about") return "About";
    if (mode === "faq") return "FAQ";
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
    bank.length,
    authUser,
    uname,
    settings.tuningId,
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
                labelMode={fbConfig ? fbConfig.labelMode : settings.labelMode}
                colourMode={fbConfig ? fbConfig.colourMode : settings.colourMode}
                barre={fbConfig ? fbConfig.barre : null}
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

          {mode === "prog" && <ProgView onNavigate={setMode} />}

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

          {mode === "melody" && <MelodyView setFlash={setFlash} />}

          {mode === "ear" && <EarView />}

          {mode === "plog" && <PracticeLogView />}

          {mode === "finder" && <FinderView onNavigate={setMode} />}

          {mode === "tuner" && <TunerView />}

          {mode === "settings" && <SettingsView />}

          {mode === "account" && <AccountView />}
        </main>
      </div>

      <TourOverlay tour={tour} setTour={setTour} tourRect={tourRect} tourCardRef={tourCardRef} tourSteps={tourSteps} endTour={endTour} />

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

      <RoutineHud routine={routine} routineNext={routineNext} rateRoutine={rateRoutine} stopRoutine={stopRoutine} />
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
