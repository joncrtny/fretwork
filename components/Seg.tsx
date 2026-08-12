import { useNarrow } from "../hooks/useNarrow.ts";

type SegVal = string | number | boolean;
interface SegProps<T extends SegVal> {
  options: { v: T; l: string }[];
  value: T;
  onChange: (v: T) => void;
  small?: boolean;
  responsive?: boolean;
  ariaLabel?: string;
}

/* generic over the value type, so a caller's onChange receives exactly the type
   it stores (a Settings union, a boolean toggle, a numeric span) rather than a
   loose union it would then have to cast */
export function Seg<T extends SegVal>({ options, value, onChange, small, responsive = true, ariaLabel }: SegProps<T>) {
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
