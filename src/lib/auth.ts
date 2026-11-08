import type { Profile } from "./profile.ts";
import type { Progress } from "./progress.ts";

export type User = { email: string; hasPassword: boolean; google: boolean };
export type ServerState = { profile: Profile | null; progress: Progress; rev: number };
export type Fail = { ok: false; error: string; state?: ServerState };
export type Result<T = object> = ({ ok: true } & T) | Fail;

let user: User | null = null;
const listeners = new Set<(u: User | null) => void>();
export const getUser = () => user;
export function subscribe(fn: (u: User | null) => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
function setUser(u: User | null) {
  user = u;
  listeners.forEach((f) => f(u));
}

/** Never throws. Error code comes from the server's `error` field, "network" when fetch throws. */
async function call(method: string, path: string, body?: unknown): Promise<Result<{ data: any }>> {
  try {
    const res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      if (data?.error === "unauthenticated") setUser(null); // session gone (reset, revoked, expired)
      return { ok: false, error: data?.error ?? `http_${res.status}`, ...(data?.state ? { state: data.state } : {}) };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: "network" };
  }
}

const withUser = (r: Result<{ data: any }>): Result<{ user: User }> => {
  if (!r.ok) return r;
  setUser(r.data.user);
  return { ok: true, user: r.data.user };
};
const plain = async (method: string, path: string, body?: unknown): Promise<Result> => {
  const r = await call(method, path, body);
  return r.ok ? { ok: true } : r;
};

export async function getAuthConfig(): Promise<Result<{ accounts: boolean; googleClientId: string | null; resetEmail: boolean }>> {
  const r = await call("GET", "/api/auth/config");
  return r.ok ? { ok: true, ...r.data } : r;
}
export async function getMe(): Promise<Result<{ user: User; state: ServerState | null }>> {
  const r = await call("GET", "/api/me");
  if (!r.ok) return r;
  setUser(r.data.user);
  return { ok: true, user: r.data.user, state: r.data.state ?? null };
}
export const signUp = async (email: string, password: string) => withUser(await call("POST", "/api/auth/signup", { email, password }));
export const logIn = async (email: string, password: string) => withUser(await call("POST", "/api/auth/login", { email, password }));
export async function loginWithGoogle(credential: string): Promise<Result<{ user: User; isNew: boolean }>> {
  const r = await call("POST", "/api/auth/google", { credential });
  const u = withUser(r);
  return u.ok && r.ok ? { ...u, isNew: !!r.data.isNew } : (u as Fail);
}
export async function logOut() {
  const r = await plain("POST", "/api/auth/logout");
  if (r.ok) setUser(null);
  return r;
}
export const forgot = (email: string) => plain("POST", "/api/auth/forgot", { email });
export const resetPassword = (token: string, password: string) => plain("POST", "/api/auth/reset", { token, password });
export async function deleteAccount() {
  const r = await plain("DELETE", "/api/me");
  if (r.ok) setUser(null);
  return r;
}
/** 409 comes back as { ok:false, error:"conflict", state }. */
export async function pushState(s: { profile: Profile | null; progress: Progress }, baseRev: number): Promise<Result<{ rev: number }>> {
  const r = await call("PUT", "/api/me/state", { ...s, baseRev });
  return r.ok ? { ok: true, rev: r.data.rev } : r;
}
