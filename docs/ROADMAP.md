# Fretwork roadmap

Delivered in reviewed, tested, deployed waves. Status as of 2026-08-08.

## Done

- Core: Scales, Chords (voicings and fingerings), Arpeggios (with direction patterns), Progressions, Intervals, Quiz, Bank.
- One-minute chord-change trainer, now with a Free (untimed) option and up to eight chords.
- Wave 1: app-like nav, full-screen views with focus management, animation pass, SEO and meta, Google Analytics, PWA (installable, fully offline).
- Wave 2: metronome subdivisions; collapsed repeat bars; key-aware accidental spelling (Auto); About tab with resources and a live feedback form; Amplitude analytics (no session replay); GA off localhost.
- Wave 2.5: categorized pickers everywhere; dual-thumb quiz range; button hierarchy; Tuner as its own view; accessibility pass (high contrast, reduced motion, zoom, keyboard-operable fretboard with announcements, statement on About); Search Console verified.
- Wave 3: accounts and sync. Username-only Supabase auth, obscenity moderation, no-recovery warning, optional email linking with real password reset, Profile nav section, server-wins sync of Bank, chord-change records, custom progressions, melodies and practice log.
- Wave 4: Melodies (write on the neck with play-order marks, repeats, rests, transpose, key hint, save, sync, share); Ear training (identify and explore, intervals and chord types); Arpeggios; Share links; Custom progressions and song sheets (sections); Microphone tuner (mic only on start, released on stop or leave); Practice log (auto-tracked time, streak, breakdown, sync); guided tour (live app, operable modal); capo calculator.
- Refinements (2026-08-08): chord diagrams put low E on the left; arpeggio Play-order labels follow the chosen direction (ascending for Up, descending for Down) within the picked position; Hear it plays the selected neck position for scales and arpeggios; Bank restores saved scale/arpeggio positions and chord capo, and Bank shares carry the tuning; chord finder uses key-aware sharp/flat spelling.

## Later tier (worth having, no rush)

Not yet built: note-finding against a clock; triads on three-string sets; tempo ramping on the metronome; print or export a diagram. (Reverse chord lookup shipped as the Chord finder; the strum trainer shipped, see below.)

## 2026-08-08 session

Shipped: nav accordions with a Simple-mode toggle (hides Intervals, Progressions, Ear training, Chord finder for beginners); per-shape save stars on chords; Vercel Speed Insights; SPA page_view tracking for GA4/Amplitude (fixes 0% engagement); the melody screen redesigned as a fretboard plus an eighth-note bar timeline; a strum-pattern trainer under Practice. Refactor: App.jsx split into theory.js, voicings.js, audio.js and fretboard.jsx. All reviewed by an adversarial agent workflow (nine findings fixed) and deployed.

## House rules

See CLAUDE.md and docs/DESIGN.md. No em dashes, no AI-sounding copy, en-GB, GBP. Everything keyboard-operable and labelled. Build, review with a workflow, live-test with Playwright, then deploy. Testing note: use waitUntil domcontentloaded and explicit timeouts (the service worker breaks networkidle).

## Standing notes

- Test account fretwork_selftest exists in Supabase; delete or keep.
- Email linking needs one dashboard toggle: Authentication, Email, disable "Secure email change" (see SETUP.md).
- Donate section is hidden behind SHOW_DONATE in App.jsx until there is an audience.
- Analytics: the app is a single page, so it emits a manual GA4 page_view (and an Amplitude screen_view) per in-app view change via the [mode] effect in App.jsx (VIEW_META maps each view to a synthetic path). index.html sets send_page_view:false so the app owns pageviews. To make value actions also count as engagement, mark bank_save, sign_up and changes_start as Key events in GA4 (Admin, Events); no code change needed.
