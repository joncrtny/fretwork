# SEO and content strategy

Fretwork is a client-rendered single-page app, but it now has real per-view URLs
that are prerendered at build, so each view is its own crawlable page. This is
the most important thing to understand before writing content or chasing keywords.

## The structural reality (read this first)

- **Every view is a real URL.** `VIEW_META` paths (`/scales`, `/intervals`,
  `/faq`, ...) are genuine routes. The home view (chords) is `/`. Client routing
  (`pathForMode` / `modeForPath` in `App.jsx`) keeps the address bar in step, and
  `vercel.json` (rewrite + `cleanUrls`) serves deep links.
- **Each route is prerendered.** `scripts/prerender.mjs` runs after `vite build`
  and writes one static HTML file per public route with that route's own title,
  meta description, canonical and Open Graph tags, plus a small crawlable content
  stub in `#root` that React replaces on mount. So crawlers and social scrapers
  get a page-specific `<head>` and real text at each URL, and Googlebot (which
  renders JS) gets the full interactive view on top.
- **Consequence:** each view can now rank on its own for its topic (for example
  `/scales` for "guitar scales", `/tuner` for "online guitar tuner"), and shared
  links show the right preview. The `sitemap.xml` lists the home page plus all
  prerendered routes.
- **What to keep strong:** page-specific title/description (in `prerender.mjs`),
  the WebApplication schema (`index.html`), the FAQ content and its FAQPage
  schema (served at `/faq`), and genuinely useful on-page copy per view.
- **Utility routes** (`/bank`, `/account`, `/settings`, `/practice-log`) are
  deliberately not prerendered or listed in the sitemap; they fall through to the
  SPA and are not an SEO surface.

## Principles (how we write FAQ answers)

1. **Answer first.** Open each answer with a self-contained 40 to 60 word direct
   answer, then expand. AI Overviews and featured snippets lift the first one or
   two sentences, so the definition or first step sits at the very top, with no
   preamble and no call to action.
2. **One question, one intent.** Each entry targets a single real query. Do not
   blend "what is X" and "how to do X" in one heading.
3. **Natural question headings.** Use the words people actually type, matching
   "People Also Ask" phrasing. Phrase headings as questions.
4. **Unique, substantive answers.** No near-duplicate entries. Copy is original
   to Fretwork, never lifted from another site, and is not duplicated between the
   FAQ and on-tool copy.
5. **Real first-hand experience (E-E-A-T).** Because Fretwork is interactive,
   answers can say "see and hear this in the X view", which text-only competitors
   cannot. Use it once per answer, after the real answer.
6. **Internal links.** Each answer may link once to the matching tool (the "Open
   X" button), which helps users and passes topical relevance.
7. **FAQPage schema, used honestly.** Generated from the same data the page
   renders. Only genuine Q&A, never CTAs or promo. Note: since 2023 Google shows
   FAQ rich results only for authoritative gov/health sites, so treat the schema
   as parsing and AI-citation help, not a rich-result play.
8. **en-GB.** "practise" (verb), "practice" (noun), "memorise", "colour",
   "analyse", "recognise". Keep US spellings out of headings.

## Anti-patterns (what we deliberately do not do)

- No keyword-stuffed headings; no repeating "guitar"/"Fretwork" in every line.
- No invented questions nobody searches, just to place a keyword.
- No promotional non-answers ("use Fretwork to find out"); answer fully first.
- No FAQ schema around CTAs or adverts (violates Google's policy).
- No chasing off-topic transactional queries ("best beginner guitar to buy",
  "lessons near me"); they are high-competition and dilute topical focus.
- No answer bloat that buries the definition four paragraphs down.

## Keyword themes and priority

Content is grouped into semantic clusters, each mapping to a FAQ section and,
where relevant, a tool:

- **Reading notation** (chord charts, X/O, finger numbers, tab) -> Chords, Quiz
- **Chords** (what is a chord, major vs minor, open, barre, power) -> Chords
- **Intervals and core theory** (interval, tone/semitone, octave, sharps/flats)
  -> Intervals
- **Scales and keys** (scale, major, minor, pentatonic, key) -> Scales
- **Rhythm** (time signature, 4/4, BPM, note values, strumming) -> Strumming
- **Tuning** (standard EADGBE, how to tune, drop D, staying in tune) -> Tuner
- **Fretboard knowledge** (memorising the neck, the dots) -> Fretboard Quiz
- **Technique and problems** (buzzy chords, faster chord changes, sore fingers)
- **Practice and learning** (how long a day, how long to learn, too late as an
  adult, what to learn first)
- **The app** (free, offline, account, install to home screen, PWA, devices)

**Lead priorities** (highest search demand x beginner usefulness x winnability):
X and O on a chord chart; how to read a chord chart; finger numbers; standard
tuning (EADGBE); how to tune a guitar; why chords sound buzzy; first chords to
learn; what is a chord; time signatures and 4/4; tempo/BPM and using a metronome;
what is an interval; changing chords faster; memorising the fretboard; how long
to practise; and the app essentials (free, offline, install to home screen).

## Featured-snippet shaping

- Paragraph snippets ("what is X"): first sentence restates the question as a
  complete definition, using the expected entities (semitone, tonic, root note,
  quarter note).
- List snippets ("how to X"): a lead sentence then a tight 3 to 6 step list.
- Include the specific number, symbol or mnemonic (the BPM value, EADGBE, the
  X/O rule); concrete specifics get cited over vague prose.

## Done

- **Real per-view URLs, prerendered** (the biggest SEO lever): client routing +
  host config + `scripts/prerender.mjs` + full sitemap. See above.
- **Per-section descriptive copy** on each tool view (a short "what this is for"
  line), which aids usability and adds on-topic text.

## Next levers (not yet done)

- **Verify in Search Console:** submit the sitemap, confirm the prerendered
  routes are indexed, and watch which queries each page earns.
- **Deepen per-route content:** the prerender stub is intentionally light. If a
  topic route needs to compete on content, add a real static intro section for
  that view (unique copy, not duplicated from the FAQ).
- **Consider per-route Open Graph images** so shared links preview per topic
  rather than the single site image.
- **Keep titles/descriptions tuned** in `prerender.mjs` as the query data comes
  in from Search Console.
