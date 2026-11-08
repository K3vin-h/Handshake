import { DIAGRAMS, SignDiagram } from "../components/SignDiagram";
import { SIGNS } from "../cv";

// Dev tool: every hand-drawn sign diagram on one page, for checking them against a Deaf-led source.
export function SignDiagramsPage() {
  return (
    <div className="page">
      <h1>Sign diagrams</h1>
      <p className="muted">Check each against a Deaf-led source such as Lifeprint (lifeprint.com). Left-handed mode mirrors them.</p>
      {Object.keys(DIAGRAMS).map((id) => (
        <section key={id} className="card">
          <h2 className="small-title">{id} · “{SIGNS[id]?.english}”{SIGNS[id]?.hands === 2 ? " · both hands" : ""}</h2>
          <SignDiagram id={id} leftHanded={false} />
        </section>
      ))}
    </div>
  );
}
