import { DEG, FUNC_COLOUR, LOWERED, nameOf } from "../theory.js";

export function IntervalGrid({ root, on, onToggle, flats }) {
  return (
    <div className="ivgrid">
      {DEG.map((d, i) => {
        const active = on.has(i);
        const c = FUNC_COLOUR[i];
        return (
          <button
            key={i}
            className={`iv ${active ? "on" : ""} ${LOWERED.has(i) ? "low" : ""}`}
            aria-pressed={active}
            style={
              active
                ? { background: LOWERED.has(i) ? "transparent" : c, borderColor: c, color: LOWERED.has(i) ? c : "#FFFFFF" }
                : { borderColor: "var(--fret)" }
            }
            onClick={() => onToggle(i)}
          >
            <b>{d}</b>
            <em>{nameOf(root + i, flats)}</em>
          </button>
        );
      })}
    </div>
  );
}
