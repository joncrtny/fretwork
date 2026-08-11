import { useEffect, useMemo } from "react";
import { DEG, FUNC_COLOUR, INTERVAL_PRESETS, keyPrefersFlats, nameOf } from "../theory.js";
import { Field } from "../components/Field.jsx";
import { KeyPicker } from "../components/KeyPicker.jsx";
import { IntervalGrid } from "../components/IntervalGrid.jsx";
import { useSettings } from "../state/SettingsContext.jsx";
import { useSelection } from "../state/SelectionContext.jsx";

/* Intervals: light up every interval against a chosen root across the neck.
   Selection owns the material (ivRoot, ivOn); Settings supplies the spelling
   preference and Simple mode. The fretboard itself still renders in the App
   shell for now, so this view computes its own effFlats for the pickers and
   publishes its readout line, while App keeps the marks/flats it feeds the
   shared Fretboard until the prop-flip lands. */
export function IntervalView({ setReadout }) {
  const { settings } = useSettings();
  const { ivRoot, setIvRoot, ivOn, setIvOn, toggleIv } = useSelection();

  /* per-view spelling: the interval slice of App's old effFlats memo */
  const effFlats = useMemo(() => {
    if (settings.noteNames === "sharps") return false;
    if (settings.noteNames === "flats") return true;
    return keyPrefersFlats(ivRoot, ivOn);
  }, [settings.noteNames, ivRoot, ivOn]);

  /* the interval slice of App's old readout memo, published to the shell
     header while this view is mounted */
  const readout = useMemo(
    () =>
      `${nameOf(ivRoot, effFlats)} root · ${[...ivOn]
        .sort((a, b) => a - b)
        .map((i) => DEG[i])
        .join(" ")}`,
    [ivRoot, effFlats, ivOn],
  );
  useEffect(() => {
    setReadout(readout);
  }, [readout, setReadout]);

  return (
    <div className="pane">
      <p className="panelead">
        See how each interval sits against the root across the fretboard, so the distances between notes become familiar.
      </p>
      <Field label="Root">
        <KeyPicker value={ivRoot} onChange={setIvRoot} flats={effFlats} />
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
          <IntervalGrid root={ivRoot} on={ivOn} onToggle={toggleIv} flats={effFlats} />
        </Field>
      )}

      <div className="degrees">
        {[...ivOn]
          .sort((a, b) => a - b)
          .map((i) => (
            <span key={i} className="chip" style={{ borderLeftColor: FUNC_COLOUR[i] }}>
              <b style={{ color: FUNC_COLOUR[i] }}>{DEG[i]}</b>
              {nameOf(ivRoot + i, effFlats)}
            </span>
          ))}
      </div>
      {!settings.simple && (
        <div className="row wrap">
          {[
            { l: "Root only", iv: [0] },
            { l: "Major triad", iv: [0, 4, 7] },
            { l: "Minor triad", iv: [0, 3, 7] },
            { l: "Dominant 7th", iv: [0, 4, 7, 10] },
            { l: "All twelve", iv: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
          ].map((pr) => {
            const on = pr.iv.length === ivOn.size && pr.iv.every((i) => ivOn.has(i));
            return (
              <button key={pr.l} className={`btn ghost ${on ? "sel" : ""}`} aria-pressed={on} onClick={() => setIvOn(new Set(pr.iv))}>
                {pr.l}
              </button>
            );
          })}
        </div>
      )}
      <p className="note" hidden={settings.simple}>
        Filled dots are natural degrees. Rings are flattened ones. Colour groups intervals by function: seconds, thirds, fourths, fifths,
        sixths, sevenths.
      </p>
    </div>
  );
}
