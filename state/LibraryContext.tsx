import { createContext, useCallback, useContext, useEffect, useMemo, useState, type Dispatch, type SetStateAction, type ReactNode } from "react";
import { store } from "../lib/store.ts";
import { track } from "../lib/analytics.ts";
import { useToast } from "./ToastContext.tsx";
import { useAuthSync } from "./AuthSyncContext.tsx";
import type { MelodyStep } from "./SelectionContext.tsx";

/* The user's persisted things: Bank saves, known items, custom progressions,
   melodies, chord-change records and routine ratings. Owns their hydration and
   the save callbacks that persist locally and sync to the account. Raw setters
   are exposed too: the sign-in adopt/reset flows write directly. */

/* A starred item. The common fields are always present; the rest vary by kind
   (a chord saves its voicing, a scale/arp its position, a prog its bars). */
export interface BankItem {
  id: string;
  sig: string;
  kind: string;
  root: number;
  label: string;
  [k: string]: unknown;
}
/* something marked known with the lightbulb, feeding the practice routine */
export interface KnownItem {
  sig: string;
  kind: string;
  root: number;
  id: string;
  label: string;
}
export interface SavedMelody {
  id: string;
  name: string;
  steps: MelodyStep[];
  bars: number;
}
export interface CustomProg {
  id: string;
  name: string;
  note?: string;
  tonality: string;
  bars: string[];
  sections?: Record<string, string>;
}
export interface ChgRecord {
  best: number;
  last: number;
  tries: number;
}

export interface LibraryValue {
  bank: BankItem[];
  setBank: Dispatch<SetStateAction<BankItem[]>>;
  known: KnownItem[];
  setKnown: Dispatch<SetStateAction<KnownItem[]>>;
  routineRatings: Record<string, number>;
  setRoutineRatings: Dispatch<SetStateAction<Record<string, number>>>;
  customProgs: CustomProg[];
  setCustomProgs: Dispatch<SetStateAction<CustomProg[]>>;
  melodies: SavedMelody[];
  setMelodies: Dispatch<SetStateAction<SavedMelody[]>>;
  chgRecords: Record<string, ChgRecord>;
  setChgRecords: Dispatch<SetStateAction<Record<string, ChgRecord>>>;
  saveBank: (next: BankItem[]) => void;
  saveKnown: (next: KnownItem[]) => void;
  toggleKnown: (item: KnownItem) => void;
  saveToBank: (item: BankItem) => void;
  saveCustomProgs: (next: CustomProg[]) => void;
  saveMelodies: (next: SavedMelody[]) => void;
  saveChgRecords: (next: Record<string, ChgRecord>) => void;
  saveRoutineRatings: (next: Record<string, number>) => void;
  libraryHydrated: boolean;
}

