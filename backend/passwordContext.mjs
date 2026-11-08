// Context-specific passwords NIST SP 800-63B says to refuse: the service name, the email's own name, trivial runs.
export function tooObvious(password, email) {
  const p = String(password).normalize("NFKC").toLowerCase();
  const local = String(email ?? "").split("@")[0].trim().toLowerCase();
  if (p.includes("handshake") || (local.length >= 6 && p.includes(local) && (local.length * 2 >= p.length || p.startsWith(local) || p.endsWith(local)))) return true;
  const c = [...p].map((ch) => ch.codePointAt(0));
  return c.every((x) => x === c[0]) || c.every((x, i) => i === 0 || x === c[i - 1] + 1); // "aaaa…", "1234…"
}
