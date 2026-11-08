/** Mirrors NAME_RE in server/validate.mjs. Keep the two identical. */
export const NAME_RE = /^[\p{L} '-]{1,40}$/u;
export const validName = (s: unknown): s is string => typeof s === "string" && NAME_RE.test(s);

/** Make typed text acceptable to the server: curly apostrophes to ', drop other characters, tidy spaces, cap 40. */
export const cleanName = (s: string): string =>
  s.replace(/[‘’]/g, "'").replace(/[^\p{L} '-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 40).trim();
