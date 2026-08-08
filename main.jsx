import React from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import * as amplitude from "@amplitude/analytics-browser";
import App from "./App.jsx";

/* Amplitude ingestion key: public by design, same pattern as the Supabase
   publishable key. An env var overrides it in other environments. Gated to
   production builds so dev sessions never pollute the live project.
   Analytics only: session replay was deliberately dropped; this app gathers
   usage data to improve, not to watch people. */
const AMPLITUDE_KEY = import.meta.env.VITE_AMPLITUDE_API_KEY || "8f37f29448f9a0f68dda4d423b89846c";
if (import.meta.env.PROD && AMPLITUDE_KEY) {
  amplitude.init(AMPLITUDE_KEY, { autocapture: true });
  /* expose the initialised singleton so App.jsx can forward custom events and
     in-app screen views. PROD-only, so dev never touches Amplitude. */
  window.amplitude = amplitude;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
    <Analytics />
  </React.StrictMode>
);
