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
        numHands: 2,
        minHandDetectionConfidence: 0.6,
        minTrackingConfidence: 0.5,
      });
    })();
  }
  return landmarkerPromise;
}

// MediaPipe label for the signer’s right hand on unmirrored video; verified on #/demo 2026-11-07.
export const RIGHT_HAND_LABEL: "Left" | "Right" = "Right";

/** Runs the model on the current video frame. Returns null when no hand is visible. */
export function detectHand(lm: HandLandmarker, video: HTMLVideoElement | HTMLCanvasElement, now: number, dominant: "left" | "right" = "right"): HandFrame | null {
  const result = lm.detectForVideo(video, now);
  if (!result.landmarks.length) return null;
  // Unmirrored input: prefer the configured MediaPipe handedness; verify labels on the demo device.
  const wanted = dominant === "right" ? RIGHT_HAND_LABEL : RIGHT_HAND_LABEL === "Left" ? "Right" : "Left";
  const selected = result.handedness.findIndex((h) => h[0]?.categoryName === wanted);
  const i = selected >= 0 ? selected : result.landmarks.length === 1 ? 0 : -1;
  if (i < 0) return null;
  const label = result.handedness[i]?.[0]?.categoryName === "Left" ? "Left" : "Right";
  // worldLandmarks = true 3D positions in metres (origin near the hand's centre): better depth for the 3D viewer.
  const j = result.landmarks.length > 1 ? (i === 0 ? 1 : 0) : -1;
  const other: HandFrame | undefined =
    j >= 0 ? { landmarks: result.landmarks[j], worldLandmarks: result.worldLandmarks?.[j], handedness: result.handedness[j]?.[0]?.categoryName === "Left" ? "Left" : "Right" } : undefined;
  return { landmarks: result.landmarks[i], worldLandmarks: result.worldLandmarks?.[i], handedness: label, other };
}
