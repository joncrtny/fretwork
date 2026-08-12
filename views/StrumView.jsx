import { useCallback, useEffect, useMemo, useState } from "react";
import { CHORDS, SIMPLE_CHORDS, STRUM_PATTERNS, nameOf, keyPrefersFlats } from "../theory.ts";
import { CHORD_GROUPS } from "../data/groups.js";
import { groupItems } from "../lib/utils.ts";
import { ctx, playClick } from "../audio.ts";
import { ChordDiagram } from "../fretboard.jsx";
import { Field } from "../components/Field.jsx";
import { KeyPicker } from "../components/KeyPicker.jsx";
import { CatPicker } from "../components/CatPicker.jsx";
import { useSettings } from "../state/SettingsContext.tsx";
import { useSelection } from "../state/SelectionContext.tsx";
import { usePlayback } from "../state/PlaybackContext.tsx";
import { usePublishFretboard } from "../state/FretboardContext.tsx";
import { usePublishReadout } from "../state/ReadoutContext.tsx";
import { useChordVoicings } from "../hooks/useChordVoicings.ts";

const EMPTY = new Set();

/* Strum along: pick a chord and a pattern, hit Play, and the groove loops until
   Stop. Shares the voicing engine (useChordVoicings) and the playback loop refs
   with the shell, owns the pattern choice and the click toggle, and publishes
   the neck (the shape being strummed) and the readout. */
