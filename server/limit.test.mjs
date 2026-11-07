import { test } from "node:test";
import assert from "node:assert/strict";
import { rateLimit } from "./limit.mjs";

function run(mw, ip = "1.1.1.1") {
  let status = 200;
  let body = null;
  let nexted = false;
  const res = {
    status(c) {
      status = c;
      return this;
    },
    json(b) {
      body = b;
      return this;
    },
  };
  mw({ ip }, res, () => {
    nexted = true;
  });
  return { status, body, nexted };
}

test("blocks the request after max hits in the window", () => {
  const mw = rateLimit({ windowMs: 1000, max: 2, now: () => 0 });
  assert.ok(run(mw).nexted);
  assert.ok(run(mw).nexted);
  const third = run(mw);
  assert.equal(third.nexted, false);
  assert.equal(third.status, 429);
  assert.deepEqual(third.body, { error: "rate_limited" });
});

test("allows again after the window passes", () => {
  let t = 0;
  const mw = rateLimit({ windowMs: 1000, max: 1, now: () => t });
  assert.ok(run(mw).nexted);
  assert.equal(run(mw).nexted, false);
  t = 1000;
  assert.ok(run(mw).nexted);
});

test("counts each IP separately", () => {
  const mw = rateLimit({ windowMs: 1000, max: 1, now: () => 0 });
  assert.ok(run(mw, "1.1.1.1").nexted);
  assert.ok(run(mw, "2.2.2.2").nexted);
});

test("bounds tracked IPs without evicting active limits and frees expired entries", () => {
  let t = 0;
  const mw = rateLimit({ windowMs: 1000, max: 1, now: () => t });
  for (let i = 0; i < 5000; i++) assert.ok(run(mw, `ip-${i}`).nexted);
  assert.equal(run(mw, "new-ip").status, 429);
  assert.equal(run(mw, "ip-0").status, 429);
  t = 1000;
  assert.ok(run(mw, "new-ip").nexted);
});
