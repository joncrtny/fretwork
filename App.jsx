import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";

/* ============================================================
   THEORY DATA
   ============================================================ */

const SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
const DEG = ["R", "♭2", "2", "♭3", "3", "4", "♭5", "5", "♭6", "6", "♭7", "7"];

const nameOf = (pc, flats) => (flats ? FLAT : SHARP)[((pc % 12) + 12) % 12];

const SCALES = [
  { id: "major", name: "Major (Ionian)", iv: [0, 2, 4, 5, 7, 9, 11] },
  { id: "minor", name: "Natural minor (Aeolian)", iv: [0, 2, 3, 5, 7, 8, 10] },
  { id: "majpent", name: "Major pentatonic", iv: [0, 2, 4, 7, 9] },
  { id: "minpent", name: "Minor pentatonic", iv: [0, 3, 5, 7, 10] },
  { id: "blues", name: "Blues (minor)", iv: [0, 3, 5, 6, 7, 10] },
  { id: "majblues", name: "Blues (major)", iv: [0, 2, 3, 4, 7, 9] },
  { id: "harmmin", name: "Harmonic minor", iv: [0, 2, 3, 5, 7, 8, 11] },
  { id: "melmin", name: "Melodic minor", iv: [0, 2, 3, 5, 7, 9, 11] },
  { id: "dorian", name: "Dorian", iv: [0, 2, 3, 5, 7, 9, 10] },
  { id: "phrygian", name: "Phrygian", iv: [0, 1, 3, 5, 7, 8, 10] },
  { id: "lydian", name: "Lydian", iv: [0, 2, 4, 6, 7, 9, 11] },
  { id: "mixo", name: "Mixolydian", iv: [0, 2, 4, 5, 7, 9, 10] },
  { id: "locrian", name: "Locrian", iv: [0, 1, 3, 5, 6, 8, 10] },
  { id: "phrydom", name: "Phrygian dominant", iv: [0, 1, 4, 5, 7, 8, 10] },
  { id: "lydb7", name: "Lydian ♭7", iv: [0, 2, 4, 6, 7, 9, 10] },
  { id: "altered", name: "Altered (super Locrian)", iv: [0, 1, 3, 4, 6, 8, 10] },
  { id: "wholetone", name: "Whole tone", iv: [0, 2, 4, 6, 8, 10] },
  { id: "dimhw", name: "Diminished (half–whole)", iv: [0, 1, 3, 4, 6, 7, 9, 10] },
  { id: "dimwh", name: "Diminished (whole–half)", iv: [0, 2, 3, 5, 6, 8, 9, 11] },
  { id: "chromatic", name: "Chromatic", iv: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
];

const CHORDS = [
  { id: "maj", name: "Major", suffix: "", iv: [0, 4, 7] },
  { id: "min", name: "Minor", suffix: "m", iv: [0, 3, 7] },
  { id: "5", name: "Power (5)", suffix: "5", iv: [0, 7] },
  { id: "dim", name: "Diminished", suffix: "dim", iv: [0, 3, 6] },
  { id: "aug", name: "Augmented", suffix: "aug", iv: [0, 4, 8] },
  { id: "sus2", name: "Suspended 2nd", suffix: "sus2", iv: [0, 2, 7] },
  { id: "sus4", name: "Suspended 4th", suffix: "sus4", iv: [0, 5, 7] },
  { id: "6", name: "Major 6th", suffix: "6", iv: [0, 4, 7, 9] },
  { id: "m6", name: "Minor 6th", suffix: "m6", iv: [0, 3, 7, 9] },
  { id: "7", name: "Dominant 7th", suffix: "7", iv: [0, 4, 7, 10] },
  { id: "maj7", name: "Major 7th", suffix: "maj7", iv: [0, 4, 7, 11] },
  { id: "m7", name: "Minor 7th", suffix: "m7", iv: [0, 3, 7, 10] },
  { id: "m7b5", name: "Half diminished", suffix: "m7♭5", iv: [0, 3, 6, 10] },
  { id: "dim7", name: "Diminished 7th", suffix: "dim7", iv: [0, 3, 6, 9] },
  { id: "mmaj7", name: "Minor major 7th", suffix: "mMaj7", iv: [0, 3, 7, 11] },
  { id: "7sus4", name: "7sus4", suffix: "7sus4", iv: [0, 5, 7, 10] },
  { id: "add9", name: "Added 9th", suffix: "add9", iv: [0, 2, 4, 7] },
  { id: "9", name: "Dominant 9th", suffix: "9", iv: [0, 2, 4, 7, 10] },
  { id: "maj9", name: "Major 9th", suffix: "maj9", iv: [0, 2, 4, 7, 11] },
  { id: "m9", name: "Minor 9th", suffix: "m9", iv: [0, 2, 3, 7, 10] },
  { id: "11", name: "Dominant 11th", suffix: "11", iv: [0, 2, 5, 7, 10] },
  { id: "13", name: "Dominant 13th", suffix: "13", iv: [0, 4, 7, 9, 10] },
  { id: "7b9", name: "7♭9", suffix: "7♭9", iv: [0, 1, 4, 7, 10] },
  { id: "7s9", name: "7♯9", suffix: "7♯9", iv: [0, 3, 4, 7, 10] },
  { id: "7s5", name: "7♯5", suffix: "7♯5", iv: [0, 4, 8, 10] },
  { id: "7b5", name: "7♭5", suffix: "7♭5", iv: [0, 4, 6, 10] },
];

// midi: C4 = 60, so E2 = 4 + (2+1)*12 = 40
const m = (pc, oct) => pc + (oct + 1) * 12;

const TUNINGS = [
  { id: "std", name: "Standard", midi: [m(4, 2), m(9, 2), m(2, 3), m(7, 3), m(11, 3), m(4, 4)] },
  { id: "dropd", name: "Drop D", midi: [m(2, 2), m(9, 2), m(2, 3), m(7, 3), m(11, 3), m(4, 4)] },
  { id: "halfdown", name: "E♭ standard", midi: [m(3, 2), m(8, 2), m(1, 3), m(6, 3), m(10, 3), m(3, 4)] },
  { id: "dstd", name: "D standard", midi: [m(2, 2), m(7, 2), m(0, 3), m(5, 3), m(9, 3), m(2, 4)] },
  { id: "dropc", name: "Drop C", midi: [m(0, 2), m(7, 2), m(0, 3), m(5, 3), m(9, 3), m(2, 4)] },
  { id: "dadgad", name: "DADGAD", midi: [m(2, 2), m(9, 2), m(2, 3), m(7, 3), m(9, 3), m(2, 4)] },
  { id: "openg", name: "Open G", midi: [m(2, 2), m(7, 2), m(2, 3), m(7, 3), m(11, 3), m(2, 4)] },
  { id: "opend", name: "Open D", midi: [m(2, 2), m(9, 2), m(2, 3), m(6, 3), m(9, 3), m(2, 4)] },
  { id: "opene", name: "Open E", midi: [m(4, 2), m(11, 2), m(4, 3), m(8, 3), m(11, 3), m(4, 4)] },
  { id: "sevenb", name: "7-string (B standard)", midi: [m(11, 1), m(4, 2), m(9, 2), m(2, 3), m(7, 3), m(11, 3), m(4, 4)] },
  { id: "eightf", name: "8-string (F♯ standard)", midi: [m(6, 1), m(11, 1), m(4, 2), m(9, 2), m(2, 3), m(7, 3), m(11, 3), m(4, 4)] },
  { id: "bass4", name: "Bass, 4-string", midi: [m(4, 1), m(9, 1), m(2, 2), m(7, 2)] },
  { id: "bass5", name: "Bass, 5-string", midi: [m(11, 0), m(4, 1), m(9, 1), m(2, 2), m(7, 2)] },
  { id: "uke", name: "Ukulele (GCEA)", midi: [m(7, 4), m(0, 4), m(4, 4), m(9, 4)] },
  { id: "mandolin", name: "Mandolin (GDAE)", midi: [m(7, 3), m(2, 4), m(9, 4), m(4, 5)] },
];

/* roman numeral -> [semitones above the key root, chord id] */
const ROMAN = {
  I: [0, "maj"], ii: [2, "min"], iii: [4, "min"], IV: [5, "maj"], V: [7, "maj"], vi: [9, "min"], "vii°": [11, "dim"],
  i: [0, "min"], "ii°": [2, "dim"], III: [3, "maj"], iv: [5, "min"], v: [7, "min"], VI: [8, "maj"], VII: [10, "maj"],
  bIII: [3, "maj"], bVI: [8, "maj"], bVII: [10, "maj"],
  I7: [0, "7"], IV7: [5, "7"], V7: [7, "7"], Imaj7: [0, "maj7"], IVmaj7: [5, "maj7"],
  ii7: [2, "m7"], iii7: [4, "m7"], vi7: [9, "m7"], i7: [0, "m7"], iv7: [5, "m7"], v7: [7, "m7"],
  "iiø": [2, "m7b5"],
};

const PROGRESSIONS = [
  { id: "p1564", name: "I – V – vi – IV", note: "The four chords", tonality: "major", bars: ["I", "V", "vi", "IV"] },
  { id: "p145", name: "I – IV – V", note: "Three chord trick", tonality: "major", bars: ["I", "IV", "V"] },
  { id: "p1645", name: "I – vi – IV – V", note: "Fifties doo-wop", tonality: "major", bars: ["I", "vi", "IV", "V"] },
  { id: "p6415", name: "vi – IV – I – V", note: "Pop minor start", tonality: "major", bars: ["vi", "IV", "I", "V"] },
  { id: "p1625", name: "I – vi – ii – V", note: "Rhythm changes turnaround", tonality: "major", bars: ["I", "vi", "ii", "V"] },
  { id: "p251", name: "ii7 – V7 – Imaj7", note: "Jazz two five one", tonality: "major", bars: ["ii7", "V7", "Imaj7"] },
  { id: "p1345", name: "I – iii – IV – V", note: "Rising", tonality: "major", bars: ["I", "iii", "IV", "V"] },
  { id: "pmixo", name: "I – bVII – IV", note: "Mixolydian rock", tonality: "major", bars: ["I", "bVII", "IV"] },
  { id: "pcanon", name: "Pachelbel", note: "Canon in D", tonality: "major", bars: ["I", "V", "vi", "iii", "IV", "I", "IV", "V"] },
  { id: "pblues", name: "12-bar blues", note: "Standard", tonality: "major", bars: ["I7", "I7", "I7", "I7", "IV7", "IV7", "I7", "I7", "V7", "IV7", "I7", "V7"] },
  { id: "pbluesq", name: "12-bar, quick change", note: "IV in bar two", tonality: "major", bars: ["I7", "IV7", "I7", "I7", "IV7", "IV7", "I7", "I7", "V7", "IV7", "I7", "V7"] },
  { id: "pm1637", name: "i – VI – III – VII", note: "Natural minor loop", tonality: "minor", bars: ["i", "VI", "III", "VII"] },
  { id: "pm145", name: "i – iv – v", note: "Minor three chord", tonality: "minor", bars: ["i", "iv", "v"] },
  { id: "pandal", name: "i – VII – VI – V", note: "Andalusian cadence", tonality: "minor", bars: ["i", "VII", "VI", "V"] },
  { id: "pm1767", name: "i – VII – VI – VII", note: "Folk minor vamp", tonality: "minor", bars: ["i", "VII", "VI", "VII"] },
  { id: "pm251", name: "iiø – V7 – i7", note: "Minor two five one", tonality: "minor", bars: ["iiø", "V7", "i7"] },
];

const SIMPLE_SCALES = new Set(["major", "minor", "majpent", "minpent", "blues"]);
const SIMPLE_CHORDS = new Set(["maj", "min", "5", "sus4", "7", "m7", "maj7"]);
const SIMPLE_PROGS = new Set(["p1564", "p145", "p1645", "pblues", "pm1637"]);
const simpleList = (arr, allow, on, keepId) =>
  on ? arr.filter((x) => allow.has(x.id) || x.id === keepId) : arr;

const INTERVAL_PRESETS = [
  { id: "root", label: "Root only", iv: [0] },
  { id: "maj", label: "Major triad", iv: [0, 4, 7] },
  { id: "min", label: "Minor triad", iv: [0, 3, 7] },
  { id: "dom7", label: "Dominant 7th", iv: [0, 4, 7, 10] },
  { id: "maj7", label: "Major 7th", iv: [0, 4, 7, 11] },
  { id: "min7", label: "Minor 7th", iv: [0, 3, 7, 10] },
  { id: "pent", label: "Minor pentatonic", iv: [0, 3, 5, 7, 10] },
  { id: "all", label: "All twelve", iv: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
];

const TIME_SIGS = [
  { v: 2, l: "2/4" }, { v: 3, l: "3/4" }, { v: 4, l: "4/4" },
  { v: 5, l: "5/4" }, { v: 6, l: "6/8" }, { v: 7, l: "7/8" },
];

/* interval colour by harmonic function, not by rainbow position */
const FUNC_COLOUR = {
  0: "#E9A824", // root, gold
  1: "#6E9236", 2: "#6E9236", // 2nds, moss
  3: "#12A19A", 4: "#12A19A", // 3rds, teal
  5: "#7C5BB0", // 4th, violet
  6: "#3E7CB1", 7: "#3E7CB1", // tritone and 5th, steel
  8: "#D2763B", 9: "#D2763B", // 6ths, copper
  10: "#BE4E7B", 11: "#BE4E7B", // 7ths, rose
};
const LOWERED = new Set([1, 3, 6, 8, 10]);

const SINGLE_DOTS = [3, 5, 7, 9, 15, 17, 19, 21];
const DOUBLE_DOTS = [12, 24];

/* ============================================================
   AUDIO — Karplus-Strong plucked string
   ============================================================ */

let audioCtx = null;
function ctx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function pluck(midi, when = 0, gain = 0.5) {
  const ac = ctx();
  if (!ac) return;
  const freq = 440 * Math.pow(2, (midi - 69) / 12);
  const sr = ac.sampleRate;
  const N = Math.max(2, Math.round(sr / freq));
  const len = Math.floor(sr * 2.2);
  const buf = ac.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < N; i++) d[i] = Math.random() * 2 - 1;
  const damp = 0.996 - Math.min(0.004, freq / 200000);
  for (let i = N; i < len; i++) d[i] = damp * 0.5 * (d[i - N] + d[i - N + 1]);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = Math.min(7000, freq * 12);
  const g = ac.createGain();
  const t = ac.currentTime + when;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.005);
  g.gain.setTargetAtTime(0.0001, t + 1.0, 0.45);
  src.connect(lp).connect(g).connect(ac.destination);
  src.start(t);
  src.stop(t + 2.2);
}

