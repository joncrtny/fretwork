import { createContext, useContext, useState, useCallback, useLayoutEffect, useEffect, type ReactNode } from "react";

/* The neck lives in a fixed shell slot but its contents (which notes light up,
   what a tap does, spelling, labels) are owned by whichever fretboard view is
   active. Rather than the shell branching on `mode`, the active view publishes
   its config here and the shell renders it. This is the blueprint's
   "publish a slot to the shell" pattern applied to the fretboard, so each view
   can own its own marks/onCell/effFlats once extracted. */

/* one dot on the neck, keyed "string:fret" in the marks map */
export interface NeckMark {
  pc: number;
  semis: number;
  tone: string;
  state: string;
  finger: number | null;
  custom?: string;
}

export interface FretboardBarre {
  fret: number;
  from: number;
  to: number;
}

/* the per-mode fields a view owns; Settings-derived props (fretCount, midis,
   geo, capo) stay direct on the shell's <Fretboard>. */
export interface FretboardConfig {
  /* marks is keyed "string:fret" and holds NeckMark values; kept loose (Map)
     so views can build it with new Map() without a generic annotation */
  marks: Map<string, NeckMark> | Map<string, any>;
  onCell: (s: number, f: number, midi: number) => void;
  flats: boolean;
  labelMode: string;
  colourMode: string;
  barre: FretboardBarre | null;
  ghosts: Set<any> | null;
  quizActive: boolean;
  quizRange: number[] | undefined;
}

interface FretboardCtxValue {
  config: FretboardConfig | null;
  publish: (cfg: FretboardConfig | null) => void;
}

const FretboardCtx = createContext<FretboardCtxValue>({ config: null, publish: () => {} });

/* compared by reference, so views must memoise marks/onCell/ghosts (they do) */
const FIELDS: (keyof FretboardConfig)[] = [
  "marks",
  "onCell",
  "flats",
  "labelMode",
  "colourMode",
  "barre",
  "ghosts",
  "quizActive",
  "quizRange",
];
function sameConfig(a: FretboardConfig | null, b: FretboardConfig | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return FIELDS.every((k) => a[k] === b[k]);
}

export function FretboardProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<FretboardConfig | null>(null);
  /* setState bails out when the config is unchanged, so a view publishing on
     every render cannot loop as long as its fields are memoised */
  const publish = useCallback((cfg: FretboardConfig | null) => {
    setConfig((prev) => (sameConfig(prev, cfg) ? prev : cfg));
  }, []);
  return <FretboardCtx.Provider value={{ config, publish }}>{children}</FretboardCtx.Provider>;
}

/* shell: the active view's neck config, or null when no view has published */
export function useFretboardConfig(): FretboardConfig | null {
  return useContext(FretboardCtx).config;
}

/* view: publish this view's neck config while mounted, clear on unmount */
export function usePublishFretboard(config: FretboardConfig): void {
  const { publish } = useContext(FretboardCtx);
  useLayoutEffect(() => {
    publish(config);
  });
  useEffect(() => () => publish(null), [publish]);
}
