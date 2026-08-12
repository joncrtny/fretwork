import { useCallback, useEffect, useMemo, useState } from "react";
import { SCALES, SIMPLE_SCALES, DEG, FUNC_COLOUR, nameOf, keyPrefersFlats } from "../theory.ts";
import { SCALE_GROUPS } from "../data/groups.js";
import { groupItems } from "../lib/utils.ts";
import { track } from "../lib/analytics.ts";
import { neckPositions } from "../fretboard.jsx";
import { Field } from "../components/Field.jsx";
import { Seg } from "../components/Seg.jsx";
import { KeyPicker } from "../components/KeyPicker.jsx";
import { CatPicker } from "../components/CatPicker.jsx";
import { StarSave } from "../components/SaveButtons.jsx";
import { KnownButton } from "../components/SaveButtons.jsx";
import { useSettings } from "../state/SettingsContext.tsx";
import { useSelection } from "../state/SelectionContext.tsx";
import { usePlayback } from "../state/PlaybackContext.jsx";
import { useLibrary } from "../state/LibraryContext.jsx";
import { usePublishFretboard } from "../state/FretboardContext.tsx";

const EMPTY = new Set();

/* Scales across the neck: pick a key and scale, narrow to a position, hear it
   played. Owns its neck config (marks with the position window + playing
   highlight), its play scheduler and position/label state; publishes the neck
   through the fretboard slot. `carryKey` navigates to another view in the same
   key (shell-owned, since it calls setMode). */
