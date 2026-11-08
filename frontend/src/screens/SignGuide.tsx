import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useReduceMotion } from "../components/motion/MotionProvider";
import { PHASE_TEXT, TOTAL_MS, handAt } from "./signMotion";
import { meanPose3D, shapeTip, type SignDef, type SignStage } from "../cv";
import type { Template } from "../cv/types";
import { DIAGRAMS, SignDiagram } from "../components/SignDiagram";

const HandModel3D = lazy(() => import("../components/HandModel3D"));

// Body drawing, 200x230, as if you were looking at yourself in a mirror (your right hand is on the right).
// Zone dots sit where the camera zones are: forehead = beside the eye line, chin, chest, side = out in the open.
const AT = { forehead: [132, 52], chin: [100, 112], chest: [100, 160], side: [164, 150] } as const;
const PLACE_TEXT = {
  forehead: "beside your forehead, near the corner of your eye",
  chin: "just under your chin",
  chest: "on your chest, below your chin",
  side: "out in front of you, in the open (not touching your body)",
} as const;
const MOVE_TEXT = {
  none: "Hold still",
  away: "Move the hand outward, away from you",
  down: "Move the hand downward",
  side: "Move the hand from side to side",
  tap: "Tap twice (two small bumps)",
  circle: "Rub in a small circle",
} as const;

/** Start and end of the movement arrow, relative to the zone dot. `null` = no arrow (hold still). */
const PATH = {
  none: null,
  away: [[0, 0], [38, -14]],
  down: [[0, -4], [0, 34]],
  side: [[-22, 0], [22, 0]],
  tap: [[0, -8], [0, 8]],
  circle: null,
} as const;

const REST = [100, 188] as const; // where the animated hand starts: low in front of you

