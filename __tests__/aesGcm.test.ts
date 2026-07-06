/* eslint-disable no-bitwise */
/**
 * Tests for src/crypto/aesGcm. Pins:
 *   1. Round-trip: encrypt → decrypt yields the original plaintext.
 *   2. Each encrypt with the same key produces a different output
 *      (random nonce).
 *   3. The nonce comes from the native SecureRandom path
 *      (CopilotOverlay.cryptoRandomBytes); when that path fails the
 *      uniqueness-only sync generator takes over with a one-time warn.
 *   4. Tamper detection: flipping any byte after the nonce breaks
 *      decryption (auth-tag mismatch).
 *   5. Wrong-key rejection.
 *   6. Malformed input (too short / not Uint8Array) is rejected without
 *      throwing.
 *   7. Argument validation on key length (rejects — encrypt is async).
 */
jest.mock('../src/native/CopilotOverlay', () => {
  const {
    cryptoPbkdf2Sha256MockImpl,
    cryptoRandomBytesMockImpl,
  } = require('./helpers/cryptoMockImpl');
  return {
    __esModule: true,
    default: {
      cryptoPbkdf2Sha256: jest.fn(cryptoPbkdf2Sha256MockImpl),
      cryptoRandomBytes: jest.fn(cryptoRandomBytesMockImpl),
    },
  };
});

import CopilotOverlay from '../src/native/CopilotOverlay';
import {
  KEY_LENGTH_BYTES,
  NONCE_LENGTH_BYTES,
  __testing__,
  decrypt,
  encrypt,
} from '../src/crypto/aesGcm';

const mockedRandomBytes = (CopilotOverlay as unknown as {
  cryptoRandomBytes: jest.Mock;
}).cryptoRandomBytes;

const fixedKey = (seed: number): Uint8Array => {
  const out = new Uint8Array(KEY_LENGTH_BYTES);
  for (let i = 0; i < KEY_LENGTH_BYTES; i++) {
    out[i] = (seed * 31 + i) & 0xff;
  }
  return out;
};

const utf8 = new TextEncoder();

beforeEach(() => {
  __testing__.resetWarnedFlag();
  mockedRandomBytes.mockClear();
});

describe('aesGcm — round-trip', () => {
  it('decrypt(encrypt(plaintext)) === plaintext', async () => {
    const k = fixedKey(1);
    const pt = utf8.encode('a real API key starts with sk-');
    const ct = await encrypt(k, pt);
    const r = decrypt(k, ct);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Buffer.from(r.plaintext).toString('utf8')).toBe(
        'a real API key starts with sk-',
      );
    }
  });

  it('round-trips empty plaintext', async () => {
    const k = fixedKey(2);
    const ct = await encrypt(k, new Uint8Array(0));
    const r = decrypt(k, ct);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.plaintext.length).toBe(0);
    }
  });

  it('round-trips a multi-KB payload', async () => {
    const k = fixedKey(3);
    const pt = new Uint8Array(8_192);
    for (let i = 0; i < pt.length; i++) {
      pt[i] = i & 0xff;
    }
    const ct = await encrypt(k, pt);
    const r = decrypt(k, ct);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.plaintext.length).toBe(8_192);
      expect(Buffer.from(r.plaintext).toString('hex')).toBe(
        Buffer.from(pt).toString('hex'),
      );
    }
  });
});

