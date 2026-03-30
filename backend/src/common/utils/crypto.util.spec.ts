import { encrypt, decrypt } from './crypto.util';

describe('CryptoUtil', () => {
  // 32 bytes = 64 hex chars
  const testKey =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  it('should encrypt and decrypt a string', () => {
    const plaintext = 'hello world';
    const encrypted = encrypt(plaintext, testKey);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted.split(':').length).toBe(3);

    const decrypted = decrypt(encrypted, testKey);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertext for same input (random IV)', () => {
    const plaintext = 'test data';
    const encrypted1 = encrypt(plaintext, testKey);
    const encrypted2 = encrypt(plaintext, testKey);
    expect(encrypted1).not.toBe(encrypted2);
  });

  it('should encrypt and decrypt JSON data', () => {
    const data = JSON.stringify({ apiKey: 'sk-test-123', token: 'abc' });
    const encrypted = encrypt(data, testKey);
    const decrypted = decrypt(encrypted, testKey);
    expect(JSON.parse(decrypted)).toEqual({
      apiKey: 'sk-test-123',
      token: 'abc',
    });
  });

  it('should throw on invalid encrypted text format', () => {
    expect(() => decrypt('invalid', testKey)).toThrow(
      'Invalid encrypted text format',
    );
  });

  it('should throw on wrong key', () => {
    const wrongKey =
      'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const encrypted = encrypt('test', testKey);
    expect(() => decrypt(encrypted, wrongKey)).toThrow();
  });
});
