import { useNarrow } from "../hooks/useNarrow.js";

export function Seg({ options, value, onChange, small, responsive = true, ariaLabel }) {
  const narrow = useNarrow();
  if (responsive && narrow) {
    const idx = options.findIndex((o) => o.v === value);
    return (
      <select className="segsel" aria-label={ariaLabel} value={idx < 0 ? 0 : idx} onChange={(e) => onChange(options[+e.target.value].v)}>
        {options.map((o, i) => (
          <option key={i} value={i}>
            {o.l}
          </option>
        ))}
      </select>
    );
  }
  return (
    <div className={`seg ${small ? "sm" : ""}`} role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={String(o.v)} aria-pressed={value === o.v} className={value === o.v ? "on" : ""} onClick={() => onChange(o.v)}>
          {o.l}
        </button>
      ))}
    </div>
  );
}
