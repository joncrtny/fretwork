import { useState, useEffect, useRef } from "react";

interface PickerItem {
  id: string;
  name: string;
  sub?: string;
}
interface PickerGroup {
  label: string;
  items: PickerItem[];
}

/* Categorized picker: the same compact pattern as KeyPicker, for entities
   with families. One button, a multi-column panel grouped under headings. */
export function CatPicker({
  value,
  groups,
  onChange,
  label,
  tip,
}: {
  value: string;
  groups: PickerGroup[];
  onChange: (id: string) => void;
  label?: string;
  tip?: string;
}) {
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(0);
  const [up, setUp] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const uid = useRef(`cp${Math.floor(performance.now() * 1000) % 1e9}`);
  useEffect(() => {
    if (!open) return;
    /* keep the panel inside the viewport: shift left when it would overflow,
       and open upward when there is more room above than below */
    if (menuRef.current && btnRef.current) {
      const b = btnRef.current.getBoundingClientRect();
      const m = menuRef.current.getBoundingClientRect();
      const overflow = b.left + m.width - (window.innerWidth - 16);
      setShift(overflow > 0 ? -Math.min(overflow, b.left - 16) : 0);
      const below = window.innerHeight - b.bottom;
      setUp(below < Math.min(m.height, 320) && b.top > below);
    }
    const close = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      const insidePicker = boxRef.current && boxRef.current.contains(document.activeElement);
      if (e.key === "Escape") {
        setOpen(false);
        if (btnRef.current) btnRef.current.focus();
        return;
      }
      /* arrows drive the menu only while focus is actually in this picker */
      if (!insidePicker) return;
      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && menuRef.current) {
        const opts = [...menuRef.current.querySelectorAll<HTMLElement>("[role=option]")];
        const i = opts.indexOf(document.activeElement as HTMLElement);
        const next = e.key === "ArrowDown" ? Math.min(opts.length - 1, i + 1) : Math.max(0, i - 1);
        if (opts[next]) opts[next].focus();
        e.preventDefault();
      }
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const current = groups.flatMap((g) => g.items).find((x) => x.id === value);
  return (
    <div
      className="picker"
      ref={boxRef}
      onBlur={(e) => {
        /* keyboard users tabbing out should not leave the panel hanging open */
        if (open && boxRef.current && !boxRef.current.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        ref={btnRef}
        className={`pickbtn txt ${open ? "open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        data-tip={tip}
      >
        <span>{current ? current.name : "Choose"}</span>
        <i className="caret" aria-hidden="true" />
      </button>
      {open && (
        <div
          className={`pickmenu catmenu ${up ? "up" : ""}`}
          role="listbox"
          aria-label={label}
          ref={menuRef}
          style={shift ? { left: shift } : undefined}
        >
          {groups
            .filter((g) => g.items.length > 0)
            .map((g, gi) => (
              <div className="catgroup" role="group" aria-labelledby={`${uid.current}-g${gi}`} key={g.label}>
                <p className="cathead" id={`${uid.current}-g${gi}`}>
                  {g.label}
                </p>
                <div className="catitems">
                  {g.items.map((it) => (
                    <button
                      key={it.id}
                      role="option"
                      aria-selected={it.id === value}
                      className={it.id === value ? "catitem on" : "catitem"}
                      onClick={() => {
                        onChange(it.id);
                        setOpen(false);
                        if (btnRef.current) btnRef.current.focus();
                      }}
                    >
                      {it.name}
                      {it.sub && <em>{it.sub}</em>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
