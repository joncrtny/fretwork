# Refactor plan (App.jsx breakup)

`App.jsx` is one ~6,500-line file: a God component (~4,700 lines, 260+ hooks, 77
`mode ===` view branches) plus an ~800-line CSS-in-JS string. The goal is to
split it into small, readable modules without a big-bang rewrite: every step is a
pure move (no behaviour change), build- and smoke-tested, and independently
shippable.

## Decisions (agreed)

- **State layer:** several *focused* React contexts/reducers (settings, bank +
  known, gamify, audio/metronome), not one god-context and no new dependency.
- **TypeScript:** after the structure split (Phase 7). Typing small leaf modules
  is far safer than typing a 6,500-line component; accepts touching files twice.
- **Enforce, don't just claim, "clean":** add a tooling gate (ESLint + Prettier
  + CI) up front so quality is a property, not an opinion.
- **Deepen tests before the hard phases:** the smoke net is necessary but not
  sufficient; add per-view feature specs before Phases 3-5.

## How agents are (and are not) used

The God-component surgery is **serial** and test-gated; parallel edits to
`App.jsx` would conflict. Agents are used for the parallelisable, safe work:
read-only dependency mapping, per-view test authoring (separate files), drafting
independent `views/*` modules in isolated git worktrees, and per-phase
adversarial review. Integration (the actual cut from `App.jsx` + import wiring)
stays serial, done one module at a time with the suite green between each.

## Guardrails (apply to every step)

- Pure-move commits only. Never rename and relocate in the same commit; never
  change behaviour during a move.
- `npm run build`, `npm test` (smoke) and `npm run lint` must be green after each
  step. Keep `main` deployable throughout. One concern per commit.

## Phases

`App.jsx` went from 6,887 lines to ~1,150: a shell of providers, routing,
nav, the metronome, share intake and Supabase sync. Every view is its own
module; state lives in eight focused contexts, not one god object.

- [x] **0. Safety net**: Playwright suite (every view loads, renders, no
  uncaught errors, plus per-feature checks) + this doc + module map in
  `CLAUDE.md`. The suite grew to 113 tests and gates every commit.
- [x] **1. Mechanical extractions**: CSS string to `index.css`; data constants
  to `data/`; pure helpers to `lib/` (`routing`, `analytics`, `share`, `utils`).
- [x] **2. UI primitives**: shared presentational components to `components/`.
- [x] **3. State layer**: eight focused contexts under `state/` (Toast,
  Settings, AuthSync, Library, Progress, Selection, Playback, plus the Fretboard
  and Readout publish slots), nested outermost-to-inner. No god context, no new
  dependency. Views publish their neck config and readout line to the shell
  through the two slots rather than the shell branching on `mode`.
- [x] **4. Views**: all 19 `mode` views extracted to `views/*.jsx`, one at a
  time. `useChordVoicings` (the shared voicing engine) and `neckPositions`
  (shared marks helper) landed here to serve Chord/Arp/Strum/Prog.
- [x] **5. Hooks**: the two large imperative clusters became hooks +
  components: `useTour`/`TourOverlay` and `useRoutineRunner`/`RoutineHud`. Share
  encode/decode deduped into `lib/share`. Routing, analytics and Supabase sync
  stay in the shell by design: each is bound to `setMode`, the analytics refs
  and every Selection setter, so a hook would only add prop-drilling.
- [x] **6. Naming**: renamed the one opaque shell identifier (`pvMode` ->
  `landingMode`). Domain abbreviations (`iv`, `pc`, `midis`) are idiomatic and
  now consistent within each small module, so they stay.
- [x] **7. TypeScript**: migrated incrementally, types as documentation. All
  source is now `.ts`/`.tsx` (62 files) and lives under `src/`. The shared core
  (`theory.ts`, `lib/`, the contexts) is strict; the leaf layer (views,
  `App.tsx`, `fretboard.tsx`) is `strict: false` so the UI migrated without
  churn while the domain model stays self-documenting. `allowJs` +
  `checkJs: false` let the one remaining `.js` (`data/faq.js`, imported by the
  node prerender script) stay JS. typecheck, build, lint and 113 tests green.
- [ ] **8. Feature flags**: provider-agnostic (Vercel Flags SDK), so a Statsig
  backend stays an option. Only after 0-7.

## Achieved layout

All source lives under `src/`; the repo root holds only configs, `index.html`,
`docs/`, `scripts/`, `tests/` and `public/`.

```
src/
  main.tsx, App.tsx (thin shell), index.css
  theory.ts, voicings.ts, audio.ts, gamify.ts, fretboard.tsx
  lib/        routing, analytics, share, utils, store, supabase (.ts)
  data/       faq.js (kept .js for the prerender script), groups, ... 
  components/ Seg, Field, KeyPicker, CatPicker, DualRange, IntervalGrid,
              SaveButtons, HeadIcon, TourOverlay, RoutineHud, ... (.tsx)
  state/      Toast, Settings, AuthSync, Library, Progress, Selection,
              Playback + Fretboard/Readout publish slots (.tsx)
  hooks/      useChordVoicings, useTour, useRoutineRunner, useNarrow (.ts)
  views/      ChordView, ScaleView, ... (19 views, .tsx)
```
