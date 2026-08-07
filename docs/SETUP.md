# One-time service setup

Things that live outside the repo and need a human with dashboard access. Everything client-side is already wired in the app.

## Supabase (accounts, sync, feedback)

Project: `wibxytuvqcihbczlwjqq` (https://wibxytuvqcihbczlwjqq.supabase.co), linked to Vercel.

1. **Create the tables**: Supabase dashboard -> SQL Editor -> New query -> paste the whole of `docs/supabase-setup.sql` -> Run. Idempotent, safe to re-run.
2. **Allow username-only accounts**: the app signs users up with a synthesized address (`<username>@u.fretwork-practice.app`) because Supabase Auth requires an email field, but no real email exists and none is ever sent. For sign-in to work immediately: Authentication -> Sign In / Providers -> Email -> turn **off** "Confirm email". (Leave the Email provider itself enabled.)
3. Nothing else. The app uses the publishable key baked into the client (public by design); RLS policies above are what protect data.

## Analytics

- Google Analytics property `G-VMNC1CJ595`, tag in `index.html` (skipped on localhost), custom events via the `track()` helper in `App.jsx`.
- Amplitude analytics (`@amplitude/analytics-browser`, autocapture on, production builds only) initialised in `main.jsx` with the public ingestion key. **Session replay was deliberately dropped**: the aim is improving the app, not watching people. Verify events on the Amplitude Setup page: the first event is `Viewed Home Page`.

## PayPal donations

Hosted donate button `YTQGVLV25V94A`, rendered on the About page by injecting PayPal's donate SDK on demand. Managed from the PayPal dashboard; no repo changes needed to alter the amount or currency.
