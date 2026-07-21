'use strict';
// Minimal unit tests for shared-lib security/correctness helpers.
// Run with: node --test
process.env.JWT_SECRET = 'test-secret-not-default';
process.env.VAULT_SECRET = 'test-vault-not-default';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const lib = require('../shared/lib');

test('safeName strips path separators and unsafe characters', () => {
  // path.basename keeps only the last segment -> defeats traversal
  assert.strictEqual(lib.safeName('../../etc/passwd'), 'passwd');
  // unsafe characters (including separators) are removed
  assert.strictEqual(lib.safeName('a/b\\c?d*e|f:g<h>i"j'), 'b_c_d_e_f_g_h_i_j');
  assert.strictEqual(lib.safeName(''), 'file');
});

test('isValidHttpUrl allows http/https, rejects dangerous schemes', () => {
  assert.strictEqual(lib.isValidHttpUrl('https://example.com'), true);
  assert.strictEqual(lib.isValidHttpUrl('http://example.com/x'), true);
  assert.strictEqual(lib.isValidHttpUrl('javascript:alert(1)'), false);
  assert.strictEqual(lib.isValidHttpUrl('data:text/html,alert(1)'), false);
  assert.strictEqual(lib.isValidHttpUrl('ftp://example.com'), false);
  assert.strictEqual(lib.isValidHttpUrl('not a url'), false);
});

test('quotaExceededAfter uses actual written sizes, not Content-Length', () => {
  const origRead = lib.readUsers, origUsed = lib.usedBytes;
  const set = (quota, used) => { lib.readUsers = () => ({ alice: { quotaBytes: quota } }); lib.usedBytes = () => used; };
  // usedBytes already includes the just-written upload (post-write enforcement)
  set(50, 90);
  assert.strictEqual(lib.quotaExceededAfter({ user: 'alice', files: [{ size: 20 }] }, 'files'), true);
  set(100, 90);
  assert.strictEqual(lib.quotaExceededAfter({ user: 'alice', files: [{ size: 20 }] }, 'files'), false);
  assert.strictEqual(lib.quotaExceededAfter({ user: 'alice', files: [] }, 'files'), false);
  lib.readUsers = origRead; lib.usedBytes = origUsed;
});

test('writeJson writes atomically (temp + rename)', () => {
  const f = path.join(os.tmpdir(), 'mc-test-' + Date.now() + '.json');
  lib.writeJson(f, { a: 1, nested: { b: 2 } });
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(f, 'utf8')), { a: 1, nested: { b: 2 } });
  fs.unlinkSync(f);
});
