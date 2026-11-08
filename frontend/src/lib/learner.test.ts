import { test } from "node:test";
import assert from "node:assert/strict";
import { learnerId } from "./learner.ts";

const KEY = "handshake.learner.v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
test("persists an anonymous UUID and replaces a malformed saved id", (t) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const data = new Map([[KEY, "not-an-id"]]);
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
  } });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
    else Reflect.deleteProperty(globalThis, "localStorage");
  });
  const id = learnerId();
  assert.match(id, UUID);
  assert.equal(data.get(KEY), id);
  assert.equal(learnerId(), id);
});

test("keeps the same in-memory UUID when storage is blocked", (t) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("blocked"); } });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
    else Reflect.deleteProperty(globalThis, "localStorage");
  });
  const id = learnerId();
  assert.match(id, UUID);
  assert.equal(learnerId(), id);
});
