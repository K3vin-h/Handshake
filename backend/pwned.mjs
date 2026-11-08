import { createHash } from "node:crypto";

// Pwned Passwords range API (k-anonymity): only the first 5 hex chars of the SHA-1 leave this process.
// Fails open: any error, timeout or non-OK answer means "not known to be breached". Logs nothing.
export async function isBreached(password, { fetchImpl = fetch, timeoutMs = 3000 } = {}) {
  try {
    const hash = createHash("sha1").update(String(password).normalize("NFKC")).digest("hex").toUpperCase();
    const res = await fetchImpl(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return false;
    const suffix = hash.slice(5);
    return (await res.text()).split("\n").some((line) => {
      const [s, count] = line.trim().split(":");
      return s === suffix && Number(count) > 0;
    });
  } catch {
    return false;
  }
}
