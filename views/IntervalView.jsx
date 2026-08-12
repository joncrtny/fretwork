import { useCallback, useMemo } from "react";
import { DEG, FUNC_COLOUR, INTERVAL_PRESETS, nameOf, keyPrefersFlats } from "../theory.ts";
import { neckPositions } from "../fretboard.jsx";
import { Field } from "../components/Field.jsx";
import { KeyPicker } from "../components/KeyPicker.jsx";
import { IntervalGrid } from "../components/IntervalGrid.jsx";
import { useSettings } from "../state/SettingsContext.tsx";
import { useSelection } from "../state/SelectionContext.tsx";
import { usePlayback } from "../state/PlaybackContext.tsx";
import { usePublishFretboard } from "../state/FretboardContext.tsx";

const EMPTY = new Set(); // Fretboard reads ghosts as a Set (ghosts.has(...))

/* Intervals from a root, shown across the neck. First view to own its own neck
   config: it computes marks/spelling locally and publishes them to the shell's
   fretboard slot, so App no longer branches on mode === "interval" for the
   neck. */
export function IntervalView() {
  const { settings, midis, n, fretCount, capo } = useSettings();
  const { ivRoot, setIvRoot, ivOn, setIvOn, toggleIv } = useSelection();
  const { playNote } = usePlayback();

  const flats = useMemo(
    () => (settings.noteNames === "sharps" ? false : settings.noteNames === "flats" ? true : keyPrefersFlats(ivRoot, ivOn)),
    [settings.noteNames, ivRoot, ivOn],
  );

  const marks = useMemo(() => {
    const map = new Map();
    for (const p of neckPositions(ivRoot, ivOn, midis, n, fretCount, capo))
      map.set(`${p.s}:${p.f}`, { pc: p.pc, semis: p.semis, tone: "interval", state: "on", finger: null });
    return map;
  }, [ivRoot, ivOn, midis, n, fretCount, capo]);

  const onCell = useCallback(
    (s, f, midi) => {
      if (capo > 0 && f > 0 && f < capo) return;
      playNote(midi);
    },
    [capo, playNote],
  );

  usePublishFretboard(
    useMemo(
      () => ({
        marks,
        onCell,
        flats,
        labelMode: settings.labelMode,
        colourMode: "interval",
        barre: null,
        ghosts: EMPTY,
        quizActive: false,
        quizRange: undefined,
      }),
      [marks, onCell, flats, settings.labelMode],
    ),
  );

  const PRESETS = [
    { l: "Root only", iv: [0] },
    { l: "Major triad", iv: [0, 4, 7] },
    { l: "Minor triad", iv: [0, 3, 7] },
    { l: "Dominant 7th", iv: [0, 4, 7, 10] },
    { l: "All twelve", iv: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  ];

  return (
    <div className="pane">
      <p className="panelead">
        See how each interval sits against the root across the fretboard, so the distances between notes become familiar.
      </p>
      <Field label="Root">
        <KeyPicker value={ivRoot} onChange={setIvRoot} flats={flats} />
      </Field>
      {settings.simple ? (
        <Field label="Show">
          <div className="posrow">
            {INTERVAL_PRESETS.map((pr) => {
              const on = pr.iv.length === ivOn.size && pr.iv.every((i) => ivOn.has(i));
              return (
                <button key={pr.id} className={`poschip wide ${on ? "on" : ""}`} aria-pressed={on} onClick={() => setIvOn(new Set(pr.iv))}>
                  {pr.label}
                </button>
              );
            })}
          </div>
        </Field>
      ) : (
        <Field label="Intervals from the root">
          <IntervalGrid root={ivRoot} on={ivOn} onToggle={toggleIv} flats={flats} />
        </Field>
      )}

      <div className="degrees">
        {[...ivOn]
          .sort((a, b) => a - b)
          .map((i) => (
            <span key={i} className="chip" style={{ borderLeftColor: FUNC_COLOUR[i] }}>
              <b style={{ color: FUNC_COLOUR[i] }}>{DEG[i]}</b>
              {nameOf(ivRoot + i, flats)}
            </span>
          ))}
      </div>
      {!settings.simple && (
        <div className="row wrap">
          {PRESETS.map((pr) => {
            const on = pr.iv.length === ivOn.size && pr.iv.every((i) => ivOn.has(i));
            return (
              <button key={pr.l} className={`btn ghost ${on ? "sel" : ""}`} aria-pressed={on} onClick={() => setIvOn(new Set(pr.iv))}>
                {pr.l}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
