'use strict';
const express = require('express');
const rateLimit = require('express-rate-limit');
const lib = require('../../shared/lib');
const bcrypt = lib.bcrypt;
const app = express();
lib.healthRoute(app); // unauthenticated, mounted before any auth middleware
app.use(express.json({ limit: lib.JSON_BODY_LIMIT })); // M-2: explicit body-size cap
app.use(lib.requestLogger('auth')); // DX: cross-service request correlation

// M3: brute-force / abuse protection on auth endpoints.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later.' }
});

// Register (serialized through the shared user-store lock — M1)
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (username.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const result = await lib.withUserLock(async () => {
      const key = username.toLowerCase();
      const users = lib.readUsers();
      if (users[key]) return { status: 409, body: { error: 'Username already taken' } };
      users[key] = {
        username,
        passwordHash: await bcrypt.hash(password, 10),
        role: 'user',
        status: 'active',
        quotaBytes: lib.DEFAULT_QUOTA_MB * 1024 * 1024,
        vaultSalt: lib.crypto.randomBytes(16).toString('hex'),
        createdAt: new Date().toISOString()
      };
      lib.writeUsers(users);
      ['files', 'notes', 'gallery', 'vault', 'bookmarks'].forEach((s) => lib.serviceDir(key, s));
      return { status: 200, body: { ok: true, username, role: 'user' } };
    });
    if (result.status === 200) lib.setTokenCookie(req, res, lib.signToken(result.body.username.toLowerCase(), 'user'));
    return res.status(result.status).json(result.body);
  } catch (e) {
    return res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const key = username.toLowerCase();
  const u = lib.readUsers()[key];
  // M-4: always run a bcrypt.compare of the same cost, even when the user
  // doesn't exist, so response time doesn't leak whether a username is
  // registered. Comparing against DUMMY_PASSWORD_HASH still always fails,
  // it just costs the same ~bcrypt-round time as a real password check.
  const hashToCheck = u ? u.passwordHash : lib.DUMMY_PASSWORD_HASH;
  const passwordOk = await bcrypt.compare(password, hashToCheck);
  if (!u || u.status === 'suspended' || !passwordOk) return res.status(401).json({ error: 'Invalid credentials' });
  lib.setTokenCookie(req, res, lib.signToken(key, u.role));
  res.json({ ok: true, username: u.username, role: u.role });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  lib.clearTokenCookie(req, res);
  res.json({ ok: true });
});

// Current user
app.get('/api/auth/me', lib.authMiddleware, (req, res) => {
  const u = lib.readUsers()[req.user];
  if (!u) return res.status(401).json({ error: 'Unknown user' });
  res.json({
    username: u.username, role: u.role, status: u.status,
    quotaBytes: u.quotaBytes, usedBytes: lib.usedBytes(req.user)
  });
});

const PORT = lib.parsePositiveInt('PORT', process.env.PORT, 4001);
lib.serve(app, PORT, 'auth');
