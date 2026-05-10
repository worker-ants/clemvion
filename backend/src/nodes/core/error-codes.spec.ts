import {
  ErrorCode,
  buildErrorEnvelope,
  maskEmailForErrorDetails,
  truncateForErrorDetails,
} from './error-codes';

describe('ErrorCode enum', () => {
  it('maps every key to its own name (UPPER_SNAKE_CASE)', () => {
    for (const [key, value] of Object.entries(ErrorCode)) {
      expect(value).toBe(key);
      expect(key).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });

  it('includes all categories referenced in CONVENTIONS §3.2', () => {
    expect(ErrorCode.HTTP_TRANSPORT_FAILED).toBeDefined();
    expect(ErrorCode.HTTP_4XX).toBeDefined();
    expect(ErrorCode.HTTP_5XX).toBeDefined();
    expect(ErrorCode.DB_QUERY_FAILED).toBeDefined();
    expect(ErrorCode.EMAIL_SEND_FAILED).toBeDefined();
    expect(ErrorCode.LLM_CALL_FAILED).toBeDefined();
    expect(ErrorCode.LLM_RESPONSE_INVALID).toBeDefined();
    expect(ErrorCode.MAX_COLLECTION_RETRIES_EXCEEDED).toBeDefined();
    expect(ErrorCode.CODE_EXECUTION_FAILED).toBeDefined();
    expect(ErrorCode.CODE_TIMEOUT).toBeDefined();
    expect(ErrorCode.SUB_WORKFLOW_FAILED).toBeDefined();
    // Sub-workflow specific codes added in Phase 1 A-3.
    expect(ErrorCode.SUB_WORKFLOW_NOT_FOUND).toBeDefined();
    expect(ErrorCode.SUB_WORKFLOW_TIMEOUT).toBeDefined();
    expect(ErrorCode.SUB_WORKFLOW_QUEUE_FAILED).toBeDefined();
  });
});

describe('buildErrorEnvelope', () => {
  it('omits details when not provided', () => {
    const env = buildErrorEnvelope(ErrorCode.HTTP_TIMEOUT, 'Timed out');
    expect(env).toEqual({ code: 'HTTP_TIMEOUT', message: 'Timed out' });
    expect('details' in env).toBe(false);
  });

  it('includes details when provided', () => {
    const env = buildErrorEnvelope(ErrorCode.HTTP_5XX, 'Bad Gateway', {
      statusCode: 502,
      url: 'https://api.example.com/x',
    });
    expect(env).toEqual({
      code: 'HTTP_5XX',
      message: 'Bad Gateway',
      details: { statusCode: 502, url: 'https://api.example.com/x' },
    });
  });

  it('preserves details object identity (no clone)', () => {
    const details = { requestId: 'r-1' };
    const env = buildErrorEnvelope(ErrorCode.LLM_CALL_FAILED, 'x', details);
    expect(env.details).toBe(details);
  });

  it('handles empty details object (still included)', () => {
    const env = buildErrorEnvelope(ErrorCode.DB_QUERY_FAILED, 'x', {});
    expect(env.details).toEqual({});
  });
});

describe('truncateForErrorDetails', () => {
  it('returns undefined for null/undefined', () => {
    expect(truncateForErrorDetails(null)).toBeUndefined();
    expect(truncateForErrorDetails(undefined)).toBeUndefined();
  });

  it('passes short strings through unchanged', () => {
    expect(truncateForErrorDetails('short')).toBe('short');
  });

  it('coerces non-strings via String() or JSON.stringify()', () => {
    expect(truncateForErrorDetails(42)).toBe('42');
    expect(truncateForErrorDetails(true)).toBe('true');
    expect(truncateForErrorDetails({ x: 1 })).toBe('{"x":1}');
  });

  it('truncates strings beyond the cap with a suffix', () => {
    const long = 'a'.repeat(600);
    const out = truncateForErrorDetails(long, 500) as string;
    expect(out.length).toBeLessThan(long.length);
    expect(out.endsWith('chars truncated)')).toBe(true);
  });

  it('respects a custom maxLen', () => {
    expect(truncateForErrorDetails('hello world', 5)).toBe(
      'hello…(+6 chars truncated)',
    );
  });
});

describe('maskEmailForErrorDetails', () => {
  it('keeps domain and masks local part except first char', () => {
    expect(maskEmailForErrorDetails('alice@example.com')).toBe(
      'a***@example.com',
    );
  });

  it('returns *** for invalid addresses', () => {
    expect(maskEmailForErrorDetails('no-at-sign')).toBe('***');
    expect(maskEmailForErrorDetails('@example.com')).toBe('***');
  });

  it('masks single-char local parts fully', () => {
    expect(maskEmailForErrorDetails('a@example.com')).toBe('***@example.com');
  });
});
