import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  resolveFlag,
  readOverrides,
  writeOverride,
  stableClientId,
  staticAdapter,
  type FlagAdapter,
  type FlagContext as FlagCtx,
  type FlagDefinition,
  type FlagValue,
} from "../lib/flags.ts";

/* The flags provider. Resolves once at boot: builds the eval context, pulls
   remote values from the adapter (the static default resolves to {} with no
   network, so offline is unaffected), and reads device-local overrides. Exposes
   useFlag for gating and a small admin surface for the dev panel.

   Placed outermost in the provider tree so SettingsContext can read a flag when
   it decides a first-run visitor's Simple default. */

interface FlagsValue {
  get: <T extends FlagValue>(def: FlagDefinition<T>) => T;
  overrides: Record<string, FlagValue>;
  setOverride: (key: string, value: FlagValue | null) => void;
}

const FlagsContext = createContext<FlagsValue | null>(null);

export function FlagsProvider({ adapter = staticAdapter, children }: { adapter?: FlagAdapter; children: ReactNode }) {
  const ctx = useMemo<FlagCtx>(() => ({ clientId: stableClientId() }), []);
  const [remote, setRemote] = useState<Record<string, FlagValue>>({});
  const [overrides, setOverrides] = useState<Record<string, FlagValue>>(() => readOverrides());

  /* pull remote values once; never block render on it */
  useEffect(() => {
    let cancelled = false;
    Promise.resolve(adapter.resolve([], ctx))
      .then((r) => {
        if (!cancelled && r) setRemote(r);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [adapter, ctx]);

  const setOverride = useCallback((key: string, value: FlagValue | null) => {
    writeOverride(key, value);
    setOverrides(readOverrides());
  }, []);

  const get = useCallback(
    <T extends FlagValue>(def: FlagDefinition<T>): T => resolveFlag(def, ctx, remote, overrides),
    [ctx, remote, overrides],
  );

  const value = useMemo<FlagsValue>(() => ({ get, overrides, setOverride }), [get, overrides, setOverride]);
  return <FlagsContext.Provider value={value}>{children}</FlagsContext.Provider>;
}

export function useFlags(): FlagsValue {
  const v = useContext(FlagsContext);
  if (!v) throw new Error("useFlags must be used inside <FlagsProvider>");
  return v;
}

/* Read one flag's resolved value. Re-renders when an override or a remote
   value changes. */
export function useFlag<T extends FlagValue>(def: FlagDefinition<T>): T {
  return useFlags().get(def);
}
