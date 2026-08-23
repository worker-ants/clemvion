import { deepRedactSecrets, MAX_REDACT_DEPTH } from './sanitize-error-message';
import { stripExternalOnlyFields } from './strip-external-only-fields';

/**
 * 공유 유틸 자신의 단위 테스트 — 자매 `sanitize-error-message.spec.ts` 관례.
 *
 * 승격 직후엔 회귀 보증이 **소비처 한 곳**(`websocket.service.spec.ts`)의 describe 블록에만
 * 얹혀 있었다 (`14_30_35` architecture/testing W4). 소비처 테스트는 "배선" 을 보고,
 * 유틸의 계약(참조 동일성·비변형·깊이 경계·`__proto__` 안전)은 여기서 직접 본다.
 */
describe('stripExternalOnlyFields', () => {
  const DEEP = 10;

  it('어느 깊이의 llmCalls 든 제거한다', () => {
    const v = {
      a: { b: { c: { llmCalls: [{ requestPayload: 'x' }], keep: 1 } } },
    };
    const out = stripExternalOnlyFields(v, DEEP);
    expect(JSON.stringify(out)).not.toContain('requestPayload');
    expect(out.a.b.c.keep).toBe(1);
  });

  it('입력을 변형하지 않는다 — 내부 WS wire 는 full payload 를 유지해야 한다', () => {
    const v = { nested: { llmCalls: ['secret'] } };
    const snapshot = JSON.stringify(v);
    stripExternalOnlyFields(v, DEEP);
    expect(JSON.stringify(v)).toBe(snapshot);
  });

  it('제거할 것이 없으면 입력을 그대로 돌려준다 (할당 없음)', () => {
    const inner = { b: 1 };
    const v = { a: inner, arr: [inner] };
    const out = stripExternalOnlyFields(v, DEEP);
    expect(out).toBe(v);
    expect(out.a).toBe(inner);
  });

  it('바뀐 가지만 새로 만들고 나머지는 참조를 보존한다', () => {
    const untouched = { keep: 1 };
    const v = { untouched, dirty: { llmCalls: ['x'], keep: 2 } };
    const out = stripExternalOnlyFields(v, DEEP);
    expect(out).not.toBe(v);
    expect(out.untouched).toBe(untouched); // 손 안 댄 서브트리는 동일 참조
    expect(out.dirty).not.toHaveProperty('llmCalls');
  });

  /** 다원소 배열의 **부분** clone-on-write — 직전 라운드부터 유예됐던 항목. */
  it('배열은 바뀐 원소만 교체하고 나머지 원소는 참조를 보존한다', () => {
    const clean1 = { a: 1 };
    const clean2 = { b: 2 };
    const v = { list: [clean1, { llmCalls: ['x'], c: 3 }, clean2] };
    const out = stripExternalOnlyFields(v, DEEP);
    expect(out.list[0]).toBe(clean1);
    expect(out.list[2]).toBe(clean2);
    expect(out.list[1]).not.toHaveProperty('llmCalls');
    expect((out.list[1] as { c: number }).c).toBe(3);
  });

  it('maxDepth 를 넘으면 그 아래는 손대지 않는다', () => {
    // depth 2 에 배치하고 상한을 1 로 준다 → 제거되지 않아야 한다.
    const v = { a: { b: { llmCalls: ['deep'] } } };
    expect(JSON.stringify(stripExternalOnlyFields(v, 1))).toContain('deep');
    expect(JSON.stringify(stripExternalOnlyFields(v, DEEP))).not.toContain(
      'deep',
    );
  });

  /**
   * `__proto__` 안전 — 방어는 스프레드(`{...obj}`)가 한다. 값 **안에** 제거 대상이 있어야
   * 대입 분기를 타므로 fixture 가 그렇게 생겨야 판별력이 있다.
   */
  it('__proto__ 키가 있어도 값 손실·프로토타입 오염이 없다', () => {
    const hostile = JSON.parse(
      '{"__proto__":{"polluted":true,"llmCalls":["x"]},"keep":"ok"}',
    ) as Record<string, unknown>;
    const out = stripExternalOnlyFields({ nested: hostile }, DEEP);
    const nested = out.nested as Record<string, unknown>;

    expect(nested.keep).toBe('ok');
    expect(Object.getPrototypeOf(nested)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(nested, '__proto__')).toBe(
      true,
    );
    const inner = Object.getOwnPropertyDescriptor(nested, '__proto__')
      ?.value as Record<string, unknown>;
    expect(inner).not.toHaveProperty('llmCalls');
    expect(inner.polluted).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('배열 안의 __proto__ 도 같은 방식으로 안전하다', () => {
    const hostile = JSON.parse(
      '{"__proto__":{"llmCalls":["x"],"m":1}}',
    ) as Record<string, unknown>;
    const out = stripExternalOnlyFields({ list: [hostile] }, DEEP);
    const item = (out.list as Record<string, unknown>[])[0];
    expect(Object.getPrototypeOf(item)).toBe(Object.prototype);
  });

  /**
   * `stripAndRedact`(`interaction.service.ts`)이 **strip 을 먼저** 돌리는 근거 —
   * 버릴 서브트리에 비싼 정규식을 선지불하지 않는다. 그 최적화는 **두 순서의 결과가
   * 같을 때만** 유효하므로 여기서 고정한다 (`14_30_35` performance W1).
   */
  it('deepRedactSecrets 와의 순서를 바꿔도 결과가 같다', () => {
    const v = {
      llmCalls: [{ requestPayload: { system: 'prompt' } }],
      creds: { api_key: 'super-secret', keep: 'ok' },
      nested: { llmCalls: ['x'], text: 'password=abc' },
    };
    const stripFirst = deepRedactSecrets(
      stripExternalOnlyFields(v, DEEP),
    ) as unknown;
    const redactFirst = stripExternalOnlyFields(
      deepRedactSecrets(v) as Record<string, unknown>,
      DEEP,
    ) as unknown;
    expect(stripFirst).toEqual(redactFirst);
    // 둘 다 실제로 목적을 달성했는지도 본다(양쪽이 똑같이 실패해도 toEqual 은 통과한다).
    expect(JSON.stringify(stripFirst)).not.toContain('prompt');
    // `deepRedactSecrets` 의 마스킹 토큰은 `***` 다(`[REDACTED]` 는 WS 쪽 sanitizer).
    // 처음엔 후자로 썼다가 이 단언이 잡았다 — 두 sanitizer 의 토큰이 다르다.
    expect(JSON.stringify(stripFirst)).toContain('***');
    expect(JSON.stringify(stripFirst)).not.toContain('super-secret');
  });

  /**
   * **REST 경로(strip 먼저) 깊이 경계 sweep** (`14_55_29` testing/security/architecture W1).
   *
   * WS 경로에는 `websocket.service.spec.ts` 에 같은 sweep 이 있는데 REST 에는 없었다.
   * 두 경로는 **순서가 반대**라(WS: redact→strip / REST: strip→redact) 한쪽 sweep 이
   * 다른 쪽을 대신하지 못한다 — 순서·경계연산자·상수가 바뀌면 조용히 회귀한다.
   *
   * 실제 파이프라인 순서 그대로(`stripAndRedact` 와 동일) 태워, 어느 깊이에서도 raw
   * 내용이 남지 않는지 본다. 깊이는 **상수 상대값**으로 — 리터럴로 박으면 상수가 바뀔 때
   * 테스트는 통과하면서 판별력만 잃는다.
   *
   * **판별력 실측** (strip 을 no-op 으로 만든 뮤턴트에서 관측):
   *
   * | depth | strip 없이도 통과? |
   * |---|---|
   * | `0` · `MAX-5` | **아니오 (RED)** — strip 이 실제로 지킨다 |
   * | `MAX-3` 이상 | 예 — `deepRedactSecrets` 가 먼저 `'***'` 로 collapse |
   *
   * WS sweep 은 `MAX-3` 까지 판별했는데 여기선 아니다 — 자매의 경계 연산자가 다르기
   * 때문이다(`deepRedactSecrets` 는 `>=`, `sanitizePayloadForWs` 는 `>`). **한쪽 sweep 이
   * 다른 쪽을 대신하지 못한다는 근거가 이 차이다.**
   */
  it.each([
    0,
    MAX_REDACT_DEPTH - 5,
    MAX_REDACT_DEPTH - 3,
    MAX_REDACT_DEPTH - 1,
    MAX_REDACT_DEPTH,
    MAX_REDACT_DEPTH + 1,
  ])(
    'REST 순서(strip→redact): depth %i 에서 raw 내용이 남지 않는다',
    (depth) => {
      const marker = `SECRET REST DEPTH ${depth}`;
      let node: Record<string, unknown> = {
        llmCalls: [{ requestPayload: { system: marker } }],
      };
      for (let i = 0; i < depth; i++) node = { nest: node };

      const out = deepRedactSecrets(
        stripExternalOnlyFields(node, MAX_REDACT_DEPTH),
      );
      expect(JSON.stringify(out)).not.toContain(marker);
    },
  );

  it('원시값·null 은 그대로 통과한다', () => {
    expect(stripExternalOnlyFields(null, DEEP)).toBeNull();
    expect(stripExternalOnlyFields(42, DEEP)).toBe(42);
    expect(stripExternalOnlyFields('llmCalls', DEEP)).toBe('llmCalls');
  });
});
