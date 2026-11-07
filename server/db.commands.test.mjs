import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

for (const script of ["migrate.mjs", "db.smoke.mjs"]) {
  test(`${script}: missing configuration exits nonzero with setup guidance`, () => {
    const result = spawnSync(process.execPath, [new URL(script, import.meta.url).pathname], {
      env: { ...process.env, DATABASE_URL: "" }, encoding: "utf8", timeout: 5000,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Set DATABASE_URL in .env first/);
    assert.doesNotMatch(result.stdout, /schema applied|db smoke ok/);
  });

  test(`${script}: unreachable service fails without exposing credentials`, () => {
    const result = spawnSync(process.execPath, [new URL(script, import.meta.url).pathname], {
      env: { ...process.env, DATABASE_URL: "postgres://private:password@127.0.0.1:1/db" },
      encoding: "utf8", timeout: 5000,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /failed/);
    assert.doesNotMatch(result.stdout + result.stderr, /private|password|postgres:\/\//);
  });
}
