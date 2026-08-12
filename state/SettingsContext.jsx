import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { TUNINGS, keyPrefersFlats } from "../theory.js";
import { store } from "../lib/store.ts";

/* Settings, appearance and instrument state: the user's preferences plus what
   the neck physically is (tuning/midis, fret count, capo). Owns its own
   hydration and debounced persistence for "fretboard:settings". */

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

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  /* start brand-new visitors in Simple mode (no settings saved yet). Read
     synchronously so a mount-time persist cannot mask first run. */
  const [settings, setSettings] = useState(() => {
    const firstRun = typeof window !== "undefined" && !window.localStorage.getItem("fretboard:settings");
    return firstRun ? { ...DEFAULT_SETTINGS, simple: true } : DEFAULT_SETTINGS;
  });
  const [capo, setCapo] = useState(0);
  const [settingsHydrated, setSettingsHydrated] = useState(false);

  /* hydrate from storage once */
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
      if (!cancelled) setSettingsHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* debounced persist, only after hydration so defaults never clobber storage */
  useEffect(() => {
    if (!settingsHydrated) return;
    const t = setTimeout(() => {
      store.set("fretboard:settings", JSON.stringify(settings)).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [settings, settingsHydrated]);

  /* derived instrument facts */
  const midis = settings.midis;
  const n = midis.length;
  const fretCount = settings.fretCount;

  /* keep the capo on the neck if the fret count is lowered under it */
  useEffect(() => {
    setCapo((c) => Math.min(c, fretCount));
  }, [fretCount]);

  /* per-item spelling for saved things rendered outside their own key context */
  const flatsFor = useCallback(
    (rootPc, iv) => (settings.noteNames === "auto" ? keyPrefersFlats(rootPc, iv) : settings.noteNames === "flats"),
    [settings.noteNames],
  );

  const value = useMemo(
    () => ({ settings, setSettings, capo, setCapo, midis, n, fretCount, flatsFor, settingsHydrated }),
    [settings, capo, midis, n, fretCount, flatsFor, settingsHydrated],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const v = useContext(SettingsContext);
  if (!v) throw new Error("useSettings must be used inside <SettingsProvider>");
  return v;
}
