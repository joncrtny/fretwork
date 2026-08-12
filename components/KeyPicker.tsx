import { useState, useEffect, useRef } from "react";
import { nameOf } from "../theory.ts";

export function KeyPicker({
  value,
  onChange,
  flats,
  tip,
}: {
  value: number;
  onChange: (pc: number) => void;
  flats: boolean;
  tip?: string;
}) {
  const [open, setOpen] = useState(false);
  const [upK, setUpK] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!open) return;
    if (btnRef.current) {
      const b = btnRef.current.getBoundingClientRect();
      const below = window.innerHeight - b.bottom;
      setUpK(below < 240 && b.top > below);
    }
    /* close on any pointerdown outside this picker, including on another picker */
    const close = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        if (btnRef.current) btnRef.current.focus();
      }
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className="picker" ref={boxRef}>
      <button
        ref={btnRef}
        className={`pickbtn ${open ? "open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        data-tip={tip}
      >
        <span>{nameOf(value, flats)}</span>
        <i className="caret" aria-hidden="true" />
      </button>
      {open && (
        <div className={`pickmenu ${upK ? "up" : ""}`} role="listbox" aria-label="Notes">
          {Array.from({ length: 12 }, (_, i) => i).map((pc) => (
            <button
              key={pc}
              role="option"
              aria-selected={pc === value}
              className={pc === value ? "key on" : "key"}
              onClick={() => {
                onChange(pc);
                setOpen(false);
              }}
            >
              {nameOf(pc, flats)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
