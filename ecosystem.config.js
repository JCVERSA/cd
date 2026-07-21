// pm2 process file — runs the gateway + all microservices.
//
// M-2: unlike start.sh, `pm2 start` does not source .env or generate secrets
// for you. This file now loads .env itself (same simple `KEY=VALUE` format
// start.sh expects) so `pm2 start ecosystem.config.js` works from a fresh
// shell as long as a .env file is present next to it. Required vars
// (JWT_SECRET, VAULT_SECRET) still fail loudly at boot via shared/lib.js if
// missing or left at an insecure default — this only fixes the "silently
// inherits whatever's in the launching shell" trap, it doesn't relax that check.
'use strict';
const fs = require('fs');
const path = require('path');

function loadDotEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    let val = (m[2] || '').trim();
    if (val.length >= 2 && ((val[0] === '"' && val.at(-1) === '"') || (val[0] === "'" && val.at(-1) === "'"))) {
      val = val.slice(1, -1);
    }
    out[m[1]] = val;
  }
  return out;
}

// Shared vars every app needs. process.env takes precedence over .env so an
// operator can still override via `export` before `pm2 start` if preferred.
const dotEnv = loadDotEnv(path.join(__dirname, '.env'));
const shared = {
  STORAGE_DIR: process.env.STORAGE_DIR || dotEnv.STORAGE_DIR,
  JWT_SECRET: process.env.JWT_SECRET || dotEnv.JWT_SECRET,
  VAULT_SECRET: process.env.VAULT_SECRET || dotEnv.VAULT_SECRET,
  MAX_FILE_SIZE_MB: process.env.MAX_FILE_SIZE_MB || dotEnv.MAX_FILE_SIZE_MB || '100',
  DEFAULT_QUOTA_MB: process.env.DEFAULT_QUOTA_MB || dotEnv.DEFAULT_QUOTA_MB || '100',
  BIND_HOST: process.env.BIND_HOST || dotEnv.BIND_HOST,
  GATEWAY_BIND_HOST: process.env.GATEWAY_BIND_HOST || dotEnv.GATEWAY_BIND_HOST
};

module.exports = {
  apps: [
    { name: 'mc-gateway',    script: 'gateway/index.js',           env: { ...shared, PORT: 3000 } },
    { name: 'mc-auth',       script: 'services/auth/index.js',     env: { ...shared, PORT: 4001 } },
    { name: 'mc-files',      script: 'services/files/index.js',    env: { ...shared, PORT: 4002 } },
    { name: 'mc-notes',      script: 'services/notes/index.js',    env: { ...shared, PORT: 4003 } },
    { name: 'mc-gallery',    script: 'services/gallery/index.js',  env: { ...shared, PORT: 4004 } },
    { name: 'mc-vault',      script: 'services/vault/index.js',    env: { ...shared, PORT: 4005 } },
    { name: 'mc-bookmarks',  script: 'services/bookmarks/index.js', env: { ...shared, PORT: 4006 } },
    { name: 'mc-admin',      script: 'services/admin/index.js',    env: { ...shared, PORT: 4007 } }
  ]
};
