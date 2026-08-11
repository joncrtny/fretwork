/* family groupings for the pickers */
export const CHORD_GROUPS = [
  { label: "Triads", ids: ["maj", "min", "5", "dim", "aug", "sus2", "sus4"] },
  { label: "Sixths", ids: ["6", "m6"] },
  { label: "Sevenths", ids: ["7", "maj7", "m7", "m7b5", "dim7", "mmaj7", "7sus4"] },
  { label: "Extended", ids: ["add9", "9", "maj9", "m9", "11", "13"] },
  { label: "Altered", ids: ["7b9", "7s9", "7s5", "7b5"] },
];

export const SCALE_GROUPS = [
  { label: "Essentials", ids: ["major", "minor", "majpent", "minpent", "blues", "majblues"] },
  { label: "Minor colours", ids: ["harmmin", "melmin"] },
  { label: "Modes", ids: ["dorian", "phrygian", "lydian", "mixo", "locrian"] },
  { label: "Jazz and exotic", ids: ["phrydom", "lydb7", "altered", "wholetone", "dimhw", "dimwh", "chromatic"] },
];
