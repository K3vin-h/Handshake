import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, DUMMY_HASH } from "./password.mjs";

test("hash then verify is true", async () => {
  const h = await hashPassword("correct horse battery");
  assert.equal(await verifyPassword("correct horse battery", h), true);
});

test("wrong password is false", async () => {
  const h = await hashPassword("correct horse battery");
  assert.equal(await verifyPassword("wrong horse battery", h), false);
});

test("same password hashes differently (salt)", async () => {
  assert.notEqual(await hashPassword("same-password-1"), await hashPassword("same-password-1"));
});

test("stored format is scrypt$16384$8$1$...", async () => {
  assert.ok((await hashPassword("some-password-1")).startsWith("scrypt$16384$8$1$"));
});

test("garbage stored value is false and does not throw", async () => {
  assert.equal(await verifyPassword("x", "garbage"), false);
});

test("DUMMY_HASH never verifies a real password", async () => {
  assert.equal(await verifyPassword("a real password", DUMMY_HASH), false);
});
