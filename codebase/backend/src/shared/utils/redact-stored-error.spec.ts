import { redactStoredErrorForResponse } from './redact-stored-error';

/**
 * DB `Execution.error` 컬럼 값의 **응답 egress 마스킹**을 고정한다.
 *
 * 이 함수가 존재하는 이유는 #1177 이 **종결 emit 경로만** 마스킹했기 때문이다 — 같은
 * 컬럼을 읽기 경로(내부 REST 4표면 · WS `execution.snapshot`)는 원문으로 내보내고 있었다.
 */
describe('redactStoredErrorForResponse', () => {
  it('message 안에 박힌 자격증명 URI 를 마스킹한다', () => {
    expect(
      redactStoredErrorForResponse({
        message: 'connect failed: postgres://u:pw@db.internal/prod',
      }),
    ).toEqual({ message: 'connect failed: postgres://***@db.internal/prod' });
  });

  it('message 안의 Bearer 토큰을 마스킹한다', () => {
    expect(
      redactStoredErrorForResponse({
        code: 'HTTP_ERROR',
        message: 'auth failed: Bearer sk-live-abc123def456',
      }),
    ).toEqual({ code: 'HTTP_ERROR', message: 'auth failed: ***' });
  });

  it('details 안 중첩 credential 키까지 내려간다', () => {
    expect(
      redactStoredErrorForResponse({
        message: 'x',
        details: { headers: { authorization: 'Bearer zzz' }, api_key: 'k-1' },
      }),
    ).toEqual({
      message: 'x',
      details: { headers: { authorization: '***' }, api_key: '***' },
    });
  });

  it('null·undefined 는 null 로 정규화한다', () => {
    expect(redactStoredErrorForResponse(null)).toBeNull();
    expect(redactStoredErrorForResponse(undefined)).toBeNull();
  });

  it('입력 객체를 변이하지 않는다 (복사본을 돌려준다)', () => {
    const input = { message: 'Bearer sk-live-xyz' };
    const out = redactStoredErrorForResponse(input);
    expect(input.message).toBe('Bearer sk-live-xyz');
    expect(out).not.toBe(input);
  });

  /**
   * **JSDoc 이 약속한 레거시 형태를 고정한다** (`17_12_34` testing W1).
   *
   * 함수 JSDoc 은 *"jsonb 라 레거시 문자열·숫자가 들어와도 `deepRedactSecrets` 가 타입을
   * 보존하며 통과시킨다"* 고 명시한다. 그런데 TS 시그니처는 객체만 받는 것처럼 선언돼
   * 있고 반환은 무조건 캐스트라, **그 약속을 검증하는 것이 아무것도 없었다** — 이
   * 저장소의 *"문서한 보장이 구현보다 넓다"* 형태다. 런타임 형태를 캐스트로 주입해 고정한다.
   */
  it('[레거시] 문자열 error 도 마스킹하며 문자열로 통과시킨다', () => {
    const out = redactStoredErrorForResponse(
      'auth failed: Bearer sk-live-abc123def456' as unknown as Record<
        string,
        unknown
      >,
    );
    expect(out).toBe('auth failed: ***');
  });

  it('[레거시] 숫자 error 는 타입을 보존해 그대로 통과시킨다', () => {
    const out = redactStoredErrorForResponse(
      42 as unknown as Record<string, unknown>,
    );
    expect(out).toBe(42);
  });

  /**
   * **보장의 경계를 테스트로 고정한다.** 이 함수는 `deepRedactSecrets` 위임이고 그
   * `SECRET_LEAK_PATTERNS` 는 **자격증명**을 겨냥한다 — 아래 두 입력은 통과가 **정답**이다.
   *
   * 캐너리로 두는 이유: 누군가 패턴을 넓히면 여기가 RED 로 바뀌어 *"blast radius 가
   * `deepRedactSecrets` 의 다른 소비자 전부"* 라는 사실을 그 시점에 강제로 마주하게 된다
   * (트래커에 별건으로 등재된 결정이다). 조용히 넓어지는 것을 막는 것이 목적이다.
   */
  it('[캐너리] 자격증명 없는 연결 문자열은 통과한다 — 의도된 잔여 갭', () => {
    expect(
      redactStoredErrorForResponse({
        message: 'postgres://db.internal:5432/prod',
      }),
    ).toEqual({ message: 'postgres://db.internal:5432/prod' });
  });

  it('[캐너리] 평범한 에러 메시지는 손상하지 않는다 — 진단 정밀도의 비용 상한', () => {
    expect(
      redactStoredErrorForResponse({
        code: 'NODE_FAILED',
        message: 'Node "Send Email" failed',
      }),
    ).toEqual({ code: 'NODE_FAILED', message: 'Node "Send Email" failed' });
  });
});
