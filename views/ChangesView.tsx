import { useCallback, useEffect, useMemo, useState } from "react";
import { CHORDS, SIMPLE_CHORDS, nameOf, keyPrefersFlats } from "../theory.ts";
import { CHORD_GROUPS } from "../data/groups.ts";
import { groupItems } from "../lib/utils.ts";
import { track } from "../lib/analytics.ts";
import { ctx, pluck, playClick } from "../audio.ts";
import { findVoicings } from "../voicings.ts";
import { ChordDiagram } from "../fretboard.tsx";
import { Field } from "../components/Field.tsx";
import { Seg } from "../components/Seg.tsx";
import { KeyPicker } from "../components/KeyPicker.tsx";
import { CatPicker } from "../components/CatPicker.tsx";
import { useSettings } from "../state/SettingsContext.tsx";
import { useLibrary } from "../state/LibraryContext.tsx";
import { useProgress } from "../state/ProgressContext.tsx";
import { useToast } from "../state/ToastContext.tsx";
import { usePublishReadout } from "../state/ReadoutContext.tsx";

const chgKey = (chords) =>
  chords
    .map((c) => `${c.root}:${c.id}`)
    .sort()
    .join(">");

/* The one-minute chord-change trainer: pick two or more shapes, then count how
   many clean changes you make before the clock runs out and beat your best. No
   main neck (the shapes render as their own diagrams), so it publishes only the
   readout. State is local; leaving mid-run unmounts the view, so the countdown
   interval tears down and the drill returns to idle on the next visit. */
