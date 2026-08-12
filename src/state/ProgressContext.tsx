import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { store } from "../lib/store.ts";
import { track } from "../lib/analytics.ts";
import { supabase } from "../lib/supabase.ts";
import { BADGES, badgeTier, pointsFor, levelProgress, mergeGamify } from "../gamify.ts";
import { localDay } from "../theory.ts";
import { useAuthSync } from "./AuthSyncContext.tsx";

/* Gamification and practice progress: the durable counters behind points,
   levels and badges, the practice log, their derived stats, the celebrate
   popup, and the cloud merge/push for the gamify column. */

export interface GamifyCounters {
  earCorrect: number;
  earStreakInterval: number;
  earStreakChord: number;
  tourTaken: number;
  triedSimple: number;
  tunings: string[];
  metronomeSeconds: number;
  chordChangesTotal: number;
  chordChangeBest: number;
  bestDayStreak: number;
  [k: string]: number | string[]; // extra/dynamic counters, and interop with mergeGamify
}
export interface Gamify {
  counters: GamifyCounters;
  acked: Record<string, number>; // badge id or "__level" to the tier/level already celebrated
}
export interface PracticeDay {
  total: number; // seconds
  byMode: Record<string, number>;
}
export type PracticeLog = Record<string, PracticeDay>; // "YYYY-MM-DD" to that day

export interface Celebrate {
  type: "badge" | "badges" | "level";
  level?: number;
  name?: string;
  tier?: number;
  tiers?: number;
  count?: number;
}

export interface PracticeStats {
  streak: number;
  week: { k: string; total: number; label: string }[];
  weekTotal: number;
  allTime: number;
  modeRows: [string, number][];
  maxDay: number;
  todayTotal: number;
}

type SavePracticeLog = (next: PracticeLog) => void;

export interface ProgressValue {
  gamify: Gamify;
  setGamify: Dispatch<SetStateAction<Gamify>>;
  practiceLog: PracticeLog;
  setPracticeLog: Dispatch<SetStateAction<PracticeLog>>;
  celebrate: Celebrate | null;
  setCelebrate: Dispatch<SetStateAction<Celebrate | null>>;
  practiceStats: PracticeStats;
  gStats: Record<string, number>;
  gPoints: number;
  gLevel: ReturnType<typeof levelProgress>;
  lastActiveRef: MutableRefObject<number>;
  savePracticeLog: MutableRefObject<SavePracticeLog | null>;
  gamifyReadyRef: MutableRefObject<boolean>;
  progressHydrated: boolean;
}

const ProgressContext = createContext<ProgressValue | null>(null);

const EMPTY_GAMIFY: Gamify = {
  counters: {
    earCorrect: 0,
    earStreakInterval: 0,
    earStreakChord: 0,
    tourTaken: 0,
    triedSimple: 0,
    tunings: [],
    metronomeSeconds: 0,
    chordChangesTotal: 0,
    chordChangeBest: 0,
    bestDayStreak: 0,
  },
  acked: {},
};

