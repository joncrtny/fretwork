# Fretwork

Single-page React 18 + Vite app. `App.jsx` holds the main component, its state and all the view panes; styles are the `CSS` template literal at the bottom of that file. Shared, pure code is split into modules imported by `App.jsx`: `theory.js` (notes, scales, chords, tunings, progressions, ear/picker sets, the tab parser and music helpers), `voicings.js` (the chord-voicing engine), `audio.js` (the Web Audio layer: pluck, metronome clicks, blips) and `fretboard.jsx` (neck geometry, the `Fretboard` SVG and `ChordDiagram`). Keep new pure theory/data, audio or rendering code in those modules rather than growing `App.jsx`. `docs/DESIGN.md` holds the design system and house style, `docs/ROADMAP.md` the plan, `docs/SETUP.md` the external services, `docs/SEO.md` the SEO and content strategy, and `docs/REFACTOR.md` the in-progress plan to break `App.jsx` into `lib/`, `data/`, `components/`, `views/` and `hooks/` (follow its phase order and guardrails when working on the split).

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
