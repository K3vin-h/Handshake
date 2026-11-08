const KEY = "handshake.learner.v1";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let memory: string | null = null;

/** Anonymous stats identity. Profile names and emails are never used. */
export function learnerId(): string {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && UUID_RE.test(saved)) return (memory = saved);
    memory ??= crypto.randomUUID();
    localStorage.setItem(KEY, memory);
  } catch {
    // A blocked storage API still gets one stable id for this page session.
    memory ??= crypto.randomUUID();
  }
  return memory;
}
