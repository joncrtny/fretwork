# Fretwork

Single-page React 18 + Vite + TypeScript app, organised as a shell plus modules (the big-file refactor in `docs/REFACTOR.md` is complete, Phases 0 to 8). All source lives under `src/`; the repo root holds only configs, `index.html`, `docs/`, `scripts/`, `tests/` and `public/`.

- `src/App.tsx` is the **shell**: providers, routing and page-view analytics, the nav and drawer, the metronome transport, share-link intake, Supabase sync, and the neck/readout slot fallbacks for the two views without their own neck (Bank, Routine). It no longer holds view panes or per-view state.
- `src/views/*.tsx`: one module per view (19 of them: Chord, Scale, Arp, Interval, Prog, Strum, Quiz, Changes, Ear, Melody, Finder, Bank, Routine, Tuner, Settings, PracticeLog, About, FAQ, Account). A fretboard view publishes its neck config via `usePublishFretboard` and its header line via `usePublishReadout`; the shell renders whatever is published, falling back to its own memo only for Bank/Routine.
- `src/state/*.tsx`: seven focused React contexts (Toast, Settings, AuthSync, Library, Progress, Selection, Playback), two publish slots (`FretboardContext`, `ReadoutContext`) and the outermost `FlagsContext`. No god object. Nesting order lives in `App.tsx`'s provider tree and `docs/REFACTOR-BLUEPRINT.md`. Migrate contexts outermost-first when touching types: a `createContext(null)` whose hook is consumed in a `.tsx` file infers as `never` until every provider above it is typed.
- `src/hooks/*.ts`: `useChordVoicings` (shared voicing engine for Chord/Strum/Prog/Changes), `useTour`, `useRoutineRunner`, `useNarrow`.
- `src/components/*.tsx`: shared presentational pieces (`Seg`, `Field`, `KeyPicker`, `CatPicker`, `DualRange`, `IntervalGrid`, `SaveButtons`, `HeadIcon`, `TourOverlay`, `RoutineHud`, ...).
- `src/lib/*.ts`: pure helpers (`routing`, `analytics`, `share`, `utils`, `store`, `supabase`, `flags`); `src/data/*`: data constants (`faq` stays `.js` because the node prerender script imports it, `groups`, ...).
- Feature flags (Phase 8): `src/lib/flags.ts` is a provider-agnostic core shaped like the Vercel Flags SDK (`flag({ key, decide })`); `src/flags.ts` is the registry; `src/state/FlagsContext.tsx` provides `useFlag` (outermost provider, so `SettingsContext` can read a flag at first run). Resolution is override > remote (adapter) > `decide()`; the default adapter is static (no backend, offline-first), a Statsig / Edge Config adapter drops in without touching call sites. Overrides come from localStorage and `?ff_<key>=on/off`; the dev panel (`src/components/FlagsPanel.tsx`) is in Settings behind `?flags`. Gate a feature with `useFlag(def)`, never an ad-hoc env check.
- Shared music/render modules: `src/theory.ts` (notes, scales, chords, tunings, progressions, ear/picker sets, tab parser; `neckPositions` is in `fretboard.tsx`), `src/voicings.ts` (voicing search), `src/audio.ts` (Web Audio: pluck, metronome clicks, blips), `src/fretboard.tsx` (neck geometry, the `Fretboard` SVG, `ChordDiagram`, `neckPositions`). Styles are `src/index.css`.

The shared core (`theory.ts`, `lib/`, the contexts) was authored under strict and keeps its explicit types as documentation; `tsconfig` now runs `strict: false` so the leaf layer (views, `App.tsx`, `fretboard.tsx`) stays low-churn, and re-tightening to strict is a later isolated pass. `tsconfig` uses `allowJs` with `checkJs: false`, and `allowImportingTsExtensions` (Vite resolves `.ts`/`.tsx` at import), so a `.js` -> `.ts` rename means updating any importer that spelled the old extension. Explicit `any` is an ESLint warning, not an error, and the leaf layer carries a small, deliberate set of them.

Put new code in the module that owns its concern (a view in `src/views/`, shared state in the right `src/state/` context, a pure helper in `src/lib/`), not in `App.tsx`. `docs/DESIGN.md` holds the design system and house style, `docs/ROADMAP.md` the plan, `docs/SETUP.md` the external services, `docs/SEO.md` the SEO and content strategy, `docs/REFACTOR.md` the refactor plan and progress, and `docs/REFACTOR-BLUEPRINT.md` the context/view design.

## Hard rules

- **No em dashes anywhere**: UI copy, comments, docs. Use commas, colons, parentheses, or "to".
- No AI-sounding copy ("honestly", "delve", hedging filler). Plain en-GB, GBP.
- Never hardcode colours; use the theme tokens on `.app` / `.app.dark` so dark, high-contrast and light all track.
- Every interactive feature must be keyboard-operable and labelled for screen readers before it counts as done.

## Testing with Playwright

- **Smoke suite: `npm test`** runs `tests/smoke.spec.js` (headless Chromium via `@playwright/test`, against the dev server on port 5180). It checks that every view loads at its real route with the correct per-view title and no uncaught errors, plus a few feature checks. It seeds `fretboard:settings` so the app behaves as a returning, full (non-Simple) user. Run it after every refactor step; keep it green.
- **Use `waitUntil: 'domcontentloaded'`, never `networkidle`**: the service worker keeps connections warm, so networkidle is never reliably reached.
- **Pass an explicit `timeout` to every wait and locator action.** A wait without a timeout is the difference between a failed test you can read and twenty minutes of silence.
- Prefer DOM clicks via `page.evaluate` for nav items; the fretboard SVG intercepts pointer hit-tests when items scroll behind it.
- Set React controlled inputs with the native value setter plus an `input` event, or `page.fill` on elements with ids.
- Dev server: `npm run dev -- --port 5179 --strictPort` (restart with `--force` after changing dependencies, or the stale optimize-deps cache 504s and the app renders nothing).

## Build, verify, deploy

- `npm run build` must pass before any commit; it also regenerates the PWA precache.
- Deploys are pushes to `main`: Vercel auto-builds and `vercel ls` shows status. Production is https://www.fretwork-practice.app (apex 308s to www).
- Verify features in the running app, not just the build, before deploying: this project's bar is build, review, live-test, then ship.

## Backend

- Supabase project `wibxytuvqcihbczlwjqq`; publishable key is hardcoded with env override (public by design). Tables `user_data` and `feedback` with RLS; setup SQL in `docs/supabase-setup.sql`.
- Auth is username-only over synthesized emails `<name>@u.fretwork-practice.app`. Never send mail to that domain; it has no MX.
