import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { isPracticeable } from "../cv";
import { HaloField } from "../components/HaloField";
import { LetterBadge } from "../components/LetterBadge";
import { LockedUnit } from "../components/LockedUnit";
import { coverage } from "../components/LiveCoverage";
import { buildCurriculum, type Personalization } from "../lib/curriculum";
import { DEMO_PROFILE, loadProfile, refreshPracticeWords, saveProfile } from "../lib/profile";

// Onboarding: four short steps. Everything typed here stays in this browser (saveProfile: localStorage in
// try/catch with an in-memory fallback). "Build my path" saves the profile, builds the path locally
// (buildCurriculum) and then asks the server for practice words in the background (refreshPracticeWords).
// That request carries letters only, never names, and a failure never blocks: the local path is already built.

const TOTAL = 4;

/**
 * Privacy line. ONE constant, chosen by whether "Build my path" currently calls the server.
 * It does: refreshPracticeWords() posts lists of letters to /api/words. If that call is removed, set this to false.
 */
const PATH_CALLS_SERVER = true;
const PRIVACY = PATH_CALLS_SERVER
  ? "Your names never leave this browser. Only lists of letters may be sent."
  : "Your names stay in this browser. Nothing is sent to a server.";

/**
 * Name rule (shown in the helper text): only the letters A to Z are signed.
 * Accents are folded to their base letter (é becomes E), and the saved name has its accents removed so the
 * lessons match the preview. Hyphens, spaces, apostrophes, digits and any other symbols are not signed.
 */
const NAME_RULE = "Accents become their base letter (é = E). Hyphens, spaces and symbols are not signed.";
const foldName = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const signedLetters = (s: string) => [...foldName(s).toUpperCase()].filter((c) => /[A-Z]/.test(c));

const RELATIONSHIPS: [NonNullable<Personalization["relationship"]>, string][] = [
  ["coworker", "Coworker"],
  ["friend", "Friend"],
  ["family", "Family member"],
  ["classmate", "Classmate"],
  ["partner", "Partner"],
];

/** Tiles for the letters of a name. Each new letter animates in; `key` includes the index so only new ones mount. */
function LiveTiles({ name }: { name: string }) {
  const letters = signedLetters(name);
  return (
    <div className="live-tiles" aria-hidden="true">
      {letters.map((l, i) => (
        <span key={`${i}-${l}`} className="live-tile">{l}</span>
      ))}
    </div>
  );
}

function CoverageRow({ name }: { name: string }) {
  const c = coverage(foldName(name), isPracticeable);
  if (c.total === 0) return null;
  return (
    <div className="coverage-row">
      <p>
        <strong>{signedLetters(name).join("")}: {c.liveCount} of {c.total} live</strong>
        {c.liveCount < c.total && <span className="muted"> · dashed tiles are reference only (no pass or fail)</span>}
      </p>
      <div className="tile-row">
        {c.letters.map((l, i) => (
          <span key={l} className="tile-in" style={{ "--k": i } as CSSProperties}>
            <LetterBadge letter={l} status={isPracticeable(l) ? "not-started" : "reference-only"} />
          </span>
        ))}
      </div>
    </div>
  );
}

