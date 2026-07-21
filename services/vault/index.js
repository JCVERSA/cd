'use strict';
const express = require('express');
const lib = require('../../shared/lib');
const app = express();
lib.healthRoute(app); // unauthenticated, mounted before any auth middleware
app.use(express.json({ limit: lib.JSON_BODY_LIMIT })); // M-2: explicit body-size cap
app.use(lib.requestLogger('vault')); // DX: cross-service request correlation

const file = (user) => lib.path.join(lib.serviceDir(user, 'vault'), 'vault.json');
const read = (user) => { try { return JSON.parse(lib.fs.readFileSync(file(user), 'utf8')); } catch { return []; } };
const write = (user, arr) => lib.writeJson(file(user), arr); // atomic (L3)
const newId = () => lib.crypto.randomBytes(6).toString('hex');

// List (secrets stay encrypted at rest — not returned here)
app.get('/api/vault', lib.authMiddleware, (req, res) =>
  res.json({ entries: read(req.user).map((e) => ({
    id: e.id, title: e.title, site: e.site, username: e.username, createdAt: e.createdAt, updatedAt: e.updatedAt
  })) }));

// Get one (decrypt secret + notes)
app.get('/api/vault/:id', lib.authMiddleware, (req, res) => {
  const e = read(req.user).find((x) => x.id === req.params.id);
  if (!e) return res.status(404).json({ error: 'Not found' });
  const salt = lib.saltFor(req.user);
  res.json({ entry: { ...e, secret: lib.decryptText(salt, e.enc), notes: lib.decryptText(salt, e.encNotes || '') } });
});

app.post('/api/vault', lib.authMiddleware, (req, res) => {
  const { title = '', site = '', username = '', secret = '', notes = '' } = req.body || {};
  const salt = lib.saltFor(req.user);
  const entries = read(req.user);
  const now = new Date().toISOString();
  const entry = {
    id: newId(), title, site, username,
    enc: lib.encryptText(salt, secret),
    encNotes: lib.encryptText(salt, notes),
    createdAt: now, updatedAt: now
  };
  entries.push(entry); write(req.user, entries);
  res.json({ ok: true, id: entry.id });
});

app.put('/api/vault/:id', lib.authMiddleware, (req, res) => {
  const entries = read(req.user);
  const e = entries.find((x) => x.id === req.params.id);
  if (!e) return res.status(404).json({ error: 'Not found' });
  const { title, site, username, secret, notes } = req.body || {};
  const salt = lib.saltFor(req.user);
  if (title !== undefined) e.title = title;
  if (site !== undefined) e.site = site;
  if (username !== undefined) e.username = username;
  if (secret !== undefined) e.enc = lib.encryptText(salt, secret);
  if (notes !== undefined) e.encNotes = lib.encryptText(salt, notes);
  e.updatedAt = new Date().toISOString();
  write(req.user, entries);
  res.json({ ok: true });
});

app.delete('/api/vault/:id', lib.authMiddleware, (req, res) => {
  let entries = read(req.user);
  const before = entries.length;
  entries = entries.filter((x) => x.id !== req.params.id);
  if (entries.length === before) return res.status(404).json({ error: 'Not found' });
  write(req.user, entries);
  res.json({ ok: true });
});

// H-2 follow-up: saltFor() now throws instead of silently using a shared
// fallback salt. Catch that here so the failure surfaces as a clean JSON 500
// instead of Express's default HTML error page, and gets logged server-side.
app.use((err, req, res, next) => {
  if (err) {
    console.error('[vault] error:', err.message);
    return res.status(500).json({ error: 'Vault operation failed' });
  }
  next();
});

const PORT = lib.parsePositiveInt('PORT', process.env.PORT, 4005);
lib.serve(app, PORT, 'vault');
