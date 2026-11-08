import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Vec3 } from "../cv/pose3d";
import { centrePose, retargetPose } from "../cv/handRetarget";
import { defaultView, palmNormal } from "../cv/handView";
import { useReduceMotion } from "./motion/MotionProvider";

// Reference hand: a solid, skin-coloured hand built from the SAME recorded pose (21 MediaPipe world landmarks).
// The pose is retargeted to even finger proportions (directions kept, see cv/handRetarget.ts), each finger is one
// smooth tapered tube, and the palm is a soft rounded volume. Three small canvases show the one pose: a large view
// that starts at the angle that shows the letter best (cv/handView.ts), turns slowly, and can be turned by hand,
// plus fixed side and top views. It is a picture of how OUR recording looks ("matches our recording").
// Upgrade path: a rigged glTF hand driven by the same 21 points (see CLAUDE.md "3D hand").

const SKIN = "#E2B596";
const SKIN_SHADE = "#D19F7E"; // palm, slightly deeper so the back of the fingers read against it
const NAIL = "#F4DCCB";

// Tuning knobs (change by eye).
const SPIN_SECONDS = 16; //  one slow turn of the big view
const RESUME_MS = 1500; //   auto-spin waits this long after a drag or an arrow key
const ROUGH_SKIN = 0.62;
const ROUGH_PALM = 0.7;

// [landmark chain], radius at the knuckle end, radius at the tip (cm; the pose is about 1 unit per cm).
const FINGERS: { chain: number[]; r0: number; r1: number; thumb?: boolean }[] = [
  { chain: [1, 2, 3, 4], r0: 1.15, r1: 0.78, thumb: true },
  { chain: [5, 6, 7, 8], r0: 0.92, r1: 0.64 }, // index
  { chain: [9, 10, 11, 12], r0: 0.95, r1: 0.66 }, // middle
  { chain: [13, 14, 15, 16], r0: 0.9, r1: 0.62 }, // ring
  { chain: [17, 18, 19, 20], r0: 0.8, r1: 0.55 }, // pinky
];

const v = (p: Vec3) => new THREE.Vector3(...p);
const perp = (a: THREE.Vector3, axis: THREE.Vector3) => a.clone().addScaledVector(axis, -a.dot(axis)).normalize();

/** We create these geometries ourselves, so R3F will not free them: dispose when they change or unmount. */
function useOwned<T extends { dispose(): void }>(make: () => T, deps: unknown[]): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const thing = useMemo(make, deps);
  useEffect(() => () => thing.dispose(), [thing]);
  return thing;
}

/** One finger: a single tube through its joints whose radius tapers from knuckle to tip, capped with spheres of the same radius (no seam). */
function Finger({ pose, chain, r0, r1, thumb, palmN }: { pose: Vec3[]; chain: number[]; r0: number; r1: number; thumb?: boolean; palmN: THREE.Vector3 }) {
  const tube = useOwned(() => {
    const curve = new THREE.CatmullRomCurve3(chain.map((id) => v(pose[id])), false, "centripetal");
    const segs = 40, radial = 18;
    const g = new THREE.TubeGeometry(curve, segs, 1, radial, false);
    const pos = g.attributes.position;
    const c = new THREE.Vector3(), p = new THREE.Vector3();
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      curve.getPointAt(t, c); // TubeGeometry samples the same points, ring by ring
      const r = r0 + (r1 - r0) * t;
      for (let j = 0; j <= radial; j++) {
        const k = i * (radial + 1) + j;
        p.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c);
        pos.setXYZ(k, p.x, p.y, p.z);
      }
    }
    pos.needsUpdate = true;
    return g;
  }, [pose, chain, r0, r1]);

  // Small nail on the back of the last segment: away from the palm (for the thumb, also away from the index knuckle).
  const nail = useMemo(() => {
    const tip = v(pose[chain[3]]);
    const dir = tip.clone().sub(v(pose[chain[2]])).normalize();
    let back = perp(palmN.clone().negate(), dir);
    if (thumb) back = back.add(perp(tip.clone().sub(v(pose[5])), dir)).normalize();
    const side = new THREE.Vector3().crossVectors(back, dir).normalize();
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, back, dir));
    const pos = tip.clone().addScaledVector(dir, -r1 * 0.85).addScaledVector(back, r1 * 0.78);
    return { pos, q };
  }, [pose, chain, r1, thumb, palmN]);

  return (
    <group>
      <mesh geometry={tube}>
        <meshStandardMaterial color={SKIN} roughness={ROUGH_SKIN} />
      </mesh>
      <mesh position={pose[chain[0]]}>
        <sphereGeometry args={[r0, 20, 16]} />
        <meshStandardMaterial color={SKIN} roughness={ROUGH_SKIN} />
      </mesh>
      <mesh position={pose[chain[3]]}>
        <sphereGeometry args={[r1, 20, 16]} />
        <meshStandardMaterial color={SKIN} roughness={ROUGH_SKIN} />
      </mesh>
      <mesh position={nail.pos} quaternion={nail.q} scale={[r1 * 0.7, r1 * 0.22, r1 * 0.85]}>
        <sphereGeometry args={[1, 14, 10]} />
        <meshStandardMaterial color={NAIL} roughness={0.35} />
      </mesh>
    </group>
  );
}

