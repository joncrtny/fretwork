import { useCallback, useMemo, useState } from "react";
import { CHORDS, SIMPLE_CHORDS, nameOf, keyPrefersFlats } from "../theory.ts";
import { CHORD_GROUPS } from "../data/groups.js";
import { groupItems } from "../lib/utils.ts";
import { track } from "../lib/analytics.ts";
import { pluck } from "../audio.ts";
import { neckPositions, ChordDiagram } from "../fretboard.jsx";
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
import { useProgress } from "../state/ProgressContext.jsx";
import { usePublishFretboard } from "../state/FretboardContext.jsx";
import { usePublishReadout } from "../state/ReadoutContext.jsx";
import { useChordVoicings } from "../hooks/useChordVoicings.js";

/* Chords: playable shapes for any chord in any key, with a diagram per shape,
   a neck area filter, and the ghost-tone overlay. Owns its label/ghost toggles
   and the single-strum preview locally; the voicing engine is the shared
   useChordVoicings hook and the choice (root/type/area/shape) lives in
   Selection so carryKey and Bank restore reach it. Publishes both slots: the
   neck shows the selected shape, the readout counts the shapes. */
export function ChordView({ carryKey }) {
  const { settings, midis, n, fretCount, capo } = useSettings();
  const { chordRoot, setChordRoot, chordId, setChordId, chordArea, setChordArea, voiceIdx, setVoiceIdx } = useSelection();
  const { playNote } = usePlayback();
  const { known, toggleKnown, bank, saveToBank } = useLibrary();
  const { lastActiveRef } = useProgress();
  const { chordDef, chordAreas, shownVoicings, activeVoicing } = useChordVoicings(true);

  const [showAllTones, setShowAllTones] = useState(true);
  const [chordLabel, setChordLabel] = useState("finger");

  const flats = settings.noteNames === "sharps" ? false : settings.noteNames === "flats" ? true : keyPrefersFlats(chordRoot, chordDef.iv);

  const marks = useMemo(() => {
    const map = new Map();
    if (activeVoicing) {
      for (let s = 0; s < n; s++) {
        const f = activeVoicing.frets[s];
        if (f === null) continue;
        const pc = (midis[s] + f) % 12;
        map.set(`${s}:${f}`, {
          pc,
          semis: (pc - chordRoot + 24) % 12,
          tone: "chord",
          state: "on",
          finger: activeVoicing.fingering[s] == null ? null : activeVoicing.fingering[s],
        });
      }
    }
    return map;
  }, [activeVoicing, midis, n, chordRoot]);

  /* every other chord tone across the neck, dimmed behind the shape */
  const ghosts = useMemo(() => {
    if (!showAllTones) return null;
    const set = new Set(chordDef.iv.map((i) => i % 12));
    const g = new Set();
    for (const p of neckPositions(chordRoot, set, midis, n, fretCount, capo)) g.add(`${p.s}:${p.f}`);
    return g;
  }, [showAllTones, chordDef, chordRoot, midis, n, fretCount, capo]);

  const barre = useMemo(
    () =>
      activeVoicing && activeVoicing.barreFret != null
        ? { fret: activeVoicing.barreFret, from: activeVoicing.barreFrom, to: activeVoicing.barreTo }
        : null,
    [activeVoicing],
  );

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
        labelMode: chordLabel,
        colourMode: settings.colourMode,
        barre,
        ghosts,
        quizActive: false,
        quizRange: undefined,
      }),
      [marks, onCell, flats, chordLabel, settings.colourMode, barre, ghosts],
    ),
  );

  usePublishReadout(`${nameOf(chordRoot, flats)}${chordDef.suffix || ""} · ${shownVoicings.length} voicings`);

  const strumVoicing = useCallback(() => {
    if (!activeVoicing) return;
    let i = 0;
    for (let s = 0; s < n; s++) {
      const f = activeVoicing.frets[s];
      if (f === null) continue;
      playNote(midis[s] + f, i * 0.035);
      i++;
    }
  }, [activeVoicing, midis, n, playNote]);

  return (
    <div className="pane">
      <p className="panelead">Find playable shapes for any chord in any key, then hear and save the ones you want to learn.</p>
      <div className="knownrow">
        <KnownButton
          known={known.some((k) => k.sig === `k-chord:${chordRoot}:${chordId}`)}
          onClick={() =>
            toggleKnown({
              sig: `k-chord:${chordRoot}:${chordId}`,
              kind: "chord",
              root: chordRoot,
              id: chordId,
              label: `${nameOf(chordRoot, flats)}${chordDef.suffix}`,
            })
          }
        />
      </div>
      {shownVoicings.length === 0 ? (
        <p className="empty">
          No playable shape for {nameOf(chordRoot, flats)}
          {chordDef.suffix} in this tuning at this stretch. In Settings, widen Chord stretch or turn on Inversions.
        </p>
      ) : (
        <div className="voicings">
          {shownVoicings.map((v, i) => {
            const vsig = `chord:${chordRoot}:${chordId}:${v.key || ""}`;
            const label = `${nameOf(chordRoot, flats)}${chordDef.suffix} shape ${i + 1}`;
            return (
              <div key={v.key} className="voicewrap">
                <ChordDiagram
                  voicing={v}
                  lefty={settings.leftHanded}
                  midis={midis}
                  rootPc={chordRoot}
                  capo={capo}
                  flats={flats}
                  showDegrees={settings.labelMode === "degree"}
                  selected={i === Math.min(voiceIdx, shownVoicings.length - 1)}
                  onSelect={() => {
                    lastActiveRef.current = Date.now();
                    setVoiceIdx(i);
                    if (settings.sound) {
                      let j = 0;
                      for (let st = 0; st < n; st++) {
                        const f = v.frets[st];
                        if (f === null) continue;
                        pluck(midis[st] + f, j * 0.035);
                        j++;
                      }
                    }
                  }}
                />
                <span className="voicestar">
                  <StarSave
                    label={label}
                    saved={bank.some((b) => b.sig === vsig)}
                    onClick={() =>
                      saveToBank({
                        id: `b${Date.now()}`,
                        sig: vsig,
                        kind: "chord",
                        root: chordRoot,
                        chordId,
                        voicing: v,
                        midis,
                        capo,
                        tun: settings.tuningId,
                        label,
                      })
                    }
                  />
                </span>
              </div>
            );
          })}
        </div>
      )}

      {!settings.simple && chordAreas.length > 1 && (
        <Field label="Neck area">
          <div className="posrow">
            <button
              className={`poschip ${chordArea == null ? "on" : ""}`}
              onClick={() => setChordArea(null)}
              data-tip="Every shape, all the way up the neck"
            >
              Anywhere
            </button>
            {chordAreas.map((f) => (
              <button
                key={f}
                className={`poschip ${chordArea === f ? "on" : ""}`}
                onClick={() => setChordArea(f)}
                data-tip={f === capo ? "Shapes using open strings" : `Shapes starting at fret ${f}`}
              >
                {f === capo ? "Open" : f}
              </button>
            ))}
          </div>
        </Field>
      )}

      <p className="note">
        Numbers on the dots are fingers: 1 index, 2 middle, 3 ring, 4 little. A dark bar means one finger lies flat across those strings.
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
        <button
          className="btn primary"
          onClick={() => {
            track("strum_chord", { chord: chordId });
            strumVoicing();
          }}
          disabled={!activeVoicing}
          data-tip="Hear the selected shape"
        >
          Strum
        </button>
      </div>

      <div className="keyjump">
        <span className="note">In {nameOf(chordRoot, flats)}:</span>
        <button className="jumpchip" onClick={() => carryKey("scale", chordRoot)}>
          Scale
        </button>
        <button className="jumpchip" onClick={() => carryKey("arp", chordRoot)}>
          Arpeggio
        </button>
        <button className="jumpchip" onClick={() => carryKey("strum", chordRoot)}>
          Strum along
        </button>
      </div>

      {!settings.simple && (
        <div className="optrow">
          <Field label="Neck shows">
            <Seg
              small
              options={[
                { v: "finger", l: "Fingers" },
                { v: "name", l: "Notes" },
                { v: "degree", l: "Degrees" },
              ]}
              value={chordLabel}
              onChange={setChordLabel}
            />
          </Field>
          <Field label="Other tones">
            <Seg
              small
              options={[
                { v: true, l: "Ghost" },
                { v: false, l: "Hide" },
              ]}
              value={showAllTones}
              onChange={setShowAllTones}
            />
          </Field>
        </div>
      )}
    </div>
  );
}
