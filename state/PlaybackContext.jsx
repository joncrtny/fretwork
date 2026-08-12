import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ctx, pluck, playClick } from "../audio.ts";
import { useSettings } from "./SettingsContext.jsx";
import { useProgress } from "./ProgressContext.jsx";

/* The audio scheduler and every piece of "is something sounding" state, owned
   together because stopPlayback must reset all of it regardless of which view
   scheduled it. The per-view schedulers (playScale, strum loops, melody
   playback) live with their views on top of these primitives. */
const PlaybackContext = createContext(null);

export function PlaybackProvider({ children }) {
  const { settings } = useSettings();
  const { lastActiveRef, setGamify } = useProgress();
  const [playing, setPlaying] = useState(null); // scale/arp degree highlight
  const [progPlaying, setProgPlaying] = useState(false);
  const [melPlayIdx, setMelPlayIdx] = useState(null);
  const [strumStep, setStrumStep] = useState(null); // current eighth slot during playback
  const [strumOn, setStrumOn] = useState(false);
  const [metroOn, setMetroOn] = useState(false);
  const [beat, setBeat] = useState(-1);
  const playTimers = useRef([]);
  const strumLoopRef = useRef(false);
  const scheduleStrumRef = useRef(() => {});
  const melLoopRef = useRef(false);
  const playMelodyRef = useRef(() => {});

  const playNote = useCallback(
    (midi, when = 0, gain = 0.5) => {
      lastActiveRef.current = Date.now(); // playing a note counts as active practice
      if (settings.sound) pluck(midi, when, gain);
    },
    [settings.sound, lastActiveRef],
  );

  const stopPlayback = useCallback(() => {
    strumLoopRef.current = false;
    melLoopRef.current = false;
    playTimers.current.forEach(clearTimeout);
    playTimers.current = [];
    setPlaying(null);
    setProgPlaying(false);
    setMelPlayIdx(null);
    setStrumOn(false);
    setStrumStep(null);
  }, []);

  /* silence everything when the whole app unmounts */
  useEffect(() => stopPlayback, [stopPlayback]);

  /* metronome: schedule ahead of the audio clock rather than trusting setInterval */
  const nextClick = useRef(0);
  const beatCount = useRef(0);
  useEffect(() => {
    if (!metroOn) {
      setBeat(-1);
      return;
    }
    const ac = ctx();
    if (!ac) return;
    nextClick.current = ac.currentTime + 0.08;
    beatCount.current = 0;
    /* all clicks for this run route through one gain bus, so stopping or
       retuning the metronome silences anything already scheduled ahead */
    const bus = ac.createGain();
    bus.connect(ac.destination);
    /* quieter clicks inside each beat; swing pushes the off-beat to the back
       of the beat. Simple mode plays plain quarters: its panel hides the
       subdivision control, so the setting must not act invisibly. */
    const SUBS = { 2: [0.5], swing: [2 / 3], 3: [1 / 3, 2 / 3], 4: [0.25, 0.5, 0.75] };
    const subs = settings.simple ? [] : SUBS[settings.subdiv] || [];
    const beatTimers = [];
    const id = setInterval(() => {
      const now = ctx();
      if (!now) return;
      while (nextClick.current < now.currentTime + 0.15) {
        lastActiveRef.current = Date.now();
        const b = beatCount.current;
        const isAccent = settings.accent === "down" ? b === 0 : settings.accent === "back" ? b % 2 === 1 : false;
        playClick(settings.clickSound, nextClick.current, isAccent, 0.7, bus);
        const beatSec = 60 / settings.bpm;
        for (const f of subs) playClick(settings.clickSound, nextClick.current + f * beatSec, false, 0.32, bus);
        const lead = Math.max(0, (nextClick.current - now.currentTime) * 1000);
        beatTimers.push(setTimeout(() => setBeat(b), lead));
        nextClick.current += beatSec;
        beatCount.current = (b + 1) % settings.beats;
      }
    }, 25);
    return () => {
      clearInterval(id);
      beatTimers.forEach(clearTimeout);
      bus.disconnect();
    };
  }, [metroOn, settings.bpm, settings.beats, settings.clickSound, settings.accent, settings.subdiv, settings.simple, lastActiveRef]);

  /* count metronome time towards the "In time" badge while it is running and visible */
  useEffect(() => {
    if (!metroOn) return;
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      setGamify((g) => ({ ...g, counters: { ...g.counters, metronomeSeconds: (g.counters.metronomeSeconds || 0) + 10 } }));
    }, 10000);
    return () => clearInterval(id);
  }, [metroOn, setGamify]);

  const value = useMemo(
    () => ({
      playing,
      setPlaying,
      progPlaying,
      setProgPlaying,
      melPlayIdx,
      setMelPlayIdx,
      strumOn,
      setStrumOn,
      strumStep,
      setStrumStep,
      metroOn,
      setMetroOn,
      beat,
      playTimers,
      strumLoopRef,
      scheduleStrumRef,
      melLoopRef,
      playMelodyRef,
      playNote,
      stopPlayback,
    }),
    [playing, progPlaying, melPlayIdx, strumOn, strumStep, metroOn, beat, playNote, stopPlayback],
  );
  return <PlaybackContext.Provider value={value}>{children}</PlaybackContext.Provider>;
}

export function usePlayback() {
  const v = useContext(PlaybackContext);
  if (!v) throw new Error("usePlayback must be used inside <PlaybackProvider>");
  return v;
}
