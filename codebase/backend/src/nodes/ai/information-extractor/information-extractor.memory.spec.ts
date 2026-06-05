/**
 * persistent 메모리 (recall + extraction) contract for information_extractor
 * (memory-strategy-extend-ie / memoryStrategy v2).
 *
 * SoT: spec/4-nodes/3-ai/3-information-extractor.md (persistent 절),
 *      spec/5-system/17-agent-memory.md (IE producer + consumer).
 *
 * 검증 축:
 *  - manual(기본) 무영향 회귀 — recall/extract 미호출, messages·결과 불변 (single+multi).
 *  - persistent recall 주입 — 회수 사실이 LLM system 컨텍스트에 들어감.
 *  - persistent extraction enqueue — scope key / turns / 모델 폴백 정확.
 *  - multi-turn 종결 thread push 동작 + waiting 시 미push.
 *  - workspace/scope 격리, recall/extract 실패 graceful (hot-path 비차단).
 */
import { InformationExtractorHandler } from './information-extractor.handler';
import { ConversationThreadService } from '../../../modules/execution-engine/conversation-thread/conversation-thread.service';
import { makeExecutionContext } from '../../../modules/execution-engine/__test__/make-execution-context';

type Mocked = Record<string, jest.Mock>;

function makeLlm(): Mocked {
  return {
    resolveConfig: jest.fn().mockResolvedValue({
      id: 'cfg',
      provider: 'openai',
      defaultModel: 'gpt-4o-mini',
    }),
    chat: jest.fn(),
    embed: jest.fn(),
  };
}

function makeMemory(): Mocked {
  return {
    resolveScopeKey: jest.fn(
      (memoryKey: string | undefined | null, executionId: string) =>
        memoryKey && memoryKey.trim() ? memoryKey.trim() : executionId,
    ),
    recall: jest.fn().mockResolvedValue([]),
    scheduleExtraction: jest.fn().mockResolvedValue(true),
  };
}

function singleTurnConfig(over: Record<string, unknown> = {}) {
  return {
    mode: 'single_turn',
    model: 'gpt-4o-mini',
    inputField: 'Alice alice@example.com',
    outputSchema: [
      { name: 'name', type: 'string', required: true },
      { name: 'email', type: 'string' },
    ],
    ...over,
  };
}