export function Onboarding() {
  const saved = loadProfile();
  const dev = typeof location !== "undefined" && new URLSearchParams(location.search).has("dev");
  const [step, setStep] = useState(1);
  const [dir, setDir] = useState<"fwd" | "back">("fwd");
  const [you, setYou] = useState(saved?.userName ?? "");
  const [them, setThem] = useState(saved?.theirName ?? "");
  const [relationship, setRelationship] = useState<Personalization["relationship"]>(saved?.relationship);
  const [leftHanded, setLeftHanded] = useState(saved?.leftHanded ?? false);
  const [err, setErr] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const youRef = useRef<HTMLInputElement>(null);
  const themRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Focus the new step's heading on every step change (not on first load). preventScroll: never jump the page.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    heading.current?.focus({ preventScroll: true });
  }, [step]);

  const units = useMemo(
    () => (step === 4 ? buildCurriculum({ userName: foldName(you).trim(), theirName: foldName(them).trim(), relationship }) : []),
    [step, you, them, relationship],
  );
  const themLabel = foldName(them).trim() || "them";

  function go(n: number) {
    setDir(n > step ? "fwd" : "back");
    setErr("");
    setStep(n);
  }

  function next(e: FormEvent) {
    e.preventDefault();
    if (step === 1 && signedLetters(you).length === 0) {
      setErr("Enter your first name using at least one letter A to Z.");
      youRef.current?.focus();
      return;
    }
    if (step === 2 && signedLetters(them).length === 0) {
      setErr("Enter their first name using at least one letter A to Z.");
      themRef.current?.focus();
      return;
    }
    if (step < TOTAL) return go(step + 1);
    // Build my path: save locally (try/catch + memory fallback inside saveProfile), then refresh practice words in the
    // background. The local path already exists, so a slow, failing or mock server can never block this.
    saveProfile({ userName: foldName(you).trim(), theirName: foldName(them).trim(), relationship, leftHanded });
    location.hash = "#/";
    void refreshPracticeWords().catch(() => {});
  }

  const stepClass = `step step-${dir}`;

  return (
    <div className="page onboarding">
      <form
        ref={formRef}
        className="onboard-card"
        onSubmit={next}
        noValidate
        // Enter advances from anywhere in the step, including the heading that just received focus (not only from inputs).
        onKeyDown={(e) => {
          if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) {
            e.preventDefault();
            formRef.current?.requestSubmit();
          }
        }}
      >
        <div className="step-head">
          <p className="step-count">Step {step} of {TOTAL}</p>
          <ol className="step-dots" aria-hidden="true">
            {Array.from({ length: TOTAL }, (_, i) => (
              <li key={i} className={i + 1 < step ? "is-done" : i + 1 === step ? "is-now" : ""} />
            ))}
          </ol>
        </div>

        {/* Steps 1-3 stay mounted (hidden when not current) so typed text and choices persist and every field exists in the markup. */}
        <div className={stepClass} hidden={step !== 1}>
          {(
            <>
              <h1 ref={step === 1 ? heading : undefined} tabIndex={-1}>What&rsquo;s your first name?</h1>
              <HaloField
                id="you"
                inputRef={youRef}
                label="Your first name"
                description={<>You&rsquo;ll learn to fingerspell it first. {NAME_RULE}</>}
                value={you}
                maxLength={20}
                autoComplete="given-name"
                error={err}
                onChange={(e) => { setYou(e.target.value); if (err) setErr(""); }}
              />
              <LiveTiles name={you} />
            </>
          )}

        </div>

        <div className={stepClass} hidden={step !== 2}>
          {(
            <>
              <h1 ref={step === 2 ? heading : undefined} tabIndex={-1}>Who do you want to sign with?</h1>
              <HaloField
                id="them"
                inputRef={themRef}
                label="Their first name"
                description={<>A friend, coworker or family member. You&rsquo;ll learn their name next. {NAME_RULE}</>}
                value={them}
                maxLength={20}
                autoComplete="off"
                error={err}
                onChange={(e) => { setThem(e.target.value); if (err) setErr(""); }}
              />
              <LiveTiles name={them} />
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
            </>
          )}

        </div>

        <div className={stepClass} hidden={step !== 3}>
          {(
            <>
              <h1 ref={step === 3 ? heading : undefined} tabIndex={-1}>Which is your dominant hand?</h1>
              <fieldset className="field">
                <legend className="sr-only">Dominant hand</legend>
                <div className="choices big-choices">
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
              <p className="muted">Saved as a preference in this browser. Left-handed mode has not been tested with left-handed signers yet.</p>
            </>
          )}

        </div>

        {step === 4 && (
        <div className={stepClass}>
          {(
            <>
              <h1 ref={step === 4 ? heading : undefined} tabIndex={-1}>Here is your path</h1>
              <div className="coverage-stack">
                <CoverageRow name={you} />
                <CoverageRow name={them} />
              </div>
              <p className="muted small">Live letters get a real match check. Reference-only letters show the picture and how to make them, with no pass or fail.</p>
              <ol className="preview-units">
                {units.slice(0, 2).map((u, i) => (
                  <li key={u.id} className="preview-unit">
                    <h2>
                      Unit {i + 1} · {u.title} <span className="chip ok">Active</span>
                    </h2>
                    <p className="muted">{u.goal}</p>
                  </li>
                ))}
              </ol>
              <div className="stack">
                {units.slice(2, 4).map((u, i) => (
                  <LockedUnit key={u.id} title={`Unit ${i + 3} · ${u.title}`} />
                ))}
              </div>
              <p className="disclaimer">
                Handshake teaches fingerspelling basics so you can meet {themLabel} partway. To learn ASL fully, learn from Deaf teachers.
              </p>
            </>
          )}
        </div>
        )}

        <div className="step-actions">
          {step > 1 ? (
            <button type="button" className="secondary" onClick={() => go(step - 1)}>Back</button>
          ) : (
            <span />
          )}
          <button type="submit" className="cta">{step === TOTAL ? "Build my path" : "Continue"}</button>
        </div>

        <p className="muted small privacy">{PRIVACY}</p>
        {dev && (
          <p>
            <button type="button" className="secondary" onClick={() => { saveProfile(DEMO_PROFILE); location.hash = "#/"; void refreshPracticeWords().catch(() => {}); }}>
              Use demo profile (Ryan → Lily)
            </button>
          </p>
        )}
      </form>
    </div>
  );
}
