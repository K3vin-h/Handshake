import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { createDb } from "./db.mjs";

// Adds three anonymous test attempts under a fresh id, never a real learner's data.
if (!process.env.DATABASE_URL) {
  console.error("Set DATABASE_URL in .env first.");
  process.exitCode = 1;
} else {
  const db = createDb(process.env.DATABASE_URL);
  const id = randomUUID();
  const ts = new Date();
  try {
    await db.insertAttempts(id, [
      { ts, item: "L", correct: true, codes: [] },
      { ts, item: "L", correct: false, codes: ["thumb:placement"] },
      { ts, item: "L", correct: true, codes: [] },
    ]);
    const stats = await db.stats(id);
    assert.equal(stats.daily.length, 1);
    assert.equal(stats.daily[0].day, ts.toISOString().slice(0, 10));
    assert.equal(stats.daily[0].attempts, 3);
    assert.equal(stats.daily[0].accuracy, 2 / 3);
    assert.deepEqual(stats.items, [{ item: "L", attempts: 3, accuracy: 2 / 3 }]);
    assert.deepEqual(await db.stats(randomUUID()), { daily: [], items: [] });
    console.log(JSON.stringify(stats));

    // Accounts: throwaway user, removed at the end (cascade clears the rest).
    const email = `smoke-${randomUUID()}@example.invalid`;
    const user = await db.createUser({ email, passwordHash: "x" });
    assert.ok(user);
    try {
      assert.equal(await db.createUser({ email: email.toUpperCase() }), null);
      assert.equal((await db.findUserByEmail(email.toUpperCase())).id, user.id);
      assert.equal(await db.findUserByGoogleSub("nope-" + id), null);
      const tok = randomBytes(32), future = new Date(Date.now() + 60_000), now = new Date();
      await db.createSession(tok, user.id, future);
      assert.equal((await db.sessionUser(tok, now)).id, user.id);
      assert.equal(await db.sessionUser(tok, new Date(Date.now() + 120_000)), null);
      assert.equal(await db.getState(user.id), null);
      assert.deepEqual(await db.saveState(user.id, { a: 1 }, { p: 1 }, 0), { rev: 1 });
      assert.equal((await db.saveState(user.id, {}, {}, 0)).conflict, true);
      assert.deepEqual(await db.saveState(user.id, { a: 2 }, { p: 2 }, 1), { rev: 2 });
      const stale = await db.saveState(user.id, { a: 3 }, { p: 3 }, 1);
      assert.equal(stale.conflict, true);
      assert.equal(stale.state.rev, 2);
      const rt = randomBytes(32);
      await db.createReset(rt, user.id, future);
      assert.equal(await db.consumeReset(rt, now), user.id);
      assert.equal(await db.consumeReset(rt, now), null);
      await db.setPassword(user.id, "y");
      await db.deleteSession(tok);
      assert.equal(await db.sessionUser(tok, now), null);

      // Google linking: clearPassword drops the hash, a second link on a linked account is refused.
      const sub = "smoke-sub-" + id;
      const linked = await db.linkGoogle(user.id, sub, { clearPassword: true });
      assert.equal(linked.google_sub, sub);
      assert.equal(linked.password_hash, null);
      assert.equal((await db.findUserByGoogleSub(sub)).id, user.id);
      assert.equal(await db.linkGoogle(user.id, sub + "-2"), null);
      const tok2 = randomBytes(32);
      await db.createSession(tok2, user.id, future);
      await db.deleteUserSessions(user.id);
      assert.equal(await db.sessionUser(tok2, now), null);
    } finally { await db.deleteUser(user.id); }
    assert.equal(await db.findUserByEmail(email), null);
    console.log("db smoke ok");
  } catch (e) {
    console.error("Database smoke test failed:", e?.message ?? e);
    process.exitCode = 1;
  } finally { await db.close(); }
}
