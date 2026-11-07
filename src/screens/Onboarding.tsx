import { useMemo, useRef, useState, type FormEvent } from "react";
import { isPracticeable } from "../cv";
import { HaloField } from "../components/HaloField";
import { LiveCoverage } from "../components/LiveCoverage";
import { LockedUnit } from "../components/LockedUnit";
import { StatusMessage } from "../components/StatusMessage";
import { buildCurriculum, type Personalization } from "../lib/curriculum";
import { DEMO_PROFILE, loadProfile, refreshPracticeWords, saveProfile } from "../lib/profile";

// Onboarding. Everything typed here stays in this browser (localStorage via saveProfile).
// Nothing on this screen calls /api: names and the relationship never leave the device.

const RELATIONSHIPS: [NonNullable<Personalization["relationship"]>, string][] = [
  ["coworker", "Coworker"],
  ["friend", "Friend"],
  ["family", "Family member"],
  ["classmate", "Classmate"],
  ["partner", "Partner"],
];

const hasLetter = (s: string) => /[a-z]/i.test(s);

export function Onboarding() {
  const saved = loadProfile();
  const [you, setYou] = useState(saved?.userName ?? "");
  const [them, setThem] = useState(saved?.theirName ?? "");
  const [relationship, setRelationship] = useState<Personalization["relationship"]>(saved?.relationship);
  const [leftHanded, setLeftHanded] = useState(saved?.leftHanded ?? false);
  const [error, setError] = useState("");
  const [fieldErr, setFieldErr] = useState({ you: "", them: "" });
  const youRef = useRef<HTMLInputElement>(null);
  const themRef = useRef<HTMLInputElement>(null);

  const ready = hasLetter(you) && hasLetter(them);
  const units = useMemo(
    () => (ready ? buildCurriculum({ userName: you, theirName: them, relationship }) : []),
    [ready, you, them, relationship],
  );
  const themLabel = them.trim() || "them";

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!hasLetter(you)) {
      const msg = "Enter your first name using at least one letter A to Z.";
      setError(msg);
      setFieldErr({ you: msg, them: "" });
      youRef.current?.focus();
      return;
    }
    if (!hasLetter(them)) {
      const msg = "Enter their first name using at least one letter A to Z.";
      setError(msg);
      setFieldErr({ you: "", them: msg });
      themRef.current?.focus();
      return;
    }
    setError("");
    setFieldErr({ you: "", them: "" });
    saveProfile({ userName: you.trim(), theirName: them.trim(), relationship, leftHanded });
    location.hash = "#/";
    void refreshPracticeWords();
  }

  return (
    <div className="page onboarding">
      <header className="hero">
        <p className="eyebrow">Handshake</p>
        <h1>Who are you learning for?</h1>
        <p className="lead">Learn to fingerspell your own name, then theirs. The camera checks your handshape as you go.</p>
      </header>

      <div className="onboarding-grid">
        <form className="card" onSubmit={submit} noValidate aria-labelledby="form-title">
          <h2 id="form-title">About you</h2>

          <HaloField id="you" inputRef={youRef} label="Your first name" value={you} maxLength={20} autoComplete="given-name" error={fieldErr.you}
            onChange={(e) => { setYou(e.target.value); if (fieldErr.you) setFieldErr({ ...fieldErr, you: "" }); }} />
          <HaloField id="them" inputRef={themRef} label="Their first name" value={them} maxLength={20} autoComplete="off" error={fieldErr.them}
            onChange={(e) => { setThem(e.target.value); if (fieldErr.them) setFieldErr({ ...fieldErr, them: "" }); }} />

          <fieldset className="field">
            <legend>How you know them (optional)</legend>
            <div className="choices">
              {RELATIONSHIPS.map(([value, label]) => (
                <label key={value} className="choice">
                  <input type="radio" name="relationship" checked={relationship === value} onChange={() => setRelationship(value)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="field">
            <legend>Dominant hand</legend>
            <div className="choices">
              <label className="choice">
                <input type="radio" name="hand" checked={!leftHanded} onChange={() => setLeftHanded(false)} />
                <span>Right</span>
              </label>
              <label className="choice">
                <input type="radio" name="hand" checked={leftHanded} onChange={() => setLeftHanded(true)} />
                <span>Left</span>
              </label>
            </div>
          </fieldset>

          <div id="form-status">
            <StatusMessage kind="error" message={error} />
          </div>

          <div className="row">
            <button type="submit">Build my path</button>
            <button type="button" className="secondary" onClick={() => { saveProfile(DEMO_PROFILE); location.hash = "#/"; void refreshPracticeWords(); }}>
              Use demo profile (Ryan → Lily)
            </button>
          </div>

          <p className="muted small">Your names, how you know them and your hand choice stay in this browser. Nothing is sent to a server.</p>
        </form>

        <section className="card" aria-labelledby="preview-title">
          <h2 id="preview-title">Your path</h2>
          {!ready && <p className="muted">Enter both names to preview your path and see which letters are checked live.</p>}
          {ready && (
            <>
              <div className="coverage-stack">
                <LiveCoverage name={you} isLive={isPracticeable} />
                <LiveCoverage name={them} isLive={isPracticeable} />
              </div>
              <p className="muted small">Live letters get a real match check. Reference-only letters show the picture and how to make them, with no pass or fail.</p>
              <ol className="preview-units">
                {units.slice(0, 2).map((u, i) => (
                  <li key={u.id} className="preview-unit">
                    <h3>
                      Unit {i + 1} · {u.title} <span className="chip ok">Active</span>
                    </h3>
                    <p className="muted">{u.goal}</p>
                  </li>
                ))}
              </ol>
              <div className="stack">
                {units.slice(2, 4).map((u, i) => (
                  <LockedUnit key={u.id} title={`Unit ${i + 3} · ${u.title}`} />
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      <p className="disclaimer">
        Handshake teaches fingerspelling basics so you can meet {themLabel} partway. To learn ASL fully, learn from Deaf teachers.
      </p>
    </div>
  );
}
