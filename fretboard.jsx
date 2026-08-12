/* ==========================================================
   FRETBOARD RENDERER
   Neck geometry, the interactive Fretboard SVG, the note dots and
   the compact ChordDiagram. Presentational: driven entirely by props.
   ========================================================== */

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { nameOf, DEG, FUNC_COLOUR, LOWERED, SINGLE_DOTS, DOUBLE_DOTS } from "./theory.js";

const PAD_L = 74;
const PAD_R = 24;
const PAD_T = 46;
const PAD_B = 30;
const FRET0_W = 64;
const TAPER = 0.976;
const LANE_TOP = 10;
const LANE_H = 24;

/* every neck position whose interval-from-root is in ivSet, from the capo up.
   Pure neck geometry, shared by the views that light up scale/interval/arp
   tones. Returns { s, f, pc, semis }. */
export function neckPositions(rootPc, ivSet, midis, n, fretCount, capo, from = 0, to = fretCount) {
  const out = [];
  const hi = Math.min(to, fretCount);
  for (let s = 0; s < n; s++) {
    for (let f = Math.max(from, capo); f <= hi; f++) {
      const pc = (midis[s] + f) % 12;
      const semis = (pc - rootPc + 24) % 12;
      if (ivSet.has(semis)) out.push({ s, f, pc, semis });
    }
  }
  return out;
}

export function useGeometry(fretCount, stringCount, zoom, leftHanded) {
  return useMemo(() => {
    const w0 = FRET0_W * zoom;
    const xs = [0];
    for (let k = 1; k <= fretCount; k++) xs.push(xs[k - 1] + w0 * Math.pow(TAPER, k - 1));
    const boardW = xs[fretCount];
    const totalW = PAD_L + boardW + PAD_R;

    const gap = 24 * Math.min(1.3, Math.max(0.8, zoom));
    const pad = gap * 0.58;
    const top = PAD_T;
    const bot = top + gap * (stringCount - 1) + pad * 2;
    const cy = (top + bot) / 2;
    const totalH = bot + PAD_B;

    const boardX = PAD_L;
    const px = (x) => (leftHanded ? totalW - x : x);
    const rectX = (x, w) => (leftHanded ? totalW - x - w : x);

    const fretX = (k) => boardX + xs[Math.max(0, Math.min(fretCount, k))];
    const cellX = (k) => (k === 0 ? boardX - 30 : (fretX(k - 1) + fretX(k)) / 2);
    const cellW = (k) => (k === 0 ? 40 : fretX(k) - fretX(k - 1));
    const yRow = (r) => top + pad + r * gap;

    return {
      totalW,
      totalH,
      boardX,
      boardW,
      top,
      bot,
      cy,
      gap,
      pad,
      fretX,
      cellX,
      cellW,
      yRow,
      px,
      rectX,
      leftHanded,
    };
  }, [fretCount, stringCount, zoom, leftHanded]);
}

/* ============================================================
   FRETBOARD
   ============================================================ */

