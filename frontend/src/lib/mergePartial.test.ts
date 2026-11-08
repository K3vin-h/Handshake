import { test } from "node:test";
import assert from "node:assert/strict";
import type { Progress } from "./progress.ts";
import { mergeProgress } from "./merge.ts";

const P = (o: Partial<Progress> = {}): Progress => ({ xp: 0, streakDays: 0, lastActiveDay: null, completed: [], items: {}, ...o });

test("merge keeps the larger partial share and drops it once completed", () => {
  const r = mergeProgress(P({ partial: { "1.1": 0.4, "1.2": 0.5 } }), P({ partial: { "1.1": 0.7 }, completed: ["1.2"] }));
  assert.deepEqual(r.partial, { "1.1": 0.7 });
});
