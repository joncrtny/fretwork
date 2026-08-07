# Fretwork design notes

Living reference for how Fretwork looks, behaves, and is built. Keep it current as features land.

## House style

- **No em dashes.** Anywhere. Not in the UI, not in code comments, not in docs. Use commas, colons, parentheses, or the word "to". This is a hard rule.
- Tone in UI copy: plain, encouraging, lower-case sentence style for helper text; short.
- Currency and spelling are British (en-GB). Prices in GBP.

## Visual system

Everything is themed through CSS custom properties on `.app` (light) and `.app.dark` (dark). Never hardcode a colour in a component or a new style block, always use a token so dark mode tracks automatically.

Core tokens (light / dark):
- `--paper` page background (#F2F5F6 / #0E1418)
- `--card` raised surfaces (#FFFFFF / #171F25)
- `--line`, `--line2` borders (subtle / stronger)
- `--ink` primary text, `--muted` secondary text, `--onink` text on inked surfaces
- Accents: `--gold` (#E9A824), `--teal` (#12A19A), `--red`

Type:
- Display and labels: "Antonio" (uppercase, letter-spaced) for headings, section labels (`.dhead`, `.flabel`), buttons, the big clock.
- Mono: "IBM Plex Mono" for note names, readouts, numeric values.
- Body: "IBM Plex Sans".

Spacing and shape: 4 to 6px radii on controls, 8 to 14px on cards and sheets, generous gaps (14 to 20px) between fields.

## Motion

Subtle and premium, never showy. Standard easing is `cubic-bezier(.22,1,.36,1)` over 0.15s to 0.3s.
- Views fade and rise in on mode change (`.panel` `viewIn`, main is keyed by mode).
- Drawer slides, scrim fades, the Settings sheet slides up with opacity.
- Buttons press down 1px on `:active`; cards (voicings, prochords) lift on hover.
- Everything collapses to near-instant under `prefers-reduced-motion`.

## Navigation and layout (app-like)

- Left drawer holds the menu, grouped **Learn / Practice / Tools**. Global settings live inside Tools, Settings (a full-screen sheet), not in the nav.
- On phones (max-width 700px) the drawer overlays with a scrim and closes automatically when you choose anything. On desktop it is a persistent push sidebar that stays open.
- Settings and any future full-page tools use the full-screen `.sheet` pattern (fixed overlay, `.sheethead` with title and close, scrollable `.sheetbody` that is a flex column so nested `auto-fit` grids never overflow on mobile).
- The metronome remains a lightweight inline panel so it can sit above the neck while you play.

## Architecture

- Single-page React 18 app built with Vite. The whole UI is in `App.jsx` (large single file by design), styles live in the `CSS` template literal at the bottom.
- Audio is a Karplus-Strong pluck synth plus click sounds, created lazily on first use (`ctx()`), so no audio context is opened until the user does something that makes sound. The upcoming mic tuner must follow the same rule: request microphone access only when the tuner is opened and started, never on load.
- Persistence today: a small `store` shim over `localStorage` (keys `fretboard:settings|bank|stats|changes`).
- Persistence next: Supabase (project linked via Vercel). User accounts and their saved chords, progressions, melodies, practice logs, and feedback move server-side and sync across devices. Client uses the publishable key via a `VITE_`-prefixed env var. See ROADMAP.md, Wave 3.

## SEO

- `index.html` carries the canonical, description, Open Graph, Twitter card, JSON-LD (`WebApplication`), and light/dark `theme-color`. Canonical host is `https://fretwork-practice.app/`.
- Static assets live in `public/` (served at the site root): `favicon.svg`, `og.svg`, `site.webmanifest`, `robots.txt`, `sitemap.xml`.
- Known follow-up: `og.svg` and the apple-touch-icon should become PNGs, since several social scrapers and iOS do not render SVG.
