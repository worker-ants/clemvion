import {
  allowlistNodeOutputKeys,
  NODE_OUTPUT_ALLOWED_KEYS,
} from './node-output-allowlist';

/**
 * `nodeOutput` 최상위 키 allowlist — EIA §R17 잔여 항목의 fail-closed 전환.
 *
 * 자매 deny-list(`stripExternalOnlyFields`)와 **반대 방향**이라 따로 고정한다. 그쪽은
 * "아는 것만 뺀다"(새 키 통과), 이쪽은 "아는 것만 남긴다"(새 키 차단).
 */
describe('allowlistNodeOutputKeys', () => {
  it('[캐너리] 엔진 내부 `_retryState` 를 떨어뜨린다 — 지금 새고 있던 그 필드', () => {
    // `NodeExecution.outputData._retryState` 는 실재한다(`retry-turn.service.ts`).
    // deny-list 는 `llmCalls` 만 보므로 이게 그대로 외부로 나갔다.
    const out = allowlistNodeOutputKeys({
      config: { title: '주문 확인' },
      output: {},
      meta: { interactionType: 'form' },
      _retryState: { attempt: 2, expiresAt: '2026-08-24T00:00:00.000Z' },
    }) as Record<string, unknown>;
    expect(out._retryState).toBeUndefined();
    expect(Object.keys(out).sort()).toEqual(['config', 'meta', 'output']);
  });

  it('[캐너리] 자매 `_resumeState` 도 떨어뜨린다 — 지금은 저장 안 되지만 계약상 내부다', () => {
    const out = allowlistNodeOutputKeys({
      output: {},
      _resumeState: { messages: ['secret prompt'] },
    }) as Record<string, unknown>;
    expect(out._resumeState).toBeUndefined();
  });

  it('[캐너리] **미지의** 신규 키를 떨어뜨린다 — fail-closed 가 실제로 닫힌다', () => {
    const out = allowlistNodeOutputKeys({
      output: {},
      __somethingAHandlerAddsLater: 'leak',
    }) as Record<string, unknown>;
    expect(out.__somethingAHandlerAddsLater).toBeUndefined();
  });

  // 폼 위젯이 `nodeOutput.formConfig ?? nodeOutput` 로 **nodeOutput 자체**를 폼 선언으로
  // 쓰는데, 폼 핸들러는 `formConfig` 를 안 낸다(`{config, output, meta}` 만). 좁게 나열한
  // allowlist 였다면 여기서 렌더가 깨졌다 — 그래서 이 셋을 각각 못박는다.
  it.each([['config'], ['output'], ['meta']])(
    '[캐너리] 폼 폴백이 쓰는 `%s` 를 보존한다',
    (key) => {
      const input = { config: { fields: [] }, output: {}, meta: { a: 1 } };
      const out = allowlistNodeOutputKeys(input) as Record<string, unknown>;
      expect(out[key]).toBe(input[key as keyof typeof input]);
    },
  );

  // ⚠️ 아래 `it.each` 는 fixture 를 **구현 상수에서 파생**한다 — 목록이 줄면 케이스도 함께
  //    줄어 조용히 통과한다(뮤테이션으로 실증: `formConfig` 제거 → 91→90건, 전부 GREEN).
  //    그래서 **리터럴 대조**를 먼저 둔다. 컴파일타임 결속은 `NodeHandlerOutput` 공개 키만
  //    덮으므로 **wire 전용 키는 이 테스트가 유일한 방어**다.
  it('[리터럴] wire 전용 키가 목록에서 사라지면 여기서 잡힌다', () => {
    // 위젯 파서(`eia-events.ts`)와 chat-channel 렌더러가 top-level 로 읽는 키들 —
    // 빠지면 렌더가 조용히 빈다.
    for (const wireKey of [
      'formConfig',
      'conversationConfig',
      'buttonConfig',
      'interactionType',
      'payload',
      'title',
      'rendered',
      'nodeType',
    ]) {
      expect(NODE_OUTPUT_ALLOWED_KEYS as readonly string[]).toContain(wireKey);
    }
    // 전체 집합도 못박는다 — 늘어나는 것도 의식적 결정이어야 한다.
    expect([...NODE_OUTPUT_ALLOWED_KEYS].sort()).toEqual([
      'buttonConfig',
      'config',
      'conversationConfig',
      'formConfig',
      'interactionType',
      'meta',
      'nodeType',
      'output',
      'payload',
      'port',
      'rendered',
      'status',
      'title',
    ]);
  });

  it.each([...NODE_OUTPUT_ALLOWED_KEYS])('허용 키 `%s` 는 통과한다', (key) => {
    const out = allowlistNodeOutputKeys({ [key]: 'keep-me' }) as Record<
      string,
      unknown
    >;
    expect(out[key]).toBe('keep-me');
  });

  it('[캐너리] 목록이 런타임에도 불변이다 — 보안 경계 주장의 실측', () => {
    // 리뷰어가 `Object.freeze` 를 빼는 뮤턴트로 **아무도 안 잡는다**는 걸 실증했다
    // (`19_43_33` testing INFO 2). `as const` 는 컴파일타임 타입만 준다.
    expect(Object.isFrozen(NODE_OUTPUT_ALLOWED_KEYS)).toBe(true);
  });

  it('떨어뜨릴 것이 없으면 **같은 참조**를 돌려준다 (copy-on-change)', () => {
    const input = { config: {}, output: {} };
    expect(allowlistNodeOutputKeys(input)).toBe(input);
  });

  it('원본을 변이시키지 않는다', () => {
    const input = { output: {}, _retryState: { a: 1 } };
    allowlistNodeOutputKeys(input);
    expect(input._retryState).toEqual({ a: 1 });
  });

  it('[캐너리] `__proto__` 로 프로토타입을 오염시키지 않는다 (자매 스위트 관례)', () => {
    // allowlist 밖이라 fail-closed 로 자동 차단되지만, 구현이 바뀌어도 조용히 안 뚫리게
    // 못박는다 — 자매 `stripExternalOnlyFields` 가 같은 형태의 케이스를 갖는다.
    const out = allowlistNodeOutputKeys(
      JSON.parse('{"output":{},"__proto__":{"polluted":true}}') as Record<
        string,
        unknown
      >,
    );
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('객체가 아니면 그대로 통과한다 — 억지로 `{}` 로 만들면 렌더가 조용히 빈다', () => {
    expect(allowlistNodeOutputKeys(null)).toBeNull();
    expect(allowlistNodeOutputKeys(42)).toBe(42);
    const arr = [1, 2];
    expect(allowlistNodeOutputKeys(arr)).toBe(arr);
  });

  it('**최상위만** 거른다 — 깊은 곳은 렌더 payload(작성자 데이터)다', () => {
    const out = allowlistNodeOutputKeys({
      config: { fields: [{ name: 'x', __anything: 'kept' }] },
    }) as { config: { fields: Array<Record<string, unknown>> } };
    expect(out.config.fields[0].__anything).toBe('kept');
  });
});
