# Feature flags

A small, provider-agnostic flag system (Phase 8). It is client-side and
offline-first: with no backend, every flag resolves from its own `decide()`, so
the PWA never waits on the network to render. The flag definitions are shaped
like the Vercel Flags SDK on purpose, so moving to that SDK, or to Statsig or
Edge Config, is a matter of supplying an adapter, not rewriting call sites.

## The pieces

- `src/lib/flags.ts`: the pure core. `flag()`, resolution, percentage rollouts,
  the `FlagAdapter` seam, and the local override layer (localStorage + URL).
- `src/flags.ts`: the registry. Every flag is declared here and added to
  `ALL_FLAGS` so the dev panel can list it.
- `src/state/FlagsContext.tsx`: `FlagsProvider` (the outermost provider) plus
  `useFlag` / `useFlags`.
- `src/components/FlagsPanel.tsx`: the dev-only panel in Settings.

## Resolution precedence

Highest wins:

1. **Local override**: a `?ff_<key>=` URL param, or a value saved on the device
   by the dev panel.
2. **Remote**: whatever the adapter returned (nothing, under the default static
   adapter).
3. **`decide(ctx)`**: the flag's own offline default.

## Adding a flag

1. Declare it in `src/flags.ts` and add it to `ALL_FLAGS`:

   ```ts
   export const showTempoRamp = flag<boolean>({
     key: "tempo-ramp",
     description: "Metronome tempo ramping.",
     decide: () => false, // off until we roll it out
   });

   export const ALL_FLAGS: FlagDefinition[] = [simpleDefault, showTempoRamp];
   ```

2. Gate on it where the feature lives, with `useFlag`, never an ad-hoc env check:

   ```ts
   import { useFlag } from "../state/FlagsContext.tsx";
   import { showTempoRamp } from "../flags.ts";

   const rampOn = useFlag(showTempoRamp);
   // ...
   {rampOn && <TempoRamp />}
   ```

   `useFlag` re-renders when an override or a remote value changes. If a flag
   must be read before render (like `simpleDefault` in `SettingsContext`'s
   first-run initializer), read it in the component body and use the value in the
   `useState` initializer; the static adapter resolves synchronously, so the
   first render already has the right value.

Flags are not limited to booleans. `FlagValue` is `boolean | string | number`;
pass `options` for a multi-value flag so the panel can render them:

```ts
export const pricingLayout = flag<"control" | "treatment">({
  key: "pricing-layout",
  options: [
    { value: "control", label: "Control" },
    { value: "treatment", label: "Treatment" },
  ],
  decide: () => "control",
});
```

## Rollouts

`decide()` can do anything, so a staged rollout is just a decision function.
`rolloutDecide(percent)` turns a flag on for a stable percentage of clients,
bucketed by a per-device id so a given visitor's experience does not flip
between reloads:

```ts
import { flag, rolloutDecide } from "./lib/flags.ts";

export const showTempoRamp = flag<boolean>({
  key: "tempo-ramp",
  description: "Metronome tempo ramping.",
  decide: rolloutDecide(25), // 25% of visitors, deterministically
});
```

To run the rollout across users today, change `decide()` (or the percent) and
deploy. To change it without a deploy, drive it from a backend (below).

## Testing a flag locally

- `?ff_<key>=on` / `off` / a value forces one flag for a single link. A bare
  `?ff_<key>` (no `=`) reads as on.
- `?flags` on any URL reveals the dev panel in Settings, and remembers the choice
  on the device. The panel toggles are device-local overrides; a flag currently
  forced by a `?ff_` link is shown read-only, because the URL wins over the local
  layer.

## Wiring a backend (Statsig, Edge Config, ...)

Implement one `FlagAdapter` and pass it to the provider. Nothing else changes:
call sites still use `useFlag(def)`, and a flag with no remote value still falls
through to its `decide()`, so the app stays working if the backend is slow or
down.

```ts
// src/lib/adapters/statsig.ts (sketch)
import type { FlagAdapter, FlagContext, FlagValue } from "../flags.ts";

export function statsigAdapter(sdkKey: string): FlagAdapter {
  return {
    async resolve(_keys: string[], ctx: FlagContext): Promise<Record<string, FlagValue>> {
      // fetch this client's flag set from the backend, keyed off ctx.clientId,
      // and return { "tempo-ramp": true, ... }. Backends of this shape pull the
      // whole set as a datafile, which is why the key list is not used.
      return {};
    },
  };
}
```

```tsx
// src/App.tsx
<FlagsProvider adapter={statsigAdapter(import.meta.env.VITE_STATSIG_KEY)}>
```

Notes:

- The adapter runs once at boot and must never block render; the provider already
  treats it as async and swallows failures.
- `ctx.clientId` is a stable anonymous id kept on the device (`fretwork:cid`). It
  never leaves the browser under the static adapter; a backend adapter is the
  thing that would send it, so treat it accordingly.
- For a real Vercel Edge Config or Flags SDK setup you would add a small
  `/api/flags` function to read the config server-side and have the adapter fetch
  it; the app is a static SPA today, so that function does not exist yet.
