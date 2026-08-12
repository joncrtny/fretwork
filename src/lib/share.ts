/* Share links carry the current view's state in a URL hash (#s=<base64>). The
   payload is a small params object; encoding and decoding are pure and live
   here, while turning the decoded params into app state stays in the shell. */

/* The fields a share link may carry. All optional: each view fills only the
   ones it needs (a scale sends r+id, a melody sends steps+nm, and so on). The
   shell validates every field at runtime before applying it, so the decoded
   shape is deliberately loose. */
export interface ShareParams {
  m?: string; // the view (mode) the link opens
  r?: number; // root pitch class
  id?: string; // scale/chord/arp/progression id
  iv?: number[]; // interval set (intervals view)
  bars?: string[]; // custom progression roman-numeral bars
  sec?: Record<string, string>; // progression section markers, bar index to name
  steps?: (number[] | null)[]; // melody timeline: [string, fret] per slot, null for a rest
  nm?: string; // a name (custom progression or melody)
  capo?: number;
  tun?: string; // tuning id
}

export function shareLinkFromParams(p: ShareParams): string {
  const enc = btoa(encodeURIComponent(JSON.stringify(p)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${window.location.origin}/#s=${enc}`;
}

/* Parse a #s=... hash back into its params object, or null if it is absent or
   malformed. Only a strict, URL-safe base64 body is accepted. */
export function decodeShareHash(hash: string): ShareParams | null {
  const mt = (hash || "").match(/^#s=([A-Za-z0-9_-]+)$/);
  if (!mt) return null;
  try {
    const pad = mt[1].length % 4 === 0 ? "" : "=".repeat(4 - (mt[1].length % 4));
    return JSON.parse(decodeURIComponent(atob(mt[1].replace(/-/g, "+").replace(/_/g, "/") + pad))) as ShareParams;
  } catch (e) {
    return null;
  }
}
