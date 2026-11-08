import test from "node:test";
import assert from "node:assert/strict";
import { authErrorField, authMessage } from "./authErrors.ts";

test("maps known codes verbatim and falls back", () => {
  assert.equal(authMessage("email_taken"), "That email already has an account. Log in instead.");
  assert.equal(authMessage("http_429"), authMessage("rate_limited"));
  assert.equal(authMessage("network"), "Can't reach the server. Try again.");
  assert.equal(authMessage("zzz"), "Something went wrong. Try again.");
  assert.equal(authErrorField("email_taken"), "email");
  assert.equal(authErrorField("invalid_credentials"), "password");
  assert.equal(authErrorField("network"), "form");
});
