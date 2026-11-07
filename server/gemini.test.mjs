import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateWithRetry } from './gemini.mjs';

for (const status of [429, 500, 502, 503, 504]) test(`retries ${status} with exponential jitter, at most three retries`, async () => {
  let calls = 0; const delays = []; const logs = [];
  const ai = { models: { generateContent: async () => { calls++; throw Object.assign(new Error('SECRET in URL'), { status }); } } };
  await assert.rejects(generateWithRetry(ai, {}, { sleep: async ms => delays.push(ms), random: () => 0.5, logger: entry => logs.push(entry) }));
  assert.equal(calls, 4);
  assert.deepEqual(delays, [100, 200, 400]);
  assert.equal(logs.length, 4);
  assert.doesNotMatch(JSON.stringify(logs), /SECRET|URL/);
});

test('does not retry permanent failures', async () => {
  let calls = 0;
  await assert.rejects(generateWithRetry({ models: { generateContent: async () => { calls++; throw Object.assign(new Error('secret'), { status: 403 }); } } }, {}, { logger: () => {} }));
  assert.equal(calls, 1);
});

test('returns a later success without further attempts', async () => {
  let calls = 0;
  const result = await generateWithRetry({ models: { generateContent: async () => { if (++calls === 1) throw { status: 503 }; return { text: 'live' }; } } }, {}, { sleep: async () => {}, logger: () => {} });
  assert.equal(result.text, 'live'); assert.equal(calls, 2);
});

test('aborts stalled attempts and respects the total deadline', async () => {
  const start = Date.now();
  await assert.rejects(generateWithRetry({ models: { generateContent: () => new Promise(() => {}) } }, {}, { timeoutMs: 40, attemptTimeoutMs: 15, sleep: async () => {}, logger: () => {} }));
  assert.ok(Date.now() - start < 200);
});

test('uses local abort timing without an invalid short Google server deadline', async () => {
  await generateWithRetry({ models: { generateContent: async request => {
    assert.equal(request.config.httpOptions.timeout, undefined);
    assert.equal(request.config.httpOptions.retryOptions.attempts, 1);
    assert.ok(request.config.abortSignal instanceof AbortSignal);
    return { text: 'ok' };
  } } }, {});
});
