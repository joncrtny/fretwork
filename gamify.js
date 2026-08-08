/* ============================================================
   GAMIFICATION: points, levels and badges.
   Pure logic and data. The app assembles a `stats` snapshot (durable
   counters plus practice minutes) and this module turns it into points,
   a level, and each badge's earned tier. No React, no storage.

   Points feel: "fast and punchy" (chosen by the user):
     10 pts / practice minute, 10 / correct ear answer,
     2 / chord change performed, 100 / badge tier reached.
   Levels come quickly at first, then the curve steepens.
   ============================================================ */

/* Each badge is a family of tiers. `metric` names the field on the stats
   snapshot; `tiers` are the thresholds; `unit` labels them; `icon` picks a
   glyph in the UI. tier 0 = not earned, else 1..tiers.length. */
export const BADGES = [
  { id: "ear_interval", name: "Interval ear", icon: "ear", metric: "earStreakInterval", unit: "streak", tiers: [1, 3, 5, 10, 20], blurb: "Best run of correct intervals in ear training" },
  { id: "ear_chord", name: "Chord ear", icon: "ear", metric: "earStreakChord", unit: "streak", tiers: [1, 3, 5, 10, 20], blurb: "Best run of correct chords in ear training" },
  { id: "tourist", name: "Tourist", icon: "tour", metric: "tourTaken", unit: "done", tiers: [1], blurb: "Took the guided tour" },
  { id: "explorer", name: "Explorer", icon: "bulb", metric: "triedSimple", unit: "done", tiers: [1], blurb: "Tried Simple mode" },
  { id: "restrung", name: "Re-strung", icon: "tuning", metric: "tuningCount", unit: "tunings", tiers: [1, 3], blurb: "Tried alternative tunings" },
  { id: "metronome", name: "In time", icon: "metro", metric: "metronomeMin", unit: "min", tiers: [5, 15, 30, 60], blurb: "Minutes practised with the metronome" },
  { id: "quick_changes", name: "Quick changes", icon: "changes", metric: "chordChangeBest", unit: "per min", tiers: [10, 20, 30, 40], blurb: "Best chord changes in a minute" },
  { id: "practice_scale", name: "Scale student", icon: "scale", metric: "minScale", unit: "min", tiers: [10, 30, 60, 120], blurb: "Minutes practising scales" },
  { id: "practice_chord", name: "Chord student", icon: "chord", metric: "minChord", unit: "min", tiers: [10, 30, 60, 120], blurb: "Minutes practising chords" },
  { id: "practice_arp", name: "Arpeggio student", icon: "arp", metric: "minArp", unit: "min", tiers: [10, 30, 60, 120], blurb: "Minutes practising arpeggios" },
  { id: "habit", name: "Daily habit", icon: "flame", metric: "dayStreak", unit: "day streak", tiers: [3, 7, 14, 30], blurb: "Consecutive days practised" },
];

const POINTS_PER_TIER = 100;

/* highest tier reached for a badge given the stats (0 = none) */
export function badgeTier(badge, stats) {
  const v = (stats && stats[badge.metric]) || 0;
  let tier = 0;
  for (let i = 0; i < badge.tiers.length; i++) if (v >= badge.tiers[i]) tier = i + 1;
  return tier;
}

export function totalTiers(stats) {
  return BADGES.reduce((sum, b) => sum + badgeTier(b, stats), 0);
}

export function pointsFor(stats) {
  if (!stats) return 0;
  const practiceMin = (stats.practiceSeconds || 0) / 60;
  return (
    Math.round(10 * practiceMin) +
    10 * (stats.earCorrect || 0) +
    2 * (stats.chordChangesTotal || 0) +
    POINTS_PER_TIER * totalTiers(stats)
  );
}

/* points needed to have reached level L. threshold(1)=0, (2)=100, (3)=300,
   (4)=600, (5)=1000 ... gaps of 100, 200, 300 ... so early levels come fast
   and later ones take longer. */
export function levelThreshold(L) {
  return 50 * L * (L - 1);
}

export function levelFor(points) {
  let L = 1;
  while (levelThreshold(L + 1) <= points) L++;
  return L;
}

/* merge a server copy into the local one without losing progress: take the
   higher value for each cumulative counter, the union of tried tunings, and the
   highest acknowledged tier per badge. Idempotent, so repeated syncs are safe. */
export function mergeGamify(a, b) {
  if (!b || typeof b !== "object") return a;
  const ac = (a && a.counters) || {};
  const bc = b.counters || {};
  const counters = {
    earCorrect: Math.max(ac.earCorrect || 0, bc.earCorrect || 0),
    earStreakInterval: Math.max(ac.earStreakInterval || 0, bc.earStreakInterval || 0),
    earStreakChord: Math.max(ac.earStreakChord || 0, bc.earStreakChord || 0),
    tourTaken: Math.max(ac.tourTaken || 0, bc.tourTaken || 0),
    triedSimple: Math.max(ac.triedSimple || 0, bc.triedSimple || 0),
    tunings: Array.from(new Set([...(ac.tunings || []), ...(bc.tunings || [])])),
    metronomeSeconds: Math.max(ac.metronomeSeconds || 0, bc.metronomeSeconds || 0),
    chordChangesTotal: Math.max(ac.chordChangesTotal || 0, bc.chordChangesTotal || 0),
    chordChangeBest: Math.max(ac.chordChangeBest || 0, bc.chordChangeBest || 0),
    bestDayStreak: Math.max(ac.bestDayStreak || 0, bc.bestDayStreak || 0),
  };
  const acked = { ...((a && a.acked) || {}) };
  for (const [k, v] of Object.entries(b.acked || {})) acked[k] = Math.max(acked[k] || 0, v || 0);
  return { counters, acked };
}

export function levelProgress(points) {
  const level = levelFor(points);
  const cur = levelThreshold(level);
  const next = levelThreshold(level + 1);
  const span = next - cur;
  return {
    level,
    points,
    into: points - cur,
    span,
    toNext: next - points,
    pct: span > 0 ? Math.min(100, Math.round(((points - cur) / span) * 100)) : 0,
  };
}
