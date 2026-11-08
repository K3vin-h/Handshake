import { test } from "node:test";
import assert from "node:assert/strict";

let handler: (() => void) | undefined;
(globalThis as any).addEventListener = (_t: string, f: () => void) => { handler = f; };

const { startSync, syncNow, _setIO, _setDelay } = await import("./sync.ts");
const { getUser } = await import("./auth.ts");

const P = { xp: 0, streakDays: 0, lastActiveDay: null, completed: [], items: {} };
const prof = { userName: "Ryan", theirName: "Lily", leftHanded: false };
let profile: any = null;
let puts = 0;
let signedIn = false;
let putReplies: Array<[number, unknown]> = [];
const fire = () => handler!();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

_setDelay(5);
_setIO({
  loadProfile: () => profile,
  saveProfile: (p) => { profile = p; fire(); }, // real saves dispatch the event; the guard must swallow it
  loadProgress: () => P,
  saveProgress: () => fire(),
});
globalThis.fetch = (async (_url: string, init?: RequestInit) => {
  const j = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s });
  if (init?.method === "PUT") { puts++; const [s, b] = putReplies.shift() ?? [200, { rev: 1 }]; return j(s, b); }
  return signedIn ? j(200, { user: { email: "a@b.co", hasPassword: true, google: false }, state: null }) : j(401, { error: "unauthenticated" });
}) as typeof fetch;

test("(c) no PUT when signed out", async () => {
  startSync();
  await wait(20);
  profile = prof;
  fire();
  await wait(30);
  assert.equal(getUser(), null);
  assert.equal(puts, 0);
});

test("(a) no PUT when the profile is null", async () => {
  signedIn = true;
  profile = null;
  await syncNow();
  fire();
  await wait(30);
  assert.ok(getUser());
  assert.equal(puts, 0);
});

test("(b) 409 then 200 is exactly 2 PUTs, no echo push", async () => {
  profile = prof;
  putReplies = [[409, { error: "conflict", state: { profile: prof, progress: P, rev: 5 } }], [200, { rev: 6 }]];
  await syncNow();
  await wait(60);
  assert.equal(puts, 2);
});

test("(d) a debounce armed while signed in sends nothing after logout", async () => {
  const { logOut } = await import("./auth.ts");
  await syncNow();
  assert.ok(getUser());
  profile = prof;
  const before = puts;
  fire();
  await logOut();
  await wait(40);
  assert.equal(getUser(), null);
  assert.equal(puts, before);
});