describe('InformationExtractor persistent memory — single-turn', () => {
  let llm: Mocked;
  let thread: ConversationThreadService;
  let memory: Mocked;
  let handler: InformationExtractorHandler;

  beforeEach(() => {
    llm = makeLlm();
    thread = new ConversationThreadService();
    memory = makeMemory();
    handler = new InformationExtractorHandler(
      llm as never,
      thread,
      memory as never,
    );
    llm.chat.mockResolvedValue({
      content: JSON.stringify({ name: 'Alice', email: 'alice@example.com' }),
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      model: 'gpt-4o-mini',
    });
  });

  it('manual (default): recall/extract never invoked, messages unchanged (regression)', async () => {
    const context = makeExecutionContext({
      nodeId: 'ie-1',
      variables: { __workspaceId: 'ws-1' },
    });
    await handler.execute({}, singleTurnConfig(), context);
    expect(memory.recall).not.toHaveBeenCalled();
    expect(memory.scheduleExtraction).not.toHaveBeenCalled();
    const sent = llm.chat.mock.calls[0][1].messages;
    expect(sent).toHaveLength(2); // system + user, no recall block
    expect(sent[0].content).not.toContain('[memory]');
    // F5: single-turn final push is strategy-independent (manual still pushes
    // the extracted snapshot as an ai_assistant turn — push=visibility 계약 핀).
    expect(thread.getThread(context).turns).toHaveLength(1);
  });

  it('persistent: single-turn extraction enqueue reject is graceful (out still returned)', async () => {
    // F4: scheduleExtraction reject 가 응답 hot-path 를 깨지 않아야 한다.
    memory.scheduleExtraction.mockRejectedValueOnce(new Error('queue down'));
    const context = makeExecutionContext({
      executionId: 'exec-f4',
      nodeId: 'ie-1',
      variables: { __workspaceId: 'ws-1' },
    });
    const result = (await handler.execute(
      {},
      singleTurnConfig({ memoryStrategy: 'persistent', memoryKey: 'k' }),
      context,
    )) as { port?: string };
    expect(result.port).toBe('out');
    expect(memory.scheduleExtraction).toHaveBeenCalledTimes(1);
  });

  it('persistent: recalls then injects recalled facts into the system prompt', async () => {
    memory.recall.mockResolvedValueOnce([
      { content: 'User prefers email contact', score: 0.9 },
    ]);
    const context = makeExecutionContext({
      executionId: 'exec-77',
      nodeId: 'ie-1',
      variables: { __workspaceId: 'ws-1' },
    });
    await handler.execute(
      {},
      singleTurnConfig({ memoryStrategy: 'persistent', memoryKey: 'user-42' }),
      context,
    );
    expect(memory.recall).toHaveBeenCalledTimes(1);
    // scope key from resolveScopeKey(memoryKey, executionId)
    expect(memory.recall.mock.calls[0][0]).toBe('ws-1'); // workspaceId
    expect(memory.recall.mock.calls[0][1]).toBe('user-42'); // scopeKey
    const sent = llm.chat.mock.calls[0][1].messages;
    expect(sent[0].role).toBe('system');
    expect(sent[0].content).toContain('User prefers email contact');
    expect(sent[0].content).toContain('[memory]');
  });

  it('persistent: extraction enqueued after push with scope key + turns + model fallback', async () => {
    const context = makeExecutionContext({
      executionId: 'exec-77',
      nodeId: 'ie-1',
      variables: { __workspaceId: 'ws-1' },
    });
    await handler.execute(
      {},
      singleTurnConfig({
        memoryStrategy: 'persistent',
        memoryKey: 'user-42',
        extractionModel: 'gpt-4o-mini-cheap',
        memoryTtlDays: 30,
      }),
      context,
    );
    expect(memory.scheduleExtraction).toHaveBeenCalledTimes(1);
    const arg = memory.scheduleExtraction.mock.calls[0][0];
    expect(arg.workspaceId).toBe('ws-1');
    expect(arg.scopeKey).toBe('user-42');
    expect(arg.extractionModel).toBe('gpt-4o-mini-cheap');
    expect(arg.ttlDays).toBe(30);
    // turns snapshot includes the pushed ai_assistant extraction turn.
    expect(arg.turns.length).toBeGreaterThanOrEqual(1);
    expect(
      arg.turns.some((t: { source: string }) => t.source === 'ai_assistant'),
    ).toBe(true);
  });

  it('persistent: empty memoryKey falls back to executionId scope (isolation)', async () => {
    const context = makeExecutionContext({
      executionId: 'exec-iso',
      nodeId: 'ie-1',
      variables: { __workspaceId: 'ws-1' },
    });
    await handler.execute(
      {},
      singleTurnConfig({ memoryStrategy: 'persistent' }),
      context,
    );
    expect(memory.recall.mock.calls[0][1]).toBe('exec-iso');
    expect(memory.scheduleExtraction.mock.calls[0][0].scopeKey).toBe(
      'exec-iso',
    );
  });

  it('persistent: recall failure is graceful (response still produced, no recall block)', async () => {
    memory.recall.mockRejectedValueOnce(new Error('db down'));
    const context = makeExecutionContext({
      nodeId: 'ie-1',
      variables: { __workspaceId: 'ws-1' },
    });
    const result = (await handler.execute(
      {},
      singleTurnConfig({ memoryStrategy: 'persistent' }),
      context,
    )) as { port?: string };
    expect(result.port).toBe('out');
    const sent = llm.chat.mock.calls[0][1].messages;
    expect(sent[0].content).not.toContain('[memory]');
  });

  it('persistent without service injected: degrades to no-op (legacy fixture)', async () => {
    const legacy = new InformationExtractorHandler(llm as never, thread);
    const context = makeExecutionContext({
      nodeId: 'ie-1',
      variables: { __workspaceId: 'ws-1' },
    });
    await expect(
      legacy.execute(
        {},
        singleTurnConfig({ memoryStrategy: 'persistent' }),
        context,
      ),
    ).resolves.toMatchObject({ port: 'out' });
  });
});

