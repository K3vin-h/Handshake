export async function sendResetEmail({ to, link }, { apiKey, from, fetchImpl = fetch }) {
  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from, to: [to], subject: "Reset your Handshake password",
        text: `Use this link within 30 minutes to choose a new password:\n${link}\n\nIf you did not ask for this, ignore this email.`,
        html: `<p>Use this link within 30 minutes to choose a new password:</p><p><a href="${link}">Reset my password</a></p><p>If you did not ask for this, ignore this email.</p>`,
      }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false; // never log the address or the link
  }
}
