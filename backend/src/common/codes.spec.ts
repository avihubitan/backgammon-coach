import { hashCode, newBackupCode, normalizeCode } from './codes';

describe('backup codes', () => {
  it('are 20 base32 symbols in groups of four, and different every time', () => {
    const codes = new Set(Array.from({ length: 200 }, newBackupCode));
    expect(codes.size).toBe(200);
    for (const code of codes) expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){4}$/);
  });

  it('normalize what people type, including look-alike letters', () => {
    const code = '0O1I-L2AB-CDEF-GH3J-KMNP';
    expect(normalizeCode(code)).toBe('00111' + '2ABCDEFGH3JKMNP');
    expect(normalizeCode(' 0o1i l2ab cdef gh3j kmnp ')).toBe(normalizeCode(code));
    expect(normalizeCode('too-short')).toBeNull();
    expect(normalizeCode('UUUU-UUUU-UUUU-UUUU-UUUU')).toBeNull();
  });

  it('hash to a stable SHA-256 hex digest', () => {
    const code = normalizeCode(newBackupCode())!;
    expect(hashCode(code)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashCode(code)).toBe(hashCode(code));
  });
});
