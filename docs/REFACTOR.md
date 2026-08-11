# Refactor plan (App.jsx breakup)

`App.jsx` is one ~6,500-line file: a God component (~4,700 lines, 260+ hooks, 77
`mode ===` view branches) plus an ~800-line CSS-in-JS string. The goal is to
split it into small, readable modules without a big-bang rewrite: every step is a
pure move (no behaviour change), build- and smoke-tested, and independently
shippable.

## Guardrails (apply to every step)

- Pure-move commits only. Never rename and relocate in the same commit; never
  change behaviour during a move.
- `npm run build` and `npm test` (the smoke suite) must be green after each step.
- Keep `main` deployable throughout. One concern per commit.

## Phases

- [ ] **0. Safety net** — Playwright smoke suite (every view loads, renders, no
  uncaught errors) + this doc + module map in `CLAUDE.md`.
- [ ] **1. Mechanical extractions** — CSS string to `index.css`; data constants
  to `data/`; pure helpers to `lib/` (`routing`, `analytics`, `share`, `utils`).
- [ ] **2. UI primitives** — shared presentational components to `components/`.
- [ ] **3. State layer** — `AppContext` (Context + reducer, no new dep) for
  cross-cutting state (settings, tuning, capo, effFlats, known, bank, gamify,
  track).
- [ ] **4. Views** — extract each `mode` view to `views/*.jsx`, one at a time,
  isolated views first (Tuner, Quiz, Ear, Melody, Finder, About, FAQ, Settings,
  Practice log, Bank), coupled last (Chord/Scale/Arp, Prog/Changes/Strum).
- [ ] **5. Hooks** — cross-cutting effects to `hooks/` (useAuth, useSync,
  useMetronome, useGamify, usePractice, useRouting). `App.jsx` becomes a shell.
- [ ] **6. Naming** — rename terse identifiers (`pvMode`, `effFlats`, `iv`,
  `sig`, `chg`, ...) now that files are small.
- [ ] **7. TypeScript** — migrate incrementally, types as documentation.
- [ ] **8. Feature flags** — provider-agnostic (Vercel Flags SDK), so a Statsig
  backend stays an option. Only after 0-7.

## Target layout

```
main.jsx, App.jsx (thin shell), index.css
lib/        routing.js, analytics.js, share.js, utils.js, supabase.js
data/       faq.js, changelog.js, resources.js
components/ Seg, Field, KeyPicker, CatPicker, DualRange, IntervalGrid,
            StarSave, BulbSave, KnownButton, HeadIcon, FeedbackForm, DonateButton
shell/      Nav, Header, MetronomePanel, Toast, Tour, modals
state/      AppContext.jsx
hooks/      useAuth, useSync, useMetronome, useGamify, usePractice, useRouting
views/      ChordView, ScaleView, ... (~19)
theory.js, voicings.js, audio.js, gamify.js, fretboard.jsx (existing)
```
