// Steps still to do in a lesson (skipped + not reached yet), kept in localStorage so leaving a lesson never
// means redoing the steps already matched. Items are plain data (see `Item` in LessonPlayer).
const KEY = "handshake.lessonRedo.v1";
type Store = Record<string, unknown[]>;

const read = (): Store => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; }
};
const write = (s: Store) => {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable: lasts for this session only */ }
};

export const loadRedo = <T,>(lessonId: string): T[] | null => {
  const left = read()[lessonId];
  return Array.isArray(left) && left.length ? (left as T[]) : null;
};
export function saveRedo(lessonId: string, left: unknown[]) {
  const s = read();
  if (left.length) s[lessonId] = left; else delete s[lessonId];
  write(s);
}
export const clearRedo = (lessonId: string) => saveRedo(lessonId, []);
