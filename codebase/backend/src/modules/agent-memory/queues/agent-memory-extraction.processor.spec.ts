import { AgentMemoryExtractionProcessor } from './agent-memory-extraction.processor';
import type {
  AgentMemoryExtractionJob,
  ExtractionTurnSnapshot,
} from './agent-memory-extraction.queue';
import type { Job } from 'bullmq';

function makeJob(
  data: Partial<AgentMemoryExtractionJob>,
): Job<AgentMemoryExtractionJob> {
  const turns: ExtractionTurnSnapshot[] = data.turns ?? [
    { source: 'ai_user', text: '내 이름은 지수야', nodeLabel: 'Agent' },
    { source: 'ai_assistant', text: '안녕하세요', nodeLabel: 'Agent' },
  ];
  return {
    data: {
      workspaceId: data.workspaceId ?? 'ws-1',
      scopeKey: data.scopeKey ?? 'cust-7',
      llmConfigId: 'llmConfigId' in data ? data.llmConfigId : 'cfg-1',
      model: data.model ?? 'gpt-4o',
      // 추출 전용 모델 — 미지정이면 생략 (processor 가 model → 기본 폴백).
      ...('extractionModel' in data
        ? { extractionModel: data.extractionModel }
        : {}),
      turns,
    },
  } as Job<AgentMemoryExtractionJob>;
}