export function ScaleView({ carryKey }) {
  const { settings, midis, n, fretCount, capo } = useSettings();
  const { scaleRoot, setScaleRoot, scaleId, setScaleId, restorePosRef, posNonce } = useSelection();
  const { playing, setPlaying, stopPlayback, playTimers, playNote } = usePlayback();
  const { known, toggleKnown, bank, saveToBank } = useLibrary();

  const [scalePos, setScalePos] = useState(null);
  const [scaleLabel, setScaleLabel] = useState("name");

  const scaleDef = SCALES.find((s) => s.id === scaleId) || SCALES[0];
  const flats = settings.noteNames === "sharps" ? false : settings.noteNames === "flats" ? true : keyPrefersFlats(scaleRoot, scaleDef.iv);

  const positions = useMemo(() => {
    const set = new Set(scaleDef.iv.map((i) => i % 12));
    const span = 4;
    const out = [];
    for (let f = capo; f <= fretCount - span && out.length < set.size; f++) {
      const semis = (((midis[0] + f) % 12) - scaleRoot + 24) % 12;
      if (!set.has(semis)) continue;
      out.push({ from: f, to: f + span, deg: semis });
    }
    return out;
  }, [scaleDef, scaleRoot, midis, fretCount, capo]);

  /* restore a saved position when arriving from Bank/share, else reset */
  useEffect(() => {
    const r = restorePosRef.current;
    if (r && r.kind === "scale") {
      setScalePos(r.pos);
      restorePosRef.current = null;
      return;
    }
    setScalePos(null);
  }, [scaleId, scaleRoot, settings.tuningId, capo, fretCount, posNonce, restorePosRef]);

  const marks = useMemo(() => {
    const map = new Map();
    const set = new Set(scaleDef.iv.map((i) => i % 12));
    const win = scalePos != null ? positions[scalePos] : null;
    for (const p of neckPositions(scaleRoot, set, midis, n, fretCount, capo)) {
      const outside = win && (p.f < win.from || p.f > win.to);
      const state = outside ? "dim" : playing != null ? (p.semis === playing ? "lit" : "dim") : null;
      map.set(`${p.s}:${p.f}`, { pc: p.pc, semis: p.semis, tone: "scale", state: state || "on", finger: null });
    }
    return map;
  }, [scaleDef, scaleRoot, scalePos, positions, playing, midis, n, fretCount, capo]);

  const onCell = useCallback(
    (s, f, midi) => {
      if (capo > 0 && f > 0 && f < capo) return;
      playNote(midi);
    },
    [capo, playNote],
  );

  usePublishFretboard(
    useMemo(
      () => ({
        marks,
        onCell,
        flats,
        labelMode: scaleLabel,
        colourMode: settings.colourMode,
        barre: null,
        ghosts: EMPTY,
        quizActive: false,
        quizRange: undefined,
      }),
      [marks, onCell, flats, scaleLabel, settings.colourMode],
    ),
  );

  const playScale = useCallback(() => {
    stopPlayback();
    const set = new Set(scaleDef.iv.map((i) => i % 12));
    const win = scalePos != null ? positions[scalePos] : null;
    let seq;
    if (win) {
      /* play the notes as they lie in the chosen position, low to high */
      const seen = new Set();
      seq = neckPositions(scaleRoot, set, midis, n, fretCount, capo, win.from, win.to)
        .map((p) => ({ midi: midis[p.s] + p.f, semis: p.semis }))
        .filter((nt) => (seen.has(nt.midi) ? false : (seen.add(nt.midi), true)))
        .sort((a, b) => a.midi - b.midi);
    } else {
      const rootMidi = midis[0] + ((scaleRoot - (midis[0] % 12) + 24) % 12) + 12;
      seq = scaleDef.iv
        .map((i) => i % 12)
        .concat([0])
        .map((iv, i, arr) => ({ midi: rootMidi + (i === arr.length - 1 ? 12 : iv), semis: iv }));
    }
    const STEP = win ? 0.34 : 0.52;
    seq.forEach((nt, i) => {
      playNote(nt.midi, i * STEP);
      playTimers.current.push(setTimeout(() => setPlaying(nt.semis), i * STEP * 1000));
    });
    playTimers.current.push(setTimeout(() => setPlaying(null), seq.length * STEP * 1000));
  }, [scaleDef, scaleRoot, midis, n, fretCount, capo, playNote, stopPlayback, scalePos, positions, playTimers, setPlaying]);

  return (
    <div className="pane">
      <p className="panelead">
        Map out any scale across the fretboard in any key, hear it played, and learn its shapes position by position.
      </p>
      <div className="knownrow">
        <KnownButton
          known={known.some((k) => k.sig === `k-scale:${scaleRoot}:${scaleId}`)}
          onClick={() =>
            toggleKnown({
              sig: `k-scale:${scaleRoot}:${scaleId}`,
              kind: "scale",
              root: scaleRoot,
              id: scaleId,
              label: `${nameOf(scaleRoot, flats)} ${scaleDef.name}`,
            })
          }
        />
      </div>
      <div className="row wrap">
        <Field label="Key">
          <KeyPicker value={scaleRoot} onChange={setScaleRoot} flats={flats} />
        </Field>
        <Field label="Scale">
          <CatPicker
            value={scaleId}
            onChange={setScaleId}
            label="Scale"
            groups={groupItems(SCALE_GROUPS, SCALES, SIMPLE_SCALES, settings.simple, scaleId)}
          />
        </Field>
        <button
          className={`btn primary ${playing != null ? "live" : ""}`}
          onClick={
            playing != null
              ? stopPlayback
              : () => {
                  track("hear_scale", { scale: scaleId });
                  playScale();
                }
          }
          data-tip="Play the scale and light each note as it sounds"
        >
          {playing != null ? "Stop" : "Hear it"}
        </button>
        <StarSave
          label={`${nameOf(scaleRoot, flats)} ${scaleDef.name}`}
          saved={bank.some((b) => b.sig === `scale:${scaleRoot}:${scaleId}:${scalePos == null ? "all" : scalePos}`)}
          onClick={() =>
            saveToBank({
              id: `b${Date.now()}`,
              sig: `scale:${scaleRoot}:${scaleId}:${scalePos == null ? "all" : scalePos}`,
              kind: "scale",
              root: scaleRoot,
              scaleId,
              pos: scalePos,
              tun: settings.tuningId,
              label: `${nameOf(scaleRoot, flats)} ${scaleDef.name}${scalePos == null ? "" : ` · pos ${scalePos + 1}`}`,
            })
          }
        />
      </div>

      <Field label="Position">
        <div className="posrow">
          <button className={`poschip ${scalePos == null ? "on" : ""}`} onClick={() => setScalePos(null)} data-tip="Every position at once">
            Whole neck
          </button>
          {positions.map((pos, i) => (
            <button
              key={i}
              className={`poschip ${scalePos === i ? "on" : ""}`}
              onClick={() => setScalePos(i)}
              data-tip={`Frets ${pos.from} to ${pos.to}, starting on the ${DEG[pos.deg]}`}
            >
              {i + 1}
            </button>
          ))}
          {scalePos != null && positions[scalePos] && (
            <span className="poshint">
              Frets {positions[scalePos].from} to {positions[scalePos].to}
            </span>
          )}
        </div>
      </Field>
      <Field label="Neck shows">
        <Seg
          small
          options={[
            { v: "both", l: "Degree + note" },
            { v: "name", l: "Notes" },
            { v: "degree", l: "Degrees" },
            { v: "none", l: "Blank" },
          ]}
          value={scaleLabel}
          onChange={setScaleLabel}
        />
      </Field>
      <div className="degrees">
        {scaleDef.iv.map((iv) => (
          <span key={iv} className="chip" style={{ borderColor: FUNC_COLOUR[iv % 12] }}>
            <b style={{ color: FUNC_COLOUR[iv % 12] }}>{DEG[iv % 12]}</b>
            {nameOf(scaleRoot + iv, flats)}
          </span>
        ))}
      </div>
      <div className="keyjump">
        <span className="note">In {nameOf(scaleRoot, flats)}:</span>
        <button className="jumpchip" onClick={() => carryKey("chord", scaleRoot)}>
          Chords
        </button>
        <button className="jumpchip" onClick={() => carryKey("arp", scaleRoot)}>
          Arpeggios
        </button>
        {!settings.simple && (
          <button className="jumpchip" onClick={() => carryKey("prog", scaleRoot)}>
            Progressions
          </button>
        )}
      </div>
    </div>
  );
}
