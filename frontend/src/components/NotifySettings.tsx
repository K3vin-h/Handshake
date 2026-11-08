import { useState } from "react";
import { subscribe } from "../lib/api";
import { learnerId } from "../lib/learner";
import { isNotifyOn, setNotifyOn } from "../lib/track";

type Props = { enabled?: boolean; userName: string; theirName: string }; // enabled undefined = still loading

/** First word of a name, letters only, as the server accepts it; undefined if nothing is left. */
const firstName = (s: string) => s.replace(/[^\p{L} '-]/gu, " ").trim().split(/\s+/)[0]?.slice(0, 40) || undefined;

export function NotifySettings({ enabled, userName, theirName }: Props) {
  const [contactEmail, setContactEmail] = useState("");
  const [learnerEmail, setLearnerEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [on, setOn] = useState(isNotifyOn);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  if (enabled === undefined) return <section><h2>Notifications</h2><p role="status">Loading…</p></section>;
  if (!enabled && !on) return <section><h2>Notifications</h2><p>Notifications aren't set up on this server.</p></section>;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !consent || !(contactEmail || learnerEmail)) return;
    setBusy(true);
    try {
      const r = await subscribe({
        action: "subscribe", learnerId: learnerId(), consent: true, userName: firstName(userName), theirName: firstName(theirName),
        ...(contactEmail && { contactEmail }), ...(learnerEmail && { learnerEmail }),
      });
      if (!r.ok) throw new Error(r.reason);
      setNotifyOn(true);
      setOn(true);
      setStatus(contactEmail
        ? "Saved. Your contact must open the confirmation email and confirm before lesson updates can be sent. If no email arrives, try again later. You can stop notifications any time."
        : "Saved. Weekly recaps are requested for your own email address. Delivery depends on the configured automation. You can stop notifications any time.");
    } catch {
      setStatus("Couldn't save. Check the emails and try again, or try again later.");
    } finally { setBusy(false); }
  }

  async function stop() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await subscribe({ action: "unsubscribe", learnerId: learnerId() });
      if (!r.ok) throw new Error(r.reason);
      setNotifyOn(false);
      setOn(false);
      setStatus("Notifications stopped.");
    } catch {
      setStatus("Couldn't stop notifications. Try again.");
    } finally { setBusy(false); }
  }

  return (
    <section aria-labelledby="notify-h">
      <h2 id="notify-h">Notifications</h2>
      <p>The person you are learning for must confirm their email before receiving lesson updates. They can unsubscribe from any update without opening the app.</p>
      <p>Weekly recaps are for your own email address only. That address is not verified yet.</p>
      <form onSubmit={save}>
        {enabled && <><label>
          Email of the person you're learning for (optional)
          <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} autoComplete="off" />
        </label>
        <label>
          Your email for a weekly recap (optional)
          <input type="email" value={learnerEmail} onChange={(e) => setLearnerEmail(e.target.value)} autoComplete="email" />
        </label>
        <label className="check">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          Send my first name, their first name and these emails to our n8n automation
        </label>
        <button type="submit" disabled={busy || !consent || !(contactEmail || learnerEmail)} aria-describedby="notify-hint">Save</button>
        <span id="notify-hint" className="muted"> Tick the box and enter at least one email.</span></>}
        {(on || enabled) && <button type="button" disabled={busy} onClick={stop}>Stop notifications</button>}
      </form>
      <p role="status" aria-live="polite">{status}</p>
    </section>
  );
}
