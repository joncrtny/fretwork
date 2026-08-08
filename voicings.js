/* ==========================================================
   VOICING ENGINE
   Given a chord (root + intervals) and a tuning, find playable
   fingerings across the neck. Pure: no React, no shared state.
   ========================================================== */

export function findVoicings(rootPc, intervals, midis, fretCount, capo, opt) {
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
