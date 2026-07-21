#!/usr/bin/env node
'use strict';
/**
 * Creates the FIRST administrator account directly in the shared user store.
 * Run this once after starting the suite:
 *   node scripts/seed-admin.js <username> <password>
 * Uses the same STORAGE_DIR / DEFAULT_QUOTA_MB env as the services.
 * Writes are serialized through the shared cross-process lock.
 * Does NOT require JWT_SECRET / VAULT_SECRET to be set — this script never
 * signs a token or touches vault crypto, only the user store.
 */
// L2: this script only writes to users.json — it never signs a JWT or does
// vault crypto — so it doesn't need JWT_SECRET/VAULT_SECRET set. Every
// long-running service still enforces the full check.
process.env.MC_SKIP_SECRET_CHECK = '1';
const lib = require('../shared/lib');
const bcrypt = lib.bcrypt;
const [, , username, password] = process.argv;
if (!username || !password) {
  console.log('Usage: node scripts/seed-admin.js <username> <password>');
  process.exit(1);
}
lib.withUserLock(async () => {
  const users = lib.readUsers();
  const key = username.toLowerCase();
  if (users[key]) { console.log(`User "${username}" already exists.`); process.exit(1); }
  users[key] = {
    username,
    passwordHash: bcrypt.hashSync(password, 10),
    role: 'admin',
    status: 'active',
    quotaBytes: lib.DEFAULT_QUOTA_MB * 1024 * 1024,
    vaultSalt: lib.crypto.randomBytes(16).toString('hex'),
    createdAt: new Date().toISOString()
  };
  lib.writeUsers(users);
  console.log(`✅ Admin "${username}" created.`);
}).catch((e) => { console.error('Seed failed:', e.message); process.exit(1); });
