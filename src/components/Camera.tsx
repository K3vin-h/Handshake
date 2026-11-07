import type { RefObject } from "react";
import type { LightingStatus } from "../cv";

/** Mirrored webcam with the hand skeleton drawn on top, plus lighting hints. */
export function Camera(props: {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  status: "loading" | "ready" | "error";
  error?: string;
  progress?: number; // 0..1 hold progress
  lighting?: LightingStatus;
  enhancing?: boolean;
}) {
  const { videoRef, canvasRef, status, error, progress = 0, lighting = "ok", enhancing } = props;
  return (
    <div className="camera">
      <video ref={videoRef} playsInline muted />
      <canvas ref={canvasRef} />
      {progress > 0 && <div className="hold-bar" style={{ width: `${progress * 100}%` }} />}
      {status === "loading" && <div className="camera-msg">Loading hand tracking…</div>}
      {status === "error" && <div className="camera-msg">Camera error: {error}</div>}
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
