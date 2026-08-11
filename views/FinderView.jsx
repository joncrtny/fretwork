import { useMemo, useState } from "react";
import { CHORDS, nameOf, keyPrefersFlats } from "../theory.js";
import { track } from "../lib/analytics.js";
import { Field } from "../components/Field.jsx";
import { useSettings } from "../state/SettingsContext.jsx";
import { useSelection } from "../state/SelectionContext.jsx";

/* The chord finder: tap notes on the neck and Fretwork names any chords that
   fit. Owns the tapped-position set and the matching logic; opening a found
   chord writes the Selection chord and leaves via `onNavigate("chord")`.

   Fretboard caveat (same as IntervalView): the neck itself is still rendered
   by the App shell, so the finder slices of the shared `marks` memo and the
   shared `onCell` tap handler stay in App.jsx for now. They read finderSel and
   finderInfo, which live here, so integration must bridge them (see risks). */
export function FinderView({ onNavigate }) {
  const { settings, midis } = useSettings();
  const { setChordRoot, setChordId } = useSelection();

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
