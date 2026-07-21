'use strict';
// Integration tests: spawn the real service processes (as pm2/start.sh would)
// against an isolated, throwaway STORAGE_DIR, and exercise them over HTTP.
// This intentionally does NOT mock internals — it exercises the same code
// path production traffic takes, which is what matters most for auth,
// admin, and vault since those are the security-critical surfaces that had
// no coverage before (see audit finding L-1).
//
// Run with: node --test test/integration.test.js
// (excluded from the default `npm test` glob's fast path is not needed —
// node --test picks up all *.test.js files including this one)

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawn } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const JWT_SECRET = 'integration-test-jwt-secret-not-default';
const VAULT_SECRET = 'integration-test-vault-secret-not-default';

function tmpStorageDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mc-integration-'));
}

// Spawns a service as a real child process (same as start.sh does) with an
// isolated STORAGE_DIR and a free port, and resolves once it has logged its
// "on <host>:<port>" boot line.
function startService(scriptRelPath, port, storageDir, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, scriptRelPath)], {
      cwd: ROOT,
      env: {
        ...process.env,
        PORT: String(port),
        STORAGE_DIR: storageDir,
        JWT_SECRET,
        VAULT_SECRET,
        BIND_HOST: '127.0.0.1',
        DEFAULT_QUOTA_MB: '100',
        ...extraEnv
      }
    });
    let out = '';
    const onData = (d) => {
      out += d.toString();
      if (out.includes(`:${port}`)) { child.stdout.off('data', onData); resolve(child); }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', (d) => { out += d.toString(); });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code !== 0 && code !== null) reject(new Error(`${scriptRelPath} exited with code ${code}: ${out}`));
    });
    setTimeout(() => reject(new Error(`${scriptRelPath} did not boot in time. Output:\n${out}`)), 5000);
  });
}

function stopService(child) {
  return new Promise((resolve) => {
    if (!child || child.killed) return resolve();
    child.once('exit', resolve);
    child.kill('SIGTERM');
    setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* already dead */ } resolve(); }, 2000);
  });
}

