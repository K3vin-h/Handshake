import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, readlinkSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const helper = fileURLToPath(new URL('../deploy-release.sh', import.meta.url));
const wrapper = fileURLToPath(new URL('../ssh-command.sh', import.meta.url));
const old = 'a'.repeat(40), next = 'b'.repeat(40), older = 'c'.repeat(40);
const bash = (code, env = {}) => spawnSync('bash', ['-c', code], {
  encoding: 'utf8', env: { ...process.env, ...env, HELPER: helper, WRAPPER: wrapper },
});
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'handshake-release-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const path of ['app', 'state', `releases/${old}/backend`, `releases/${older}/backend`]) mkdirSync(join(root, path), { recursive: true });
  writeFileSync(join(root, 'app/.env'), 'SECRET=unchanged\n');
  writeFileSync(join(root, 'Caddyfile'), 'unchanged');
  symlinkSync(join(root, `releases/${old}/backend`), join(root, 'app/backend'));
  writeFileSync(join(root, 'state/previous'), older + '\n');
  const run = (body, extra = {}) => bash(`
    set -euo pipefail
    source "$HELPER"
    APP="$FIXTURE/app"; STATE="$FIXTURE/state"; RELEASES="$FIXTURE/releases"
    restart_service() { printf '%s\\n' "$(active_sha)" >> "$FIXTURE/restarts"; }
    healthy() { [[ "$(active_sha)" != "$FAIL_SHA" ]]; }
    fetch_production() { :; }
    build_release() { mkdir -p "$RELEASES/$1/backend"; }
    ${body}
  `, { FIXTURE: root, FAIL_SHA: '', ...extra });
  return { root, run, active: () => readlinkSync(join(root, 'app/backend')) };
}

test('SSH command parser rejects shell expansion, extra arguments and mutable refs', () => {
  for (const command of ['deploy main', `deploy ${next};id`, `deploy ${next}\nid`, `deploy ${next} extra`, '', 'bash', `rollback ${next.toUpperCase()}`]) {
    const r = bash('source "$WRAPPER"; parse_command "$COMMAND"', { COMMAND: command });
    assert.notEqual(r.status, 0, command);
  }
  for (const action of ['deploy', 'rollback']) {
    const r = bash('source "$WRAPPER"; parse_command "$COMMAND"', { COMMAND: `${action} ${next}` });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), `${action} ${next}`);
  }
});

test('successful deployment switches release, retains previous and never changes env or Caddy', t => {
  const f = fixture(t), r = f.run(`deploy_release ${next}`);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(f.active(), join(f.root, `releases/${next}/backend`));
  assert.equal(readFileSync(join(f.root, 'state/previous'), 'utf8').trim(), old);
  assert.equal(readFileSync(join(f.root, 'app/.env'), 'utf8'), 'SECRET=unchanged\n');
  assert.equal(readFileSync(join(f.root, 'Caddyfile'), 'utf8'), 'unchanged');
  assert.equal(existsSync(join(f.root, 'state/pending')), false);
});

test('failed build leaves active release and rollback history untouched', t => {
  const f = fixture(t), r = f.run(`build_release() { return 1; }; deploy_release ${next}`);
  assert.notEqual(r.status, 0);
  assert.equal(f.active(), join(f.root, `releases/${old}/backend`));
  assert.equal(readFileSync(join(f.root, 'state/previous'), 'utf8').trim(), older);
  assert.equal(existsSync(join(f.root, 'restarts')), false);
});

test('failed HTTPS health check restores previous release but reports failure', t => {
  const f = fixture(t), r = f.run(`deploy_release ${next}`, { FAIL_SHA: next });
  assert.notEqual(r.status, 0);
  assert.equal(f.active(), join(f.root, `releases/${old}/backend`));
  assert.deepEqual(readFileSync(join(f.root, 'restarts'), 'utf8').trim().split('\n'), [next, old]);
  assert.equal(readFileSync(join(f.root, 'state/previous'), 'utf8').trim(), older);
  assert.equal(existsSync(join(f.root, 'state/pending')), false);
});

test('restart failure also restores the previous release', t => {
  const f = fixture(t), r = f.run(`restart_service() { [[ "$(active_sha)" != '${next}' ]]; }; deploy_release ${next}`);
  assert.notEqual(r.status, 0);
  assert.equal(f.active(), join(f.root, `releases/${old}/backend`));
});

test('stale rollback cannot overwrite another deployment', t => {
  const f = fixture(t), r = f.run(`rollback_release ${next}`);
  assert.notEqual(r.status, 0);
  assert.equal(f.active(), join(f.root, `releases/${old}/backend`));
});

