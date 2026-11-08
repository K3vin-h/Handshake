import { test } from "node:test";
import assert from "node:assert/strict";
import { logIn, signUp, pushState, getMe, getAuthConfig, logOut, getUser } from "./auth.ts";

const reply = (status: number, body?: unknown) => async () =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const use = (f: typeof fetch) => { globalThis.fetch = f; };

test("success returns ok and updates the user store", async () => {
  use(reply(200, { user: { email: "a@b.co", hasPassword: true, google: false } }) as typeof fetch);
  const r = await logIn("a@b.co", "pw");
  assert.deepEqual(r, { ok: true, user: { email: "a@b.co", hasPassword: true, google: false } });
  assert.equal(getUser()?.email, "a@b.co");
  use(reply(204) as typeof fetch);
  assert.deepEqual(await logOut(), { ok: true });
  assert.equal(getUser(), null);
});

test("401 body maps to its error code", async () => {
  use(reply(401, { error: "invalid_credentials" }) as typeof fetch);
  assert.deepEqual(await logIn("a@b.co", "bad"), { ok: false, error: "invalid_credentials" });
});

test("409 on signup is email_taken; 409 on pushState carries the server state", async () => {
  use(reply(409, { error: "email_taken" }) as typeof fetch);
  assert.deepEqual(await signUp("a@b.co", "pw"), { ok: false, error: "email_taken" });
  const state = { profile: null, progress: {}, rev: 4 };
  use(reply(409, { error: "conflict", state }) as typeof fetch);
  assert.deepEqual(await pushState({ profile: null, progress: {} as never }, 3), { ok: false, error: "conflict", state });
});

test("thrown fetch is network, never throws", async () => {
  use((async () => { throw new TypeError("offline"); }) as typeof fetch);
  assert.deepEqual(await getMe(), { ok: false, error: "network" });
  assert.deepEqual(await getAuthConfig(), { ok: false, error: "network" });
});

test("503 maps to accounts_unavailable; non-JSON error falls back to http_<status>", async () => {
  use(reply(503, { error: "accounts_unavailable" }) as typeof fetch);
  assert.deepEqual(await getMe(), { ok: false, error: "accounts_unavailable" });
  use(reply(502) as typeof fetch);
  assert.deepEqual(await getMe(), { ok: false, error: "http_502" });
});
