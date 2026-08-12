import { useCallback, useEffect, useMemo, useState } from "react";
import { SCALES, CHORDS, SIMPLE_SCALES, SIMPLE_CHORDS, DEG, nameOf, keyPrefersFlats } from "../theory.ts";
import { CHORD_GROUPS, SCALE_GROUPS } from "../data/groups.ts";
import { groupItems } from "../lib/utils.ts";
import { track } from "../lib/analytics.ts";
import { store } from "../lib/store.ts";
import { blip } from "../audio.ts";
import { Seg } from "../components/Seg.tsx";
import { Field } from "../components/Field.tsx";
import { IntervalGrid } from "../components/IntervalGrid.tsx";
import { KeyPicker } from "../components/KeyPicker.tsx";
import { CatPicker } from "../components/CatPicker.tsx";
import { DualRange } from "../components/DualRange.tsx";
import { useSettings } from "../state/SettingsContext.tsx";
import { useSelection } from "../state/SelectionContext.tsx";
import { usePlayback } from "../state/PlaybackContext.tsx";
import { usePublishFretboard } from "../state/FretboardContext.tsx";
import { usePublishReadout } from "../state/ReadoutContext.tsx";

/* The Fretboard Quiz: pick a scale, chord or interval set, and Fretwork hides a
   slice of its positions on the neck for you to find. Owns the quiz state
   cluster (round, difficulty, fret range, scores), round generation and the
   lifetime-stats persistence, and publishes the neck itself: the target with
   its hidden slice, the scoring tap handler, and the fret-range bracket. The
   shared right/wrong flash overlay stays in the shell (Strum uses it too), so
   the shell lends its `setFlash` down. */
