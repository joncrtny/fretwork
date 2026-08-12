import { useState, type FormEvent } from "react";
import { Field } from "./Field.tsx";
import { track } from "../lib/analytics.ts";
import { supabase, SUPA_URL, SUPA_KEY } from "../lib/supabase.ts";

/* Feedback form posting straight to the Supabase feedback table */
export function FeedbackForm() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  const [trap, setTrap] = useState(""); // honeypot; bots fill it, people never see it

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (trap || !message.trim() || state === "sending") return;
    setState("sending");
    try {
      let uid: string | null = null;
      let bearer = SUPA_KEY;
      try {
        const { data } = await supabase.auth.getSession();
        if (data && data.session) {
          uid = data.session.user.id;
          bearer = data.session.access_token;
        }
      } catch (err) {
        /* signed out */
      }
      const res = await fetch(`${SUPA_URL}/rest/v1/feedback`, {
        method: "POST",
        headers: {
          apikey: SUPA_KEY,
          Authorization: `Bearer ${bearer}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ name: name.trim() || null, message: message.trim(), user_id: uid }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      track("feedback_submit");
      setState("sent");
      setName("");
      setMessage("");
    } catch (err) {
      setState("error");
    }
  };

  if (state === "sent")
    return (
      <div className="feedback">
        <p className="done" role="status">
          Thank you. Your feedback has been sent.
        </p>
        <button className="btn ghost" type="button" onClick={() => setState("idle")}>
          Send another
        </button>
      </div>
    );

  return (
    <form className="feedback" onSubmit={submit}>
      <Field label="Name (optional)">
        <input type="text" aria-label="Name (optional)" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Suggestion or feedback">
        <textarea
          aria-label="Suggestion or feedback"
          value={message}
          required
          maxLength={2000}
          rows={4}
          placeholder="A feature you would like, or something that is not working for you"
          onChange={(e) => setMessage(e.target.value)}
        />
      </Field>
      <input
        type="text"
        value={trap}
        onChange={(e) => setTrap(e.target.value)}
        className="trap"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      <div className="row">
        <button className="btn" type="submit" disabled={state === "sending" || !message.trim()}>
          {state === "sending" ? "Sending" : "Send feedback"}
        </button>
        <p className="empty" role="status" aria-live="polite">
          {state === "error" ? "That did not send. Please try again in a minute." : ""}
        </p>
      </div>
    </form>
  );
}
