import { toTerminalErrorPayload } from './terminal-error-payload';

/**
 * 종결 이벤트 `error` 의 wire 형태를 고정한다.
 *
 * 이 헬퍼가 존재하는 이유는 **부재 표현이 두 곳에서 다르기 때문**이다 —
 * DB(`Execution.error`)는 값이 없으면 **키를 생략**하는데, EIA §6.4 는 명시적 `null` 을
 * 요구한다. 그 변환을 emit 지점마다 손으로 하면 한 곳씩 빠진다(이 저장소의 반복 형태다).
 */
describe('toTerminalErrorPayload', () => {
  it('키를 생략한 DB 객체를 명시적 null 로 채운다 (§6.4 계약)', () => {
    expect(toTerminalErrorPayload({ message: 'boom' })).toEqual({
      code: null,
      message: 'boom',
      nodeId: null,
    });
  });

  it('있는 code 는 보존한다', () => {
    expect(
      toTerminalErrorPayload({
        code: 'WORKER_HEARTBEAT_TIMEOUT',
        message: 'crash',
      }),
    ).toEqual({
      code: 'WORKER_HEARTBEAT_TIMEOUT',
      message: 'crash',
      nodeId: null,
    });
  });

  it('details 는 있을 때만 싣는다 (§6.4 가 optional 로 선언)', () => {
    expect(toTerminalErrorPayload({ message: 'x', details: { a: 1 } })).toEqual(
      { code: null, message: 'x', nodeId: null, details: { a: 1 } },
    );
    expect(toTerminalErrorPayload({ message: 'x' })).not.toHaveProperty(
      'details',
    );
  });

  it('nodeId 가 있으면 보존한다', () => {
    expect(
      toTerminalErrorPayload({ message: 'x', nodeId: 'n1' }),
    ).toMatchObject({ nodeId: 'n1' });
  });

  // 레거시 방어 — 이 PR 이전에는 emit 이 문자열이었다. DB 에 문자열이 남아 있는 row 나
  // 아직 못 찾은 경로가 있어도 형태가 깨지지 않게 흡수한다.
  it('문자열을 받으면 message 로 승격한다', () => {
    expect(toTerminalErrorPayload('legacy string')).toEqual({
      code: null,
      message: 'legacy string',
      nodeId: null,
    });
  });

  // jsonb 컬럼이라 스칼라가 들어올 수 있다. 두 분기는 lint(`no-base-to-string`) 대응으로
  // 나뉘었는데, 나눈 뒤 테스트를 안 붙이면 어느 쪽이 실제로 도는지 알 수 없다.
  it.each([
    [42, '42'],
    [true, 'true'],
    // bigint 분기는 뮤테이션에서 조건을 지워도 GREEN 이었다 (`22_55_51` testing W9) —
    // 세 typeof 를 한 줄에 묶어 놓고 하나만 재고 있었다.
    [BigInt(9), '9'],
  ])('스칼라 %p 는 message 로 문자열화한다', (input, expected) => {
    expect(toTerminalErrorPayload(input)).toEqual({
      code: null,
      message: expected,
      nodeId: null,
    });
  });

  it('symbol 은 문자열화하지 않고 빈 message 로 둔다', () => {
    // JSON 컬럼에 존재할 수 없는 값이다. `String()` 을 걸면 lint 가 막는 형태가 되고
    // 수신자에게도 의미 없는 문자열이 간다.
    expect(toTerminalErrorPayload(Symbol('x'))).toEqual({
      code: null,
      message: '',
      nodeId: null,
    });
  });

  it('null/undefined 는 null 을 돌려준다 — 빈 객체가 아니다', () => {
    // `{}` 를 돌려주면 수신자가 "에러가 있는데 내용이 없다" 로 읽는다.
    expect(toTerminalErrorPayload(null)).toBeNull();
    expect(toTerminalErrorPayload(undefined)).toBeNull();
  });

  // `Execution.error` 는 `Record<string, unknown>` 이라 필드 타입이 보장되지 않는다.
  // 세 필드의 타입가드가 각각 실제로 도는지 고정한다 — 뮤테이션으로 확인해 보니
  // 아래 fixture 가 없을 때 `code` 가드를 지운 뮤턴트가 **생존했다**.
  it.each([
    ['code', { code: 123, message: 'x' }, 'code'],
    ['nodeId', { message: 'x', nodeId: 99 }, 'nodeId'],
  ])(
    '%s 가 문자열이 아니면 null 로 떨어뜨린다 (그 값을 그대로 싣지 않는다)',
    (_label, input, field) => {
      const out = toTerminalErrorPayload(input as never);
      expect(out?.[field as 'code' | 'nodeId']).toBeNull();
    },
  );

  it('message 가 문자열이 아니면 빈 문자열로 떨어뜨린다', () => {
    // wire 계약상 `message` 는 non-null string 이다. 숫자를 그대로 실으면 수신자의
    // 문자열 연산이 깨진다.
    expect(toTerminalErrorPayload({ message: 404 } as never)).toEqual({
      code: null,
      message: '',
      nodeId: null,
    });
  });

  it('입력을 변형하지 않는다', () => {
    const input = { message: 'x' };
    const out = toTerminalErrorPayload(input);
    expect(input).toEqual({ message: 'x' });
    expect(out).not.toBe(input);
  });

  it('message 가 없는 객체도 형태를 유지한다', () => {
    // DB 는 `Record<string, unknown>` 이라 message 부재가 타입으로 막히지 않는다.
    expect(toTerminalErrorPayload({ code: 'X' } as never)).toEqual({
      code: 'X',
      message: '',
      nodeId: null,
    });
  });
});

