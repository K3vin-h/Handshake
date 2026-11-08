import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { isBreached } from "./pwned.mjs";
import { tooObvious } from "./passwordContext.mjs";

const PW = "correct-horse-battery";
const sha = createHash("sha1").update(PW.normalize("NFKC")).digest("hex").toUpperCase();
const [prefix, suffix] = [sha.slice(0, 5), sha.slice(5)];
const reply = (text, ok = true) => async () => ({ ok, status: ok ? 200 : 500, text: async () => text });

test("breached suffix is true; only the 5-char prefix is sent", async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => { calls.push([url, opts]); return { ok: true, text: async () => `AAAA:2\r\n${suffix}:42\r\n` }; };
  assert.equal(await isBreached(PW, { fetchImpl }), true);
  const [url, opts] = calls[0];
  assert.equal(url, `https://api.pwnedpasswords.com/range/${prefix}`);
  assert.equal(opts.headers["Add-Padding"], "true");
  const sent = JSON.stringify([url, opts.headers]);
  for (const s of [suffix, sha, PW]) assert.ok(!sent.includes(s));
});

test("padded zero-count entry and not-found are false", async () => {
  assert.equal(await isBreached(PW, { fetchImpl: reply(`${suffix}:0\r\nBBBB:5`) }), false);
  assert.equal(await isBreached(PW, { fetchImpl: reply("BBBB:5") }), false);
});

test("fails open on rejection, non-ok and timeout", async () => {
  assert.equal(await isBreached(PW, { fetchImpl: async () => { throw new Error("down"); } }), false);
  assert.equal(await isBreached(PW, { fetchImpl: reply(`${suffix}:9`, false) }), false);
  const hang = (_u, { signal }) => new Promise((_, rej) => signal.addEventListener("abort", () => rej(new Error("aborted"))));
  assert.equal(await isBreached(PW, { fetchImpl: hang, timeoutMs: 20 }), false);
});

test("tooObvious", () => {
  assert.equal(tooObvious("My-Handshake-1", "a@b.co"), true);
  assert.equal(tooObvious("xxMARATHONxx9", "marathon@example.com"), true);
  assert.equal(tooObvious("aaaaaaaaaaaa", "a@b.co"), true);
  assert.equal(tooObvious("0123456789", "a@b.co"), true);
  assert.equal(tooObvious("abcdefghijkl", "a@b.co"), true);
  assert.equal(tooObvious("ryan-is-here-1", "ryan@example.com"), true);
  assert.equal(tooObvious("abc-is-here-12", "abc@example.com"), false, "local part under 4 chars is ignored");
  assert.equal(tooObvious(PW, "ryan@example.com"), false);
  assert.equal(tooObvious("some-long-password", undefined), false);
});
