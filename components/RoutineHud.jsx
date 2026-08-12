/* The floating routine HUD and its end-of-session rating dialog. Presentational
   over useRoutineRunner: while a routine runs it shows the current item and a
   countdown over whichever view the runner has stepped to; at the end it asks
   for a rating that shapes the next routine. Renders nothing when idle. */
export function RoutineHud({ routine, routineNext, rateRoutine, stopRoutine }) {
  if (!routine) return null;

  if (routine.phase === "running") {
    const seg = routine.segments[routine.idx];
    const mm = Math.floor(routine.remaining / 60);
    const ss = String(routine.remaining % 60).padStart(2, "0");
    return (
      <div className="routinehud" role="region" aria-label="Practice routine in progress">
        <div className="rhud-main">
          <b>{seg && seg.item.label}</b>
          <span>{seg && seg.stretch ? "Stretch · something new" : `Step ${routine.idx + 1} of ${routine.segments.length}`}</span>
        </div>
        <div className="rhud-time" aria-label={`${mm} minutes ${routine.remaining % 60} seconds left`}>
          {mm}:{ss}
        </div>
        <button className="btn ghost" onClick={routineNext}>
          {routine.idx + 1 >= routine.segments.length ? "Finish" : "Next"}
        </button>
        <button className="btn ghost danger" onClick={stopRoutine}>
          Stop
        </button>
      </div>
    );
  }

  if (routine.phase === "rate") {
    return (
      <div className="celebrate" role="dialog" aria-label="Rate your practice">
        <div className="celebratecard">
          <b>How did that feel?</b>
          <span>Your rating shapes the next routine</span>
          <div className="ratestars">
            {[
              { s: 1, l: "Shaky" },
              { s: 2, l: "Getting there" },
              { s: 3, l: "Solid" },
            ].map((o) => (
              <button
                key={o.s}
                className="ratestar"
                onClick={() => rateRoutine(o.s)}
                aria-label={`${o.l}, ${o.s} star${o.s > 1 ? "s" : ""}`}
              >
                <span aria-hidden="true">{"★".repeat(o.s)}</span>
                <em>{o.l}</em>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
