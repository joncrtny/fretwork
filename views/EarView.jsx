import { useCallback, useEffect, useMemo, useState } from "react";
import { CHORDS, EAR_INTERVALS, EAR_INTERVALS_SIMPLE, EAR_CHORDS, EAR_CHORDS_SIMPLE } from "../theory.js";
import { pluck, blip } from "../audio.js";
import { track } from "../lib/analytics.ts";
import { Field } from "../components/Field.jsx";
import { Seg } from "../components/Seg.jsx";
import { useSettings } from "../state/SettingsContext.jsx";
import { useProgress } from "../state/ProgressContext.jsx";
import { usePublishReadout } from "../state/ReadoutContext.jsx";

/* Ear training: hear an interval or chord type and name it, or pick one and
   hear it. No neck, so it publishes only the readout. State is local and dies
   on unmount, which is exactly the old "leaving ends the session" behaviour:
   coming back shows Start again rather than auto-playing. */
export function EarView() {
  const { settings } = useSettings();
  const { setGamify, lastActiveRef } = useProgress();

  const [ear, setEar] = useState({
    source: "interval", // interval | chord
    dir: "quiz", // quiz | explore
    level: "simple", // simple | all
    current: null, // { root, answer }
    picked: null,
    started: false, // true once the user presses Start, so entering the view does not auto-play
    correct: 0,
    wrong: 0,
    streak: 0,
  });

  const earPool = useMemo(
    () =>
      ear.source === "interval"
        ? EAR_INTERVALS.filter((x) => ear.level === "all" || EAR_INTERVALS_SIMPLE.has(x.v))
        : EAR_CHORDS.filter((x) => ear.level === "all" || EAR_CHORDS_SIMPLE.has(x.v)),
    [ear.source, ear.level],
  );

  const earPlay = useCallback(
    (root, answer) => {
      lastActiveRef.current = Date.now();
      if (ear.source === "interval") {
        pluck(root, 0, 0.5);
        pluck(root + answer, 0.55, 0.5);
        pluck(root, 1.15, 0.4);
        pluck(root + answer, 1.15, 0.4);
      } else {
        const def = CHORDS.find((c) => c.id === answer);
        (def ? def.iv : [0, 4, 7]).forEach((i, j) => pluck(root + i, j * 0.08, 0.45));
      }
    },
    [ear.source, lastActiveRef],
  );

  const earNext = useCallback(() => {
    const pool = earPool;
    const item = pool[Math.floor(Math.random() * pool.length)];
    const root = 45 + Math.floor(Math.random() * 15); // A2 to B3, guitar-friendly
    const cur = { root, answer: item.v };
    setEar((e) => ({ ...e, current: cur, picked: null, started: true }));
    earPlay(root, item.v);
  }, [earPool, earPlay]);

  const earAnswer = useCallback(
    (v) => {
      /* read once, then run side effects exactly once outside the state updater
         (which can run twice under StrictMode) */
      if (!ear.current || ear.picked != null) return;
      const right = v === ear.current.answer;
      track("ear_answer", { app_mode: ear.source, right });
      if (settings.sound) blip(right);
      if (right) {
        const streak = ear.streak + 1;
        const key = ear.source === "chord" ? "earStreakChord" : "earStreakInterval";
        setGamify((g) => ({
          ...g,
          counters: { ...g.counters, earCorrect: (g.counters.earCorrect || 0) + 1, [key]: Math.max(g.counters[key] || 0, streak) },
        }));
      }
      setEar((e) => ({
        ...e,
        picked: v,
        correct: e.correct + (right ? 1 : 0),
        wrong: e.wrong + (right ? 0 : 1),
        streak: right ? e.streak + 1 : 0,
      }));
    },
    [ear, settings.sound, setGamify],
  );

  /* fresh question after an answer settles or the pool changes, but only once
     the user has pressed Start (entering the view must not auto-play) */
  useEffect(() => {
    if (ear.dir !== "quiz" || !ear.started) return;
    if (ear.picked == null && ear.current) return;
    const t = setTimeout(() => earNext(), ear.picked != null ? 1100 : 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ear.dir, ear.picked, ear.source, ear.level, ear.started]);

  usePublishReadout(
    `Ear training · ${ear.correct + ear.wrong ? Math.round((ear.correct / (ear.correct + ear.wrong)) * 100) + "%" : "ready"}`,
  );

  return (
    <div className="pane">
      <p className="panelead">Train your ear to recognise intervals and chord types by sound, then check yourself against the answer.</p>
      <div className="scoreboard">
        <div className="score">
          <b>{ear.correct}</b>
          <span>correct</span>
        </div>
        <div className="score">
          <b className="bad">{ear.wrong}</b>
          <span>wrong</span>
        </div>
        <div className="score">
          <b>{ear.streak}</b>
          <span>streak</span>
        </div>
      </div>

      <div className="row wrap">
        <Field label="Mode" tip="Identify what you hear, or choose a sound and listen to it">
          <Seg
            small
            ariaLabel="Ear training mode"
            options={[
              { v: "quiz", l: "Hear and identify" },
              { v: "explore", l: "Choose and hear" },
            ]}
            value={ear.dir}
            onChange={(v) => setEar((e) => ({ ...e, dir: v, current: null, picked: null, streak: 0 }))}
          />
        </Field>
        <Field label="Sounds">
          <Seg
            small
            ariaLabel="Interval or chord sounds"
            options={[
              { v: "interval", l: "Intervals" },
              { v: "chord", l: "Chord types" },
            ]}
            value={ear.source}
            onChange={(v) => setEar((e) => ({ ...e, source: v, current: null, picked: null, streak: 0 }))}
          />
        </Field>
        <Field label="Difficulty">
          <Seg
            small
            ariaLabel="Difficulty"
            options={[
              { v: "simple", l: "Common" },
              { v: "all", l: "Everything" },
            ]}
            value={ear.level}
            onChange={(v) => setEar((e) => ({ ...e, level: v, current: null, picked: null, streak: 0 }))}
          />
        </Field>
      </div>

      {ear.dir === "quiz" ? (
        <>
          <div className="row">
            <button className="btn primary" onClick={() => (ear.current ? earPlay(ear.current.root, ear.current.answer) : earNext())}>
              {ear.current ? "Play again" : "Start"}
            </button>
          </div>
          <div className="earopts">
            {earPool.map((o) => {
              const answered = ear.picked != null;
              const isPick = ear.picked === o.v;
              const isRight = answered && ear.current && o.v === ear.current.answer;
              return (
                <button
                  key={String(o.v)}
                  className={`earopt ${isRight ? "right" : isPick ? "wrongpick" : ""}`}
                  disabled={!ear.current || answered}
                  onClick={() => earAnswer(o.v)}
                >
                  {o.l}
                </button>
              );
            })}
          </div>
          <p className="note" role="status" aria-live="polite">
            {ear.picked != null && ear.current
              ? ear.picked === ear.current.answer
                ? "Right. Next one coming up."
                : `It was ${earPool.find((o) => o.v === ear.current.answer)?.l}. Next one coming up.`
              : ear.current
                ? "What did you hear?"
                : "Press Start and identify what you hear."}
          </p>
        </>
      ) : (
        <>
          <p className="note">Tap a sound to hear it from a random root. Learn the colour, then flip to Hear and identify.</p>
          <div className="earopts">
            {earPool.map((o) => (
              <button
                key={String(o.v)}
                className="earopt"
                onClick={() => {
                  const root = 45 + Math.floor(Math.random() * 15);
                  earPlay(root, o.v);
                }}
              >
                {o.l}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="row">
        <button
          className="btn ghost danger"
          onClick={() => setEar((e) => ({ ...e, correct: 0, wrong: 0, streak: 0 }))}
          disabled={!ear.correct && !ear.wrong}
        >
          Reset score
        </button>
      </div>
    </div>
  );
}
