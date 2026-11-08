import { useRef, useState, type FormEvent } from "react";
import { HaloField } from "../components/HaloField";
import { StatusMessage } from "../components/StatusMessage";
import { resetPassword } from "../lib/auth";
import { authMessage } from "../lib/authErrors";

export function ResetPassword() {
  const raw = location.hash.replace(/^#\/reset\//, "");
  let token = raw;
  try { token = decodeURIComponent(raw); } catch { /* malformed escape: use the raw value */ }
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [fieldErr, setFieldErr] = useState("");
  const [formErr, setFormErr] = useState("");
  const [done, setDone] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setFormErr("");
    if (password.length < 10) {
      setFieldErr(authMessage("weak_password"));
      return ref.current?.focus();
    }
    setFieldErr("");
    setBusy(true);
    const r = await resetPassword(token, password);
    setBusy(false);
    if (r.ok) return setDone(true);
    if (r.error === "weak_password" || r.error === "breached_password") {
      setFieldErr(authMessage(r.error));
      return ref.current?.focus();
    }
    setFormErr(authMessage(r.error));
  }

  if (done) {
    return (
      <div className="page">
        <div className="auth-card">
          <h1>Reset password</h1>
          <StatusMessage kind="match" label={false} message="Password changed." />
          <p><a href="#/login">Log in</a></p>
        </div>
      </div>
    );
  }
  return (
    <div className="page">
      <form className="auth-card" onSubmit={submit} noValidate>
        <h1>Reset password</h1>
        <div className="auth-pw">
          <HaloField id="reset-password" inputRef={ref} label="New password" type={show ? "text" : "password"} autoComplete="new-password"
            description="At least 10 characters." value={password} error={fieldErr} onChange={(e) => { setPassword(e.target.value); setFieldErr(""); }} />
          <button type="button" className="secondary auth-toggle" aria-pressed={show} onClick={() => setShow(!show)}>
            {show ? "Hide password" : "Show password"}
          </button>
        </div>
        <StatusMessage kind="error" label={false} message={formErr || fieldErr} />
        <button type="submit" className="cta" disabled={busy}>Change password</button>
        <p className="muted small auth-switch"><a href="#/forgot">Ask for a new link</a></p>
      </form>
    </div>
  );
}