export function ChangesView() {
  const { settings, midis, n, fretCount } = useSettings();
  const { chgRecords, saveChgRecords } = useLibrary();
  const { setGamify, lastActiveRef } = useProgress();
  const { setToast } = useToast();

  const [chg, setChg] = useState({
    chords: [
      { root: 9, id: "maj" },
      { root: 2, id: "maj" },
    ], // A, D, the classic first pair
    duration: 60,
    phase: "idle", // idle | running | done
    remaining: 60,
  });
  const [chgEntry, setChgEntry] = useState("");

  const effFlats = useMemo(() => {
    if (settings.noteNames === "sharps") return false;
    if (settings.noteNames === "flats") return true;
    const c0 = chg.chords[0];
    const d0 = c0 ? CHORDS.find((x) => x.id === c0.id) : null;
    return c0 ? keyPrefersFlats(c0.root, d0 ? d0.iv : [4]) : false;
  }, [settings.noteNames, chg.chords]);

  const vopt = useMemo(
    () => ({ span: settings.span, inversions: settings.inversions, barres: settings.barres }),
    [settings.span, settings.inversions, settings.barres],
  );

  const chordName = (c) => `${nameOf(c.root, effFlats)}${(CHORDS.find((x) => x.id === c.id) || {}).suffix || ""}`;
  const chgLabel = chg.chords.map(chordName).join("  ·  ");
  const chgRecord = chgRecords[chgKey(chg.chords)] || { best: 0, last: 0, tries: 0 };

  const chgVoicings = useMemo(() => {
    return chg.chords.map((c) => {
      const def = CHORDS.find((x) => x.id === c.id) || CHORDS[0];
      const vs = findVoicings(c.root, def.iv, midis, fretCount, 0, vopt); // trainer ignores the capo; no neck/capo control in this mode
      return vs[0] || null;
    });
  }, [chg.chords, midis, fretCount, vopt]);

  usePublishReadout(`Chord changes · ${chgLabel}`);

  const startRun = useCallback(() => {
    setChgEntry("");
    track("changes_start", { chords: chgLabel, duration: chg.duration });
    setChg((c) => ({ ...c, phase: "running", remaining: c.duration }));
    const ac = ctx();
    if (ac && settings.sound) playClick(settings.clickSound, ac.currentTime, true);
  }, [settings.sound, settings.clickSound, chgLabel, chg.duration]);

  const stopRun = useCallback(() => {
    setChg((c) => ({ ...c, phase: "idle", remaining: c.duration }));
  }, []);

  /* Countdown: fix the end time when the run starts, then tick against the
     audio-free wall clock. The interval tears down on unmount, so nothing beeps
     or updates once you leave the drill. */
  useEffect(() => {
    if (chg.phase !== "running" || chg.duration === 0) return;
    const end = performance.now() + chg.remaining * 1000;
    const id = setInterval(() => {
      lastActiveRef.current = Date.now(); // a running changes drill is active practice
      const rem = Math.max(0, Math.ceil((end - performance.now()) / 1000));
      if (rem <= 0) {
        clearInterval(id);
        const ac = ctx();
        if (ac && settings.sound) {
          playClick("beep", ac.currentTime, true);
          playClick("beep", ac.currentTime + 0.22, true);
          playClick("beep", ac.currentTime + 0.44, true);
        }
        setChg((c) => ({ ...c, phase: "done", remaining: 0 }));
      } else {
        setChg((c) => (c.phase === "running" ? { ...c, remaining: rem } : c));
      }
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chg.phase, settings.sound]);

  const saveChangeScore = useCallback(() => {
    const count = Math.max(0, Math.min(9999, parseInt(chgEntry, 10) || 0));
    const key = chgKey(chg.chords);
    const cur = chgRecords[key] || { best: 0, last: 0, tries: 0 };
    const beat = count > cur.best;
    const next = { ...chgRecords, [key]: { best: Math.max(cur.best, count), last: count, tries: cur.tries + 1 } };
    saveChgRecords(next);
    const perMin = chg.duration > 0 ? Math.round((count * 60) / chg.duration) : count;
    setGamify((g) => ({
      ...g,
      counters: {
        ...g.counters,
        chordChangesTotal: (g.counters.chordChangesTotal || 0) + count,
        chordChangeBest: Math.max(g.counters.chordChangeBest || 0, perMin),
      },
    }));
    track("changes_save", { count, new_best: beat });
    setToast(beat && count > 0 ? `New best · ${count} changes` : `Saved · ${count} changes`);
    setChg((c) => ({ ...c, phase: "idle", remaining: c.duration }));
    setChgEntry("");
  }, [chgEntry, chg.chords, chg.duration, chgRecords, saveChgRecords, setToast, setGamify]);

  const setChgChord = (i, patch) => setChg((c) => ({ ...c, chords: c.chords.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const addChgChord = () => setChg((c) => (c.chords.length >= 8 ? c : { ...c, chords: [...c.chords, { root: 7, id: "maj" }] }));
  const removeChgChord = (i) => setChg((c) => (c.chords.length <= 2 ? c : { ...c, chords: c.chords.filter((_, j) => j !== i) }));

  return (
    <div className="pane">
      <p className="panelead">
        Build speed by counting how many clean chord changes you can make between two shapes before the clock runs out.
      </p>
      <div className="chgstage">
        <div
          role="timer"
          aria-label="Time remaining"
          className={`chgclock ${chg.phase === "running" ? (chg.duration === 0 || chg.remaining > 10 ? "run" : "low") : chg.phase === "done" ? "low" : ""}`}
        >
          {chg.phase === "done"
            ? "Time!"
            : chg.duration === 0
              ? chg.phase === "running"
                ? "Free"
                : "∞"
              : `${Math.floor(chg.remaining / 60)}:${String(chg.remaining % 60).padStart(2, "0")}`}
        </div>
        <div className="chgnames">{chgLabel}</div>
        <div className="chgstatus" role="status" aria-live="assertive">
          {chg.phase === "done" ? "Time. Enter how many changes you got." : ""}
        </div>
        {(chgRecord.best > 0 || chgRecord.tries > 0) && (
          <div className="chgbest">
            <span>
              best <b>{chgRecord.best}</b>
            </span>
            <span>
              last <b>{chgRecord.last}</b>
            </span>
            <span>
              tries <b>{chgRecord.tries}</b>
            </span>
          </div>
        )}
      </div>

      {chgVoicings.some(Boolean) ? (
        <div className="voicings">
          {chg.chords.map((c, i) =>
            chgVoicings[i] ? (
              <ChordDiagram
                key={i}
                voicing={chgVoicings[i]}
                lefty={settings.leftHanded}
                midis={midis}
                rootPc={c.root}
                capo={0}
                flats={effFlats}
                showDegrees={false}
                title={chordName(c)}
                onSelect={() => {
                  if (!settings.sound) return;
                  let j = 0;
                  for (let st = 0; st < n; st++) {
                    const f = chgVoicings[i].frets[st];
                    if (f === null) continue;
                    pluck(midis[st] + f, j * 0.035);
                    j++;
                  }
                }}
              />
            ) : (
              <p className="empty" key={i}>
                No easy shape for {chordName(c)} in this tuning.
              </p>
            ),
          )}
        </div>
      ) : (
        <p className="empty">No playable shapes for these chords in this tuning.</p>
      )}

      {chg.phase === "idle" && (
        <>
          <Field label="Chords to switch between">
            <div className="chgslots">
              {chg.chords.map((c, i) => (
                <div className="chgslot" key={i}>
                  <KeyPicker value={c.root} onChange={(v) => setChgChord(i, { root: v })} flats={effFlats} />
                  <div className="chgslotbtm">
                    <CatPicker
                      value={c.id}
                      onChange={(v) => setChgChord(i, { id: v })}
                      label="Chord type"
                      groups={groupItems(CHORD_GROUPS, CHORDS, SIMPLE_CHORDS, settings.simple, c.id)}
                    />
                    <button
                      className="mini"
                      onClick={() => removeChgChord(i)}
                      disabled={chg.chords.length <= 2}
                      data-tip="Remove this chord"
                      aria-label={`Remove ${chordName(c)}`}
                    >
                      {"✕"}
                    </button>
                  </div>
                </div>
              ))}
              {chg.chords.length < 8 && (
                <button className="btn ghost wide" onClick={addChgChord}>
                  + Add a chord
                </button>
              )}
            </div>
          </Field>

          <div className="row">
            <Field label="Length">
              <Seg
                small
                options={[
                  { v: 30, l: "0:30" },
                  { v: 60, l: "1:00" },
                  { v: 120, l: "2:00" },
                  { v: 0, l: "Free" },
                ]}
                value={chg.duration}
                onChange={(v) => setChg((c) => ({ ...c, duration: v, remaining: v }))}
              />
            </Field>
            <button className="transport" onClick={startRun} disabled={!chgVoicings.some(Boolean)}>
              Start
            </button>
          </div>
          <p className="note">
            Change between the chords as many times as you can before the clock runs out. Count each clean change, then enter your total
            when time is up, and beat your best.
          </p>
        </>
      )}

      {chg.phase === "running" && (
        <div className="row">
          <button className="transport on" onClick={stopRun}>
            Stop
          </button>
          <p className="note">
            {chg.duration === 0
              ? `Practise switching between ${chgLabel} at your own pace. Stop whenever you are done.`
              : `Switch between ${chgLabel}. Count each clean change.`}
          </p>
        </div>
      )}

      {chg.phase === "done" && (
        <div className="chgentry">
          <Field label="How many changes did you get?">
            <input
              type="number"
              aria-label="How many changes did you get?"
              min="0"
              inputMode="numeric"
              value={chgEntry}
              autoFocus
              onChange={(e) => setChgEntry(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveChangeScore();
              }}
            />
          </Field>
          <button className="btn" onClick={saveChangeScore}>
            Save
          </button>
          <button className="btn ghost" onClick={stopRun}>
            Discard
          </button>
        </div>
      )}
    </div>
  );
}
