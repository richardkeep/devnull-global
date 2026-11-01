import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fingerprint, generateKeyPair, pkcePair, publicKeyBlob, signatureHeaders, signSshsig} from '../src/services/ssh-signing.js';

const hasSshKeygen = (() => {
  try { execFileSync('ssh-keygen', ['-?'], {stdio: 'ignore'}); return true; }
  catch (error) { return error.status != null; }
})();

test('signs request messages that ssh-keygen accepts', {skip: !hasSshKeygen && 'ssh-keygen not installed'}, async () => {
  const keys = await generateKeyPair();
  const headers = await signatureHeaders(keys, 'get', '/api/v1/users/tom/following?cursor=x');
  assert.match(headers['X-Devnull-Timestamp'], /^\d+$/);
  assert.match(headers['X-Devnull-Nonce'], /^[0-9a-f]{32}$/);
  const message = [headers['X-Devnull-Timestamp'], headers['X-Devnull-Nonce'], 'GET', '/api/v1/users/tom/following?cursor=x', ''].join('\n');
  const dir = mkdtempSync(join(tmpdir(), 'sshsig-'));
  const publicLine = `ssh-ed25519 ${Buffer.from(publicKeyBlob(keys.publicKey)).toString('base64')}`;
  writeFileSync(join(dir, 'allowed'), `globe ${publicLine}\n`);
  writeFileSync(join(dir, 'key.pub'), publicLine + '\n');
  writeFileSync(join(dir, 'message.sig'), `-----BEGIN SSH SIGNATURE-----\n${headers['X-SSH-Signature'].match(/.{1,70}/g).join('\n')}\n-----END SSH SIGNATURE-----\n`);
  const verified = execFileSync('ssh-keygen', ['-Y', 'verify', '-f', join(dir, 'allowed'), '-I', 'globe', '-n', 'devnull-api',
    '-s', join(dir, 'message.sig')], {input: message}).toString();
  assert.match(verified, /Good "devnull-api" signature/);
  assert.equal(execFileSync('ssh-keygen', ['-lf', join(dir, 'key.pub')]).toString().split(' ')[1], await fingerprint(keys.publicKey));
});

test('rejects a signature over a different message', {skip: !hasSshKeygen && 'ssh-keygen not installed'}, async () => {
  const keys = await generateKeyPair();
  const dir = mkdtempSync(join(tmpdir(), 'sshsig-'));
  writeFileSync(join(dir, 'allowed'), `globe ssh-ed25519 ${Buffer.from(publicKeyBlob(keys.publicKey)).toString('base64')}\n`);
  writeFileSync(join(dir, 'message.sig'), `-----BEGIN SSH SIGNATURE-----\n${await signSshsig(keys, 'one')}\n-----END SSH SIGNATURE-----\n`);
  assert.throws(() => execFileSync('ssh-keygen', ['-Y', 'verify', '-f', join(dir, 'allowed'), '-I', 'globe', '-n', 'devnull-api',
    '-s', join(dir, 'message.sig')], {input: 'two', stdio: 'pipe'}));
});

test('makes fingerprints and PKCE values in the formats dev/null validates', async () => {
  const keys = await generateKeyPair();
  assert.match(await fingerprint(keys.publicKey), /^SHA256:[A-Za-z0-9+/]{43}$/);
  const {verifier, challenge} = await pkcePair();
  assert.match(verifier, /^[A-Za-z0-9._~-]{43,128}$/);
  assert.match(challenge, /^[A-Za-z0-9_-]{43}$/);
});
