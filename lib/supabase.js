import { createClient } from "@supabase/supabase-js";

/* Supabase endpoint. The publishable key is a public client key by design;
   env vars override it in other environments. */
export const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || "https://wibxytuvqcihbczlwjqq.supabase.co";

export const SUPA_KEY = import.meta.env.VITE_SUPABASE_KEY || "sb_publishable_lqSKKddY4wNxxe2cpbLq3Q_aD_aF92x";

export const supabase = createClient(SUPA_URL, SUPA_KEY);

/* Supabase Auth requires an email field, so usernames get a synthesized
   address at a domain we control. No mail is ever sent to it. */
export const FAKE_MAIL = "@u.fretwork-practice.app";

/* Where Supabase auth emails (email linking, password reset) should land the
   user. Always the canonical production domain from any deployment, so a
   confirmation opened from a vercel.app preview or the raw project URL still
   returns to www.fretwork-practice.app. Localhost stays local for dev testing.
   The target must also be on Supabase's Redirect URLs allowlist. */
export const CANONICAL_URL = "https://www.fretwork-practice.app";

export const authRedirect = () => {
  if (typeof window === "undefined") return CANONICAL_URL;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" ? window.location.origin : CANONICAL_URL;
};
