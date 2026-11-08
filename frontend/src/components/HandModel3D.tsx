import { useMemo, useRef, type ElementRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { HAND_BONES, type Vec3 } from "../cv/pose3d";

// MVP 3D hand: joints as spheres, bones as rounded capsules, built from a recorded pose.
// Drag to spin, scroll/pinch to zoom. Upgrade path: swap <SkeletonHand> for a rigged
// glTF hand driven by the same 21 points (see CLAUDE.md "3D hand").

const COLORS: Record<string, string> = {
  palm: "#94A3B8",
  thumb: "#C2410C",
  index: "#0F766E",
  middle: "#0E7490",
  ring: "#6D28D9",
  pinky: "#BE185D",
};

const UP = new THREE.Vector3(0, 1, 0);

function Bone({ from, to, color, radius }: { from: Vec3; to: Vec3; color: string; radius: number }) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = b.clone().sub(a);
    const length = dir.length();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
    return { position: a.add(b).multiplyScalar(0.5), quaternion, length };
  }, [from, to]);
  return (
    <mesh position={position} quaternion={quaternion}>
      <capsuleGeometry args={[radius, Math.max(0.001, length - radius), 6, 12]} />
      <meshStandardMaterial color={color} roughness={0.55} />
    </mesh>
  );
}

function SkeletonHand({ pose }: { pose: Vec3[] }) {
  return (
    <group>
      {HAND_BONES.map(({ finger, a, b }) => (
        <Bone key={`${a}-${b}`} from={pose[a]} to={pose[b]} color={COLORS[finger]} radius={finger === "palm" ? 0.32 : 0.42} />
      ))}
      {pose.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[[4, 8, 12, 16, 20].includes(i) ? 0.5 : 0.45, 16, 16]} />
          <meshStandardMaterial color="#F8FAFC" roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

// Stays still, facing the learner (palm toward them, as recorded). Turns only when dragged, within limits,
// so it can never flip round to the back of the hand.
const FRONT = Math.PI / 2;
const TILT = 0.5; // ~30° up/down
const TURN = 1.15; // ~65° left/right

export function HandModel3D({ pose, letter, height = 320 }: { pose: Vec3[] | null; letter: string; height?: number }) {
  const controls = useRef<ElementRef<typeof OrbitControls>>(null);

  if (!pose) {
    return (
      <div className="hand3d empty" style={{ height }}>
        {letter === "J" || letter === "Z" ? (
          <p>{letter} is drawn in the air, so there is no still 3D hand to show.</p>
        ) : (
          <p>No 3D pose for {letter} yet. Record it on <a href="#/record">#/record</a>.</p>
        )}
      </div>
    );
  }

  return (
    <div className="hand3d" style={{ height }}>
      <Canvas camera={{ position: [0, 0, 34], fov: 40 }} dpr={[1, 2]} aria-label={`3D model of the ASL letter ${letter}, facing you. Drag to turn.`}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 10, 8]} intensity={1.1} />
        <directionalLight position={[-6, -4, -6]} intensity={0.35} />
        <SkeletonHand pose={pose} />
        <OrbitControls
          ref={controls}
          enablePan={false}
          minDistance={10}
          maxDistance={55}
          rotateSpeed={0.5}
          enableDamping
          dampingFactor={0.12}
          minPolarAngle={FRONT - TILT}
          maxPolarAngle={FRONT + TILT}
          minAzimuthAngle={-TURN}
          maxAzimuthAngle={TURN}
        />
      </Canvas>
      <div className="hand3d-bar">
        <span>Drag to turn · scroll to zoom</span>
        <button className="secondary" onClick={() => controls.current?.reset()}>
          Reset view
        </button>
      </div>
    </div>
  );
}

export default HandModel3D;
