import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
  type ReactNode,
} from "react";
import { TUNINGS, keyPrefersFlats } from "../theory.ts";
import { store } from "../lib/store.ts";

/* Settings, appearance and instrument state: the user's preferences plus what
   the neck physically is (tuning/midis, fret count, capo). Owns its own
   hydration and debounced persistence for "fretboard:settings". */

export interface Settings {
  fretCount: number;
  tuningId: string;
  midis: number[]; // open-string MIDI notes, low to high
  flats: boolean; // legacy toggle, migrated to noteNames
  noteNames: "auto" | "flats" | "sharps";
  leftHanded: boolean;
  highOnTop: boolean;
  labelMode: string;
  colourMode: string;
  sound: boolean;
  zoom: number;
  bpm: number;
  beats: number;
  clickSound: string;
  accent: string;
  subdiv: string;
  dark: boolean;
  simple: boolean;
  highContrast: boolean;
  lowMotion: boolean;
  span: number;
  inversions: boolean;
  barres: boolean;
}

const DEFAULT_SETTINGS: Settings = {
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

export interface SettingsValue {
  settings: Settings;
  setSettings: Dispatch<SetStateAction<Settings>>;
  capo: number;
  setCapo: Dispatch<SetStateAction<number>>;
  midis: number[];
  n: number;
  fretCount: number;
  flatsFor: (rootPc: number, iv?: Iterable<number>) => boolean;
  settingsHydrated: boolean;
}

const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  /* start brand-new visitors in Simple mode (no settings saved yet). Read
     synchronously so a mount-time persist cannot mask first run. */
  const [settings, setSettings] = useState<Settings>(() => {
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
          const v = JSON.parse(r.value) as Partial<Settings>;
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
    (rootPc: number, iv?: Iterable<number>) => (settings.noteNames === "auto" ? keyPrefersFlats(rootPc, iv) : settings.noteNames === "flats"),
    [settings.noteNames],
  );

  const value = useMemo<SettingsValue>(
    () => ({ settings, setSettings, capo, setCapo, midis, n, fretCount, flatsFor, settingsHydrated }),
    [settings, capo, midis, n, fretCount, flatsFor, settingsHydrated],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const v = useContext(SettingsContext);
  if (!v) throw new Error("useSettings must be used inside <SettingsProvider>");
  return v;
}
