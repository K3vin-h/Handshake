import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

// Pretrained MediaPipe face model, used ONLY to know where the head is so sign zones (forehead, chin, chest)
// follow the learner's real face instead of fixed fractions of the frame. Nothing about the face is stored or sent.
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

/** Normalized (0..1) face positions in the image: top of the forehead, chin, and the face's horizontal centre. */
export type FaceAnchors = { top: number; chin: number; cx: number };

let promise: Promise<FaceLandmarker | null> | null = null;

/** Loads once. Resolves to null if the model cannot load: zones then fall back to fixed fractions of the frame. */
export function getFaceLandmarker(): Promise<FaceLandmarker | null> {
  if (!promise) {
    promise = (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_URL);
        return await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numFaces: 1,
        });
      } catch (e) {
        console.warn("[handshake] face model unavailable, using fixed zones", e);
        return null;
      }
    })();
  }
  return promise;
}

/** MediaPipe face mesh indices: 10 = top of forehead, 152 = chin, 1 = nose tip. */
export function detectFace(lm: FaceLandmarker, source: HTMLVideoElement | HTMLCanvasElement, now: number): FaceAnchors | null {
  const f = lm.detectForVideo(source, now).faceLandmarks[0];
  if (!f) return null;
  return { top: f[10].y, chin: f[152].y, cx: f[1].x };
}
