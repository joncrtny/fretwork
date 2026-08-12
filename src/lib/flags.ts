/* ==========================================================
   FEATURE FLAGS: provider-agnostic core. Pure TypeScript, no React. The only
   I/O is localStorage and the URL, used for local overrides.

   Flag DEFINITIONS mirror the Vercel Flags SDK's flag({ key, description,
   decide }) shape on purpose: adopting that SDK, or a Statsig / Edge Config
   backend, later is a matter of supplying an adapter, not rewriting call sites.

   Resolution precedence, highest first:
     local override  >  adapter (remote)  >  decide(context)  >  first option
   The default adapter is static (returns nothing), so with no backend every
   flag falls through to its offline decide(). That keeps the PWA working with
   no network on the flags path.
   ========================================================== */

export type FlagValue = boolean | string | number;

/* The evaluation context. clientId is a stable anonymous id so a percentage
   rollout puts the same visitor in the same bucket every time, the way a real
   experiment backend would. Extend this (locale, plan, ...) as targeting grows. */
export interface FlagContext {
  clientId: string;
}

export interface FlagOption<T extends FlagValue = FlagValue> {
  value: T;
  label: string;
}

export interface FlagDefinition<T extends FlagValue = FlagValue> {
  key: string;
  description?: string;
  options: FlagOption<T>[];
  /* the offline decision: what this flag is when no backend or override speaks. */
  decide: (ctx: FlagContext) => T;
}

const BOOL_OPTIONS: FlagOption<boolean>[] = [
  { value: false, label: "Off" },
  { value: true, label: "On" },
];

/* Identity helper mirroring the SDK's flag(). Normalises a definition so every
   flag has a decide() and an options list; nothing more. */
export function flag<T extends FlagValue = FlagValue>(def: {
  key: string;
  description?: string;
  options?: FlagOption<T>[];
  decide?: (ctx: FlagContext) => T;
  defaultValue?: T;
}): FlagDefinition<T> {
  const decide = def.decide ?? (() => def.defaultValue as T);
  const options = def.options ?? (BOOL_OPTIONS as unknown as FlagOption<T>[]);
  return { key: def.key, description: def.description, options, decide };
}

/* ---- percentage rollouts -------------------------------------------------- */

/* Deterministic 0..99 bucket for a client. FNV-1a over clientId + salt: cheap,
   stable, and reproducible so a backend could compute the same bucket later. */
export function bucket(clientId: string, salt = ""): number {
  let h = 2166136261;
  const s = clientId + "|" + salt;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 100;
}

/* A decide() that turns a flag on for `percent`% of clients, stably per client.
   Use as the decide for a staged rollout: decide: rolloutDecide(25). */
export function rolloutDecide(percent: number, salt = ""): (ctx: FlagContext) => boolean {
  return (ctx) => bucket(ctx.clientId, salt) < percent;
}

/* ---- adapters ------------------------------------------------------------- */

/* A backend. resolve() returns remote values for the given keys and may be
   async. A Vercel Edge Config or Statsig adapter implements this and nothing
   else in the app changes. */
export interface FlagAdapter {
  resolve: (keys: string[], ctx: FlagContext) => Record<string, FlagValue> | Promise<Record<string, FlagValue>>;
}

/* The default: no backend, so no flag has a remote value. */
export const staticAdapter: FlagAdapter = { resolve: () => ({}) };

/* ---- local overrides (device only) --------------------------------------- */

const OVERRIDE_KEY = "fretwork:flags";
const URL_PREFIX = "ff_";
const CID_KEY = "fretwork:cid";
const ADMIN_KEY = "fretwork:flags-admin";

function coerce(v: string): FlagValue {
  if (v === "on" || v === "true" || v === "1") return true;
  if (v === "off" || v === "false" || v === "0") return false;
  const n = Number(v);
  return v.trim() !== "" && Number.isFinite(n) ? n : v;
}

/* Overrides merged from localStorage then the URL (?ff_<key>=on|off|<value>),
   so a flag can be flipped for a single shareable link. URL wins over storage. */
export function readOverrides(): Record<string, FlagValue> {
  if (typeof window === "undefined") return {};
  const out: Record<string, FlagValue> = {};
  try {
    const raw = window.localStorage.getItem(OVERRIDE_KEY);
    if (raw) Object.assign(out, JSON.parse(raw));
  } catch {
    /* malformed or unavailable storage: ignore */
  }
  try {
    const q = new URLSearchParams(window.location.search);
    for (const [k, v] of q) if (k.startsWith(URL_PREFIX)) out[k.slice(URL_PREFIX.length)] = coerce(v);
  } catch {
    /* no URL access: ignore */
  }
  return out;
}

/* Set (or, with null, clear) a device-local override. Only ever touches the
   localStorage layer; URL overrides are read-only. */
export function writeOverride(key: string, value: FlagValue | null): void {
  if (typeof window === "undefined") return;
  let cur: Record<string, FlagValue>;
  try {
    cur = JSON.parse(window.localStorage.getItem(OVERRIDE_KEY) || "{}");
  } catch {
    cur = {};
  }
  if (value === null) delete cur[key];
  else cur[key] = value;
  try {
    window.localStorage.setItem(OVERRIDE_KEY, JSON.stringify(cur));
  } catch {
    /* storage full or blocked: nothing we can do */
  }
}

/* A stable anonymous id for bucketing, created once and kept on the device.
   Not a tracking id: it never leaves the browser under the static adapter. */
export function stableClientId(): string {
  if (typeof window === "undefined") return "server";
  try {
    let id = window.localStorage.getItem(CID_KEY);
    if (!id) {
      id = window.crypto?.randomUUID ? window.crypto.randomUUID() : String(Math.random()).slice(2);
      window.localStorage.setItem(CID_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

/* The dev flags panel is hidden by default. ?flags on any URL reveals it and
   remembers the choice on the device; there is no way to stumble into it. */
export function flagsPanelEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.has("flags")) {
      window.localStorage.setItem(ADMIN_KEY, "1");
      return true;
    }
    return window.localStorage.getItem(ADMIN_KEY) === "1";
  } catch {
    return false;
  }
}

/* ---- resolution ----------------------------------------------------------- */

export function resolveFlag<T extends FlagValue>(
  def: FlagDefinition<T>,
  ctx: FlagContext,
  remote: Record<string, FlagValue>,
  overrides: Record<string, FlagValue>,
): T {
  if (Object.prototype.hasOwnProperty.call(overrides, def.key)) return overrides[def.key] as T;
  if (Object.prototype.hasOwnProperty.call(remote, def.key)) return remote[def.key] as T;
  return def.decide(ctx);
}
