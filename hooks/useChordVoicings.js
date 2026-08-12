import { useEffect, useMemo } from "react";
import { CHORDS } from "../theory.js";
import { findVoicings } from "../voicings.js";
import { useSettings } from "../state/SettingsContext.jsx";
import { useSelection } from "../state/SelectionContext.jsx";

/* The chord-voicing engine, shared by whichever of Chord/Strum is on screen.
   The *choice* (which key, which chord, which area, which shape index) lives in
   SelectionContext; this hook turns that choice into the list of playable
   shapes and the one currently selected. Only the mounted consumer passes
   active=true, so the work and the index/area resets happen once, for the view
   the user is actually looking at. */
export function useChordVoicings(active) {
  const { settings, midis, fretCount, capo } = useSettings();
  const { chordRoot, chordId, chordArea, setChordArea, voiceIdx, setVoiceIdx, restoreVoiceRef, posNonce } = useSelection();

  const chordDef = CHORDS.find((c) => c.id === chordId) || CHORDS[0];

  const vopt = useMemo(
    () => ({ span: settings.span, inversions: settings.inversions, barres: settings.barres }),
    [settings.span, settings.inversions, settings.barres],
  );

  const voicings = useMemo(
    () => (active ? findVoicings(chordRoot, chordDef.iv, midis, fretCount, capo, vopt) : []),
    [active, chordRoot, chordDef, midis, fretCount, capo, vopt],
  );

  /* the frets a shape can start on, so you can jump to shapes near your hand */
  const chordAreas = useMemo(() => [...new Set(voicings.map((v) => v.lowest))].sort((a, b) => a - b), [voicings]);

  const shownVoicings = useMemo(
    () => (chordArea == null ? voicings : voicings.filter((v) => v.lowest === chordArea)),
    [voicings, chordArea],
  );

  useEffect(() => {
    if (!active) return;
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
  }, [active, chordRoot, chordId, vopt, capo, settings.tuningId, settings.fretCount, chordArea, posNonce]);

  useEffect(() => {
    if (active && chordArea != null && !chordAreas.includes(chordArea)) setChordArea(null);
  }, [active, chordAreas, chordArea, setChordArea]);

  const activeVoicing = shownVoicings[Math.min(voiceIdx, Math.max(0, shownVoicings.length - 1))] || null;

  return { vopt, chordDef, voicings, chordAreas, shownVoicings, activeVoicing };
}