export function Fretboard({
  fretCount,
  midis,
  rowToString,
  geo,
  marks,
  capo,
  onCapo,
  onCell,
  flats,
  labelMode,
  colourMode,
  ghosts,
  flash,
  quizRange,
  quizActive,
  barre,
}) {
  const svgRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [kb, setKb] = useState(null); // keyboard cursor {r, f}, shown while the neck has focus
  const [announce, setAnnounce] = useState("");
  const stringCount = midis.length;
  const { totalW, totalH, boardX, boardW, top, bot, cy, gap, fretX, cellX, cellW, yRow, px, rectX } = geo;

  const boardEnd = boardX + boardW;

  const fretFromX = useCallback(
    (clientX) => {
      const svg = svgRef.current;
      if (!svg) return capo;
      const r = svg.getBoundingClientRect();
      const scale = totalW / r.width;
      let x = (clientX - r.left) * scale;
      if (geo.leftHanded) x = totalW - x;
      if (x < boardX - 4) return 0;
      for (let k = 1; k <= fretCount; k++) if (x < fretX(k)) return k;
      return fretCount;
    },
    [capo, totalW, boardX, fretCount, fretX, geo.leftHanded],
  );

  useEffect(() => {
    if (!dragging) return;
    const move = (e) => onCapo(fretFromX(e.clientX));
    const up = () => setDragging(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [dragging, fretFromX, onCapo]);

  const laneMid = LANE_TOP + LANE_H / 2;
  const puckX = capo > 0 ? cellX(capo) : boardX - 30;
  const capoBarX = capo > 0 ? fretX(capo) - Math.min(9, cellW(capo) * 0.22) : 0;

  return (
    <>
      <svg
        ref={svgRef}
        className="fretboard"
        viewBox={`0 0 ${totalW} ${totalH}`}
        width={totalW}
        height={totalH}
        role="application"
        aria-label="Guitar neck. Press the arrow keys to move between strings and frets, Enter to play or answer, Home and End to jump."
        tabIndex={0}
        onKeyDown={(e) => {
          /* the capo handles its own keys; do not let them also drive the cursor */
          if (e.target !== e.currentTarget) return;
          const cur = kb || { r: 0, f: capo || 0 };
          let { r, f } = cur;
          if (e.key === "ArrowRight") f += 1;
          else if (e.key === "ArrowLeft") f -= 1;
          else if (e.key === "ArrowDown") r += 1;
          else if (e.key === "ArrowUp") r -= 1;
          else if (e.key === "Home") f = 0;
          else if (e.key === "End") f = fretCount;
          else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            const s = rowToString(cur.r);
            if (onCell) onCell(s, cur.f, midis[s] + cur.f);
            setAnnounce(`Played ${nameOf((midis[s] + cur.f) % 12, flats)}, string ${s + 1}, fret ${cur.f}`);
            setKb(cur);
            return;
          } else return;
          e.preventDefault();
          r = Math.max(0, Math.min(stringCount - 1, r));
          f = Math.max(0, Math.min(fretCount, f));
          const s2 = rowToString(r);
          setAnnounce(`${nameOf((midis[s2] + f) % 12, flats)}, string ${s2 + 1}, fret ${f}`);
          setKb({ r, f });
        }}
        onBlur={() => setKb(null)}
      >
        {/* capo track */}
        <g>
          <rect x={rectX(boardX - 50, boardW + 50)} y={LANE_TOP} width={boardW + 50} height={LANE_H} rx={LANE_H / 2} fill="var(--lane)" />
          <line
            x1={px(boardX - 12)}
            y1={LANE_TOP + 5}
            x2={px(boardX - 12)}
            y2={LANE_TOP + LANE_H - 5}
            stroke="var(--line2)"
            strokeWidth="1"
          />
          <text x={px(boardX - 31)} y={laneMid + 3.5} textAnchor="middle" fontSize="9" className="fretnum" fill="var(--muted)">
            {capo > 0 ? "OFF" : ""}
          </text>
          <rect
            x={rectX(boardX - 50, boardW + 50)}
            y={LANE_TOP}
            width={boardW + 50}
            height={LANE_H}
            rx={LANE_H / 2}
            fill="transparent"
            className="lane"
            onPointerDown={(e) => {
              e.preventDefault();
              onCapo(fretFromX(e.clientX));
              setDragging(true);
            }}
          />
          <g
            className={`capo ${dragging ? "drag" : ""}`}
            tabIndex={0}
            role="slider"
            aria-label="Capo position"
            aria-valuemin={0}
            aria-valuemax={fretCount}
            aria-valuenow={capo}
            aria-valuetext={capo === 0 ? "No capo" : `Fret ${capo}`}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragging(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                onCapo(Math.min(fretCount, capo + 1));
                e.preventDefault();
              }
              if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                onCapo(Math.max(0, capo - 1));
                e.preventDefault();
              }
              if (e.key === "Home") {
                onCapo(0);
                e.preventDefault();
              }
            }}
          >
            <rect
              x={rectX(puckX - 15, 30)}
              y={LANE_TOP + 2}
              width={30}
              height={LANE_H - 4}
              rx="9"
              fill={capo > 0 ? "var(--ink)" : "var(--card)"}
              stroke={capo > 0 ? "var(--ink)" : "var(--line2)"}
              strokeWidth="1.5"
            />
            <text
              x={px(puckX)}
              y={laneMid + 3.5}
              textAnchor="middle"
              fontSize="10"
              className="fretnum"
              fill={capo > 0 ? "var(--onink)" : "var(--muted)"}
            >
              {capo > 0 ? capo : "CAPO"}
            </text>
          </g>
        </g>

        {/* board */}
        <rect
          x={rectX(boardX, boardW)}
          y={top}
          width={boardW}
          height={bot - top}
          rx="4"
          fill="var(--board)"
          stroke="var(--line)"
          strokeWidth="1"
        />

        {/* position inlays */}
        {Array.from({ length: fretCount }, (_, i) => i + 1).map((k) => {
          const x = cellX(k);
          if (DOUBLE_DOTS.includes(k))
            return (
              <g key={`i${k}`}>
                <circle cx={px(x)} cy={cy - gap * 0.85} r="4.5" fill="var(--inlay)" />
                <circle cx={px(x)} cy={cy + gap * 0.85} r="4.5" fill="var(--inlay)" />
              </g>
            );
          if (SINGLE_DOTS.includes(k)) return <circle key={`i${k}`} cx={px(x)} cy={cy} r="4.5" fill="var(--inlay)" />;
          return null;
        })}

        {/* frets */}
        {Array.from({ length: fretCount }, (_, i) => i + 1).map((k) => (
          <line key={`f${k}`} x1={px(fretX(k))} y1={top} x2={px(fretX(k))} y2={bot} stroke="var(--fret)" strokeWidth="1.5" />
        ))}

        {/* nut */}
        <rect x={rectX(boardX - 5, 5)} y={top} width={5} height={bot - top} rx="1.5" fill="var(--ink)" />

        {/* strings */}
        {Array.from({ length: stringCount }, (_, r) => r).map((r) => {
          const s = rowToString(r);
          const y = yRow(r);
          return (
            <line
              key={`s${r}`}
              x1={px(boardX - 46)}
              y1={y}
              x2={px(boardEnd)}
              y2={y}
              stroke="var(--string)"
              strokeWidth={0.9 + (1 - s / Math.max(1, stringCount - 1)) * 1.1}
            />
          );
        })}

        {/* out of play: behind the capo, or outside the quiz range */}
        {capo > 0 && (
          <rect
            x={rectX(boardX, Math.max(0, capoBarX - boardX))}
            y={top}
            width={Math.max(0, capoBarX - boardX)}
            height={bot - top}
            fill="var(--muted)"
            opacity="0.2"
          />
        )}
        {quizActive && quizRange[0] > 0 && (
          <rect
            x={rectX(boardX, Math.max(0, fretX(quizRange[0] - 1) - boardX))}
            y={top}
            width={Math.max(0, fretX(quizRange[0] - 1) - boardX)}
            height={bot - top}
            fill="var(--muted)"
            opacity="0.16"
          />
        )}
        {quizActive && quizRange[1] < fretCount && (
          <rect
            x={rectX(fretX(quizRange[1]), boardEnd - fretX(quizRange[1]))}
            y={top}
            width={Math.max(0, boardEnd - fretX(quizRange[1]))}
            height={bot - top}
            fill="var(--muted)"
            opacity="0.16"
          />
        )}

        {/* capo bar on the neck */}
        {capo > 0 && (
          <rect x={rectX(capoBarX - 2.5, 5)} y={top - 4} width={5} height={bot - top + 8} rx="2.5" fill="var(--ink)" pointerEvents="none" />
        )}

        {/* fret numbers */}
        {Array.from({ length: fretCount + 1 }, (_, k) => k).map((k) => {
          const marked = k === 0 || SINGLE_DOTS.includes(k) || DOUBLE_DOTS.includes(k);
          return (
            <text
              key={`n${k}`}
              x={px(k === 0 ? boardX - 30 : cellX(k))}
              y={bot + 17}
              textAnchor="middle"
              className="fretnum"
              fontSize="10"
              fill={marked ? "var(--ink)" : "var(--muted)"}
            >
              {k}
            </text>
          );
        })}

        {/* barre bar */}
        {barre &&
          (() => {
            const rows = [];
            for (let r = 0; r < stringCount; r++) {
              const st = rowToString(r);
              if (st >= barre.from && st <= barre.to) rows.push(r);
            }
            if (!rows.length) return null;
            const y1 = yRow(Math.min.apply(null, rows));
            const y2 = yRow(Math.max.apply(null, rows));
            const x = cellX(barre.fret);
            return (
              <rect x={rectX(x - 10, 20)} y={y1 - 10} width={20} height={y2 - y1 + 20} rx="10" fill="var(--barre)" pointerEvents="none" />
            );
          })()}

        {/* cells and notes */}
        {Array.from({ length: stringCount }, (_, r) => r).map((r) => {
          const s = rowToString(r);
          const y = yRow(r);
          return Array.from({ length: fretCount + 1 }, (_, k) => k).map((k) => {
            const x = cellX(k);
            const key = `${s}:${k}`;
            const mark = marks.get(key) || null;
            const ghost = !mark && ghosts && ghosts.has(key);
            const isFlash = flash && flash.key === key;
            const dead = capo > 0 && k < capo;
            const w = cellW(k);
            return (
              <g key={key} opacity={mark && mark.state === "dim" ? 0.24 : 1}>
                <rect
                  x={rectX(x - w / 2, w)}
                  y={y - Math.min(15, gap * 0.5)}
                  width={w}
                  height={Math.min(30, gap)}
                  fill="transparent"
                  style={{ cursor: onCell ? "pointer" : "default" }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    if (onCell) onCell(s, k, midis[s] + k);
                  }}
                />
                {ghost && !dead && <circle cx={px(x)} cy={y} r="3.5" fill="var(--muted)" opacity="0.5" pointerEvents="none" />}
                {isFlash && (
                  <circle
                    cx={px(x)}
                    cy={y}
                    r="12"
                    fill="none"
                    stroke={flash.ok ? "#12A19A" : "#D2544F"}
                    strokeWidth="2.5"
                    className="ping"
                    pointerEvents="none"
                  />
                )}
                {mark && !dead && (
                  <NoteDot x={px(x)} y={y} mark={mark} flats={flats} labelMode={labelMode} colourMode={colourMode} maxW={w} />
                )}
              </g>
            );
          });
        })}

        {/* keyboard cursor, visible while the neck has focus */}
        {kb && (
          <rect
            x={rectX(cellX(kb.f) - cellW(kb.f) / 2, cellW(kb.f))}
            y={yRow(kb.r) - Math.min(15, gap * 0.5)}
            width={cellW(kb.f)}
            height={Math.min(30, gap)}
            rx="6"
            fill="none"
            stroke="var(--gold)"
            strokeWidth="2.5"
            pointerEvents="none"
          />
        )}
      </svg>
      <div className="srlive" aria-live="polite" role="status">
        {announce}
      </div>
    </>
  );
}

