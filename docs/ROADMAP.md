# Fretwork roadmap

Delivered in reviewed, tested, deployed waves. Status as of 2026-08-07 (overnight autonomous run).

## Done

- Core app: Scales, Chords (with voicings and fingerings), Progressions, Intervals, Quiz, Bank.
- One-minute chord-change trainer (Practice): pick 2 to 4 chords, timed drill, save best per set.
- Wave 1: app-like nav (tap to navigate and close on phones, persistent sidebar on desktop), full-screen Settings sheet with modal focus management, animation pass, em-dash purge, SEO and meta, favicon and OG assets, Google Analytics with custom events.
- PWA: installable, fully offline (service worker precache + font caching).
- Wave 2: metronome subdivisions (eighth, swing, triplet, sixteenth); collapsed repeat bars in progression charts; key-aware accidental spelling (Auto note names, letter-coverage vote); About tab with resources, privacy note, live Supabase feedback form; Amplitude analytics (production only, session replay deliberately dropped); GA gated off localhost.
- Wave 2.5: categorized pickers everywhere (Chord, Scale, Progression match the Root pattern); dual-thumb fret range; bottom action bar with button hierarchy (.btn.primary tier); Tuner as its own Tools sheet; About Fretwork pinned dark at the menu bottom; accessibility pass (high contrast, reduced animation, zoom in Settings; keyboard-operable fretboard with screen-reader announcements; Escape everywhere with focus restore; accessibility statement on About). Donate button hidden behind SHOW_DONATE until there is an audience. Google Search Console verified (DNS TXT + meta).
- Wave 3: accounts and sync. Username-only auth over Supabase (synthesized email, username in metadata), obscenity moderation with leetspeak normalisation, prominent no-recovery warning, optional email linking for recovery, Account nav section (Create account / Account + Bank), server-wins sync of Bank and chord-change records with adopt-local on first sign-in, feedback attributed to the signed-in user. Live-tested end to end against production Supabase.

## Wave 4, larger features (in order)

1. Melodies: tap a tab onto the fretboard as a sequence, see its note names and a likely-key hint, play it back at adjustable tempo and subdivision, transpose, save locally and to the account (melodies column already exists).
2. Ear training in both directions (hear then identify, and the reverse).
3. Share links that encode app state in the URL.
4. Custom progressions and song sheets (custom_progs column exists).
5. Practice log and routine builder (practice_log column exists).
6. Help walkthrough that drives the live app rather than screenshots.
7. Mic tuner inside the Tuner sheet. Request microphone access only when the user starts it, never on load.

## Later, from the original tier list

Reverse chord lookup, note-finding against a clock, triads on three-string sets, tempo ramping on the metronome, capo calculator, print or export a diagram.

## Standing notes

- Test account `fretwork_selftest` exists in Supabase auth (created during Wave 3 verification); delete from the dashboard or keep for testing.
- One dashboard toggle still pending for email linking to complete: Authentication -> Email -> disable "Secure email change" (see SETUP.md).
- The donate section returns by flipping SHOW_DONATE in App.jsx.
