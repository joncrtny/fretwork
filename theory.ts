/* ==========================================================
   THEORY DATA
   Notes, scales, chords, tunings, progressions, ear-training and
   picker sets, plus the tab parser and small music helpers.
   Pure data and pure functions: no React, no shared state.
   ========================================================== */

/* The domain model. Ids are the stable keys stored in the Bank, share links and
   the practice log; `iv` is a set of semitone offsets from the root. */
export interface Scale {
  id: string;
  name: string;
  iv: number[];
}
export interface Chord {
  id: string;
  name: string;
  suffix: string;
  iv: number[];
}
export interface Tuning {
  id: string;
  name: string;
  midi: number[]; // open-string MIDI notes, low to high
}
export interface Progression {
  id: string;
  name: string;
  note: string;
  tonality: "major" | "minor";
  bars: string[]; // roman-numeral keys into ROMAN
  sections?: Record<string, string>; // custom progressions carry section markers
}
export interface EarInterval {
  v: number; // semitones
  l: string;
}
export interface EarChord {
  v: string; // chord id
  l: string;
}
export interface StrumPattern {
  id: string;
  name: string;
  simple?: boolean; // present on the beginner set; absent = advanced, hidden in Simple mode
  slots: (string | null)[]; // one per eighth: d/u lowercase, D/U accented, null = no strum
}
export interface IntervalPreset {
  id: string;
  label: string;
  iv: number[];
}
export interface LabelledValue<T> {
  v: T;
  l: string;
}
export interface MelodyNote {
  s: number; // string index
  f: number; // fret
}

export const SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const FLAT = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
export const DEG = ["R", "♭2", "2", "♭3", "3", "4", "♭5", "5", "♭6", "6", "♭7", "7"];

export const nameOf = (pc: number, flats: boolean): string => (flats ? FLAT : SHARP)[((pc % 12) + 12) % 12];

/* Key-aware accidental spelling. Proper diatonic spelling uses each letter
   once, so pick the accidental direction that covers more distinct letters
   over the actual notes (A Phrygian: flats give A Bb C D E F G, seven
   letters; sharps repeat A). Ties fall back to the key-signature rule:
   minor-ish keys borrow their relative major, and the flat-side majors
   (F, Bb, Eb, Ab, Db) spell flat. So C minor reads Eb, not D#. */
export const FLAT_MAJORS = new Set([5, 10, 3, 8, 1]);
export function keyPrefersFlats(rootPc: number, intervals?: Iterable<number> | null): boolean {
  const iv = intervals ? [...intervals] : [];
  const pcs = iv.map((i) => (((rootPc + i) % 12) + 12) % 12);
  const letters = (names: string[]) => new Set(pcs.map((pc) => names[pc][0])).size;
  const sharpLetters = letters(SHARP);
  const flatLetters = letters(FLAT);
  if (flatLetters !== sharpLetters) return flatLetters > sharpLetters;
  const minorish = iv.includes(3) && !iv.includes(4);
  const majorPc = minorish ? (rootPc + 3) % 12 : rootPc;
  return FLAT_MAJORS.has(((majorPc % 12) + 12) % 12);
}

