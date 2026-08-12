/* Event helper: forwards to Google Analytics and Amplitude. Each sink has its
   own try/catch so one failing never skips the other, and analytics never
   breaks the app. Amplitude is only present in production (set in main.jsx). */
/* GA4 treats these event-parameter names as manual campaign fields. Sending one
   (e.g. source: "interval") rewrites the session's traffic source and forces a
   new session mid-visit, which splits sessions and destroys attribution. Never
   let an app parameter reach gtag under one of these names. */
export const GA_RESERVED = new Set([
  "source",
  "medium",
  "campaign",
  "term",
  "content",
  "campaign_id",
  "source_platform",
  "creative_format",
  "marketing_tactic",
  "gclid",
]);

type Params = Record<string, unknown>;

interface AnalyticsWindow {
  gtag?: (command: string, name: string, params: Params) => void;
  amplitude?: { track: (name: string, params: Params) => void };
}

export function gaSafeParams(params?: Params): Params {
  if (!params || typeof params !== "object") return params || {};
  let out = params;
  for (const k of Object.keys(params)) {
    if (GA_RESERVED.has(k)) {
      if (out === params) out = { ...params };
      out["app_" + k] = out[k];
      delete out[k];
    }
  }
  return out;
}

export function track(name: string, params?: Params): void {
  const w = typeof window !== "undefined" ? (window as unknown as AnalyticsWindow) : null;
  try {
    /* GA4 gets campaign-safe params; Amplitude keeps the original names */
    if (w && typeof w.gtag === "function") w.gtag("event", name, gaSafeParams(params));
  } catch (e) {
    /* analytics must never break the app */
  }
  try {
    if (w && w.amplitude) w.amplitude.track(name, params || {});
  } catch (e) {
    /* analytics must never break the app */
  }
}
