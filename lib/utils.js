/* materialize groups from defs, respecting Simple mode like simpleList does */
export function groupItems(groups, defs, allow, simpleOn, keepId) {
  return groups
    .map((g) => ({
      label: g.label,
      items: g.ids
        .map((id) => defs.find((d) => d.id === id))
        .filter(Boolean)
        .filter((d) => !simpleOn || allow.has(d.id) || d.id === keepId)
        .map((d) => ({ id: d.id, name: d.name })),
    }))
    .filter((g) => g.items.length > 0);
}

/* which open string a detected pitch is closest to, and which way to tune */
export function nearestStringTarget(midi, midis) {
  let best = null;
  for (let i = 0; i < midis.length; i++) {
    const diff = midi - midis[i];
    if (!best || Math.abs(diff) < Math.abs(best.diff)) best = { i, diff, target: midis[i] };
  }
  if (!best) return null;
  const roundedDiff = Math.round(best.diff);
  return { label: `string ${midis.length - best.i}`, diff: Math.abs(roundedDiff) <= 0 ? 0 : roundedDiff };
}

/* auth calls fail very differently offline; say so instead of blaming the password */
export function isNetErr(er) {
  return !!er && (er.status === 0 || er.name === "AuthRetryableFetchError" || /fetch|network/i.test(er.message || ""));
}
