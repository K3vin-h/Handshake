import { useEffect, useRef, useState, type FormEvent } from "react";
import { HaloField } from "../components/HaloField";
import { StatusMessage } from "../components/StatusMessage";
import { forgot, getAuthConfig } from "../lib/auth";

export function ForgotPassword() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void getAuthConfig().then((r) => setEnabled(r.ok && r.resetEmail));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setErr("Enter a valid email address.");
      return ref.current?.focus();
    }
    setErr("");
    await forgot(email.trim()); // same answer whatever happens, so the page never reveals which emails have accounts
    setSent(true);
  }

  return (
    <div className="page">
      <form className="auth-card" onSubmit={submit} noValidate>
        <h1>Forgot password</h1>
        <HaloField id="forgot-email" inputRef={ref} label="Email" type="email" autoComplete="email" value={email} error={err} disabled={enabled === false}
          onChange={(e) => { setEmail(e.target.value); setErr(""); }} />
        <StatusMessage
          kind="info"
          message={enabled === false ? "Password reset isn't set up on this server." : sent ? "If that address has an account, we sent a link. It works for 30 minutes." : ""}
        />
        <button type="submit" className="cta" disabled={enabled !== true}>Send link</button>
        <p className="muted small auth-switch"><a href="#/login">Back to log in</a></p>
      </form>
    </div>
  );
}
