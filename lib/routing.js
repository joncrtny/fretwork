/* A friendly synthetic path and title for each in-app view. The app is a
   single page, so GA and Amplitude never see navigation on their own: we send
   a page_view per view change instead, keyed off these. Keep every `mode`
   value covered, or its path falls back to a raw, opaque "/mode". */
export const VIEW_META = {
  chord: { path: "/chords", title: "Chords" },
  scale: { path: "/scales", title: "Scales" },
  arp: { path: "/arpeggios", title: "Arpeggios" },
  interval: { path: "/intervals", title: "Intervals" },
  prog: { path: "/progressions", title: "Progressions" },
  changes: { path: "/chord-changes", title: "Chord changes" },
  routine: { path: "/practice-routine", title: "Practice routine" },
  strum: { path: "/strumming", title: "Strumming" },
  melody: { path: "/melodies", title: "Melodies" },
  quiz: { path: "/quiz", title: "Fretboard Quiz" },
  ear: { path: "/ear-training", title: "Ear training" },
  finder: { path: "/chord-finder", title: "Chord finder" },
  tuner: { path: "/tuner", title: "Tuner" },
  bank: { path: "/bank", title: "Bank" },
  about: { path: "/about", title: "About" },
  faq: { path: "/faq", title: "FAQ" },
  account: { path: "/account", title: "Account" },
  settings: { path: "/settings", title: "Settings" },
  plog: { path: "/practice-log", title: "Practice log" },
};

/* Real URL routing. Every view has its own path, so views can be linked,
   bookmarked, shared and crawled as distinct pages. The default view (chord) is
   the site root "/", keeping a single canonical home rather than a "/chords"
   duplicate of it. */
export function pathForMode(m) {
  return m === "chord" ? "/" : (VIEW_META[m] && VIEW_META[m].path) || "/";
}

export function modeForPath(p) {
  if (!p || p === "/") return "chord";
  for (const m in VIEW_META) if (m !== "chord" && VIEW_META[m].path === p) return m;
  return null;
}
