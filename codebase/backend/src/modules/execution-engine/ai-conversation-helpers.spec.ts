import {
  AI_CONVERSATION_INTERACTION_TYPE,
  AI_RESUMED_OUTPUT_STATUS,
  buildAiResumedSnapshot,
  buildConversationMetaFromResumeState,
  isAiResumedWaitingEnvelope,
  readCrashedAiTurn,
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

describe('readCrashedAiTurn — 크래시 재구동이 처리 중이던 턴을 다시 돌릴 재료', () => {
  const checkpoint = { schemaVersion: 1, turnCount: 1, messages: [] };
  const waiting = {
    config: { model: 'm' },
    output: {
      result: {
        messages: [
          { role: 'user', content: 'turn-one' },
          { role: 'assistant', content: 'reply-one' },
        ],
        turnCount: 1,
      },
    },
    meta: { interactionType: AI_CONVERSATION_INTERACTION_TYPE, turnCount: 1 },
    status: 'waiting_for_input',
    _resumeCheckpoint: checkpoint,
  };
  const persisted = (
    interaction:
      | { type: 'message_received'; content: string }
      | { type: 'form_submitted'; data: Record<string, unknown> },
  ): Record<string, unknown> => {
    // 저장소에 남는 재개 스냅샷과 같은 모양: `_resumeState` 는 빼고 체크포인트를 싣는다.
    const { _resumeState: _drop, ...rest } = buildAiResumedSnapshot({
      previous: waiting,
      fallbackConfig: {},
      interaction,
      receivedAt: '2026-11-19T00:00:00.000Z',
      resumeState: { turnCount: 1 },
    }) as unknown as Record<string, unknown>;
    void _drop;
    return { ...rest, _resumeCheckpoint: checkpoint };
  };

  it('메시지 턴: 입력을 돌려주고 턴 이전 대기 봉투를 되살린다', () => {
    const turn = readCrashedAiTurn(
      persisted({ type: 'message_received', content: 'turn-two' }),
    );
    expect(turn?.interaction).toEqual({
      type: 'message_received',
      content: 'turn-two',
    });
    // 스냅샷이 끝에 더한 사용자 메시지를 걷어 내야 재생 턴이 같은 메시지를 두 번 싣지 않는다.
    expect(turn?.waitingEnvelope).toEqual({
      ...waiting,
      meta: { ...waiting.meta, durationMs: 0 },
    });
    expect(isAiResumedWaitingEnvelope(turn?.waitingEnvelope)).toBe(false);
  });

  it('폼 제출 턴: 폼 값을 돌려주고 messages 는 그대로 둔다', () => {
    const turn = readCrashedAiTurn(
      persisted({ type: 'form_submitted', data: { email: 'a@b.c' } }),
    );
    expect(turn?.interaction).toEqual({
      type: 'form_submitted',
      data: { email: 'a@b.c' },
    });
    expect(
      (turn?.waitingEnvelope.output as { result: { messages: unknown[] } })
        .result.messages,
    ).toHaveLength(2);
    expect(turn?.waitingEnvelope.output).not.toHaveProperty('interaction');
    expect(turn?.waitingEnvelope._resumeCheckpoint).toBe(checkpoint);
  });

  it('스냅샷 끝 메시지가 입력과 다르면 messages 를 건드리지 않는다', () => {
    const snap = persisted({ type: 'message_received', content: 'turn-two' });
    const output = snap.output as {
      interaction: { data: { content: string } };
    };
    output.interaction.data.content = 'other';
    const turn = readCrashedAiTurn(snap);
    expect(
      (turn?.waitingEnvelope.output as { result: { messages: unknown[] } })
        .result.messages,
    ).toHaveLength(3);
  });

  it.each([
    ['재개 스냅샷 아님', { ...waiting }],
    ['null', null],
    [
      'interaction 없음',
      { ...persisted({ type: 'message_received', content: 'x' }), output: {} },
    ],
    [
      'content 가 문자열 아님',
      {
        ...persisted({ type: 'message_received', content: 'x' }),
        output: {
          interaction: { type: 'message_received', data: { content: 1 } },
        },
      },
    ],
    [
      '폼 data 가 객체 아님',
      {
        ...persisted({ type: 'form_submitted', data: {} }),
        output: { interaction: { type: 'form_submitted', data: 'x' } },
      },
    ],
    [
      '모르는 interaction',
      {
        ...persisted({ type: 'message_received', content: 'x' }),
        output: { interaction: { type: 'button_click', data: {} } },
      },
    ],
  ])('재료가 없으면 null: %s', (_label, outputData) => {
    expect(readCrashedAiTurn(outputData)).toBeNull();
  });
});
