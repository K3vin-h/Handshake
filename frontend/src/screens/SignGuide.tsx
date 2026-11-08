import { Suspense, lazy } from "react";
import { meanPose3D, type SignDef } from "../cv";
import type { Template } from "../cv/types";

const HandModel3D = lazy(() => import("../components/HandModel3D"));

// Where each zone sits on the 120x150 body drawing, and what each movement looks like.
const AT = { forehead: [74, 17], chin: [60, 46], chest: [60, 88], side: [100, 84] } as const;
const MOVE_TEXT = {
  none: "Hold still",
  away: "Move it outward, away from you",
  down: "Move it down",
  side: "Move it side to side",
  tap: "Tap twice",
  circle: "Rub in a small circle",
} as const;

function Arrow({ move, x, y }: { move: SignDef["movement"]; x: number; y: number }) {
  const s = { stroke: "currentColor", strokeWidth: 3, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;
  if (move === "away") return <path {...s} d={`M${x} ${y} l18 -10 m-9 -1 l9 1 l-3 9`} />;
  if (move === "down") return <path {...s} d={`M${x} ${y} v22 m-6 -6 l6 6 l6 -6`} />;
  if (move === "side") return <path {...s} d={`M${x - 16} ${y} h32 m-7 -6 l7 6 l-7 6 m-18 -12 l-7 6 l7 6`} />;
  if (move === "tap") return <path {...s} d={`M${x} ${y} v10 m-5 -5 l5 5 l5 -5 M${x + 14} ${y} v10 m-5 -5 l5 5 l5 -5`} />;
  if (move === "circle") return <path {...s} d={`M${x + 14} ${y} a14 14 0 1 1 -5 -11 m6 -2 l-1 8 l-8 -2`} />;
  return null;
}

/**
 * Shows a whole sign in three parts, as picture AND words: the handshape (3D hand), the place on the body
 * (dot + label) and the movement (arrow + label). Nothing depends on colour alone.
 */
export function SignGuide({ def, templates, leftHanded }: { def: SignDef; templates: Template[]; leftHanded: boolean }) {
  const [x, y] = AT[def.zone];
  return (
    <section className="card sign-guide" aria-label={`How to sign ${def.english}`}>
      <h2 className="small-title">How to sign “{def.english}”</h2>
      <div className="row" style={{ alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <svg viewBox="0 0 120 150" width="150" role="img" aria-label={`Body diagram: ${def.zone}, ${MOVE_TEXT[def.movement].toLowerCase()}`}>
          <circle cx="60" cy="28" r="20" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M20 150 v-30 q0 -20 25 -24 h30 q25 4 25 24 v30" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx={x} cy={y} r="7" fill="currentColor" />
          <circle cx={x} cy={y} r="11" fill="none" stroke="currentColor" strokeWidth="2" />
          <Arrow move={def.movement} x={x + (def.zone === "side" ? -2 : 16)} y={y + (def.movement === "away" ? 4 : 6)} />
        </svg>
        <Suspense fallback={<div className="hand3d empty">Loading 3D hand…</div>}>
          <HandModel3D pose={meanPose3D(def.handshape, templates, leftHanded)} letter={def.handshape} height={200} />
        </Suspense>
      </div>
      <ol>
        <li><strong>Handshape:</strong> the “{def.handshape}” hand (drag the 3D hand to turn it)</li>
        <li><strong>Place:</strong> {def.zone === "side" ? "beside your shoulder, out in the open" : `at your ${def.zone}`} (the dot)</li>
        <li><strong>Movement:</strong> {MOVE_TEXT[def.movement]} (the arrow)</li>
      </ol>
      <p>{def.howTo}</p>
      <p className="muted small">Simplified description, not yet checked by a fluent signer.</p>
    </section>
  );
}
