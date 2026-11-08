import type { RefObject } from "react";
import type { LightingStatus } from "../cv";
import { useCameraOn } from "../lib/cameraPref";

/** Mirrored webcam with the hand skeleton drawn on top, plus lighting hints. */
export function Camera(props: {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  status: "loading" | "ready" | "error" | "off";
  error?: string;
  progress?: number; // 0..1 hold progress
  lighting?: LightingStatus;
  enhancing?: boolean;
}) {
  const { videoRef, canvasRef, status, error, progress = 0, lighting = "ok", enhancing } = props;
  const [camOn, setCamOn] = useCameraOn();
  return (
    <div className="camera">
      <video ref={videoRef} playsInline muted aria-label="Your camera, mirrored" />
      <canvas ref={canvasRef} aria-hidden="true" />
      {progress > 0 && <div className="hold-bar" aria-hidden="true" style={{ width: `${progress * 100}%` }} />}
      {status === "off" && <div className="camera-msg" role="status">Camera is off. Turn it on to practise with live checking.</div>}
      <button type="button" className="camera-toggle secondary" aria-pressed={camOn} onClick={() => setCamOn(!camOn)}>
        {camOn ? "Turn camera off" : "Turn camera on"}
      </button>
      {status === "loading" && <div className="camera-msg" role="status">Loading hand tracking…</div>}
      {status === "error" && <div className="camera-msg" role="alert">Camera error: {error}</div>}
      {status === "ready" && lighting !== "ok" && (
        <div className="light-hint" role="status">
          {lighting === "dark"
            ? `It's dark here: face a light source${enhancing ? " (boosting contrast)" : ""}`
            : "Too bright: move away from the window or bright light behind you"}
        </div>
      )}
    </div>
  );
}
