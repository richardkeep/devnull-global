// Signs requests the way dev/null's signed API expects: SSHSIG signatures, as made by
// `ssh-keygen -Y sign`, from an Ed25519 key that never leaves the browser.
// See https://github.com/openssh/openssh-portable/blob/master/PROTOCOL.sshsig
const encoder = new TextEncoder();
const MAGIC = encoder.encode('SSHSIG');
export const NAMESPACE = 'devnull-api';

function concat(...parts) {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

function uint32(value) {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value);
  return out;
}

const sshString = value => {
  const bytes = typeof value === 'string' ? encoder.encode(value) : new Uint8Array(value);
  return concat(uint32(bytes.length), bytes);
};
const base64 = bytes => btoa(String.fromCharCode(...bytes));
const base64url = bytes => base64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const sha = async (algorithm, data) => new Uint8Array(await crypto.subtle.digest(algorithm, data));

export const randomHex = bytes => [...crypto.getRandomValues(new Uint8Array(bytes))]
  .map(byte => byte.toString(16).padStart(2, '0')).join('');

export const publicKeyBlob = raw => concat(sshString('ssh-ed25519'), sshString(raw));

// Matches `ssh-keygen -lf`: unpadded base64 of the SHA-256 of the public key blob.
export async function fingerprint(raw) {
  return 'SHA256:' + base64(await sha('SHA-256', publicKeyBlob(raw))).replace(/=+$/, '');
}

export async function generateKeyPair() {
  // The private key is not extractable: it can sign, but script can never read it back.
  const keys = await crypto.subtle.generateKey({name: 'Ed25519'}, false, ['sign', 'verify']);
  return {privateKey: keys.privateKey, publicKey: new Uint8Array(await crypto.subtle.exportKey('raw', keys.publicKey))};
}

export async function signSshsig({privateKey, publicKey}, message, namespace = NAMESPACE) {
  const hash = await sha('SHA-512', encoder.encode(message));
  const signedData = concat(MAGIC, sshString(namespace), sshString(''), sshString('sha512'), sshString(hash));
  const signature = new Uint8Array(await crypto.subtle.sign({name: 'Ed25519'}, privateKey, signedData));
  return base64(concat(MAGIC, uint32(1), sshString(publicKeyBlob(publicKey)), sshString(namespace),
    sshString(''), sshString('sha512'), sshString(concat(sshString('ssh-ed25519'), sshString(signature)))));
}

// The signed message is "<timestamp>\n<nonce>\n<METHOD>\n<path and query>\n<body>". Each nonce is spent
// on first use, so every request (including a retry) needs fresh headers.
export async function signatureHeaders(keys, method, uri, body = '') {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomHex(16);
  return {
    'X-Devnull-Timestamp': timestamp,
    'X-Devnull-Nonce': nonce,
    'X-SSH-Signature': await signSshsig(keys, [timestamp, nonce, method.toUpperCase(), uri, body].join('\n'))
  };
}

// PKCE (RFC 7636) S256 verifier and challenge.
export async function pkcePair() {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  return {verifier, challenge: base64url(await sha('SHA-256', encoder.encode(verifier)))};
}
