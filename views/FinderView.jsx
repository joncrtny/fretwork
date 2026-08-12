import { useCallback, useMemo, useState } from "react";
import { CHORDS, nameOf, keyPrefersFlats } from "../theory.ts";
import { track } from "../lib/analytics.ts";
import { Field } from "../components/Field.jsx";
import { useSettings } from "../state/SettingsContext.jsx";
import { useSelection } from "../state/SelectionContext.tsx";
import { usePlayback } from "../state/PlaybackContext.jsx";
import { usePublishFretboard } from "../state/FretboardContext.tsx";
import { usePublishReadout } from "../state/ReadoutContext.tsx";

/* The chord finder: tap notes on the neck and Fretwork names any chords that
   fit. Owns the tapped-position set, the matching logic, and the neck itself,
   publishing its lit notes and its tap handler through the fretboard slot and
   its name through the readout slot. Opening a found chord writes the Selection
   chord and leaves via `onNavigate("chord")`. */
export function FinderView({ onNavigate }) {
  const { settings, midis, capo } = useSettings();
  const { setChordRoot, setChordId } = useSelection();
  const { playNote } = usePlayback();

  const [finderSel, setFinderSel] = useState(new Set()); // "s:f" positions tapped in the chord finder

  /* chord finder: turn the tapped positions into pitch classes and name any chords that fit */
  const finderInfo = useMemo(() => {
    const positionsList = [...finderSel];
    const pcs = [
      ...new Set(
        positionsList.map((k) => {
          const [s, f] = k.split(":").map(Number);
          return (midis[s] + f) % 12;
        }),
      ),
    ];
    const pcSet = new Set(pcs);
    const bassKey = positionsList
      .map((k) => {
        const [s, f] = k.split(":").map(Number);
        return { pc: (midis[s] + f) % 12, midi: midis[s] + f };
      })
      .sort((a, b) => a.midi - b.midi)[0];
    const exact = [];
    const partial = [];
    if (pcs.length >= 2) {
      for (let root = 0; root < 12; root++) {
        for (const c of CHORDS) {
          const chordPcs = c.iv.map((i) => (root + i) % 12);
          const chordSet = new Set(chordPcs);
          const covers = pcs.every((pc) => chordSet.has(pc));
          if (!covers) continue;
          const entry = {
            root,
            id: c.id,
            name: `${nameOf(root, keyPrefersFlats(root, c.iv))}${c.suffix}`,
            size: chordPcs.length,
            bass: bassKey && bassKey.pc === root,
          };
          if (chordSet.size === pcSet.size) exact.push(entry);
          else partial.push(entry);
        }
      }
    }
    /* prefer chords whose root is the lowest note, then the smallest superset */
    const rank = (a, b) => b.bass - a.bass || a.size - b.size;
    return { pcs, exact: exact.sort(rank).slice(0, 6), partial: partial.sort(rank).slice(0, 6), bassPc: bassKey ? bassKey.pc : null };
  }, [finderSel, midis]);

  /* effective accidental spelling: Auto follows the key of whatever is on screen */
  const effFlats = useMemo(() => {
    if (settings.noteNames === "sharps") return false;
    if (settings.noteNames === "flats") return true;
    const best = finderInfo.exact[0] || finderInfo.partial[0];
    const bestDef = best ? CHORDS.find((x) => x.id === best.id) : null;
    const r = best ? best.root : finderInfo.bassPc;
    return r == null ? false : keyPrefersFlats(r, bestDef ? bestDef.iv : [4]);
  }, [settings.noteNames, finderInfo]);

  /* light the tapped notes, coloured by their function against the best match */
  const marks = useMemo(() => {
    const map = new Map();
    const rootPc = finderInfo.exact[0] ? finderInfo.exact[0].root : finderInfo.bassPc;
    for (const k of finderSel) {
      const [fs, ff] = k.split(":").map(Number);
      const pc = (midis[fs] + ff) % 12;
      map.set(k, { pc, semis: rootPc == null ? pc : (pc - rootPc + 12) % 12, tone: "chord", state: "lit", finger: null });
    }
    return map;
  }, [finderSel, finderInfo, midis]);

  const onCell = useCallback(
    (s, f, midi) => {
      if (capo > 0 && f > 0 && f < capo) return;
      playNote(midi);
      const k = `${s}:${f}`;
      setFinderSel((sel) => {
        const next = new Set(sel);
        if (next.has(k)) next.delete(k);
        else next.add(k);
        return next;
      });
    },
    [capo, playNote],
  );

  usePublishFretboard(
    useMemo(
      () => ({
        marks,
        onCell,
        flats: effFlats,
        labelMode: settings.labelMode,
        colourMode: settings.colourMode,
        barre: null,
        ghosts: null,
        quizActive: false,
        quizRange: undefined,
      }),
      [marks, onCell, effFlats, settings.labelMode, settings.colourMode],
    ),
  );

  usePublishReadout(
    finderInfo.exact.length
      ? `Chord finder · ${finderInfo.exact[0].name}`
      : finderSel.size
        ? "Chord finder · no exact match"
        : "Chord finder",
  );

  return (
    <div className="pane">
      <p className="note">
        Tap the notes of a chord on the neck (or focus it and use the arrow keys and Enter) and Fretwork names it. Handy for the unfamiliar
        shapes you meet in tab.
      </p>
      <div className="degrees">
        {finderInfo.pcs.length === 0 ? (
          <span className="note">No notes selected yet.</span>
        ) : (
          finderInfo.pcs.map((pc) => (
            <span key={pc} className="chip">
              <b>{nameOf(pc, effFlats)}</b>
            </span>
          ))
        )}
      </div>

      {finderInfo.exact.length > 0 ? (
        <Field label="This chord is">
          <div className="finderhits">
            {finderInfo.exact.map((m) => (
              <button
                key={`${m.root}${m.id}`}
                className="btn"
                onClick={() => {
                  setChordRoot(m.root);
                  setChordId(m.id);
                  onNavigate("chord");
                  track("finder_open", { chord: m.id });
                }}
              >
                {nameOf(m.root, effFlats)}
                {(CHORDS.find((c) => c.id === m.id) || {}).suffix}
              </button>
            ))}
          </div>
        </Field>
      ) : finderInfo.partial.length > 0 ? (
        <Field label="Could be part of">
          <div className="finderhits">
            {finderInfo.partial.map((m) => (
              <button
                key={`${m.root}${m.id}`}
                className="btn ghost"
                onClick={() => {
                  setChordRoot(m.root);
                  setChordId(m.id);
                  onNavigate("chord");
                }}
              >
                {nameOf(m.root, effFlats)}
                {(CHORDS.find((c) => c.id === m.id) || {}).suffix}
              </button>
            ))}
          </div>
        </Field>
      ) : finderInfo.pcs.length >= 2 ? (
        <p className="empty" role="status">
          No standard chord matches those notes. Try adding or removing one.
        </p>
      ) : (
        <p className="note">Add at least two notes to name a chord.</p>
      )}

      <div className="row">
        <button className="btn ghost danger" onClick={() => setFinderSel(new Set())} disabled={finderSel.size === 0}>
          Clear
        </button>
      </div>
    </div>
  );
}
