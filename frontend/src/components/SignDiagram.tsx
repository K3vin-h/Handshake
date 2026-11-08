// Hand-drawn diagrams for the six signs of the introduction, drawn as a mirror picture (your right hand is on the right).
// Faded dashed hands = where you start; solid hands = where you end; arrows = how you get there.
// Simplified: a fluent signer should still check them (see SignGuide's note). Nothing depends on colour alone:
// start is dashed and faded, end is solid, and every diagram has numbered text steps beside it.

type Glyph = "flat" | "one" | "h";
type Pose = { glyph: Glyph; x: number; y: number; rot: number };
type Diagram = {
  start: Pose[];
  end: Pose[];
  arrows: string[]; // SVG path data
  steps: string[];
  alt: string;
};

// Wrist of the hand is the origin; fingers point up (-y). 1 unit ≈ 1 px in a 200x230 picture.
function Hand({ glyph, ghost }: { glyph: Glyph; ghost: boolean }) {
  const common = { fill: ghost ? "none" : "var(--hand-fill, #f2d8c4)", stroke: "currentColor", strokeWidth: 2, strokeDasharray: ghost ? "4 3" : undefined, opacity: ghost ? 0.55 : 1 } as const;
  if (glyph === "flat")
    return (
      <g {...common}>
        <rect x="-11" y="-42" width="22" height="42" rx="6" />
        <path d="M-5.5 -42 v-1 M0 -42 v-1 M5.5 -42 v-1" fill="none" />
        <path d="M-5.5 -40 v22 M0 -40 v22 M5.5 -40 v22" fill="none" strokeWidth={1.2} />
        <path d="M-11 -14 q-9 -4 -10 -14 q0 -3 3 -3 q4 3 7 9" />
      </g>
    );
  if (glyph === "one")
    return (
      <g {...common}>
        <rect x="-11" y="-22" width="22" height="22" rx="6" />
        <rect x="-3" y="-46" width="6.5" height="26" rx="3.2" />
        <path d="M-11 -10 q-8 -2 -8 -9 q2 -3 6 0" />
      </g>
    );
  return (
    <g {...common}>
      <rect x="-11" y="-22" width="22" height="22" rx="6" />
      <rect x="-6.5" y="-46" width="6.5" height="26" rx="3.2" />
      <rect x="0.5" y="-46" width="6.5" height="26" rx="3.2" />
      <path d="M-11 -10 q-8 -2 -8 -9 q2 -3 6 0" />
    </g>
  );
}

const at = (p: Pose, ghost: boolean, key: string) => (
  <g key={key} transform={`translate(${p.x} ${p.y}) rotate(${p.rot})`}>
    <Hand glyph={p.glyph} ghost={ghost} />
  </g>
);

export const DIAGRAMS: Record<string, Diagram> = {
  HELLO: {
    alt: "Flat hand at the side of the forehead, then moving outward like a salute",
    start: [{ glyph: "flat", x: 142, y: 66, rot: -38 }],
    end: [{ glyph: "flat", x: 158, y: 70, rot: 22 }],
    arrows: ["M144 22 q20 -6 28 12 m-9 -1 l9 1 l1 -9"],
    steps: ["Flat hand, fingers together, fingertips at the side of your forehead.", "Move the hand outward and a little forward, like a small salute."],
  },
  NICE: {
    alt: "One flat palm sliding along the other flat palm",
    start: [{ glyph: "flat", x: 54, y: 168, rot: 90 }, { glyph: "flat", x: 54, y: 142, rot: 90 }],
    end: [{ glyph: "flat", x: 54, y: 168, rot: 90 }, { glyph: "flat", x: 100, y: 142, rot: 90 }],
    arrows: ["M70 124 h58 m-8 -6 l8 6 l-8 6"],
    steps: ["Left palm up in front of you. Right palm flat on top of it, at the wrist end.", "Slide the right hand forward along the left palm to the fingertips."],
  },
  MEET: {
    alt: "Two index fingers pointing up, coming together",
    start: [{ glyph: "one", x: 52, y: 176, rot: 0 }, { glyph: "one", x: 148, y: 176, rot: 0 }],
    end: [{ glyph: "one", x: 86, y: 176, rot: 0 }, { glyph: "one", x: 114, y: 176, rot: 0 }],
    arrows: ["M70 128 h12 m-6 -5 l6 5 l-6 5", "M130 128 h-12 m6 -5 l-6 5 l6 5"],
    steps: ["Both hands: index finger up, held apart in front of you.", "Bring the hands together until they meet."],
  },
  YOU: {
    alt: "Index finger pointing forward at the other person",
    start: [{ glyph: "one", x: 138, y: 170, rot: 90 }],
    end: [{ glyph: "one", x: 138, y: 170, rot: 90 }],
    arrows: ["M170 124 h22 m-7 -5 l7 5 l-7 5"],
    steps: ["Point your index finger straight at the person you are talking to.", "Hold it there (a small push forward is fine)."],
  },
  MY: {
    alt: "Flat hand resting on the chest",
    start: [{ glyph: "flat", x: 150, y: 150, rot: -60 }],
    end: [{ glyph: "flat", x: 122, y: 150, rot: -80 }],
    arrows: ["M168 116 q-10 10 -22 22 m1 -10 l-1 10 l10 1"],
    steps: ["Flat hand, fingers together, palm toward you.", "Rest it flat on your chest."],
  },
  NAME: {
    alt: "Two H hands, the right crossing on top of the left and tapping twice",
    start: [{ glyph: "h", x: 66, y: 178, rot: 52 }, { glyph: "h", x: 134, y: 142, rot: -52 }],
    end: [{ glyph: "h", x: 66, y: 178, rot: 52 }, { glyph: "h", x: 134, y: 178, rot: -52 }],
    arrows: ["M134 104 v16 m-6 -6 l6 6 l6 -6 M154 104 v16 m-6 -6 l6 6 l6 -6"],
    steps: ["Both hands in the H shape (index and middle fingers together, pointing out).", "Tap the right fingers across the left fingers, twice."],
  },
};

export function SignDiagram({ id, leftHanded }: { id: string; leftHanded: boolean }) {
  const d = DIAGRAMS[id];
  if (!d) return null;
  return (
    <div className="row" style={{ alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
      <svg viewBox="0 0 200 230" width="220" style={{ maxWidth: "100%", height: "auto", overflow: "visible", transform: leftHanded ? "scaleX(-1)" : undefined }} role="img" aria-label={`${d.alt}. Faded dashed hands show the start, solid hands the end.`}>
        <circle cx="100" cy="40" r="26" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M92 66 v20 M108 66 v20" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M30 230 v-104 q0 -34 40 -40 q14 -3 22 -3 M108 83 q8 0 22 3 q40 6 40 40 v104" fill="none" stroke="currentColor" strokeWidth="2" />
        {d.start.map((p, i) => at(p, true, `s${i}`))}
        {d.end.map((p, i) => at(p, false, `e${i}`))}
        {d.arrows.map((a, i) => <path key={i} d={a} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />)}
      </svg>
      <ol style={{ flex: 1, minWidth: "12rem" }}>
        {d.steps.map((s, i) => <li key={i}>{s}</li>)}
      </ol>
    </div>
  );
}
