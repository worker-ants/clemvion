import { sanitizeErrorMessage } from './sanitize-error-message';

describe('sanitizeErrorMessage', () => {
  it('strips stack-trace frames', () => {
    const err = new Error('boom\n    at foo (/app/src/x.ts:1:1)');
    const out = sanitizeErrorMessage(err);
    expect(out).not.toContain('at foo');
    expect(out).toContain('boom');
  });

  it('redacts connection-string URIs', () => {
    const out = sanitizeErrorMessage(
      new Error('connect failed postgres://user:pw@db:5432/app'),
    );
    expect(out).not.toContain('postgres://');
    expect(out).toContain('[REDACTED_URI]');
  });

  it('masks Bearer tokens echoed in the error message (EIA §R17 — 알림/이메일 누출 차단)', () => {
    const out = sanitizeErrorMessage(
      new Error('upstream 401: Authorization: Bearer sk-live-ERRTOKEN-1'),
    );
    expect(out).not.toContain('sk-live-ERRTOKEN-1');
    expect(out).toContain('***');
  });

  it('masks credential-keyword assignments (api_key / password)', () => {
    const out = sanitizeErrorMessage(
      new Error('request body {api_key=AKIAERR2, password: hunter2}'),
    );
    expect(out).not.toContain('AKIAERR2');
    expect(out).not.toContain('hunter2');
  });

  it('caps length at 500 chars with an ellipsis', () => {
    const out = sanitizeErrorMessage(new Error('x'.repeat(600)));
    expect(out.length).toBe(501); // 500 + '…'
    expect(out.endsWith('…')).toBe(true);
  });

  it('accepts non-Error input (stringified)', () => {
    expect(sanitizeErrorMessage('plain string error')).toBe(
      'plain string error',
    );
  });

  it('leaves a clean message unchanged', () => {
    expect(sanitizeErrorMessage(new Error('node timed out after 30s'))).toBe(
      'node timed out after 30s',
    );
  });
});