let noiseBuf = null;
function noise() {
  const ac = ctx();
  if (!ac) return null;
  if (!noiseBuf || noiseBuf.sampleRate !== ac.sampleRate) {
    noiseBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.2), ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function playClick(kind, at, accent, level = 0.7) {
  const ac = ctx();
  if (!ac) return;
  const t = Math.max(at, ac.currentTime);
  const g = ac.createGain();
  g.connect(ac.destination);
  const amp = level * (accent ? 1 : 0.55);

  if (kind === "beep" || kind === "woodblock") {
    const o = ac.createOscillator();
    o.type = kind === "beep" ? "sine" : "triangle";
    const f = kind === "beep" ? (accent ? 1600 : 1000) : accent ? 1250 : 900;
    o.frequency.setValueAtTime(f, t);
    if (kind === "woodblock") o.frequency.exponentialRampToValueAtTime(f * 0.72, t + 0.03);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === "beep" ? 0.06 : 0.045));
    o.connect(g);
    o.start(t);
    o.stop(t + 0.1);
    return;
  }

  const buf = noise();
  if (!buf) return;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const f = ac.createBiquadFilter();
  if (kind === "rim") {
    f.type = "bandpass";
    f.frequency.value = accent ? 3200 : 2400;
    f.Q.value = 9;
  } else {
    f.type = "highpass";
    f.frequency.value = accent ? 3000 : 2000;
  }
  const dur = kind === "rim" ? 0.02 : 0.028;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(amp * 0.9, t + 0.001);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g);
  src.start(t);
  src.stop(t + 0.12);
}

function blip(ok) {
  const ac = ctx();
  if (!ac) return;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = ok ? "triangle" : "sawtooth";
  o.frequency.value = ok ? 880 : 150;
  const t = ac.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.09, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (ok ? 0.18 : 0.26));
  o.connect(g).connect(ac.destination);
  o.start(t);
  o.stop(t + 0.3);
}

/* small persistence shim: Claude artifacts expose window.storage,
   everywhere else falls back to localStorage */
const store = {
  async get(key) {
    if (typeof window === "undefined") throw new Error("no window");
    if (window.storage) return window.storage.get(key);
    const v = window.localStorage.getItem(key);
    if (v === null) throw new Error("not set");
    return { value: v };
  },
  async set(key, value) {
    if (typeof window === "undefined") return;
    if (window.storage) return window.storage.set(key, value);
    window.localStorage.setItem(key, value);
  },
};

/* ============================================================
   VOICING ENGINE
   ============================================================ */

function findVoicings(rootPc, intervals, midis, fretCount, capo, opt) {
  const SPAN = opt.span;
  const chordPcs = [...new Set(intervals.map((i) => (rootPc + i + 144) % 12))];
  const chordSet = new Set(chordPcs);
  const n = midis.length;

  const optional = new Set();
  if (chordPcs.length >= 4) optional.add((rootPc + 7) % 12);
  const required = chordPcs.filter((pc) => !optional.has(pc));
  const thirdPcs = [(rootPc + 3) % 12, (rootPc + 4) % 12].filter((p) => chordSet.has(p));
  const minStrings = Math.max(2, Math.min(3, chordPcs.length));

  const seen = new Set();
  const out = [];
  const cur = new Array(n).fill(null);

  const evaluate = () => {
    const sounding = [];
    for (let s = 0; s < n; s++) if (cur[s] !== null) sounding.push(s);
    if (sounding.length < minStrings) return;
    if (sounding[sounding.length - 1] - sounding[0] !== sounding.length - 1) return;

    const pcs = new Set(sounding.map((s) => (midis[s] + cur[s]) % 12));
    for (const r of required) if (!pcs.has(r)) return;

    const bass = (midis[sounding[0]] + cur[sounding[0]]) % 12;
    if (!opt.inversions && bass !== rootPc) return;

    const frettedStrings = sounding.filter((s) => cur[s] > capo);
    const fingering = new Array(n).fill(null);
    let barreFrom = -1;
    let barreTo = -1;
    const fretted = frettedStrings.map((s) => cur[s]);
    let fingers = 0;
    let span = 0;
    let barre = false;
    let lowest = capo;
    if (fretted.length) {
      let lo = Infinity;
      let hi = -Infinity;
      for (const f of fretted) {
        if (f < lo) lo = f;
        if (f > hi) hi = f;
      }
      span = hi - lo + 1;
      if (span > SPAN) return;
      lowest = lo;
      const atLo = frettedStrings.filter((s) => cur[s] === lo);
      if (atLo.length >= 2 && fretted.length > 4) {
        // barre only when there aren't enough fingers otherwise, and only if
        // nothing underneath the bar needs to ring open
        let blocked = false;
        for (let s = atLo[0] + 1; s < atLo[atLo.length - 1]; s++) if (cur[s] === capo) blocked = true;
        barre = !blocked;
      }
      fingers = barre ? 1 + (fretted.length - atLo.length) : fretted.length;
      if (fingers > 4) return;
      if (!opt.barres && barre) return;

      // lowest fret takes the lowest finger; ties broken by string, low to high
      const items = frettedStrings.map((s) => ({ s, f: cur[s] }));
      let next = 1;
      let rest = items;
      if (barre) {
        for (const it of items) if (it.f === lo) fingering[it.s] = 1;
        rest = items.filter((it) => it.f !== lo);
        barreFrom = atLo[0];
        barreTo = atLo[atLo.length - 1];
        next = 2;
      }
      rest.sort((a, b) => a.f - b.f || a.s - b.s);
      for (const it of rest) fingering[it.s] = next++;
    }

    const key = cur.map((f) => (f === null ? "x" : f)).join(".");
    if (seen.has(key)) return;
    seen.add(key);

    const openCount = sounding.filter((s) => cur[s] === capo).length;
    let score = 0;
    if (bass === rootPc) score += 45;
    score += sounding.length * 7;
    score -= span * 5;
    score -= fingers * 4;
    score -= (fretted.length ? lowest : capo) * 0.6;
    score += openCount * 4;
    if (thirdPcs.some((p) => pcs.has(p))) score += 9;
    if (barre) score -= 2;

    out.push({
      frets: cur.slice(),
      fingering,
      barreFret: barre ? lowest : null,
      barreFrom,
      barreTo,
      lowest: fretted.length ? lowest : capo,
      highest: fretted.length ? lowest + span - 1 : capo,
      fingers,
      span,
      barre,
      bassPc: bass,
      inversion: bass !== rootPc,
      strings: sounding.length,
      score,
      key,
    });
  };

  for (let base = capo + 1; base <= fretCount; base++) {
    const choices = [];
    for (let s = 0; s < n; s++) {
      const arr = [null];
      if (chordSet.has((midis[s] + capo) % 12)) arr.push(capo);
      for (let f = base; f < base + SPAN && f <= fretCount; f++) {
        if (f === capo) continue;
        if (chordSet.has((midis[s] + f) % 12)) arr.push(f);
      }
      choices.push(arr);
    }
    // prune hard: sounding strings must form one contiguous run
    const rec = (s, started, ended) => {
      if (s === n) {
        evaluate();
        return;
      }
      const a = choices[s];
      for (let i = 0; i < a.length; i++) {
        const f = a[i];
        if (f === null) {
          cur[s] = null;
          rec(s + 1, started, started);
        } else {
          if (ended) continue;
          cur[s] = f;
          rec(s + 1, true, false);
        }
      }
      cur[s] = null;
    };
    rec(0, false, false);
  }

  out.sort((a, b) => b.score - a.score);
  const perPosition = new Map();
  const picked = [];
  for (const v of out) {
    const bucket = v.lowest;
    const c = perPosition.get(bucket) || 0;
    if (c >= 2) continue;
    perPosition.set(bucket, c + 1);
    picked.push(v);
    if (picked.length >= 16) break;
  }
  picked.sort((a, b) => a.lowest - b.lowest || b.score - a.score);
  return picked;
}

/* ============================================================
   GEOMETRY
   ============================================================ */

const PAD_L = 74;
const PAD_R = 24;
const PAD_T = 46;
const PAD_B = 30;
const FRET0_W = 64;
const TAPER = 0.976;
const LANE_TOP = 10;
const LANE_H = 24;

function useGeometry(fretCount, stringCount, zoom, leftHanded) {
  return useMemo(() => {
    const w0 = FRET0_W * zoom;
    const xs = [0];
    for (let k = 1; k <= fretCount; k++) xs.push(xs[k - 1] + w0 * Math.pow(TAPER, k - 1));
    const boardW = xs[fretCount];
    const totalW = PAD_L + boardW + PAD_R;

    const gap = 24 * Math.min(1.3, Math.max(0.8, zoom));
    const pad = gap * 0.58;
    const top = PAD_T;
    const bot = top + gap * (stringCount - 1) + pad * 2;
    const cy = (top + bot) / 2;
    const totalH = bot + PAD_B;

    const boardX = PAD_L;
    const px = (x) => (leftHanded ? totalW - x : x);
    const rectX = (x, w) => (leftHanded ? totalW - x - w : x);

    const fretX = (k) => boardX + xs[Math.max(0, Math.min(fretCount, k))];
    const cellX = (k) => (k === 0 ? boardX - 30 : (fretX(k - 1) + fretX(k)) / 2);
    const cellW = (k) => (k === 0 ? 40 : fretX(k) - fretX(k - 1));
    const yRow = (r) => top + pad + r * gap;

    return {
      totalW, totalH, boardX, boardW, top, bot, cy, gap, pad,
      fretX, cellX, cellW, yRow, px, rectX, leftHanded,
    };
  }, [fretCount, stringCount, zoom, leftHanded]);
}

/* ============================================================
   FRETBOARD
   ============================================================ */

