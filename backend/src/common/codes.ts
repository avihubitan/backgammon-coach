import { createHash, randomBytes, randomUUID } from 'node:crypto';

/**
 * Accounts are anonymous: a random backup code is the only credential. It is
 * shown to the player once (they can write it down to restore on another
 * device); the server keeps only its SHA-256 hash.
 *
 * Codes use Crockford's base32 (no I, L, O or U), 20 symbols = 100 bits,
 * grouped for reading: XXXX-XXXX-XXXX-XXXX-XXXX.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const SYMBOLS = 20;

export function newBackupCode(): string {
  const bytes = randomBytes(13);
  let bits = 0;
  let buffer = 0;
  let out = '';
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5 && out.length < SYMBOLS) {
      bits -= 5;
      out += ALPHABET[(buffer >> bits) & 31];
    }
  }
  return formatCode(out);
}

export function formatCode(symbols: string): string {
  return symbols.match(/.{1,4}/g)!.join('-');
}

/** Accepts what people type: lower case, spaces, dashes, and the look-alikes I, L and O. */
export function normalizeCode(input: string): string | null {
  const cleaned = input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0');
  if (cleaned.length !== SYMBOLS) return null;
  for (const char of cleaned) if (!ALPHABET.includes(char)) return null;
  return cleaned;
}

export function hashCode(normalized: string): string {
  return createHash('sha256').update(normalized).digest('hex');
}

export const newAccountId = () => randomUUID();
