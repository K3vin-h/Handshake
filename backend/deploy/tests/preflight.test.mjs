import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const run = (...args) => spawnSync('bash', ['deploy/preflight.sh', ...args], { encoding: 'utf8' });
const revision = 'a'.repeat(40);
test('requires an immutable full revision', () => {
  assert.notEqual(run('demo.example.org', 'https://github.com/org/repo.git', 'main').status, 0);
});
test('rejects credentials, query strings and shell-like or empty domain labels', () => {
  for (const url of ['https://token@github.com/org/repo.git', 'https://github.com/org/repo.git?token=x'])
    assert.notEqual(run('demo.example.org', url, revision).status, 0);
  for (const domain of ['a..org', '-a.org', 'a-.org', 'a.org;evil'])
    assert.notEqual(run(domain, 'https://github.com/org/repo.git', revision).status, 0);
});
test('accepts a normal domain and credential-free repository with pinned revision', () => {
  const result = run('demo.example.org', 'https://github.com/org/repo.git', revision);
  assert.equal(result.status, 0, result.stderr);
});
test('accepts a free sslip.io hostname for the API (no purchased domain needed)', () => {
  assert.equal(run('203-0-113-10.sslip.io', 'https://github.com/org/repo.git', revision).status, 0);
});