export function QuizView({ setFlash }) {
  const { settings, capo, midis, n, fretCount } = useSettings();
  const { scaleRoot, setScaleRoot, scaleId, setScaleId, chordRoot, setChordRoot, chordId, setChordId, ivRoot, setIvRoot, ivOn, toggleIv } =
    useSelection();
  const { playNote } = usePlayback();

  const scaleDef = SCALES.find((s) => s.id === scaleId) || SCALES[0];
  const chordDef = CHORDS.find((c) => c.id === chordId) || CHORDS[0];

  const [quiz, setQuiz] = useState({
    source: "scale",
    difficulty: 0.35,
    range: [0, 12],
    hidden: null,
    found: new Set(),
    correct: 0,
    wrong: 0,
    streak: 0,
    best: 0,
    rounds: 0,
    done: false,
  });

  /* Lifetime stats hydrate here on mount rather than at app boot (sanctioned
     split: storage is the source of truth either way). */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await store.get("fretboard:stats");
        if (!cancelled && r && r.value) {
          const v = JSON.parse(r.value);
          setQuiz((q) => ({ ...q, correct: v.correct || 0, wrong: v.wrong || 0, best: v.best || 0, rounds: v.rounds || 0 }));
        }
      } catch (e) {
        /* no stats yet */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveStats = useCallback((q) => {
    store.set("fretboard:stats", JSON.stringify({ correct: q.correct, wrong: q.wrong, best: q.best, rounds: q.rounds })).catch(() => {});
  }, []);

  /* Local copy of App's positionsFor, pending the pure lift into theory.js;
     identical body, closes over the same Settings-derived values. */
  const positionsFor = useCallback(
    (rootPc, ivSet, from = 0, to = fretCount) => {
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
    },
    [midis, n, fretCount, capo],
  );

  /* The quiz slice of App's effFlats memo: spelling follows the material
     being tested. */
  const effFlats = useMemo(() => {
    if (settings.noteNames === "sharps") return false;
    if (settings.noteNames === "flats") return true;
    return quiz.source === "scale"
      ? keyPrefersFlats(scaleRoot, scaleDef.iv)
      : quiz.source === "chord"
        ? keyPrefersFlats(chordRoot, chordDef.iv)
        : keyPrefersFlats(ivRoot, ivOn);
  }, [settings.noteNames, quiz.source, scaleRoot, scaleDef, chordRoot, chordDef, ivRoot, ivOn]);

  /* ---- quiz ---- */
  const quizTargetSet = useCallback(() => {
    if (quiz.source === "scale") {
      const set = new Set(scaleDef.iv.map((i) => i % 12));
      return positionsFor(scaleRoot, set, quiz.range[0], quiz.range[1]);
    }
    if (quiz.source === "interval") {
      return positionsFor(ivRoot, ivOn, quiz.range[0], quiz.range[1]);
    }
    const set = new Set(chordDef.iv.map((i) => i % 12));
    return positionsFor(chordRoot, set, quiz.range[0], quiz.range[1]);
  }, [quiz.source, quiz.range, scaleDef, scaleRoot, chordDef, chordRoot, ivRoot, ivOn, positionsFor]);

  const newRound = useCallback(() => {
    const target = quizTargetSet();
    if (!target.length) {
      setQuiz((q) => ({ ...q, target: [], hidden: new Set(), found: new Set(), done: false }));
      return;
    }
    const total = target.length;
    const count = Math.max(1, Math.round(1 + (total - 1) * quiz.difficulty));
    const pool = target.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = pool[i];
      pool[i] = pool[j];
      pool[j] = t;
    }
    const hidden = new Set(pool.slice(0, count).map((p) => `${p.s}:${p.f}`));
    setQuiz((q) => ({ ...q, target, hidden, found: new Set(), done: false }));
  }, [quizTargetSet, quiz.difficulty]);

  /* A fresh round on mount (this view only renders when active, so mount is
     the old "entered quiz mode") and whenever the material changes. */
  useEffect(() => {
    newRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    quiz.source,
    quiz.difficulty,
    quiz.range[0],
    quiz.range[1],
    scaleRoot,
    scaleId,
    chordRoot,
    chordId,
    ivRoot,
    ivOn,
    capo,
    settings.tuningId,
    settings.fretCount,
  ]);

  useEffect(() => {
    setQuiz((q) =>
      q.range[1] <= fretCount && q.range[0] < fretCount
        ? q
        : { ...q, range: [Math.min(q.range[0], fretCount - 1), Math.min(q.range[1], fretCount)] },
    );
  }, [fretCount]);

  /* the target notes on the neck: plain when to-find, marked once found */
  const marks = useMemo(() => {
    const map = new Map();
    if (quiz.hidden && quiz.target) {
      for (const p of quiz.target) {
        const k = `${p.s}:${p.f}`;
        if (!quiz.hidden.has(k)) map.set(k, { pc: p.pc, semis: p.semis, tone: "quiz", state: "on", finger: null });
        else if (quiz.found.has(k)) map.set(k, { pc: p.pc, semis: p.semis, tone: "quiz", state: "found", finger: null });
      }
    }
    return map;
  }, [quiz.hidden, quiz.found, quiz.target]);

  const onCell = useCallback(
    (s, f, midi) => {
      if (capo > 0 && f > 0 && f < capo) return;
      /* no round yet or round over: sound the note, do not score */
      if (!quiz.hidden || quiz.done || quiz.hidden.size === 0) {
        playNote(midi);
        return;
      }
      const k = `${s}:${f}`;
      if (quiz.found.has(k)) return;
      if (quiz.hidden.has(k)) {
        playNote(midi);
        setFlash({ key: k, ok: true, t: Date.now() });
        setQuiz((q) => {
          const found = new Set(q.found);
          found.add(k);
          const done = found.size >= q.hidden.size;
          const streak = q.streak + 1;
          const next = {
            ...q,
            found,
            done,
            correct: q.correct + 1,
            streak,
            best: Math.max(q.best, streak),
            rounds: done ? q.rounds + 1 : q.rounds,
          };
          saveStats(next);
          return next;
        });
      } else {
        if (settings.sound) blip(false);
        setFlash({ key: k, ok: false, t: Date.now() });
        setQuiz((q) => {
          const next = { ...q, wrong: q.wrong + 1, streak: 0 };
          saveStats(next);
          return next;
        });
      }
    },
    [capo, quiz.hidden, quiz.found, quiz.done, playNote, setFlash, saveStats, settings.sound],
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
        ghosts: null,
        quizActive: true,
        quizRange: quiz.range,
      }),
      [marks, onCell, effFlats, settings.labelMode, settings.colourMode, quiz.range],
    ),
  );

  const src =
    quiz.source === "scale"
      ? `${nameOf(scaleRoot, effFlats)} ${scaleDef.name}`
      : quiz.source === "interval"
        ? `${nameOf(ivRoot, effFlats)} · ${[...ivOn]
            .sort((a, b) => a - b)
            .map((i) => DEG[i])
            .join(" ")}`
        : `${nameOf(chordRoot, effFlats)}${chordDef.suffix || ""}`;
  usePublishReadout(`Fretboard Quiz · ${src} · ${quiz.hidden ? quiz.hidden.size - quiz.found.size : 0} to find`);

  const total = quiz.correct + quiz.wrong;
  const accuracy = total ? Math.round((quiz.correct / total) * 100) : 0;

  return (
    <div className="pane">
      <p className="panelead">Quiz yourself on scales, chords and intervals by naming the notes Fretwork lights up on the neck.</p>
      <div className="scoreboard">
        <div className="score">
          <b>{quiz.correct}</b>
          <span>correct</span>
        </div>
        <div className="score">
          <b className="bad">{quiz.wrong}</b>
          <span>wrong</span>
        </div>
        <div className="score">
          <b>{accuracy}%</b>
          <span>accuracy</span>
        </div>
        <div className="score">
          <b>{quiz.streak}</b>
          <span>streak</span>
        </div>
        <div className="score">
          <b>{quiz.best}</b>
          <span>best run</span>
        </div>
        <div className="score">
          <b>{quiz.rounds}</b>
          <span>rounds</span>
        </div>
      </div>

      <div className="row wrap">
        <Field label="Test me on">
          <Seg
            small
            options={[
              { v: "scale", l: "A scale" },
              { v: "chord", l: "A chord" },
              { v: "interval", l: "Intervals" },
            ]}
            value={quiz.source}
            onChange={(v) => setQuiz((q) => ({ ...q, source: v }))}
          />
        </Field>
        {quiz.source === "scale" && (
          <Field label="Scale">
            <CatPicker
              value={scaleId}
              onChange={setScaleId}
              label="Scale"
              groups={groupItems(SCALE_GROUPS, SCALES, SIMPLE_SCALES, settings.simple, scaleId)}
            />
          </Field>
        )}
        {quiz.source === "chord" && (
          <Field label="Chord">
            <CatPicker
              value={chordId}
              onChange={setChordId}
              label="Chord type"
              groups={groupItems(CHORD_GROUPS, CHORDS, SIMPLE_CHORDS, settings.simple, chordId)}
            />
          </Field>
        )}
      </div>

      <Field label={quiz.source === "scale" ? "Key" : "Root"}>
        <KeyPicker
          value={quiz.source === "scale" ? scaleRoot : quiz.source === "interval" ? ivRoot : chordRoot}
          onChange={quiz.source === "scale" ? setScaleRoot : quiz.source === "interval" ? setIvRoot : setChordRoot}
          flats={effFlats}
        />
      </Field>

      {quiz.source === "interval" && (
        <Field label="Intervals to find">
          <IntervalGrid root={ivRoot} on={ivOn} onToggle={toggleIv} flats={effFlats} />
        </Field>
      )}

      <div className="row">
        <Field label={`Difficulty · ${quiz.hidden ? quiz.hidden.size : 0} of ${quiz.target ? quiz.target.length : 0} hidden`}>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={quiz.difficulty}
            aria-label="Quiz difficulty"
            onChange={(e) => setQuiz((q) => ({ ...q, difficulty: +e.target.value }))}
          />
          <output>
            {quiz.difficulty < 0.2 ? "Easy" : quiz.difficulty < 0.5 ? "Steady" : quiz.difficulty < 0.85 ? "Hard" : "Blank neck"}
          </output>
        </Field>
      </div>

      <Field label={`Frets ${quiz.range[0]} to ${quiz.range[1]}`}>
        <DualRange min={0} max={fretCount} lo={quiz.range[0]} hi={quiz.range[1]} onChange={(r) => setQuiz((q) => ({ ...q, range: r }))} />
      </Field>

      <p role="status" aria-live="polite" className={quiz.source === "interval" && ivOn.size === 0 ? "empty" : quiz.done ? "done" : "note"}>
        {quiz.source === "interval" && ivOn.size === 0
          ? "Pick at least one interval to be tested on."
          : quiz.done
            ? `Round complete. ${quiz.hidden ? quiz.hidden.size : 0} found, streak of ${quiz.streak}.`
            : "Tap every hidden position on the neck. Wrong taps count against you."}
      </p>

      <div className="row actionbar">
        <button
          className="btn primary"
          onClick={() => {
            track("quiz_new_round", { app_mode: quiz.source });
            newRound();
          }}
        >
          New round
        </button>
        <button
          className="btn ghost danger"
          onClick={() => {
            const cleared = { ...quiz, correct: 0, wrong: 0, streak: 0, best: 0, rounds: 0 };
            setQuiz(cleared);
            saveStats(cleared);
          }}
        >
          Reset score
        </button>
      </div>
    </div>
  );
}
