import { useEffect, useRef, useState, type FormEvent } from "react";
import { getAuthConfig, logIn, loginWithGoogle, signUp } from "../lib/auth";
import { authErrorField, authMessage } from "../lib/authErrors";
import { syncNow } from "../lib/sync";
import { GoogleButton } from "./GoogleButton";
import { HaloField } from "./HaloField";
import { StatusMessage } from "./StatusMessage";

type Cfg = { accounts: boolean; googleClientId: string | null };
type Errs = { email?: string; password?: string; form?: string };

/** Shared sign-up / log-in card. Never stores or logs the password. */
export function AuthCard({ mode, onDone, headingLevel = 1 }: { mode: "signup" | "login"; onDone(): void; headingLevel?: 1 | 2 }) {
  const H = headingLevel === 1 ? "h1" : "h2";
  const signup = mode === "signup";
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [errs, setErrs] = useState<Errs>({});
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void getAuthConfig().then((r) => setCfg(r.ok ? r : { accounts: false, googleClientId: null }));
  }, []);

  function fail(code: string, source?: "google") {
    const f = authErrorField(code);
    setErrs({ [f]: authMessage(code, source) });
    (f === "email" ? emailRef : f === "password" ? pwRef : null)?.current?.focus();
  }

  // busy stays true through syncNow and onDone, so a second click cannot re-run signUp.
  async function finish(r: { ok: true } | { ok: false; error: string }, source?: "google") {
    if (!r.ok) {
      setBusy(false);
      return fail(r.error, source);
    }
    await syncNow();
    onDone();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setErrs({ email: "Enter a valid email address." });
      return emailRef.current?.focus();
    }
    if (!password) {
      setErrs({ password: "Enter your password." });
      return pwRef.current?.focus();
    }
    if (signup && password.length < 10) return fail("weak_password");
    setErrs({});
    setBusy(true);
    await finish(await (signup ? signUp : logIn)(email.trim(), password));
  }

  async function google(credential: string) {
    if (busy) return;
    setBusy(true);
    await finish(await loginWithGoogle(credential), "google");
  }

  if (cfg && !cfg.accounts) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <H>{signup ? "Create your profile" : "Log in"}</H>
          <StatusMessage kind="info" message={authMessage("accounts_unavailable")} />
        </div>
        <p className="auth-skip"><a href="#/">Continue without an account</a></p>
      </div>
    );
  }
  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit} noValidate>
        <H>{signup ? "Create your profile" : "Log in"}</H>
        {headingLevel === 1 && (
          <p className="muted auth-lead">{signup ? "Keep your path and progress on any device." : "Welcome back. Pick up where you left off."}</p>
        )}
        {cfg?.googleClientId && (
          <>
            <GoogleButton clientId={cfg.googleClientId} onCredential={google} />
            <p className="auth-divider" aria-hidden="true"><span>or</span></p>
          </>
        )}
        <HaloField
          id="auth-email"
          inputRef={emailRef}
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          error={errs.email}
          onChange={(e) => { setEmail(e.target.value); setErrs({}); }}
        />
        <div className="auth-pw">
          <HaloField
            id="auth-password"
            inputRef={pwRef}
            label="Password"
            type={show ? "text" : "password"}
            autoComplete={signup ? "new-password" : "current-password"}
            description={signup ? "At least 10 characters. Avoid passwords you use elsewhere." : undefined}
            value={password}
            error={errs.password}
            onChange={(e) => { setPassword(e.target.value); setErrs({}); }}
          />
          <div className="auth-pw-row">
            <button type="button" className="secondary auth-toggle" aria-pressed={show} onClick={() => setShow(!show)}>
              {show ? "Hide password" : "Show password"}
            </button>
            {!signup && <a className="auth-forgot" href="#/forgot">Forgot password?</a>}
          </div>
        </div>
        {/* Live region stays mounted. Field errors are also tied to their field by HaloField (aria-describedby). */}
        <StatusMessage kind="error" label={false} message={errs.form ?? errs.email ?? errs.password ?? ""} />
        <button type="submit" className="cta" disabled={busy}>
          {busy && <span className="auth-spinner" aria-hidden="true" />}
          {busy ? "One moment..." : signup ? "Create account" : "Log in"}
        </button>
        {signup && (
          <p className="muted small auth-legal">
            Your names and progress are saved to our server under your account. You can delete your account any time in Settings.
          </p>
        )}
        <p className="muted small auth-switch">
          {signup ? <>Already have an account? <a href="#/login">Log in</a></> : <>New here? <a href="#/signup">Create your profile</a></>}
        </p>
      </form>
      <p className="auth-skip"><a href="#/">Continue without an account</a></p>
    </div>
  );
}
