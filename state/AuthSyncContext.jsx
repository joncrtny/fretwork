import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase, SUPA_URL, SUPA_KEY, FAKE_MAIL } from "../lib/supabase.ts";
import { useToast } from "./ToastContext.tsx";

/* Auth session and the sync plumbing: who is signed in, the debounced
   field-sync to the user_data row, and the pagehide keepalive flush. Local
   storage stays the source of truth when signed out. */
const AuthSyncContext = createContext(null);

export function AuthSyncProvider({ children }) {
  const { setToast } = useToast();
  const [authUser, setAuthUser] = useState(null);
  /* true once there is nothing left to reconcile: signed out, or the sign-in
     merge has finished. The badge baseline waits for this so a returning player
     on a fresh device is not spammed with toasts for already-earned progress. */
  const [progressSynced, setProgressSynced] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const syncTimers = useRef({});
  const authTokenRef = useRef(null);
  const uidRef = useRef(null);
  /* keepalive registry: gamification mirrors written by the progress layer,
     read by the pagehide flush below (the effect closes over mount-time values,
     so it reads refs, not state) */
  const keepaliveGamify = useRef({ gamify: null, merged: false, off: false });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      authTokenRef.current = data.session ? data.session.access_token : null;
      setAuthUser(data.session ? data.session.user : null);
      if (!data.session) setProgressSynced(true);
    });
    const { data } = supabase.auth.onAuthStateChange((evt, session) => {
      authTokenRef.current = session ? session.access_token : null;
      setAuthUser(session ? session.user : null);
      if (!session) setProgressSynced(true);
      /* the app shell watches recoveryMode and navigates to the account view */
      if (evt === "PASSWORD_RECOVERY") setRecoveryMode(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    uidRef.current = authUser ? authUser.id : null;
  }, [authUser]);

  const uname = authUser ? authUser.user_metadata?.username || (authUser.email || "").split("@")[0] : null;
  const linkedEmail = authUser && authUser.email && !authUser.email.endsWith(FAKE_MAIL) ? authUser.email : null;

  /* push a field to the synced row, debounced; local storage stays the source
     of truth when signed out */
  const syncField = useCallback(
    (field, value) => {
      if (!authUser) return;
      const prev = syncTimers.current[field];
      if (prev) clearTimeout(prev.timer);
      const entry = { value, uid: authUser.id };
      entry.timer = setTimeout(() => {
        delete syncTimers.current[field];
        supabase
          .from("user_data")
          .upsert({ user_id: entry.uid, [field]: value, updated_at: new Date().toISOString() })
          .then(({ error }) => {
            if (error && authTokenRef.current) setToast("Sync failed, saved locally");
          });
      }, 700);
      syncTimers.current[field] = entry;
    },
    [authUser, setToast],
  );

  /* run any pending debounced syncs immediately (sign-out, page hide) */
  const flushSync = useCallback(async () => {
    const entries = Object.entries(syncTimers.current);
    syncTimers.current = {};
    await Promise.all(
      entries.map(([field, entry]) => {
        clearTimeout(entry.timer);
        return supabase.from("user_data").upsert({ user_id: entry.uid, [field]: entry.value, updated_at: new Date().toISOString() });
      }),
    );
  }, []);

  /* on page hide, push pending syncs with keepalive requests that outlive the tab */
  useEffect(() => {
    const onHide = () => {
      const token = authTokenRef.current;
      const entries = Object.entries(syncTimers.current);
      syncTimers.current = {};
      if (!token) return;
      for (const [field, entry] of entries) {
        clearTimeout(entry.timer);
        fetch(`${SUPA_URL}/rest/v1/user_data?on_conflict=user_id`, {
          method: "POST",
          keepalive: true,
          headers: {
            apikey: SUPA_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates",
          },
          body: JSON.stringify({ user_id: entry.uid, [field]: entry.value, updated_at: new Date().toISOString() }),
        }).catch(() => {});
      }
      /* flush the latest gamify too (its sync is a bare debounce, not in syncTimers) */
      const g = keepaliveGamify.current;
      if (uidRef.current && g.merged && !g.off) {
        fetch(`${SUPA_URL}/rest/v1/user_data?on_conflict=user_id`, {
          method: "POST",
          keepalive: true,
          headers: {
            apikey: SUPA_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates",
          },
          body: JSON.stringify({ user_id: uidRef.current, gamify: g.gamify, updated_at: new Date().toISOString() }),
        }).catch(() => {});
      }
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  const value = useMemo(
    () => ({
      authUser,
      uname,
      linkedEmail,
      progressSynced,
      setProgressSynced,
      recoveryMode,
      setRecoveryMode,
      syncField,
      flushSync,
      authTokenRef,
      keepaliveGamify,
    }),
    [authUser, uname, linkedEmail, progressSynced, recoveryMode, syncField, flushSync],
  );
  return <AuthSyncContext.Provider value={value}>{children}</AuthSyncContext.Provider>;
}

export function useAuthSync() {
  const v = useContext(AuthSyncContext);
  if (!v) throw new Error("useAuthSync must be used inside <AuthSyncProvider>");
  return v;
}