/**
 * Palm: the convex hull of soft balls around the knuckles, thumb base, a thenar pad and the heel of the hand, so it is
 * rounded, thicker toward the heel, and smooth-shaded. Plus a rounded wrist cuff.
 */
function Palm({ pose, palmN }: { pose: Vec3[]; palmN: THREE.Vector3 }) {
  const { across, up } = useMemo(() => {
    const across = v(pose[17]).sub(v(pose[5])).normalize(); // index → pinky knuckle
    const up = perp(v(pose[9]).sub(v(pose[0])), palmN); // wrist → middle knuckle, in the palm plane
    return { across, up };
  }, [pose, palmN]);

  const palm = useOwned(() => {
    const at = (id: number) => v(pose[id]);
    const wrist = at(0);
    // [centre, radius]: radius is half the local palm thickness.
    const balls: [THREE.Vector3, number][] = [
      [at(5), 1.0], [at(9), 1.0], [at(13), 0.98], [at(17), 0.92],
      [at(1), 1.2], [at(2), 0.95],
      [at(1).lerp(at(2), 0.45).addScaledVector(palmN, 0.55), 1.3], // thenar pad (thumb base)
      [wrist.clone().lerp(at(17), 0.4).addScaledVector(palmN, 0.35), 1.3], // hypothenar pad (pinky side)
      [wrist.clone().addScaledVector(across, -1.3).addScaledVector(up, 0.6), 1.55], // heel, thumb side
      [wrist.clone().addScaledVector(across, 1.3).addScaledVector(up, 0.6), 1.55], // heel, pinky side
    ];
    const ball = new THREE.IcosahedronGeometry(1, 2).attributes.position;
    const pts: THREE.Vector3[] = [];
    const p = new THREE.Vector3();
    for (const [c, r] of balls) for (let i = 0; i < ball.count; i++) pts.push(p.fromBufferAttribute(ball, i).multiplyScalar(r).add(c).clone());
    const hull = new ConvexGeometry(pts);
    hull.deleteAttribute("normal");
    const g = mergeVertices(hull, 1e-4);
    hull.dispose();
    g.computeVertexNormals();
    return g;
  }, [pose, palmN, across, up]);

  // Wrist cuff: a flattened capsule continuing the palm down the forearm.
  const cuff = useMemo(() => {
    const down = up.clone().negate();
    const x = perp(across, down);
    const z = new THREE.Vector3().crossVectors(x, down).normalize();
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, down, z));
    return { pos: v(pose[0]).addScaledVector(down, 1.4), q };
  }, [pose, across, up]);

  return (
    <>
      <mesh geometry={palm}>
        <meshStandardMaterial color={SKIN_SHADE} roughness={ROUGH_PALM} />
      </mesh>
      <mesh position={cuff.pos} quaternion={cuff.q} scale={[2.2, 1, 1.45]}>
        <capsuleGeometry args={[1, 2.2, 8, 24]} />
        <meshStandardMaterial color={SKIN_SHADE} roughness={ROUGH_PALM} />
      </mesh>
    </>
  );
}

function Hand({ pose }: { pose: Vec3[] }) {
  const palmN = useMemo(() => v(palmNormal(pose)), [pose]);
  return (
    <group>
      <Palm pose={pose} palmN={palmN} />
      {FINGERS.map((f) => (
        <Finger key={f.chain[0]} pose={pose} palmN={palmN} {...f} />
      ))}
    </group>
  );
}

