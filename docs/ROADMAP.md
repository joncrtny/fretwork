# Fretwork roadmap

Delivered in reviewed, tested, deployed waves. Status as of the current work.

## Done

- Core app: Scales, Chords (with voicings and fingerings), Progressions, Intervals, Quiz, Bank.
- One-minute chord-change trainer (Practice): pick 2 to 4 chords, timed drill, save best per set.
- Menu grouped Learn / Practice / Tools, global settings inside Settings.
- Wave 1 UX and polish: app-like nav (tap to navigate and close on phones, persistent sidebar on desktop), full-screen responsive Settings sheet, subtle animation pass, em-dash purge, SEO and meta, favicon and OG assets.

## Wave 2, features with no backend need

- Metronome subdivisions (eighths, sixteenths, triplets, swing) in non-simple mode. Dependency for the strum trainer.
- Collapse repeated bars in progression charts (a 12-bar blues should render 3 charts, not 12).
- Key-aware accidental spelling. Correctness fix: spell accidentals from the key, so C minor shows E flat not D sharp. Affects every label.
- About tab: learning resources (JustinGuitar, FaChords, and similar), PayPal donate button (personal project by Jonathan Courtney, donate GBP 2 to help with hosting), and a feedback form. Feedback stores to Supabase.

## Wave 3, accounts and sync (Supabase, project linked via Vercel)

- Username and password login, no email. Clear warning that an account cannot be recovered if the password is lost.
- Block obscene or offensive usernames at sign-up (blocklist plus normalisation to catch leetspeak and separators).
- Store each user's saved chords (Bank), progressions, melodies, and practice logs against their account, synced across devices.
- Feedback form writes to Supabase.
- Client uses `VITE_SUPABASE_URL` and a `VITE_`-prefixed publishable key.

## Wave 4, larger features

- Melodies: write a tab onto the fretboard as a sequence, read out its notes, play it back with adjustable tempo and time signature, and transpose to another key.
- Mic tuner. Request microphone access only when the tuner is opened and started, never on load. (Note: today's "tuner" inside Settings is only a string-tuning editor.)
- Ear training in both directions (hear then identify, and the reverse).
- Share links that encode app state in the URL.
- Custom progressions and song sheets.
- Practice log and routine builder (chain exercises with timers).
- Help walkthrough that drives the live app rather than screenshots.

## Later, from the original tier list

Reverse chord lookup, note-finding against a clock, triads on three-string sets, tempo ramping on the metronome, capo calculator, print or export a diagram.
