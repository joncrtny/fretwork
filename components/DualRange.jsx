import { useEffect, useRef } from "react";

/* One track, two draggers. Thumbs are buttons: draggable by pointer,
   steppable by arrow keys, and announced as sliders. */
export function DualRange({ min, max, lo, hi, onChange }) {
  const trackRef = useRef(null);
  const dragRef = useRef(null); // "lo" | "hi" | null
  const clamp = (v) => Math.min(max, Math.max(min, v));
  const valFromX = (clientX) => {
    const r = trackRef.current.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return Math.round(min + t * (max - min));
  };
  const move = (which, v) => {
    v = clamp(v);
    if (which === "lo") onChange([Math.min(v, hi - 1), hi]);
    else onChange([lo, Math.max(v, lo + 1)]);
  };
  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current) return;
      move(dragRef.current, valFromX(e.clientX));
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lo, hi, min, max, onChange]);
  const pct = (v) => ((v - min) / (max - min)) * 100;
  const thumb = (which, v, lab) => (
    <button
      type="button"
      className="drthumb"
      style={{ left: `${pct(v)}%` }}
      role="slider"
      aria-label={lab}
      aria-valuemin={which === "hi" ? lo + 1 : min}
      aria-valuemax={which === "lo" ? hi - 1 : max}
      aria-valuenow={v}
      aria-valuetext={`fret ${v}`}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        dragRef.current = which;
        e.currentTarget.focus();
        e.preventDefault();
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
          move(which, v - 1);
          e.preventDefault();
        }
        if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          move(which, v + 1);
          e.preventDefault();
        }
        if (e.key === "Home") {
          move(which, which === "lo" ? min : lo + 1);
          e.preventDefault();
        }
        if (e.key === "End") {
          move(which, which === "lo" ? hi - 1 : max);
          e.preventDefault();
        }
      }}
    >
      {v}
    </button>
  );
  return (
    <div
      className="dualrange"
      ref={trackRef}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        if (e.target.closest && e.target.closest(".drthumb")) return;
        const v = valFromX(e.clientX);
        const which = Math.abs(v - lo) <= Math.abs(v - hi) ? "lo" : "hi";
        dragRef.current = which;
        move(which, v);
      }}
    >
      <div className="drtrack" aria-hidden="true" />
      <div className="drfill" style={{ left: `${pct(lo)}%`, width: `${Math.max(0, pct(hi) - pct(lo))}%` }} aria-hidden="true" />
      {thumb("lo", lo, "Lowest fret")}
      {thumb("hi", hi, "Highest fret")}
    </div>
  );
}