/** A soft round shadow on an imaginary floor: a radial-gradient texture, no shadow maps. */
function ContactShadow({ y }: { y: number }) {
  const tex = useOwned(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(0,0,0,0.28)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }, []);
  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[18, 12, 1]} renderOrder={-1}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} />
    </mesh>
  );
}

/** Turns the hand toward a target angle (set by dragging / arrow keys on the large view), easing so it feels smooth. */
function Spin({ target, children }: { target: RefObject<{ x: number; y: number }>; children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const placed = useRef(false);
  // The canvas only draws on demand (frameloop="demand"), so keep asking for frames until the hand has reached its target.
  useFrame(() => {
    const g = group.current;
    if (!g || !target.current) return;
    if (!placed.current) {
      // First frame: start AT the default view instead of easing in from front-on.
      g.rotation.set(target.current.x, target.current.y, 0);
      placed.current = true;
    }
    const dx = target.current.x - g.rotation.x;
    const dy = target.current.y - g.rotation.y;
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return;
    g.rotation.x += dx * 0.25;
    g.rotation.y += dy * 0.25;
    invalidate();
  });
  return <group ref={group}>{children}</group>;
}

/** Slow turntable about the vertical axis. Requests frames only while it is turning, so a paused view costs nothing. */
function Turntable({ angle, canTurn, children }: { angle: RefObject<number>; canTurn: () => boolean; children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  useFrame((_, dt) => {
    if (!group.current) return;
    if (canTurn()) {
      // dt is clamped: after a pause the first frame would otherwise jump by the whole paused time.
      angle.current = (angle.current + (Math.min(dt, 0.1) * 2 * Math.PI) / SPIN_SECONDS) % (2 * Math.PI);
      invalidate();
    }
    group.current.rotation.y = angle.current;
  });
  return <group ref={group}>{children}</group>;
}

function Lights() {
  return (
    <>
      <hemisphereLight args={["#ffffff", SKIN_SHADE, 0.9]} />
      <ambientLight intensity={0.15} />
      <directionalLight position={[6, 10, 12]} intensity={1.25} />
      <directionalLight position={[-8, -2, 8]} intensity={0.3} />
      {/* rim light from behind, so the outline separates from the background */}
      <directionalLight position={[-4, 6, -12]} intensity={0.9} />
    </>
  );
}

// Turning is done by our own drag handler on the view (not drei OrbitControls). We also use one <Canvas> per view, not drei <View>: View stops drawing a view it thinks is
// off-screen (it compares window position to canvas height), which froze the hand when the card sat low on the page.
const DIST = 40;
const FLOOR = -11.5; // contact shadow height (just below a hand of any orientation)

// A bare camera looks down -z wherever it sits; the fixed side and top views must be aimed at the hand.
const aimAtHand = ({ camera }: { camera: THREE.Camera }) => camera.lookAt(0, 0, 0);

const reducedByDevice = () =>
  (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) ||
  (typeof document !== "undefined" && document.documentElement.hasAttribute("data-reduce-motion"));

/**
 * Props: pose = 21 points from meanPose3D (null → "no pose" message); letter = for labels and the per-letter view; height = optional fixed height in px (default: follows the window height so the lesson fits on one screen)
 * (the two small views stack beside it, each half as tall).
 */
export function HandModel3D({ pose: poseProp, letter, height }: { pose: Vec3[] | null; letter: string; height?: number }) {
  // Callers rebuild the pose array on every render (the lesson page re-renders on every camera frame). Rebuilding the
  // hand's geometry that often froze the camera, so keep the same array until the numbers actually change.
  const poseKey = poseProp ? poseProp.map((p) => p.join(",")).join(";") : "";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pose = useMemo(() => (poseProp ? centrePose(retargetPose(poseProp)) : null), [poseKey]);
  const home = useMemo(() => (pose ? defaultView(letter, pose) : { x: 0, y: 0 }), [pose, letter]);

  const wake = useRef<(() => void) | null>(null);
  const spin = useRef({ x: home.x, y: home.y });
  const angle = useRef(0);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const holdUntil = useRef(0);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const reduce = useReduceMotion();
  const [playing, setPlaying] = useState(() => !(reduce || reducedByDevice()));
  const playingRef = useRef(playing);
  useEffect(() => { if (reduce) setPlaying(false); }, [reduce]);
  useEffect(() => {
    playingRef.current = playing;
    if (playing) wake.current?.();
  }, [playing]);
  const canTurn = () => playingRef.current && !document.hidden && drag.current === null && performance.now() >= holdUntil.current;

  // Restart the turntable when the tab comes back.
  useEffect(() => {
    const onVis = () => { if (!document.hidden) wake.current?.(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); clearTimeout(resumeTimer.current); };
  }, []);

  // A new letter (or a new pose) starts again from its own best angle.
  useEffect(() => {
    spin.current.x = home.x;
    spin.current.y = home.y;
    angle.current = 0;
    wake.current?.();
  }, [home]);

  const holdSpin = () => {
    holdUntil.current = performance.now() + RESUME_MS;
    clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => wake.current?.(), RESUME_MS + 20);
  };
  const turn = (dx: number, dy: number) => {
    spin.current.x += dx;
    spin.current.y += dy;
    wake.current?.();
  };
  const resetView = () => {
    spin.current.x = home.x;
    spin.current.y = home.y;
    angle.current = 0;
    wake.current?.();
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    turn((e.clientY - drag.current.y) * 0.012, (e.clientX - drag.current.x) * 0.012);
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const endDrag = () => {
    if (!drag.current) return;
    drag.current = null;
    holdSpin();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = 0.3;
    if (e.key === "ArrowLeft") turn(0, -step);
    else if (e.key === "ArrowRight") turn(0, step);
    else if (e.key === "ArrowUp") turn(-step, 0);
    else if (e.key === "ArrowDown") turn(step, 0);
    else if (e.key === "Home" || e.key === "Escape") resetView();
    else return;
    holdSpin();
    e.preventDefault();
  };

  if (!pose) {
    return (
      <div className="hand3d empty" style={height ? { height } : undefined}>
        {letter === "J" || letter === "Z" ? (
          <p>{letter} is drawn in the air, so there is no still 3D hand to show.</p>
        ) : (
          <p>No 3D pose for {letter} yet. Record it on <a href="#/record">#/record</a>.</p>
        )}
      </div>
    );
  }

  return (
    <div className="hand3d">
      <div className="hand3d-views">
        <div
          className="hand3d-main"
          tabIndex={0}
          role="group"
          aria-label={`Large 3D view of ${letter}, starting at the angle that shows it best. Drag, or use the arrow keys, to turn it. Home resets. Rotation can be paused with the button below.`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onKeyDown}
        >
          <Canvas frameloop="demand" camera={{ position: [0, 0, DIST], fov: 36 }} dpr={[1, 1.5]} onCreated={({ invalidate }) => { wake.current = invalidate; }}>
            <Lights />
            <ContactShadow y={FLOOR} />
            <Turntable angle={angle} canTurn={canTurn}>
              <Spin target={spin}>
                <Hand pose={pose} />
              </Spin>
            </Turntable>
          </Canvas>
        </div>
        <div className="hand3d-col" style={height ? { height } : undefined}>
          <figure className="hand3d-small">
            <div role="img" aria-label={`Side view of ${letter}`}>
              <Canvas frameloop="demand" camera={{ position: [DIST, 0, 0], fov: 36 }} dpr={[1, 1.5]} onCreated={aimAtHand}>
                <Lights />
                <ContactShadow y={FLOOR} />
                <Hand pose={pose} />
              </Canvas>
            </div>
            <figcaption>Side</figcaption>
          </figure>
          <figure className="hand3d-small">
            <div role="img" aria-label={`Top view of ${letter}`}>
              <Canvas frameloop="demand" camera={{ position: [0, DIST, 0], up: [0, 0, -1], fov: 36 }} dpr={[1, 1.5]} onCreated={aimAtHand}>
                <Lights />
                <ContactShadow y={FLOOR} />
                <Hand pose={pose} />
              </Canvas>
            </div>
            <figcaption>Top</figcaption>
          </figure>
        </div>
      </div>
      <div className="hand3d-bar">
        <span>Drag or arrow keys to turn; rotation can be paused</span>
        <span className="hand3d-actions">
          <button type="button" className="secondary" aria-pressed={playing} onClick={() => setPlaying((p) => !p)}>
            {playing ? "Pause rotation" : "Play rotation"}
          </button>
          <button type="button" className="secondary" onClick={resetView}>
            Reset view
          </button>
        </span>
      </div>
    </div>
  );
}

export default HandModel3D;
