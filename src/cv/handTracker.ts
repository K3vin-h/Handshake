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
        numHands: 1,
        minHandDetectionConfidence: 0.6,
        minTrackingConfidence: 0.5,
      });
    })();
  }
  return landmarkerPromise;
}

/** Runs the model on the current video frame. Returns null when no hand is visible. */
export function detectHand(lm: HandLandmarker, video: HTMLVideoElement | HTMLCanvasElement, now: number): HandFrame | null {
  const result = lm.detectForVideo(video, now);
  if (!result.landmarks.length) return null;
  const label = result.handedness[0]?.[0]?.categoryName === "Left" ? "Left" : "Right";
  // worldLandmarks = true 3D positions in metres (origin near the hand's centre): better depth for the 3D viewer.
  return { landmarks: result.landmarks[0], worldLandmarks: result.worldLandmarks?.[0], handedness: label };
}
