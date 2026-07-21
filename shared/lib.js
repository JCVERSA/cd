'use strict';
/**
 * Shared library for all MiniCloud microservices.
 * - One VPS storage volume (STORAGE_DIR) shared by every service.
 * - One JSON user store (the identity source of truth), accessed through a
 *   cross-process lock so concurrent mutations from different services cannot
 *   corrupt or lose data.
 * - Stateless JWT auth (httpOnly cookie) so services stay independent.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const STORAGE_DIR = process.env.STORAGE_DIR || path.join(__dirname, '..', 'storage');
const DATA_DIR = path.join(STORAGE_DIR, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const VAULT_SECRET = process.env.VAULT_SECRET || 'dev-vault-secret';

// DX: fail fast on a malformed numeric env var instead of silently computing
// with NaN (parseInt('abc') === NaN, and NaN comparisons are always false —
// e.g. a broken DEFAULT_QUOTA_MB would make quota checks never trigger).
// Every service uses this for PORT too, so a typo'd port fails at startup
// with a clear message instead of Express throwing an opaque EADDR error.
function parsePositiveInt(name, raw, fallback) {
  if (raw === undefined || raw === '') return fallback;
  const n = parseInt(raw, 10);
  if (!Number.isInteger(n) || n <= 0 || String(n) !== String(raw).trim()) {
    console.error(`[FATAL] ${name}="${raw}" is not a valid positive integer.`);
    process.exit(1);
  }
  return n;
}

const DEFAULT_QUOTA_MB = parsePositiveInt('DEFAULT_QUOTA_MB', process.env.DEFAULT_QUOTA_MB, 100);
// M-2 (JSON body limit): every service previously relied on express.json()'s
// implicit 100kb default. That happened to be a reasonable limit, but it was
// never a deliberate choice — if it changed for unrelated reasons the
// protection would silently disappear. Made explicit and centralized here so
// every service enforces the same, documented cap. 1mb comfortably covers a
// long note or vault entry while still bounding worst-case payload size.
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || '1mb';

// ---- Fail-fast on insecure secrets (H2) ----
// A default/known JWT secret lets anyone forge tokens (incl. admin). Refuse to boot.
// L2: scripts that only touch the user store (e.g. seed-admin.js) never sign a
// token or do vault crypto, so they don't need either secret set. They opt out
// by setting MC_SKIP_SECRET_CHECK=1 before requiring this module; every
// long-running service (auth/files/notes/gallery/vault/bookmarks/admin/gateway)
// leaves this unset and keeps the full fail-fast check.
const FORBIDDEN_SECRETS = new Set(['', 'dev-secret-change-me', 'change-me-in-prod', 'dev-vault-secret']);
function requireStrongSecret(name, value) {
  if (FORBIDDEN_SECRETS.has(value)) {
    console.error(`[FATAL] ${name} is missing or uses an insecure default. ` +
      `Set a strong ${name} environment variable before starting MiniCloud.`);
    process.exit(1);
  }
}
if (process.env.MC_SKIP_SECRET_CHECK !== '1') {
  requireStrongSecret('JWT_SECRET', JWT_SECRET);
  requireStrongSecret('VAULT_SECRET', VAULT_SECRET);
}

fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------- user store (file-backed, atomic writes) ----------
function readUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch { return {}; }
}
// Atomic write: temp file + rename so a crash can never leave a half-written JSON.
function writeUsers(u) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = USERS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(u, null, 2));
  fs.renameSync(tmp, USERS_FILE);
}
// Generic atomic JSON write (used by notes/vault/bookmarks stores).
function writeJson(file, data) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

// ---------- cross-process lock for the shared user store (M1) ----------
const LOCK_FILE = path.join(DATA_DIR, '.users.lock');
async function acquireLock(timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const fd = fs.openSync(LOCK_FILE, 'wx'); // atomic create; fails if exists
      fs.writeSync(fd, String(process.pid));
      fs.closeSync(fd);
      return;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      // Break stale locks left by crashed processes.
      try {
        const pid = parseInt(fs.readFileSync(LOCK_FILE, 'utf8'), 10);
        if (Number.isInteger(pid) && pid !== process.pid) {
          try { process.kill(pid, 0); } catch { fs.unlinkSync(LOCK_FILE); continue; }
        }
      } catch { /* ignore */ }
      await new Promise((r) => setTimeout(r, 25));
    }
  }
  throw new Error('Timeout acquiring user-store lock');
}
function releaseLock() { try { fs.unlinkSync(LOCK_FILE); } catch { /* ignore */ } }
// Serializes read-modify-write of users.json across ALL service processes.
async function withUserLock(fn) {
  await acquireLock();
  try { return await fn(); } finally { releaseLock(); }
}

