// Error code (from auth.ts) -> learner-facing message. Pure so node --test can import it.
const MESSAGES: Record<string, string> = {
  email_taken: "That email already has an account. Log in instead.",
  weak_password: "Use at least 10 characters.",
  invalid_credentials: "Wrong email or password.",
  rate_limited: "Too many tries. Wait a few minutes.",
  http_429: "Too many tries. Wait a few minutes.",
  network: "Can't reach the server. Try again.",
  accounts_unavailable: "Accounts aren't available right now. You can continue without one.",
  invalid_token: "This link has expired. Ask for a new one.",
};
export const authMessage = (code: string) => MESSAGES[code] ?? "Something went wrong. Try again.";
/** Which field an error belongs to (focus + aria-describedby); "form" = shown under the form. */
export const authErrorField = (code: string): "email" | "password" | "form" =>
  code === "email_taken" ? "email" : code === "weak_password" || code === "invalid_credentials" ? "password" : "form";
