/* Post-build prerender. Fretwork is a client-rendered SPA, so on its own every
   route would ship the same <head> and an empty <body>. This script writes a
   static HTML file per public route with that route's own title, description,
   canonical and Open Graph tags, plus a small crawlable content stub inside
   #root (React replaces it on mount). It also rewrites the sitemap.

   No headless browser and no new runtime dependency: it is plain string
   templating over the built dist/index.html. Runs after `vite build`. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const BASE = "https://www.fretwork-practice.app";

/* One entry per public route. The home view (chords) is "/" and keeps the
   existing homepage head; it only gets the content stub. `file` is the output
   path relative to dist; with cleanUrls the extensionless URL resolves to it. */
const HOME_STUB = {
  h1: "Fretwork: interactive guitar fretboard",
  intro:
    "Learn the guitar neck: scales, chords with fingerings, arpeggios, intervals and progressions, with a metronome, ear trainer, fretboard quiz and tuner.",
};

const ROUTES = [
  {
    path: "/scales",
    file: "scales.html",
    title: "Guitar Scales Across the Fretboard | Fretwork",
    desc: "See any guitar scale across the whole neck in any key, hear it played, and learn its shapes position by position. A free, interactive fretboard.",
    h1: "Guitar scales on the fretboard",
    intro: "Map out any scale across the fretboard in any key, hear it played, and learn its shapes position by position.",
  },
  {
    path: "/arpeggios",
    file: "arpeggios.html",
    title: "Guitar Arpeggios on the Neck | Fretwork",
    desc: "Hear and see any guitar arpeggio across the neck in any key, moving up, down or through the shape you choose. Free and interactive.",
    h1: "Guitar arpeggios",
    intro: "Hear and see any arpeggio across the neck in any key, moving up, down or through the shape you choose.",
  },
  {
    path: "/intervals",
    file: "intervals.html",
    title: "Guitar Intervals, Seen and Heard | Fretwork",
    desc: "See and hear how each musical interval sits against the root across the guitar fretboard, so the distances between notes become familiar. Free.",
    h1: "Guitar intervals",
    intro: "See how each interval sits against the root across the fretboard, so the distances between notes become familiar.",
  },
  {
    path: "/progressions",
    file: "progressions.html",
    title: "Guitar Chord Progressions in Any Key | Fretwork",
    desc: "Play through common chord progressions in any key with the shapes to play, and hear how each chord moves to the next. Free and interactive.",
    h1: "Guitar chord progressions",
    intro: "Play through common chord progressions in any key, seeing every chord shape as the sequence moves along.",
  },
  {
    path: "/chord-changes",
    file: "chord-changes.html",
    title: "Chord Change Trainer | Fretwork",
    desc: "Get faster at changing guitar chords: count how many clean changes you can make between two shapes in a minute, in time with a metronome. Free.",
    h1: "Chord change trainer",
    intro: "Build speed by counting how many clean chord changes you can make between two shapes before the clock runs out.",
  },
  {
    path: "/practice-routine",
    file: "practice-routine.html",
    title: "Guitar Practice Routine | Fretwork",
    desc: "A short guitar practice routine built from the scales, chords and arpeggios you already know, plus one new thing to stretch you. Free.",
    h1: "Guitar practice routine",
    intro: "A short routine built from the scales, chords and arpeggios you have marked as known, plus one new thing to stretch you.",
  },
  {
    path: "/strumming",
    file: "strumming.html",
    title: "Guitar Strumming Trainer | Fretwork",
    desc: "Lock your strumming hand to the beat: follow the down and up pattern against a metronome and keep the hand moving throughout. Free.",
    h1: "Guitar strumming trainer",
    intro: "Lock your strumming hand to the beat. Follow the down and up pattern against a metronome, keeping the hand moving throughout.",
  },
  {
    path: "/melodies",
    file: "melodies.html",
    title: "Write Guitar Melodies and Riffs | Fretwork",
    desc: "Write your own melody or riff on the guitar fretboard and hear it back, then save or share it. Free and interactive.",
    h1: "Write guitar melodies",
    intro: "Write your own melody or riff on the fretboard, then hear it back.",
  },
  {
    path: "/quiz",
    file: "quiz.html",
    title: "Fretboard Note Quiz | Fretwork",
    desc: "Learn the notes on the guitar neck with a quick quiz: find the note Fretwork lights up and build fast, automatic recall of the fretboard. Free.",
    h1: "Fretboard note quiz",
    intro: "Quiz yourself on scales, chords and intervals by naming the notes Fretwork lights up on the neck.",
  },
  {
    path: "/ear-training",
    file: "ear-training.html",
    title: "Guitar Ear Training: Intervals and Chords | Fretwork",
    desc: "Train your ear to recognise intervals and chord types by sound, the skill behind playing by ear and improvising. Free and interactive.",
    h1: "Guitar ear training",
    intro: "Train your ear to recognise intervals and chord types by sound, then check yourself against the answer.",
  },
  {
    path: "/chord-finder",
    file: "chord-finder.html",
    title: "Guitar Chord Finder | Fretwork",
    desc: "Find the name of a chord from the notes you pick on the guitar fretboard. Free and interactive.",
    h1: "Guitar chord finder",
    intro: "Find the name of a chord from the notes you pick on the neck.",
  },
  {
    path: "/tuner",
    file: "tuner.html",
    title: "Online Guitar Tuner (Microphone) | Fretwork",
    desc: "Tune your guitar in the browser using your device microphone: play a string and Fretwork shows how sharp or flat it is. Free and private.",
    h1: "Online guitar tuner",
    intro: "Tune your guitar using your device's microphone. Play a string and Fretwork shows how sharp or flat it is.",
  },
  {
    path: "/faq",
    file: "faq.html",
    title: "Guitar FAQ for Beginners | Fretwork",
    desc: "A plain-language beginner's guide to chords, scales, intervals, rhythm, tuning and reading the fretboard, plus how Fretwork works. Free.",
    h1: "Guitar FAQ for beginners",
    intro:
      "A plain-language guide for anyone learning guitar: chords, scales, intervals, rhythm, tuning, reading the fretboard, and how each tool in Fretwork works.",
  },
  {
    path: "/about",
    file: "about.html",
    title: "About Fretwork",
    desc: "Fretwork is a free, interactive guitar fretboard for learning the neck: scales, chords, intervals, progressions and practice tools. Free, no ads.",
    h1: "About Fretwork",
    intro: "Fretwork is a free, interactive guitar fretboard for learning the neck. It is, and always will be, free and without ads.",
  },
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function setTitle(html, title) {
  return html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
}
/* replace the content="..." of the <meta> identified by attr (e.g. name="description") */
function setMeta(html, attr, content) {
  const re = new RegExp(`(<meta\\s+${attr.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\s+content=")[\\s\\S]*?(")`);
  return html.replace(re, `$1${esc(content)}$2`);
}
function setCanonical(html, url) {
  return html.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`);
}
function setHead(html, { title, desc, url }) {
  let out = html;
  if (title) {
    out = setTitle(out, title);
    out = setMeta(out, 'property="og:title"', title);
    out = setMeta(out, 'name="twitter:title"', title);
  }
  if (desc) {
    out = setMeta(out, 'name="description"', desc);
    out = setMeta(out, 'property="og:description"', desc);
    out = setMeta(out, 'name="twitter:description"', desc);
  }
  if (url) {
    out = setCanonical(out, url);
    out = setMeta(out, 'property="og:url"', url);
  }
  return out;
}
function withStub(html, { h1, intro }) {
  const stub =
    `<div id="root"><main style="max-width:680px;margin:0 auto;padding:56px 20px;font-family:system-ui,-apple-system,sans-serif;line-height:1.55">` +
    `<h1>${esc(h1)}</h1><p>${esc(intro)}</p>` +
    `<p>Fretwork is a free, interactive guitar fretboard. <a href="/">Open Fretwork</a>.</p></main></div>`;
  return html.replace(/<div id="root">\s*<\/div>/, stub);
}

const template = readFileSync(join(DIST, "index.html"), "utf8");

/* Home: keep the SEO homepage head, add the content stub. */
writeFileSync(join(DIST, "index.html"), withStub(template, HOME_STUB));

/* Each other public route: its own head plus a stub. */
for (const r of ROUTES) {
  const url = BASE + r.path;
  let html = setHead(template, { title: r.title, desc: r.desc, url });
  html = withStub(html, { h1: r.h1, intro: r.intro });
  const out = join(DIST, r.file);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
}

/* Sitemap: home plus every prerendered route. */
const today = new Date().toISOString().slice(0, 10);
const urls = ["/", ...ROUTES.map((r) => r.path)]
  .map(
    (p) =>
      `  <url>\n    <loc>${BASE}${p}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${p === "/" ? "1.0" : "0.8"}</priority>\n  </url>`,
  )
  .join("\n");
writeFileSync(
  join(DIST, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
);

console.log(`prerender: wrote ${ROUTES.length} routes + home + sitemap (${ROUTES.length + 1} URLs)`);
