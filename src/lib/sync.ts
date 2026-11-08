import { getMe, getUser, pushState } from "./auth.ts";
import { mergeState } from "./merge.ts";
import { validName } from "./nameRule.ts";
import type { Profile } from "./profile.ts";
import type { Progress } from "./progress.ts";

type IO = {
  loadProfile(): Profile | null;
  saveProfile(p: Profile): void;
  loadProgress(): Progress;
  saveProgress(p: Progress): void;
};
// Loaded lazily so Node tests can inject a fake (profile.ts/progress.ts pull in the whole app graph).
let io: IO | null = null;
const getIO = async (): Promise<IO> => (io ??= { ...(await import("./profile")), ...(await import("./progress")) });
export const _setIO = (x: IO) => { io = x; }; // test hook
let delay = 2000;
export const _setDelay = (ms: number) => { delay = ms; }; // test hook

let rev = 0; // last known server rev; 0 = server has no state yet
let applyingRemote = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let started = false;
let running: Promise<void> = Promise.resolve();

async function local() {
  const m = await getIO();
  return { profile: m.loadProfile(), progress: m.loadProgress() };
}

async function applyLocal(s: { profile: Profile | null; progress: Progress }) {
  const m = await getIO();
  applyingRemote = true; // our own saves must not echo back as a push
  try {
    if (s.profile) m.saveProfile(s.profile);
    m.saveProgress(s.progress);
  } finally {
    applyingRemote = false;
  }
}

async function push(retry = true): Promise<void> {
  if (!getUser()) return; // signed out (e.g. a debounce timer firing after logout)
  const s = await local();
  if (!s.profile) return; // the server rejects a null profile with 400
  if (!validName(s.profile.userName) || !validName(s.profile.theirName)) return; // the server would 400 it
  const r = await pushState(s, rev);
  if (r.ok) { rev = r.rev; return; }
  if (r.error === "conflict" && r.state && retry) {
    rev = r.state.rev;
    await applyLocal(mergeState(s, r.state));
    await push(false);
  }
}

async function pull(): Promise<void> {
  const me = await getMe();
  if (!me.ok) return;
  if (me.state) {
    rev = me.state.rev;
    await applyLocal(mergeState(await local(), me.state));
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
    timer = setTimeout(() => { running = running.then(() => push().catch(() => {})); }, delay);
  });
  void syncNow();
}
