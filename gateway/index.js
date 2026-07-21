'use strict';
/**
 * API gateway — the single entry point (port 3000).
 * Serves the public landing page (/) and the app (/app), applies security
 * headers + a CSRF Origin check, exposes a health endpoint, and reverse-
 * proxies /api/* to the microservices (which each enforce JWT auth
 * independently).
 */
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();
const publicDir = path.join(__dirname, '..', 'public');

// DX: fail fast on a malformed numeric env var instead of letting Express
// throw an opaque EADDR error later, or a rate-limit threshold silently
// become NaN. Mirrors shared/lib.js's parsePositiveInt — kept as a local
// copy rather than importing shared/lib.js, since the gateway intentionally
// has no dependency on it.
function parsePositiveInt(name, raw, fallback) {
  if (raw === undefined || raw === '') return fallback;
  const n = parseInt(raw, 10);
  if (!Number.isInteger(n) || n <= 0 || String(n) !== String(raw).trim()) {
    console.error(`[FATAL] ${name}="${raw}" is not a valid positive integer.`);
    process.exit(1);
  }
  return n;
}

// DX: assign a request ID at the edge and forward it to whichever service
// handles the request, so gateway + service logs for one request can be
// correlated. Applied before the proxies so every /api/* call carries it.
app.use((req, res, next) => {
  const reqId = req.headers['x-request-id'] || crypto.randomBytes(6).toString('hex');
  req.headers['x-request-id'] = reqId; // forwarded to the target service by the proxy
  res.setHeader('X-Request-Id', reqId);
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[gateway] ${reqId} ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

// M4: security headers (CSP allows the SPA's CDN fonts/styles + same-origin app).
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"]
    }
  }
}));

// M5: CSRF defense-in-depth. State-changing requests must carry a same-origin
// Origin header. (Cookie is also SameSite=Lax, blocking most cross-site writes.)
app.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const origin = req.headers.origin;
    if (origin) {
      try {
        if (new URL(origin).host !== req.headers.host) return res.status(403).json({ error: 'CSRF check failed' });
      } catch { return res.status(403).json({ error: 'CSRF check failed' }); }
    }
  }
  next();
});

// L11: health check (not proxied).
app.get('/healthz', (req, res) => res.json({ ok: true }));

// M-1: baseline abuse/DoS protection across every proxied API route, not
// just /api/auth/*. This is deliberately looser than auth's own 20-per-15min
// limiter (which stays in place unchanged for login/register brute-force
// protection) — its job is to cap how hard one IP can hammer any endpoint
// (repeated uploads, note writes, listing, etc.), not to rate-limit normal
// interactive use. Applied once here at the gateway so every service is
// covered without repeating the same middleware 7 times.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parsePositiveInt('API_RATE_LIMIT_MAX', process.env.API_RATE_LIMIT_MAX, 300),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' }
});
app.use('/api', apiLimiter);

const routes = {
  '/api/auth':      process.env.AUTH_URL      || 'http://localhost:4001',
  '/api/files':     process.env.FILES_URL     || 'http://localhost:4002',
  '/api/notes':     process.env.NOTES_URL     || 'http://localhost:4003',
  '/api/gallery':   process.env.GALLERY_URL   || 'http://localhost:4004',
  '/api/vault':     process.env.VAULT_URL     || 'http://localhost:4005',
  '/api/bookmarks': process.env.BOOKMARKS_URL || 'http://localhost:4006',
  '/api/admin':     process.env.ADMIN_URL     || 'http://localhost:4007'
};

for (const [p, target] of Object.entries(routes)) {
  app.use(p, createProxyMiddleware({
    target, changeOrigin: true,
    onError: (err, req, res) => res.status(502).json({ error: 'Service unavailable: ' + p })
  }));
}

app.use(express.static(publicDir));

// Landing page lives at public/index.html (served automatically by the
// static middleware above for GET /). The SPA now lives under public/app/ —
// serve its index.html for any /app/* route so client-side routing (if any
// is added later) still resolves, while /api/* above and /healthz keep
// working exactly as before.
app.get('/app', (req, res) => res.sendFile(path.join(publicDir, 'app', 'index.html')));
app.get('/app/*', (req, res) => res.sendFile(path.join(publicDir, 'app', 'index.html')));

// Anything else falls back to the landing page rather than silently serving
// the SPA shell for arbitrary unmatched paths.
app.get('*', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));

// H-1: the gateway is the one process meant to be reachable from outside the
// box, so it defaults to all interfaces — unlike the internal microservices,
// which now default to 127.0.0.1 only (see shared/lib.js). Override with
// GATEWAY_BIND_HOST if you're terminating TLS elsewhere and want the gateway
// itself to only listen on localhost or a specific interface.
function serve(app, port, host) {
  const server = app.listen(port, host, () => console.log(`[gateway] on ${host}:${port}`));
  const shutdown = (sig) => {
    console.log(`[gateway] received ${sig}, shutting down…`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  return server;
}

const PORT = parsePositiveInt('PORT', process.env.PORT, 3000);
const GATEWAY_BIND_HOST = process.env.GATEWAY_BIND_HOST || '0.0.0.0';
serve(app, PORT, GATEWAY_BIND_HOST);
