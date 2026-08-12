import { useState } from "react";
import { Field } from "../components/Field.tsx";
import { Seg } from "../components/Seg.tsx";
import { useLibrary } from "../state/LibraryContext.tsx";

/* Build a practice routine from the things you have marked as known. This is
   the setup screen only; once you press Build the shell takes over, stepping
   through each item on its own view with a floating HUD, so the runner state
   stays in App and building is handed back through onBuild(duration). App keeps
   the "Practice routine · N known" readout and the empty neck. */
export function RoutineView({ onBuild }) {
  const { known, toggleKnown, routineRatings } = useLibrary();
  const [routineDur, setRoutineDur] = useState(10); // minutes

  return (
    <div className="pane">
      <p className="note">
        Mark scales, chords and arpeggios you know with the lightbulb, then build a short routine here. Fretwork practises the ones you
        rated shaky for longer and adds one new "stretch" item. Rate the session afterwards to shape the next one.
      </p>
      {known.length === 0 ? (
        <p className="empty">
          Nothing marked yet. On the Scales, Chords or Arpeggios views, tap the lightbulb next to the star to mark something you know, then
          come back to build a routine.
        </p>
      ) : (
        <>
          <div className="row wrap actions">
            <Field label="How long?">
              <Seg
                small
                ariaLabel="Routine length"
                options={[
                  { v: 5, l: "5 min" },
                  { v: 10, l: "10 min" },
                  { v: 15, l: "15 min" },
                  { v: 20, l: "20 min" },
                ]}
                value={routineDur}
                onChange={setRoutineDur}
              />
            </Field>
            <button className="btn primary" onClick={() => onBuild(routineDur)}>
              Build and start
            </button>
          </div>
          <p className="note">
            You know {known.length} thing{known.length === 1 ? "" : "s"}. Your {routineDur} minute routine will run through{" "}
            {known.length === 1 ? "it" : "them"} plus one new stretch to grow into.
          </p>
          <Field label="Things you know">
            <div className="knownlist">
              {known.map((k) => (
                <div className="knownitem" key={k.sig}>
                  <span className="knowndot" aria-hidden="true" />
                  <b>{k.label}</b>
                  {routineRatings[k.sig] ? <em className="knownrate">{"★".repeat(routineRatings[k.sig])}</em> : null}
                  <button className="mini" aria-label={`Forget ${k.label}`} onClick={() => toggleKnown(k)}>
                    {"✕"}
                  </button>
                </div>
              ))}
            </div>
          </Field>
        </>
      )}
    </div>
  );
}
