import { useEffect, useRef, useState } from "react";
import { detectHand, getHandLandmarker } from "./handTracker";
import { detectFace, getFaceLandmarker, type FaceAnchors } from "./faceTracker";
import { drawHand } from "./drawing";
import { LandmarkSmoother } from "./oneEuro";
import { classifyBrightness, enhanceFrame, loadOpenCV, measureBrightness, openCamera, type LightingStatus } from "./lighting";
import type { HandFrame } from "./types";
import { useCameraOn } from "../lib/cameraPref";

/**
 * Webcam → (lighting check, CLAHE when dark) → MediaPipe → One Euro smoothing → onFrame.
 * Attach videoRef / canvasRef to a <video> and <canvas> (see components/Camera.tsx).
 */
export function useHandTracking(onFrame: (hand: HandFrame | null, now: number, face?: FaceAnchors | null) => void, opts: { enhance?: boolean; dominant?: "left" | "right" } = {}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cb = useRef(onFrame);
  cb.current = onFrame;
  const dominant = useRef(opts.dominant ?? "right");
  dominant.current = opts.dominant ?? "right";
  const enhanceAllowed = opts.enhance ?? true;
  const [camOn] = useCameraOn();
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "off">(camOn ? "loading" : "off");
  const [error, setError] = useState("");
  const [lighting, setLighting] = useState<LightingStatus>("ok");
  const [enhancing, setEnhancing] = useState(false);

  useEffect(() => {
    if (!camOn) { setStatus("off"); setLighting("ok"); setEnhancing(false); return; } // camera released by the cleanup below
    setStatus("loading");
    let raf = 0;
    let stream: MediaStream | null = null;
    let cancelled = false;
    const smoother = new LandmarkSmoother();
    const otherSmoother = new LandmarkSmoother(); // second hand, for two-handed signs
    const work = document.createElement("canvas");
    const enhanced = document.createElement("canvas");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cv: any = null;
    let lightState: LightingStatus = "ok";

    (async () => {
      try {
        const lm = await getHandLandmarker();
        if (cancelled) return;
        // The face model loads in the background: hand tracking starts without it, zones use it once it is ready.
        let faceLm: Awaited<ReturnType<typeof getFaceLandmarker>> = null;
        getFaceLandmarker().then((f) => (faceLm = f));
        let face: FaceAnchors | null = null;
        let faceSeen = 0;
        stream = await openCamera();
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        if (cancelled) return;
        setStatus("ready");

        let lastTime = -1;
        let frame = 0;
        const loop = () => {
          const now = performance.now();
          if (video.currentTime !== lastTime && video.videoWidth) {
            lastTime = video.currentTime;

            // Check brightness every 15 frames (~0.5 s); load OpenCV the first time it's dark.
            if (frame++ % 15 === 0) {
              const s = classifyBrightness(measureBrightness(video));
              if (s !== lightState) {
                lightState = s;
                setLighting(s);
              }
              if (s === "dark" && enhanceAllowed && !cv) {
                loadOpenCV()
                  .then((c) => (cv = c))
                  .catch((e) => console.warn("[handshake]", e));
              }
            }

            let source: HTMLVideoElement | HTMLCanvasElement = video;
            const useEnhance = lightState === "dark" && enhanceAllowed && cv;
            if (useEnhance) {
              try {
                enhanceFrame(cv, video, work, enhanced);
                source = enhanced;
              } catch (e) {
                console.warn("[handshake] CLAHE failed, using raw frame", e);
              }
            }
            setEnhancing(!!useEnhance);

            const raw = detectHand(lm, source, now, dominant.current);
            const rawInFrame = raw && raw.landmarks.length === 21 && raw.landmarks.every((p) => p.x > 0.01 && p.x < 0.99 && p.y > 0.01 && p.y < 0.99);
            const smooth = smoother.smooth(rawInFrame ? raw : null, now);
            // Preserve invalid raw coordinates so the consumer can explain the frame-edge problem.
            const hand = rawInFrame ? smooth : raw;
            const otherRaw = rawInFrame ? raw.other ?? null : null;
            const otherSmooth = otherSmoother.smooth(otherRaw && otherRaw.landmarks.every((p) => p.x > 0.01 && p.x < 0.99 && p.y > 0.01 && p.y < 0.99) ? otherRaw : null, now);
            if (hand && rawInFrame && otherSmooth) hand.other = otherSmooth;
            else if (hand && rawInFrame) delete hand.other;
            const canvas = canvasRef.current;
            if (canvas) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              drawHand(canvas.getContext("2d")!, hand?.landmarks ?? null);
            }
            // Face every 3rd frame (it is the slower model); smoothed, and dropped after ~1 s without a face.
            if (faceLm && frame % 3 === 0) {
              try {
                const f = detectFace(faceLm, source, now);
                if (f) {
                  face = face ? { top: face.top + (f.top - face.top) * 0.3, chin: face.chin + (f.chin - face.chin) * 0.3, cx: f.cx } : f;
                  faceSeen = now;
                }
              } catch (e) {
                console.warn("[handshake] face detection failed", e);
              }
            }
            if (face && now - faceSeen > 1000) face = null;
            cb.current(hand, now, face);
          }
          raf = requestAnimationFrame(loop);
        };
        loop();
      } catch (e) {
        if (cancelled) return; // turned off (or left the page) while starting: play() rejects, not a real error
        setStatus("error");
        setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
      const c = canvasRef.current;
      c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    };
  }, [enhanceAllowed, camOn]);

  /** JPEG snapshot of the current frame, cropped to the hand if given (for the Gemini coach). */
  function snapshot(hand?: HandFrame | null, size = 256): string | undefined {
    const video = videoRef.current;
    if (!video?.videoWidth) return undefined;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d")!;
    let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight;
    if (hand) {
      const xs = hand.landmarks.map((p) => p.x * video.videoWidth);
      const ys = hand.landmarks.map((p) => p.y * video.videoHeight);
      const pad = 40;
      const side = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) + pad * 2;
      sx = Math.max(0, (Math.min(...xs) + Math.max(...xs)) / 2 - side / 2);
      sy = Math.max(0, (Math.min(...ys) + Math.max(...ys)) / 2 - side / 2);
      sw = sh = Math.min(side, video.videoWidth - sx, video.videoHeight - sy);
    }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, size, size);
    return c.toDataURL("image/jpeg", 0.8);
  }

  return { videoRef, canvasRef, status, error, lighting, enhancing, snapshot };
}
