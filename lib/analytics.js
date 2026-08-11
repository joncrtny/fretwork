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

export function gaSafeParams(params) {
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

export function track(name, params) {
  try {
    /* GA4 gets campaign-safe params; Amplitude keeps the original names */
    if (typeof window !== "undefined" && typeof window.gtag === "function") window.gtag("event", name, gaSafeParams(params));
  } catch (e) {
    /* analytics must never break the app */
  }
  try {
    if (typeof window !== "undefined" && window.amplitude) window.amplitude.track(name, params || {});
  } catch (e) {
    /* analytics must never break the app */
  }
}
