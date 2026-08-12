import { createContext, useContext, useState, useCallback, useLayoutEffect, useEffect } from "react";

/* The header readout (the line under the title that summarises what is on
   screen: "C major · 7 notes", "Chord finder · Em", and so on) sits in a fixed
   shell slot, but its text depends on state some views keep to themselves
   (finderInfo, quiz progress, the melody key). Rather than the shell branching
   on `mode` over every view's private state, the active view publishes its line
   here and the shell renders it. Same "publish a slot to the shell" pattern as
   FretboardContext; views whose readout reads only shared Selection state can
   skip it and let the shell's fallback compute the line. */
const ReadoutCtx = createContext(null);

export function ReadoutProvider({ children }) {
  const [text, setText] = useState(null);
  /* bail out when the line is unchanged so a view publishing on every render
     cannot loop; the value is a plain string, compared by ===. */
  const publish = useCallback((next) => {
    setText((prev) => (prev === next ? prev : next));
  }, []);
  return <ReadoutCtx.Provider value={{ text, publish }}>{children}</ReadoutCtx.Provider>;
}

/* shell: the active view's readout line, or null when no view has published */
export function useReadout() {
  return useContext(ReadoutCtx).text;
}

/* view: publish this view's readout while mounted, clear on unmount */
export function usePublishReadout(text) {
  const { publish } = useContext(ReadoutCtx);
  useLayoutEffect(() => {
    publish(text);
  });
  useEffect(() => () => publish(null), [publish]);
}
