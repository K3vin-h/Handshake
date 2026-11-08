import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';

// A separate process exercises the actual production entry point and injected port.
test('production server exposes health and rejects missing/wrong bearer tokens', async (t) => {
  const probe = createServer().listen(0); // ask the OS for a free port instead of hardcoding one
  await once(probe, 'listening');
  const port = probe.address().port;
  probe.close();
  await once(probe, 'close');
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('.', import.meta.url),
    env: { ...process.env, PORT: String(port), AGENT_TOKEN: 'test-only-secret', GEMINI_API_KEY: 'not-a-live-key', APP_URL: 'https://app.invalid' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => child.kill());
  const listening = new Promise((resolve) => child.stdout.on('data', (d) => /planner agent on :/.test(String(d)) && resolve()));
  await Promise.race([listening, once(child, 'exit').then(() => { throw new Error('server exited before listening'); })]);
  const origin = `http://127.0.0.1:${port}`;
  assert.equal((await fetch(`${origin}/health`)).status, 200);
  for (const authorization of ['', 'Bearer wrong']) {
    const response = await fetch(`${origin}/plan`, { method: 'POST', headers: { authorization } });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'unauthorized' });
  }
  const invalid = await fetch(`${origin}/plan`, {
    method: 'POST', headers: { authorization: 'Bearer test-only-secret', 'Content-Type': 'application/json' },
    body: JSON.stringify({ learnerId: '../private', candidates: [{ id: 'My private name', letters: ['I'] }], knownLetters: ['I'] }),
  });
  assert.equal(invalid.status, 400);
});
