import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
  type MutableRefObject,
  type ReactNode,
} from "react";
import type { MelodyNote } from "../theory.ts";

/* What is on the neck: the musical material shared between views. Scale
   material feeds Scales and the quiz; chord material feeds Chords, Strumming,
   Progressions, the quiz and the finder; intervals feed Intervals and the
   quiz. The restore refs let Bank restore and share links stash a view-local
   payload (position, exact voicing) that the target view consumes once on
   mount; posNonce forces that consumption even for a same-position restore. */

/* a slot on the melody timeline: a note, or a rest */
export type MelodyStep = MelodyNote | { rest: true };

/* the custom-progression editor payload */
export interface ProgBuilder {
  bars: string[]; // roman-numeral keys
  name: string;
  sections: Record<string, string>; // bar index (as string) to section name
}

/* one-shot restore payload a target view consumes on mount (Bank/share) */
export interface RestorePos {
  kind: string;
  pos: number | null;
  dir?: string;
}

export interface SelectionValue {
  scaleRoot: number;
  setScaleRoot: Dispatch<SetStateAction<number>>;
  scaleId: string;
  setScaleId: Dispatch<SetStateAction<string>>;
  chordRoot: number;
  setChordRoot: Dispatch<SetStateAction<number>>;
  chordId: string;
  setChordId: Dispatch<SetStateAction<string>>;
  voiceIdx: number;
  setVoiceIdx: Dispatch<SetStateAction<number>>;
  chordArea: number | null;
  setChordArea: Dispatch<SetStateAction<number | null>>;
  arpRoot: number;
  setArpRoot: Dispatch<SetStateAction<number>>;
  arpId: string;
  setArpId: Dispatch<SetStateAction<string>>;
  progRoot: number;
  setProgRoot: Dispatch<SetStateAction<number>>;
  progId: string;
  setProgId: Dispatch<SetStateAction<string>>;
  builder: ProgBuilder;
  setBuilder: Dispatch<SetStateAction<ProgBuilder>>;
  melSteps: MelodyStep[];
  setMelSteps: Dispatch<SetStateAction<MelodyStep[]>>;
  melName: string;
  setMelName: Dispatch<SetStateAction<string>>;
  melBars: number;
  setMelBars: Dispatch<SetStateAction<number>>;
  ivRoot: number;
  setIvRoot: Dispatch<SetStateAction<number>>;
  ivOn: Set<number>;
  setIvOn: Dispatch<SetStateAction<Set<number>>>;
  toggleIv: (i: number) => void;
  restorePosRef: MutableRefObject<RestorePos | null>;
  restoreVoiceRef: MutableRefObject<string | null>;
  posNonce: number;
  setPosNonce: Dispatch<SetStateAction<number>>;
}

const SelectionContext = createContext<SelectionValue | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [scaleRoot, setScaleRoot] = useState(0);
  const [scaleId, setScaleId] = useState("major");
  const [chordRoot, setChordRoot] = useState(0);
  const [chordId, setChordId] = useState("maj");
  const [voiceIdx, setVoiceIdx] = useState(0);
  const [chordArea, setChordArea] = useState<number | null>(null);
  const [arpRoot, setArpRoot] = useState(0);
  const [arpId, setArpId] = useState("maj");
  const [progRoot, setProgRoot] = useState(0);
  const [progId, setProgId] = useState("p1564");
  const [builder, setBuilder] = useState<ProgBuilder>({ bars: [], name: "", sections: {} }); // the custom-progression editor payload
  const [melSteps, setMelSteps] = useState<MelodyStep[]>([]); // the melody timeline: [{s, f} | {rest: true}]
  const [melName, setMelName] = useState("");
  const [melBars, setMelBars] = useState(2); // timeline length in bars
  const [ivRoot, setIvRoot] = useState(0);
  const [ivOn, setIvOn] = useState<Set<number>>(() => new Set([0, 4, 7]));
  const toggleIv = useCallback((i: number) => {
    setIvOn((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }, []);
  const restorePosRef = useRef<RestorePos | null>(null);
  const restoreVoiceRef = useRef<string | null>(null); // key of the saved chord shape to reselect on Bank open
  const [posNonce, setPosNonce] = useState(0);

  const value = useMemo<SelectionValue>(
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
      arpRoot,
      setArpRoot,
      arpId,
      setArpId,
      progRoot,
      setProgRoot,
      progId,
      setProgId,
      builder,
      setBuilder,
      melSteps,
      setMelSteps,
      melName,
      setMelName,
      melBars,
      setMelBars,
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
    [
      scaleRoot,
      scaleId,
      chordRoot,
      chordId,
      voiceIdx,
      chordArea,
      arpRoot,
      arpId,
      progRoot,
      progId,
      builder,
      melSteps,
      melName,
      melBars,
      ivRoot,
      ivOn,
      toggleIv,
      posNonce,
    ],
  );
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection(): SelectionValue {
  const v = useContext(SelectionContext);
  if (!v) throw new Error("useSelection must be used inside <SelectionProvider>");
  return v;
}
