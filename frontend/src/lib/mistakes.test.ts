import { test } from "node:test";
import assert from "node:assert/strict";
import { mistakeCount, recordMistake, weakFingers, type Mistakes } from "./mistakes.ts";

test("counts each error per letter and remembers when", () => {
  let m: Mistakes = {};
  m = recordMistake(m, "A", "thumb:placement", 100);
  m = recordMistake(m, "A", "thumb:placement", 200);
  m = recordMistake(m, "Y", "pinky:curl", 300);
  assert.equal(mistakeCount(m, "A", "thumb:placement"), 2);
  assert.equal(mistakeCount(m, "A", "index:curl"), 0);
  assert.equal(m.A?.["thumb:placement"]?.lastAt, 200);
});

test("does not mutate the previous object", () => {
  const before: Mistakes = {};
  recordMistake(before, "A", "thumb:placement");
  assert.deepEqual(before, {});
});

test("weakFingers sums across letters, most first", () => {
  let m: Mistakes = {};
  m = recordMistake(m, "A", "thumb:placement");
  m = recordMistake(m, "S", "thumb:curl");
  m = recordMistake(m, "Y", "pinky:curl");
  assert.deepEqual(weakFingers(m), [{ finger: "thumb", count: 2 }, { finger: "pinky", count: 1 }]);
});