function NoteDot({ x, y, mark, flats, labelMode, colourMode, maxW }) {
  const semis = mark.semis;
  let fill = "var(--dotplain)";
  let stroke = "var(--board)";
  let text = "var(--onink)";

  if (colourMode === "interval") {
    const c = FUNC_COLOUR[semis] || "var(--dotplain)";
    if (LOWERED.has(semis)) {
      fill = "var(--board)";
      stroke = c;
      text = c;
    } else {
      fill = c;
      text = semis === 0 ? "#26200C" : "#FFFFFF";
    }
  } else if (colourMode === "root") {
    if (semis === 0) {
      fill = "#E9A824";
      text = "#26200C";
    } else if (mark.tone === "chord") {
      fill = "#12A19A";
      text = "#FFFFFF";
    } else {
      fill = "var(--dotplain)";
      text = "var(--onink)";
    }
  } else {
    fill = semis === 0 ? "#E9A824" : "var(--dotplain)";
    text = semis === 0 ? "#26200C" : "var(--onink)";
  }

  const pill = labelMode === "both";
  const label =
    mark.custom != null
      ? mark.custom
      : labelMode === "none"
        ? ""
        : labelMode === "finger"
          ? mark.finger != null
            ? String(mark.finger)
            : ""
          : labelMode === "degree"
            ? DEG[semis]
            : labelMode === "both"
              ? `${DEG[semis]} ${nameOf(mark.pc, flats)}`
              : nameOf(mark.pc, flats);

  const w = Math.max(24, Math.min(36, (maxW || 36) - 3));
  const lit = mark.state === "lit";

  return (
    <g pointerEvents="none" className={mark.state === "found" ? "pop" : "dot"}>
      {lit &&
        (pill ? (
          <rect x={x - w / 2 - 4} y={y - 13} width={w + 8} height={26} rx="13" fill="none" stroke="#E9A824" strokeWidth="3" />
        ) : (
          <circle cx={x} cy={y} r="15" fill="none" stroke="#E9A824" strokeWidth="3" />
        ))}
      {pill ? (
        <rect x={x - w / 2} y={y - 9} width={w} height="18" rx="9" fill={fill} stroke={stroke} strokeWidth="2" />
      ) : (
        <circle cx={x} cy={y} r="11" fill={fill} stroke={stroke} strokeWidth="2" />
      )}
      {label && (
        <text x={x} y={y + 3.4} textAnchor="middle" fontSize={pill ? 9 : label.length > 2 ? 8.5 : 10} className="dotlabel" fill={text}>
          {label}
        </text>
      )}
    </g>
  );
}

