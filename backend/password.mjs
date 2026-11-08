import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const N = 16384, R = 8, P = 1, KEYLEN = 64; // 16 MiB per hash, inside Node's 32 MiB default maxmem
export const MIN_PASSWORD = 10;
export const MAX_PASSWORD = 128;
const norm = (s) => String(s).normalize("NFKC");

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(norm(password), salt, KEYLEN, { N, r: R, p: P });
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password, stored) {
  try {
    const [alg, n, r, p, salt, hash] = String(stored).split("$");
    if (alg !== "scrypt" || !salt || !hash) return false;
    const expected = Buffer.from(hash, "base64");
    const key = await scryptAsync(norm(password), Buffer.from(salt, "base64"), expected.length, { N: +n, r: +r, p: +p });
    return key.length === expected.length && timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

// Verified against when an email is unknown, so login takes the same time either way.
export const DUMMY_HASH = await hashPassword("handshake-dummy-password");
