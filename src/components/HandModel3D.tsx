import { useMemo, useRef, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";
import type { Vec3 } from "../cv/pose3d";

// Reference hand: a solid, skin-coloured hand built from the SAME recorded pose (21 MediaPipe world landmarks) as before.
// Tapered fingers + rounded knuckles + a palm volume, so it reads as a hand and not as a tracking skeleton.
// Three small canvases show the one pose: a large front view you can turn, and fixed side and top views.
// It is a picture of how OUR recording looks ("matches our recording"), not an expert-checked drawing.
// Upgrade path: a rigged glTF hand driven by the same 21 points (see CLAUDE.md "3D hand").

const SKIN = "#E2B596";
const SKIN_SHADE = "#D19F7E"; // palm, slightly deeper so the back of the fingers read against it
const NAIL = "#F4DCCB";

// [landmark chain], radius at the knuckle end, radius at the tip (cm-ish units; the pose is scaled so 1 unit is about 1 cm).
const FINGERS: { chain: number[]; r0: number; r1: number }[] = [
  { chain: [1, 2, 3, 4], r0: 1.15, r1: 0.8 }, // thumb
  { chain: [5, 6, 7, 8], r0: 0.95, r1: 0.65 }, // index
  { chain: [9, 10, 11, 12], r0: 0.98, r1: 0.66 }, // middle
  { chain: [13, 14, 15, 16], r0: 0.92, r1: 0.62 }, // ring
  { chain: [17, 18, 19, 20], r0: 0.82, r1: 0.55 }, // pinky
];

const UP = new THREE.Vector3(0, 1, 0);
const v = (p: Vec3) => new THREE.Vector3(...p);

/** One tapered segment between two joints (a cone-cylinder), with a sphere at each end so bends stay smooth. */
function Segment({ from, to, ra, rb, color }: { from: Vec3; to: Vec3; ra: number; rb: number; color: string }) {
  const { position, quaternion, length } = useMemo(() => {
    const a = v(from);
    const b = v(to);
    const dir = b.clone().sub(a);
    const length = Math.max(0.001, dir.length());
    const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
    return { position: a.clone().add(b).multiplyScalar(0.5), quaternion, length };
  }, [from, to]);
  return (
    <>
      {/* cylinderGeometry(radiusTop, radiusBottom): the top is the "to" end after the rotation */}
      <mesh position={position} quaternion={quaternion}>
        <cylinderGeometry args={[rb, ra, length, 20, 1]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      <mesh position={from}>
        <sphereGeometry args={[ra, 20, 16]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
    </>
  );
}

function Finger({ pose, chain, r0, r1 }: { pose: Vec3[]; chain: number[]; r0: number; r1: number }) {
  const n = chain.length - 1;
  const radius = (i: number) => r0 + ((r1 - r0) * i) / n;
  const tip = pose[chain[n]];
  const before = pose[chain[n - 1]];
  // Fingertip: a rounded end plus a small flat nail on the side facing away from the palm of the last segment.
  const nail = useMemo(() => {
    const dir = v(tip).sub(v(before)).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    const pos = v(tip).sub(dir.clone().multiplyScalar(r1 * 1.1));
    return { pos, q };
  }, [tip, before, r1]);
  return (
    <group>
      {chain.slice(0, -1).map((id, i) => (
        <Segment key={id} from={pose[id]} to={pose[chain[i + 1]]} ra={radius(i)} rb={radius(i + 1)} color={SKIN} />
      ))}
      <mesh position={tip}>
        <sphereGeometry args={[r1, 20, 16]} />
        <meshStandardMaterial color={SKIN} roughness={0.7} />
      </mesh>
      <mesh position={nail.pos} quaternion={nail.q} scale={[1, 0.55, 1]}>
        <sphereGeometry args={[r1 * 0.78, 14, 10]} />
        <meshStandardMaterial color={NAIL} roughness={0.35} />
      </mesh>
    </group>
  );
}

/** Palm: the convex hull of the wrist and the four knuckles (plus the thumb base), thickened along the palm normal. */
function Palm({ pose }: { pose: Vec3[] }) {
  const geometry = useMemo(() => {
    const wrist = v(pose[0]);
    const normal = v(pose[5]).sub(wrist).cross(v(pose[17]).sub(wrist)).normalize();
    const half = 1.35;
    const ids = [0, 1, 2, 5, 9, 13, 17];
    const pts: THREE.Vector3[] = [];
    for (const id of ids) {
      const p = v(pose[id]);
      // Pull the wrist and thumb base slightly inward so the palm is not wider than the real hand.
      pts.push(p.clone().addScaledVector(normal, half), p.clone().addScaledVector(normal, -half));
    }
    return new ConvexGeometry(pts);
  }, [pose]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={SKIN_SHADE} roughness={0.75} />
    </mesh>
  );
}

function Hand({ pose }: { pose: Vec3[] }) {
  return (
    <group>
      <Palm pose={pose} />
      {/* wrist stub so the hand does not end in a hollow */}
      <mesh position={pose[0]}>
        <sphereGeometry args={[1.9, 24, 18]} />
        <meshStandardMaterial color={SKIN_SHADE} roughness={0.75} />
      </mesh>
      {FINGERS.map((f) => (
        <Finger key={f.chain[0]} pose={pose} {...f} />
      ))}
      {/* knuckle caps where each finger meets the palm */}
      {[5, 9, 13, 17].map((id, i) => (
        <mesh key={id} position={pose[id]}>
          <sphereGeometry args={[FINGERS[i + 1].r0 * 1.05, 20, 16]} />
          <meshStandardMaterial color={SKIN} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

/** Turns the hand toward a target angle (set by dragging / arrow keys on the large view), easing so it feels smooth. */
function Spin({ target, children }: { target: RefObject<{ x: number; y: number }>; children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = group.current;
    if (!g || !target.current) return;
    g.rotation.x += (target.current.x - g.rotation.x) * 0.25;
    g.rotation.y += (target.current.y - g.rotation.y) * 0.25;
  });
  return <group ref={group}>{children}</group>;
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight position={[6, 10, 12]} intensity={1.3} />
      <directionalLight position={[-8, -4, 6]} intensity={0.45} />
    </>
  );
}

// The big view starts facing the learner (palm toward them, as recorded) and turns freely in any direction.
// Turning is done by our own drag handler on the view (not drei OrbitControls). We also use one <Canvas> per view, not drei <View>: View stops drawing a view it thinks is
// off-screen (it compares window position to canvas height), which froze the hand when the card sat low on the page.
const DIST = 40;

// A bare camera looks down -z wherever it sits; the fixed side and top views must be aimed at the hand.
const aimAtHand = ({ camera }: { camera: THREE.Camera }) => camera.lookAt(0, 0, 0);

/**
 * Props: pose = 21 points from meanPose3D (null → "no pose" message); letter = for labels; height = optional fixed height in px (default: follows the window height so the lesson fits on one screen)
 * (the two small views stack beside it, each half as tall).
 */
export function HandModel3D({ pose, letter, height }: { pose: Vec3[] | null; letter: string; height?: number }) {
  const spin = useRef({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const resetView = () => {
    spin.current.x = 0;
    spin.current.y = 0;
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    spin.current.y += (e.clientX - drag.current.x) * 0.012;
    spin.current.x += (e.clientY - drag.current.y) * 0.012;
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const endDrag = () => { drag.current = null; };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = 0.3;
    if (e.key === "ArrowLeft") spin.current.y -= step;
    else if (e.key === "ArrowRight") spin.current.y += step;
    else if (e.key === "ArrowUp") spin.current.x -= step;
    else if (e.key === "ArrowDown") spin.current.x += step;
    else if (e.key === "Home" || e.key === "Escape") resetView();
    else return;
    e.preventDefault();
  };

  if (!pose) {
    return (
      <div className="hand3d empty" style={height ? { height } : undefined}>
        <p>No 3D pose for {letter} yet. Record it on <a href="#/record">#/record</a>.</p>
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
          aria-label={`Large 3D view of ${letter}. Drag, or use the arrow keys, to turn it. Home resets.`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onKeyDown}
        >
          <Canvas camera={{ position: [0, 0, DIST], fov: 36 }} dpr={[1, 2]}>
            <Lights />
            <Spin target={spin}>
              <Hand pose={pose} />
            </Spin>
          </Canvas>
        </div>
        <div className="hand3d-col" style={height ? { height } : undefined}>
          <figure className="hand3d-small">
            <div role="img" aria-label={`Side view of ${letter}`}>
              <Canvas camera={{ position: [DIST, 0, 0], fov: 36 }} dpr={[1, 2]} onCreated={aimAtHand}>
                <Lights />
                <Hand pose={pose} />
              </Canvas>
            </div>
            <figcaption>Side</figcaption>
          </figure>
          <figure className="hand3d-small">
            <div role="img" aria-label={`Top view of ${letter}`}>
              <Canvas camera={{ position: [0, DIST, 0], up: [0, 0, -1], fov: 36 }} dpr={[1, 2]} onCreated={aimAtHand}>
                <Lights />
                <Hand pose={pose} />
              </Canvas>
            </div>
            <figcaption>Top</figcaption>
          </figure>
        </div>
      </div>
      <div className="hand3d-bar">
        <span>Drag or arrow keys to turn</span>
        <button className="secondary" onClick={resetView}>
          Reset view
        </button>
      </div>
    </div>
  );
}

export default HandModel3D;
