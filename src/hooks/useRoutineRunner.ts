import { useCallback, useEffect, useState } from "react";
import { SCALES, CHORDS, SCALE_ORDER, CHORD_ORDER, nameOf } from "../theory.ts";
import { track } from "../lib/analytics.ts";
import { useSelection } from "../state/SelectionContext.tsx";
import { useLibrary, type KnownItem } from "../state/LibraryContext.tsx";
import { usePlayback } from "../state/PlaybackContext.tsx";
import { useToast } from "../state/ToastContext.tsx";

/* a routine item is a known thing, plus a flag on the one "stretch" item */
type RoutineItem = KnownItem & { isStretch?: boolean };
interface Segment {
  item: RoutineItem;
  seconds: number;
  stretch: boolean;
}
interface Routine {
  phase: "running" | "rate";
  segments: Segment[];
  idx: number;
  remaining: number;
  duration: number;
}

/* The practice-routine runner: once RoutineView hands over a duration, this
   builds a weighted set of segments from what you know (the shaky ones get
   longer, plus one new "stretch"), counts each down, and steps the shell to the
   right view as it reaches each item. The setup screen lives in RoutineView;
   this is the cross-mode runner behind the floating HUD, so it needs the
   shell's setMode. Reads known/ratings from Library and writes the post-session
   rating back. */
export function useRoutineRunner({ setMode }: { setMode: (m: string) => void }) {
  const { setScaleRoot, setScaleId, setChordRoot, setChordId, setArpRoot, setArpId } = useSelection();
  const { known, routineRatings, saveRoutineRatings } = useLibrary();
  const { stopPlayback } = usePlayback();
  const { setToast } = useToast();

  const [routine, setRoutine] = useState<Routine | null>(null);

  const gotoSegment = useCallback(
    (item: RoutineItem | null | undefined) => {
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
    [setArpId, setArpRoot, setChordId, setChordRoot, setScaleId, setScaleRoot, setMode],
  );

  const pickStretch = (knownList: KnownItem[]): RoutineItem | null => {
    const counts: Record<string, number> = {};
    knownList.forEach((k) => {
      counts[k.kind] = (counts[k.kind] || 0) + 1;
    });
    const kind = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || "chord";
    const order = kind === "scale" ? SCALE_ORDER : CHORD_ORDER;
    const knownIds = new Set(knownList.filter((k) => k.kind === kind).map((k) => k.id));
    const nextId = order.find((id) => !knownIds.has(id));
    if (!nextId) return null;
    const root = knownList.find((k) => k.kind === kind)?.root ?? 0;
    const def: { name: string; suffix?: string } | undefined = kind === "scale" ? SCALES.find((s) => s.id === nextId) : CHORDS.find((c) => c.id === nextId);
    if (!def) return null;
    const label =
      kind === "scale" ? `${nameOf(root, false)} ${def.name}` : `${nameOf(root, false)}${def.suffix}${kind === "arp" ? " arpeggio" : ""}`;
    return { sig: `k-${kind}:${root}:${nextId}`, kind, root, id: nextId, label, isStretch: true };
  };

  const buildRoutine = (dur: number) => {
    if (!known.length) return;
    stopPlayback();
    const totalSec = dur * 60;
    const stretch = pickStretch(known);
    /* practise the shaky ones (low past rating) for longer, then one stretch */
    const list: RoutineItem[] = [...known];
    if (stretch) list.push(stretch);
    const weightOf = (it: RoutineItem) => {
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

  const stopRoutine = useCallback(() => setRoutine(null), []);

  const rateRoutine = (stars: number) => {
    const next: Record<string, number> = { ...routineRatings };
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

  return { routine, buildRoutine, routineNext, rateRoutine, stopRoutine };
}
