import {
  CONVERSATION_END_REASONS,
  type ConversationEndReason,
} from '../index';

/**
 * 이 패키지의 1차 방어는 **컴파일 타임**이다 — `satisfies`(배열 ⊆ 유니온) +
 * `Exclude`(유니온 ⊆ 배열) 가 어느 노드 유니온에 값이 추가되면 빌드를 깨뜨린다.
 *
 * 아래 테스트는 그 타입 장치가 **잡지 못하는 것**만 다룬다. 타입으로 이미
 * 강제되는 것을 런타임에서 또 확인하는 건 중복이라 두지 않는다.
 */
describe('CONVERSATION_END_REASONS', () => {
  // `['a','a','b'] as const satisfies readonly T[]` 는 통과하고 Exclude 도
  // 통과한다 (실측). 즉 **중복은 타입이 못 잡는다** — 소비 측이 Set 으로 감싸
  // 실害는 없지만, 중복이 생겼다는 건 목록 편집이 꼬였다는 신호다.
  it('중복이 없다 — 타입 장치가 못 잡는 축', () => {
    expect(new Set(CONVERSATION_END_REASONS).size).toBe(
      CONVERSATION_END_REASONS.length,
    );
  });

  // 배열이 비면 `Exclude` 는 유니온 전체를 Missing 으로 보고 컴파일을 깨뜨리지만,
  // 유니온까지 함께 지워지면 조용히 빈 배열이 된다 — 그 경우 소비 측
  // (`isConversationOutput`) 이 **모든 대화를 미인식**해 미리보기가 전부 사라진다.
  it('비어있지 않다', () => {
    expect(CONVERSATION_END_REASONS.length).toBeGreaterThan(0);
  });

  // 두 노드 유니온이 실제로 기여하는지 — 한쪽 유니온이 통째로 사라져도
  // `Exclude`/`satisfies` 는 통과한다 (파생 유니온이 좁아질 뿐이라 배열의
  // 초과분만 satisfies 에 걸린다). 각 노드의 대표 값을 고정해 그 붕괴를 잡는다.
  it('AI Agent · Information Extractor 양쪽 도메인을 모두 담는다', () => {
    // AI Agent 전용 — IE 유니온에는 없다
    expect(CONVERSATION_END_REASONS).toContain('condition');
    // IE 전용 — AI Agent 유니온에는 없다
    expect(CONVERSATION_END_REASONS).toContain('completed');
    expect(CONVERSATION_END_REASONS).toContain('max_retries');
    // 공통
    expect(CONVERSATION_END_REASONS).toContain('error');
    expect(CONVERSATION_END_REASONS).toContain('user_ended');
    expect(CONVERSATION_END_REASONS).toContain('max_turns');
  });

  // `'out'`(단일턴 종결) 은 두 노드 유니온 어디에도 없으므로 파생 유니온에
  // 들어오면 안 된다. 단일턴 출력에는 `result.messages` 가 없어 대화 판정
  // 대상이 아니고, 여기 섞이면 그 경계가 흐려진다.
  it("단일턴 종결 'out' 을 포함하지 않는다", () => {
    expect(CONVERSATION_END_REASONS as readonly string[]).not.toContain('out');
  });

  it('모든 값이 ConversationEndReason 으로 좁혀진다', () => {
    for (const reason of CONVERSATION_END_REASONS) {
      const narrowed: ConversationEndReason = reason;
      expect(typeof narrowed).toBe('string');
    }
  });
});
