import test from "node:test";
import assert from "node:assert/strict";
import { authErrorField, authMessage } from "./authErrors.ts";

test("maps known codes verbatim and falls back", () => {
  assert.equal(authMessage("email_taken"), "That email already has an account. Log in instead.");
  assert.equal(authMessage("http_429"), authMessage("rate_limited"));
  assert.equal(authMessage("network"), "Can't reach the server. Try again.");
  assert.equal(authMessage("zzz"), "Something went wrong. Try again.");
  assert.equal(authMessage("invalid_token"), "This link has expired. Ask for a new one.");
  assert.equal(authMessage("invalid_token", "google"), "Google sign-in didn't work. Try again.");
  assert.equal(authMessage("network", "google"), "Can't reach the server. Try again.");
  assert.equal(authMessage("breached_password"), "That password appears in known data breaches. Choose a different one.");
  assert.equal(authErrorField("breached_password"), "password");
  assert.equal(authMessage("obvious_password"), "That password is too easy to guess. Avoid your email name or the app name.");
  assert.equal(authErrorField("obvious_password"), "password");
  assert.equal(authErrorField("email_taken"), "email");
  assert.equal(authErrorField("invalid_credentials"), "password");
  assert.equal(authErrorField("network"), "form");
});
