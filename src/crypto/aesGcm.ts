// AES-256-GCM authenticated encryption.
//
// Wire format (returned by `encrypt`, accepted by `decrypt`):
//
//   [0..11]   12-byte nonce (random / unique per encryption)
//   [12..]    AES-GCM ciphertext + 16-byte auth tag (concatenated by
//             @noble/ciphers' gcm())
//
// We prepend the nonce so the on-disk vault carries everything decrypt
// needs alongside the salt + KDF params. The nonce is not secret.
// Nonces come from the native SecureRandom (see encrypt below) —
// required because the conversations store reuses one derived key
// across many encryptions.
//
// `decrypt` distinguishes between "wrong key" (auth tag mismatch) and
// "malformed input" (length or shape) so the caller can show the right
// message ("wrong PIN" vs "vault file corrupt").

import {gcm} from '@noble/ciphers/aes.js';
import {randomBytes, randomBytesSync} from './randomBytes';

export const NONCE_LENGTH_BYTES = 12;
const TAG_LENGTH_BYTES = 16;
export const KEY_LENGTH_BYTES = 32;
const MIN_PAYLOAD_BYTES = NONCE_LENGTH_BYTES + TAG_LENGTH_BYTES;

export type DecryptResult =
  | {ok: true; plaintext: Uint8Array}
  | {ok: false; reason: 'wrong-key' | 'malformed'};

const assertKey = (key: Uint8Array): void => {
  if (!(key instanceof Uint8Array) || key.length !== KEY_LENGTH_BYTES) {
    throw new RangeError(
      `aesGcm: key must be a Uint8Array of length ${KEY_LENGTH_BYTES}`,
    );
  }
};

let warnedAboutSyncNonce = false;

// Async since the nonce moved to the native CSPRNG. The original
// sync version justified its uniqueness-only nonce generator with
// "the vault re-salts (→ re-keys) on every save" — true for the
// vault, but NOT for the conversations store, which reuses the same
// derived key across every save of a session and across sessions.
// Under a reused key, a nonce collision is catastrophic in GCM
// (keystream reuse + tag forgery), so nonces now come from
// java.security.SecureRandom like the KDF salts do. Both production
// callers (vault, conversations) were already async.
//
// The uniqueness-only sync generator remains as a warned fallback:
// any context that can produce a key has the native bridge (deriveKey
// hard-fails without it), so the fallback only fires in unusual
// embeddings — and uniqueness is still sufficient for single-use keys.
export const encrypt = async (
  key: Uint8Array,
  plaintext: Uint8Array,
): Promise<Uint8Array> => {
  assertKey(key);
  if (!(plaintext instanceof Uint8Array)) {
    throw new TypeError('aesGcm.encrypt: plaintext must be a Uint8Array');
  }
  let nonce: Uint8Array;
  try {
    nonce = await randomBytes(NONCE_LENGTH_BYTES);
  } catch (e) {
    if (!warnedAboutSyncNonce) {
      warnedAboutSyncNonce = true;
      console.warn(
        `aesGcm: native SecureRandom unavailable (${(e as Error).message}); ` +
          'using uniqueness-only nonce generation.',
      );
    }
    nonce = randomBytesSync(NONCE_LENGTH_BYTES);
  }
  const ciphertext = gcm(key, nonce).encrypt(plaintext);
  const out = new Uint8Array(NONCE_LENGTH_BYTES + ciphertext.length);
  out.set(nonce, 0);
  out.set(ciphertext, NONCE_LENGTH_BYTES);
  return out;
};

// Test-only — resets the one-time fallback warning between cases.
export const __testing__ = {
  resetWarnedFlag: (): void => {
    warnedAboutSyncNonce = false;
  },
};

export const decrypt = (key: Uint8Array, payload: Uint8Array): DecryptResult => {
  assertKey(key);
  if (!(payload instanceof Uint8Array) || payload.length < MIN_PAYLOAD_BYTES) {
    return {ok: false, reason: 'malformed'};
  }
  const nonce = payload.subarray(0, NONCE_LENGTH_BYTES);
  const ciphertext = payload.subarray(NONCE_LENGTH_BYTES);
  try {
    const plaintext = gcm(key, nonce).decrypt(ciphertext);
    return {ok: true, plaintext};
  } catch {
    // @noble/ciphers throws on tag mismatch. We can't reliably tell
    // tag-mismatch from "ciphertext length not a multiple of block size"
    // here (both surface as Error from the same call site), so we
    // collapse them into "wrong-key" — caller treats both as "the user
    // typed the wrong PIN, prompt again."
    return {ok: false, reason: 'wrong-key'};
  }
};
