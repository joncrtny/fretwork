import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nameOf, TUNINGS } from "../theory.ts";
import { nearestStringTarget } from "../lib/utils.ts";
import { track } from "../lib/analytics.ts";
import { Field } from "../components/Field.jsx";
import { KeyPicker } from "../components/KeyPicker.jsx";
import { useSettings } from "../state/SettingsContext.jsx";
import { useProgress } from "../state/ProgressContext.jsx";
import { usePlayback } from "../state/PlaybackContext.jsx";

/* The tuner: a microphone tuner (autocorrelation pitch detection, needle and
   closest-string hint), the string-by-string tuning editor with preset
   tunings, and the capo calculator. The whole mic cluster lives here; the old
   "release the mic on leaving the view" effect is now unmount cleanup, since
   this component only renders while the tuner view is active. */
export function TunerView() {
  const { settings, setSettings, midis, n } = useSettings();
  const { setGamify } = useProgress();
  const { playNote } = usePlayback();

  /* mic tuner: nothing here touches the microphone until the user starts it */
  const [tuner, setTuner] = useState({ on: false, note: null, cents: 0, freq: 0, error: null });
  const micRef = useRef(null); // { stream, ctx, raf }
  const [capoShape, setCapoShape] = useState(7); // chords you know (G shapes)
  const [capoTarget, setCapoTarget] = useState(9); // key you want to hear (A)
  /* stands in for the old modeRef check inside the getUserMedia await: while
     mounted the mode is "tuner", and leaving the view unmounts this component */
  const aliveRef = useRef(true);

  /* the tuner slice of the app-wide effFlats memo: the tuner has no key
     material, so only an explicit Sharps or Flats setting matters and Auto
     falls through to sharps */
  const effFlats = useMemo(() => {
    if (settings.noteNames === "sharps") return false;
    if (settings.noteNames === "flats") return true;
    return false;
  }, [settings.noteNames]);

  /* autocorrelation pitch detection over a mono buffer */
  const detectPitch = (buf, sr) => {
    let rms = 0;
    for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / buf.length);
    if (rms < 0.01) return -1; // too quiet
    let r1 = 0,
      r2 = buf.length - 1;
    const thr = 0.2;
    for (let i = 0; i < buf.length / 2; i++)
      if (Math.abs(buf[i]) < thr) {
        r1 = i;
        break;
      }
    for (let i = 1; i < buf.length / 2; i++)
      if (Math.abs(buf[buf.length - i]) < thr) {
        r2 = buf.length - i;
        break;
      }
    const b = buf.slice(r1, r2);
    /* only correlate lags in the guitar band (about 40 to 1200 Hz), which cuts
       the work from O(n^2) to a narrow strip */
    const minLag = Math.max(1, Math.floor(sr / 1200));
    const maxLag = Math.min(b.length - 1, Math.ceil(sr / 40));
    const c = new Array(maxLag + 1).fill(0);
    for (let lag = minLag; lag <= maxLag; lag++) for (let i = 0; i < b.length - lag; i++) c[lag] += b[i] * b[i + lag];
    let maxv = -1,
      maxp = -1;
    for (let i = minLag; i <= maxLag; i++)
      if (c[i] > maxv) {
        maxv = c[i];
        maxp = i;
      }
    if (maxp <= 0) return -1;
    // parabolic interpolation around the peak
    const x1 = c[maxp - 1] || 0,
      x2 = c[maxp],
      x3 = c[maxp + 1] || 0;
    const a = (x1 + x3 - 2 * x2) / 2,
      bb = (x3 - x1) / 2;
    const period = a ? maxp - bb / (2 * a) : maxp;
    return sr / period;
  };

  const stopTuner = useCallback(() => {
    const m = micRef.current;
    if (m) {
      cancelAnimationFrame(m.raf);
      if (m.stream) m.stream.getTracks().forEach((t) => t.stop());
      if (m.ctx && m.ctx.state !== "closed") m.ctx.close();
      micRef.current = null;
    }
    setTuner({ on: false, note: null, cents: 0, freq: 0, error: null });
  }, []);

  const startTuner = useCallback(async () => {
    if (micRef.current) return; // already listening: ignore a second press
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      /* a second press won the race, or the user left the tuner during the await; release this one */
      if (micRef.current || !aliveRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      const ac = new AC();
      const src = ac.createMediaStreamSource(stream);
      const an = ac.createAnalyser();
      an.fftSize = 2048;
      src.connect(an);
      const buf = new Float32Array(an.fftSize);
      micRef.current = { stream, ctx: ac, raf: 0 };
      setTuner((t) => ({ ...t, on: true, error: null }));
      track("tuner_start");
      let smooth = 0;
      let frame = 0;
      const tick = () => {
        if (!micRef.current) return;
        if (frame++ % 2 === 0) {
          // detection every other frame is plenty and halves the CPU
          an.getFloatTimeDomainData(buf);
          const f = detectPitch(buf, ac.sampleRate);
          if (f > 40 && f < 1200) {
            smooth = smooth ? smooth * 0.8 + f * 0.2 : f;
            const midi = 69 + 12 * Math.log2(smooth / 440);
            const nearest = Math.round(midi);
            const cents = Math.round((midi - nearest) * 100);
            setTuner((t) => ({ ...t, note: nearest, cents, freq: Math.round(smooth) }));
          }
        }
        micRef.current.raf = requestAnimationFrame(tick);
      };
      micRef.current.raf = requestAnimationFrame(tick);
    } catch (e) {
      if (stream) stream.getTracks().forEach((t) => t.stop()); // release an orphaned mic on any post-acquire failure
      setTuner({
        on: false,
        note: null,
        cents: 0,
        freq: 0,
        error: e && e.name === "NotAllowedError" ? "Microphone permission was declined." : "Could not access the microphone.",
      });
    }
  }, []);

  /* release the mic when the view is left: leaving the tuner unmounts this
     component, so the old mode-change release is unmount cleanup here */
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      stopTuner();
    };
  }, [stopTuner]);

  const setTuning = (id) => {
    const t = TUNINGS.find((x) => x.id === id);
    if (!t) return;
    setSettings((s) => ({ ...s, tuningId: id, midis: t.midi }));
    if (id !== "std" && id !== "custom") {
      setGamify((g) => (g.counters.tunings.includes(id) ? g : { ...g, counters: { ...g.counters, tunings: [...g.counters.tunings, id] } }));
    }
  };

  const setStringNote = (idx, midi) => {
    setSettings((s) => {
      const midis2 = s.midis.slice();
      midis2[idx] = midi;
      return { ...s, midis: midis2, tuningId: "custom" };
    });
  };

  return (
    <div className="pane">
      <div className="tunerbox">
        {!tuner.on ? (
          <>
            <p className="note">
              Play a string and Fretwork shows how sharp or flat it is, so you can tune without relying on your ear. The microphone is only
              used while you are tuning, and nothing is recorded or sent anywhere.
            </p>
            <button className="btn primary" onClick={startTuner}>
              Start listening
            </button>
            {tuner.error && (
              <p className="empty" role="status">
                {tuner.error}
              </p>
            )}
          </>
        ) : (
          <>
            {(() => {
              const target = tuner.note != null ? nearestStringTarget(tuner.note, settings.midis) : null;
              const inTune = tuner.note != null && Math.abs(tuner.cents) <= 5;
              return (
                <div className="tunelive" role="status" aria-live="polite">
                  <div className={`tunenote ${inTune ? "intune" : ""}`}>
                    {tuner.note != null ? nameOf(tuner.note % 12, effFlats) : "\u2014"}
                    <span className="tuneoct">{tuner.note != null ? Math.floor(tuner.note / 12) - 1 : ""}</span>
                  </div>
                  <div className="tunemeter" aria-hidden="true">
                    <div className="tunescale">
                      <span className="tunetick c" />
                      <div className="tuneneedle" style={{ left: `${50 + Math.max(-50, Math.min(50, tuner.cents))}%` }} />
                    </div>
                    <div className="tunecents">
                      {tuner.note == null
                        ? "listening"
                        : inTune
                          ? "in tune"
                          : `${tuner.cents > 0 ? "+" : ""}${tuner.cents} cents ${tuner.cents > 0 ? "sharp" : "flat"}`}
                    </div>
                  </div>
                  {target && (
                    <p className="note">
                      Closest string: {target.label}. {target.diff === 0 ? "In tune." : target.diff > 0 ? "Tune down." : "Tune up."}
                    </p>
                  )}
                </div>
              );
            })()}
            <button className="btn ghost danger" onClick={stopTuner}>
              Stop listening
            </button>
          </>
        )}
      </div>

      <p className="note">Or set the strings and pick a preset tuning below.</p>
      <div className="grid">
        <Field label="Tuning">
          <select aria-label="Tuning" value={settings.tuningId} onChange={(e) => setTuning(e.target.value)}>
            {TUNINGS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            {settings.tuningId === "custom" && <option value="custom">Custom</option>}
          </select>
        </Field>
      </div>

      <div className="tuner">
        <span className="flabel">Strings, low to high</span>
        <div className="strings">
          {midis.map((mv, i) => (
            <div className="stringrow" key={i}>
              <span className="sidx">{i + 1}</span>
              <select
                aria-label={`Note for string ${i + 1}`}
                value={mv % 12}
                onChange={(e) => setStringNote(i, Math.floor(mv / 12) * 12 + +e.target.value)}
              >
                {Array.from({ length: 12 }, (_, pc) => (
                  <option key={pc} value={pc}>
                    {nameOf(pc, effFlats)}
                  </option>
                ))}
              </select>
              <select
                aria-label={`Octave for string ${i + 1}`}
                value={Math.floor(mv / 12) - 1}
                onChange={(e) => setStringNote(i, (mv % 12) + (+e.target.value + 1) * 12)}
              >
                {[0, 1, 2, 3, 4, 5].map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              <button className="mini" aria-label={`Play string ${i + 1}`} onClick={() => playNote(mv)}>
                ▸
              </button>
            </div>
          ))}
        </div>
        <div className="stringbtns">
          <button
            className="mini wide"
            onClick={() => setSettings((s) => ({ ...s, midis: [s.midis[0] - 5, ...s.midis], tuningId: "custom" }))}
            disabled={n >= 9}
          >
            Add low string
          </button>
          <button
            className="mini wide"
            onClick={() => setSettings((s) => ({ ...s, midis: s.midis.slice(1), tuningId: "custom" }))}
            disabled={n <= 3}
          >
            Remove low string
          </button>
        </div>
      </div>

      <div className="capocalc">
        <span className="flabel">Capo calculator</span>
        <div className="row wrap">
          <Field label="Chords you play">
            <KeyPicker value={capoShape} onChange={setCapoShape} flats={effFlats} />
          </Field>
          <Field label="Key you want to hear">
            <KeyPicker value={capoTarget} onChange={setCapoTarget} flats={effFlats} />
          </Field>
        </div>
        {(() => {
          const fret = (((capoTarget - capoShape) % 12) + 12) % 12;
          return (
            <p className="note">
              {fret === 0
                ? `Play ${nameOf(capoShape, effFlats)} shapes with no capo to hear ${nameOf(capoTarget, effFlats)}.`
                : `Play ${nameOf(capoShape, effFlats)} shapes with a capo at fret ${fret} to hear ${nameOf(capoTarget, effFlats)}.`}
            </p>
          );
        })()}
      </div>
    </div>
  );
}
