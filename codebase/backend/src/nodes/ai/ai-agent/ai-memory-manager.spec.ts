import { AiMemoryManager } from './ai-memory-manager';
import type { ChatMessage } from '../../../modules/llm/interfaces/llm-client.interface';

/**
 * AiMemoryManager unit — refactor 02-architecture §M-1 2단계로 핸들러에서 분리한
 * 자동 메모리 전략 관리 로직(이전엔 ai-agent.handler 의 private 메서드로
 * ai-agent.memory.spec 을 통해 간접 테스트만 존재)을 입출력 단위로 직접 고정한다.
 * behavior-preserving 추출의 회귀 격리용 (#665 `AiConditionEvaluator` 선례 동형).
 *
 * 매니저는 무상태 collaborator 이고 외부 의존(llm/thread/agent-memory 서비스)을
 * 생성자로 받으므로, 각 서비스의 매니저가 실제로 건드리는 작은 표면만 부분 fake
 * 로 주입한다 (ai-agent.handler 테스트와 동일 패턴).
 */
type InjectArgs = Parameters<AiMemoryManager['injectMemoryContext']>[0];
type SchedArgs = Parameters<AiMemoryManager['scheduleMemoryExtraction']>[0];
type Ctor = ConstructorParameters<typeof AiMemoryManager>;

interface FakeTurn {
  seq: number;
  source: string;
  text: string;
  nodeLabel: string;
}

const llmFake = () => ({ resolveConfig: jest.fn() }) as unknown as Ctor[0];

const threadFake = (turns: FakeTurn[] = [], fullTurns?: FakeTurn[]) =>
  ({
    getThreadExcludingNode: jest.fn().mockReturnValue(turns),
    getThread: jest.fn().mockReturnValue({ turns: fullTurns ?? turns }),
  }) as unknown as Ctor[1];

const agentMemFake = (overrides: Record<string, unknown> = {}) =>
  ({
    resolveScopeKey: jest.fn(
      (key: string | null | undefined, execId: string) =>
        key ?? `exec:${execId}`,
    ),
    recall: jest.fn().mockResolvedValue([]),
    scheduleExtraction: jest.fn().mockResolvedValue(true),
    ...overrides,
  }) as unknown as Ctor[2];

const baseInject = (over: Partial<InjectArgs> = {}): InjectArgs =>
  ({
    strategy: 'summary_buffer',
    target: undefined,
    selfNodeId: 'node-1',
    config: {},
    messages: [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hi' },
    ] as ChatMessage[],
    finalSystemPrompt: 'sys',
    llmConfig: { defaultModel: 'm' } as InjectArgs['llmConfig'],
    model: 'm',
    workspaceId: 'ws-1',
    executionId: 'exec-1',
    queryText: 'hello',
    tailMode: 'prepend',
    ...over,
  }) as InjectArgs;

const baseSched = (over: Partial<SchedArgs> = {}): SchedArgs => ({
  strategy: 'persistent',
  target: { conversationThread: { turns: [] } } as SchedArgs['target'],
  selfNodeId: 'node-1',
  config: {},
  workspaceId: 'ws-1',
  executionId: 'exec-1',
  ...over,
});

