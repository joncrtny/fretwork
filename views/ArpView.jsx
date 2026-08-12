import { useCallback, useEffect, useMemo, useState } from "react";
import { CHORDS, SIMPLE_CHORDS, DEG, FUNC_COLOUR, nameOf, keyPrefersFlats } from "../theory.js";
import { CHORD_GROUPS } from "../data/groups.js";
import { groupItems } from "../lib/utils.ts";
import { track } from "../lib/analytics.ts";
import { neckPositions } from "../fretboard.jsx";
import { Field } from "../components/Field.jsx";
import { Seg } from "../components/Seg.jsx";
import { KeyPicker } from "../components/KeyPicker.jsx";
import { CatPicker } from "../components/CatPicker.jsx";
import { StarSave } from "../components/SaveButtons.jsx";
import { KnownButton } from "../components/SaveButtons.jsx";
import { useSettings } from "../state/SettingsContext.jsx";
import { useSelection } from "../state/SelectionContext.jsx";
import { usePlayback } from "../state/PlaybackContext.jsx";
import { useLibrary } from "../state/LibraryContext.jsx";
import { usePublishFretboard } from "../state/FretboardContext.jsx";

const EMPTY = new Set();

/* Arpeggios across the neck: the mirror of ScaleView, plus a play direction and
   a "play order" label mode that numbers the tones in the chosen direction.
   Owns arpDir/arpPos/arpLabel locally; arpRoot/arpId live in Selection so
   carryKey can set them from other views. */
