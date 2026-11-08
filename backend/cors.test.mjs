import { test } from "node:test";
import assert from "node:assert/strict";
import { serve } from "./testutil.mjs";
import { cors } from "./cors.mjs";

const OK = "https://app.vercel.example";
const call = (s, origin, method = "GET") => fetch(s.base + "/ping", { method, headers: origin ? { Origin: origin } : {} });

test("only listed origins get CORS headers; preflight answers 204", async () => {
  const s = await serve((app) => { app.use(cors(`${OK}/, https://other.example`)); app.get("/ping", (_q, r) => r.json({ ok: true })); });
  try {
    const hit = await call(s, OK);
    assert.equal(hit.headers.get("access-control-allow-origin"), OK);
    assert.equal(hit.headers.get("vary"), "Origin");
    assert.equal((await call(s, "https://evil.example")).headers.get("access-control-allow-origin"), null);
    assert.equal((await call(s)).headers.get("access-control-allow-origin"), null);
    const pre = await call(s, OK, "OPTIONS");
    assert.equal(pre.status, 204);
    assert.match(pre.headers.get("access-control-allow-methods"), /POST/);
    const evil = await call(s, "https://evil.example", "OPTIONS"); // not answered by us: no CORS headers
    assert.equal(evil.headers.get("access-control-allow-origin"), null);
    assert.equal(evil.headers.get("access-control-allow-methods"), null);
  } finally { await s.close(); }
});

test("unset ALLOWED_ORIGIN adds no CORS headers", async () => {
  const s = await serve((app) => { app.use(cors("")); app.get("/ping", (_q, r) => r.json({ ok: true })); });
  try { assert.equal((await call(s, OK)).headers.get("access-control-allow-origin"), null); } finally { await s.close(); }
});