describe('AiMemoryManager', () => {
  describe('resolveMemoryStrategy', () => {
    const mgr = new AiMemoryManager(llmFake());

    it('명시된 전략 값을 그대로 반환한다', () => {
      expect(mgr.resolveMemoryStrategy({ memoryStrategy: 'manual' })).toBe(
        'manual',
      );
      expect(
        mgr.resolveMemoryStrategy({ memoryStrategy: 'summary_buffer' }),
      ).toBe('summary_buffer');
      expect(mgr.resolveMemoryStrategy({ memoryStrategy: 'persistent' })).toBe(
        'persistent',
      );
    });

    it('미지 문자열은 manual 로 폴백한다 (하위호환)', () => {
      expect(mgr.resolveMemoryStrategy({ memoryStrategy: 'auto' })).toBe(
        'manual',
      );
    });

    it('memoryStrategy 키 부재 시 manual 로 폴백한다 (기존 워크플로 무변경)', () => {
      expect(mgr.resolveMemoryStrategy({})).toBe('manual');
      expect(mgr.resolveMemoryStrategy({ memoryStrategy: undefined })).toBe(
        'manual',
      );
    });
  });

  describe('scheduleMemoryExtraction', () => {
    it('manual 전략은 enqueue 하지 않고 watermark 를 그대로 반환한다', async () => {
      const agentMem = agentMemFake();
      const mgr = new AiMemoryManager(llmFake(), threadFake(), agentMem);
      const result = await mgr.scheduleMemoryExtraction(
        baseSched({ strategy: 'manual', lastExtractionTurnSeq: 5 }),
      );
      expect(result).toBe(5);
      expect(
        (agentMem as unknown as { scheduleExtraction: jest.Mock })
          .scheduleExtraction,
      ).not.toHaveBeenCalled();
    });

    it('summary_buffer 전략도 enqueue 하지 않는다 (세션 간 추출 미적용)', async () => {
      const agentMem = agentMemFake();
      const mgr = new AiMemoryManager(llmFake(), threadFake(), agentMem);
      const result = await mgr.scheduleMemoryExtraction(
        baseSched({ strategy: 'summary_buffer' }),
      );
      expect(result).toBeUndefined();
      expect(
        (agentMem as unknown as { scheduleExtraction: jest.Mock })
          .scheduleExtraction,
      ).not.toHaveBeenCalled();
    });

    it('agentMemoryService 미주입 시 graceful no-op (watermark 유지, throw 없음)', async () => {
      const mgr = new AiMemoryManager(llmFake(), threadFake(), undefined);
      await expect(
        mgr.scheduleMemoryExtraction(
          baseSched({ strategy: 'persistent', lastExtractionTurnSeq: 7 }),
        ),
      ).resolves.toBe(7);
    });

    it('persistent + 신규 turn + enqueue 수락 시 최대 seq 로 watermark 전진', async () => {
      const turns: FakeTurn[] = [
        { seq: 3, source: 'ai_assistant', text: 'x', nodeLabel: 'n' },
        { seq: 4, source: 'ai_user', text: 'y', nodeLabel: 'n' },
      ];
      const agentMem = agentMemFake({
        scheduleExtraction: jest.fn().mockResolvedValue(true),
      });
      const mgr = new AiMemoryManager(
        llmFake(),
        threadFake([], turns),
        agentMem,
      );
      const result = await mgr.scheduleMemoryExtraction(
        baseSched({ strategy: 'persistent', lastExtractionTurnSeq: undefined }),
      );
      expect(result).toBe(4);
      expect(
        (agentMem as unknown as { scheduleExtraction: jest.Mock })
          .scheduleExtraction,
      ).toHaveBeenCalledTimes(1);
    });

    it('enqueue 가 dedup drop(false) 되면 watermark 를 전진시키지 않는다 (AGM-08)', async () => {
      const turns: FakeTurn[] = [
        { seq: 9, source: 'ai_user', text: 'z', nodeLabel: 'n' },
      ];
      const agentMem = agentMemFake({
        scheduleExtraction: jest.fn().mockResolvedValue(false),
      });
      const mgr = new AiMemoryManager(
        llmFake(),
        threadFake([], turns),
        agentMem,
      );
      const result = await mgr.scheduleMemoryExtraction(
        baseSched({ strategy: 'persistent', lastExtractionTurnSeq: 2 }),
      );
      expect(result).toBe(2);
    });
  });

  describe('injectMemoryContext', () => {
    it('서비스 미주입 시 graceful — memory 메타 shape 보존, recall 0, 압축 0', async () => {
      const mgr = new AiMemoryManager(llmFake(), undefined, undefined);
      const res = await mgr.injectMemoryContext(
        baseInject({ strategy: 'summary_buffer' }),
      );
      expect(res.memory).toEqual({
        strategy: 'summary_buffer',
        summarized: false,
        recalledCount: 0,
        tokenBudgetUsed: expect.any(Number),
      });
      expect(res.keepUserExchanges).toBe(0);
      expect(res.finalSystemPrompt).toContain('sys');
      // 휘발성 꼬리 없음 → 원본 messages(system + user) 보존.
      expect(res.messages).toHaveLength(2);
    });

    it('persistent 회수 실패 시 graceful degrade (recalledCount 0, throw 없음)', async () => {
      const agentMem = agentMemFake({
        recall: jest.fn().mockRejectedValue(new Error('recall blew up')),
      });
      const mgr = new AiMemoryManager(llmFake(), threadFake([], []), agentMem);
      const res = await mgr.injectMemoryContext(
        baseInject({
          strategy: 'persistent',
          target: { conversationThread: { turns: [] } } as InjectArgs['target'],
        }),
      );
      expect(res.memory.recalledCount).toBe(0);
      expect(
        (agentMem as unknown as { recall: jest.Mock }).recall,
      ).toHaveBeenCalled();
    });

    it('persistent 회수 성공 시 recalledCount 반영 + scopeKey/topK/threshold/embedding config 로 호출', async () => {
      const agentMem = agentMemFake({
        recall: jest
          .fn()
          .mockResolvedValue([{ content: 'fact A' }, { content: 'fact B' }]),
      });
      const mgr = new AiMemoryManager(llmFake(), threadFake([], []), agentMem);
      const res = await mgr.injectMemoryContext(
        baseInject({
          strategy: 'persistent',
          config: {
            memoryTopK: 3,
            memoryThreshold: 0.5,
            memoryKey: 'k1',
            embeddingModelConfigId: 'emb-1',
          },
          target: { conversationThread: { turns: [] } } as InjectArgs['target'],
        }),
      );
      expect(res.memory.recalledCount).toBe(2);
      const am = agentMem as unknown as {
        resolveScopeKey: jest.Mock;
        recall: jest.Mock;
      };
      expect(am.resolveScopeKey).toHaveBeenCalledWith('k1', 'exec-1');
      expect(am.recall).toHaveBeenCalledWith(
        'ws-1',
        'k1',
        'hello',
        { embeddingModelConfigId: 'emb-1' },
        { topK: 3, threshold: 0.5 },
      );
    });

    it('queryText 가 비면 finalSystemPrompt 로 회수 쿼리를 폴백한다 (저장/회수 비대칭 방지)', async () => {
      const agentMem = agentMemFake();
      const mgr = new AiMemoryManager(llmFake(), threadFake([], []), agentMem);
      await mgr.injectMemoryContext(
        baseInject({
          strategy: 'persistent',
          queryText: '   ',
          finalSystemPrompt: 'fallback-sys',
          target: { conversationThread: { turns: [] } } as InjectArgs['target'],
        }),
      );
      const am = agentMem as unknown as { recall: jest.Mock };
      expect(am.recall).toHaveBeenCalledWith(
        'ws-1',
        expect.any(String),
        'fallback-sys',
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('tailMode=system-only (멀티턴) 은 휘발성 꼬리를 prepend 하지 않고 system 메시지만 갱신한다', async () => {
      const turns: FakeTurn[] = [
        { seq: 1, source: 'ai_user', text: 'old', nodeLabel: 'n' },
      ];
      const mgr = new AiMemoryManager(
        llmFake(),
        threadFake(turns, turns),
        agentMemFake(),
      );
      const messages = [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'a' },
        { role: 'assistant', content: 'b' },
      ] as ChatMessage[];
      const res = await mgr.injectMemoryContext(
        baseInject({
          strategy: 'summary_buffer',
          tailMode: 'system-only',
          messages,
          target: {
            conversationThread: { turns },
          } as InjectArgs['target'],
        }),
      );
      // 꼬리는 이미 누적 messages 에 있으므로 재 prepend 금지 (§6.2 d.5).
      expect(res.messages).toHaveLength(3);
      expect(res.messages[1]).toEqual({ role: 'user', content: 'a' });
      expect(res.messages[2]).toEqual({ role: 'assistant', content: 'b' });
    });

    it('system 메시지 없는 messages 배열은 휘발성 꼬리를 index 0 에 prepend 한다 (insertAt 폴백)', async () => {
      const turns: FakeTurn[] = [
        { seq: 1, source: 'ai_user', text: 'history', nodeLabel: 'n' },
      ];
      const mgr = new AiMemoryManager(
        llmFake(),
        threadFake(turns, turns),
        agentMemFake(),
      );
      const messages = [{ role: 'user', content: 'now' }] as ChatMessage[];
      const res = await mgr.injectMemoryContext(
        baseInject({
          strategy: 'summary_buffer',
          tailMode: 'prepend',
          messages,
          target: {
            conversationThread: { turns },
          } as InjectArgs['target'],
        }),
      );
      // systemIdx === -1 → insertAt 0: 꼬리가 맨 앞에, 원본 user 메시지는 마지막.
      expect(res.messages.length).toBeGreaterThanOrEqual(1);
      expect(res.messages[res.messages.length - 1]).toEqual({
        role: 'user',
        content: 'now',
      });
    });
  });
});