export function ArpView({ carryKey }) {
  const { settings, midis, n, fretCount, capo } = useSettings();
  const { arpRoot, setArpRoot, arpId, setArpId, restorePosRef, posNonce } = useSelection();
  const { playing, setPlaying, stopPlayback, playTimers, playNote } = usePlayback();
  const { known, toggleKnown, bank, saveToBank } = useLibrary();

  const [arpDir, setArpDir] = useState("up");
  const [arpPos, setArpPos] = useState(null);
  const [arpLabel, setArpLabel] = useState("name");

  const arpDef = CHORDS.find((c) => c.id === arpId) || CHORDS[0];
  const flats = settings.noteNames === "sharps" ? false : settings.noteNames === "flats" ? true : keyPrefersFlats(arpRoot, arpDef.iv);

  const arpPositions = useMemo(() => {
    const set = new Set(arpDef.iv.map((i) => i % 12));
    const span = 4;
    const out = [];
    for (let f = capo; f <= fretCount - span && out.length < set.size; f++) {
      const semis = (((midis[0] + f) % 12) - arpRoot + 24) % 12;
      if (!set.has(semis)) continue;
      out.push({ from: f, to: f + span, deg: semis });
    }
    return out;
  }, [arpDef, arpRoot, midis, fretCount, capo]);

  useEffect(() => {
    const r = restorePosRef.current;
    if (r && r.kind === "arp") {
      setArpPos(r.pos);
      if (r.dir) setArpDir(r.dir);
      restorePosRef.current = null;
      return;
    }
    setArpPos(null);
  }, [arpId, arpRoot, settings.tuningId, capo, fretCount, posNonce, restorePosRef]);

  useEffect(() => {
    if (settings.simple && (arpDir === "thirds" || arpDir === "pedal")) setArpDir("up");
  }, [settings.simple, arpDir]);

  const marks = useMemo(() => {
    const map = new Map();
    const set = new Set(arpDef.iv.map((i) => i % 12));
    const win = arpPos != null ? arpPositions[arpPos] : null;
    const inWindow = [];
    for (const p of neckPositions(arpRoot, set, midis, n, fretCount, capo)) {
      const outside = win && (p.f < win.from || p.f > win.to);
      const state = outside ? "dim" : playing != null ? (p.semis === playing ? "lit" : "dim") : null;
      map.set(`${p.s}:${p.f}`, { pc: p.pc, semis: p.semis, tone: "arp", state: state || "on", finger: null });
      if (!outside) inWindow.push({ key: `${p.s}:${p.f}`, midi: midis[p.s] + p.f });
    }
    /* play-order numbers reflect the chosen direction: ascending for up, descending for down */
    if (arpLabel === "order") {
      const sorted = [...inWindow].sort((a, b) => a.midi - b.midi);
      const down = arpDir === "down" || arpDir === "downup";
      sorted.forEach((nt, idx) => {
        const m = map.get(nt.key);
        if (m) m.custom = String(down ? sorted.length - idx : idx + 1);
      });
    }
    return map;
  }, [arpDef, arpRoot, arpPos, arpPositions, arpLabel, arpDir, playing, midis, n, fretCount, capo]);

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
        labelMode: arpLabel,
        colourMode: settings.colourMode,
        barre: null,
        ghosts: EMPTY,
        quizActive: false,
        quizRange: undefined,
      }),
      [marks, onCell, flats, arpLabel, settings.colourMode],
    ),
  );

  const playArpeggio = useCallback(() => {
    stopPlayback();
    const set = new Set(arpDef.iv.map((i) => i % 12));
    const win = arpPos != null ? arpPositions[arpPos] : null;
    let up;
    if (win) {
      /* play the chord tones as they lie in the chosen position, low to high */
      const seen = new Set();
      up = neckPositions(arpRoot, set, midis, n, fretCount, capo, win.from, win.to)
        .map((p) => midis[p.s] + p.f)
        .filter((m) => (seen.has(m) ? false : (seen.add(m), true)))
        .sort((a, b) => a - b);
    } else {
      let base = midis[0];
      let guard = 0;
      while (base % 12 !== arpRoot && guard++ < 12) base++;
      up = [];
      for (let oct = 0; oct < 2; oct++) arpDef.iv.forEach((i) => up.push(base + oct * 12 + i));
      up.push(base + 24);
    }
    let seq = up;
    if (arpDir === "down") seq = [...up].reverse();
    else if (arpDir === "updown") seq = [...up, ...[...up].reverse().slice(1)];
    else if (arpDir === "downup") seq = [...[...up].reverse(), ...up.slice(1)];
    else if (arpDir === "thirds") {
      seq = [];
      for (let i = 0; i + 2 < up.length; i++) seq.push(up[i], up[i + 2]);
    } else if (arpDir === "pedal") {
      seq = [];
      for (let i = 1; i < up.length; i++) seq.push(up[0], up[i]);
    }
    const STEP = 60 / settings.bpm / 2;
    seq.forEach((m, i) => {
      playTimers.current.push(
        setTimeout(
          () => {
            playNote(m);
            setPlaying(((((m % 12) - arpRoot) % 12) + 12) % 12);
          },
          i * STEP * 1000,
        ),
      );
    });
    playTimers.current.push(setTimeout(() => setPlaying(null), seq.length * STEP * 1000));
  }, [
    stopPlayback,
    midis,
    n,
    fretCount,
    capo,
    arpRoot,
    arpDef,
    arpDir,
    settings.bpm,
    playNote,
    arpPos,
    arpPositions,
    playTimers,
    setPlaying,
  ]);

  return (
    <div className="pane">
      <p className="panelead">Hear and see any arpeggio across the neck in any key, moving up, down or through the shape you choose.</p>
      <div className="knownrow">
        <KnownButton
          known={known.some((k) => k.sig === `k-arp:${arpRoot}:${arpId}`)}
          onClick={() =>
            toggleKnown({
              sig: `k-arp:${arpRoot}:${arpId}`,
              kind: "arp",
              root: arpRoot,
              id: arpId,
              label: `${nameOf(arpRoot, flats)}${arpDef.suffix} arpeggio`,
            })
          }
        />
      </div>
      <div className="row wrap">
        <Field label="Root">
          <KeyPicker value={arpRoot} onChange={setArpRoot} flats={flats} />
        </Field>
        <Field label="Arpeggio">
          <CatPicker
            value={arpId}
            onChange={setArpId}
            label="Arpeggio type"
            groups={groupItems(CHORD_GROUPS, CHORDS, SIMPLE_CHORDS, settings.simple, arpId)}
          />
        </Field>
        <Field label="Direction">
          <Seg
            small
            ariaLabel="Arpeggio direction"
            options={[
              { v: "up", l: "Up" },
              { v: "down", l: "Down" },
              { v: "updown", l: "Up-down" },
              { v: "downup", l: "Down-up" },
              ...(settings.simple
                ? []
                : [
                    { v: "thirds", l: "In thirds" },
                    { v: "pedal", l: "Pedal root" },
                  ]),
            ]}
            value={arpDir}
            onChange={setArpDir}
          />
        </Field>
        <button
          className={`btn primary ${playing != null ? "live" : ""}`}
          onClick={
            playing != null
              ? stopPlayback
              : () => {
                  track("hear_arp", { arp: arpId, dir: arpDir });
                  playArpeggio();
                }
          }
          data-tip="Play the arpeggio and light each tone, following the chosen position and direction"
        >
          {playing != null ? "Stop" : "Hear it"}
        </button>
        <StarSave
          label={`${nameOf(arpRoot, flats)}${arpDef.suffix} arpeggio`}
          saved={bank.some((b) => b.sig === `arp:${arpRoot}:${arpId}:${arpDir}:${arpPos == null ? "all" : arpPos}`)}
          onClick={() =>
            saveToBank({
              id: `b${Date.now()}`,
              sig: `arp:${arpRoot}:${arpId}:${arpDir}:${arpPos == null ? "all" : arpPos}`,
              kind: "arp",
              root: arpRoot,
              arpId,
              dir: arpDir,
              pos: arpPos,
              tun: settings.tuningId,
              label: `${nameOf(arpRoot, flats)}${arpDef.suffix} arpeggio${arpPos == null ? "" : ` · pos ${arpPos + 1}`}`,
            })
          }
        />
      </div>

      <div className="keyjump">
        <span className="note">In {nameOf(arpRoot, flats)}:</span>
        <button className="jumpchip" onClick={() => carryKey("scale", arpRoot)}>
          Scale
        </button>
        <button className="jumpchip" onClick={() => carryKey("chord", arpRoot)}>
          Chords
        </button>
      </div>

      <Field label="Position">
        <div className="posrow">
          <button className={`poschip ${arpPos == null ? "on" : ""}`} onClick={() => setArpPos(null)} data-tip="Every position at once">
            Whole neck
          </button>
          {arpPositions.map((pos, i) => (
            <button
              key={i}
              className={`poschip ${arpPos === i ? "on" : ""}`}
              onClick={() => setArpPos(i)}
              data-tip={`Frets ${pos.from} to ${pos.to}, starting on the ${DEG[pos.deg]}`}
            >
              {i + 1}
            </button>
          ))}
          {arpPos != null && arpPositions[arpPos] && (
            <span className="poshint">
              Frets {arpPositions[arpPos].from} to {arpPositions[arpPos].to}
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
            { v: "order", l: "Play order" },
            { v: "none", l: "Blank" },
          ]}
          value={arpLabel}
          onChange={setArpLabel}
        />
      </Field>

      <div className="degrees">
        {arpDef.iv.map((i) => (
          <span key={i} className="chip" style={{ borderLeftColor: FUNC_COLOUR[i % 12] }}>
            <b style={{ color: FUNC_COLOUR[i % 12] }}>{DEG[i % 12]}</b>
            {nameOf(arpRoot + i, flats)}
          </span>
        ))}
      </div>

      <p className="note">
        Every place these chord tones live on the neck. Narrow to one position, then follow the playback direction with your pick.
      </p>
    </div>
  );
}
