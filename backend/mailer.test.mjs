import { test } from "node:test";
import assert from "node:assert/strict";
import { sendResetEmail } from "./mailer.mjs";

const args = { to: "a@b.co", link: "https://x.test/reset?t=abc" };
const cfg = { apiKey: "k123", from: "Handshake <no@x.test>" };

test("posts to Resend with bearer, to array, link in both bodies", async () => {
  let url, init;
  const fetchImpl = async (u, i) => ((url = u), (init = i), { ok: true });
  assert.equal(await sendResetEmail(args, { ...cfg, fetchImpl }), true);
  assert.equal(url, "https://api.resend.com/emails");
  assert.equal(init.headers.Authorization, "Bearer k123");
  const b = JSON.parse(init.body);
  assert.deepEqual(b.to, ["a@b.co"]);
  assert.ok(b.text.includes(args.link) && b.html.includes(args.link));
});

test("rejecting fetch returns false without throwing", async () => {
  const fetchImpl = async () => { throw new Error("boom"); };
  assert.equal(await sendResetEmail(args, { ...cfg, fetchImpl }), false);
});

test("{ ok: false } returns false", async () => {
  assert.equal(await sendResetEmail(args, { ...cfg, fetchImpl: async () => ({ ok: false }) }), false);
});
