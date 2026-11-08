export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const ITEM_RE = /^[A-Z][A-Z0-9_-]{0,19}$/; // letters and sign ids; "fs:LILY" (may be a name) never matches
export const CODE_RE = /^[a-z]+:[a-z]+$/;
export const LESSON_RE = /^\d+\.\d+$/;
export const NAME_RE = /^[\p{L} '-]{1,40}$/u;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]+$/;

export const isEmail = (s) => typeof s === "string" && s.length <= 254 && EMAIL_RE.test(s);
export const isLetters = (a, max) => Array.isArray(a) && a.length <= max && a.every((c) => typeof c === "string" && /^[A-Z]$/.test(c));
