'use strict';
const express = require('express');
const lib = require('../../shared/lib');
const bcrypt = lib.bcrypt;
const app = express();
lib.healthRoute(app); // unauthenticated, mounted before any auth middleware
app.use(express.json({ limit: lib.JSON_BODY_LIMIT })); // M-2: explicit body-size cap
app.use(lib.requestLogger('admin')); // DX: cross-service request correlation
app.use(lib.authMiddleware);
app.use(lib.adminMiddleware);

const SERVICES = ['files', 'notes', 'gallery', 'vault', 'bookmarks'];
const ROLES = new Set(['user', 'admin']);
const STATUSES = new Set(['active', 'suspended']);

// L4: validate admin inputs defensively.
function validateUserInput({ username, password, role, status, quotaMB }, { requirePassword }) {
  if (username !== undefined && (typeof username !== 'string' || username.length < 3))
    return 'Username must be a string of at least 3 characters';
  if (requirePassword && (typeof password !== 'string' || password.length < 6))
    return 'Password must be at least 6 characters';
  if (role !== undefined && !ROLES.has(role)) return 'role must be "user" or "admin"';
  if (status !== undefined && !STATUSES.has(status)) return 'status must be "active" or "suspended"';
  if (quotaMB !== undefined) {
    const n = Number(quotaMB);
    if (!Number.isInteger(n) || n <= 0) return 'quotaMB must be a positive integer';
  }
  return null;
}

app.get('/api/admin/users', (req, res) => {
  const users = lib.readUsers();
  const list = Object.entries(users).map(([k, u]) => ({
    username: u.username, role: u.role, status: u.status,
    quotaBytes: u.quotaBytes, usedBytes: lib.usedBytes(k), createdAt: u.createdAt
  }));
  res.json({ users: list });
});

app.post('/api/admin/users', async (req, res) => {
  const err = validateUserInput(req.body || {}, { requirePassword: true });
  if (err) return res.status(400).json({ error: err });
  const { username, password, role = 'user', quotaMB = lib.DEFAULT_QUOTA_MB, status = 'active' } = req.body;
  try {
    const result = await lib.withUserLock(async () => {
      const key = username.toLowerCase();
      const users = lib.readUsers();
      if (users[key]) return { status: 409, body: { error: 'Username already taken' } };
      users[key] = {
        username, passwordHash: await bcrypt.hash(password, 10), role, status,
        quotaBytes: Number(quotaMB) * 1024 * 1024,
        vaultSalt: lib.crypto.randomBytes(16).toString('hex'),
        createdAt: new Date().toISOString()
      };
      lib.writeUsers(users);
      SERVICES.forEach((s) => lib.serviceDir(key, s));
      return { status: 200, body: { ok: true, username } };
    });
    return res.status(result.status).json(result.body);
  } catch (e) {
    return res.status(500).json({ error: 'Create failed' });
  }
});

app.delete('/api/admin/users/:username', async (req, res) => {
  try {
    const result = await lib.withUserLock(async () => {
      const key = req.params.username.toLowerCase();
      const users = lib.readUsers();
      if (!users[key]) return { status: 404, body: { error: 'Not found' } };
      if (key === req.user) return { status: 400, body: { error: 'Cannot delete yourself' } };
      delete users[key];
      lib.writeUsers(users);
      lib.fs.rmSync(lib.userHome(key), { recursive: true, force: true });
      return { status: 200, body: { ok: true } };
    });
    return res.status(result.status).json(result.body);
  } catch (e) {
    return res.status(500).json({ error: 'Delete failed' });
  }
});

app.patch('/api/admin/users/:username', async (req, res) => {
  const err = validateUserInput(req.body || {}, { requirePassword: false });
  if (err) return res.status(400).json({ error: err });
  try {
    const result = await lib.withUserLock(async () => {
      const key = req.params.username.toLowerCase();
      const users = lib.readUsers();
      const u = users[key];
      if (!u) return { status: 404, body: { error: 'Not found' } };
      const { role, status, quotaMB } = req.body;
      // L-2: block self-demotion/self-suspension so an admin can't accidentally
      // lock themselves out (mirrors the existing self-delete guard below).
      if (key === req.user) {
        if (role !== undefined && role !== u.role) return { status: 400, body: { error: 'Cannot change your own role' } };
        if (status !== undefined && status !== u.status) return { status: 400, body: { error: 'Cannot change your own status' } };
      }
      if (role !== undefined) u.role = role;
      if (status !== undefined) u.status = status;
      if (quotaMB !== undefined) u.quotaBytes = Number(quotaMB) * 1024 * 1024;
      lib.writeUsers(users);
      return { status: 200, body: { ok: true } };
    });
    return res.status(result.status).json(result.body);
  } catch (e) {
    return res.status(500).json({ error: 'Update failed' });
  }
});

app.get('/api/admin/stats', (req, res) => {
  const users = lib.readUsers();
  const keys = Object.keys(users);
  const perService = {}; let totalUsed = 0;
  SERVICES.forEach((s) => (perService[s] = 0));
  for (const k of keys) {
    for (const s of SERVICES) {
      const sz = lib.dirSize(lib.path.join(lib.userHome(k), s));
      perService[s] += sz; totalUsed += sz;
    }
  }
  res.json({
    totalUsers: keys.length,
    activeUsers: keys.filter((k) => users[k].status === 'active').length,
    totalUsedBytes: totalUsed,
    perServiceBytes: perService,
    quotaTotalBytes: keys.reduce((a, k) => a + (users[k].quotaBytes || 0), 0)
  });
});

const PORT = lib.parsePositiveInt('PORT', process.env.PORT, 4007);
lib.serve(app, PORT, 'admin');
