import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

/* What is on the neck: the musical material shared between views. Scale
   material feeds Scales and the quiz; chord material feeds Chords, Strumming,
   Progressions, the quiz and the finder; intervals feed Intervals and the
   quiz. The restore refs let Bank restore and share links stash a view-local
   payload (position, exact voicing) that the target view consumes once on
   mount; posNonce forces that consumption even for a same-position restore. */
const SelectionContext = createContext(null);

export function SelectionProvider({ children }) {
  const [scaleRoot, setScaleRoot] = useState(0);
  const [scaleId, setScaleId] = useState("major");
  const [chordRoot, setChordRoot] = useState(0);
  const [chordId, setChordId] = useState("maj");
  const [voiceIdx, setVoiceIdx] = useState(0);
  const [chordArea, setChordArea] = useState(null);
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
  const restorePosRef = useRef(null);
  const restoreVoiceRef = useRef(null); // key of the saved chord shape to reselect on Bank open
  const [posNonce, setPosNonce] = useState(0);

  const value = useMemo(
    () => ({
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
    }),
    [scaleRoot, scaleId, chordRoot, chordId, voiceIdx, chordArea, ivRoot, ivOn, toggleIv, posNonce],
  );
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection() {
  const v = useContext(SelectionContext);
  if (!v) throw new Error("useSelection must be used inside <SelectionProvider>");
  return v;
}