// ---------- storage layout (shared volume) ----------
// STORAGE_DIR/
//   data/users.json
//   home/<user>/files|notes|gallery|vault|bookmarks
function userHome(user) {
  const safe = String(user).toLowerCase().replace(/[^a-zA-Z0-9_.-]/g, '_');
  return path.join(STORAGE_DIR, 'home', safe);
}
function serviceDir(user, service) {
  const d = path.join(userHome(user), service);
  fs.mkdirSync(d, { recursive: true });
  return d;
}
function safeName(name) {
  let n = path.basename(String(name || '')).replace(/[\\/\\?%*:|"<>]/g, '_').trim();
  if (!n) n = 'file';
  return n;
}
function dirSize(dir) {
  let total = 0;
  if (!fs.existsSync(dir)) return 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    try {
      if (e.isDirectory()) total += dirSize(p);
      else total += fs.statSync(p).size;
    } catch { /* ignore unreadable */ }
  }
  return total;
}
function usedBytes(user) { return dirSize(userHome(user)); }

// ---------- quota enforcement (H1) ----------
// Uses the ACTUAL bytes written by multer (not the client-supplied Content-Length),
// evaluated AFTER the upload completes, and rolls back on overflow.
function quotaExceededAfter(req, serviceName) {
  const u = lib.readUsers()[req.user];
  if (!u || !u.quotaBytes) return false;
  const uploaded = (req.files || []).reduce((a, f) => a + f.size, 0);
  const before = Math.max(0, lib.usedBytes(req.user) - uploaded);
  return before + uploaded > u.quotaBytes;
}
function removeUploaded(req, serviceName) {
  (req.files || []).forEach((f) => {
    try { fs.unlinkSync(path.join(serviceDir(req.user, serviceName), f.filename)); } catch { /* ignore */ }
  });
}

// ---------- URL validation (H4) ----------
function isValidHttpUrl(str) {
  try {
    const u = new URL(String(str));
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch { return false; }
}

// ---------- auth ----------
// M-4: a fixed dummy bcrypt hash used to run a same-cost compare() when a
// login username doesn't exist, so "unknown user" and "wrong password"
// take statistically the same amount of time and can't be distinguished
// by response latency. The plaintext behind this hash is never used or
// needed — only the cost factor (10, matching real password hashing)
// matters for the timing to line up.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('mc-timing-safety-dummy', 10);

function signToken(user, role) {
  return jwt.sign({ sub: user, role }, JWT_SECRET, { expiresIn: '7d' });
}
function verifyToken(tok) {
  try { return jwt.verify(tok, JWT_SECRET); } catch { return null; }
}
function parseCookie(req) {
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/(?:^|;\s*)mc_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
function isTls(req) {
  return !!(req && (req.secure || /^(https|on)$/i.test(req.headers['x-forwarded-proto'] || '') || req.headers['x-forwarded-ssl'] === 'on'));
}
// H1: verifying the JWT alone is not enough — a still-valid token belonging to
// a user who was suspended or deleted *after* the token was issued must not
// keep working. Re-check the live user record on every request so admin
// actions (suspend/delete) take effect immediately instead of waiting up to
// 7 days for the token to expire.
function authMiddleware(req, res, next) {
  const payload = verifyToken(parseCookie(req));
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });
  const u = readUsers()[payload.sub];
  if (!u || u.status === 'suspended') return res.status(401).json({ error: 'Unauthorized' });
  req.user = payload.sub;
  req.role = u.role; // trust the live role too, not the (possibly stale) token claim
  next();
}
function adminMiddleware(req, res, next) {
  if (req.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  next();
}
// H3: add Secure flag when served over TLS.
function setTokenCookie(req, res, token) {
  const secure = isTls(req) ? ' Secure;' : '';
  res.setHeader('Set-Cookie',
    `mc_token=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax;${secure} Max-Age=${60 * 60 * 24 * 7}`);
}
function clearTokenCookie(req, res) {
  const secure = isTls(req) ? ' Secure;' : '';
  res.setHeader('Set-Cookie', `mc_token=; HttpOnly; Path=/;${secure} Max-Age=0`);
}

// ---------- vault crypto (AES-256-GCM, key derived per user) ----------
function vaultKey(salt) { return crypto.scryptSync(VAULT_SECRET, salt, 32); }
function encryptText(salt, text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', vaultKey(salt), iv);
  const enc = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + enc.toString('hex');
}
function decryptText(salt, blob) {
  if (!blob || !blob.includes(':')) return '';
  const [ivH, tagH, dataH] = blob.split(':');
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', vaultKey(salt), Buffer.from(ivH, 'hex'));
    decipher.setAuthTag(Buffer.from(tagH, 'hex'));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataH, 'hex')), decipher.final()]);
    return dec.toString('utf8');
  } catch { return ''; }
}
// H-2: fail loudly instead of silently falling back to a shared/static salt.
// A missing vaultSalt would otherwise make every affected user's vault key
// derivable from the same constant, defeating the per-user KDF salt.
function saltFor(user) {
  const salt = readUsers()[user]?.vaultSalt;
  if (!salt) throw new Error(`Missing vaultSalt for user "${user}" — refusing to use a shared fallback salt`);
  return salt;
}

