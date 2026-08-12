import { flag, type FlagDefinition } from "./lib/flags.ts";

/* ==========================================================
   THE FLAG REGISTRY. Declare a flag here, gate on it with useFlag(def), and it
   appears in the dev flags panel automatically. Each decide() is the offline
   default; a backend adapter (Vercel Edge Config, Statsig, ...) can override it
   later without touching any call site.
   ========================================================== */

/* Whether a brand-new visitor starts in Simple mode (a trimmed menu). The
   current onboarding default is on, so decide() returns true; flip it, or run a
   staged rollout with rolloutDecide(percent), to experiment with starting new
   users in the full app instead. Consumed by SettingsContext's first-run init. */
export const simpleDefault = flag<boolean>({
  key: "simple-default",
  description: "New visitors start in Simple mode.",
  decide: () => true,
});

/* Everything the dev flags panel lists. Keep new flags in this array. */
export const ALL_FLAGS: FlagDefinition[] = [simpleDefault];