test('manual rollback uses retained release without Git fetch or dependency installation', t => {
  const f = fixture(t), r = f.run(`fetch_production() { return 99; }; build_release() { return 99; }; rollback_release ${old}`);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(f.active(), join(f.root, `releases/${older}/backend`));
  assert.equal(readFileSync(join(f.root, 'state/previous'), 'utf8').trim(), old);
});

test('interrupted deployment refuses another deploy and can recover from pending release', t => {
  const f = fixture(t);
  writeFileSync(join(f.root, 'state/pending'), older + '\n');
  const blocked = f.run(`deploy_release ${next}`);
  assert.notEqual(blocked.status, 0);
  const recovered = f.run(`rollback_release ${old}`);
  assert.equal(recovered.status, 0, recovered.stderr);
  assert.equal(f.active(), join(f.root, `releases/${older}/backend`));
  assert.equal(existsSync(join(f.root, 'state/pending')), false);
});

test('remote production tip is required; ancestor or unrelated SHA is not sufficient', t => {
  const root = mkdtempSync(join(tmpdir(), 'handshake-git-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const r = bash(`
    set -euo pipefail
    source "$HELPER"
    STATE="$FIXTURE/state"; mkdir -p "$STATE"
    git init -q "$FIXTURE/source"
    cd "$FIXTURE/source"
    git -c user.name=Test -c user.email=test@example.invalid commit --allow-empty -qm seed
    SEED=$(git rev-parse HEAD)
    git checkout -qb production
    git -c user.name=Test -c user.email=test@example.invalid commit --allow-empty -qm release
    tip=$(git rev-parse HEAD)
    git init --bare -q "$STATE/repo.git"
    git --git-dir="$STATE/repo.git" remote add origin "$FIXTURE/source"
    fetch_production "$tip"
    if fetch_production "$SEED"; then exit 50; fi
    if fetch_production '${older}'; then exit 51; fi
    mkdir -p backend
    printf 'CREATE TABLE users(id int);' > backend/schema.accounts.sql
    git add backend/schema.accounts.sql
    git -c user.name=Test -c user.email=test@example.invalid commit -qm schema
    schema_tip=$(git rev-parse HEAD)
    if fetch_production "$schema_tip"; then exit 52; fi
    git checkout --orphan unrelated
    git rm -rf .
    git -c user.name=Test -c user.email=test@example.invalid commit --allow-empty -qm unrelated
    unrelated_tip=$(git rev-parse HEAD)
    git branch -f production "$unrelated_tip"
    if fetch_production "$unrelated_tip"; then exit 53; fi
  `, { FIXTURE: root });
  assert.equal(r.status, 0, r.stderr);
});

test('real build refuses to publish a release when npm installation fails', t => {
  const root = mkdtempSync(join(tmpdir(), 'handshake-build-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const r = bash(`
    set -euo pipefail
    source "$HELPER"
    APP="$FIXTURE/app"; STATE="$FIXTURE/state"; RELEASES="$FIXTURE/releases"
    mkdir -p "$STATE" "$RELEASES" "$FIXTURE/source/backend"
    git init -q "$FIXTURE/source"
    printf '{}' > "$FIXTURE/source/backend/package.json"
    printf '{}' > "$FIXTURE/source/backend/package-lock.json"
    git -C "$FIXTURE/source" add backend
    git -C "$FIXTURE/source" -c user.name=Test -c user.email=test@example.invalid commit -qm fixture
    sha=$(git -C "$FIXTURE/source" rev-parse HEAD)
    git clone --bare -q "$FIXTURE/source" "$STATE/repo.git"
    chown() { :; }
    timeout() { touch "$FIXTURE/npm-attempted"; return 42; }
    if build_release "$sha"; then exit 50; fi
    [[ -f "$FIXTURE/npm-attempted" ]]
    [[ ! -e "$RELEASES/$sha" ]]
    [[ -z "$(find "$RELEASES" -mindepth 1 -maxdepth 1 -print)" ]]
  `, { FIXTURE: root });
  assert.equal(r.status, 0, r.stderr);
});

test('failure of both candidate and recovery retains pending state and a failed exit', t => {
  const f = fixture(t), r = f.run(`healthy() { return 1; }; deploy_release ${next}`);
  assert.notEqual(r.status, 0);
  assert.equal(f.active(), join(f.root, `releases/${old}/backend`));
  assert.equal(readFileSync(join(f.root, 'state/pending'), 'utf8').trim(), old);
  assert.match(r.stderr, /CRITICAL/);
});
