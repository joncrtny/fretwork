import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { store } from "../lib/store.ts";
import { track } from "../lib/analytics.ts";
import { useToast } from "./ToastContext.jsx";
import { useAuthSync } from "./AuthSyncContext.jsx";

/* The user's persisted things: Bank saves, known items, custom progressions,
   melodies, chord-change records and routine ratings. Owns their hydration and
   the save callbacks that persist locally and sync to the account. Raw setters
   are exposed too: the sign-in adopt/reset flows write directly. */
const LibraryContext = createContext(null);

export function LibraryProvider({ children }) {
  const { setToast } = useToast();
  const { syncField } = useAuthSync();
  const [bank, setBank] = useState([]);
  const [known, setKnown] = useState([]); // [{ sig, kind, root, id, label }]
  const [routineRatings, setRoutineRatings] = useState({}); // sig -> 1..3
  const [customProgs, setCustomProgs] = useState([]);
  const [melodies, setMelodies] = useState([]);
  const [chgRecords, setChgRecords] = useState({}); // key -> { best, last, tries }
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
    (next) => {
      setBank(next);
      store.set("fretboard:bank", JSON.stringify(next)).catch(() => {});
      syncField("bank", next);
    },
    [syncField],
  );

  const saveKnown = useCallback((next) => {
    setKnown(next);
    store.set("fretboard:known", JSON.stringify(next)).catch(() => {});
  }, []);

  const toggleKnown = useCallback(
    (item) => {
      const exists = known.some((k) => k.sig === item.sig);
      const next = exists ? known.filter((k) => k.sig !== item.sig) : [item, ...known];
      saveKnown(next);
      setToast(exists ? "Removed from what you know" : "Marked as known");
    },
    [known, saveKnown, setToast],
  );

  const saveToBank = useCallback(
    (item) => {
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
    (next) => {
      setCustomProgs(next);
      store.set("fretboard:customprogs", JSON.stringify(next)).catch(() => {});
      syncField("custom_progs", next);
    },
    [syncField],
  );

  const saveMelodies = useCallback(
    (next) => {
      setMelodies(next);
      store.set("fretboard:melodies", JSON.stringify(next)).catch(() => {});
      syncField("melodies", next);
    },
    [syncField],
  );

  const saveChgRecords = useCallback(
    (next) => {
      setChgRecords(next);
      store.set("fretboard:changes", JSON.stringify(next)).catch(() => {});
      syncField("changes", next);
    },
    [syncField],
  );

  const saveRoutineRatings = useCallback((next) => {
    setRoutineRatings(next);
    store.set("fretboard:routineratings", JSON.stringify(next)).catch(() => {});
  }, []);

  const value = useMemo(
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

export function useLibrary() {
  const v = useContext(LibraryContext);
  if (!v) throw new Error("useLibrary must be used inside <LibraryProvider>");
  return v;
}
