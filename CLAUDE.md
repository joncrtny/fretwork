# Fretwork

Single-page React 18 + Vite app. Almost everything lives in `App.jsx` (~4k lines, by design); styles are the `CSS` template literal at the bottom of that file. `docs/DESIGN.md` holds the design system and house style, `docs/ROADMAP.md` the plan, `docs/SETUP.md` the external services.

## Hard rules

- **No em dashes anywhere**: UI copy, comments, docs. Use commas, colons, parentheses, or "to".
- No AI-sounding copy ("honestly", "delve", hedging filler). Plain en-GB, GBP.
- Never hardcode colours; use the theme tokens on `.app` / `.app.dark` so dark, high-contrast and light all track.
- Every interactive feature must be keyboard-operable and labelled for screen readers before it counts as done.

## Testing with Playwright

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
