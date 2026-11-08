import { getMe, getUser, pushState } from "./auth";
import { mergeState } from "./merge";
import { loadProfile, saveProfile } from "./profile";
import { loadProgress, saveProgress } from "./progress";

let rev = 0; // last known server rev; 0 = server has no state yet
let applyingRemote = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let started = false;
let running: Promise<void> = Promise.resolve();

const local = () => ({ profile: loadProfile(), progress: loadProgress() });

function applyLocal(s: { profile: ReturnType<typeof loadProfile>; progress: ReturnType<typeof loadProgress> }) {
  applyingRemote = true; // our own saves must not echo back as a push
  try {
    if (s.profile) saveProfile(s.profile);
    saveProgress(s.progress);
  } finally {
    applyingRemote = false;
  }
}

async function push(retry = true): Promise<void> {
  const r = await pushState(local(), rev);
  if (r.ok) { rev = r.rev; return; }
  if (r.error === "conflict" && r.state && retry) {
    rev = r.state.rev;
    const merged = mergeState(local(), r.state);
    applyLocal(merged);
    await push(false);
  }
}

async function pull(): Promise<void> {
  const me = await getMe();
  if (!me.ok) return;
  if (me.state) {
    rev = me.state.rev;
    applyLocal(mergeState(local(), me.state));
  } else rev = 0;
  await push();
}

/** Pull, merge, save locally, push. Call after sign-in/sign-up. Failures are swallowed. */
export function syncNow(): Promise<void> {
  running = running.then(() => pull().catch(() => {}));
  return running;
}

/** Call once at startup. */
export function startSync() {
  if (started || typeof addEventListener !== "function") return;
  started = true;
  addEventListener("handshake:state", () => {
    if (applyingRemote || !getUser()) return;
    clearTimeout(timer);
    timer = setTimeout(() => { running = running.then(() => push().catch(() => {})); }, 2000);
  });
  void syncNow();
}
