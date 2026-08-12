import { useCallback, useEffect, useMemo, useState } from "react";
import { nameOf, keyPrefersFlats, parseTab, MEL_SLOTS, MEL_MAX_BARS } from "../theory.ts";
import { track } from "../lib/analytics.ts";
import { Field } from "../components/Field.jsx";
import { Seg } from "../components/Seg.jsx";
import { useSettings } from "../state/SettingsContext.tsx";
import { useSelection } from "../state/SelectionContext.tsx";
import { usePlayback } from "../state/PlaybackContext.tsx";
import { useLibrary } from "../state/LibraryContext.tsx";
import { useToast } from "../state/ToastContext.tsx";
import { usePublishFretboard } from "../state/FretboardContext.tsx";
import { usePublishReadout } from "../state/ReadoutContext.tsx";

const EMPTY = new Set();

/* The melody editor: tap notes on the neck to drop them onto an eighth-note
   timeline, play it back (with loop and speed), transpose, import from tab, and
   save. The melody content (steps/name/bars) lives in Selection so share links
   can restore it; the cursor, speed, loop and import UI are local. Publishes the
   neck (the cursor note and the note playing back) and the readout. The shared
   flash overlay stays in the shell, lent down as setFlash. */
export function MelodyView({ setFlash }) {
  const { settings, midis, n, fretCount } = useSettings();
  const { melSteps, setMelSteps, melName, setMelName, melBars, setMelBars } = useSelection();
  const { playNote, stopPlayback, melPlayIdx, setMelPlayIdx, melLoopRef, playMelodyRef, playTimers } = usePlayback();
  const { melodies, saveMelodies } = useLibrary();
  const { setToast } = useToast();

  const [melCursor, setMelCursor] = useState(0); // slot the next tapped note lands on
  const [melRate, setMelRate] = useState(2); // slots per beat on playback (2 = eighths)
  const [melLoop, setMelLoop] = useState(false); // repeat the melody until Stop
  const [melImport, setMelImport] = useState(false);
  const [melImportText, setMelImportText] = useState("");

  /* which major key covers the melody's notes best */
  const melKeyHint = useMemo(() => {
    if (!melSteps.length) return null;
    const notes = melSteps.filter((st) => !st.rest);
    if (!notes.length) return null;
    const pcs = [...new Set(notes.map((st) => (midis[st.s] + st.f) % 12))];
    const majorIv = [0, 2, 4, 5, 7, 9, 11];
    let best = null;
    for (let root = 0; root < 12; root++) {
      const set = new Set(majorIv.map((i) => (root + i) % 12));
      const hits = pcs.filter((pc) => set.has(pc)).length;
      if (!best || hits > best.hits) best = { root, hits };
    }
    if (!best || best.hits < pcs.length) return best && best.hits >= pcs.length - 1 ? { ...best, loose: true } : null;
    return best;
  }, [melSteps, midis]);

  const effFlats = useMemo(
    () =>
      settings.noteNames === "sharps"
        ? false
        : settings.noteNames === "flats"
          ? true
          : melKeyHint
            ? keyPrefersFlats(melKeyHint.root, [0, 2, 4, 5, 7, 9, 11])
            : false,
    [settings.noteNames, melKeyHint],
  );

  const marks = useMemo(() => {
    /* the neck is just the note picker: highlight the note on the selected slot
       and the note playing back. The sequence lives in the timeline below. */
    const map = new Map();
    const root = melKeyHint ? melKeyHint.root : 0;
    const cur = melSteps[melCursor];
    if (cur && !cur.rest) {
      const pc = (midis[cur.s] + cur.f) % 12;
      map.set(`${cur.s}:${cur.f}`, { pc, semis: (pc - root + 12) % 12, tone: "melody", state: "on", finger: null });
    }
    const p = melPlayIdx != null ? melSteps[melPlayIdx] : null;
    if (p && !p.rest) {
      const pc = (midis[p.s] + p.f) % 12;
      map.set(`${p.s}:${p.f}`, { pc, semis: (pc - root + 12) % 12, tone: "melody", state: "lit", finger: null });
    }
    return map;
  }, [melSteps, melCursor, melPlayIdx, melKeyHint, midis]);

  const onCell = useCallback(
    (s, f, midi) => {
      playNote(midi);
      const i = melCursor;
      setMelSteps((st) => {
        const next = st.slice();
        while (next.length <= i) next.push({ rest: true });
        next[i] = { s, f };
        return next;
      });
      const total = melBars * MEL_SLOTS;
      if (i + 1 >= total && melBars < MEL_MAX_BARS) setMelBars(melBars + 1);
      setMelCursor(Math.min(i + 1, (melBars < MEL_MAX_BARS ? melBars + 1 : melBars) * MEL_SLOTS - 1));
    },
    [playNote, melCursor, melBars, setMelSteps, setMelBars],
  );

  usePublishFretboard(
    useMemo(
      () => ({
        marks,
        onCell,
        flats: effFlats,
        labelMode: settings.labelMode,
        colourMode: settings.colourMode,
        barre: null,
        ghosts: EMPTY,
        quizActive: false,
        quizRange: undefined,
      }),
      [marks, onCell, effFlats, settings.labelMode, settings.colourMode],
    ),
  );

  const noteCount = melSteps.filter((s) => s && !s.rest).length;
  usePublishReadout(`Melody · ${noteCount} ${noteCount === 1 ? "note" : "notes"}`);

  const transposeMelody = useCallback(
    (delta) => {
      const moved = melSteps.map((st) => (st.rest ? st : { s: st.s, f: st.f + delta }));
      if (moved.some((st) => !st.rest && (st.f < 0 || st.f > fretCount))) {
        setToast("That transposition falls off the neck");
        return;
      }
      setMelSteps(moved);
    },
    [melSteps, fretCount, setToast, setMelSteps],
  );

  const doImportTab = useCallback(
    (text) => {
      /* keep notes on the neck and within the timeline the grid can render */
      const steps = parseTab(text, midis.length)
        .filter((st) => st.f <= fretCount)
        .slice(0, MEL_MAX_BARS * MEL_SLOTS);
      if (!steps.length) {
        setToast("Could not read a tab there. Check the format.");
        return;
      }
      stopPlayback();
      setMelSteps(steps);
      const bars = Math.max(2, Math.min(MEL_MAX_BARS, Math.ceil((steps.length + 1) / MEL_SLOTS)));
      setMelBars(bars);
      setMelCursor(Math.min(steps.length, bars * MEL_SLOTS - 1));
      setMelImport(false);
      setMelImportText("");
      track("melody_import", { notes: steps.length });
      setToast(`Imported ${steps.length} notes`);
    },
    [midis.length, fretCount, stopPlayback, setToast, setMelSteps, setMelBars],
  );

  const importTabFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        doImportTab(text);
        return;
      }
      setToast("Clipboard is empty. Paste your tab below.");
    } catch (e) {
      /* clipboard read blocked: fall back to the paste box */
    }
    setMelImport(true);
  }, [doImportTab, setToast]);

  const scheduleMelody = useCallback(() => {
    if (!melSteps.some((st) => st && !st.rest)) return;
    /* play the whole timeline including trailing empty slots, so rests keep time */
    const total = Math.max(melBars * MEL_SLOTS, melSteps.length);
    const grid = Array.from({ length: total }, (_, i) => melSteps[i] || { rest: true });
    const stepSec = 60 / settings.bpm / melRate;
    grid.forEach((st, i) => {
      playTimers.current.push(
        setTimeout(
          () => {
            if (!st.rest) {
              playNote(midis[st.s] + st.f);
              setFlash({ key: `${st.s}:${st.f}`, ok: true, t: i });
            }
            setMelPlayIdx(i);
          },
          i * stepSec * 1000,
        ),
      );
    });
    playTimers.current.push(
      setTimeout(
        () => {
          if (melLoopRef.current) playMelodyRef.current();
          else {
            setMelPlayIdx(null);
            setFlash(null);
          }
        },
        total * stepSec * 1000,
      ),
    );
  }, [melSteps, melBars, settings.bpm, midis, melRate, playNote, setFlash, melLoopRef, playMelodyRef, playTimers, setMelPlayIdx]);

  useEffect(() => {
    playMelodyRef.current = scheduleMelody;
  }, [scheduleMelody, playMelodyRef]);

  const playMelody = useCallback(() => {
    stopPlayback();
    if (!melSteps.some((st) => st && !st.rest)) return;
    melLoopRef.current = melLoop;
    scheduleMelody();
  }, [stopPlayback, scheduleMelody, melLoop, melSteps, melLoopRef]);

  return (
    <div className="pane">
      <p className="note">
        Tap notes on the neck to drop them onto the timeline below, one eighth-note slot at a time. Tap a slot to move the cursor there, or
        tap a filled slot again to clear it back to a rest. An empty slot is a rest, the same note in two slots is a repeat.
      </p>

      <Field label={`Timeline · ${noteCount} ${noteCount === 1 ? "note" : "notes"}`}>
        <div className="timeline" role="group" aria-label="Melody timeline. Tap the neck to add a note at the cursor.">
          {Array.from({ length: melBars }, (_, b) => (
            <div className="tbar" key={b}>
              {Array.from({ length: MEL_SLOTS }, (_, sc) => {
                const i = b * MEL_SLOTS + sc;
                const cell = melSteps[i];
                const filled = cell && !cell.rest;
                const nm = filled ? nameOf((midis[cell.s] + cell.f) % 12, effFlats) : "";
                return (
                  <button
                    key={i}
                    type="button"
                    className={`tslot ${filled ? "filled" : "rest"} ${i === melCursor ? "cursor" : ""} ${melPlayIdx === i ? "playing" : ""} ${sc % 2 === 0 ? "beat" : ""}`}
                    aria-label={filled ? `Slot ${i + 1}, ${nm}. Tap to select, tap again to clear.` : `Slot ${i + 1}, rest. Tap to select.`}
                    aria-current={i === melCursor ? "true" : undefined}
                    onClick={() => {
                      if (i === melCursor && filled) {
                        setMelSteps((st) => {
                          const next = st.slice();
                          while (next.length <= i) next.push({ rest: true });
                          next[i] = { rest: true };
                          return next;
                        });
                      } else {
                        setMelCursor(i);
                        if (filled) playNote(midis[cell.s] + cell.f);
                      }
                    }}
                  >
                    <span className="tslotname">{nm}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </Field>

      <div className="row wrap barctl">
        <span className="note">Bars</span>
        <button
          className="mini"
          aria-label="Remove a bar"
          disabled={melBars <= 1}
          onClick={() => {
            const nb = Math.max(1, melBars - 1);
            setMelBars(nb);
            setMelSteps((st) => st.slice(0, nb * MEL_SLOTS));
            setMelCursor((c) => Math.min(c, nb * MEL_SLOTS - 1));
          }}
        >
          {"−"}
        </button>
        <b className="barcount">{melBars}</b>
        <button
          className="mini"
          aria-label="Add a bar"
          disabled={melBars >= MEL_MAX_BARS}
          onClick={() => setMelBars((b) => Math.min(MEL_MAX_BARS, b + 1))}
        >
          +
        </button>
        <button
          className="btn ghost"
          onClick={() => {
            setMelSteps((st) => {
              const next = st.slice();
              while (next.length <= melCursor) next.push({ rest: true });
              next[melCursor] = { rest: true };
              return next;
            });
            setMelCursor((c) => Math.min(c + 1, melBars * MEL_SLOTS - 1));
          }}
        >
          Add rest
        </button>
        <button
          className="btn ghost"
          disabled={melCursor === 0}
          onClick={() => {
            const j = Math.max(0, melCursor - 1);
            setMelSteps((st) => {
              if (j >= st.length) return st;
              const next = st.slice();
              next[j] = { rest: true };
              return next;
            });
            setMelCursor(j);
          }}
        >
          Back
        </button>
      </div>

      {melKeyHint && (
        <p className="note" role="status">
          {melKeyHint.loose ? "Mostly fits" : "Fits"} {nameOf(melKeyHint.root, keyPrefersFlats(melKeyHint.root, [0, 2, 4, 5, 7, 9, 11]))}{" "}
          major
          {" / "}
          {nameOf((melKeyHint.root + 9) % 12, keyPrefersFlats(melKeyHint.root, [0, 2, 4, 5, 7, 9, 11]))} minor.
        </p>
      )}

      <div className="row wrap actions">
        <button
          className={`btn primary ${melPlayIdx != null ? "live" : ""}`}
          onClick={melPlayIdx != null ? stopPlayback : playMelody}
          disabled={!melSteps.some((s) => s && !s.rest)}
        >
          {melPlayIdx != null ? "Stop" : "Play"}
        </button>
        <button
          className={`btn ${melLoop ? "primary" : "ghost"}`}
          aria-pressed={melLoop}
          onClick={() => {
            const nv = !melLoop;
            setMelLoop(nv);
            melLoopRef.current = nv;
          }}
          data-tip="Repeat the melody until you press Stop"
        >
          Loop: {melLoop ? "on" : "off"}
        </button>
        <Field label="Speed">
          <Seg
            small
            ariaLabel="Playback speed"
            options={[
              { v: 1, l: "Slow" },
              { v: 2, l: "Normal" },
              { v: 4, l: "Fast" },
            ]}
            value={melRate}
            onChange={setMelRate}
          />
        </Field>
        <Field label="Transpose">
          <div className="row">
            <button
              className="mini"
              aria-label="Down one semitone"
              onClick={() => transposeMelody(-1)}
              disabled={!melSteps.some((s) => s && !s.rest)}
            >
              {"−"}1
            </button>
            <button
              className="mini"
              aria-label="Up one semitone"
              onClick={() => transposeMelody(1)}
              disabled={!melSteps.some((s) => s && !s.rest)}
            >
              +1
            </button>
          </div>
        </Field>
        <span className="actspacer" aria-hidden="true" />
        <button
          className="btn ghost danger"
          onClick={() => {
            setMelSteps([]);
            setMelBars(2);
            setMelCursor(0);
          }}
          disabled={!melSteps.length}
        >
          Clear
        </button>
      </div>

      <div className="row wrap">
        <Field id="melname" label="Name">
          <input
            id="melname"
            type="text"
            value={melName}
            maxLength={60}
            placeholder="Riff I am learning"
            onChange={(e) => setMelName(e.target.value)}
            className="melinput"
          />
        </Field>
        <button
          className="btn"
          disabled={!melSteps.some((s) => s && !s.rest) || !melName.trim()}
          onClick={() => {
            saveMelodies([{ id: `m${Date.now()}`, name: melName.trim(), steps: melSteps, bars: melBars }, ...melodies]);
            track("melody_save", { notes: melSteps.filter((s) => s && !s.rest).length });
            setToast("Melody saved");
            setMelName("");
          }}
        >
          Save melody
        </button>
      </div>

      <div className="row wrap">
        <button className="btn ghost" onClick={importTabFromClipboard}>
          Import tab from clipboard
        </button>
        <button className="btn ghost" onClick={() => setMelImport((v) => !v)}>
          {melImport ? "Hide paste box" : "Paste a tab"}
        </button>
      </div>
      {melImport && (
        <Field id="tabpaste" label="Paste a tab, then Import">
          <textarea
            id="tabpaste"
            className="melinput tabbox"
            rows={7}
            value={melImportText}
            onChange={(e) => setMelImportText(e.target.value)}
            placeholder={"e|--0--3--0--|\nB|--1-----1--|\nG|--0-----0--|\nD|--2-----2--|\nA|--3--3--3--|\nE|-----------|"}
          />
          <div className="row">
            <button className="btn primary" onClick={() => doImportTab(melImportText)} disabled={!melImportText.trim()}>
              Import
            </button>
          </div>
        </Field>
      )}

      {melodies.length > 0 && (
        <Field label="Saved melodies">
          <div className="mellist">
            {melodies.map((m) => (
              <div className="melitem" key={m.id}>
                <button
                  className="melload"
                  onClick={() => {
                    /* drop notes that fall off the current tuning/neck (fewer strings or frets) */
                    const steps = m.steps
                      .slice(0, MEL_MAX_BARS * MEL_SLOTS)
                      .map((st) => (st && !st.rest && (st.s >= midis.length || st.f > fretCount) ? { rest: true } : st));
                    setMelSteps(steps);
                    setMelBars(Math.max(2, Math.min(MEL_MAX_BARS, m.bars || Math.ceil(steps.length / MEL_SLOTS))));
                    setMelCursor(0);
                    setMelName(m.name);
                    setToast(`Loaded ${m.name}`);
                  }}
                >
                  <b>{m.name}</b>
                  <em>{m.steps.filter((s) => s && !s.rest).length} notes</em>
                </button>
                <button
                  className="mini"
                  aria-label={`Delete ${m.name}`}
                  onClick={() => saveMelodies(melodies.filter((x) => x.id !== m.id))}
                >
                  {"✕"}
                </button>
              </div>
            ))}
          </div>
        </Field>
      )}
    </div>
  );
}
