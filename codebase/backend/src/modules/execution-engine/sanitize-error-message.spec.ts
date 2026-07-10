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

  it('does not truncate at exactly the cap (500 chars stay whole)', () => {
    const exact = 'x'.repeat(500);
    const out = sanitizeErrorMessage(new Error(exact));
    expect(out.length).toBe(500);
    expect(out.endsWith('…')).toBe(false);
  });

  it('truncates at cap+1 (501 chars → 500 + ellipsis)', () => {
    const out = sanitizeErrorMessage(new Error('x'.repeat(501)));
    expect(out.length).toBe(501); // 500 kept + '…'
    expect(out.endsWith('…')).toBe(true);
  });

  it('masks BEFORE truncating (a secret near the cap is fully masked, not partially exposed)', () => {
    // Secret placed so the raw token would straddle the 500-char cap; masking
    // must run first so the whole token becomes *** rather than a truncated tail.
    const prefix = 'y'.repeat(480);
    const out = sanitizeErrorMessage(
      new Error(`${prefix} Authorization: Bearer sk-live-BOUNDARY-abcdef". `),
    );
    expect(out).not.toContain('sk-live-BOUNDARY');
    expect(out).toContain('***');
  });
});