const LibraryContext = createContext<LibraryValue | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { setToast } = useToast();
  const { syncField } = useAuthSync();
  const [bank, setBank] = useState<BankItem[]>([]);
  const [known, setKnown] = useState<KnownItem[]>([]); // [{ sig, kind, root, id, label }]
  const [routineRatings, setRoutineRatings] = useState<Record<string, number>>({}); // sig -> 1..3
  const [customProgs, setCustomProgs] = useState<CustomProg[]>([]);
  const [melodies, setMelodies] = useState<SavedMelody[]>([]);
  const [chgRecords, setChgRecords] = useState<Record<string, ChgRecord>>({}); // key -> { best, last, tries }
  const [libraryHydrated, setLibraryHydrated] = useState(false);

  /* hydrate every slice once */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await store.get("fretboard:bank");
        if (!cancelled && r && r.value) {
          const v = JSON.parse(r.value);
          if (Array.isArray(v)) setBank(v);
        }
      } catch (e) {
        /* nothing saved yet */
      }
      try {
        const r = await store.get("fretboard:known");
        if (!cancelled && r && r.value) {
          const v = JSON.parse(r.value);
          if (Array.isArray(v)) setKnown(v);
        }
      } catch (e) {
        /* none yet */
      }
      try {
        const r = await store.get("fretboard:routineratings");
        if (!cancelled && r && r.value) {
          const v = JSON.parse(r.value);
          if (v && typeof v === "object") setRoutineRatings(v);
        }
      } catch (e) {
        /* none yet */
      }
      try {
        const r = await store.get("fretboard:customprogs");
        if (!cancelled && r && r.value) {
          const v = JSON.parse(r.value);
          if (Array.isArray(v)) setCustomProgs(v);
        }
      } catch (e) {
        /* none yet */
      }
      try {
        const r = await store.get("fretboard:melodies");
        if (!cancelled && r && r.value) {
          const v = JSON.parse(r.value);
          if (Array.isArray(v)) setMelodies(v);
        }
      } catch (e) {
        /* none yet */
      }
      try {
        const r = await store.get("fretboard:changes");
        if (!cancelled && r && r.value) {
          const v = JSON.parse(r.value);
          if (v && typeof v === "object") setChgRecords(v);
        }
      } catch (e) {
        /* no change-trainer scores yet */
      }
      if (!cancelled) setLibraryHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveBank = useCallback(
    (next: BankItem[]) => {
      setBank(next);
      store.set("fretboard:bank", JSON.stringify(next)).catch(() => {});
      syncField("bank", next);
    },
    [syncField],
  );

  const saveKnown = useCallback((next: KnownItem[]) => {
    setKnown(next);
    store.set("fretboard:known", JSON.stringify(next)).catch(() => {});
  }, []);

  const toggleKnown = useCallback(
    (item: KnownItem) => {
      const exists = known.some((k) => k.sig === item.sig);
      const next = exists ? known.filter((k) => k.sig !== item.sig) : [item, ...known];
      saveKnown(next);
      setToast(exists ? "Removed from what you know" : "Marked as known");
    },
    [known, saveKnown, setToast],
  );

  const saveToBank = useCallback(
    (item: BankItem) => {
      if (bank.some((b) => b.sig === item.sig)) {
        setToast("Already in your Bank");
        return;
      }
      saveBank([item, ...bank]);
      track("bank_save", { kind: item.kind });
      setToast("Saved to Bank");
    },
    [bank, saveBank, setToast],
  );

  const saveCustomProgs = useCallback(
    (next: CustomProg[]) => {
      setCustomProgs(next);
      store.set("fretboard:customprogs", JSON.stringify(next)).catch(() => {});
      syncField("custom_progs", next);
    },
    [syncField],
  );

  const saveMelodies = useCallback(
    (next: SavedMelody[]) => {
      setMelodies(next);
      store.set("fretboard:melodies", JSON.stringify(next)).catch(() => {});
      syncField("melodies", next);
    },
    [syncField],
  );

  const saveChgRecords = useCallback(
    (next: Record<string, ChgRecord>) => {
      setChgRecords(next);
      store.set("fretboard:changes", JSON.stringify(next)).catch(() => {});
      syncField("changes", next);
    },
    [syncField],
  );

  const saveRoutineRatings = useCallback((next: Record<string, number>) => {
    setRoutineRatings(next);
    store.set("fretboard:routineratings", JSON.stringify(next)).catch(() => {});
  }, []);

  const value = useMemo<LibraryValue>(
    () => ({
      bank,
      setBank,
      known,
      setKnown,
      routineRatings,
      setRoutineRatings,
      customProgs,
      setCustomProgs,
      melodies,
      setMelodies,
      chgRecords,
      setChgRecords,
      saveBank,
      saveKnown,
      toggleKnown,
      saveToBank,
      saveCustomProgs,
      saveMelodies,
      saveChgRecords,
      saveRoutineRatings,
      libraryHydrated,
    }),
    [
      bank,
      known,
      routineRatings,
      customProgs,
      melodies,
      chgRecords,
      saveBank,
      saveKnown,
      toggleKnown,
      saveToBank,
      saveCustomProgs,
      saveMelodies,
      saveChgRecords,
      saveRoutineRatings,
      libraryHydrated,
    ],
  );
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryValue {
  const v = useContext(LibraryContext);
  if (!v) throw new Error("useLibrary must be used inside <LibraryProvider>");
  return v;
}
