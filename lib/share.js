/* Share links carry the current view's state in a URL hash (#s=<base64>). The
   payload is a small params object; encoding and decoding are pure and live
   here, while turning the decoded params into app state stays in the shell. */

export function shareLinkFromParams(p) {
  const enc = btoa(encodeURIComponent(JSON.stringify(p)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${window.location.origin}/#s=${enc}`;
}

/* Parse a #s=... hash back into its params object, or null if it is absent or
   malformed. Only a strict, URL-safe base64 body is accepted. */
export function decodeShareHash(hash) {
  const mt = (hash || "").match(/^#s=([A-Za-z0-9_-]+)$/);
  if (!mt) return null;
  try {
    const pad = mt[1].length % 4 === 0 ? "" : "=".repeat(4 - (mt[1].length % 4));
    return JSON.parse(decodeURIComponent(atob(mt[1].replace(/-/g, "+").replace(/_/g, "/") + pad)));
  } catch (e) {
    return null;
  }
}