function Fretboard({
  fretCount, midis, rowToString, geo, marks, capo, onCapo, onCell,
  flats, labelMode, colourMode, ghosts, flash, quizRange, quizActive, barre,
}) {
  const svgRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const stringCount = midis.length;
  const {
    totalW, totalH, boardX, boardW, top, bot, cy, gap,
    fretX, cellX, cellW, yRow, px, rectX,
  } = geo;

  const boardEnd = boardX + boardW;

  const fretFromX = useCallback(
    (clientX) => {
      const svg = svgRef.current;
      if (!svg) return capo;
      const r = svg.getBoundingClientRect();
      const scale = totalW / r.width;
      let x = (clientX - r.left) * scale;
      if (geo.leftHanded) x = totalW - x;
      if (x < boardX - 4) return 0;
      for (let k = 1; k <= fretCount; k++) if (x < fretX(k)) return k;
      return fretCount;
    },
    [capo, totalW, boardX, fretCount, fretX, geo.leftHanded]
  );

  useEffect(() => {
    if (!dragging) return;
    const move = (e) => onCapo(fretFromX(e.clientX));
    const up = () => setDragging(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [dragging, fretFromX, onCapo]);

  const laneMid = LANE_TOP + LANE_H / 2;
  const puckX = capo > 0 ? cellX(capo) : boardX - 30;
  const capoBarX = capo > 0 ? fretX(capo) - Math.min(9, cellW(capo) * 0.22) : 0;

  return (
    <svg
      ref={svgRef}
      className="fretboard"
      viewBox={`0 0 ${totalW} ${totalH}`}
      width={totalW}
      height={totalH}
      role="img"
      aria-label="Guitar neck"
    >
      {/* capo track */}
      <g>
        <rect
          x={rectX(boardX - 50, boardW + 50)} y={LANE_TOP}
          width={boardW + 50} height={LANE_H} rx={LANE_H / 2}
          fill="var(--lane)"
        />
        <line
          x1={px(boardX - 12)} y1={LANE_TOP + 5}
          x2={px(boardX - 12)} y2={LANE_TOP + LANE_H - 5}
          stroke="var(--line2)" strokeWidth="1"
        />
        <text x={px(boardX - 31)} y={laneMid + 3.5} textAnchor="middle" fontSize="9" className="fretnum" fill="var(--muted)">
          {capo > 0 ? "OFF" : ""}
        </text>
        <rect
          x={rectX(boardX - 50, boardW + 50)} y={LANE_TOP}
          width={boardW + 50} height={LANE_H} rx={LANE_H / 2}
          fill="transparent" className="lane"
          onPointerDown={(e) => {
            e.preventDefault();
            onCapo(fretFromX(e.clientX));
            setDragging(true);
          }}
        />
        <g
          className={`capo ${dragging ? "drag" : ""}`}
          tabIndex={0}
          role="slider"
          aria-label="Capo position"
          aria-valuemin={0}
          aria-valuemax={fretCount}
          aria-valuenow={capo}
          aria-valuetext={capo === 0 ? "No capo" : `Fret ${capo}`}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragging(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowUp") { onCapo(Math.min(fretCount, capo + 1)); e.preventDefault(); }
            if (e.key === "ArrowLeft" || e.key === "ArrowDown") { onCapo(Math.max(0, capo - 1)); e.preventDefault(); }
            if (e.key === "Home") { onCapo(0); e.preventDefault(); }
          }}
        >
          <rect
            x={rectX(puckX - 15, 30)} y={LANE_TOP + 2}
            width={30} height={LANE_H - 4} rx="9"
            fill={capo > 0 ? "var(--ink)" : "var(--card)"}
            stroke={capo > 0 ? "var(--ink)" : "var(--line2)"} strokeWidth="1.5"
          />
          <text
            x={px(puckX)} y={laneMid + 3.5} textAnchor="middle" fontSize="10"
            className="fretnum" fill={capo > 0 ? "var(--onink)" : "var(--muted)"}
          >
            {capo > 0 ? capo : "CAPO"}
          </text>
        </g>
      </g>

      {/* board */}
      <rect
        x={rectX(boardX, boardW)} y={top} width={boardW} height={bot - top}
        rx="4" fill="var(--board)" stroke="var(--line)" strokeWidth="1"
      />

      {/* position inlays */}
      {Array.from({ length: fretCount }, (_, i) => i + 1).map((k) => {
        const x = cellX(k);
        if (DOUBLE_DOTS.includes(k))
          return (
            <g key={`i${k}`}>
              <circle cx={px(x)} cy={cy - gap * 0.85} r="4.5" fill="var(--inlay)" />
              <circle cx={px(x)} cy={cy + gap * 0.85} r="4.5" fill="var(--inlay)" />
            </g>
          );
        if (SINGLE_DOTS.includes(k)) return <circle key={`i${k}`} cx={px(x)} cy={cy} r="4.5" fill="var(--inlay)" />;
        return null;
      })}

      {/* frets */}
      {Array.from({ length: fretCount }, (_, i) => i + 1).map((k) => (
        <line
          key={`f${k}`}
          x1={px(fretX(k))} y1={top} x2={px(fretX(k))} y2={bot}
          stroke="var(--fret)" strokeWidth="1.5"
        />
      ))}

      {/* nut */}
      <rect x={rectX(boardX - 5, 5)} y={top} width={5} height={bot - top} rx="1.5" fill="var(--ink)" />

      {/* strings */}
      {Array.from({ length: stringCount }, (_, r) => r).map((r) => {
        const s = rowToString(r);
        const y = yRow(r);
        return (
          <line
            key={`s${r}`}
            x1={px(boardX - 46)} y1={y} x2={px(boardEnd)} y2={y}
            stroke="var(--string)" strokeWidth={0.9 + (1 - s / Math.max(1, stringCount - 1)) * 1.1}
          />
        );
      })}

      {/* out of play: behind the capo, or outside the quiz range */}
      {capo > 0 && (
        <rect
          x={rectX(boardX, Math.max(0, capoBarX - boardX))} y={top}
          width={Math.max(0, capoBarX - boardX)} height={bot - top}
          fill="var(--muted)" opacity="0.2"
        />
      )}
      {quizActive && quizRange[0] > 0 && (
        <rect
          x={rectX(boardX, Math.max(0, fretX(quizRange[0] - 1) - boardX))} y={top}
          width={Math.max(0, fretX(quizRange[0] - 1) - boardX)} height={bot - top}
          fill="var(--muted)" opacity="0.16"
        />
      )}
      {quizActive && quizRange[1] < fretCount && (
        <rect
          x={rectX(fretX(quizRange[1]), boardEnd - fretX(quizRange[1]))} y={top}
          width={Math.max(0, boardEnd - fretX(quizRange[1]))} height={bot - top}
          fill="var(--muted)" opacity="0.16"
        />
      )}

      {/* capo bar on the neck */}
      {capo > 0 && (
        <rect
          x={rectX(capoBarX - 2.5, 5)} y={top - 4} width={5} height={bot - top + 8}
          rx="2.5" fill="var(--ink)" pointerEvents="none"
        />
      )}

      {/* fret numbers */}
      {Array.from({ length: fretCount + 1 }, (_, k) => k).map((k) => {
        const marked = k === 0 || SINGLE_DOTS.includes(k) || DOUBLE_DOTS.includes(k);
        return (
          <text
            key={`n${k}`} x={px(k === 0 ? boardX - 30 : cellX(k))} y={bot + 17}
            textAnchor="middle" className="fretnum" fontSize="10"
            fill={marked ? "var(--ink)" : "var(--muted)"}
          >
            {k}
          </text>
        );
      })}

      {/* barre bar */}
      {barre && (() => {
        const rows = [];
        for (let r = 0; r < stringCount; r++) {
          const st = rowToString(r);
          if (st >= barre.from && st <= barre.to) rows.push(r);
        }
        if (!rows.length) return null;
        const y1 = yRow(Math.min.apply(null, rows));
        const y2 = yRow(Math.max.apply(null, rows));
        const x = cellX(barre.fret);
        return (
          <rect
            x={rectX(x - 10, 20)} y={y1 - 10} width={20} height={y2 - y1 + 20}
            rx="10" fill="var(--barre)" pointerEvents="none"
          />
        );
      })()}

      {/* cells and notes */}
      {Array.from({ length: stringCount }, (_, r) => r).map((r) => {
        const s = rowToString(r);
        const y = yRow(r);
        return Array.from({ length: fretCount + 1 }, (_, k) => k).map((k) => {
          const x = cellX(k);
          const key = `${s}:${k}`;
          const mark = marks.get(key) || null;
          const ghost = !mark && ghosts && ghosts.has(key);
          const isFlash = flash && flash.key === key;
          const dead = capo > 0 && k < capo;
          const w = cellW(k);
          return (
            <g key={key} opacity={mark && mark.state === "dim" ? 0.24 : 1}>
              <rect
                x={rectX(x - w / 2, w)} y={y - Math.min(15, gap * 0.5)}
                width={w} height={Math.min(30, gap)}
                fill="transparent" style={{ cursor: onCell ? "pointer" : "default" }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  if (onCell) onCell(s, k, midis[s] + k);
                }}
              />
              {ghost && !dead && <circle cx={px(x)} cy={y} r="3.5" fill="var(--muted)" opacity="0.5" pointerEvents="none" />}
              {isFlash && (
                <circle
                  cx={px(x)} cy={y} r="12" fill="none"
                  stroke={flash.ok ? "#12A19A" : "#D2544F"} strokeWidth="2.5"
                  className="ping" pointerEvents="none"
                />
              )}
              {mark && !dead && (
                <NoteDot x={px(x)} y={y} mark={mark} flats={flats} labelMode={labelMode} colourMode={colourMode} maxW={w} />
              )}
            </g>
          );
        });
      })}
    </svg>
  );
}

function NoteDot({ x, y, mark, flats, labelMode, colourMode, maxW }) {
  const semis = mark.semis;
  let fill = "var(--dotplain)";
  let stroke = "var(--board)";
  let text = "var(--onink)";

  if (colourMode === "interval") {
    const c = FUNC_COLOUR[semis] || "var(--dotplain)";
    if (LOWERED.has(semis)) {
      fill = "var(--board)";
      stroke = c;
      text = c;
    } else {
      fill = c;
      text = semis === 0 ? "#26200C" : "#FFFFFF";
    }
  } else if (colourMode === "root") {
    if (semis === 0) { fill = "#E9A824"; text = "#26200C"; }
    else if (mark.tone === "chord") { fill = "#12A19A"; text = "#FFFFFF"; }
    else { fill = "var(--dotplain)"; text = "var(--onink)"; }
  } else {
    fill = semis === 0 ? "#E9A824" : "var(--dotplain)";
    text = semis === 0 ? "#26200C" : "var(--onink)";
  }

  const pill = labelMode === "both";
  const label =
    labelMode === "none"
      ? ""
      : labelMode === "finger"
      ? mark.finger != null ? String(mark.finger) : ""
      : labelMode === "degree"
      ? DEG[semis]
      : labelMode === "both"
      ? `${DEG[semis]} ${nameOf(mark.pc, flats)}`
      : nameOf(mark.pc, flats);

  const w = Math.max(24, Math.min(36, (maxW || 36) - 3));
  const lit = mark.state === "lit";

  return (
    <g pointerEvents="none" className={mark.state === "found" ? "pop" : "dot"}>
      {lit &&
        (pill ? (
          <rect x={x - w / 2 - 4} y={y - 13} width={w + 8} height={26} rx="13" fill="none" stroke="#E9A824" strokeWidth="3" />
        ) : (
          <circle cx={x} cy={y} r="15" fill="none" stroke="#E9A824" strokeWidth="3" />
        ))}
      {pill ? (
        <rect x={x - w / 2} y={y - 9} width={w} height="18" rx="9" fill={fill} stroke={stroke} strokeWidth="2" />
      ) : (
        <circle cx={x} cy={y} r="11" fill={fill} stroke={stroke} strokeWidth="2" />
      )}
      {label && (
        <text
          x={x} y={y + 3.4} textAnchor="middle"
          fontSize={pill ? 9 : label.length > 2 ? 8.5 : 10}
          className="dotlabel" fill={text}
        >
          {label}
        </text>
      )}
    </g>
  );
}

/* ============================================================
   MINI CHORD DIAGRAM
   ============================================================ */

function ChordDiagram({ voicing, midis, rootPc, capo, selected, onSelect, flats, showDegrees, title, caption }) {
  const n = midis.length;
  const S = 1.5;
  const W = 15 * S;          // column pitch
  const PADX = 13 * S;       // left inset
  const TOP = 17 * S;        // y of the nut line
  const RH = 17 * S;         // fret row height
  const R = 6.2 * S;         // dot radius
  const rows = 5;
  const w = (n - 1) * W + 26 * S;
  const h = rows * RH + 34 * S;
  const base = Math.max(capo + 1, voicing.lowest);
  const openish = capo;
  const cols = Array.from({ length: n }, (_, i) => i);

  return (
    <button className={`voicing ${selected ? "sel" : ""}`} onClick={() => onSelect(voicing)} aria-pressed={selected}>
      {title && (
        <span className="vtitle">
          {title}
          {caption && <em>{caption}</em>}
        </span>
      )}
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {cols.map((i) => {
          const st = n - 1 - i;
          const f = voicing.frets[st];
          return (
            <text
              key={`t${i}`} x={PADX + i * W} y={TOP - 7} textAnchor="middle" fontSize={9 * S}
              className="fretnum" fill={f === null ? "var(--red)" : "var(--muted)"}
            >
              {f === null ? "\u00d7" : f === openish ? "\u25cb" : ""}
            </text>
          );
        })}
        <line
          x1={PADX} y1={TOP} x2={PADX + (n - 1) * W} y2={TOP}
          stroke={base === capo + 1 ? "var(--ink)" : "var(--line2)"} strokeWidth={base === capo + 1 ? 3 * S : 1.2 * S}
        />
        {Array.from({ length: rows }, (_, r) => (
          <line key={`h${r}`} x1={PADX} y1={TOP + (r + 1) * RH} x2={PADX + (n - 1) * W} y2={TOP + (r + 1) * RH} stroke="var(--line)" strokeWidth="1" />
        ))}
        {cols.map((i) => (
          <line key={`v${i}`} x1={PADX + i * W} y1={TOP} x2={PADX + i * W} y2={TOP + rows * RH} stroke="var(--line)" strokeWidth="1" />
        ))}
        {base > capo + 1 && (
          <text x={PADX * 0.34} y={TOP + RH * 0.62} textAnchor="middle" fontSize={9 * S} className="fretnum" fill="var(--goldtext)">{base}</text>
        )}
        {voicing.barreFret != null && voicing.barreFret - base >= 0 && voicing.barreFret - base < rows && (
          <rect
            x={PADX + (n - 1 - voicing.barreTo) * W - R}
            y={TOP + (voicing.barreFret - base) * RH + RH / 2 - R}
            width={(voicing.barreTo - voicing.barreFrom) * W + R * 2}
            height={R * 2} rx={R} fill="var(--dotplain)"
          />
        )}
        {cols.map((i) => {
          const st = n - 1 - i;
          const f = voicing.frets[st];
          if (f === null || f === openish) return null;
          const row = f - base;
          if (row < 0 || row >= rows) return null;
          const x = PADX + i * W;
          const y = TOP + row * RH + RH / 2;
          const semis = (((midis[st] + f) % 12) - rootPc + 24) % 12;
          const isRoot = semis === 0;
          return (
            <g key={`d${i}`}>
              <circle cx={x} cy={y} r={R} fill={isRoot ? "#E9A824" : "var(--dotplain)"} stroke="var(--board)" strokeWidth="1" />
              <text x={x} y={y + 3.6} textAnchor="middle" fontSize={8 * S} className="dotlabel" fill={isRoot ? "#26200C" : "var(--onink)"}>
                {showDegrees ? DEG[semis] : voicing.fingering[st] || ""}
              </text>
            </g>
          );
        })}
      </svg>
      <span className="vmeta">
        {voicing.barre ? "barre" : `${voicing.fingers} fing`}
        {voicing.inversion ? ` \u00b7 /${nameOf(voicing.bassPc, flats)}` : ""}
      </span>
    </button>
  );
}

