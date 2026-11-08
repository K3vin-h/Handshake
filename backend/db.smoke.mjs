import "./env.mjs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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
    console.log("db smoke ok");
  } catch {
    console.error("Database smoke test failed. Check service access, migration and aggregate results.");
    process.exitCode = 1;
  } finally { await db.close(); }
}
