import {
  LAST_ERROR_MESSAGE_MAX_LEN,
  redactSecrets,
  sanitizeLastErrorMessage,
} from './sanitize-error-message';

describe('redactSecrets (mask-only)', () => {
  it('masks Bearer tokens', () => {
    const out = redactSecrets('sent Bearer sk-live-abc123.DEF-456 to provider');
    expect(out).not.toContain('sk-live-abc123.DEF-456');
    expect(out).toContain('***');
  });

  it('masks Authorization header values', () => {
    expect(redactSecrets('Authorization: Bearer xyz')).not.toContain('xyz');
  });

  it.each([
    ['client_secret=super', 'super'],
    ['access_token: "abc123"', 'abc123'],
    ['api-key=AKIAEXAMPLE', 'AKIAEXAMPLE'],
    ['password: hunter2', 'hunter2'],
    ['secret=topsecret', 'topsecret'],
  ])('masks secret-keyword assignment %s', (input, leak) => {
    const out = redactSecrets(input);
    expect(out).not.toContain(leak);
    expect(out).toContain('***');
  });

  it('leaves non-secret text unchanged', () => {
    const clean = 'user clicked the submit button on the form';
    expect(redactSecrets(clean)).toBe(clean);
  });

  it('does NOT truncate long masked output (unlike sanitizeLastErrorMessage)', () => {
    const long = 'clean prose. '.repeat(50); // > 200 chars, no secrets
    expect(long.length).toBeGreaterThan(LAST_ERROR_MESSAGE_MAX_LEN);
    expect(redactSecrets(long)).toBe(long);
    expect(redactSecrets(long)).not.toContain('…');
  });

  it('returns non-string / empty input unchanged', () => {
    expect(redactSecrets('')).toBe('');
    expect(redactSecrets(undefined as never)).toBeUndefined();
  });

  it('is idempotent across repeated calls (shared g-flag regex lastIndex reset)', () => {
    const input = 'Authorization: Bearer tok123 and api_key=k456';
    const first = redactSecrets(input);
    expect(redactSecrets(input)).toBe(first);
    expect(redactSecrets(input)).toBe(first);
  });
});

describe('sanitizeLastErrorMessage (mask + truncate)', () => {
  it('masks secrets like redactSecrets', () => {
    const out = sanitizeLastErrorMessage('failed: Bearer sk-leak-999');
    expect(out).not.toContain('sk-leak-999');
    expect(out).toContain('***');
  });

  it('truncates masked output beyond the cap with an ellipsis', () => {
    const long = 'x'.repeat(LAST_ERROR_MESSAGE_MAX_LEN + 50);
    const out = sanitizeLastErrorMessage(long);
    expect(out.length).toBe(LAST_ERROR_MESSAGE_MAX_LEN + 1); // +1 for the '…'
    expect(out.endsWith('…')).toBe(true);
  });
});
