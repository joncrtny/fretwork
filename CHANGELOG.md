# Changelog

Notable, user-facing changes to Fretwork. Newest first. The short version of the
most recent entries is shown in the app under About, "What's new".

## 2026-08-10

Full-site review pass (copy, structure, structured data, accessibility), from an
adversarial multi-agent review with every finding independently verified.

### Added
- **Real URLs for every view.** Each view now has its own address (for example
  /scales, /faq, /tuner), so you can bookmark it, share a link to it, and use the
  browser Back and Forward buttons. The home view stays at /. This also lets each
  view be found on its own by search engines. Deep links are served by a new
  host rewrite, and the Help & FAQ page carries its structured data at /faq.
- A one-line description at the top of each main view (Scales, Chords, Arpeggios,
  Intervals, Progressions, Fretboard quiz, Chord changes, Ear training) so it is
  clear what each section is for before you meet the controls.
- Per-view browser tab and history titles (the home view keeps its full title).

### Changed
- Clearer copy: the Tuner now opens with a plain explanation (the old line was
  garbled), the "no shapes" message on Chords points to the real Settings
  controls, and several labels were made consistent (Bank, Roman numerals, the
  Scales neck labels, the ear-training and practice-log wording).
- WebApplication structured data now lists the app's features and language;
  the FAQ structured data is published only while the Help & FAQ view is open,
  so the markup always matches what is on screen. Sitemap and PWA manifest
  tidied (lastmod, id, language, categories).

### Fixed
- Accessibility: the main menu is now a navigation landmark, every view has a
  heading, the fretboard and metronome regions are labelled, and previously
  unlabelled controls (the feedback form, quiz and tuner inputs, and the compact
  toggle selects on small screens) now have accessible names.

## 2026-08-09

### Added
- **Help & FAQ**: a new, separate section (its own view and nav item) with a
  plain-language beginner's guide: about 73 questions across 10 themed sections,
  ordered to match a beginner's real path (getting started, first steps and
  common worries, tuning, reading chord charts and tab, chords and harmony,
  rhythm and the metronome, scales and intervals, practising and progress,
  using Fretwork's tools, and how Fretwork works). Grounded in competitor and
  keyword research, each answer leads with a direct, self-contained sentence
  and, where useful, links to the matching tool. Reviewed for factual accuracy,
  plain language and a warm, beginner-first tone.
- **What's new** section on the About page, backed by this changelog.
- **FAQPage structured data** is now generated at runtime from the same FAQ data
  the page renders, so the schema and the visible content can never drift apart.
  See `docs/SEO.md` for the keyword strategy behind the content.

### Changed
- **About**: the nav item "About Fretwork" is now "About". The FAQ that used to
  live on the About page has moved into the dedicated Help & FAQ section.

### Fixed
- **Analytics accuracy (GA4)**: the `ear_answer` and `quiz_new_round` events sent
  a `source` parameter ("interval"/"chord"/"scale"). GA4 reserves `source` as a
  campaign field, so each event rewrote the session's traffic source mid-visit,
  which split sessions, polluted the Source report, and left sessions with events
  but no page_view. The parameter is renamed to `app_mode`, and the analytics
  wrapper now sanitises GA4-reserved names on the gtag path so no future
  parameter can pollute campaign fields. Amplitude and Vercel Analytics are
  unchanged. Historic GA4 acquisition, source/medium, session and landing-page
  data before this date should be treated as unreliable.
