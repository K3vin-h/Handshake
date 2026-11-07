import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import type { HandFrame } from "./types";

// Pretrained MediaPipe hand model: no training needed for tracking.
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

let landmarkerPromise: Promise<HandLandmarker> | null = null;

/** Loads the model once and reuses it across screens. */
export function getHandLandmarker(): Promise<HandLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      return HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 2, // pick the dominant hand when two are visible
        minHandDetectionConfidence: 0.6,
        minTrackingConfidence: 0.5,
      });
    })();
  }
  return landmarkerPromise;
}

/** MediaPipe's label for the signer's RIGHT hand on our unmirrored video. Verified on #/demo 2026-11-07: "Right". */
export const RIGHT_HAND_LABEL: "Left" | "Right" = "Right";

/** Runs the model on the current frame. With two hands visible, returns the signer's dominant hand. */
export function detectHand(lm: HandLandmarker, video: HTMLVideoElement | HTMLCanvasElement, now: number, dominant: "left" | "right" = "right"): HandFrame | null {
  const result = lm.detectForVideo(video, now);
  if (!result.landmarks.length) return null;
  const labels = result.handedness.map((h) => (h[0]?.categoryName === "Left" ? "Left" : "Right") as "Left" | "Right");
  const want = dominant === "right" ? RIGHT_HAND_LABEL : RIGHT_HAND_LABEL === "Left" ? "Right" : "Left";
  const i = Math.max(0, labels.indexOf(want));
  // worldLandmarks = true 3D positions in metres: better depth for the 3D viewer.
  return { landmarks: result.landmarks[i], worldLandmarks: result.worldLandmarks?.[i], handedness: labels[i] };
}
