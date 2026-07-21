'use strict';
const express = require('express');
const lib = require('../../shared/lib');
const app = express();
lib.healthRoute(app); // unauthenticated, mounted before any auth middleware
app.use(express.json({ limit: lib.JSON_BODY_LIMIT })); // M-2: explicit body-size cap
app.use(lib.requestLogger('notes')); // DX: cross-service request correlation

const file = (user) => lib.path.join(lib.serviceDir(user, 'notes'), 'notes.json');
const read = (user) => { try { return JSON.parse(lib.fs.readFileSync(file(user), 'utf8')); } catch { return []; } };
const write = (user, arr) => lib.writeJson(file(user), arr); // atomic (L3)
const newId = () => lib.crypto.randomBytes(6).toString('hex');

app.get('/api/notes', lib.authMiddleware, (req, res) =>
  res.json({ notes: read(req.user).map((n) => ({ id: n.id, title: n.title, updatedAt: n.updatedAt })) }));

app.get('/api/notes/:id', lib.authMiddleware, (req, res) => {
  const n = read(req.user).find((x) => x.id === req.params.id);
  if (!n) return res.status(404).json({ error: 'Not found' });
  res.json({ note: n });
});

app.post('/api/notes', lib.authMiddleware, (req, res) => {
  const { title = 'Untitled', body = '' } = req.body || {};
  const notes = read(req.user);
  const now = new Date().toISOString();
  const note = { id: newId(), title, body, createdAt: now, updatedAt: now };
  notes.push(note); write(req.user, notes);
  res.json({ ok: true, note });
});

app.put('/api/notes/:id', lib.authMiddleware, (req, res) => {
  const notes = read(req.user);
  const n = notes.find((x) => x.id === req.params.id);
  if (!n) return res.status(404).json({ error: 'Not found' });
  const { title, body } = req.body || {};
  if (title !== undefined) n.title = title;
  if (body !== undefined) n.body = body;
  n.updatedAt = new Date().toISOString();
  write(req.user, notes);
  res.json({ ok: true, note: n });
});

app.delete('/api/notes/:id', lib.authMiddleware, (req, res) => {
  let notes = read(req.user);
  const before = notes.length;
  notes = notes.filter((x) => x.id !== req.params.id);
  if (notes.length === before) return res.status(404).json({ error: 'Not found' });
  write(req.user, notes);
  res.json({ ok: true });
});

const PORT = lib.parsePositiveInt('PORT', process.env.PORT, 4003);
lib.serve(app, PORT, 'notes');
