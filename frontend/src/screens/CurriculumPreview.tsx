import { DEMO_PROFILE, loadProfile } from "../lib/profile";
import { useMemo, useState } from "react";
import { buildCurriculum, requiredHandshapes, type Personalization } from "../lib/curriculum";

// Dev screen (#/curriculum): shows the full generated lesson plan for any names,
// with demo vs stretch scope and the handshapes that must be recorded.

const RELATIONSHIPS: Personalization["relationship"][] = ["coworker", "friend", "family", "classmate", "partner"];

export function CurriculumPreview() {
  const saved = useMemo(() => loadProfile(), []); // read once
  const [userName, setUserName] = useState(saved?.userName ?? "");
  const [theirName, setTheirName] = useState(saved?.theirName ?? "");
  const [relationship, setRelationship] = useState<Personalization["relationship"]>("coworker");
  const [demoOnly, setDemoOnly] = useState(false);
  const units = useMemo(() => buildCurriculum({ userName, theirName, relationship }), [userName, theirName, relationship]);
  const shapes = useMemo(() => requiredHandshapes(units), [units]);

  return (
    <div className="page">
      <h1>Curriculum preview</h1>
      <div className="row">
        <input aria-label="Your name" value={userName} onChange={(e) => setUserName(e.target.value)} />
        <input aria-label="Their name" value={theirName} onChange={(e) => setTheirName(e.target.value)} />
        <button type="button" className="secondary" onClick={() => { setUserName(DEMO_PROFILE.userName); setTheirName(DEMO_PROFILE.theirName); setRelationship(DEMO_PROFILE.relationship ?? "coworker"); }}>
          Use demo names ({DEMO_PROFILE.userName} → {DEMO_PROFILE.theirName})
        </button>
        <select aria-label="Relationship" value={relationship} onChange={(e) => setRelationship(e.target.value as Personalization["relationship"])}>
          {RELATIONSHIPS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <label className="check">
          <input type="checkbox" checked={demoOnly} onChange={(e) => setDemoOnly(e.target.checked)} /> Demo scope only
        </label>
      </div>
      <p className="muted">Handshapes to record on #/record: {shapes.join(" ")}</p>
      {units.map((u) => (
        <section key={u.id} className="debug">
          <h2 style={{ margin: "0 0 4px" }}>{u.title}</h2>
          <p className="muted" style={{ margin: "0 0 8px" }}>Goal: {u.goal}</p>
          {u.lessons
            .filter((l) => !demoOnly || l.scope === "demo")
            .map((l) => (
              <div key={l.id} className="row" style={{ margin: "4px 0" }}>
                <b>{l.id}</b> {l.title} <span className="muted">{l.summary}</span>
                <span className={l.scope === "demo" ? "chip ok" : "chip"}>{l.scope}</span>
                <span className="chip">{l.grading}</span>
                <span className="muted">{l.steps.length} steps · {l.xp} XP</span>
              </div>
            ))}
        </section>
      ))}
    </div>
  );
}
