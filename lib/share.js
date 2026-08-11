export function shareLinkFromParams(p) {
  const enc = btoa(encodeURIComponent(JSON.stringify(p)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${window.location.origin}/#s=${enc}`;
}