// ---------- request logging (DX: cross-service correlation) ----------
// Every service logs one line per request with a request ID, so a single
// user request can be traced across the gateway + whichever microservice(s)
// it touched, without needing a log aggregator. The gateway generates the ID
// (see gateway/index.js) and forwards it as X-Request-Id; if a service is
// hit directly (e.g. in tests) without that header, it generates its own.
function requestLogger(serviceName) {
  return (req, res, next) => {
    const reqId = req.headers['x-request-id'] || crypto.randomBytes(6).toString('hex');
    req.reqId = reqId;
    res.setHeader('X-Request-Id', reqId);
    const start = Date.now();
    res.on('finish', () => {
      console.log(`[${serviceName}] ${reqId} ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
  };
}

// ---------- process bootstrap (L2: graceful shutdown) ----------
// H-1: bind to BIND_HOST (default 127.0.0.1) so internal services are not
// reachable from outside the box. Only the gateway should be exposed
// (directly, or via a reverse proxy) — set GATEWAY_BIND_HOST=0.0.0.0 (or your
// LAN/VPN interface) explicitly if the gateway itself needs external access.
const BIND_HOST = process.env.BIND_HOST || '127.0.0.1';
function serve(app, port, name) {
  const server = app.listen(port, BIND_HOST, () => console.log(`[${name}] on ${BIND_HOST}:${port}`));
  const shutdown = (sig) => {
    console.log(`[${name}] received ${sig}, shutting down…`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  return server;
}

// DX: unauthenticated health check, meant to be mounted FIRST in every
// service (before requestLogger/authMiddleware/adminMiddleware) so an
// orchestrator (Docker, PM2, a load balancer) can probe liveness without
// credentials. The gateway already exposes its own /healthz separately;
// this is the per-service equivalent requested in the audit.
function healthRoute(app) {
  app.get('/healthz', (req, res) => res.json({ ok: true }));
}

const lib = {
  STORAGE_DIR, DATA_DIR, USERS_FILE, JWT_SECRET, VAULT_SECRET, DEFAULT_QUOTA_MB, JSON_BODY_LIMIT,
  readUsers, writeUsers, writeJson, withUserLock,
  userHome, serviceDir, safeName, dirSize, usedBytes,
  quotaExceededAfter, removeUploaded, isValidHttpUrl,
  signToken, verifyToken, authMiddleware, adminMiddleware, DUMMY_PASSWORD_HASH,
  setTokenCookie, clearTokenCookie, parseCookie, requestLogger, healthRoute,
  encryptText, decryptText, saltFor, parsePositiveInt,
  serve, bcrypt, fs, path, crypto
};
module.exports = lib;
