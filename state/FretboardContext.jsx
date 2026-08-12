import { createContext, useContext, useState, useCallback, useLayoutEffect, useEffect } from "react";

/* The neck lives in a fixed shell slot but its contents (which notes light up,
   what a tap does, spelling, labels) are owned by whichever fretboard view is
   active. Rather than the shell branching on `mode`, the active view publishes
   its config here and the shell renders it. This is the blueprint's
   "publish a slot to the shell" pattern applied to the fretboard, so each view
   can own its own marks/onCell/effFlats once extracted. */
const FretboardCtx = createContext(null);

/* per-mode fields a view owns; Settings-derived props (fretCount, midis, geo,
   capo) stay direct on the shell's <Fretboard>. Compared by reference, so views
   must memoise marks/onCell/ghosts (they already do). */
const FIELDS = ["marks", "onCell", "flats", "labelMode", "colourMode", "barre", "ghosts", "quizActive", "quizRange"];
function sameConfig(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return FIELDS.every((k) => a[k] === b[k]);
}

export function FretboardProvider({ children }) {
  const [config, setConfig] = useState(null);
  /* setState bails out when the config is unchanged, so a view publishing on
     every render cannot loop as long as its fields are memoised */
  const publish = useCallback((cfg) => {
    setConfig((prev) => (sameConfig(prev, cfg) ? prev : cfg));
  }, []);
  return <FretboardCtx.Provider value={{ config, publish }}>{children}</FretboardCtx.Provider>;
}

/* shell: the active view's neck config, or null when no view has published */
export function useFretboardConfig() {
  return useContext(FretboardCtx).config;
}

/* view: publish this view's neck config while mounted, clear on unmount */
export function usePublishFretboard(config) {
  const { publish } = useContext(FretboardCtx);
  useLayoutEffect(() => {
    publish(config);
  });
  useEffect(() => () => publish(null), [publish]);
}
