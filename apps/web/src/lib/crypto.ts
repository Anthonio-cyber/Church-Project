import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { env } from './env';

type ScryptOptions = { N: number; r: number; p: number; maxmem: number };

/**
 * Promise wrapper around node's scrypt. `promisify` cannot express the
 * options-bearing overload, so the wrapper is written out.
 */
function scrypt(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

// scrypt parameters. N=2^15 with r=8 is a commonly recommended interactive
// login cost: roughly 100ms and 32MB per hash on server-class hardware.
const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

/**
 * Hash a password with scrypt and a per-password random salt.
 * Format: scrypt$N$r$p$salt$derivedKey (all base64url).
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 128 * SCRYPT_N * SCRYPT_R * 2,
  });
  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('base64url'),
    derived.toString('base64url'),
  ].join('$');
}

/** Constant-time password verification. Never short-circuits on mismatch. */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltB64, keyB64] = parts;
  const salt = Buffer.from(saltB64, 'base64url');
  const expected = Buffer.from(keyB64, 'base64url');
  try {
    const derived = await scrypt(password.normalize('NFKC'), salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 128 * Number(n) * Number(r) * 2,
    });
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/** Password policy shared by the API and the registration form. */
export function assessPasswordStrength(password: string): {
  ok: boolean;
  problems: string[];
} {
  const problems: string[] = [];
  if (password.length < 12) problems.push('Use at least 12 characters.');
  if (!/[a-z]/.test(password)) problems.push('Include a lowercase letter.');
  if (!/[A-Z]/.test(password)) problems.push('Include an uppercase letter.');
  if (!/[0-9]/.test(password)) problems.push('Include a number.');
  if (/^(.)\1+$/.test(password)) problems.push('Avoid repeated characters.');
  const common = ['password', 'welcome', 'church', 'jesus123', 'qwerty', '12345678'];
  if (common.some((c) => password.toLowerCase().includes(c))) {
    problems.push('Avoid common words that are easy to guess.');
  }
  return { ok: problems.length === 0, problems };
}

/** Opaque, high-entropy token for sessions, email verification and resets. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * Session and verification tokens are stored only as HMACs. A database leak
 * therefore does not hand an attacker usable session cookies.
 */
export function hashToken(token: string): string {
  return createHmac('sha256', env.authSecret).update(token).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// ---------------------------------------------------------------------------
// Envelope encryption for sensitive records (counselling notes, safeguarding
// narratives). AES-256-GCM gives confidentiality plus tamper detection.
// ---------------------------------------------------------------------------

function encryptionKey(): Buffer {
  return createHash('sha256').update(env.dataEncryptionKey).digest();
}

export function encryptSensitive(plaintext: string): {
  cipher: string;
  iv: string;
} {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    cipher: Buffer.concat([encrypted, tag]).toString('base64'),
    iv: iv.toString('base64'),
  };
}

export function decryptSensitive(cipherText: string, ivB64: string): string {
  const raw = Buffer.from(cipherText, 'base64');
  const tag = raw.subarray(raw.length - 16);
  const body = raw.subarray(0, raw.length - 16);
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(ivB64, 'base64'),
  );
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}

// ---------------------------------------------------------------------------
// TOTP (RFC 6238) for administrator and counsellor multi-factor authentication.
// ---------------------------------------------------------------------------

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(length = 20): string {
  const bytes = randomBytes(length);
  let bits = '';
  for (const byte of bytes) bits += byte.toString(2).padStart(8, '0');
  let secret = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    secret += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  return secret;
}

function base32Decode(secret: string): Buffer {
  const clean = secret.replace(/=+$/, '').toUpperCase();
  let bits = '';
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function totpAt(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', key).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return (binary % 1_000_000).toString().padStart(6, '0');
}

export function currentTotp(secret: string, at: Date = new Date()): string {
  return totpAt(secret, Math.floor(at.getTime() / 1000 / 30));
}

/** Accepts the current step plus one step either side to tolerate clock drift. */
export function verifyTotp(secret: string, code: string, at: Date = new Date()): boolean {
  const normalised = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(normalised)) return false;
  const counter = Math.floor(at.getTime() / 1000 / 30);
  for (let drift = -1; drift <= 1; drift += 1) {
    if (safeEqual(totpAt(secret, counter + drift), normalised)) return true;
  }
  return false;
}

export function totpUri(secret: string, account: string, issuer = 'Remnant Platform'): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(
    account,
  )}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/** Human-friendly, non-guessable reference for reports and cases. */
export function humanReference(prefix: string): string {
  const year = new Date().getFullYear();
  const suffix = Array.from({ length: 6 }, () =>
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)],
  ).join('');
  return `${prefix}-${year}-${suffix}`;
}