/* ============================================================
   SMALL UI PIECES
   ============================================================ */

function useNarrow(bp = 700) {
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= bp
  );
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(`(max-width:${bp}px)`);
    const handle = (e) => setNarrow(e.matches);
    setNarrow(mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", handle);
    else mq.addListener(handle);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handle);
      else mq.removeListener(handle);
    };
  }, [bp]);
  return narrow;
}

function Seg({ options, value, onChange, small, responsive = true }) {
  const narrow = useNarrow();
  if (responsive && narrow) {
    const idx = options.findIndex((o) => o.v === value);
    return (
      <select
        className="segsel"
        value={idx < 0 ? 0 : idx}
        onChange={(e) => onChange(options[+e.target.value].v)}
      >
        {options.map((o, i) => (
          <option key={i} value={i}>{o.l}</option>
        ))}
      </select>
    );
  }
  return (
    <div className={`seg ${small ? "sm" : ""}`} role="group">
      {options.map((o) => (
        <button
          key={String(o.v)}
          aria-pressed={value === o.v}
          className={value === o.v ? "on" : ""}
          onClick={() => onChange(o.v)}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="field">
      <span className="flabel">{label}</span>
      {children}
    </div>
  );
}

function IntervalGrid({ root, on, onToggle, flats }) {
  return (
    <div className="ivgrid">
      {DEG.map((d, i) => {
        const active = on.has(i);
        const c = FUNC_COLOUR[i];
        return (
          <button
            key={i}
            className={`iv ${active ? "on" : ""} ${LOWERED.has(i) ? "low" : ""}`}
            aria-pressed={active}
            style={
              active
                ? { background: LOWERED.has(i) ? "transparent" : c, borderColor: c, color: LOWERED.has(i) ? c : "#FFFFFF" }
                : { borderColor: "var(--fret)" }
            }
            onClick={() => onToggle(i)}
          >
            <b>{d}</b>
            <em>{nameOf(root + i, flats)}</em>
          </button>
        );
      })}
    </div>
  );
}

function KeyPicker({ value, onChange, flats, tip }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);
  return (
    <div className="picker" onPointerDown={(e) => e.stopPropagation()}>
      <button
        className={`pickbtn ${open ? "open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        data-tip={tip}
      >
        <span>{nameOf(value, flats)}</span>
        <i className="caret" aria-hidden="true" />
      </button>
      {open && (
        <div className="pickmenu" role="listbox">
          {Array.from({ length: 12 }, (_, i) => i).map((pc) => (
            <button
              key={pc}
              role="option"
              aria-selected={pc === value}
              className={pc === value ? "key on" : "key"}
              onClick={() => { onChange(pc); setOpen(false); }}
            >
              {nameOf(pc, flats)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   APP
   ============================================================ */

const DEFAULT_SETTINGS = {
  fretCount: 22,
  tuningId: "std",
  midis: TUNINGS[0].midi,
  flats: false,
  leftHanded: false,
  highOnTop: true,
  labelMode: "name",
  colourMode: "interval",
  sound: true,
  zoom: 1,
  bpm: 90,
  beats: 4,
  clickSound: "click",
  accent: "down",
  dark: false,
  simple: false,
  span: 4,
  inversions: false,
  barres: true,
};

export default function App() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState("chord");
  const [capo, setCapo] = useState(0);
  const [openPanel, setOpenPanel] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const [scalePos, setScalePos] = useState(null);
  const [chordArea, setChordArea] = useState(null);
  const [toast, setToast] = useState("");

  const [scaleRoot, setScaleRoot] = useState(0);
  const [scaleId, setScaleId] = useState("major");
  const [scaleLabel, setScaleLabel] = useState("name");
  const [playing, setPlaying] = useState(null);

  const [chordRoot, setChordRoot] = useState(0);
  const [chordId, setChordId] = useState("maj");
  const [voiceIdx, setVoiceIdx] = useState(0);

  const [showAllTones, setShowAllTones] = useState(true);
  const [chordLabel, setChordLabel] = useState("finger");

  const [ivRoot, setIvRoot] = useState(0);
  const [ivOn, setIvOn] = useState(() => new Set([0, 4, 7]));
  const toggleIv = useCallback((i) => {
    setIvOn((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }, []);

  const [progRoot, setProgRoot] = useState(0);
  const [progId, setProgId] = useState("p1564");
  const [progIdx, setProgIdx] = useState(0);

  const [bank, setBank] = useState([]);
  const [metroOn, setMetroOn] = useState(false);
  const [beat, setBeat] = useState(-1);

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
  const [flash, setFlash] = useState(null);

  /* fonts */
  useEffect(() => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href =
      "https://fonts.googleapis.com/css2?family=Antonio:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap";
    document.head.appendChild(l);
    return () => {
      if (l.parentNode) l.parentNode.removeChild(l);
    };
  }, []);

  /* persisted state */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await store.get("fretboard:settings");
        if (!cancelled && r && r.value) {
          const v = JSON.parse(r.value);
          setSettings((s) => ({ ...s, ...v }));
        }
      } catch (e) {
        /* first run, nothing stored */
      }
      try {
        const r = await store.get("fretboard:bank");
        if (!cancelled && r && r.value) {
          const v = JSON.parse(r.value);
          if (Array.isArray(v)) setBank(v);
        }
      } catch (e) {
        /* nothing saved yet */
      }
      try {
        const r = await store.get("fretboard:stats");
        if (!cancelled && r && r.value) {
          const v = JSON.parse(r.value);
          setQuiz((q) => ({ ...q, correct: v.correct || 0, wrong: v.wrong || 0, best: v.best || 0, rounds: v.rounds || 0 }));
        }
      } catch (e) {
        /* no stats yet */
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      store.set("fretboard:settings", JSON.stringify(settings)).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [settings, loaded]);

  const saveStats = useCallback((q) => {
    store
      .set("fretboard:stats", JSON.stringify({ correct: q.correct, wrong: q.wrong, best: q.best, rounds: q.rounds }))
      .catch(() => {});
  }, []);

  const saveBank = useCallback((next) => {
    setBank(next);
    store.set("fretboard:bank", JSON.stringify(next)).catch(() => {});
  }, []);

  /* derived */
  const midis = settings.midis;
  const n = midis.length;
  const fretCount = settings.fretCount;
  const rowToString = useCallback(
    (r) => (settings.highOnTop ? n - 1 - r : r),
    [n, settings.highOnTop]
  );
  const geo = useGeometry(fretCount, n, settings.zoom, settings.leftHanded);

  const scaleDef = SCALES.find((s) => s.id === scaleId) || SCALES[0];

  /* One position per scale degree that falls on the lowest string, four frets
     wide. For a pentatonic this reproduces the five familiar boxes; for a
     seven note scale it gives the seven three-note-per-string shapes. Derived
     from the tuning, so it holds up in any tuning. */
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

  useEffect(() => { setScalePos(null); }, [scaleId, scaleRoot, settings.tuningId, capo]);
  const chordDef = CHORDS.find((c) => c.id === chordId) || CHORDS[0];

  const vopt = useMemo(
    () => ({ span: settings.span, inversions: settings.inversions, barres: settings.barres }),
    [settings.span, settings.inversions, settings.barres]
  );

  const voicings = useMemo(() => {
    if (mode !== "chord") return [];
    return findVoicings(chordRoot, chordDef.iv, midis, fretCount, capo, vopt);
  }, [mode, chordRoot, chordDef, midis, fretCount, capo, vopt]);

  /* the frets a shape can start on, so you can jump to shapes near your hand */
  const chordAreas = useMemo(() => [...new Set(voicings.map((v) => v.lowest))].sort((a, b) => a - b), [voicings]);

  const shownVoicings = useMemo(
    () => (chordArea == null ? voicings : voicings.filter((v) => v.lowest === chordArea)),
    [voicings, chordArea]
  );

  useEffect(() => {
    setVoiceIdx(0);
  }, [chordRoot, chordId, vopt, capo, settings.tuningId, settings.fretCount, chordArea]);

  useEffect(() => {
    if (chordArea != null && !chordAreas.includes(chordArea)) setChordArea(null);
  }, [chordAreas, chordArea]);

  const activeVoicing = shownVoicings[Math.min(voiceIdx, Math.max(0, shownVoicings.length - 1))] || null;

  const progDef = PROGRESSIONS.find((p) => p.id === progId) || PROGRESSIONS[0];

  const progChords = useMemo(
    () =>
      progDef.bars.map((rn) => {
        const entry = ROMAN[rn] || [0, "maj"];
        const def = CHORDS.find((c) => c.id === entry[1]) || CHORDS[0];
        return { roman: rn, rootPc: (progRoot + entry[0]) % 12, chordId: entry[1], def };
      }),
    [progDef, progRoot]
  );

  const progVoicings = useMemo(() => {
    if (mode !== "prog") return [];
    const cache = new Map();
    return progChords.map((c) => {
      const key = `${c.rootPc}:${c.chordId}`;
      if (!cache.has(key)) {
        const v = findVoicings(c.rootPc, c.def.iv, midis, fretCount, capo, { span: 4, inversions: false, barres: true });
        cache.set(key, v[0] || null);
      }
      return cache.get(key);
    });
  }, [mode, progChords, midis, fretCount, capo]);

  useEffect(() => { setProgIdx(0); }, [progId, progRoot]);

  const activeProg = progChords[Math.min(progIdx, progChords.length - 1)] || null;
  const activeProgVoicing = progVoicings[Math.min(progIdx, progVoicings.length - 1)] || null;

  const playNote = useCallback(
    (midi, when = 0) => {
      if (settings.sound) pluck(midi, when);
    },
    [settings.sound]
  );

  /* ---- which positions light up ---- */
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
    [midis, n, fretCount, capo]
  );

  const marks = useMemo(() => {
    const map = new Map();
    const add = (s, f, pc, semis, tone, state, finger) => {
      map.set(`${s}:${f}`, { pc, semis, tone, state: state || "on", finger: finger == null ? null : finger });
    };

    if (mode === "scale") {
      const set = new Set(scaleDef.iv.map((i) => i % 12));
      const win = scalePos != null ? positions[scalePos] : null;
      for (const p of positionsFor(scaleRoot, set)) {
        const outside = win && (p.f < win.from || p.f > win.to);
        const state = playing != null ? (p.semis === playing ? "lit" : "dim") : outside ? "dim" : null;
        add(p.s, p.f, p.pc, p.semis, "scale", state);
      }
    }

    if (mode === "interval") {
      for (const p of positionsFor(ivRoot, ivOn)) add(p.s, p.f, p.pc, p.semis, "interval");
    }

    if (mode === "chord") {
      if (activeVoicing) {
        for (let s = 0; s < n; s++) {
          const f = activeVoicing.frets[s];
          if (f === null) continue;
          const pc = (midis[s] + f) % 12;
          add(s, f, pc, (pc - chordRoot + 24) % 12, "chord", null, activeVoicing.fingering[s]);
        }
      }
    }

    if (mode === "prog" && activeProg && activeProgVoicing) {
      for (let s2 = 0; s2 < n; s2++) {
        const f = activeProgVoicing.frets[s2];
        if (f === null) continue;
        const pc = (midis[s2] + f) % 12;
        add(s2, f, pc, (pc - activeProg.rootPc + 24) % 12, "chord", null, activeProgVoicing.fingering[s2]);
      }
    }

    if (mode === "quiz" && quiz.hidden) {
      const target = quiz.target;
      for (const p of target) {
        const k = `${p.s}:${p.f}`;
        if (!quiz.hidden.has(k)) add(p.s, p.f, p.pc, p.semis, "quiz");
        else if (quiz.found.has(k)) add(p.s, p.f, p.pc, p.semis, "quiz", "found");
      }
    }

    return map;
  }, [mode, scaleDef, scaleRoot, ivRoot, ivOn, activeVoicing, chordRoot, midis, n, quiz, positionsFor, playing, activeProg, activeProgVoicing, scalePos, positions]);

  const ghosts = useMemo(() => {
    if (mode !== "chord" || !showAllTones) return null;
    const set = new Set(chordDef.iv.map((i) => i % 12));
    const g = new Set();
    for (const p of positionsFor(chordRoot, set)) g.add(`${p.s}:${p.f}`);
    return g;
  }, [mode, showAllTones, chordDef, chordRoot, positionsFor]);

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

  useEffect(() => {
    if (mode === "quiz") newRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, quiz.source, quiz.difficulty, quiz.range[0], quiz.range[1], scaleRoot, scaleId, chordRoot, chordId, ivRoot, ivOn, capo, settings.tuningId, settings.fretCount]);

  const onCell = useCallback(
    (s, f, midi) => {
      if (capo > 0 && f > 0 && f < capo) return;
      if (mode !== "quiz" || !quiz.hidden) {
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
            ...q, found, done,
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
    [mode, quiz.hidden, quiz.found, capo, playNote, saveStats, settings.sound]
  );

  useEffect(() => {
    setQuiz((q) =>
      q.range[1] <= fretCount && q.range[0] < fretCount
        ? q
        : { ...q, range: [Math.min(q.range[0], fretCount - 1), Math.min(q.range[1], fretCount)] }
    );
  }, [fretCount]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 480);
    return () => clearTimeout(t);
  }, [flash]);

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

  const playTimers = useRef([]);
  const stopPlayback = useCallback(() => {
    playTimers.current.forEach(clearTimeout);
    playTimers.current = [];
    setPlaying(null);
  }, []);

  const playScale = useCallback(() => {
    stopPlayback();
    const STEP = 0.52;
    const seq = scaleDef.iv.map((i) => i % 12).concat([0]);
    const rootMidi = midis[0] + ((scaleRoot - (midis[0] % 12) + 24) % 12) + 12;
    seq.forEach((iv, i) => {
      const up = i === seq.length - 1 ? 12 : iv;
      playNote(rootMidi + up, i * STEP);
      playTimers.current.push(setTimeout(() => setPlaying(iv), i * STEP * 1000));
    });
    playTimers.current.push(setTimeout(() => setPlaying(null), seq.length * STEP * 1000));
  }, [scaleDef, scaleRoot, midis, playNote, stopPlayback]);

  const playProgression = useCallback(() => {
    stopPlayback();
    const barSec = (60 / settings.bpm) * settings.beats;
    progChords.forEach((c, i) => {
      const v = progVoicings[i];
      if (v) {
        let j = 0;
        for (let st = 0; st < n; st++) {
          const f = v.frets[st];
          if (f === null) continue;
          playNote(midis[st] + f, i * barSec + j * 0.028);
          j++;
        }
      }
      playTimers.current.push(setTimeout(() => setProgIdx(i), i * barSec * 1000));
    });
  }, [stopPlayback, settings.bpm, settings.beats, progChords, progVoicings, midis, n, playNote]);

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
    const id = setInterval(() => {
      const now = ctx();
      if (!now) return;
      while (nextClick.current < now.currentTime + 0.15) {
        const b = beatCount.current;
        const isAccent =
          settings.accent === "down" ? b === 0 : settings.accent === "back" ? b % 2 === 1 : false;
        playClick(settings.clickSound, nextClick.current, isAccent);
        const lead = Math.max(0, (nextClick.current - now.currentTime) * 1000);
        setTimeout(() => setBeat(b), lead);
        nextClick.current += 60 / settings.bpm;
        beatCount.current = (b + 1) % settings.beats;
      }
    }, 25);
    return () => clearInterval(id);
  }, [metroOn, settings.bpm, settings.beats, settings.clickSound, settings.accent]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => stopPlayback, [stopPlayback]);
  useEffect(() => { stopPlayback(); }, [mode, scaleId, scaleRoot, progId, progRoot, stopPlayback]);

  /* ---- readout ---- */
  const readout = useMemo(() => {
    if (mode === "scale")
      return `${nameOf(scaleRoot, settings.flats)} ${scaleDef.name} · ${scaleDef.iv.length} notes`;
    if (mode === "chord")
      return `${nameOf(chordRoot, settings.flats)}${chordDef.suffix || ""} · ${shownVoicings.length} voicings`;
    if (mode === "prog")
      return `${nameOf(progRoot, settings.flats)} \u00b7 ${progDef.name} \u00b7 ${progDef.bars.length} bars`;
    if (mode === "bank") return `Bank \u00b7 ${bank.length} saved`;
    if (mode === "interval")
      return `${nameOf(ivRoot, settings.flats)} root · ${[...ivOn].sort((a, b) => a - b).map((i) => DEG[i]).join(" ")}`;
    const src =
      quiz.source === "scale"
        ? `${nameOf(scaleRoot, settings.flats)} ${scaleDef.name}`
        : quiz.source === "interval"
        ? `${nameOf(ivRoot, settings.flats)} · ${[...ivOn].sort((a, b) => a - b).map((i) => DEG[i]).join(" ")}`
        : `${nameOf(chordRoot, settings.flats)}${chordDef.suffix || ""}`;
    return `Quiz · ${src} · ${quiz.hidden ? quiz.hidden.size - quiz.found.size : 0} to find`;
  }, [mode, scaleRoot, scaleDef, chordRoot, chordDef, ivRoot, ivOn, shownVoicings.length, settings.flats, quiz, progRoot, progDef, bank.length]);

  const total = quiz.correct + quiz.wrong;
  const accuracy = total ? Math.round((quiz.correct / total) * 100) : 0;

  const setTuning = (id) => {
    const t = TUNINGS.find((x) => x.id === id);
    if (!t) return;
    setSettings((s) => ({ ...s, tuningId: id, midis: t.midi }));
  };

  const setStringNote = (idx, midi) => {
    setSettings((s) => {
      const midis2 = s.midis.slice();
      midis2[idx] = midi;
      return { ...s, midis: midis2, tuningId: "custom" };
    });
  };

  const navItem = (id, label, extra) => (
    <button
      className={`dnav ${mode === id ? "on" : ""}`}
      aria-current={mode === id ? "page" : undefined}
      onClick={() => { setMode(id); setOpenPanel(null); }}
    >
      {label}
      {extra}
    </button>
  );

  return (
    <div className={`app ${settings.dark ? "dark" : ""}`}>
      <style>{CSS}</style>

      <aside className={`drawer ${drawer ? "open" : ""}`} aria-label="Main menu">
        <div className="dinner">
          <p className="dhead">Practise</p>
          {navItem("scale", "Scales")}
          {navItem("chord", "Chords")}
          {navItem("prog", "Progressions")}
          {navItem("interval", "Intervals")}
          {navItem("quiz", "Quiz")}
          {navItem("bank", "Bank", bank.length > 0 ? <span className="badge">{bank.length}</span> : null)}

          <p className="dhead">Tools</p>
          <button
            className={`dnav ${openPanel === "metro" ? "on" : ""}`}
            onClick={() => setOpenPanel((v) => (v === "metro" ? null : "metro"))}
          >
            Metronome
            {metroOn && <span className="badge">{settings.bpm}</span>}
          </button>
          <button
            className={`dnav ${openPanel === "setup" ? "on" : ""}`}
            onClick={() => setOpenPanel((v) => (v === "setup" ? null : "setup"))}
          >
            Setup
          </button>

          <p className="dhead">View</p>
          <button
            className={`dnav ${settings.simple ? "on" : ""}`}
            onClick={() => setSettings((s2) => ({ ...s2, simple: !s2.simple }))}
            data-tip="Fewer options, and only the scales and chords a beginner needs"
          >
            Simple view
            <span className="dstate">{settings.simple ? "On" : "Off"}</span>
          </button>
          <button
            className="dnav"
            onClick={() => setSettings((s2) => ({ ...s2, dark: !s2.dark }))}
          >
            Dark mode
            <span className="dstate">{settings.dark ? "On" : "Off"}</span>
          </button>
        </div>
      </aside>
      {drawer && <div className="scrim" onClick={() => setDrawer(false)} />}

      <div className="stage">
      <header className="chassis">
        <button
          className={`burger ${drawer ? "on" : ""}`}
          onClick={() => setDrawer((v) => !v)}
          aria-expanded={drawer}
          aria-label={drawer ? "Close menu" : "Open menu"}
          data-tip={drawer ? "Close menu" : "Menu"}
        >
          <i /><i /><i />
        </button>
        <div className="brand">
          <span className="mark" aria-hidden="true" />
          <h1>Fretwork</h1>
        </div>
        <div className="readout" aria-live="polite">
          <span className="rdot" />
          {readout}
        </div>
      </header>

      {openPanel === "metro" && (
        <section className="setup">
          <div className="metrorow">
            <button
              className={`transport ${metroOn ? "on" : ""}`}
              onClick={() => setMetroOn((v) => !v)}
              aria-pressed={metroOn}
            >
              {metroOn ? "Stop" : "Start"}
            </button>
            <div className="beats" aria-hidden="true">
              {Array.from({ length: settings.beats }, (_, i) => (
                <span
                  key={i}
                  className={`bdot ${beat === i ? "lit" : ""} ${
                    (settings.accent === "down" && i === 0) || (settings.accent === "back" && i % 2 === 1) ? "acc" : ""
                  }`}
                />
              ))}
            </div>
            <div className="bpmbox">
              <button className="mini" onClick={() => setSettings((s2) => ({ ...s2, bpm: Math.max(30, s2.bpm - 5) }))}>{"\u2212"}</button>
              <input
                type="range" min="30" max="240" value={settings.bpm}
                aria-label="Tempo in beats per minute"
                onChange={(e) => setSettings((s2) => ({ ...s2, bpm: +e.target.value }))}
              />
              <button className="mini" onClick={() => setSettings((s2) => ({ ...s2, bpm: Math.min(240, s2.bpm + 5) }))}>+</button>
              <span className="bpmval">{settings.bpm} bpm</span>
            </div>
            <Field label="Time">
              <select
                value={settings.beats}
                aria-label="Time signature"
                onChange={(e) => setSettings((s2) => ({ ...s2, beats: +e.target.value }))}
              >
                {TIME_SIGS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </Field>
            <Field label="Click sound">
              <Seg small
                options={[{ v: "click", l: "Click" }, { v: "beep", l: "Beep" }, { v: "woodblock", l: "Wood" }, { v: "rim", l: "Rim" }]}
                value={settings.clickSound} onChange={(v) => setSettings((s2) => ({ ...s2, clickSound: v }))} />
            </Field>
            <Field label="Accent">
              <Seg small
                options={[{ v: "down", l: "Downbeat" }, { v: "back", l: "Backbeat" }, { v: "none", l: "Even" }]}
                value={settings.accent} onChange={(v) => setSettings((s2) => ({ ...s2, accent: v }))} />
            </Field>
          </div>
        </section>
      )}

      {openPanel === "setup" && (
        <section className="setup">
          <div className="grid">
            <Field label="Frets">
              <input
                type="range" min="7" max="27" value={settings.fretCount}
                onChange={(e) => setSettings((s) => ({ ...s, fretCount: +e.target.value }))}
              />
              <output>{settings.fretCount}</output>
            </Field>
            <Field label="Tuning">
              <select value={settings.tuningId} onChange={(e) => setTuning(e.target.value)}>
                {TUNINGS.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
                {settings.tuningId === "custom" && <option value="custom">Custom</option>}
              </select>
            </Field>
            <Field label="Zoom">
              <input
                type="range" min="0.7" max="2.2" step="0.1" value={settings.zoom}
                onChange={(e) => setSettings((s) => ({ ...s, zoom: +e.target.value }))}
              />
              <output>{settings.zoom.toFixed(1)}×</output>
            </Field>
          </div>

          <div className="tuner">
            <span className="flabel">Strings, low to high</span>
            <div className="strings">
              {midis.map((mv, i) => (
                <div className="stringrow" key={i}>
                  <span className="sidx">{i + 1}</span>
                  <select
                    value={mv % 12}
                    onChange={(e) => setStringNote(i, Math.floor(mv / 12) * 12 + +e.target.value)}
                  >
                    {Array.from({ length: 12 }, (_, pc) => (
                      <option key={pc} value={pc}>{nameOf(pc, settings.flats)}</option>
                    ))}
                  </select>
                  <select
                    value={Math.floor(mv / 12) - 1}
                    onChange={(e) => setStringNote(i, (mv % 12) + (+e.target.value + 1) * 12)}
                  >
                    {[0, 1, 2, 3, 4, 5].map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                  <button className="mini" onClick={() => playNote(mv)}>▸</button>
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

          <div className="toggles">
            <Field label="Note names">
              <Seg small options={[{ v: false, l: "Sharps" }, { v: true, l: "Flats" }]}
                value={settings.flats} onChange={(v) => setSettings((s) => ({ ...s, flats: v }))} />
            </Field>
            <Field label="Dot labels">
              <Seg small options={[{ v: "name", l: "Names" }, { v: "degree", l: "Degrees" }, { v: "none", l: "Blank" }]}
                value={settings.labelMode} onChange={(v) => setSettings((s) => ({ ...s, labelMode: v }))} />
            </Field>
            <Field label="Colour">
              <Seg small options={[{ v: "root", l: "Root" }, { v: "interval", l: "By interval" }, { v: "mono", l: "Mono" }]}
                value={settings.colourMode} onChange={(v) => setSettings((s) => ({ ...s, colourMode: v }))} />
            </Field>
            <Field label="String order">
              <Seg small options={[{ v: true, l: "High on top" }, { v: false, l: "Low on top" }]}
                value={settings.highOnTop} onChange={(v) => setSettings((s) => ({ ...s, highOnTop: v }))} />
            </Field>
            <Field label="Handed">
              <Seg small options={[{ v: false, l: "Right" }, { v: true, l: "Left" }]}
                value={settings.leftHanded} onChange={(v) => setSettings((s) => ({ ...s, leftHanded: v }))} />
            </Field>
            <Field label="Chord stretch">
              <Seg small options={[{ v: 3, l: "3 frets" }, { v: 4, l: "4" }, { v: 5, l: "5" }]}
                value={settings.span} onChange={(v) => setSettings((s2) => ({ ...s2, span: v }))} />
            </Field>
            <Field label="Inversions">
              <Seg small options={[{ v: false, l: "Root bass" }, { v: true, l: "Allow" }]}
                value={settings.inversions} onChange={(v) => setSettings((s2) => ({ ...s2, inversions: v }))} />
            </Field>
            <Field label="Barres">
              <Seg small options={[{ v: true, l: "Allow" }, { v: false, l: "Avoid" }]}
                value={settings.barres} onChange={(v) => setSettings((s2) => ({ ...s2, barres: v }))} />
            </Field>
            <Field label="Theme">
              <Seg small options={[{ v: false, l: "Light" }, { v: true, l: "Dark" }]}
                value={settings.dark} onChange={(v) => setSettings((s2) => ({ ...s2, dark: v }))} />
            </Field>
            <Field label="Options shown">
              <Seg small options={[{ v: true, l: "Simple" }, { v: false, l: "Everything" }]}
                value={settings.simple} onChange={(v) => setSettings((s2) => ({ ...s2, simple: v }))} />
            </Field>
            <Field label="Sound">
              <Seg small options={[{ v: true, l: "On" }, { v: false, l: "Off" }]}
                value={settings.sound} onChange={(v) => setSettings((s) => ({ ...s, sound: v }))} />
            </Field>
          </div>
        </section>
      )}

      <section className="neckwrap">
        <div className="neckscroll">
          <Fretboard
            fretCount={fretCount}
            midis={midis}
            rowToString={rowToString}
            geo={geo}
            marks={marks}
            capo={capo}
            onCapo={setCapo}
            onCell={onCell}
            flats={settings.flats}
            labelMode={mode === "chord" || mode === "prog" ? chordLabel : mode === "scale" ? scaleLabel : settings.labelMode}
            colourMode={mode === "interval" ? "interval" : settings.colourMode}
            barre={(() => {
              const v = mode === "chord" ? activeVoicing : mode === "prog" ? activeProgVoicing : null;
              return v && v.barreFret != null ? { fret: v.barreFret, from: v.barreFrom, to: v.barreTo } : null;
            })()}
            ghosts={ghosts}
            flash={flash}
            quizRange={quiz.range}
            quizActive={mode === "quiz"}
          />
        </div>
        <div className="neckfoot">
          <span className="hint">
            {capo > 0 ? `Capo at fret ${capo}` : "Drag the capo onto the neck"}
          </span>
          {capo > 0 && (
            <button className="mini" onClick={() => setCapo(0)}>Remove capo</button>
          )}
        </div>
      </section>

      <main className="panel">
        {mode === "scale" && (
          <div className="pane">
            <Field label="Key"><KeyPicker value={scaleRoot} onChange={setScaleRoot} flats={settings.flats} /></Field>
            <div className="row">
              <Field label="Scale">
                <select value={scaleId} onChange={(e) => setScaleId(e.target.value)}>
                  {simpleList(SCALES, SIMPLE_SCALES, settings.simple, scaleId).map((x) => (
                    <option key={x.id} value={x.id}>{x.name}</option>
                  ))}
                </select>
              </Field>
              <button className="btn" onClick={playScale} data-tip="Play the scale and light each note as it sounds">
                {playing != null ? "Playing" : "Hear it"}
              </button>
            </div>

            <Field label="Position">
              <div className="posrow">
                <button
                  className={`poschip ${scalePos == null ? "on" : ""}`}
                  onClick={() => setScalePos(null)}
                  data-tip="Every position at once"
                >
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
                {scalePos != null && (
                  <span className="poshint">
                    Frets {positions[scalePos].from} to {positions[scalePos].to}
                  </span>
                )}
              </div>
            </Field>
            <Field label="Neck shows">
              <Seg small
                options={[{ v: "both", l: "Order + note" }, { v: "name", l: "Notes" }, { v: "degree", l: "Order" }, { v: "none", l: "Blank" }]}
                value={scaleLabel} onChange={setScaleLabel} />
            </Field>
            <div className="degrees">
              {scaleDef.iv.map((iv) => (
                <span key={iv} className="chip" style={{ borderColor: FUNC_COLOUR[iv % 12] }}>
                  <b style={{ color: FUNC_COLOUR[iv % 12] }}>{DEG[iv % 12]}</b>
                  {nameOf(scaleRoot + iv, settings.flats)}
                </span>
              ))}
            </div>
          </div>
        )}

        {mode === "chord" && (
          <div className="pane">
            {shownVoicings.length === 0 ? (
              <p className="empty">
                No playable shape for {nameOf(chordRoot, settings.flats)}{chordDef.suffix} in this tuning at this
                stretch. Widen the stretch in Setup, or allow inversions.
              </p>
            ) : (
              <div className="voicings">
                {shownVoicings.map((v, i) => (
                  <ChordDiagram
                    key={v.key}
                    voicing={v}
                    midis={midis}
                    rootPc={chordRoot}
                    capo={capo}
                    flats={settings.flats}
                    showDegrees={settings.labelMode === "degree"}
                    selected={i === Math.min(voiceIdx, shownVoicings.length - 1)}
                    onSelect={() => {
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
                ))}
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
              Numbers on the dots are fingers: 1 index, 2 middle, 3 ring, 4 little. A dark bar means one
              finger lies flat across those strings.
            </p>

            <Field label="Root"><KeyPicker value={chordRoot} onChange={setChordRoot} flats={settings.flats} /></Field>
            <div className="row">
              <Field label="Chord">
                <select value={chordId} onChange={(e) => setChordId(e.target.value)}>
                  {simpleList(CHORDS, SIMPLE_CHORDS, settings.simple, chordId).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <button className="btn" onClick={strumVoicing} disabled={!activeVoicing} data-tip="Hear the selected shape">Strum</button>
              <button
                className="btn ghost"
                disabled={!activeVoicing}
                onClick={() => {
                  if (!activeVoicing) return;
                  saveBank([
                    {
                      id: `b${Date.now()}`,
                      kind: "chord",
                      root: chordRoot,
                      chordId,
                      voicing: activeVoicing,
                      midis,
                      capo,
                      label: `${nameOf(chordRoot, settings.flats)}${chordDef.suffix}`,
                    },
                    ...bank,
                  ]);
                  setToast("Saved to bank");
                }}
              >
                Save
              </button>
            </div>

            {!settings.simple && (
              <div className="optrow">
                <Field label="Neck shows">
                  <Seg small options={[{ v: "finger", l: "Fingers" }, { v: "name", l: "Notes" }, { v: "degree", l: "Degrees" }]}
                    value={chordLabel} onChange={setChordLabel} />
                </Field>
                <Field label="Other tones">
                  <Seg small options={[{ v: true, l: "Ghost" }, { v: false, l: "Hide" }]}
                    value={showAllTones} onChange={setShowAllTones} />
                </Field>
              </div>
            )}
          </div>
        )}

        {mode === "prog" && (
          <div className="pane">
            {progVoicings.some(Boolean) ? (
              <div className="voicings">
                {progChords.map((c, i) =>
                  progVoicings[i] ? (
                    <ChordDiagram
                      key={i}
                      voicing={progVoicings[i]}
                      midis={midis}
                      rootPc={c.rootPc}
                      capo={capo}
                      flats={settings.flats}
                      showDegrees={false}
                      selected={i === progIdx}
                      title={`${nameOf(c.rootPc, settings.flats)}${c.def.suffix}`}
                      caption={c.roman}
                      onSelect={() => {
                        setProgIdx(i);
                        const v = progVoicings[i];
                        if (v && settings.sound) {
                          let j = 0;
                          for (let st = 0; st < n; st++) {
                            const f = v.frets[st];
                            if (f === null) continue;
                            pluck(midis[st] + f, j * 0.03);
                            j++;
                          }
                        }
                      }}
                    />
                  ) : null
                )}
              </div>
            ) : (
              <p className="empty">No playable shapes for this progression in the current tuning.</p>
            )}

            <div className="row wrap">
              <button className="btn" onClick={playProgression}>Preview</button>
              <button className="btn ghost" onClick={stopPlayback}>Stop</button>
              <button
                className="btn ghost"
                onClick={() => {
                  saveBank([
                    { id: `b${Date.now()}`, kind: "prog", root: progRoot, progId, label: `${nameOf(progRoot, settings.flats)} \u00b7 ${progDef.name}` },
                    ...bank,
                  ]);
                  setToast("Saved to bank");
                }}
              >
                Save to bank
              </button>
              <button
                className="btn ghost"
                onClick={() => {
                  const c = progChords[progIdx];
                  if (!c) return;
                  setChordRoot(c.rootPc);
                  setChordId(c.chordId);
                  setMode("chord");
                }}
              >
                Open in chords
              </button>
            </div>

            <Field label="Key"><KeyPicker value={progRoot} onChange={setProgRoot} flats={settings.flats} /></Field>

            <Field label="Progression">
              <select value={progId} onChange={(e) => setProgId(e.target.value)}>
                <optgroup label="Major">
                  {simpleList(PROGRESSIONS, SIMPLE_PROGS, settings.simple, progId).filter((x) => x.tonality === "major").map((x) => (
                    <option key={x.id} value={x.id}>{`${x.name} \u00b7 ${x.note}`}</option>
                  ))}
                </optgroup>
                <optgroup label="Minor">
                  {simpleList(PROGRESSIONS, SIMPLE_PROGS, settings.simple, progId).filter((x) => x.tonality === "minor").map((x) => (
                    <option key={x.id} value={x.id}>{`${x.name} \u00b7 ${x.note}`}</option>
                  ))}
                </optgroup>
              </select>
            </Field>

            <p className="note">Preview follows the metronome tempo, one bar per chord.</p>
          </div>
        )}

        {mode === "bank" && (
          <div className="pane">
            {bank.length === 0 ? (
              <p className="note">
                Nothing saved yet. Save a voicing from Chords, or a progression from Progressions, and it
                will be waiting here for practice.
              </p>
            ) : (
              <div className="banklist">
                {bank.map((item) => (
                  <div className="bankitem" key={item.id}>
                    {item.kind === "chord" && item.voicing ? (
                      <ChordDiagram
                        voicing={item.voicing}
                        midis={item.midis || midis}
                        rootPc={item.root}
                        capo={item.capo || 0}
                        flats={settings.flats}
                        showDegrees={false}
                        selected={false}
                        onSelect={() => {
                          setChordRoot(item.root);
                          setChordId(item.chordId);
                          setMode("chord");
                        }}
                      />
                    ) : null}
                    <div className="bankmeta">
                      <b>{item.label}</b>
                      <div className="row wrap">
                        <button
                          className="mini"
                          onClick={() => {
                            if (item.kind === "prog") {
                              setProgRoot(item.root);
                              setProgId(item.progId);
                              setMode("prog");
                            } else {
                              setChordRoot(item.root);
                              setChordId(item.chordId);
                              setMode("chord");
                            }
                          }}
                        >
                          Load
                        </button>
                        <button className="mini" onClick={() => saveBank(bank.filter((b) => b.id !== item.id))}>
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {mode === "interval" && (
          <div className="pane">
            <Field label="Root"><KeyPicker value={ivRoot} onChange={setIvRoot} flats={settings.flats} /></Field>
            {settings.simple ? (
              <Field label="Show">
                <div className="posrow">
                  {INTERVAL_PRESETS.map((pr) => {
                    const on = pr.iv.length === ivOn.size && pr.iv.every((i) => ivOn.has(i));
                    return (
                      <button
                        key={pr.id}
                        className={`poschip wide ${on ? "on" : ""}`}
                        onClick={() => setIvOn(new Set(pr.iv))}
                      >
                        {pr.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
            ) : (
              <Field label="Intervals from the root">
                <IntervalGrid root={ivRoot} on={ivOn} onToggle={toggleIv} flats={settings.flats} />
              </Field>
            )}

            <div className="degrees">
              {[...ivOn].sort((a, b) => a - b).map((i) => (
                <span key={i} className="chip" style={{ borderLeftColor: FUNC_COLOUR[i] }}>
                  <b style={{ color: FUNC_COLOUR[i] }}>{DEG[i]}</b>
                  {nameOf(ivRoot + i, settings.flats)}
                </span>
              ))}
            </div>
            {!settings.simple && (
            <div className="row wrap">
              <button className="btn ghost" onClick={() => setIvOn(new Set([0]))}>Root only</button>
              <button className="btn ghost" onClick={() => setIvOn(new Set([0, 4, 7]))}>Major triad</button>
              <button className="btn ghost" onClick={() => setIvOn(new Set([0, 3, 7]))}>Minor triad</button>
              <button className="btn ghost" onClick={() => setIvOn(new Set([0, 4, 7, 10]))}>Dominant 7th</button>
              <button className="btn ghost" onClick={() => setIvOn(new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]))}>All twelve</button>
            </div>
            )}
            <p className="note" hidden={settings.simple}>Filled dots are natural degrees. Rings are flattened ones. Colour groups intervals by function: seconds, thirds, fourths, fifths, sixths, sevenths.</p>
          </div>
        )}

        {mode === "quiz" && (
          <div className="pane">
            <div className="scoreboard">
              <div className="score"><b>{quiz.correct}</b><span>correct</span></div>
              <div className="score"><b className="bad">{quiz.wrong}</b><span>wrong</span></div>
              <div className="score"><b>{accuracy}%</b><span>accuracy</span></div>
              <div className="score"><b>{quiz.streak}</b><span>streak</span></div>
              <div className="score"><b>{quiz.best}</b><span>best run</span></div>
              <div className="score"><b>{quiz.rounds}</b><span>rounds</span></div>
            </div>

            <div className="row wrap">
              <Field label="Test me on">
                <Seg small
                  options={[{ v: "scale", l: "A scale" }, { v: "chord", l: "A chord" }, { v: "interval", l: "Intervals" }]}
                  value={quiz.source} onChange={(v) => setQuiz((q) => ({ ...q, source: v }))} />
              </Field>
              {quiz.source === "scale" && (
                <Field label="Scale">
                  <select value={scaleId} onChange={(e) => setScaleId(e.target.value)}>
                    {simpleList(SCALES, SIMPLE_SCALES, settings.simple, scaleId).map((x) => (
                      <option key={x.id} value={x.id}>{x.name}</option>
                    ))}
                  </select>
                </Field>
              )}
              {quiz.source === "chord" && (
                <Field label="Chord">
                  <select value={chordId} onChange={(e) => setChordId(e.target.value)}>
                    {simpleList(CHORDS, SIMPLE_CHORDS, settings.simple, chordId).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </Field>
              )}
            </div>

            <Field label={quiz.source === "scale" ? "Key" : "Root"}>
              <KeyPicker
                value={quiz.source === "scale" ? scaleRoot : quiz.source === "interval" ? ivRoot : chordRoot}
                onChange={quiz.source === "scale" ? setScaleRoot : quiz.source === "interval" ? setIvRoot : setChordRoot}
                flats={settings.flats}
              />
            </Field>

            {quiz.source === "interval" && (
              <Field label="Intervals to find">
                <IntervalGrid root={ivRoot} on={ivOn} onToggle={toggleIv} flats={settings.flats} />
              </Field>
            )}

            <div className="row">
              <Field label={`Difficulty · ${quiz.hidden ? quiz.hidden.size : 0} of ${quiz.target ? quiz.target.length : 0} hidden`}>
                <input
                  type="range" min="0" max="1" step="0.01" value={quiz.difficulty}
                  onChange={(e) => setQuiz((q) => ({ ...q, difficulty: +e.target.value }))}
                />
                <output>{quiz.difficulty < 0.2 ? "Easy" : quiz.difficulty < 0.5 ? "Steady" : quiz.difficulty < 0.85 ? "Hard" : "Blank neck"}</output>
              </Field>
            </div>

            <div className="row">
              <Field label={`Frets ${quiz.range[0]} to ${quiz.range[1]}`}>
                <div className="rangepair">
                  <input
                    type="range" min="0" max={fretCount} value={quiz.range[0]}
                    onChange={(e) => setQuiz((q) => ({ ...q, range: [Math.min(+e.target.value, q.range[1] - 1), q.range[1]] }))}
                  />
                  <input
                    type="range" min="0" max={fretCount} value={quiz.range[1]}
                    onChange={(e) => setQuiz((q) => ({ ...q, range: [q.range[0], Math.max(+e.target.value, q.range[0] + 1)] }))}
                  />
                </div>
              </Field>
              <button className="btn" onClick={newRound}>New round</button>
            </div>

            {quiz.source === "interval" && ivOn.size === 0 ? (
              <p className="empty">Pick at least one interval to be tested on.</p>
            ) : quiz.done ? (
              <p className="done">Round complete. {quiz.hidden ? quiz.hidden.size : 0} found, streak of {quiz.streak}.</p>
            ) : (
              <p className="note">Tap every hidden position on the neck. Wrong taps count against you.</p>
            )}
            <button
              className="btn ghost"
              onClick={() => {
                const cleared = { ...quiz, correct: 0, wrong: 0, streak: 0, best: 0, rounds: 0 };
                setQuiz(cleared);
                saveStats(cleared);
              }}
            >
              Reset score
            </button>
          </div>
        )}
      </main>
      </div>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

/* ============================================================
   STYLES
   ============================================================ */

const CSS = `
.app{
  --paper:#F2F5F6; --card:#FFFFFF; --line:#DEE4E6; --line2:#C8D1D4;
  --ink:#18232A; --muted:#6D7C82; --gold:#E9A824; --teal:#12A19A; --red:#D2544F;
  --board:#FBFAF8; --inlay:#E4E9EA; --fret:#C8D1D4; --string:#B7C1C5;
  --lane:#EAEEEF; --barre:#5C6C73; --dotplain:#2E3A3F; --onink:#FFFFFF; --goldtext:#B07C12;
  background:var(--paper); min-height:100vh; color:var(--ink);
  font-family:"IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, sans-serif;
  margin:0; display:flex; align-items:stretch;
}
.stage{flex:1; min-width:0; padding-bottom:48px}
.stage > .panel, .stage > .setup > .inner{max-width:1240px}

/* drawer pushes the stage across rather than covering it */
.drawer{
  flex:0 0 0; width:0; overflow:hidden; background:var(--card);
  border-right:1px solid var(--line); transition:flex-basis .18s ease, width .18s ease;
}
.drawer.open{flex:0 0 244px; width:244px}
.dinner{width:244px; padding:16px 12px; position:sticky; top:0}
.dhead{
  margin:14px 6px 6px; font-family:"Antonio",sans-serif; font-size:11px;
  letter-spacing:.17em; text-transform:uppercase; color:var(--muted);
}
.dhead:first-child{margin-top:0}
.dnav{
  display:flex; align-items:center; gap:8px; width:100%; text-align:left;
  background:transparent; border:0; border-radius:5px; cursor:pointer;
  padding:10px 10px; color:var(--ink); font-family:inherit; font-size:14px;
}
.dnav:hover{background:var(--paper)}
.dnav.on{background:var(--ink); color:var(--onink)}
.dnav .badge{margin-left:auto}
.dstate{margin-left:auto; font-family:"IBM Plex Mono",monospace; font-size:11px; color:var(--muted)}
.dnav.on .dstate{color:var(--onink); opacity:.75}
.scrim{display:none}

.burger{
  display:flex; flex-direction:column; justify-content:center; gap:4px;
  width:38px; height:38px; padding:0 9px; cursor:pointer;
  background:var(--card); border:1px solid var(--line2); border-radius:5px; flex:none;
}
.burger i{display:block; height:2px; background:var(--ink); border-radius:1px; transition:transform .18s ease, opacity .12s ease}
.burger.on{background:var(--ink); border-color:var(--ink)}
.burger.on i{background:var(--onink)}
.burger.on i:nth-child(1){transform:translateY(6px) rotate(45deg)}
.burger.on i:nth-child(2){opacity:0}
.burger.on i:nth-child(3){transform:translateY(-6px) rotate(-45deg)}
.app.dark{
  --paper:#0E1418; --card:#171F25; --line:#2A353C; --line2:#3C4952; --ink:#E7EEF0; --muted:#8FA0A8;
  --red:#E0605B;
  --board:#1A2429; --inlay:#2C383F; --fret:#3E4C54; --string:#5F717A;
  --lane:#202B31; --barre:#596A74; --dotplain:#C7D3D8; --onink:#111A1E; --goldtext:#E9A824;
}
.app *{box-sizing:border-box}
.app h1{margin:0}
.fretnum,.dotlabel{font-family:"IBM Plex Mono", ui-monospace, monospace; font-weight:600}

.chassis{
  display:flex; align-items:center; gap:14px; flex-wrap:wrap;
  padding:12px 18px; border-bottom:1px solid var(--line); background:var(--card);
  position:sticky; top:0; z-index:20;
}
.brand{display:flex; align-items:center; gap:9px}
.brand .mark{width:6px; height:24px; border-radius:3px; background:var(--ink)}
.brand h1{
  font-family:"Antonio","IBM Plex Sans",sans-serif; font-weight:600;
  font-size:25px; letter-spacing:.13em; text-transform:uppercase; line-height:1;
}
.readout{
  flex:1; min-width:190px; display:flex; align-items:center; gap:9px;
  font-family:"IBM Plex Mono",monospace; font-size:12px; letter-spacing:.04em;
  color:#3C4C53; text-transform:uppercase;
  background:var(--paper); border:1px solid var(--line); border-radius:20px;
  padding:8px 14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.rdot{width:7px;height:7px;border-radius:50%;background:var(--gold);flex:none}
.gear{
  font-family:"Antonio",sans-serif; letter-spacing:.13em; text-transform:uppercase;
  font-size:13px; padding:9px 15px; border-radius:4px; cursor:pointer;
  background:var(--card); color:var(--ink); border:1px solid var(--line2);
}
.gear:hover{background:var(--paper)}

.setup{border-bottom:1px solid var(--line); background:var(--card); padding:16px 18px; display:grid; gap:18px}
.setup .grid,.toggles{display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:14px}
.field{display:flex; flex-direction:column; gap:6px; min-width:0}
.flabel{font-family:"Antonio",sans-serif; font-size:12px; letter-spacing:.15em; text-transform:uppercase; color:var(--muted)}
.field output{font-family:"IBM Plex Mono",monospace; font-size:12px; color:#B07C12}

.tuner{display:grid; gap:8px}
.strings{display:flex; flex-wrap:wrap; gap:8px}
.stringrow{display:flex; align-items:center; gap:4px; background:var(--paper); border:1px solid var(--line); border-radius:4px; padding:4px 6px}
.sidx{font-family:"IBM Plex Mono",monospace; font-size:11px; color:var(--muted); width:12px}
.stringbtns{display:flex; gap:8px; flex-wrap:wrap}

.app select{
  background:var(--card); color:var(--ink); border:1px solid var(--line2);
  border-radius:4px; padding:8px 10px; font-size:14px; font-family:inherit; max-width:100%;
}
.app input[type=range]{width:100%; max-width:340px; accent-color:var(--ink)}
.bpmbox input[type=range]{max-width:240px}
.rangepair{display:grid; gap:4px}

.mini{background:var(--card); color:var(--ink); border:1px solid var(--line2); border-radius:4px; padding:5px 9px; font-size:12px; cursor:pointer; font-family:inherit}
.mini:hover{background:var(--paper)}
.mini:disabled{opacity:.4; cursor:not-allowed}
.mini.wide{padding:7px 12px}

/* separators are 1px gaps over a tinted backing, so a wrapped row never
   leaves a dangling border at the end of a line */
.seg{
  display:inline-flex; align-self:flex-start; width:fit-content; flex-wrap:wrap; gap:1px;
  background:var(--line2); border:1px solid var(--line2);
  border-radius:4px; overflow:hidden;
}
.seg button{
  background:var(--card); color:var(--muted); border:0; cursor:pointer;
  font-family:"Antonio",sans-serif; letter-spacing:.11em; text-transform:uppercase;
  font-size:14px; padding:10px 16px; line-height:1.15;
}
.seg button.on{background:var(--ink); color:var(--onink)}
.seg button:hover:not(.on){background:var(--paper); color:var(--ink)}
.seg.sm button{font-size:12px; padding:8px 10px}

.optrow{display:grid; grid-template-columns:repeat(auto-fit,minmax(168px,1fr)); gap:12px; align-items:start}
.optrow .seg,.optrow .segsel{width:100%; align-self:stretch}
.optrow .seg button{flex:1 1 auto}

.neckwrap{padding:16px 0 4px}
.neckscroll{overflow-x:auto; overflow-y:hidden; padding:0 18px 4px; -webkit-overflow-scrolling:touch}
.fretboard{display:block; touch-action:pan-x; background:transparent}
.neckfoot{display:flex; align-items:center; gap:12px; padding:2px 18px 0}
.hint{font-family:"IBM Plex Mono",monospace; font-size:11px; color:var(--muted); letter-spacing:.03em}
.capo{cursor:grab; touch-action:none}
.capo.drag{cursor:grabbing}
.lane{cursor:pointer; touch-action:none}
.capo:focus-visible{outline:2px solid var(--ink); outline-offset:3px}

.metrorow{display:flex; align-items:center; gap:14px; flex-wrap:wrap}
.metrorow .field{flex:0 0 auto}
.transport{
  background:var(--card); color:var(--ink); border:1px solid var(--line2); border-radius:4px;
  padding:8px 14px; cursor:pointer; min-width:112px;
  font-family:"Antonio",sans-serif; letter-spacing:.11em; text-transform:uppercase; font-size:13px;
}
.transport.on{background:var(--ink); color:var(--onink); border-color:var(--ink)}
.beats{display:flex; gap:5px; align-items:center}
.bdot{width:9px; height:9px; border-radius:50%; background:var(--line2); transition:background .06s linear, transform .06s linear}
.bdot.acc{width:11px; height:11px}
.bdot.lit{background:var(--gold); transform:scale(1.25)}
.bdot.acc.lit{background:var(--ink)}
.bpmbox{display:flex; align-items:center; gap:7px; flex:1; min-width:190px}
.bpmbox input[type=range]{flex:1; min-width:80px}
.bpmval{font-family:"IBM Plex Mono",monospace; font-size:12px; color:var(--muted); white-space:nowrap; min-width:62px}

.headtools{display:flex; gap:8px; align-items:center; flex-wrap:wrap}
.gear.on{background:var(--ink); color:var(--onink); border-color:var(--ink)}
.badge{
  display:inline-flex; align-items:center; justify-content:center;
  min-width:18px; height:18px; padding:0 5px; margin-left:7px; border-radius:9px;
  background:var(--line2); color:var(--ink);
  font-family:"IBM Plex Mono",monospace; font-size:11px; letter-spacing:0;
}
.gear.on .badge,.dnav.on .badge{background:rgba(128,140,148,.34); color:var(--onink)}
.gear.ticking{border-color:var(--gold)}
.tabsolo{
  background:var(--card); color:var(--muted); border:1px solid var(--line2); border-radius:4px;
  padding:10px 16px; cursor:pointer; line-height:1.15;
  font-family:"Antonio",sans-serif; letter-spacing:.11em; text-transform:uppercase; font-size:14px;
}
.tabsolo:hover{background:var(--paper); color:var(--ink)}
.tabsolo.on{background:var(--ink); color:var(--onink); border-color:var(--ink)}

.vtitle{
  display:flex; align-items:baseline; gap:6px; justify-content:center;
  font-family:"IBM Plex Mono",monospace; font-size:14px; font-weight:600; color:var(--ink);
  padding-bottom:2px;
}
.vtitle em{font-style:normal; font-size:10px; color:var(--muted); letter-spacing:.05em}
.voicing.sel .vtitle{color:var(--ink)}

.toast{
  position:fixed; left:50%; bottom:26px; transform:translateX(-50%);
  background:var(--ink); color:var(--onink); border-radius:20px; padding:9px 18px;
  font-family:"Antonio",sans-serif; letter-spacing:.11em; text-transform:uppercase; font-size:13px;
  box-shadow:0 6px 20px rgba(0,0,0,.22); z-index:60; animation:risein .18s ease both;
}
@keyframes risein{from{opacity:0; transform:translate(-50%,8px)}to{opacity:1; transform:translate(-50%,0)}}

.posrow{display:flex; gap:5px; flex-wrap:wrap; align-items:center}
.poschip{
  min-width:36px; padding:8px 10px; cursor:pointer; color:var(--muted);
  background:var(--card); border:1px solid var(--line2); border-radius:4px;
  font-family:"IBM Plex Mono",monospace; font-size:13px; font-weight:600;
}
.poschip.wide{font-family:inherit; font-weight:500; font-size:13px}
.poschip:hover{background:var(--paper); color:var(--ink)}
.poschip.on{background:var(--ink); color:var(--onink); border-color:var(--ink)}
.poshint{font-family:"IBM Plex Mono",monospace; font-size:11px; color:var(--muted); margin-left:4px}

[data-tip]{position:relative}
[data-tip]:hover::after{
  content:attr(data-tip); position:absolute; left:50%; top:calc(100% + 7px);
  transform:translateX(-50%); z-index:90; width:max-content; max-width:230px;
  background:var(--ink); color:var(--onink); border-radius:5px; padding:6px 9px;
  font-family:"IBM Plex Sans",sans-serif; font-size:12px; font-weight:400;
  letter-spacing:0; text-transform:none; line-height:1.35; pointer-events:none;
  box-shadow:0 6px 18px rgba(0,0,0,.2);
}
@media (hover:none){[data-tip]:hover::after{display:none}}

.chordline{display:flex; gap:7px; flex-wrap:wrap}
.prochord{
  background:var(--card); border:1px solid var(--line2); border-radius:5px;
  padding:8px 12px; cursor:pointer; display:grid; gap:1px; justify-items:center; min-width:62px;
}
.prochord b{font-family:"IBM Plex Mono",monospace; font-size:14px; color:var(--ink)}
.prochord em{font-style:normal; font-size:10px; color:var(--muted); letter-spacing:.04em}
.prochord:hover{background:var(--paper)}
.prochord.on{background:var(--ink); border-color:var(--ink)}
.prochord.on b{color:var(--onink)}
.prochord.on em{color:var(--onink); opacity:.7}

.banklist{display:grid; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); gap:10px}
.bankitem{
  display:flex; gap:10px; align-items:center;
  border:1px solid var(--line); border-radius:5px; padding:8px; background:var(--card);
}
.bankmeta{display:grid; gap:6px; min-width:0}
.bankmeta b{font-family:"IBM Plex Mono",monospace; font-size:13px; word-break:break-word}

.modes{display:flex; align-items:center; gap:8px; flex-wrap:wrap}
.chassis .modes .seg{border-radius:4px}
.segsel{
  background:var(--card); color:var(--ink); border:1px solid var(--line2);
  border-radius:4px; padding:9px 10px; font-size:14px; font-family:inherit; width:100%;
}
.panel{margin:12px 18px 0; background:var(--card); border:1px solid var(--line); border-radius:6px; padding:18px}
.setup .grid,.toggles{max-width:1240px}
.pane{display:grid; gap:16px}
.row{display:flex; gap:14px; align-items:flex-start; flex-wrap:nowrap}
.row > .btn{align-self:flex-end}
.row.wrap{flex-wrap:wrap}
.row > .field{flex:1; min-width:0}

.picker{position:relative; align-self:flex-start}
.pickbtn{
  display:inline-flex; align-items:center; gap:10px; min-width:82px; justify-content:space-between;
  background:var(--card); border:1px solid var(--line2); border-radius:4px;
  padding:9px 12px; cursor:pointer; color:var(--ink);
  font-family:"IBM Plex Mono",monospace; font-size:15px; font-weight:600;
}
.pickbtn:hover,.pickbtn.open{border-color:var(--ink)}
.caret{width:0; height:0; border-left:4px solid transparent; border-right:4px solid transparent; border-top:5px solid var(--muted)}
.pickmenu{
  position:absolute; top:calc(100% + 5px); left:0; z-index:50;
  display:grid; grid-template-columns:repeat(4,58px); gap:3px; padding:6px;
  background:var(--card); border:1px solid var(--line2); border-radius:6px;
  box-shadow:0 10px 28px rgba(0,0,0,.18);
}
.key{
  background:var(--card); border:1px solid var(--line2); color:var(--muted);
  border-radius:3px; padding:9px 0; cursor:pointer;
  font-family:"IBM Plex Mono",monospace; font-size:12px; font-weight:600;
}
.key{padding:9px 0}
.key:hover{background:var(--paper); color:var(--ink)}
.key.on{background:var(--ink); color:var(--onink); border-color:var(--ink)}

.btn{
  background:var(--card); color:var(--ink); border:1px solid var(--line2);
  border-radius:4px; padding:10px 16px; cursor:pointer; white-space:nowrap;
  font-family:"Antonio",sans-serif; letter-spacing:.11em; text-transform:uppercase; font-size:14px;
}
.btn:hover{background:var(--paper)}
.btn:disabled{opacity:.4; cursor:not-allowed}
.btn.ghost{background:transparent}

.degrees{display:flex; gap:6px; flex-wrap:wrap}
.chip{
  display:inline-flex; gap:6px; align-items:baseline; padding:5px 9px;
  border:1px solid var(--line); border-left-width:3px; border-radius:3px;
  font-family:"IBM Plex Mono",monospace; font-size:12px; color:var(--ink); background:var(--card);
}
.chip b{font-size:11px}

.voicings{display:flex; gap:10px; overflow-x:auto; padding:4px 2px 8px}
.voicing{flex:none; background:var(--card); border:1px solid var(--line); border-radius:5px; padding:8px 6px 6px; cursor:pointer; display:grid; gap:2px; justify-items:center}
.voicing:hover{border-color:var(--line2)}
.voicing.sel{border-color:var(--ink); box-shadow:0 0 0 1px var(--ink)}
.vmeta{font-family:"IBM Plex Mono",monospace; font-size:9.5px; color:var(--muted)}

.ivgrid{display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:6px}
.iv{background:var(--card); border:1px solid var(--line2); border-radius:4px; padding:8px 4px; cursor:pointer; color:var(--muted); display:grid; gap:2px}
.iv b{font-family:"IBM Plex Mono",monospace; font-size:13px}
.iv em{font-style:normal; font-size:10px; opacity:.8}
.iv.on.low{border-width:2px}
.iv:hover{background:var(--paper)}

.scoreboard{display:grid; grid-template-columns:repeat(auto-fit,minmax(78px,1fr)); gap:8px}
.score{background:var(--paper); border:1px solid var(--line); border-radius:4px; padding:9px 6px; text-align:center}
.score b{display:block; font-family:"IBM Plex Mono",monospace; font-size:20px; color:var(--ink)}
.score b.bad{color:var(--red)}
.score span{font-family:"Antonio",sans-serif; font-size:10px; letter-spacing:.11em; text-transform:uppercase; color:var(--muted)}

.note,.empty,.done{font-size:13px; color:var(--muted); line-height:1.5; margin:0}
.app [hidden]{display:none !important}
.done{color:#0E8A84}
.empty{color:#A8433F}

@keyframes ping{0%{r:7;opacity:1}100%{r:20;opacity:0}}
.ping{animation:ping .48s ease-out forwards}
@keyframes pop{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
.pop{animation:pop .28s cubic-bezier(.2,1.2,.3,1) both; transform-origin:center}
.dot{animation:fadein .22s ease}
@keyframes fadein{from{opacity:0}to{opacity:1}}

.app button:focus-visible, .app select:focus-visible, .app input:focus-visible{outline:2px solid var(--ink); outline-offset:2px}

@media (max-width:700px){
  .chassis{gap:10px 12px}
  .chassis .modes{order:3; flex-basis:100%; margin-top:2px}
  .chassis .gear{order:2}
  .chassis .modes .seg{width:100%}
  .drawer{position:fixed; left:0; top:0; height:100dvh; z-index:80; width:244px; flex:0 0 0;
    transform:translateX(-100%); transition:transform .18s ease; overflow-y:auto}
  .drawer.open{transform:translateX(0); flex:0 0 0; width:244px}
  .scrim{display:block; position:fixed; inset:0; z-index:70; background:rgba(8,14,18,.42)}
  .chassis .modes{gap:6px}
  .chassis .modes .seg{flex:1 1 auto}
  .chassis .modes .seg button{flex:1 1 auto; padding:9px 8px; font-size:12px}
  .chassis .tabsolo{padding:9px 12px; font-size:12px}
  .headtools{order:2; gap:6px}
  .headtools .gear{padding:9px 11px; font-size:12px}
  .row{flex-wrap:wrap}
  .row > .field{flex:1 1 140px}
}
@media (max-width:640px){
  .brand h1{font-size:19px}
  .panel{margin:10px 10px 0; padding:12px}
  .neckscroll{padding:0 10px 4px}
  .neckfoot,.modes,.chassis,.setup{padding-left:10px; padding-right:10px}
  .keys{grid-template-columns:repeat(6,minmax(0,1fr))}
  .ivgrid{grid-template-columns:repeat(4,minmax(0,1fr))}
  .row{flex-wrap:wrap}
}
@media (prefers-reduced-motion:reduce){.ping,.pop,.dot,.toast{animation:none}}
`;
