# ☁️ MiniCloud — the private cloud suite

A small **multi-service SaaS** where every feature stores its data on **one shared
VPS storage volume**. Built as a set of independent **microservices** behind a
single API gateway, all branded with your logo and sharing one user/quota store.

```
            ┌─────────────────────────────────────────┐
   browser ─┤  Gateway  :3000  (landing + SPA + proxies)│
            └───────────────┬───────────────────────────┘
            ┌───────────────┼───────────────────────────┐
         auth:4001      files:4002      notes:4003      │
        gallery:4004     vault:4005    bookmarks:4006    │
            └───────────────┴─────────── admin:4007 ─────┘
                            │
                    one STORAGE_DIR volume
              data/users.json  +  home/<user>/{files,notes,gallery,vault,bookmarks}
```

## Services

| Service | Port | What it does |
|---------|------|--------------|
| **gateway**   | 3000 | Single entry point. Serves the public landing page (`/`) and the app (`/app`), proxies `/api/*` to services. |
| **auth**      | 4001 | Register / login / logout. Issues the JWT (httpOnly cookie). |
| **files**     | 4002 | Upload / list / download / delete files (drag & drop). |
| **notes**     | 4003 | Markdown notes (create / edit / delete). |
| **gallery**   | 4004 | Image/media library (upload / view / delete). |
| **vault**     | 4005 | Encrypted password/secret manager (AES-256-GCM at rest). |
| **bookmarks** | 4006 | Link manager with tags. |
| **admin**     | 4007 | User management: create / suspend / delete, quotas, global stats. |

All services are **independent processes** that share:
- one storage volume (`STORAGE_DIR`) — every user's data lives under `home/<user>/`,
- one JSON user store (`data/users.json`) — the identity + quota source of truth,
- stateless JWT auth (so no shared session store is needed).

## Quick start

```bash
cd minicloud
npm install
cp .env.example .env        # then edit secrets!
bash start.sh               # starts gateway + 7 services
# open http://localhost:3000        — public landing page
# open http://localhost:3000/app    — the application (sign in / sign up)
```

Create the first administrator (registration only creates normal users):

```bash
node scripts/seed-admin.js admin StrongPass123
```

Then sign in at `/app` and you'll see the 🛡️ Admin panel.

### Environment variables

| Var | Default | Description |
|-----|---------|-------------|
| `STORAGE_DIR` | `./storage` | The single shared storage volume for all services. |
| `JWT_SECRET` | *auto-generated per session* | Signs auth tokens. **Required & strong**: if missing or a known default, every service refuses to boot. Persist it (e.g. in `.env`) so restarts keep sessions valid. |
| `VAULT_SECRET` | *auto-generated per session* | Derives vault encryption keys. Same requirement as `JWT_SECRET`. |
| `MAX_FILE_SIZE_MB` | `100` | Max upload size per file (files & gallery). |
| `DEFAULT_QUOTA_MB` | `100` | Default per-user storage quota. |
| `BIND_HOST` | `127.0.0.1` | Interface the 7 internal microservices (auth/files/notes/gallery/vault/bookmarks/admin) listen on. Keep this as localhost-only in production; only the gateway should be network-reachable. |
| `GATEWAY_BIND_HOST` | `0.0.0.0` | Interface the gateway listens on. Narrow this (e.g. to `127.0.0.1`) if you terminate TLS with a reverse proxy on the same host and don't want the gateway directly reachable either. |
| `JSON_BODY_LIMIT` | `1mb` | Max size of a JSON request body, applied consistently across every service (notes, vault entries, bookmarks, admin actions, etc.). |

## Security

This suite was hardened in audit follow-up. Highlights:

- **Secrets are mandatory.** `shared/lib.js` exits immediately if `JWT_SECRET`/`VAULT_SECRET` are missing or equal a known default. `start.sh` auto-generates strong random secrets for a session (load a `.env` to persist them across restarts).
- **Internal services are localhost-only by default.** auth/files/notes/gallery/vault/bookmarks/admin bind to `127.0.0.1` (see `BIND_HOST` above), so they're unreachable from outside the box even if the firewall is misconfigured. Only the gateway is exposed by default.
- **TLS.** The auth cookie is marked `Secure` whenever the request is served over HTTPS (`x-forwarded-proto`). Terminate TLS at the gateway / reverse proxy (see nginx snippet) — do **not** expose port 3000 over plain HTTP.
- **Rate limiting.** `/api/auth/login` and `/api/auth/register` are limited (20 attempts / 15 min per IP). On top of that, the gateway applies a looser baseline limit (300 requests / minute per IP) across *all* `/api/*` routes, so no proxied endpoint — uploads, notes, vault, bookmarks, admin — is left completely unthrottled. Both via `express-rate-limit`.
- **Login timing.** Login always performs a same-cost `bcrypt.compare()`, even when the username doesn't exist (against a fixed dummy hash), so response time can't be used to enumerate registered usernames.
- **Security headers.** The gateway applies `helmet` (CSP, `X-Content-Type-Options`, `X-Frame-Options`, etc.). The CSP allows the SPA's CDN fonts/styles and same-origin scripts.
- **CSRF.** Cookies are `SameSite=Lax`; the gateway additionally rejects state-changing requests whose `Origin` does not match the host.
- **Quota is enforced server-side** using the *actual* bytes written by `multer` (not the client-supplied `Content-Length`), evaluated after upload; overflowing uploads are rejected and the just-written files are rolled back.
- **Vault.** Secrets are encrypted at rest with AES-256-GCM, key derived per user from `VAULT_SECRET` + a per-user salt; only the detail endpoint returns the decrypted secret. A user record with no salt is treated as a hard error rather than falling back to a shared salt.
- **Stored XSS.** Bookmark URLs are validated to `http(s)://` on both store and render; the gallery serves non-raster uploads as attachments with `nosniff`.
- **User store.** The shared `users.json` is written atomically (temp + rename) and mutations are serialized through a cross-process lock, preventing corruption/lost updates across the 8 services.
- **Suspension takes effect immediately.** Every request re-checks the live user record, not just the JWT signature — a suspended or deleted user's existing session stops working on their very next request instead of remaining valid until the token expires (up to 7 days otherwise).
- **Admin self-lockout guard.** An admin can't delete, demote, or suspend their own account via the API.

