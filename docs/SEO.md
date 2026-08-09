# SEO and content strategy

Fretwork is a client-rendered single-page app on one real URL (`/`). That shapes
what SEO can and cannot do here, and it is the most important thing to understand
before writing content or chasing keywords.

## The structural reality (read this first)

- **Crawlers see one page.** The synthetic paths in `VIEW_META` (`/scales`,
  `/chords`, `/intervals`, ...) exist only to give Analytics a per-view label.
  They are **not** real, separately crawlable URLs. Googlebot renders the SPA and
  indexes the single document at `/`.
- **Consequence:** we cannot, today, rank a dedicated `/scales` page for "guitar
  scales" or a `/chords` page for "guitar chords", because those pages do not
  exist as documents. All ranking weight lands on the one home document.
- **What this means for effort:** the highest-leverage on-page SEO we can do
  without re-architecting is (a) a strong single document (title, description,
  headings, WebApplication schema), and (b) genuinely useful, well-structured
  **content** on that document, which is what the Help & FAQ provides. The FAQ is
  the main organic-surface-area play available to a one-URL SPA.
- **If we later want per-topic ranking**, that is an architecture decision
  (prerendering / static generation of real per-view routes, or a small set of
  server-rendered landing pages). Raised in "Open questions" below, not assumed.

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

## Open questions (architecture, not yet decided)

- Should we prerender or statically generate real per-view URLs so topic pages
  can rank individually? This is the single biggest SEO lever and the single
  biggest engineering change. Not to be done silently; needs a decision.
- Per-section descriptive copy on each tool view (a short "what this is for"
  line) improves usability and adds on-topic text; being added incrementally.
