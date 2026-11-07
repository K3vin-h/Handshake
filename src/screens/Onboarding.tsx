import { useState, type FormEvent } from "react";
import { isPracticeable } from "../cv/practiceable";
import { DEMO_PROFILE, saveProfile, refreshPracticeWords } from "../lib/profile";

// Names + signing hand only. No level or placement questions: everyone starts at lesson 1.1.
const lettersOf = (s: string) => [...new Set(s.toUpperCase().replace(/[^A-Z]/g, ""))];

export function Onboarding() {
  const [f, setF] = useState({ userName: "", theirName: "", leftHanded: false });
  const all = [...new Set([...lettersOf(f.userName), ...lettersOf(f.theirName)])];
  const now = all.filter(isPracticeable);
  const later = all.filter((l) => !isPracticeable(l));

  function submit(e: FormEvent) {
    e.preventDefault();
    saveProfile({ ...f, userName: f.userName.trim(), theirName: f.theirName.trim() }); // names stay in this browser; nothing is sent
    location.hash = "#/";
    void refreshPracticeWords();
  }

  return (
    <main className="page">
      <h1>Who are you learning for?</h1>
      <form onSubmit={submit}>
        <label>Your name <input required pattern=".*[A-Za-z].*" title="Include at least one A–Z letter for fingerspelling" maxLength={80} value={f.userName} onChange={(e) => setF({ ...f, userName: e.target.value })} /></label>
        <label>Their name <input required pattern=".*[A-Za-z].*" title="Include at least one A–Z letter for fingerspelling" maxLength={80} value={f.theirName} onChange={(e) => setF({ ...f, theirName: e.target.value })} /></label>
        <fieldset>
          <legend>Your signing hand</legend>
          <label><input type="radio" name="hand" checked={!f.leftHanded} onChange={() => setF({ ...f, leftHanded: false })} /> Right</label>
          <label><input type="radio" name="hand" checked={f.leftHanded} onChange={() => setF({ ...f, leftHanded: true })} /> Left</label>
        </fieldset>
        <div role="status">
          {all.length > 0 && (
          <section>
            <p>Practise now: <b>{now.join(" ") || "none yet"}</b></p>
            {later.length > 0 && <p>Reference only, coming later: <b>{later.join(" ")}</b></p>}
            <p className="muted">Names stay on this device. Only letters are sent to our coach.</p>
          </section>
          )}
        </div>
        <button>Start at lesson 1.1</button>
      </form>
      <button className="secondary" onClick={() => { saveProfile(DEMO_PROFILE); location.hash = "#/"; void refreshPracticeWords(); }}>Use demo profile (Ryan → Lily)</button>
    </main>
  );
}