## Running in production (pm2)

```bash
# Either export vars first, or drop a .env next to ecosystem.config.js —
# it's loaded automatically (see M-2 in the audit notes below).
cp .env.example .env   # then edit secrets!
npm install --production
pm2 start ecosystem.config.js
pm2 save && pm2 startup
```

## Deploying behind nginx + HTTPS

```nginx
server {
  listen 443 ssl;
  server_name cloud.yourdomain.com;
  ssl_certificate     /etc/letsencrypt/live/cloud.yourdomain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/cloud.yourdomain.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 500m;   # match MAX_FILE_SIZE_MB
  }
}
```

With this setup, also firewall ports 3000–4007 from external traffic at the OS/VPS level (e.g. `ufw`) and let nginx be the only public entry point on 443. The gateway defaults to listening on all interfaces (`GATEWAY_BIND_HOST=0.0.0.0`) precisely so nginx can reach it — the firewall, not the app, is what should keep it from being hit directly. The 7 internal services already default to `127.0.0.1` regardless.

## Project layout

```
minicloud/
├── gateway/index.js        # API gateway (port 3000)
├── services/
│   ├── auth/  files/  notes/  gallery/  vault/  bookmarks/  admin/
│   └── <name>/index.js     # each microservice
├── shared/lib.js           # storage layout, user store, JWT + vault crypto
├── public/
│   ├── index.html           # public landing page (served at /)
│   ├── logo.jpg             # shared brand asset
│   └── app/                 # the SPA: index.html, styles.css, app.js (served at /app)
├── scripts/seed-admin.js   # create the first admin
├── start.sh                # run the whole suite locally
├── ecosystem.config.js     # pm2 process file
├── .env.example
└── package.json
```

## API reference (all under the gateway)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | ❌ | Create account (role: user) |
| POST | `/api/auth/login` | ❌ | Sign in (sets JWT cookie) |
| POST | `/api/auth/logout` | ✅ | Sign out |
| GET  | `/api/auth/me` | ✅ | Current user + quota/usage |
| POST | `/api/files/upload` | ✅ | Upload file(s) |
| GET  | `/api/files` | ✅ | List files |
| GET  | `/api/files/download/:name` | ✅ | Download |
| DELETE | `/api/files/:name` | ✅ | Delete file |
| GET/POST/PUT/DELETE | `/api/notes(/:id)` | ✅ | Notes CRUD |
| GET/POST/DELETE | `/api/gallery(/:name)` | ✅ | Gallery (upload is `/api/gallery/upload`) |
| GET/POST/PUT/DELETE | `/api/vault(/:id)` | ✅ | Vault CRUD (secrets encrypted at rest) |
| GET/POST/PUT/DELETE | `/api/bookmarks(/:id)` | ✅ | Bookmarks CRUD |
| GET/POST/DELETE/PATCH | `/api/admin/users(/:username)` | 🛡️ admin | User management |
| GET  | `/api/admin/stats` | 🛡️ admin | Global usage stats |
| GET  | `/healthz` | ❌ | Liveness check — on the gateway (`:3000`) **and** on every microservice (`:4001`–`:4007`), unauthenticated, meant for an orchestrator (PM2, Docker, a load balancer) to probe. Not proxied through `/api/*`. |

## Security notes
- Passwords: bcrypt-hashed. Tokens: stateless JWT in an `HttpOnly`, `SameSite=Lax` cookie.
- Vault secrets are encrypted with **AES-256-GCM**, key derived per user from `VAULT_SECRET` + a per-user salt; only the detail endpoint returns the decrypted secret.
- Quota is enforced on upload (files & gallery) against `usedBytes` computed across the whole user home.
- `STORAGE_DIR` is only as safe as your VPS disk — **back it up** (rsync / snapshots).
- Every numeric config value (`PORT`, `MAX_FILE_SIZE_MB`, `DEFAULT_QUOTA_MB`, `API_RATE_LIMIT_MAX`) is validated at startup — a malformed or non-positive value makes the process exit immediately with a clear `[FATAL]` message instead of silently falling back or computing with `NaN`.
- The gateway's per-IP API rate limit (default 300 requests/min across all `/api/*` routes) is configurable via `API_RATE_LIMIT_MAX` — see `.env.example`.

## Possible next steps
- Service-level enable/disable per user.
- Tiered plans (free/pro) with different quotas.
- Real OAuth (the social buttons are currently decorative).
- Search, folders, and file previews in the file/gallery services.