/** Drives the animation clock. Reduced motion: no autoplay, "Play once" runs a single loop. Returns ms and controls. */
function useClock(reduce: boolean) {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(!reduce);
  const [once, setOnce] = useState(false);
  const t0 = useRef(0);
  useEffect(() => { setPlaying(!reduce); setOnce(false); }, [reduce]);
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const start = performance.now() - t;
    t0.current = start;
    const tick = (now: number) => {
      const ms = now - start;
      if (once && ms >= TOTAL_MS) { setT(TOTAL_MS - 1); setPlaying(false); setOnce(false); return; }
      setT(ms);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps
  return {
    t, playing,
    toggle: () => setPlaying((p) => !p),
    replay: () => { setT(0); setOnce(reduce); setPlaying(true); },
  };
}

function Diagram({ def }: { def: SignDef }) {
  const [x, y] = AT[def.zone];
  const reduce = useReduceMotion();
  const clock = useClock(reduce);
  const hand = handAt(AT[def.zone], def.movement, clock.t, REST);
  const path = PATH[def.movement];
  const s = { stroke: "currentColor", strokeWidth: 3, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;
  const id = `arrow-${def.id}`;
  return (
    <>
    <svg viewBox="0 0 200 200" width="240" role="img" aria-label={`Body diagram. Place: ${PLACE_TEXT[def.zone]}. Movement: ${MOVE_TEXT[def.movement].toLowerCase()}.`}>
      <defs>
        <marker id={id} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
        </marker>
      </defs>
      {/* head, face and shoulders */}
      <g stroke="currentColor" strokeWidth="2" fill="none" opacity="0.55">
        <ellipse cx="100" cy="60" rx="34" ry="42" />
        <circle cx="87" cy="52" r="2.5" fill="currentColor" />
        <circle cx="113" cy="52" r="2.5" fill="currentColor" />
        <path d="M88 78 q12 8 24 0" />
        <path d="M88 100 v22 M112 100 v22" />
        <path d="M88 122 q-34 6 -62 24 q-10 8 -10 30 v24 M112 122 q34 6 62 24 q10 8 10 30 v24" />
      </g>
      {/* where the hand goes: ring + dot, labelled */}
      <circle cx={x} cy={y} r="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="4 3" />
      <circle cx={x} cy={y} r="5" fill="currentColor" />
      {path && <line x1={x + path[0][0]} y1={y + path[0][1]} x2={x + path[1][0]} y2={y + path[1][1]} {...s} markerEnd={`url(#${id})`} markerStart={def.movement === "side" ? `url(#${id})` : undefined} />}
      {def.movement === "tap" && <line x1={x + 20} y1={y - 8} x2={x + 20} y2={y + 8} {...s} markerEnd={`url(#${id})`} />}
      {def.movement === "circle" && <path {...s} d={`M${x + 16} ${y} a16 16 0 1 1 -6 -12`} markerEnd={`url(#${id})`} />}
      {def.movement === "away" && <text x={x + 30} y={y - 24} fontSize="11" fill="currentColor" textAnchor="middle" stroke="var(--card)" strokeWidth="4" paintOrder="stroke">outward</text>}
      <text x={def.zone === "forehead" ? x + 8 : x} y={y + (def.zone === "forehead" ? 34 : 32)} fontSize="12" fontWeight="700" fill="currentColor" textAnchor={def.zone === "forehead" ? "start" : "middle"} stroke="var(--card)" strokeWidth="4" paintOrder="stroke">{def.zone === "side" ? "in the open" : def.zone}</text>
      {/* the animated hand: a disc with the handshape letter, so it is not colour alone */}
      <g transform={`translate(${hand.x} ${hand.y})`} aria-hidden="true">
        <circle r="12" fill="currentColor" />
        <text y="4.5" fontSize="13" fontWeight="800" textAnchor="middle" fill="var(--card)">{def.handshape}</text>
      </g>
    </svg>
    <p role="note" className="small" style={{ margin: 0 }}><strong>{PHASE_TEXT[hand.phase]}</strong></p>
    <p style={{ margin: "var(--space-2) 0 0" }}>
      <button type="button" className="secondary" onClick={clock.replay}>{reduce ? "Play once" : "Replay"}</button>{" "}
      {!reduce && <button type="button" className="secondary" onClick={clock.toggle}>{clock.playing ? "Pause" : "Play"}</button>}
    </p>
    </>
  );
}

/**
 * Shows a whole sign as three numbered parts, in pictures AND words: 1 handshape (3D hand), 2 place (body diagram),
 * 3 movement (arrow). With `stage` it also shows which part you are on. Nothing depends on colour alone.
 */
export function SignGuide({ def, templates, leftHanded, stage }: { def: SignDef; templates: Template[]; leftHanded: boolean; stage?: SignStage }) {
  // The six introduction signs have a hand-drawn start/end diagram (see components/SignDiagram.tsx).
  if (DIAGRAMS[def.id])
    return (
      <section className="card sign-guide" aria-label={`How to sign ${def.english}`}>
        <h2 className="small-title">How to sign “{def.english}”{def.hands === 2 ? " (both hands)" : ""}</h2>
        <SignDiagram id={def.id} leftHanded={leftHanded} />
        <Suspense fallback={<div className="hand3d empty">Loading 3D hand…</div>}>
          <HandModel3D pose={meanPose3D(def.handshape, templates, leftHanded)} letter={def.handshape} height={170} />
        </Suspense>
        <p className="muted small">Picture is like a mirror: faded dashed hands are the start, solid hands the end. Handshape: “{def.handshape === "5" ? "open hand" : def.handshape}”. Simplified, not yet checked by a fluent signer.</p>
      </section>
    );
  const order: SignStage[] = ["handshape", "position", "movement", "done"];
  const at = stage ? order.indexOf(stage) : -1;
  const mark = (i: number) => (at < 0 ? "" : at > i ? " ✓ done" : at === i ? " ← you are here" : "");
  const shape = def.handshape === "5" ? "open hand" : `“${def.handshape}” hand`;
  return (
    <section className="card sign-guide" aria-label={`How to sign ${def.english}`}>
      <h2 className="small-title">How to sign “{def.english}”: 3 parts, in this order</h2>
      <ol className="sign-steps">
        <li>
          <strong>1. Handshape{mark(0)}</strong>
          <p>Make the {shape}: {shapeTip(def.handshape)}</p>
          <Suspense fallback={<div className="hand3d empty">Loading 3D hand…</div>}>
            <HandModel3D pose={meanPose3D(def.handshape, templates, leftHanded)} letter={def.handshape} height={170} />
          </Suspense>
          <p className="muted small">Drag the hand to turn it. This is the shape, not where it goes.</p>
        </li>
        <li>
          <strong>2. Place{mark(1)}</strong>
          <p>Bring your hand {PLACE_TEXT[def.zone]}. Hold it there for a moment.</p>
          <Diagram def={def} />
          <p className="muted small">The disc is your hand and shows the handshape letter. The dashed ring is where it goes. The drawing is a mirror: your right hand is on the right.</p>
        </li>
        <li>
          <strong>3. Movement{mark(2)}</strong>
          <p>{MOVE_TEXT[def.movement]}.{def.movement === "away" && " The camera sees this as the hand moving outward or growing."} The arrow shows the direction.</p>
          <p>{def.howTo}</p>
        </li>
      </ol>
      <p className="muted small">Simplified description, not yet checked by a fluent signer.</p>
    </section>
  );
}
