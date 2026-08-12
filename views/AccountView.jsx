import { useState } from "react";
import { Seg } from "../components/Seg.jsx";
import { Field } from "../components/Field.jsx";
import { track } from "../lib/analytics.ts";
import { store } from "../lib/store.ts";
import { supabase, FAKE_MAIL, authRedirect } from "../lib/supabase.ts";
import { usernameProblem } from "../lib/username.ts";
import { isNetErr } from "../lib/utils.ts";
import { useAuthSync } from "../state/AuthSyncContext.tsx";
import { useLibrary } from "../state/LibraryContext.tsx";
import { useProgress } from "../state/ProgressContext.jsx";
import { useToast } from "../state/ToastContext.tsx";

/* The account view: username-only sign in / create account over Supabase,
   optional email linking for recovery, password reset, and sign out (which
   also clears this account's local data). The session itself lives in
   AuthSyncContext; only the form state is local here. */
export function AccountView() {
  const { authUser, uname, linkedEmail, recoveryMode, setRecoveryMode, flushSync, keepaliveGamify } = useAuthSync();
  const { setBank, setCustomProgs, setMelodies, setChgRecords } = useLibrary();
  const { setGamify, setPracticeLog, gamifyReadyRef } = useProgress();
  const { setToast } = useToast();

  /* ---- account (form state; the session itself lives in AuthSyncContext) ---- */
  const [authMode, setAuthMode] = useState("create"); // signin | create
  const [authName, setAuthName] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authErr, setAuthErr] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [linkEmail, setLinkEmail] = useState("");
  const [linkState, setLinkState] = useState("idle"); // idle | busy | sent | err
  const [newPass, setNewPass] = useState("");

  const doAuth = async (e) => {
    e.preventDefault();
    setAuthErr("");
    const name = authName.trim();
    if (authMode === "create") {
      const prob = usernameProblem(name);
      if (prob) return setAuthErr(prob);
      if (authPass.length < 8) return setAuthErr("Password needs at least 8 characters.");
      setAuthBusy(true);
      const { error } = await supabase.auth.signUp({
        email: name.toLowerCase() + FAKE_MAIL,
        password: authPass,
        options: { data: { username: name } },
      });
      setAuthBusy(false);
      if (error)
        return setAuthErr(
          isNetErr(error)
            ? "Could not reach the server. Check your connection and try again."
            : /already|registered/i.test(error.message)
              ? "That username is taken."
              : error.message,
        );
      track("sign_up");
      setToast("Account created");
    } else {
      setAuthBusy(true);
      const email = name.includes("@") ? name : name.toLowerCase() + FAKE_MAIL;
      const { error } = await supabase.auth.signInWithPassword({ email, password: authPass });
      setAuthBusy(false);
      if (error)
        return setAuthErr(
          isNetErr(error) ? "Could not reach the server. Check your connection and try again." : "Wrong username or password.",
        );
      track("sign_in");
    }
    setAuthName("");
    setAuthPass("");
  };

  const doSignOut = async () => {
    await flushSync();
    await supabase.auth.signOut();
    track("sign_out");
    /* clear this account's data locally so it cannot bleed into the next
       sign-in on the same browser (the server copy was just flushed) */
    setGamify({
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
      },
      acked: {},
    });
    setPracticeLog({});
    setBank([]);
    setChgRecords({});
    setCustomProgs([]);
    setMelodies([]);
    gamifyReadyRef.current = false;
    keepaliveGamify.current.off = false;
    store.set("fretboard:gamify", JSON.stringify({ counters: {}, acked: {} })).catch(() => {});
    store.set("fretboard:practicelog", "{}").catch(() => {});
    store.set("fretboard:bank", "[]").catch(() => {});
    store.set("fretboard:changes", "{}").catch(() => {});
    store.set("fretboard:customprogs", "[]").catch(() => {});
    store.set("fretboard:melodies", "[]").catch(() => {});
    setAuthMode("signin");
    setLinkEmail("");
    setLinkState("idle");
    setRecoveryMode(false);
    setToast("Signed out");
  };

  const [linkErrMsg, setLinkErrMsg] = useState("");
  const doLinkEmail = async (e) => {
    e.preventDefault();
    const em = linkEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(em) || em.endsWith(FAKE_MAIL)) {
      setLinkErrMsg("That does not look like a usable email address.");
      return setLinkState("err");
    }
    setLinkState("busy");
    const { error } = await supabase.auth.updateUser({ email: em }, { emailRedirectTo: authRedirect() });
    if (error) {
      setLinkErrMsg(
        isNetErr(error)
          ? "Could not reach the server. Try again when you are online."
          : /already|registered|exists/i.test(error.message)
            ? "That address is already in use."
            : "That did not work. Check the address and try again.",
      );
      return setLinkState("err");
    }
    track("email_linked");
    setLinkState("sent");
  };

  /* forgot password: needs a linked email, sends the Supabase recovery mail */
  const doForgot = async () => {
    const name = authName.trim();
    if (!name.includes("@")) {
      setAuthErr("Recovery needs a linked email. Enter that email address above, then press Forgot password.");
      return;
    }
    setAuthBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(name.toLowerCase(), {
      redirectTo: authRedirect(),
    });
    setAuthBusy(false);
    if (error && isNetErr(error)) {
      setAuthErr("Could not reach the server. Check your connection and try again.");
      return;
    }
    setAuthErr("");
    setToast("If that address is linked to an account, a reset email is on its way");
  };

  /* recovery redirect lands signed in; the user sets a fresh password */
  const doSetNewPassword = async (e) => {
    e.preventDefault();
    if (newPass.length < 8) return setAuthErr("Password needs at least 8 characters.");
    setAuthBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPass });
    setAuthBusy(false);
    if (error) return setAuthErr(error.message);
    setAuthErr("");
    setNewPass("");
    setRecoveryMode(false);
    setToast("Password updated");
  };

  return (
    <div className="pane about">
      {!authUser ? (
        <section className="aboutblock">
          <h2 className="abouthead">{authMode === "create" ? "Create an account" : "Sign in"}</h2>
          <p className="note">
            An account syncs your Bank (saved chords and progressions) and your chord-change records across devices. Everything also works
            without one, saved on this device only.
          </p>
          <Seg
            small
            ariaLabel="Sign in or create account"
            options={[
              { v: "signin", l: "Sign in" },
              { v: "create", l: "Create account" },
            ]}
            value={authMode}
            onChange={(v) => {
              setAuthMode(v);
              setAuthErr("");
            }}
          />
          {authMode === "create" && (
            <div className="warnbox" role="note">
              <b>No email is required, so no recovery is possible.</b> If you lose your password, this account cannot be recovered. You can
              link an email later to enable recovery.
            </div>
          )}
          <form className="authform" onSubmit={doAuth}>
            <Field id="auth-name" label={authMode === "create" ? "Choose a username" : "Username (or linked email)"}>
              <input
                id="auth-name"
                type="text"
                value={authName}
                autoComplete="username"
                maxLength={80}
                onChange={(e) => setAuthName(e.target.value)}
              />
            </Field>
            <Field id="auth-pass" label="Password">
              <input
                id="auth-pass"
                type="password"
                value={authPass}
                autoComplete={authMode === "create" ? "new-password" : "current-password"}
                maxLength={100}
                onChange={(e) => setAuthPass(e.target.value)}
              />
            </Field>
            <div className="row">
              <button className="btn primary" type="submit" disabled={authBusy || !authName.trim() || !authPass}>
                {authBusy ? "Working" : authMode === "create" ? "Create account" : "Sign in"}
              </button>
              {authMode === "signin" && (
                <button className="btn ghost" type="button" onClick={doForgot} disabled={authBusy}>
                  Forgot password
                </button>
              )}
            </div>
            <p className="empty" role="status" aria-live="polite">
              {authErr}
            </p>
          </form>
        </section>
      ) : (
        <>
          {recoveryMode && (
            <section className="aboutblock">
              <h2 className="abouthead">Set a new password</h2>
              <form className="authform" onSubmit={doSetNewPassword}>
                <Field id="new-pass" label="New password">
                  <input
                    id="new-pass"
                    type="password"
                    value={newPass}
                    autoComplete="new-password"
                    maxLength={100}
                    onChange={(e) => setNewPass(e.target.value)}
                  />
                </Field>
                <div className="row">
                  <button className="btn primary" type="submit" disabled={authBusy || !newPass}>
                    {authBusy ? "Working" : "Save new password"}
                  </button>
                  <p className="empty" role="status" aria-live="polite">
                    {authErr}
                  </p>
                </div>
              </form>
            </section>
          )}
          <section className="aboutblock">
            <h2 className="abouthead">Account</h2>
            <p className="note">
              Signed in as <b className="unamechip">{uname}</b>. Your Bank and chord-change records sync to this account automatically.
            </p>
            <div className="row">
              <button className="btn ghost danger" onClick={doSignOut}>
                Sign out
              </button>
            </div>
          </section>
          <section className="aboutblock">
            <h2 className="abouthead">Account recovery</h2>
            {linkedEmail ? (
              <p className="note">
                Recovery email linked: <b>{linkedEmail}</b>. Sign in with this address. If you lose your password, use Forgot password on
                the sign-in screen to reset it by email.
              </p>
            ) : authUser.new_email ? (
              <p className="note">
                Email change pending for <b>{authUser.new_email}</b>. Click the link in that email to complete it. Until then, keep signing
                in with your username.
              </p>
            ) : (
              <>
                <p className="note">
                  No email is linked, so this account cannot be recovered if the password is lost. Linking is optional. Once confirmed, you
                  sign in with the address instead of your username, and password reset by email becomes available.
                </p>
                <form className="authform" onSubmit={doLinkEmail}>
                  <Field id="link-email" label="Email address">
                    <input
                      id="link-email"
                      type="email"
                      value={linkEmail}
                      autoComplete="email"
                      maxLength={120}
                      onChange={(e) => setLinkEmail(e.target.value)}
                    />
                  </Field>
                  <div className="row">
                    <button className="btn" type="submit" disabled={linkState === "busy" || !linkEmail.trim()}>
                      {linkState === "busy" ? "Sending" : "Link email"}
                    </button>
                    <p className={linkState === "err" ? "empty" : "note"} role="status" aria-live="polite">
                      {linkState === "sent"
                        ? "Confirmation requested. If the email arrives, click its link to complete the change."
                        : linkState === "err"
                          ? linkErrMsg
                          : ""}
                    </p>
                  </div>
                </form>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
