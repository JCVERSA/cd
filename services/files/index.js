'use strict';
const express = require('express');
const multer = require('multer');
const lib = require('../../shared/lib');
const app = express();
lib.healthRoute(app); // unauthenticated, mounted before any auth middleware
app.use(express.json({ limit: lib.JSON_BODY_LIMIT })); // M-2: explicit body-size cap
app.use(lib.requestLogger('files')); // DX: cross-service request correlation

const MAX = lib.parsePositiveInt('MAX_FILE_SIZE_MB', process.env.MAX_FILE_SIZE_MB, 100) * 1024 * 1024;
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, lib.serviceDir(req.user, 'files')),
    filename: (req, file, cb) => {
      const dir = lib.serviceDir(req.user, 'files');
      let name = lib.safeName(file.originalname), i = 1;
      while (lib.fs.existsSync(lib.path.join(dir, name))) {
        const ext = lib.path.extname(name);
        const base = name.slice(0, name.length - ext.length);
        name = `${base} (${i})${ext}`; i++;
      }
      cb(null, name);
    }
  }),
  limits: { fileSize: MAX }
});

function listFiles(user) {
  const dir = lib.serviceDir(user, 'files');
  return lib.fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => {
      const st = lib.fs.statSync(lib.path.join(dir, d.name));
      return { name: d.name, size: st.size, modified: st.mtimeMs };
    })
    .sort((a, b) => b.modified - a.modified);
}

// H1: enforce quota using the ACTUAL written sizes, AFTER upload; roll back on overflow.
app.post('/api/files/upload', lib.authMiddleware, upload.array('files', 50), (req, res) => {
  const files = req.files || [];
  if (lib.quotaExceededAfter(req, 'files')) {
    lib.removeUploaded(req, 'files');
    return res.status(413).json({ error: 'Storage quota exceeded' });
  }
  res.json({ ok: true, files: files.map((f) => ({ name: f.filename, size: f.size })) });
});

app.get('/api/files', lib.authMiddleware, (req, res) => res.json({ files: listFiles(req.user) }));

app.get('/api/files/download/:name', lib.authMiddleware, (req, res) => {
  const name = lib.safeName(req.params.name);
  const fp = lib.path.join(lib.serviceDir(req.user, 'files'), name);
  if (!lib.fs.existsSync(fp)) return res.status(404).json({ error: 'Not found' });
  res.download(fp, name);
});

app.delete('/api/files/:name', lib.authMiddleware, (req, res) => {
  const name = lib.safeName(req.params.name);
  const fp = lib.path.join(lib.serviceDir(req.user, 'files'), name);
  if (!lib.fs.existsSync(fp)) return res.status(404).json({ error: 'Not found' });
  lib.fs.unlinkSync(fp);
  res.json({ ok: true });
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ error: 'Upload error: ' + err.message });
  if (err) return res.status(500).json({ error: err.message });
  next();
});

const PORT = lib.parsePositiveInt('PORT', process.env.PORT, 4002);
lib.serve(app, PORT, 'files');