/**
 * **secret 마스킹** — 이 payload 는 WS 뿐 아니라 SSE 스트림과 EIA outbound webhook 으로
 * **외부 제3자**에게 나간다. `message` 는 임의 내부 예외 원문이고, WS 경로의
 * `sanitizePayloadForWs` 는 키 이름 기반이라 자유 텍스트 *안*의 토큰을 못 잡는다.
 *
 * 리뷰가 5라운드 연속 INFO 로 미룬 항목인데, 미룬 근거를 실측하니 갭이 실재했다.
 */
describe('toTerminalErrorPayload — secret 마스킹 (egress 초크포인트)', () => {
  it('message 안의 Bearer 토큰을 마스킹한다', () => {
    const out = toTerminalErrorPayload({
      message: 'upstream rejected: Bearer sk-live-abcdef123456',
    });
    expect(out?.message).not.toContain('sk-live-abcdef123456');
    expect(out?.message).toContain('upstream rejected');
  });

  it('레거시 문자열 입력에도 마스킹이 걸린다 (분기가 갈려도 빠지지 않는다)', () => {
    const out = toTerminalErrorPayload('auth failed: api-key=xyz789secret');
    expect(out?.message).not.toContain('xyz789secret');
  });

  it('details 의 중첩 값도 마스킹한다', () => {
    const out = toTerminalErrorPayload({
      message: 'boom',
      details: { upstream: { authorization: 'Bearer leak-me-999' } },
    });
    expect(JSON.stringify(out?.details)).not.toContain('leak-me-999');
  });

  it('code·nodeId 는 건드리지 않는다 (값 공간이 닫혀 있다)', () => {
    const nodeId = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
    const out = toTerminalErrorPayload({
      code: 'EXECUTION_TIME_LIMIT_EXCEEDED',
      message: 'boom',
      nodeId,
    });
    expect(out).toEqual({
      code: 'EXECUTION_TIME_LIMIT_EXCEEDED',
      message: 'boom',
      nodeId,
    });
  });

  it('평범한 메시지는 훼손하지 않는다 (오탐 대조)', () => {
    const message = 'Node "HTTP 요청" failed: connection reset by peer';
    expect(toTerminalErrorPayload({ message })?.message).toBe(message);
  });

  it('마스킹할 게 없으면 details 참조를 보존한다 (copy-on-change)', () => {
    const details = { safe: 'value' };
    const out = toTerminalErrorPayload({ message: 'boom', details });
    expect(out?.details).toBe(details);
  });

  it('입력이 없으면 여전히 null 이다 (빈 객체를 만들지 않는다)', () => {
    expect(toTerminalErrorPayload(null)).toBeNull();
    expect(toTerminalErrorPayload(undefined)).toBeNull();
  });

  it('details 가 없으면 키를 만들지 않는다 (§6.4 optional)', () => {
    const out = toTerminalErrorPayload({ message: 'boom' });
    expect(out && 'details' in out).toBe(false);
  });
});
