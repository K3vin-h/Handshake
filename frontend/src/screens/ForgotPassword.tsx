import { useEffect, useRef, useState, type FormEvent } from "react";
import { HaloField } from "../components/HaloField";
import { StatusMessage } from "../components/StatusMessage";
import { forgot, getAuthConfig } from "../lib/auth";
import { authMessage } from "../lib/authErrors";

export function ForgotPassword() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [netDown, setNetDown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void getAuthConfig().then((r) => {
      setNetDown(!r.ok && r.error === "network");
      setEnabled(r.ok && r.resetEmail);
    });
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setErr("Enter a valid email address.");
      return ref.current?.focus();
    }
    setErr("");
    setBusy(true);
    await forgot(email.trim()); // same answer whatever happens, so the page never reveals which emails have accounts
    setBusy(false);
    setSent(true);
  }

  return (
    <div className="page">
      <form className="auth-wrap auth-card" onSubmit={submit} noValidate>
        <h1>Forgot password</h1>
        <p className="muted auth-lead">Enter your email and we'll send you a link to choose a new password.</p>
        <HaloField id="forgot-email" inputRef={ref} label="Email" type="email" autoComplete="email" value={email} error={err} disabled={enabled === false}
          onChange={(e) => { setEmail(e.target.value); setErr(""); }} />
        <StatusMessage
          kind="info"
          message={netDown ? authMessage("network") : enabled === false ? "Password reset isn't set up on this server." : sent ? "If that address has an account, we sent a link. It works for 30 minutes." : ""}
        />
        <button type="submit" className="cta" disabled={enabled !== true || busy}>
          {busy && <span className="auth-spinner" aria-hidden="true" />}
          Send link
        </button>
        <p className="muted small auth-switch"><a href="#/login">Back to log in</a></p>
      </form>
    </div>
  );
}