// Minimal fetch-like helper that also captures Set-Cookie so we can carry
// the auth cookie across requests, the same way a browser session would.
async function request(base, path_, { method = 'GET', body, cookie } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(base + path_, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  const setCookie = res.headers.get('set-cookie');
  return { status: res.status, data, cookie: setCookie ? setCookie.split(';')[0] : cookie };
}

/* ===================== AUTH + ADMIN (spawn both, since admin needs a
   pre-existing admin account seeded the same way production does) ===================== */
test('auth + admin: register, login, role enforcement, self-lockout guards', async (t) => {
  const storageDir = tmpStorageDir();
  const authPort = 14001, adminPort = 14007;
  const authBase = `http://127.0.0.1:${authPort}`;
  const adminBase = `http://127.0.0.1:${adminPort}`;

  const authProc = await startService('services/auth/index.js', authPort, storageDir);
  const adminProc = await startService('services/admin/index.js', adminPort, storageDir);

  t.after(async () => { await stopService(authProc); await stopService(adminProc); });

  // Register a normal user via the real HTTP endpoint.
  const reg = await request(authBase, '/api/auth/register', {
    method: 'POST', body: { username: 'alice', password: 'password123' }
  });
  assert.strictEqual(reg.status, 200);
  assert.strictEqual(reg.data.role, 'user');

  // Seed an admin the same way scripts/seed-admin.js does, but in-process
  // against the same storage dir so we don't need to spawn a third thing.
  const lib = requireFresh('../shared/lib', { JWT_SECRET, VAULT_SECRET, STORAGE_DIR: storageDir });
  await lib.withUserLock(async () => {
    const users = lib.readUsers();
    users['root'] = {
      username: 'root', passwordHash: lib.bcrypt.hashSync('adminpass123', 10),
      role: 'admin', status: 'active', quotaBytes: 100 * 1024 * 1024,
      vaultSalt: lib.crypto.randomBytes(16).toString('hex'), createdAt: new Date().toISOString()
    };
    lib.writeUsers(users);
  });

  const adminLogin = await request(authBase, '/api/auth/login', {
    method: 'POST', body: { username: 'root', password: 'adminpass123' }
  });
  assert.strictEqual(adminLogin.status, 200);
  const adminCookie = adminLogin.cookie;

  const userLogin = await request(authBase, '/api/auth/login', {
    method: 'POST', body: { username: 'alice', password: 'password123' }
  });
  assert.strictEqual(userLogin.status, 200);
  const userCookie = userLogin.cookie;

  // A normal user's token must NOT be accepted by admin-only routes.
  const forbidden = await request(adminBase, '/api/admin/users', { cookie: userCookie });
  assert.strictEqual(forbidden.status, 403);

  // An admin's token must work.
  const allowed = await request(adminBase, '/api/admin/users', { cookie: adminCookie });
  assert.strictEqual(allowed.status, 200);
  assert.ok(Array.isArray(allowed.data.users));
  assert.ok(allowed.data.users.some((u) => u.username === 'alice'));

  // No token at all must be rejected.
  const noAuth = await request(adminBase, '/api/admin/users');
  assert.strictEqual(noAuth.status, 401);

  // L-2 regression: admin cannot demote or suspend themselves.
  const selfDemote = await request(adminBase, '/api/admin/users/root', {
    method: 'PATCH', cookie: adminCookie, body: { role: 'user' }
  });
  assert.strictEqual(selfDemote.status, 400);
  const selfSuspend = await request(adminBase, '/api/admin/users/root', {
    method: 'PATCH', cookie: adminCookie, body: { status: 'suspended' }
  });
  assert.strictEqual(selfSuspend.status, 400);

  // Existing guard: admin cannot delete themselves.
  const selfDelete = await request(adminBase, '/api/admin/users/root', { method: 'DELETE', cookie: adminCookie });
  assert.strictEqual(selfDelete.status, 400);

  // Admin CAN suspend a different user, and that user is then locked out of login.
  const suspend = await request(adminBase, '/api/admin/users/alice', {
    method: 'PATCH', cookie: adminCookie, body: { status: 'suspended' }
  });
  assert.strictEqual(suspend.status, 200);
  const blockedLogin = await request(authBase, '/api/auth/login', {
    method: 'POST', body: { username: 'alice', password: 'password123' }
  });
  assert.strictEqual(blockedLogin.status, 401);

  // H1: suspension must invalidate an ALREADY-ISSUED session immediately, not
  // just block future logins. alice's cookie was issued before she was
  // suspended (see userCookie above) — it must now be rejected on her very
  // next request, instead of remaining valid until it expires.
  const revoked = await request(authBase, '/api/auth/me', { cookie: userCookie });
  assert.strictEqual(revoked.status, 401);

  fs.rmSync(storageDir, { recursive: true, force: true });
});

/* ===================== VAULT: encrypt/decrypt roundtrip over real HTTP ===================== */
test('vault: secret is encrypted at rest and decrypts correctly via the API', async (t) => {
  const storageDir = tmpStorageDir();
  const authPort = 14011, vaultPort = 14015;
  const authBase = `http://127.0.0.1:${authPort}`;
  const vaultBase = `http://127.0.0.1:${vaultPort}`;

  const authProc = await startService('services/auth/index.js', authPort, storageDir);
  const vaultProc = await startService('services/vault/index.js', vaultPort, storageDir);
  t.after(async () => { await stopService(authProc); await stopService(vaultProc); });

  const reg = await request(authBase, '/api/auth/register', {
    method: 'POST', body: { username: 'bob', password: 'password123' }
  });
  assert.strictEqual(reg.status, 200);
  const cookie = reg.cookie;

  const secretPlaintext = 'sup3r-s3cret-passw0rd!';
  const create = await request(vaultBase, '/api/vault', {
    method: 'POST', cookie, body: { title: 'Gmail', site: 'https://gmail.com', username: 'bob@x.com', secret: secretPlaintext, notes: 'recovery: 123456' }
  });
  assert.strictEqual(create.status, 200);
  const id = create.data.id;

  // The on-disk vault.json must NOT contain the plaintext secret anywhere.
  const raw = fs.readFileSync(path.join(storageDir, 'home', 'bob', 'vault', 'vault.json'), 'utf8');
  assert.ok(!raw.includes(secretPlaintext), 'plaintext secret leaked into vault.json at rest');
  assert.ok(raw.includes('enc'), 'expected an encrypted "enc" field in the stored entry');

  // The list endpoint must not return the decrypted secret either.
  const list = await request(vaultBase, '/api/vault', { cookie });
  assert.strictEqual(list.status, 200);
  assert.strictEqual(list.data.entries[0].secret, undefined);

  // Only the single-entry detail endpoint decrypts, and it must round-trip exactly.
  const detail = await request(vaultBase, '/api/vault/' + id, { cookie });
  assert.strictEqual(detail.status, 200);
  assert.strictEqual(detail.data.entry.secret, secretPlaintext);
  assert.strictEqual(detail.data.entry.notes, 'recovery: 123456');

  fs.rmSync(storageDir, { recursive: true, force: true });
});

/* ===================== Cross-process lock under real concurrency ===================== */
test('withUserLock: concurrent writers from separate processes never lose an update', async (t) => {
  const storageDir = tmpStorageDir();
  fs.mkdirSync(path.join(storageDir, 'data'), { recursive: true });

  // Two separate Node processes racing to increment a shared counter through
  // withUserLock. If the lock is broken, some increments get lost.
  const worker = `
    const lib = require(${JSON.stringify(path.join(ROOT, 'shared', 'lib.js'))});
    (async () => {
      for (let i = 0; i < 25; i++) {
        await lib.withUserLock(async () => {
          const users = lib.readUsers();
          users.counter = { n: (users.counter?.n || 0) + 1 };
          lib.writeUsers(users);
        });
      }
      process.exit(0);
    })();
  `;
  const env = { ...process.env, JWT_SECRET, VAULT_SECRET, STORAGE_DIR: storageDir };
  const run = () => new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['-e', worker], { env });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('worker failed: ' + err))));
  });

  await Promise.all([run(), run(), run()]); // 3 processes x 25 increments = 75

  const lib = requireFresh('../shared/lib', { JWT_SECRET, VAULT_SECRET, STORAGE_DIR: storageDir });
  const users = lib.readUsers();
  assert.strictEqual(users.counter.n, 75, 'lost updates under concurrent cross-process writes');

  fs.rmSync(storageDir, { recursive: true, force: true });
});

// shared/lib.js reads env vars once at module-load time (STORAGE_DIR, secrets),
// so each test that needs a fresh STORAGE_DIR loads its own isolated copy
// rather than reusing Node's require() cache.
function requireFresh(modPath, env) {
  const resolved = require.resolve(modPath);
  delete require.cache[resolved];
  const prevEnv = {};
  for (const k of Object.keys(env)) { prevEnv[k] = process.env[k]; process.env[k] = env[k]; }
  const mod = require(modPath);
  for (const k of Object.keys(env)) { if (prevEnv[k] === undefined) delete process.env[k]; else process.env[k] = prevEnv[k]; }
  return mod;
}
