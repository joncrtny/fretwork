/* Minimal shapes these helpers read. The real defs (chords, scales) carry more
   fields; structural typing lets the richer objects pass where only id/name are
   used. */
interface PickGroup {
  label: string;
  ids: string[];
}
interface PickDef {
  id: string;
  name: string;
}

/* materialize groups from defs, respecting Simple mode like simpleList does */
export function groupItems(groups: PickGroup[], defs: PickDef[], allow: Set<string>, simpleOn: boolean, keepId: string) {
  return groups
    .map((g) => ({
      label: g.label,
      items: g.ids
        .map((id) => defs.find((d) => d.id === id))
        .filter((d): d is PickDef => !!d)
        .filter((d) => !simpleOn || allow.has(d.id) || d.id === keepId)
        .map((d) => ({ id: d.id, name: d.name })),
    }))
    .filter((g) => g.items.length > 0);
}

/* which open string a detected pitch is closest to, and which way to tune */
export function nearestStringTarget(midi: number, midis: number[]) {
  let best: { i: number; diff: number; target: number } | null = null;
  for (let i = 0; i < midis.length; i++) {
    const diff = midi - midis[i];
    if (!best || Math.abs(diff) < Math.abs(best.diff)) best = { i, diff, target: midis[i] };
  }
  if (!best) return null;
  const roundedDiff = Math.round(best.diff);
  return { label: `string ${midis.length - best.i}`, diff: Math.abs(roundedDiff) <= 0 ? 0 : roundedDiff };
}

/* auth calls fail very differently offline; say so instead of blaming the password */
export function isNetErr(er: unknown): boolean {
  if (!er || typeof er !== "object") return false;
  const e = er as { status?: number; name?: string; message?: string };
  return e.status === 0 || e.name === "AuthRetryableFetchError" || /fetch|network/i.test(e.message || "");
}
