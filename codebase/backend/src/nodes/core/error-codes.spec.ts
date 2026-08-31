import {
  EngineErrorCode,
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

  // PR4b regression guard: retired LLM_CONFIG_* codes must not re-appear.
  // spec/conventions/error-codes.md §4 declares these as "완전 제거(코드베이스에서 완전 제거)".
  it('does not contain retired LLM_CONFIG_INVALID or LLM_CONFIG_NOT_FOUND codes (PR4b §4 regression guard)', () => {
    const keys = Object.keys(ErrorCode);
    expect(keys).not.toContain('LLM_CONFIG_INVALID');
    expect(keys).not.toContain('LLM_CONFIG_NOT_FOUND');
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
    // Sub-workflow failure-mode subdivision: missing target / timeout /
    // queue enqueue failure are mapped from executor messages so workflow
    // authors can branch on cause.
    expect(ErrorCode.SUB_WORKFLOW_NOT_FOUND).toBeDefined();
    expect(ErrorCode.SUB_WORKFLOW_TIMEOUT).toBeDefined();
    expect(ErrorCode.SUB_WORKFLOW_QUEUE_FAILED).toBeDefined();
  });
});

describe('EngineErrorCode enum', () => {
  it('maps every key to its own name (UPPER_SNAKE_CASE)', () => {
    // 형제 `ErrorCode` 와 같은 형식 계약. 신설 const 만 이 검사를 안 받고 있었다.
    for (const [key, value] of Object.entries(EngineErrorCode)) {
      expect(value).toBe(key);
      expect(key).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });

  it('shares no code with ErrorCode — 두 네임스페이스가 겹치면 SoT 가 둘이 된다', () => {
    // 파일은 하나지만 const 는 둘이라는 설계의 **전제**가 이것이다. 같은 코드가 양쪽에
    // 있으면 "레이어를 타입으로 가른다" 는 주장이 무너지고, 앵커 가드도 그 값을 어느 쪽
    // 근거로 통과시킨 것인지 말할 수 없게 된다.
    const overlap = Object.keys(EngineErrorCode).filter((k) => k in ErrorCode);
    expect(overlap).toEqual([]);
  });

  it('is non-empty — 위 두 단언이 공허해지지 않도록', () => {
    expect(Object.keys(EngineErrorCode).length).toBeGreaterThan(0);
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
