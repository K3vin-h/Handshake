// Lighting: measure frame brightness, and when it's too dark, run OpenCV.js CLAHE
// (contrast-limited adaptive histogram equalization) on the lightness channel
// before MediaPipe sees the frame. OpenCV.js is several MB, so it is only loaded
// the first time a dark frame shows up.

const OPENCV_URL = "https://docs.opencv.org/4.10.0/opencv.js";
export const DARK_THRESHOLD = 70; // average luminance 0..255
export const BRIGHT_THRESHOLD = 225;

export type LightingStatus = "ok" | "dark" | "bright";

const probe = document.createElement("canvas");
probe.width = 32;
probe.height = 24;
const probeCtx = probe.getContext("2d", { willReadFrequently: true })!;

/** Average luminance of a tiny downscaled copy of the frame (cheap). */
export function measureBrightness(source: CanvasImageSource): number {
  probeCtx.drawImage(source, 0, 0, probe.width, probe.height);
  const d = probeCtx.getImageData(0, 0, probe.width, probe.height).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  return sum / (d.length / 4);
}

export function classifyBrightness(b: number): LightingStatus {
  return b < DARK_THRESHOLD ? "dark" : b > BRIGHT_THRESHOLD ? "bright" : "ok";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CV = any;
let cvPromise: Promise<CV> | null = null;

export function loadOpenCV(): Promise<CV> {
  if (cvPromise) return cvPromise;
  cvPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = OPENCV_URL;
    s.async = true;
    s.onerror = () => reject(new Error("OpenCV.js failed to load"));
    s.onload = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let cv: CV = (window as any).cv;
      if (cv instanceof Promise) cv = await cv;
      if (cv.Mat) resolve(cv);
      else cv.onRuntimeInitialized = () => resolve(cv);
    };
    document.head.appendChild(s);
  });
  return cvPromise;
}

/**
 * Draws a contrast-enhanced copy of `video` into `out` using CLAHE on the
 * L channel of LAB (keeps colours natural, brightens shadows on the hand).
 */
export function enhanceFrame(cv: CV, video: HTMLVideoElement, work: HTMLCanvasElement, out: HTMLCanvasElement) {
  work.width = out.width = video.videoWidth;
  work.height = out.height = video.videoHeight;
  work.getContext("2d")!.drawImage(video, 0, 0);

  const src = cv.imread(work);
  const rgb = new cv.Mat();
  const lab = new cv.Mat();
  const channels = new cv.MatVector();
  const clahe = new cv.CLAHE(2.5, new cv.Size(8, 8));
  try {
    cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
    cv.cvtColor(rgb, lab, cv.COLOR_RGB2Lab);
    cv.split(lab, channels);
    const l = channels.get(0);
    clahe.apply(l, l);
    channels.set(0, l);
    l.delete();
    cv.merge(channels, lab);
    cv.cvtColor(lab, rgb, cv.COLOR_Lab2RGB);
    cv.cvtColor(rgb, src, cv.COLOR_RGB2RGBA);
    cv.imshow(out, src);
  } finally {
    src.delete();
    rgb.delete();
    lab.delete();
    channels.delete();
    clahe.delete();
  }
}

/** Ask the camera for 720p and automatic exposure / white balance where supported (mostly Chrome). */
export async function openCamera(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: "user" },
    audio: false,
  });
  const track = stream.getVideoTracks()[0];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const caps: any = track.getCapabilities?.() ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const advanced: any[] = [];
  if (caps.exposureMode?.includes("continuous")) advanced.push({ exposureMode: "continuous" });
  if (caps.whiteBalanceMode?.includes("continuous")) advanced.push({ whiteBalanceMode: "continuous" });
  if (caps.focusMode?.includes("continuous")) advanced.push({ focusMode: "continuous" });
  if (advanced.length) await track.applyConstraints({ advanced }).catch(() => {});
  return stream;
}
