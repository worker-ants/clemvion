import { extractAiTurnErrorPayload } from './llm-error-payload';

// AI 에이전트 LLM 실패 분류의 단위 테스트(testing-W req W_json). 단일 턴(AiTurnExecutor)과
// 멀티턴 재개(AiTurnOrchestrator)가 이 함수를 함께 쓴다.
describe('extractAiTurnErrorPayload', () => {
  // CLE-NODE-OUTPUT Principle 3.2.1 — LLM 계열 노드는
  // details.retryable 필수. 본 PR (2026-05-23) 의 행동 변경.
  it('Error 인스턴스 + 명시 code 를 올바르게 추출한다 (details.retryable 보장)', () => {
    const err = Object.assign(new Error('LLM rate limited'), {
      code: 'LLM_RATE_LIMIT',
    });
    const result = extractAiTurnErrorPayload(err);
    expect(result.code).toBe('LLM_RATE_LIMIT');
    expect(result.message).toContain('LLM rate limited');
    // Principle 3.2.1 — LLM_RATE_LIMIT 은 retryable=true
    expect(result.details).toEqual({ retryable: true });
  });

  it('string throw 를 처리한다', () => {
    const result = extractAiTurnErrorPayload('something went wrong');
    // 분류 불가 fallback → LLM_CALL_FAILED non-retryable (CLE-NODE-AGENT 「에러 코드」 단일 taxonomy)
    expect(result.code).toBe('LLM_CALL_FAILED');
    expect(result.message).toBe('something went wrong');
  });

  it('null/undefined throw 를 처리한다', () => {
    expect(extractAiTurnErrorPayload(null).message).toBe('unknown error');
    expect(extractAiTurnErrorPayload(undefined).message).toBe('unknown error');
  });

  it('number/boolean/bigint throw 를 처리한다', () => {
    expect(extractAiTurnErrorPayload(429).message).toBe('429');
    expect(extractAiTurnErrorPayload(true).message).toBe('true');
  });

  it('message 에 429 포함 시 code=LLM_RATE_LIMIT fallback', () => {
    const err = new Error('API returned 429');
    const result = extractAiTurnErrorPayload(err);
    expect(result.code).toBe('LLM_RATE_LIMIT');
  });

  it('message 에 rate limit 포함 시 code=LLM_RATE_LIMIT fallback', () => {
    const err = new Error('Rate limit exceeded');
    const result = extractAiTurnErrorPayload(err);
    expect(result.code).toBe('LLM_RATE_LIMIT');
  });

  it('network/timeout 메시지 → LLM_CALL_FAILED + retryable=true (CLE-NODE-AGENT 「에러 코드」)', () => {
    const err = new Error('Connection timeout');
    const result = extractAiTurnErrorPayload(err);
    expect(result.code).toBe('LLM_CALL_FAILED');
    expect((result.details as Record<string, unknown>).retryable).toBe(true);
  });

  it('분류 불가 메시지 → LLM_CALL_FAILED + retryable=false', () => {
    const err = new Error('something unexpected happened');
    const result = extractAiTurnErrorPayload(err);
    // CLE-NODE-AGENT 「에러 코드」 — 별도 AI_* fallback 없이 LLM_CALL_FAILED non-retryable 로 통합
    expect(result.code).toBe('LLM_CALL_FAILED');
    expect((result.details as Record<string, unknown>).retryable).toBe(false);
  });

  it('details 필드를 포함한 오류를 처리한다 (retryable 자동 분류)', () => {
    const err = Object.assign(new Error('API error'), {
      code: 'LLM_API_ERROR',
      details: { retryAfter: 60, status: 429 },
    });
    const result = extractAiTurnErrorPayload(err);
    // CLE-NODE-AGENT 「에러 코드」 — 미등록 explicit code 는
    // status/network/429/auth 분기에 안 걸리면 classifyLlmError 가 그대로 보존
    // (passthrough, non-retryable). details.status=429 는 extractHttpStatus 가
    // 읽지 않으므로 LLM_RATE_LIMIT 으로 승격되지 않는다 (code 보존 + retryable=false).
    expect(result.code).toBe('LLM_API_ERROR');
    // 기존 details 필드 보존 + Principle 3.2.1 retryable 추가.
    // LLM_API_ERROR 는 429 · 5xx · network 분기에 안 걸려 retryable=false (보수적 default).
    expect(result.details).toEqual({
      retryAfter: 60,
      status: 429,
      retryable: false,
    });
  });

  it('미등록 explicit code 는 정규화 시 그대로 passthrough (CLE-NODE-AGENT 「에러 코드」 — 명시 code 보존·non-retryable)', () => {
    // status / network / 429 / auth 어느 분기에도 안 걸리는 임의 explicit code 는
    // classifyLlmError 의 explicitCode 보존 분기로 떨어진다. 미등록(에러 코드 표 밖) 이라도
    // 정규화 payload 에 code 가 그대로 실리고 retryable 은 보수적 false.
    const err = Object.assign(new Error('vendor quota exhausted'), {
      code: 'LLM_PROVIDER_QUOTA',
    });
    const result = extractAiTurnErrorPayload(err);
    expect(result.code).toBe('LLM_PROVIDER_QUOTA');
    expect((result.details as Record<string, unknown>).retryable).toBe(false);
  });

  it('details 에 secret 포함 시 sanitize 가 적용된다', () => {
    const err = Object.assign(new Error('OAuth error'), {
      details: { message: 'Bearer abc123token invalid' },
    });
    const result = extractAiTurnErrorPayload(err);
    expect(JSON.stringify(result.details)).not.toContain('abc123token');
    expect(JSON.stringify(result.details)).toContain('***');
  });

  it('details 가 순환참조 객체이면 직렬화 실패 시 fallback 문자열 반환 (req W_json)', () => {
    const circular: Record<string, unknown> = { name: 'circular' };
    circular['self'] = circular;
    const err = Object.assign(new Error('circular error'), {
      details: circular,
    });
    // JSON.stringify(circular) throws — should NOT throw out, must return safe value
    expect(() => extractAiTurnErrorPayload(err)).not.toThrow();
    const result = extractAiTurnErrorPayload(err);
    // Principle 3.2.1 갱신 후 — fallback `[serialization error]` 가
    // baseDetails 의 `details` 필드로 래핑되고 retryable 이 추가됨.
    expect(result.details).toMatchObject({
      details: '[serialization error]',
      retryable: false,
    });
  });

  it('비-Error 객체 throw 시 JSON.stringify 실패해도 throw 하지 않는다 (req W_json)', () => {
    const nonSerializable: Record<string, unknown> = {};
    nonSerializable['self'] = nonSerializable; // circular
    expect(() => extractAiTurnErrorPayload(nonSerializable)).not.toThrow();
    const result = extractAiTurnErrorPayload(nonSerializable);
    expect(result.message).toBe('[non-serializable error object]');
    expect(result.code).toBe('LLM_CALL_FAILED');
  });

  // CLE-NODE-OUTPUT Principle 3.2.1 — LLM 계열 retryable 분류
  describe('retryable 분류 (Principle 3.2.1)', () => {
    it('LLM_RATE_LIMIT → retryable=true', () => {
      const result = extractAiTurnErrorPayload(
        Object.assign(new Error('429'), { code: 'LLM_RATE_LIMIT' }),
      );
      expect((result.details as Record<string, unknown>).retryable).toBe(true);
    });

    it('분류 불가 fallback → LLM_CALL_FAILED + retryable=false (보수적 default)', () => {
      const result = extractAiTurnErrorPayload(new Error('unexpected error'));
      expect(result.code).toBe('LLM_CALL_FAILED');
      expect((result.details as Record<string, unknown>).retryable).toBe(false);
    });

    // CLE-NODE-AGENT 「에러 코드」 — HTTP status 기반 분류 (스펙이 SoT).
    // 멀티턴 경로는 raw SDK 에러(.status)를 받으므로 status 로 분류한다.
    describe('HTTP status 기반 분류 (에러 코드)', () => {
      const withStatus = (status: number, msg = 'provider error') =>
        Object.assign(new Error(msg), { status });

      it('status 429 → LLM_RATE_LIMIT + retryable=true', () => {
        const r = extractAiTurnErrorPayload(
          withStatus(429, 'too many requests'),
        );
        expect(r.code).toBe('LLM_RATE_LIMIT');
        expect((r.details as Record<string, unknown>).retryable).toBe(true);
      });

      it('status 500 → LLM_CALL_FAILED + retryable=true (5xx)', () => {
        const r = extractAiTurnErrorPayload(withStatus(500));
        expect(r.code).toBe('LLM_CALL_FAILED');
        expect((r.details as Record<string, unknown>).retryable).toBe(true);
      });

      it('status 503 → LLM_CALL_FAILED + retryable=true (5xx)', () => {
        const r = extractAiTurnErrorPayload(withStatus(503));
        expect(r.code).toBe('LLM_CALL_FAILED');
        expect((r.details as Record<string, unknown>).retryable).toBe(true);
      });

      it('status 401 → LLM_CALL_FAILED + retryable=false (auth)', () => {
        const r = extractAiTurnErrorPayload(withStatus(401, 'unauthorized'));
        expect(r.code).toBe('LLM_CALL_FAILED');
        expect((r.details as Record<string, unknown>).retryable).toBe(false);
      });

      it('status 403 → LLM_CALL_FAILED + retryable=false (auth)', () => {
        const r = extractAiTurnErrorPayload(withStatus(403, 'forbidden'));
        expect(r.code).toBe('LLM_CALL_FAILED');
        expect((r.details as Record<string, unknown>).retryable).toBe(false);
      });

      it('err.response.status 502 fallback → LLM_CALL_FAILED + retryable=true', () => {
        const r = extractAiTurnErrorPayload(
          Object.assign(new Error('bad gateway'), {
            response: { status: 502 },
          }),
        );
        expect(r.code).toBe('LLM_CALL_FAILED');
        expect((r.details as Record<string, unknown>).retryable).toBe(true);
      });

      it('errno ECONNRESET → LLM_CALL_FAILED + retryable=true (network)', () => {
        const r = extractAiTurnErrorPayload(
          Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }),
        );
        expect(r.code).toBe('LLM_CALL_FAILED');
        expect((r.details as Record<string, unknown>).retryable).toBe(true);
      });

      it('레거시/미분류 명시 코드(LLM_CONNECTION_ERROR) 입력 시 LLM_CALL_FAILED 로 정규화 + retryable=true', () => {
        const r = extractAiTurnErrorPayload(
          Object.assign(new Error('network down'), {
            code: 'LLM_CONNECTION_ERROR',
          }),
        );
        expect(r.code).toBe('LLM_CALL_FAILED');
        expect((r.details as Record<string, unknown>).retryable).toBe(true);
      });

      it('status 400 (bad request, 비-auth 4xx) → 비재시도 fallback', () => {
        const r = extractAiTurnErrorPayload(withStatus(400, 'bad request'));
        expect((r.details as Record<string, unknown>).retryable).toBe(false);
      });
    });

    it('LLM_RATE_LIMIT + Retry-After 헤더 → retryAfterSec 추출 (초 단위)', () => {
      const err = Object.assign(new Error('429'), {
        code: 'LLM_RATE_LIMIT',
        headers: { 'retry-after': '30' }, // 초 단위 RFC delta-seconds
      });
      const result = extractAiTurnErrorPayload(err);
      const details = result.details as Record<string, unknown>;
      expect(details.retryable).toBe(true);
      expect(details.retryAfterSec).toBe(30);
    });

    it('retryable=false 면 retryAfterSec 미동봉 (invariant)', () => {
      const err = Object.assign(new Error('parse fail'), {
        code: 'LLM_RESPONSE_INVALID',
        headers: { 'retry-after': '30' },
      });
      const result = extractAiTurnErrorPayload(err);
      const details = result.details as Record<string, unknown>;
      expect(details.retryable).toBe(false);
      expect(details.retryAfterSec).toBeUndefined();
    });
  });
});