export const SCALES: Scale[] = [
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

export const CHORDS: Chord[] = [
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
const m = (pc: number, oct: number): number => pc + (oct + 1) * 12;

export const TUNINGS: Tuning[] = [
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
/* which views count as practice time, and how the log names them */
export const PRACTICE_MODES: Record<string, string> = {
  scale: "Scales",
  chord: "Chords",
  arp: "Arpeggios",
  prog: "Progressions",
  interval: "Intervals",
  quiz: "Fretboard Quiz",
  changes: "Chord changes",
  strum: "Strumming",
  melody: "Melodies",
  ear: "Ear training",
};
export const localDay = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* rough easy-to-hard order, used to pick the one "stretch" item in a practice
   routine: the first thing you have not marked as known yet */
export const SCALE_ORDER: string[] = [
  "major",
  "minor",
  "majpent",
  "minpent",
  "blues",
  "majblues",
  "dorian",
  "mixo",
  "harmmin",
  "melmin",
  "phrygian",
  "lydian",
  "locrian",
  "phrydom",
  "lydb7",
  "altered",
  "wholetone",
  "dimhw",
  "dimwh",
  "chromatic",
];
export const CHORD_ORDER: string[] = [
  "maj",
  "min",
  "5",
  "sus2",
  "sus4",
  "7",
  "m7",
  "maj7",
  "6",
  "m6",
  "dim",
  "aug",
  "add9",
  "9",
  "m9",
  "maj9",
  "m7b5",
  "dim7",
  "7sus4",
  "mmaj7",
  "11",
  "13",
  "7b9",
  "7s9",
  "7s5",
  "7b5",
];

/* parse pasted ASCII guitar tab into melody steps [{s, f}]. Handles the common
   six-line format, top line high e, ordered left to right; a column with several
   notes is read low string to high. Returns [] if nothing usable is found. */
export function parseTab(text: string, stringCount: number): MelodyNote[] {
  const isTabLine = (l: string) => {
    const body = l.replace(/^\s*[eEbBgGdDaA][b#]?\s*\|?/, "");
    const dashes = (body.match(/-/g) || []).length;
    return dashes >= 4 && /^[-\d|hHpPbBxXsStTrR~/\\()\s.*]+$/.test(body) && /\d|-/.test(body);
  };
  const lines = text.replace(/\r/g, "").split("\n");
  const steps = [];
  let i = 0;
  while (i < lines.length && steps.length < 128) {
    if (!isTabLine(lines[i])) {
      i++;
      continue;
    }
    /* gather a block of consecutive tab lines */
    const block = [];
    while (i < lines.length && isTabLine(lines[i]) && block.length < 6) {
      block.push(lines[i]);
      i++;
    }
    if (block.length < 1) continue;
    /* strip a leading label and the first bar line so columns align */
    const rows = block.map((l) => l.replace(/^\s*[eEbBgGdDaA][b#]?\s*\|/, "").replace(/^\s*[eEbBgGdDaA][b#]?\s+/, ""));
    const width = Math.max(...rows.map((r) => r.length));
    const colNotes = [];
    for (let c = 0; c < width; c++) {
      const notes = [];
      for (let r = 0; r < rows.length; r++) {
        const ch = rows[r][c];
        if (ch && /\d/.test(ch)) {
          /* only start of a number run */
          if (c > 0 && /\d/.test(rows[r][c - 1] || "")) continue;
          let num = ch;
          if (/\d/.test(rows[r][c + 1] || "")) num += rows[r][c + 1];
          const fret = parseInt(num, 10);
          /* the top row is the highest string; blocks are top-aligned */
          const sIdx = stringCount - 1 - r;
          if (sIdx >= 0 && sIdx < stringCount && fret >= 0 && fret <= 27) notes.push({ s: sIdx, f: fret, order: r });
        }
      }
      if (notes.length) colNotes.push(notes.sort((a, b) => a.s - b.s));
    }
    for (const col of colNotes)
      for (const nt of col) {
        if (steps.length < 128) steps.push({ s: nt.s, f: nt.f });
      }
  }
  return steps;
}

/* ear training pools */
export const EAR_INTERVALS: EarInterval[] = [
  { v: 1, l: "Minor 2nd" },
  { v: 2, l: "Major 2nd" },
  { v: 3, l: "Minor 3rd" },
  { v: 4, l: "Major 3rd" },
  { v: 5, l: "Perfect 4th" },
  { v: 6, l: "Tritone" },
  { v: 7, l: "Perfect 5th" },
  { v: 8, l: "Minor 6th" },
  { v: 9, l: "Major 6th" },
  { v: 10, l: "Minor 7th" },
  { v: 11, l: "Major 7th" },
  { v: 12, l: "Octave" },
];
export const EAR_INTERVALS_SIMPLE = new Set([2, 4, 5, 7, 12]);
export const EAR_CHORDS: EarChord[] = [
  { v: "maj", l: "Major" },
  { v: "min", l: "Minor" },
  { v: "dim", l: "Diminished" },
  { v: "aug", l: "Augmented" },
  { v: "7", l: "Dominant 7th" },
  { v: "maj7", l: "Major 7th" },
  { v: "m7", l: "Minor 7th" },
];
export const EAR_CHORDS_SIMPLE = new Set(["maj", "min"]);

export const MINOR_STARTS = new Set(["i", "iv", "v", "i7", "iv7", "v7", "ii\u00b0", "ii\u00f8"]);
export const ROMAN: Record<string, [number, string]> = {
  I: [0, "maj"],
  ii: [2, "min"],
  iii: [4, "min"],
  IV: [5, "maj"],
  V: [7, "maj"],
  vi: [9, "min"],
  "vii°": [11, "dim"],
  i: [0, "min"],
  "ii°": [2, "dim"],
  III: [3, "maj"],
  iv: [5, "min"],
  v: [7, "min"],
  VI: [8, "maj"],
  VII: [10, "maj"],
  bIII: [3, "maj"],
  bVI: [8, "maj"],
  bVII: [10, "maj"],
  I7: [0, "7"],
  IV7: [5, "7"],
  V7: [7, "7"],
  Imaj7: [0, "maj7"],
  IVmaj7: [5, "maj7"],
  ii7: [2, "m7"],
  iii7: [4, "m7"],
  vi7: [9, "m7"],
  i7: [0, "m7"],
  iv7: [5, "m7"],
  v7: [7, "m7"],
  iiø: [2, "m7b5"],
};

export const PROGRESSIONS: Progression[] = [
  { id: "p1564", name: "I – V – vi – IV", note: "The four chords", tonality: "major", bars: ["I", "V", "vi", "IV"] },
  { id: "p145", name: "I – IV – V", note: "Three chord trick", tonality: "major", bars: ["I", "IV", "V"] },
  { id: "p1645", name: "I – vi – IV – V", note: "Fifties doo-wop", tonality: "major", bars: ["I", "vi", "IV", "V"] },
  { id: "p6415", name: "vi – IV – I – V", note: "Pop minor start", tonality: "major", bars: ["vi", "IV", "I", "V"] },
  { id: "p1625", name: "I – vi – ii – V", note: "Rhythm changes turnaround", tonality: "major", bars: ["I", "vi", "ii", "V"] },
  { id: "p251", name: "ii7 – V7 – Imaj7", note: "Jazz two five one", tonality: "major", bars: ["ii7", "V7", "Imaj7"] },
  { id: "p1345", name: "I – iii – IV – V", note: "Rising", tonality: "major", bars: ["I", "iii", "IV", "V"] },
  { id: "pmixo", name: "I – bVII – IV", note: "Mixolydian rock", tonality: "major", bars: ["I", "bVII", "IV"] },
  { id: "pcanon", name: "Pachelbel", note: "Canon in D", tonality: "major", bars: ["I", "V", "vi", "iii", "IV", "I", "IV", "V"] },
  {
    id: "pblues",
    name: "12-bar blues",
    note: "Standard",
    tonality: "major",
    bars: ["I7", "I7", "I7", "I7", "IV7", "IV7", "I7", "I7", "V7", "IV7", "I7", "V7"],
  },
  {
    id: "pbluesq",
    name: "12-bar, quick change",
    note: "IV in bar two",
    tonality: "major",
    bars: ["I7", "IV7", "I7", "I7", "IV7", "IV7", "I7", "I7", "V7", "IV7", "I7", "V7"],
  },
  { id: "pm1637", name: "i – VI – III – VII", note: "Natural minor loop", tonality: "minor", bars: ["i", "VI", "III", "VII"] },
  { id: "pm145", name: "i – iv – v", note: "Minor three chord", tonality: "minor", bars: ["i", "iv", "v"] },
  { id: "pandal", name: "i – VII – VI – V", note: "Andalusian cadence", tonality: "minor", bars: ["i", "VII", "VI", "V"] },
  { id: "pm1767", name: "i – VII – VI – VII", note: "Folk minor vamp", tonality: "minor", bars: ["i", "VII", "VI", "VII"] },
  { id: "pm251", name: "iiø – V7 – i7", note: "Minor two five one", tonality: "minor", bars: ["iiø", "V7", "i7"] },
];

export const SIMPLE_SCALES = new Set(["major", "minor", "majpent", "minpent", "blues"]);
export const SIMPLE_CHORDS = new Set(["maj", "min", "5", "sus4", "7", "m7", "maj7"]);
export const SIMPLE_PROGS = new Set(["p1564", "p145", "p1645", "pblues", "pm1637"]);
/* views hidden from the nav in Simple mode (kept: scales, chords, arpeggios,
   chord changes, quiz, melodies, tuner, metronome) */
export const SIMPLE_HIDDEN = new Set(["interval", "prog", "ear", "finder"]);
/* which accordion each view lives under, so the active view's group can open */
export const CAT_OF: Record<string, string> = {
  scale: "learn",
  arp: "learn",
  interval: "learn",
  chord: "learn",
  prog: "learn",
  changes: "practice",
  routine: "practice",
  strum: "practice",
  melody: "practice",
  quiz: "practice",
  ear: "practice",
  tuner: "tools",
  finder: "tools",
  account: "profile",
  plog: "profile",
  settings: "profile",
};

/* melody timeline: eighth-note slots per bar (4/4), and a bar cap */
export const MEL_SLOTS = 8;
export const MEL_MAX_BARS = 8;

/* strumming patterns over one bar of eighth notes (1 & 2 & 3 & 4 &).
   d = downstroke, u = upstroke, null = no strum on that eighth. An uppercase
   D or U is the same stroke played with an accent (louder). Patterns without
   `simple: true` are the advanced set, hidden in Simple mode. */
export const STRUM_PATTERNS: StrumPattern[] = [
  { id: "downs", name: "Down beats", simple: true, slots: ["d", null, "d", null, "d", null, "d", null] },
  { id: "eighths", name: "All eighths", simple: true, slots: ["d", "u", "d", "u", "d", "u", "d", "u"] },
  { id: "oldfaithful", name: "D DU UDU", simple: true, slots: ["d", null, "d", "u", null, "u", "d", "u"] },
  { id: "folkrock", name: "D DU D DU", simple: true, slots: ["d", null, "d", "u", "d", null, "d", "u"] },
  { id: "offbeats", name: "Off-beats", simple: true, slots: [null, "u", null, "u", null, "u", null, "u"] },
  /* advanced: accents mixed in */
  { id: "backbeat", name: "Backbeat", slots: ["d", null, "D", "u", "d", null, "D", "u"] },
  { id: "driving", name: "Driving", slots: ["D", "u", "d", "u", "D", "u", "d", "u"] },
  { id: "syncopated", name: "Syncopated", slots: ["d", null, "d", "U", null, "U", "d", "u"] },
  { id: "reggae", name: "Reggae skank", slots: [null, "U", null, "U", null, "U", null, "U"] },
  { id: "anthem", name: "Anthem", slots: ["D", null, "d", "u", "D", "u", "d", "U"] },
];
export const simpleList = <T extends { id: string }>(arr: T[], allow: Set<string>, on: boolean, keepId: string): T[] =>
  on ? arr.filter((x) => allow.has(x.id) || x.id === keepId) : arr;

export const INTERVAL_PRESETS: IntervalPreset[] = [
  { id: "root", label: "Root only", iv: [0] },
  { id: "maj", label: "Major triad", iv: [0, 4, 7] },
  { id: "min", label: "Minor triad", iv: [0, 3, 7] },
  { id: "dom7", label: "Dominant 7th", iv: [0, 4, 7, 10] },
  { id: "maj7", label: "Major 7th", iv: [0, 4, 7, 11] },
  { id: "min7", label: "Minor 7th", iv: [0, 3, 7, 10] },
  { id: "pent", label: "Minor pentatonic", iv: [0, 3, 5, 7, 10] },
  { id: "all", label: "All twelve", iv: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
];

export const TIME_SIGS: LabelledValue<number>[] = [
  { v: 2, l: "2/4" },
  { v: 3, l: "3/4" },
  { v: 4, l: "4/4" },
  { v: 5, l: "5/4" },
  { v: 6, l: "6/8" },
  { v: 7, l: "7/8" },
];

/* interval colour by harmonic function, not by rainbow position */
export const FUNC_COLOUR: Record<number, string> = {
  0: "#E9A824", // root, gold
  1: "#6E9236",
  2: "#6E9236", // 2nds, moss
  3: "#12A19A",
  4: "#12A19A", // 3rds, teal
  5: "#7C5BB0", // 4th, violet
  6: "#3E7CB1",
  7: "#3E7CB1", // tritone and 5th, steel
  8: "#D2763B",
  9: "#D2763B", // 6ths, copper
  10: "#BE4E7B",
  11: "#BE4E7B", // 7ths, rose
};
export const LOWERED = new Set([1, 3, 6, 8, 10]);

export const SINGLE_DOTS = [3, 5, 7, 9, 15, 17, 19, 21];
export const DOUBLE_DOTS = [12, 24];