export function ProgressProvider({ children }: { children: ReactNode }) {
  const { authUser, progressSynced, syncField, keepaliveGamify } = useAuthSync();
  const [practiceLog, setPracticeLog] = useState<PracticeLog>({});
  const lastActiveRef = useRef(Date.now());
  /* gamification: durable counters that feed points/level/badges, plus `acked`
     (which badge tiers and level have already been celebrated so we do not
     re-toast or re-fire GA on reload). Practice minutes come from practiceLog. */
  const [gamify, setGamify] = useState<Gamify>(EMPTY_GAMIFY);
  const gamifyReadyRef = useRef(false);
  const [celebrate, setCelebrate] = useState<Celebrate | null>(null); // shown as a reward popup
  const [progressHydrated, setProgressHydrated] = useState(false);

  useEffect(() => {
    if (!celebrate) return;
    const t = setTimeout(() => setCelebrate(null), 3600);
    return () => clearTimeout(t);
  }, [celebrate]);

  /* hydrate the practice log and gamify counters once */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await store.get("fretboard:practicelog");
        if (!cancelled && r && r.value) {
          const v = JSON.parse(r.value);
          if (v && typeof v === "object" && !Array.isArray(v)) {
            /* max-merge so this cannot clobber a sign-in merge that raced ahead */
            setPracticeLog((cur) => {
              const merged: PracticeLog = { ...cur };
              for (const [k, dv] of Object.entries(v)) if (!merged[k] || (dv as PracticeDay).total > merged[k].total) merged[k] = dv as PracticeDay;
              return merged;
            });
          }
        }
      } catch (e) {
        /* none yet */
      }
      try {
        const r = await store.get("fretboard:gamify");
        if (!cancelled && r && r.value) {
          const v = JSON.parse(r.value);
          if (v && typeof v === "object") {
            /* max-merge so a counter bumped before this async load resolves is not clobbered */
            setGamify((g) => mergeGamify(g, v) as Gamify);
          }
        }
      } catch (e) {
        /* no progress yet */
      }
      if (!cancelled) setProgressHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* persist gamify only after the initial load, so the empty default never
     overwrites saved progress on mount */
  useEffect(() => {
    if (progressHydrated) store.set("fretboard:gamify", JSON.stringify(gamify)).catch(() => {});
  }, [gamify, progressHydrated]);

  /* persisting the practice log needs the latest syncField without re-running
     the ticker effect, so it lives behind a ref */
  const savePracticeLog = useRef<SavePracticeLog | null>(null);
  useEffect(() => {
    savePracticeLog.current = (next: PracticeLog) => {
      store.set("fretboard:practicelog", JSON.stringify(next)).catch(() => {});
      syncField("practice_log", next);
    };
  }, [syncField]);

  /* only push gamify after the account's copy has been folded in, so an empty
     local default cannot overwrite real server progress before the merge lands */
  const [gamifyMerged, setGamifyMerged] = useState(false);
  useEffect(() => {
    setGamifyMerged(false);
  }, [authUser && authUser.id]);
  /* mirror current values into AuthSync's keepalive registry (its pagehide
     effect closes over mount-time values, so it reads this ref) */
  useEffect(() => {
    keepaliveGamify.current.gamify = gamify;
  }, [gamify, keepaliveGamify]);
  useEffect(() => {
    keepaliveGamify.current.merged = gamifyMerged;
  }, [gamifyMerged, keepaliveGamify]);
  /* sync gamification progress to the account. Kept separate from the main
     sync and self-disabling, so if the `gamify` column has not been added yet
     it fails once quietly rather than nagging or breaking the other syncs. */
  useEffect(() => {
    if (!progressHydrated || !authUser || keepaliveGamify.current.off || !gamifyMerged) return;
    const t = setTimeout(() => {
      supabase
        .from("user_data")
        .upsert({ user_id: authUser.id, gamify, updated_at: new Date().toISOString() })
        .then(({ error }) => {
          if (error && /column|gamify|schema/i.test(error.message || "")) keepaliveGamify.current.off = true;
        });
    }, 900);
    return () => clearTimeout(t);
  }, [gamify, progressHydrated, authUser, gamifyMerged, keepaliveGamify]);

  /* on sign-in, fold the account's saved progress into the local copy (higher
     counters, union of tunings, highest badge tiers). Guarded so a missing
     column cannot break sign-in. */
  useEffect(() => {
    if (!authUser) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.from("user_data").select("gamify").eq("user_id", authUser.id).maybeSingle();
        if (!cancelled && !error && data && data.gamify) setGamify((local) => mergeGamify(local, data.gamify) as Gamify);
      } catch (e) {
        /* the gamify column may not exist yet */
      } finally {
        if (!cancelled) setGamifyMerged(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authUser && authUser.id]);

  /* derived practice stats */
  const practiceStats = useMemo<PracticeStats>(() => {
    const days = Object.keys(practiceLog).sort();
    const today = localDay(new Date());
    let streak = 0;
    for (let i = 0; ; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = localDay(d);
      if (practiceLog[k] && practiceLog[k].total >= 30) streak++;
      else if (k === today)
        continue; // today not practised yet: the streak still stands from yesterday
      else break;
    }
    const week: { k: string; total: number; label: string }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = localDay(d);
      week.push({ k, total: practiceLog[k] ? practiceLog[k].total : 0, label: d.toLocaleDateString("en-GB", { weekday: "short" }) });
    }
    const byMode: Record<string, number> = {};
    let allTime = 0;
    for (const k of days) {
      allTime += practiceLog[k].total;
      for (const [m, sec] of Object.entries(practiceLog[k].byMode || {})) byMode[m] = (byMode[m] || 0) + sec;
    }
    const weekTotal = week.reduce((a, b) => a + b.total, 0);
    const modeRows = Object.entries(byMode).sort((a, b) => b[1] - a[1]) as [string, number][];
    const maxDay = Math.max(60, ...week.map((w) => w.total));
    return { streak, week, weekTotal, allTime, modeRows, maxDay, todayTotal: practiceLog[today] ? practiceLog[today].total : 0 };
  }, [practiceLog]);

  /* the snapshot the gamification module scores: durable counters plus per-mode
     practice minutes derived from the practice log */
  const gStats = useMemo<Record<string, number>>(() => {
    const c = gamify.counters;
    const byMode: Record<string, number> = {};
    for (const day of Object.values(practiceLog))
      for (const [m, sec] of Object.entries(day.byMode || {})) byMode[m] = (byMode[m] || 0) + sec;
    return {
      earCorrect: c.earCorrect || 0,
      earStreakInterval: c.earStreakInterval || 0,
      earStreakChord: c.earStreakChord || 0,
      tourTaken: c.tourTaken || 0,
      triedSimple: c.triedSimple || 0,
      tuningCount: (c.tunings || []).length,
      metronomeMin: Math.floor((c.metronomeSeconds || 0) / 60),
      chordChangeBest: c.chordChangeBest || 0,
      chordChangesTotal: c.chordChangesTotal || 0,
      minScale: Math.floor((byMode.scale || 0) / 60),
      minChord: Math.floor((byMode.chord || 0) / 60),
      minArp: Math.floor((byMode.arp || 0) / 60),
      /* best-ever streak, so the habit badge and points never regress when a streak breaks */
      dayStreak: Math.max(c.bestDayStreak || 0, practiceStats.streak),
      practiceSeconds: practiceStats.allTime,
    };
  }, [gamify.counters, practiceLog, practiceStats.streak, practiceStats.allTime]);

  /* remember the best day streak reached so a missed day cannot drop points */
  useEffect(() => {
    setGamify((g) =>
      practiceStats.streak > (g.counters.bestDayStreak || 0)
        ? { ...g, counters: { ...g.counters, bestDayStreak: practiceStats.streak } }
        : g,
    );
  }, [practiceStats.streak]);

  const gPoints = useMemo(() => pointsFor(gStats), [gStats]);
  const gLevel = useMemo(() => levelProgress(gPoints), [gPoints]);

  /* celebrate newly earned badge tiers and level-ups exactly once. On the first
     pass after load we silently baseline what is already earned so returning
     players are not spammed for past progress. */
  useEffect(() => {
    if (!progressHydrated || !progressSynced) return;
    if (!gamifyReadyRef.current) {
      gamifyReadyRef.current = true;
      setGamify((g) => {
        const a = { ...g.acked };
        let ch = false;
        for (const b of BADGES) {
          const t = badgeTier(b, gStats);
          if (t > (a[b.id] || 0)) {
            a[b.id] = t;
            ch = true;
          }
        }
        if (gLevel.level > (a.__level || 1)) {
          a.__level = gLevel.level;
          ch = true;
        }
        return ch ? { ...g, acked: a } : g;
      });
      return;
    }
    const acked = gamify.acked || {};
    const newly: { b: (typeof BADGES)[number]; tier: number }[] = [];
    for (const b of BADGES) {
      const t = badgeTier(b, gStats);
      if (t > (acked[b.id] || 0)) newly.push({ b, tier: t });
    }
    const levelUp = gLevel.level > (acked.__level || 1);
    if (!newly.length && !levelUp) return;
    setGamify((g) => {
      const a = { ...g.acked };
      for (const { b, tier } of newly) a[b.id] = tier;
      if (levelUp) a.__level = gLevel.level;
      return { ...g, acked: a };
    });
    newly.forEach(({ b, tier }) => track("badge_earned", { badge: b.id, tier }));
    if (levelUp) track("level_up", { level: gLevel.level });
    /* a proper reward moment: a popup that lingers, not just a fleeting toast */
    if (levelUp) setCelebrate({ type: "level", level: gLevel.level });
    else if (newly.length === 1) setCelebrate({ type: "badge", name: newly[0].b.name, tier: newly[0].tier, tiers: newly[0].b.tiers.length });
    else setCelebrate({ type: "badges", count: newly.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gStats, gLevel.level, progressHydrated, progressSynced]);

  const value = useMemo<ProgressValue>(
    () => ({
      gamify,
      setGamify,
      practiceLog,
      setPracticeLog,
      celebrate,
      setCelebrate,
      practiceStats,
      gStats,
      gPoints,
      gLevel,
      lastActiveRef,
      savePracticeLog,
      gamifyReadyRef,
      progressHydrated,
    }),
    [gamify, practiceLog, celebrate, practiceStats, gStats, gPoints, gLevel, progressHydrated],
  );
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressValue {
  const v = useContext(ProgressContext);
  if (!v) throw new Error("useProgress must be used inside <ProgressProvider>");
  return v;
}