/* ============================================================
   MINI CHORD DIAGRAM
   ============================================================ */

/* spoken description of a shape for screen readers: string by string, low to high */
function describeVoicing(voicing, midis, flats) {
  const n = midis.length;
  const parts = [];
  for (let st = 0; st < n; st++) {
    const f = voicing.frets[st];
    const num = n - st;
    if (f === null) parts.push(`string ${num} muted`);
    else if (f === 0) parts.push(`string ${num} open, ${nameOf(midis[st] % 12, flats)}`);
    else {
      const fin = voicing.fingering ? voicing.fingering[st] : null;
      parts.push(`string ${num} fret ${f}${fin ? ` finger ${fin}` : ""}, ${nameOf((midis[st] + f) % 12, flats)}`);
    }
  }
  const barre = voicing.barreFret != null ? ` Barre across fret ${voicing.barreFret}.` : "";
  return parts.join("; ") + "." + barre;
}

export function ChordDiagram({ voicing, midis, rootPc, capo, selected, onSelect, flats, showDegrees, title, caption, lefty }) {
  /* standard chord diagrams put the low E on the left; a left-handed player mirrors it */
  const colToString = (i) => (lefty ? midis.length - 1 - i : i);
  const n = midis.length;
  const S = 1.5;
  const W = 15 * S; // column pitch
  const PADX = 13 * S; // left inset
  const TOP = 17 * S; // y of the nut line
  const RH = 17 * S; // fret row height
  const R = 6.2 * S; // dot radius
  const rows = 5;
  const w = (n - 1) * W + 26 * S;
  const h = rows * RH + 34 * S;
  const base = Math.max(capo + 1, voicing.lowest);
  const openish = capo;
  const cols = Array.from({ length: n }, (_, i) => i);

  return (
    <button
      className={`voicing ${selected ? "sel" : ""}`}
      onClick={() => onSelect?.(voicing)}
      aria-pressed={selected}
      aria-label={`${title || "Chord shape"}${caption ? `, ${caption}` : ""}. ${describeVoicing(voicing, midis, flats)}`}
    >
      {title && (
        <span className="vtitle">
          {title}
          {caption && <em>{caption}</em>}
        </span>
      )}
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {cols.map((i) => {
          const st = colToString(i);
          const f = voicing.frets[st];
          return (
            <text
              key={`t${i}`}
              x={PADX + i * W}
              y={TOP - 7}
              textAnchor="middle"
              fontSize={9 * S}
              className="fretnum"
              fill={f === null ? "var(--red)" : "var(--muted)"}
            >
              {f === null ? "\u00d7" : f === openish ? "\u25cb" : ""}
            </text>
          );
        })}
        <line
          x1={PADX}
          y1={TOP}
          x2={PADX + (n - 1) * W}
          y2={TOP}
          stroke={base === capo + 1 ? "var(--ink)" : "var(--line2)"}
          strokeWidth={base === capo + 1 ? 3 * S : 1.2 * S}
        />
        {Array.from({ length: rows }, (_, r) => (
          <line
            key={`h${r}`}
            x1={PADX}
            y1={TOP + (r + 1) * RH}
            x2={PADX + (n - 1) * W}
            y2={TOP + (r + 1) * RH}
            stroke="var(--line)"
            strokeWidth="1"
          />
        ))}
        {cols.map((i) => (
          <line key={`v${i}`} x1={PADX + i * W} y1={TOP} x2={PADX + i * W} y2={TOP + rows * RH} stroke="var(--line)" strokeWidth="1" />
        ))}
        {base > capo + 1 && (
          <text x={PADX * 0.34} y={TOP + RH * 0.62} textAnchor="middle" fontSize={9 * S} className="fretnum" fill="var(--goldtext)">
            {base}
          </text>
        )}
        {voicing.barreFret != null &&
          voicing.barreFret - base >= 0 &&
          voicing.barreFret - base < rows &&
          (() => {
            const cFrom = lefty ? n - 1 - voicing.barreTo : voicing.barreFrom;
            const cTo = lefty ? n - 1 - voicing.barreFrom : voicing.barreTo;
            return (
              <rect
                x={PADX + cFrom * W - R}
                y={TOP + (voicing.barreFret - base) * RH + RH / 2 - R}
                width={(cTo - cFrom) * W + R * 2}
                height={R * 2}
                rx={R}
                fill="var(--dotplain)"
              />
            );
          })()}
        {cols.map((i) => {
          const st = colToString(i);
          const f = voicing.frets[st];
          if (f === null || f === openish) return null;
          const row = f - base;
          if (row < 0 || row >= rows) return null;
          const x = PADX + i * W;
          const y = TOP + row * RH + RH / 2;
          const semis = (((midis[st] + f) % 12) - rootPc + 24) % 12;
          const isRoot = semis === 0;
          return (
            <g key={`d${i}`}>
              <circle cx={x} cy={y} r={R} fill={isRoot ? "#E9A824" : "var(--dotplain)"} stroke="var(--board)" strokeWidth="1" />
              <text x={x} y={y + 3.6} textAnchor="middle" fontSize={8 * S} className="dotlabel" fill={isRoot ? "#26200C" : "var(--onink)"}>
                {showDegrees ? DEG[semis] : (voicing.fingering && voicing.fingering[st]) || ""}
              </text>
            </g>
          );
        })}
      </svg>
      <span className="vmeta">
        {voicing.barre ? "barre" : `${voicing.fingers} fing`}
        {voicing.inversion ? ` \u00b7 /${nameOf(voicing.bassPc, flats)}` : ""}
      </span>
    </button>
  );
}
