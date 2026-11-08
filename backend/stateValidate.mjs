import { NAME_RE, LESSON_RE } from "./validate.mjs";

const RELATIONSHIPS = ["coworker", "friend", "family", "classmate", "partner"];
const BANNED = new Set(["__proto__", "constructor", "prototype"]);
const isObj = (o) => o !== null && typeof o === "object" && !Array.isArray(o);
const int = (n, max) => Number.isInteger(n) && n >= 0 && n <= max;
const strs = (a, max, re) => Array.isArray(a) && a.length <= max && a.every((s) => typeof s === "string" && re.test(s));
const name = (s) => typeof s === "string" && NAME_RE.test(s);
const KEYS = (o) => Object.keys(o); // own enumerable keys only

function profile(p) {
  if (!isObj(p) || !name(p.userName) || !name(p.theirName) || typeof p.leftHanded !== "boolean") return null;
  const out = { userName: p.userName, theirName: p.theirName, leftHanded: p.leftHanded };
  if (p.relationship !== undefined) {
    if (!RELATIONSHIPS.includes(p.relationship)) return null;
    out.relationship = p.relationship;
  }
  if (p.practiceWords !== undefined) {
    if (!isObj(p.practiceWords) || KEYS(p.practiceWords).length > 12) return null;
    out.practiceWords = {};
    for (const k of KEYS(p.practiceWords)) {
      if (BANNED.has(k) || !LESSON_RE.test(k) || !strs(p.practiceWords[k], 12, /^[A-Za-z]{1,20}$/)) return null;
      out.practiceWords[k] = [...p.practiceWords[k]];
    }
  }
  if (p.wordPack !== undefined) {
    if (!strs(p.wordPack, 30, /^[A-Z_]{1,20}$/)) return null;
    out.wordPack = [...p.wordPack];
  }
  return out;
}

function progress(g) {
  if (!isObj(g) || !int(g.xp, 1_000_000) || !int(g.streakDays, 10_000) || !isObj(g.items)) return null;
  if (!(g.lastActiveDay === null || (typeof g.lastActiveDay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(g.lastActiveDay) && !Number.isNaN(Date.parse(g.lastActiveDay))))) return null;
  if (!strs(g.completed, 60, /^[0-9A-Za-z._:-]{1,30}$/)) return null;
  const keys = KEYS(g.items);
  if (keys.length > 200) return null;
  const items = {};
  for (const k of keys) {
    const v = g.items[k];
    if (BANNED.has(k) || !/^[A-Za-z0-9 :._-]{1,60}$/.test(k) || !isObj(v)) return null;
    if (!["streak", "box", "attempts", "misses"].every((f) => int(v[f], 100_000))) return null;
    if (typeof v.due !== "number" || !Number.isFinite(v.due) || typeof v.mastered !== "boolean") return null;
    items[k] = { streak: v.streak, box: v.box, attempts: v.attempts, misses: v.misses, due: v.due, mastered: v.mastered };
  }
  return { xp: g.xp, streakDays: g.streakDays, lastActiveDay: g.lastActiveDay, completed: [...g.completed], items };
}

// Rebuilds the body from whitelisted keys; null on any violation. The raw object is never stored.
export function validateState(body) {
  if (!isObj(body) || !int(body.baseRev, 1_000_000)) return null;
  const p = profile(body.profile), g = progress(body.progress);
  return p && g ? { profile: p, progress: g, baseRev: body.baseRev } : null;
}
