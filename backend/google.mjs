import { OAuth2Client } from "google-auth-library";
let client;
/** Returns { sub, email, emailVerified } or null. Verifies signature, issuer, audience and expiry. */
export async function verifyGoogleCredential(credential, clientId) {
  client ??= new OAuth2Client();
  const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
  const p = ticket.getPayload();
  return p?.sub && p.email ? { sub: p.sub, email: p.email, emailVerified: p.email_verified === true } : null;
}