describe('aesGcm — nonce sourcing', () => {
  it('draws the nonce from the native SecureRandom bridge', async () => {
    await encrypt(fixedKey(1), utf8.encode('x'));
    expect(mockedRandomBytes).toHaveBeenCalledWith(NONCE_LENGTH_BYTES);
  });

  it('produces different ciphertexts for the same plaintext + key', async () => {
    const k = fixedKey(4);
    const pt = utf8.encode('same plaintext');
    const a = await encrypt(k, pt);
    const b = await encrypt(k, pt);
    expect(Buffer.from(a).toString('hex')).not.toBe(
      Buffer.from(b).toString('hex'),
    );
    // The first 12 bytes are the nonce; assert they differ.
    expect(Buffer.from(a.slice(0, NONCE_LENGTH_BYTES)).toString('hex')).not.toBe(
      Buffer.from(b.slice(0, NONCE_LENGTH_BYTES)).toString('hex'),
    );
  });

  it('falls back to the sync generator (one warn) when native fails', async () => {
    mockedRandomBytes.mockResolvedValueOnce({
      success: false,
      code: 'MODULE_MISSING',
      message: 'no bridge',
    });
    mockedRandomBytes.mockResolvedValueOnce({
      success: false,
      code: 'MODULE_MISSING',
      message: 'no bridge',
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const k = fixedKey(12);
      const a = await encrypt(k, utf8.encode('fallback payload'));
      const b = await encrypt(k, utf8.encode('fallback payload'));
      // Still round-trips…
      expect(decrypt(k, a).ok).toBe(true);
      // …nonces still unique…
      expect(Buffer.from(a.slice(0, NONCE_LENGTH_BYTES)).toString('hex')).not.toBe(
        Buffer.from(b.slice(0, NONCE_LENGTH_BYTES)).toString('hex'),
      );
      // …and the degradation warned exactly once.
      const nonceWarns = warn.mock.calls.filter(c =>
        String(c[0]).includes('uniqueness-only nonce'),
      );
      expect(nonceWarns).toHaveLength(1);
    } finally {
      warn.mockRestore();
    }
  });
});

describe('aesGcm — tamper detection', () => {
  it('rejects ciphertext with a flipped tag byte', async () => {
    const k = fixedKey(5);
    const ct = await encrypt(k, utf8.encode('payload'));
    // Flip the last byte (inside the auth tag).
    ct[ct.length - 1] ^= 0xff;
    const r = decrypt(k, ct);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('wrong-key');
    }
  });

  it('rejects ciphertext with a flipped middle byte', async () => {
    const k = fixedKey(6);
    const ct = await encrypt(k, utf8.encode('a payload long enough to flip mid'));
    ct[NONCE_LENGTH_BYTES + 5] ^= 0x01;
    const r = decrypt(k, ct);
    expect(r.ok).toBe(false);
  });
});

describe('aesGcm — wrong key', () => {
  it('rejects decryption with a different key', async () => {
    const ct = await encrypt(fixedKey(7), utf8.encode('secret'));
    const r = decrypt(fixedKey(8), ct);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('wrong-key');
    }
  });
});

describe('aesGcm — malformed input', () => {
  it.each([0, 5, NONCE_LENGTH_BYTES, NONCE_LENGTH_BYTES + 15])(
    'rejects payload of length %d as malformed',
    (len) => {
      const r = decrypt(fixedKey(9), new Uint8Array(len));
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.reason).toBe('malformed');
      }
    },
  );

  it('rejects non-Uint8Array payload as malformed', () => {
    // @ts-expect-error — testing runtime guard
    const r = decrypt(fixedKey(10), 'not bytes');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('malformed');
    }
  });
});

describe('aesGcm — key validation', () => {
  it.each([0, 16, 24, 64])('rejects key of length %d', async (len) => {
    await expect(encrypt(new Uint8Array(len), utf8.encode('x'))).rejects.toThrow(
      /key/,
    );
    expect(() => decrypt(new Uint8Array(len), new Uint8Array(50))).toThrow(/key/);
  });

  it('rejects non-Uint8Array key', async () => {
    // @ts-expect-error — testing runtime guard
    await expect(encrypt('not bytes', utf8.encode('x'))).rejects.toThrow(/key/);
  });

  it('rejects non-Uint8Array plaintext on encrypt', async () => {
    // @ts-expect-error — testing runtime guard
    await expect(encrypt(fixedKey(11), 'not bytes')).rejects.toThrow(
      /plaintext/,
    );
  });
});
