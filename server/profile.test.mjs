import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('onboarding offers names and signing hand; practice refresh sends only eligible letters and preserves newer profiles', async () => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const oldFetch = globalThis.fetch;
  const saved = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: k => saved.get(k) ?? null, setItem: (k, v) => saved.set(k, v) } });
  let gatedLetters;
  let originalLetters;
  try {
    const { Onboarding } = await vite.ssrLoadModule('/src/screens/Onboarding.tsx');
    const html = renderToStaticMarkup(createElement(Onboarding));
    assert.match(html, /Your name/);
    assert.match(html, /Their name/);
    assert.match(html, /Your signing hand/);
    assert.match(html, /type="radio"/);
    const profile = await vite.ssrLoadModule('/src/lib/profile.ts');
    const { PRACTICEABLE } = await vite.ssrLoadModule('/src/cv/practiceable.ts');
    gatedLetters = PRACTICEABLE;
    originalLetters = [...PRACTICEABLE];
    PRACTICEABLE.push('B', 'O', 'L'); // Fixture only; never changes the human gate on disk.
    const requests = [];
    globalThis.fetch = async (_url, opts) => {
      const body = JSON.parse(opts.body);
      requests.push(body);
      return { ok: true, json: async () => ({ words: ['BOB'] }) };
    };
    const words = await profile.fetchPracticeWords(profile.DEMO_PROFILE, ['B', 'Z']);
    assert.ok(Object.keys(words).length > 0);
    assert.ok(requests.every(r => Object.keys(r).sort().join() === 'knownLetters,weakLetters'));
    assert.ok(requests.every(r => r.knownLetters.every(l => PRACTICEABLE.includes(l))));
    assert.ok(requests.every(r => r.weakLetters.every(l => r.knownLetters.includes(l))));
    profile.saveProfile(profile.DEMO_PROFILE);
    await profile.refreshPracticeWords();
    assert.ok(profile.loadProfile().practiceWords);
    let release;
    const wait = new Promise(resolve => { release = resolve; });
    globalThis.fetch = async () => { await wait; return { ok: true, json: async () => ({ words: ['BOB'] }) }; };
    const pending = profile.refreshPracticeWords();
    profile.saveProfile({ userName: 'New', theirName: 'Person', leftHanded: true });
    release();
    await pending;
    assert.equal(profile.loadProfile().userName, 'New');
    assert.equal(profile.loadProfile().practiceWords, undefined);
  } finally {
    if (gatedLetters) gatedLetters.splice(0, gatedLetters.length, ...originalLetters);
    globalThis.fetch = oldFetch;
    if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage);
    else delete globalThis.localStorage;
    await vite.close();
  }
});
