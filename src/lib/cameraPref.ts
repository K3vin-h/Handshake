import { useSyncExternalStore } from "react";

// Camera on/off, remembered in this browser and shared by every screen that shows a camera.
const KEY = "handshake.camera.v1";
const subs = new Set<() => void>();
let on = true;
try { on = localStorage.getItem(KEY) !== "off"; } catch { /* session only */ }

export function setCameraOn(v: boolean) {
  on = v;
  try { localStorage.setItem(KEY, v ? "on" : "off"); } catch { /* session only */ }
  subs.forEach((f) => f());
}

export function useCameraOn(): [boolean, (v: boolean) => void] {
  const v = useSyncExternalStore((f) => (subs.add(f), () => void subs.delete(f)), () => on);
  return [v, setCameraOn];
}
