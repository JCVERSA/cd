'use strict';
const express = require('express');
const lib = require('../../shared/lib');
const app = express();
lib.healthRoute(app); // unauthenticated, mounted before any auth middleware
app.use(express.json({ limit: lib.JSON_BODY_LIMIT })); // M-2: explicit body-size cap
app.use(lib.requestLogger('bookmarks')); // DX: cross-service request correlation

const file = (user) => lib.path.join(lib.serviceDir(user, 'bookmarks'), 'bookmarks.json');
const read = (user) => { try { return JSON.parse(lib.fs.readFileSync(file(user), 'utf8')); } catch { return []; } };
const write = (user, arr) => lib.writeJson(file(user), arr); // atomic (L3)
const newId = () => lib.crypto.randomBytes(6).toString('hex');

app.get('/api/bookmarks', lib.authMiddleware, (req, res) => res.json({ bookmarks: read(req.user) }));

app.post('/api/bookmarks', lib.authMiddleware, (req, res) => {
  const { title = '', url = '', tags = '' } = req.body || {};
  // H4: reject non-http(s) URLs so stored bookmarks can never become javascript:/data: XSS.
  if (!lib.isValidHttpUrl(url)) return res.status(400).json({ error: 'URL must start with http:// or https://' });
  const bms = read(req.user);
  const bm = { id: newId(), title: title || url, url, tags, createdAt: new Date().toISOString() };
  bms.push(bm); write(req.user, bms);
  res.json({ ok: true, bookmark: bm });
});

app.put('/api/bookmarks/:id', lib.authMiddleware, (req, res) => {
  const bms = read(req.user);
  const b = bms.find((x) => x.id === req.params.id);
  if (!b) return res.status(404).json({ error: 'Not found' });
  const { title, url, tags } = req.body || {};
  if (url !== undefined && !lib.isValidHttpUrl(url)) return res.status(400).json({ error: 'URL must start with http:// or https://' });
  if (title !== undefined) b.title = title;
  if (url !== undefined) b.url = url;
  if (tags !== undefined) b.tags = tags;
  write(req.user, bms);
  res.json({ ok: true, bookmark: b });
});

app.delete('/api/bookmarks/:id', lib.authMiddleware, (req, res) => {
  let bms = read(req.user);
  const before = bms.length;
  bms = bms.filter((x) => x.id !== req.params.id);
  if (bms.length === before) return res.status(404).json({ error: 'Not found' });
  write(req.user, bms);
  res.json({ ok: true });
});

const PORT = lib.parsePositiveInt('PORT', process.env.PORT, 4006);
lib.serve(app, PORT, 'bookmarks');