export function StrumView() {
  const { settings, setSettings, midis, n, capo } = useSettings();
  const { chordRoot, setChordRoot, chordId, setChordId } = useSelection();
  const { playNote, stopPlayback, strumOn, setStrumOn, strumStep, setStrumStep, strumLoopRef, scheduleStrumRef, playTimers } =
    usePlayback();
  const { chordDef, activeVoicing } = useChordVoicings(true);

  const [strumPatId, setStrumPatId] = useState("oldfaithful");
  const [strumClick, setStrumClick] = useState(false); // play the metronome click along with the strum

  /* Simple mode only offers the simple patterns, so fall back if one is dropped */
  useEffect(() => {
    if (settings.simple) {
      const p = STRUM_PATTERNS.find((x) => x.id === strumPatId);
      if (p && !p.simple) setStrumPatId("oldfaithful");
    }
  }, [settings.simple, strumPatId]);

  const flats = settings.noteNames === "sharps" ? false : settings.noteNames === "flats" ? true : keyPrefersFlats(chordRoot, chordDef.iv);

  const marks = useMemo(() => {
    const map = new Map();
    if (activeVoicing) {
      for (let s = 0; s < n; s++) {
        const f = activeVoicing.frets[s];
        if (f === null) continue;
        const pc = (midis[s] + f) % 12;
        map.set(`${s}:${f}`, { pc, semis: (pc - chordRoot + 12) % 12, tone: "chord", state: "on", finger: null });
      }
    }
    return map;
  }, [activeVoicing, midis, n, chordRoot]);

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
        labelMode: settings.labelMode,
        colourMode: settings.colourMode,
        barre: null,
        ghosts: EMPTY,
        quizActive: false,
        quizRange: undefined,
      }),
      [marks, onCell, flats, settings.labelMode, settings.colourMode],
    ),
  );

  usePublishReadout(`Strumming · ${nameOf(chordRoot, flats)}${chordDef.suffix}`);

  /* one strum of the current chord: down runs low string to high, up reverses */
  const strumChord = useCallback(
    (dir, accent = false, at = 0) => {
      if (!activeVoicing) return;
      const notes = [];
      for (let s = 0; s < n; s++) {
        const f = activeVoicing.frets[s];
        if (f !== null) notes.push(midis[s] + f);
      }
      const seq = dir === "u" ? notes.slice().reverse() : notes;
      const gain = accent ? 0.7 : 0.4;
      seq.forEach((m, i) => playNote(m, at + i * 0.024, gain));
    },
    [activeVoicing, midis, n, playNote],
  );

  /* schedule one cycle of bars, then re-arm the next so the groove loops until
     Stop (re-syncing to the audio clock each cycle keeps the timing honest) */
  const scheduleStrumCycle = useCallback(() => {
    const pat = STRUM_PATTERNS.find((p) => p.id === strumPatId) || STRUM_PATTERNS[0];
    const slotSec = 60 / settings.bpm / 2; // an eighth note
    const BARS = 8;
    for (let loop = 0; loop < BARS; loop++) {
      for (let sl = 0; sl < 8; sl++) {
        const idx = loop * 8 + sl;
        const stroke = pat.slots[sl];
        playTimers.current.push(
          setTimeout(
            () => {
              setStrumStep(sl);
              /* an uppercase slot (D/U) is an accented, louder strum */
              if (stroke) strumChord(stroke.toLowerCase(), stroke === stroke.toUpperCase());
              /* click on each beat (every second eighth), accented on the downbeat */
              if (strumClick && settings.sound && sl % 2 === 0) {
                const ac = ctx();
                if (ac) playClick(settings.clickSound, ac.currentTime, sl === 0);
              }
            },
            idx * slotSec * 1000,
          ),
        );
      }
    }
    playTimers.current.push(
      setTimeout(
        () => {
          if (strumLoopRef.current) scheduleStrumRef.current();
        },
        BARS * 8 * slotSec * 1000,
      ),
    );
  }, [
    strumPatId,
    settings.bpm,
    settings.clickSound,
    settings.sound,
    strumClick,
    strumChord,
    playTimers,
    scheduleStrumRef,
    setStrumStep,
    strumLoopRef,
  ]);

  useEffect(() => {
    scheduleStrumRef.current = scheduleStrumCycle;
  }, [scheduleStrumCycle, scheduleStrumRef]);

  const playStrum = useCallback(() => {
    if (!activeVoicing) return;
    stopPlayback();
    setStrumOn(true);
    strumLoopRef.current = true;
    scheduleStrumCycle();
  }, [activeVoicing, stopPlayback, scheduleStrumCycle, setStrumOn, strumLoopRef]);

  return (
    <div className="pane">
      <p className="note">
        Pick a chord and a strumming pattern, hit Play, and strum along in time. A down arrow is a downstroke (low strings to high), an up
        arrow is an upstroke. Set the tempo to suit you.
      </p>

      <div className="row wrap">
        <Field label="Root">
          <KeyPicker value={chordRoot} onChange={setChordRoot} flats={flats} />
        </Field>
        <Field label="Chord">
          <CatPicker
            value={chordId}
            onChange={setChordId}
            label="Chord type"
            groups={groupItems(CHORD_GROUPS, CHORDS, SIMPLE_CHORDS, settings.simple, chordId)}
          />
        </Field>
      </div>

      {activeVoicing && (
        <div className="voicings">
          <div className="voicewrap">
            <ChordDiagram
              voicing={activeVoicing}
              lefty={settings.leftHanded}
              midis={midis}
              rootPc={chordRoot}
              capo={capo}
              flats={flats}
              showDegrees={false}
              selected
            />
          </div>
        </div>
      )}

      <Field label="Pattern">
        <div className="row wrap">
          {STRUM_PATTERNS.filter((p) => !settings.simple || p.simple).map((p) => (
            <button
              key={p.id}
              aria-pressed={strumPatId === p.id}
              className={`btn ${strumPatId === p.id ? "primary" : "ghost"}`}
              onClick={() => {
                if (strumOn) stopPlayback();
                setStrumPatId(p.id);
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      </Field>

      <div className="strumbar" role="group" aria-label="Strum pattern. Bold arrows are accented.">
        {(STRUM_PATTERNS.find((p) => p.id === strumPatId) || STRUM_PATTERNS[0]).slots.map((st, i) => {
          const dir = st ? st.toLowerCase() : null;
          const accent = st && st === st.toUpperCase();
          return (
            <div key={i} className={`strumslot ${strumStep === i ? "on" : ""} ${i % 2 === 0 ? "beat" : ""} ${accent ? "accent" : ""}`}>
              <span className="strumarrow" aria-hidden="true">
                {dir === "d" ? "↓" : dir === "u" ? "↑" : ""}
              </span>
              <span className="strumcount">{i % 2 === 0 ? String(i / 2 + 1) : "&"}</span>
            </div>
          );
        })}
      </div>

      <div className="row wrap actions">
        <button className={`btn primary ${strumOn ? "live" : ""}`} onClick={strumOn ? stopPlayback : playStrum} disabled={!activeVoicing}>
          {strumOn ? "Stop" : "Play"}
        </button>
        <Field label="Tempo">
          <div className="row">
            <button className="mini" aria-label="Slower" onClick={() => setSettings((s) => ({ ...s, bpm: Math.max(40, s.bpm - 5) }))}>
              {"−"}5
            </button>
            <b className="barcount">{settings.bpm}</b>
            <button className="mini" aria-label="Faster" onClick={() => setSettings((s) => ({ ...s, bpm: Math.min(240, s.bpm + 5) }))}>
              +5
            </button>
          </div>
        </Field>
        <button
          className={`btn ${strumClick ? "primary" : "ghost"}`}
          aria-pressed={strumClick}
          onClick={() => setStrumClick((v) => !v)}
          data-tip="Play the metronome click on each beat, at this tempo"
        >
          Click: {strumClick ? "on" : "off"}
        </button>
      </div>
    </div>
  );
}
