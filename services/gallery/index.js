'use strict';
const express = require('express');
const multer = require('multer');
const lib = require('../../shared/lib');
const app = express();
lib.healthRoute(app); // unauthenticated, mounted before any auth middleware
app.use(express.json({ limit: lib.JSON_BODY_LIMIT })); // M-2: explicit body-size cap
app.use(lib.requestLogger('gallery')); // DX: cross-service request correlation

const MAX = lib.parsePositiveInt('MAX_FILE_SIZE_MB', process.env.MAX_FILE_SIZE_MB, 100) * 1024 * 1024;
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico']);

// M-3: verify the file actually IS the image type its extension claims,
// via magic-byte signatures, before serving it inline (res.sendFile). This
// closes the gap where a polyglot file (valid image header + trailing
// payload, or an outright mismatched extension) would previously be served
// inline purely because its extension looked safe. Anything that fails this
// check falls through to the existing attachment/nosniff download path.
function sniffImageType(buf) {
  if (buf.length >= 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length >= 6 && (buf.slice(0, 6).toString('ascii') === 'GIF87a' || buf.slice(0, 6).toString('ascii') === 'GIF89a')) return 'gif';
  if (buf.length >= 12 && buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return 'webp';
  if (buf.length >= 2 && buf[0] === 0x42 && buf[1] === 0x4d) return 'bmp';
  if (buf.length >= 4 && buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0x01 && buf[3] === 0x00) return 'ico';
  return null;
}
const EXT_TO_SNIFF = { '.png': 'png', '.jpg': 'jpg', '.jpeg': 'jpg', '.gif': 'gif', '.webp': 'webp', '.bmp': 'bmp', '.ico': 'ico' };

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, lib.serviceDir(req.user, 'gallery')),
    filename: (req, file, cb) => {
      const dir = lib.serviceDir(req.user, 'gallery');
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

function list(user) {
  const dir = lib.serviceDir(user, 'gallery');
  return lib.fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => {
      const st = lib.fs.statSync(lib.path.join(dir, d.name));
      return { name: d.name, size: st.size, modified: st.mtimeMs, url: `/api/gallery/${encodeURIComponent(d.name)}` };
    })
    .sort((a, b) => b.modified - a.modified);
}

// H1: enforce quota using actual written sizes; roll back on overflow.
app.post('/api/gallery/upload', lib.authMiddleware, upload.array('files', 50), (req, res) => {
  const files = req.files || [];
  if (lib.quotaExceededAfter(req, 'gallery')) {
    lib.removeUploaded(req, 'gallery');
    return res.status(413).json({ error: 'Storage quota exceeded' });
  }
  res.json({ ok: true, files: files.map((f) => ({ name: f.filename, size: f.size })) });
});

app.get('/api/gallery', lib.authMiddleware, (req, res) => res.json({ files: list(req.user) }));

// M7/M-3: serve raster images inline only after confirming the file's actual
// bytes match a known image signature (not just its extension); force
// download (attachment) for anything else, including mismatched/unknown
// content, so uploaded markup or a mislabeled file can never execute in the
// browser document context.
app.get('/api/gallery/:name', lib.authMiddleware, (req, res) => {
  const name = lib.safeName(req.params.name);
  const fp = lib.path.join(lib.serviceDir(req.user, 'gallery'), name);
  if (!lib.fs.existsSync(fp)) return res.status(404).json({ error: 'Not found' });
  res.set('X-Content-Type-Options', 'nosniff');
  const ext = lib.path.extname(name).toLowerCase();
  if (IMAGE_EXTS.has(ext)) {
    let fd;
    try {
      fd = lib.fs.openSync(fp, 'r');
      const header = Buffer.alloc(16);
      const bytesRead = lib.fs.readSync(fd, header, 0, 16, 0);
      const sniffed = sniffImageType(header.slice(0, bytesRead));
      if (sniffed && sniffed === EXT_TO_SNIFF[ext]) return res.sendFile(fp);
    } catch { /* fall through to attachment on any read error */ }
    finally { if (fd !== undefined) try { lib.fs.closeSync(fd); } catch { /* ignore */ } }
  }
  res.download(fp, name);
});

app.delete('/api/gallery/:name', lib.authMiddleware, (req, res) => {
  const name = lib.safeName(req.params.name);
  const fp = lib.path.join(lib.serviceDir(req.user, 'gallery'), name);
  if (!lib.fs.existsSync(fp)) return res.status(404).json({ error: 'Not found' });
  lib.fs.unlinkSync(fp);
  res.json({ ok: true });
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ error: 'Upload error: ' + err.message });
  if (err) return res.status(500).json({ error: err.message });
  next();
});

const PORT = lib.parsePositiveInt('PORT', process.env.PORT, 4004);
lib.serve(app, PORT, 'gallery');
