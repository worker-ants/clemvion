import {
  AI_CONVERSATION_INTERACTION_TYPE,
  AI_RESUMED_OUTPUT_STATUS,
  buildAiResumedSnapshot,
  buildConversationMetaFromResumeState,
  isAiResumedWaitingEnvelope,
} from './ai-conversation-helpers';

describe('buildAiResumedSnapshot', () => {
  const base = {
    fallbackConfig: { fromNodeConfig: true },
    receivedAt: '2026-11-12T00:00:00.000Z',
    resumeState: { turnCount: 1 },
  };
  const message = { type: 'message_received', content: '안녕' } as const;

  it.each([
    ['누락', undefined],
    ['객체', { a: 1 }],
    ['문자열', 'x'],
    ['null', null],
  ])(
    'previous.output.result.messages 가 배열이 아니면(%s) 사용자 메시지 하나로 시작한다',
    (_label, messages) => {
      const snapshot = buildAiResumedSnapshot({
        ...base,
        previous: { output: { result: { messages, turnCount: 3 } } },
        interaction: message,
      });
      expect(
        (snapshot.output as { result: Record<string, unknown> }).result,
      ).toEqual({
        messages: [{ role: 'user', content: '안녕' }],
        turnCount: 3,
      });
    },
  );

  it.each([
    ['배열', ['x']],
    ['문자열', 'x'],
    ['null', null],
  ])(
    'previous.meta · previous.config 가 객체가 아니면(%s) 무시하고 fallbackConfig 를 쓴다',
    (_label, bad) => {
      const snapshot = buildAiResumedSnapshot({
        ...base,
        previous: { meta: bad, config: bad } as never,
        interaction: message,
      });
      expect(snapshot.config).toEqual({ fromNodeConfig: true });
      expect(snapshot.meta).toEqual({
        interactionType: 'ai_conversation',
        durationMs: 0,
      });
    },
  );

  it('meta.contextInjection 이 없어도 그대로 만든다', () => {
    const snapshot = buildAiResumedSnapshot({
      ...base,
      previous: { meta: { model: 'gpt' } },
      interaction: message,
    });
    expect(snapshot.meta).toEqual({
      model: 'gpt',
      interactionType: 'ai_conversation',
      durationMs: 0,
    });
  });

  it('meta.contextInjection 은 빼고 durationMs 는 0 으로 둔다', () => {
    const snapshot = buildAiResumedSnapshot({
      ...base,
      previous: { meta: { contextInjection: { n: 1 }, durationMs: 900 } },
      interaction: message,
    });
    expect(snapshot.meta).toEqual({
      interactionType: 'ai_conversation',
      durationMs: 0,
    });
  });

  it('입력 객체(previous)를 바꾸지 않는다', () => {
    const previous = {
      config: { a: 1 },
      output: { result: { messages: [{ role: 'assistant', content: 'q' }] } },
      meta: { contextInjection: { n: 1 }, durationMs: 5 },
    };
    const frozen = JSON.parse(JSON.stringify(previous));
    buildAiResumedSnapshot({ ...base, previous, interaction: message });
    buildAiResumedSnapshot({
      ...base,
      previous,
      interaction: { type: 'form_submitted', data: { k: 'v' } },
    });
    expect(previous).toEqual(frozen);
  });

  it('폼 제출은 messages 를 그대로 두고 interaction 만 바꾼다', () => {
    const snapshot = buildAiResumedSnapshot({
      ...base,
      previous: {
        output: { result: { messages: [1] }, interaction: { x: 1 } },
      },
      interaction: { type: 'form_submitted', data: { k: 'v' } },
    });
    expect(snapshot.output).toEqual({
      result: { messages: [1] },
      interaction: {
        type: 'form_submitted',
        data: { k: 'v' },
        receivedAt: base.receivedAt,
      },
    });
    expect(snapshot.status).toBe(AI_RESUMED_OUTPUT_STATUS);
    expect(snapshot._resumeState).toBe(base.resumeState);
  });
});

describe('AI 재개 판정 계약 (생산자 ↔ 판정자)', () => {
  it('buildAiResumedSnapshot 결과는 isAiResumedWaitingEnvelope 로 대기다', () => {
    const snapshot = buildAiResumedSnapshot({
      previous: undefined,
      fallbackConfig: {},
      interaction: { type: 'form_submitted', data: {} },
      receivedAt: 'now',
      resumeState: {},
    });
    expect(isAiResumedWaitingEnvelope(snapshot)).toBe(true);
  });

  it('대기 메타 생산자의 interactionType 이 판정 상수와 같다', () => {
    expect(buildConversationMetaFromResumeState({}).interactionType).toBe(
      AI_CONVERSATION_INTERACTION_TYPE,
    );
  });

  it.each([
    [
      'form 의 resumed',
      { status: 'resumed', meta: { interactionType: 'form' } },
    ],
    ['interactionType 없음', { status: 'resumed', meta: {} }],
    ['meta null', { status: 'resumed', meta: null }],
    ['null 봉투', null],
    [
      'resumed 아님',
      { status: 'completed', meta: { interactionType: 'ai_conversation' } },
    ],
  ])('대기가 아니다: %s', (_label, envelope) => {
    expect(isAiResumedWaitingEnvelope(envelope)).toBe(false);
  });
});