describe('AgentMemoryExtractionProcessor (spec §3, AGM-04)', () => {
  let llmService: { resolveConfig: jest.Mock; chat: jest.Mock };
  let agentMemoryService: { saveMemories: jest.Mock };
  let processor: AgentMemoryExtractionProcessor;

  beforeEach(() => {
    llmService = {
      resolveConfig: jest.fn().mockResolvedValue({
        id: 'cfg-1',
        provider: 'openai',
        defaultModel: 'gpt-4o',
      }),
      chat: jest.fn().mockResolvedValue({
        content: '["사용자 이름은 지수다", "사용자는 간결한 답변을 선호한다"]',
        model: 'gpt-4o',
      }),
    };
    agentMemoryService = {
      saveMemories: jest.fn().mockResolvedValue(undefined),
    };
    processor = new AgentMemoryExtractionProcessor(
      llmService as never,
      agentMemoryService as never,
    );
  });

  it('transcript 로 추출 LLM 콜 후 saveMemories 로 content 단위 저장', async () => {
    await processor.process(makeJob({}));

    // 추출 LLM 콜 — 노드 llmConfigId 재사용.
    expect(llmService.resolveConfig).toHaveBeenCalledWith('cfg-1', 'ws-1');
    expect(llmService.chat).toHaveBeenCalledTimes(1);
    const chatParams = llmService.chat.mock.calls[0][1];
    expect(chatParams.model).toBe('gpt-4o');
    expect(chatParams.messages[0].role).toBe('system');
    expect(chatParams.messages[1].role).toBe('user');
    expect(chatParams.messages[1].content).toContain(
      '사용자: 내 이름은 지수야',
    );

    // saveMemories — scopeKey / items / embedCfgSource 검증.
    expect(agentMemoryService.saveMemories).toHaveBeenCalledTimes(1);
    const [wsId, scopeKey, items, embedCfg] =
      agentMemoryService.saveMemories.mock.calls[0];
    expect(wsId).toBe('ws-1');
    expect(scopeKey).toBe('cust-7');
    // 구 shape(문자열 배열) → kind=fact fallback.
    expect(items).toEqual([
      {
        content: '사용자 이름은 지수다',
        metadata: { kind: 'fact', source: 'turn_boundary_extraction' },
      },
      {
        content: '사용자는 간결한 답변을 선호한다',
        metadata: { kind: 'fact', source: 'turn_boundary_extraction' },
      },
    ]);
    expect(embedCfg).toMatchObject({ llmConfigId: 'cfg-1' });
  });

  it('AGM-11: 분류된 {content, kind} 응답을 metadata.kind 로 저장', async () => {
    llmService.chat.mockResolvedValue({
      content:
        '[{"content": "이름은 지수다", "kind": "entity"}, {"content": "간결함을 선호", "kind": "preference"}]',
      model: 'gpt-4o',
    });
    await processor.process(makeJob({}));
    const [, , items] = agentMemoryService.saveMemories.mock.calls[0];
    expect(items).toEqual([
      {
        content: '이름은 지수다',
        metadata: { kind: 'entity', source: 'turn_boundary_extraction' },
      },
      {
        content: '간결함을 선호',
        metadata: { kind: 'preference', source: 'turn_boundary_extraction' },
      },
    ]);
  });

  it('AGM-10: job.ttlDays 를 saveMemories 5번째 인자로 전달', async () => {
    const job = makeJob({});
    job.data.ttlDays = 14;
    await processor.process(job);
    const callArgs = agentMemoryService.saveMemories.mock.calls[0];
    expect(callArgs[4]).toBe(14);
  });

  it('W4: 비정상 ttlDays(0/음수/NaN/비숫자)는 undefined 로 정규화해 전달', async () => {
    const bads: unknown[] = [0, -5, NaN, Infinity, '30'];
    for (const bad of bads) {
      agentMemoryService.saveMemories.mockClear();
      const job = makeJob({});
      job.data.ttlDays = bad as number;
      await processor.process(job);
      const callArgs = agentMemoryService.saveMemories.mock.calls[0];
      expect(callArgs[4]).toBeUndefined();
    }
  });

  it('W4: 양의 유한수 ttlDays 는 그대로 전달', async () => {
    const job = makeJob({});
    job.data.ttlDays = 14;
    await processor.process(job);
    expect(agentMemoryService.saveMemories.mock.calls[0][4]).toBe(14);
  });

  it('추출 결과 빈 배열이면 saveMemories 호출 안 함 (no-op)', async () => {
    llmService.chat.mockResolvedValue({ content: '[]', model: 'gpt-4o' });
    await processor.process(makeJob({}));
    expect(agentMemoryService.saveMemories).not.toHaveBeenCalled();
  });

  it('파싱 불가 응답이면 no-op (graceful)', async () => {
    llmService.chat.mockResolvedValue({ content: 'not json', model: 'gpt-4o' });
    await processor.process(makeJob({}));
    expect(agentMemoryService.saveMemories).not.toHaveBeenCalled();
  });

  it('turns 가 비었으면 LLM 콜 없이 no-op', async () => {
    await processor.process(makeJob({ turns: [] }));
    expect(llmService.chat).not.toHaveBeenCalled();
    expect(agentMemoryService.saveMemories).not.toHaveBeenCalled();
  });

  it('transcript 가 빈(추출 불가 turn 만) 경우 LLM 콜 없이 no-op', async () => {
    await processor.process(
      makeJob({
        turns: [{ source: 'system', text: 'sys', nodeLabel: 'Agent' }],
      }),
    );
    expect(llmService.chat).not.toHaveBeenCalled();
    expect(agentMemoryService.saveMemories).not.toHaveBeenCalled();
  });

  it('workspaceId / scopeKey 결손이면 no-op', async () => {
    await processor.process(makeJob({ workspaceId: '' }));
    await processor.process(makeJob({ scopeKey: '' }));
    expect(llmService.chat).not.toHaveBeenCalled();
  });

  it('llmConfigId 미지정이면 워크스페이스 기본 config (resolveConfig undefined)', async () => {
    await processor.process(makeJob({ llmConfigId: null }));
    expect(llmService.resolveConfig).toHaveBeenCalledWith(undefined, 'ws-1');
  });
  describe('추출 모델 폴백 체인 (extractionModel → model → llmConfig 기본, A3)', () => {
    it('extractionModel set 시 추출 LLM 콜이 그 모델을 쓴다', async () => {
      await processor.process(makeJob({ extractionModel: 'cheap-extract' }));
      expect(llmService.chat.mock.calls[0][1].model).toBe('cheap-extract');
    });

    it('extractionModel 미설정·model 있으면 model 로 폴백', async () => {
      // makeJob 기본 model='gpt-4o', extractionModel 없음.
      await processor.process(makeJob({}));
      expect(llmService.chat.mock.calls[0][1].model).toBe('gpt-4o');
    });

    it('extractionModel·model 모두 미설정이면 llmConfig.defaultModel 로 폴백', async () => {
      const job = makeJob({});
      (job.data as { model?: string | null }).model = null;
      // resolveConfig 가 defaultModel='ws-default' 를 돌려주게.
      llmService.resolveConfig.mockResolvedValue({
        id: 'cfg-1',
        provider: 'openai',
        defaultModel: 'ws-default',
      });
      await processor.process(job);
      expect(llmService.chat.mock.calls[0][1].model).toBe('ws-default');
    });
  });
});
