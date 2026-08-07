# Fretwork

Interactive guitar neck reference.

- **Scales** — key and scale across the whole neck, with playback that lights each degree as it sounds.
- **Chords** — voicings generated against your actual tuning, with finger numbers and barre bars.
- **Intervals** — pick a root, toggle any of the twelve, coloured by harmonic function.
- **Quiz** — scale or chord, from one note hidden to a blank neck, with scoring that persists.
- Draggable capo, configurable fret count and tuning, left-handed mode.

## Running locally

```
npm install
npm run dev
```

## Build

```
npm run build
```

Output goes to `dist/`.

## Deploying

The Vercel project is `fretwork` (`prj_oA9wXsf1dEqIS3hFsdRqTkPOaRVU`).

Either push this repo to GitHub and connect it under Settings, Git in the
Vercel dashboard, or deploy straight from this folder:

```
npx vercel link --project fretwork
npx vercel --prod
```

Vercel Web Analytics is wired up in `src/main.jsx`. It only reports from a
deployed Vercel domain, so local runs will log a dev notice and send nothing.