describe('InformationExtractor persistent memory — multi-turn', () => {
  let llm: Mocked;
  let thread: ConversationThreadService;
  let memory: Mocked;
  let handler: InformationExtractorHandler;

  beforeEach(() => {
    llm = makeLlm();
    thread = new ConversationThreadService();
    memory = makeMemory();
    handler = new InformationExtractorHandler(
      llm as never,
      thread,
      memory as never,
    );
  });

  function finalizeOnFirstTurn() {
    llm.chat.mockResolvedValue({
      content: '',
      toolCalls: [
        {
          id: 'tc1',
          name: 'finalize_extraction',
          arguments: JSON.stringify({ name: 'Bob' }),
        },
      ],
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      model: 'gpt-4o-mini',
    });
  }

  const mtConfig = (over: Record<string, unknown> = {}) => ({
    mode: 'multi_turn',
    model: 'gpt-4o-mini',
    inputField: 'Bob',
    outputSchema: [{ name: 'name', type: 'string', required: true }],
    ...over,
  });

  it('manual (default): final thread push happens (strategy-independent, C1) but recall/extract never invoked, no [memory] (regression)', async () => {
    finalizeOnFirstTurn();
    const context = makeExecutionContext({
      nodeId: 'ie-1',
      variables: { __workspaceId: 'ws-1' },
    });
    const result = (await handler.execute({}, mtConfig(), context)) as {
      port?: string;
    };
    expect(result.port).toBe('completed');
    // C1: multi-turn 종결 thread 등록은 **전략 무관** (spec §4.2 + conversation-thread
    // §2.3 — v2 limitation 해소; 등록=가시성 ↔ 추출=persistent 전용 별개). manual 에서도
    // thread ref 가 운반되므로 종결 push 가 일어난다.
    const turns = thread.getThread(context).turns;
    expect(turns).toHaveLength(1);
    expect(turns[0]).toMatchObject({
      source: 'ai_assistant',
      nodeType: 'information_extractor',
    });
    // 단 메모리 회수/추출(persistent 전용)은 manual 에서 절대 호출되지 않으며 LLM
    // system 컨텍스트에 recall 블록(`[memory]`)도 들어가지 않는다 (회귀 불변식).
    expect(memory.recall).not.toHaveBeenCalled();
    expect(memory.scheduleExtraction).not.toHaveBeenCalled();
    const sent = llm.chat.mock.calls[0][1].messages;
    expect(sent[0].content).not.toContain('[memory]');
  });

  it('persistent: recall injected at first entry + final thread push + extraction enqueued', async () => {
    finalizeOnFirstTurn();
    memory.recall.mockResolvedValueOnce([
      { content: 'prior fact about Bob', score: 0.8 },
    ]);
    const context = makeExecutionContext({
      executionId: 'exec-mt',
      nodeId: 'ie-1',
      variables: { __workspaceId: 'ws-1' },
    });
    const result = (await handler.execute(
      {},
      mtConfig({ memoryStrategy: 'persistent', memoryKey: 'bob-key' }),
      context,
    )) as { port?: string };
    expect(result.port).toBe('completed');
    // recall injected into first-entry system message
    const sent = llm.chat.mock.calls[0][1].messages;
    expect(sent[0].content).toContain('prior fact about Bob');
    // final thread push (v2 limitation resolved)
    const turns = thread.getThread(context).turns;
    expect(turns).toHaveLength(1);
    expect(turns[0]).toMatchObject({
      source: 'ai_assistant',
      nodeType: 'information_extractor',
    });
    // extraction enqueued at terminal path with the carried scope key
    expect(memory.scheduleExtraction).toHaveBeenCalledTimes(1);
    expect(memory.scheduleExtraction.mock.calls[0][0].scopeKey).toBe('bob-key');
  });

  it('persistent: scopeKey survives turn2+ (no A3-style state loss across resume)', async () => {
    // Turn 1: no finalize → waiting (followup question).
    llm.chat.mockResolvedValueOnce({
      content: 'What is your name?',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      model: 'gpt-4o-mini',
    });
    const context = makeExecutionContext({
      executionId: 'exec-mt2',
      nodeId: 'ie-1',
      variables: { __workspaceId: 'ws-1' },
    });
    const waiting = (await handler.execute(
      {},
      mtConfig({ memoryStrategy: 'persistent', memoryKey: 'persist-key' }),
      context,
    )) as { _resumeState?: Record<string, unknown> };
    expect(waiting._resumeState).toBeDefined();
    const state = waiting._resumeState as Record<string, unknown>;
    // carried memory state fields must survive into resume state.
    expect(state.memoryStrategy).toBe('persistent');
    expect(state.conversationThreadRef).toBeDefined();
    expect((state.memoryConfig as Record<string, unknown>).memoryKey).toBe(
      'persist-key',
    );
    expect(state.executionId).toBe('exec-mt2');
    // F6: nodeId 운반(종결 push NodeRef) + watermark 운반 슬롯 핀. IE 는 종결 1회
    // 추출 구조라 watermark 가 전진하지 않으므로 undefined 이거나(미전진) 숫자여야
    // 한다 — forward-looking 운반 invariant 만 보장한다.
    expect(state.nodeId).toBe('ie-1');
    expect(
      state.lastExtractionTurnSeq === undefined ||
        typeof state.lastExtractionTurnSeq === 'number',
    ).toBe(true);

    // Turn 2: finalize → completed. scope key must still resolve to persist-key.
    llm.chat.mockResolvedValueOnce({
      content: '',
      toolCalls: [
        {
          id: 'tc2',
          name: 'finalize_extraction',
          arguments: JSON.stringify({ name: 'Carol' }),
        },
      ],
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      model: 'gpt-4o-mini',
    });
    const final = (await handler.processMultiTurnMessage(
      'My name is Carol',
      state,
    )) as { port?: string };
    expect(final.port).toBe('completed');
    expect(memory.scheduleExtraction).toHaveBeenCalledTimes(1);
    expect(memory.scheduleExtraction.mock.calls[0][0].scopeKey).toBe(
      'persist-key',
    );
  });

  it('persistent: waiting state does NOT push to thread (push only at terminal)', async () => {
    llm.chat.mockResolvedValueOnce({
      content: 'What is your name?',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      model: 'gpt-4o-mini',
    });
    const context = makeExecutionContext({
      executionId: 'exec-wait',
      nodeId: 'ie-1',
      variables: { __workspaceId: 'ws-1' },
    });
    await handler.execute(
      {},
      mtConfig({ memoryStrategy: 'persistent', memoryKey: 'k' }),
      context,
    );
    // No push, no extraction while waiting.
    expect(thread.getThread(context).turns).toHaveLength(0);
    expect(memory.scheduleExtraction).not.toHaveBeenCalled();
  });
});
