import {
  AiAgentHandler,
  FORM_SUBMITTED_GUIDANCE_MESSAGE,
  FORM_SUBMITTED_MAX_BYTES,
} from './ai-agent.handler';
import { ExecutionContext } from '../../core/node-handler.interface';
import { KbToolProvider, kbToolName } from './tool-providers/kb-tool-provider';
import { RenderToolProvider } from './tool-providers/render-tool-provider';
import { adaptHandlerReturn } from '../../../modules/execution-engine/handler-output.adapter';
import { makeExecutionContext } from '../../../modules/execution-engine/__test__/make-execution-context';

describe('AiAgentHandler', () => {
  let handler: AiAgentHandler;
  let mockLlmService: Record<string, jest.Mock>;
  let mockRagService: { search: jest.Mock };
  let mockKbService: { findById: jest.Mock };
  let mockWebsocketService: { emitExecutionEvent: jest.Mock };
  let kbProvider: KbToolProvider;

  beforeEach(() => {
    mockLlmService = {
      resolveConfig: jest.fn().mockResolvedValue({
        id: 'config-1',
        provider: 'openai',
        defaultModel: 'gpt-4o',
      }),
      chat: jest.fn().mockResolvedValue({
        content: 'Hello! I am an AI assistant.',
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        model: 'gpt-4o',
        finishReason: 'stop',
      }),
      embed: jest.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
    };

    mockRagService = { search: jest.fn().mockResolvedValue([]) };
    mockKbService = {
      findById: jest
        .fn()
        .mockImplementation((id: string) =>
          Promise.resolve({ id, name: `KB ${id}`, description: '' }),
        ),
    };
    kbProvider = new KbToolProvider(
      mockRagService as never,
      mockKbService as never,
    );

    mockWebsocketService = { emitExecutionEvent: jest.fn() };

    handler = new AiAgentHandler(
      mockLlmService as never,
      [kbProvider],
      mockWebsocketService as never,
    );
  });

  const baseContext: ExecutionContext = makeExecutionContext({
    executionId: 'exec-1',
    workflowId: 'wf-1',
    variables: { __workspaceId: 'ws-1' },
  });

  describe('validate', () => {
    it('should fail when no prompts are provided', () => {
      const result = handler.validate({});
      expect(result.valid).toBe(false);
      // Schema warningRule "ai_agent:single-turn-needs-prompt" fires.
      expect(result.errors.some((e) => e.includes('System Prompt'))).toBe(true);
    });

    it('should pass with systemPrompt + provider', () => {
      const result = handler.validate({
        systemPrompt: 'You are helpful',
        model: 'gpt-4',
      });
      expect(result.valid).toBe(true);
    });

    it('should pass with userPrompt + provider', () => {
      const result = handler.validate({
        userPrompt: 'Hello',
        model: 'gpt-4',
      });
      expect(result.valid).toBe(true);
    });

    it('should validate multi_turn mode with invalid maxTurns', () => {
      const result = handler.validate({
        systemPrompt: 'You are helpful',
        model: 'gpt-4',
        mode: 'multi_turn',
        maxTurns: -1,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'maxTurns must be 0 (unlimited) or a positive integer',
      );
    });

    it('should pass multi_turn mode with valid settings', () => {
      const result = handler.validate({
        systemPrompt: 'You are helpful',
        model: 'gpt-4',
        mode: 'multi_turn',
        maxTurns: 10,
      });
      expect(result.valid).toBe(true);
    });

    it('should fail multi_turn without systemPrompt', () => {
      const result = handler.validate({
        mode: 'multi_turn',
        model: 'gpt-4',
      });
      expect(result.valid).toBe(false);
      // Schema warningRule "Multi Turn mode requires System Prompt." fires.
      expect(result.errors.some((e) => e.includes('Multi Turn'))).toBe(true);
    });
  });

  describe('System Context Prefix (spec §11)', () => {
    it('prepends "## System Context" with current time + timezone to systemPrompt by default', async () => {
      await handler.execute(
        { question: 'X' },
        {
          systemPrompt: 'You are helpful',
          userPrompt: 'X',
        },
        makeExecutionContext({
          executionId: 'exec-1',
          workflowId: 'wf-1',
          variables: {
            __workspaceId: 'ws-1',
            __workspaceTimezone: 'Asia/Seoul',
          },
        }),
      );
      const chatCall = mockLlmService.chat.mock.calls[0];
      const systemMsg = chatCall[1].messages.find(
        (m: { role: string }) => m.role === 'system',
      );
      expect(systemMsg.content).toMatch(/^## System Context\n/);
      expect(systemMsg.content).toContain('Timezone: Asia/Seoul (UTC+9)');
      // User systemPrompt 가 prefix 뒤에 그대로 이어진다.
      expect(systemMsg.content).toContain('You are helpful');
      // Prefix 가 user systemPrompt 보다 앞에 위치한다.
      expect(systemMsg.content.indexOf('## System Context')).toBeLessThan(
        systemMsg.content.indexOf('You are helpful'),
      );
    });

    it('skips the prefix when includeSystemContext: false', async () => {
      await handler.execute(
        { question: 'X' },
        {
          systemPrompt: 'You are helpful',
          userPrompt: 'X',
          includeSystemContext: false,
        },
        baseContext,
      );
      const chatCall = mockLlmService.chat.mock.calls[0];
      const systemMsg = chatCall[1].messages.find(
        (m: { role: string }) => m.role === 'system',
      );
      expect(systemMsg.content).not.toContain('## System Context');
      expect(systemMsg.content).toBe('You are helpful');
    });
  });

  describe('execute - single_turn', () => {
    it('should call LLM and return response', async () => {
      const result = await handler.execute(
        { question: 'What is AI?' },
        {
          systemPrompt: 'You are helpful',
          userPrompt: 'What is AI?',
        },
        baseContext,
      );

      expect(mockLlmService.chat).toHaveBeenCalled();
      const r = result as unknown as Record<string, unknown>;
      const out = r.output as Record<string, unknown>;
      const res = out.result as Record<string, unknown>;
      expect(res.response).toBe('Hello! I am an AI assistant.');
      expect(r.meta).toBeDefined();
      expect(r.status).toBe('ended');
    });

    it('should NOT pre-search KB on first call (LLM decides via tool)', async () => {
      // KB 가 등록돼도 핸들러는 더 이상 LLM 호출 전에 검색을 강제하지 않는다.
      // LLM 이 small-talk 라고 판단해 toolCalls=[] 만 반환하면 검색은 0회.
      await handler.execute(
        {},
        {
          systemPrompt: 'Helper',
          userPrompt: 'Hi',
          knowledgeBases: ['kb-1'],
        },
        baseContext,
      );

      expect(mockRagService.search).not.toHaveBeenCalled();
      const meta = readSingleTurnMeta(handler)(
        await handler.execute(
          {},
          {
            systemPrompt: 'Helper',
            userPrompt: 'Hi',
            knowledgeBases: ['kb-1'],
          },
          baseContext,
        ),
      );
      const diag = meta.ragDiagnostics as Record<string, unknown>;
      expect(diag.attempted).toBe(false);
    });

    it('exposes a kb_ tool to the LLM when knowledgeBases are configured', async () => {
      mockKbService.findById.mockResolvedValueOnce({
        id: 'kb-1',
        name: 'Refund Policy',
        description: 'How refunds work',
      });

      await handler.execute(
        {},
        {
          systemPrompt: 'Helper',
          userPrompt: 'Anything refundable?',
          knowledgeBases: ['kb-1'],
        },
        baseContext,
      );

      const chatCall = mockLlmService.chat.mock.calls[0];
      const tools = chatCall[1].tools;
      const kbTool = tools.find((t: { name: string }) =>
        t.name.startsWith('kb_'),
      );
      expect(kbTool).toBeDefined();
      expect(kbTool.name).toBe(kbToolName('kb-1'));
      expect(kbTool.description).toContain('Refund Policy');
    });

    it('executes a kb_ tool call and feeds result back to the LLM', async () => {
      mockRagService.search.mockResolvedValue([
        {
          chunkId: 'c1',
          documentId: 'd1',
          documentName: 'refund.md',
          content: '14-day refund window.',
          score: 0.9,
          metadata: {},
        },
      ]);

      mockLlmService.chat
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: 'tc-kb-1',
              name: kbToolName('kb-1'),
              arguments: '{"query":"refund window"}',
            },
          ],
          usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'You have 14 days to request a refund.',
          usage: { inputTokens: 80, outputTokens: 20, totalTokens: 100 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });

      const result = (await handler.execute(
        {},
        {
          systemPrompt: 'Helper',
          userPrompt: 'When can I request a refund?',
          knowledgeBases: ['kb-1'],
        },
        baseContext,
      )) as unknown as Record<string, unknown>;

      expect(mockRagService.search).toHaveBeenCalledWith(
        'refund window',
        ['kb-1'],
        'ws-1',
        { topK: 5, threshold: 0.7 },
      );

      // 두 번째 LLM 호출에는 tool_result 메시지가 포함돼야 한다.
      const secondCall = mockLlmService.chat.mock.calls[1];
      const messages = secondCall[1].messages;
      const toolMsg = messages.find((m: { role: string }) => m.role === 'tool');
      expect(toolMsg).toBeDefined();
      const toolPayload = JSON.parse(toolMsg.content);
      expect(toolPayload.results[0].source).toBe('refund.md');

      const meta = (result.meta ?? {}) as unknown as Record<string, unknown>;
      expect(meta.toolCalls).toBe(1);
      expect((meta.ragSources as unknown[]).length).toBe(1);
      const diag = meta.ragDiagnostics as Record<string, unknown>;
      expect(diag.attempted).toBe(true);
      expect(diag.searchedKbCount).toBe(1);
      expect(diag.resultCount).toBe(1);
    });

    it('runs parallel kb_ tool calls when LLM emits multiple in one response', async () => {
      mockRagService.search.mockImplementation((q: string) =>
        Promise.resolve([
          {
            chunkId: `c-${q}`,
            documentId: 'd1',
            documentName: `doc-${q}`,
            content: `payload for ${q}`,
            score: 0.8,
            metadata: {},
          },
        ]),
      );

      mockLlmService.chat
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: 'tc-a',
              name: kbToolName('kb-a'),
              arguments: '{"query":"alpha"}',
            },
            {
              id: 'tc-b',
              name: kbToolName('kb-b'),
              arguments: '{"query":"beta"}',
            },
          ],
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'Combined answer.',
          usage: { inputTokens: 30, outputTokens: 15, totalTokens: 45 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });

      const result = (await handler.execute(
        {},
        {
          systemPrompt: 'Helper',
          userPrompt: 'Tell me about alpha and beta',
          knowledgeBases: ['kb-a', 'kb-b'],
        },
        baseContext,
      )) as unknown as Record<string, unknown>;

      expect(mockRagService.search).toHaveBeenCalledTimes(2);
      const meta = (result.meta ?? {}) as unknown as Record<string, unknown>;
      expect(meta.toolCalls).toBe(2);
      const diag = meta.ragDiagnostics as Record<string, unknown>;
      expect(diag.searchedKbCount).toBe(2);
      expect((diag.queriesUsed as string[]).sort()).toEqual(['alpha', 'beta']);
    });

    it('supports re-search across iterations until maxToolCalls is reached', async () => {
      mockRagService.search.mockResolvedValue([
        {
          chunkId: 'c1',
          documentId: 'd1',
          documentName: 'doc',
          content: 'first',
          score: 0.7,
          metadata: {},
        },
      ]);

      mockLlmService.chat
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: 'tc-1',
              name: kbToolName('kb-1'),
              arguments: '{"query":"first"}',
            },
          ],
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: 'tc-2',
              name: kbToolName('kb-1'),
              arguments: '{"query":"refined"}',
            },
          ],
          usage: { inputTokens: 20, outputTokens: 5, totalTokens: 25 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'Final.',
          usage: { inputTokens: 25, outputTokens: 5, totalTokens: 30 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });

      const result = (await handler.execute(
        {},
        {
          systemPrompt: 'Helper',
          userPrompt: 'Tell me',
          knowledgeBases: ['kb-1'],
          maxToolCalls: 5,
        },
        baseContext,
      )) as unknown as Record<string, unknown>;

      expect(mockRagService.search).toHaveBeenCalledTimes(2);
      const meta = (result.meta ?? {}) as unknown as Record<string, unknown>;
      const diag = meta.ragDiagnostics as Record<string, unknown>;
      expect(diag.queriesUsed as string[]).toEqual(['first', 'refined']);
    });

    it('stops the tool loop once maxToolCalls is reached', async () => {
      mockRagService.search.mockResolvedValue([]);
      mockLlmService.chat.mockResolvedValue({
        content: null,
        toolCalls: [
          {
            id: 'tc-x',
            name: kbToolName('kb-1'),
            arguments: '{"query":"x"}',
          },
        ],
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        model: 'gpt-4o',
        finishReason: 'tool_calls',
      });

      const result = (await handler.execute(
        {},
        {
          systemPrompt: 'Helper',
          userPrompt: 'Q',
          knowledgeBases: ['kb-1'],
          maxToolCalls: 2,
        },
        baseContext,
      )) as unknown as Record<string, unknown>;

      // chat invoked: initial + 2 loop iterations (until count == max), then exits.
      expect(mockLlmService.chat).toHaveBeenCalledTimes(3);
      const meta = (result.meta ?? {}) as unknown as Record<string, unknown>;
      expect(meta.toolCalls).toBe(2);
    });

    it('executes provider tool calls within a turn concurrently (Promise.all)', async () => {
      // 능동적 의도 분해(agentic RAG) 의 latency 핵심: LLM 이 한 응답에 N 개 tool_use
      // 를 emit 했을 때 핸들러가 직렬이 아닌 동시 실행하는지 확인. inFlight 카운터의
      // 최대값이 1 이면 직렬, 2 이상이면 병렬.
      let inFlight = 0;
      let maxInFlight = 0;
      mockRagService.search.mockImplementation(async (q: string) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise<void>((resolve) => setTimeout(resolve, 30));
        inFlight--;
        return [
          {
            chunkId: `c-${q}`,
            documentId: 'd1',
            documentName: `doc-${q}`,
            content: `payload for ${q}`,
            score: 0.8,
            metadata: {},
          },
        ];
      });

      mockLlmService.chat
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: 'tc-a',
              name: kbToolName('kb-a'),
              arguments: '{"query":"alpha"}',
            },
            {
              id: 'tc-b',
              name: kbToolName('kb-b'),
              arguments: '{"query":"beta"}',
            },
            {
              id: 'tc-c',
              name: kbToolName('kb-a'),
              arguments: '{"query":"gamma"}',
            },
          ],
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'Combined answer.',
          usage: { inputTokens: 30, outputTokens: 15, totalTokens: 45 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });

      await handler.execute(
        {},
        {
          systemPrompt: 'Helper',
          userPrompt: 'Tell me about alpha, beta, and gamma',
          knowledgeBases: ['kb-a', 'kb-b'],
        },
        baseContext,
      );

      expect(mockRagService.search).toHaveBeenCalledTimes(3);
      expect(maxInFlight).toBeGreaterThanOrEqual(2);
    });

    it('truncates within-batch when remaining budget < emitted tool_use count', async () => {
      // batch 부분 truncate: maxToolCalls 잔여 R 보다 emit 된 tool_use 가 많으면
      // 앞쪽 R 건만 실제 실행하고, 나머지는 'tool_call_budget_exceeded' 코드의
      // tool_result 로 회신해야 한다 (Anthropic tool_use ↔ tool_result 매칭 요건).
      mockRagService.search.mockResolvedValue([]);

      mockLlmService.chat
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: 'tc-1',
              name: kbToolName('kb-1'),
              arguments: '{"query":"q1"}',
            },
            {
              id: 'tc-2',
              name: kbToolName('kb-1'),
              arguments: '{"query":"q2"}',
            },
            {
              id: 'tc-3',
              name: kbToolName('kb-1'),
              arguments: '{"query":"q3"}',
            },
          ],
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'final',
          usage: { inputTokens: 20, outputTokens: 5, totalTokens: 25 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });

      const result = (await handler.execute(
        {},
        {
          systemPrompt: 'Helper',
          userPrompt: 'three things',
          knowledgeBases: ['kb-1'],
          maxToolCalls: 2,
        },
        baseContext,
      )) as unknown as Record<string, unknown>;

      // 잔여 한도 2 만큼만 실제 검색 수행
      expect(mockRagService.search).toHaveBeenCalledTimes(2);

      // 2번째 LLM 호출의 messages 에는 모든 3 개 tool_use 에 대응되는
      // tool_result 메시지가 포함돼야 함 (Anthropic 의 매칭 요건).
      const secondCall = mockLlmService.chat.mock.calls[1];
      const messages = secondCall[1].messages as Array<{
        role: string;
        toolCallId?: string;
        content: string;
      }>;
      const toolMsgs = messages.filter((m) => m.role === 'tool');
      expect(toolMsgs).toHaveLength(3);
      const ids = toolMsgs.map((m) => m.toolCallId).sort();
      expect(ids).toEqual(['tc-1', 'tc-2', 'tc-3']);

      const budgetMsg = toolMsgs.find((m) => m.toolCallId === 'tc-3');
      expect(budgetMsg).toBeDefined();
      const budgetBody = JSON.parse(budgetMsg!.content) as unknown as {
        error?: string;
      };
      expect(budgetBody.error).toBe('tool_call_budget_exceeded');

      const meta = (result.meta ?? {}) as unknown as Record<string, unknown>;
      expect(meta.toolCalls).toBe(2);
    });

    it('dedupes ragSources by chunkId across parallel kb_ tool calls in the same batch', async () => {
      // 같은 turn 의 두 병렬 호출이 동일 chunkId 를 반환하면 (예: 두 query 가
      // 같은 청크에 매칭) meta.ragSources 는 하나만 남아야 한다. References
      // 탭의 React key collision 방지 + 사용자에게 중복 청크 노출 차단.
      mockRagService.search.mockImplementation(async (q: string) => [
        {
          chunkId: 'c-shared',
          documentId: 'd-shared',
          documentName: 'shared.md',
          content: `result for ${q}`,
          score: q === 'a' ? 0.95 : 0.85,
          metadata: {},
        },
      ]);

      mockLlmService.chat
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: 'tc-a',
              name: kbToolName('kb-1'),
              arguments: '{"query":"a"}',
            },
            {
              id: 'tc-b',
              name: kbToolName('kb-1'),
              arguments: '{"query":"b"}',
            },
          ],
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'done',
          usage: { inputTokens: 20, outputTokens: 5, totalTokens: 25 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });

      const result = (await handler.execute(
        {},
        {
          systemPrompt: 'Helper',
          userPrompt: 'two queries hitting same chunk',
          knowledgeBases: ['kb-1'],
        },
        baseContext,
      )) as unknown as Record<string, unknown>;

      expect(mockRagService.search).toHaveBeenCalledTimes(2);

      const meta = (result.meta ?? {}) as unknown as Record<string, unknown>;
      const sources = meta.ragSources as Array<{ chunkId: string }>;
      // Same chunkId returned by both parallel calls → deduped.
      expect(sources).toHaveLength(1);
      expect(sources[0].chunkId).toBe('c-shared');

      // 진단은 양쪽 query 호출을 모두 기록.
      const diag = meta.ragDiagnostics as Record<string, unknown>;
      expect((diag.queriesUsed as string[]).sort()).toEqual(['a', 'b']);
      expect(diag.resultCount).toBe(2);
      expect(meta.toolCalls).toBe(2);
    });

    it('isolates partial failures across parallel kb_ tool calls', async () => {
      // 병렬 호출 중 한 건이 실패해도 나머지는 성공 결과로 누적되며,
      // 실패한 건은 search_failed tool_result 로 LLM 에 전달된다.
      mockRagService.search.mockImplementation(async (q: string) => {
        if (q === 'fail') throw new Error('db down');
        return [
          {
            chunkId: `c-${q}`,
            documentId: 'd1',
            documentName: `doc-${q}`,
            content: `data for ${q}`,
            score: 0.85,
            metadata: {},
          },
        ];
      });

      mockLlmService.chat
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: 'tc-ok',
              name: kbToolName('kb-1'),
              arguments: '{"query":"ok"}',
            },
            {
              id: 'tc-bad',
              name: kbToolName('kb-1'),
              arguments: '{"query":"fail"}',
            },
          ],
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'partial answer',
          usage: { inputTokens: 20, outputTokens: 5, totalTokens: 25 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });

      const result = (await handler.execute(
        {},
        {
          systemPrompt: 'Helper',
          userPrompt: 'two things',
          knowledgeBases: ['kb-1'],
        },
        baseContext,
      )) as unknown as Record<string, unknown>;

      // 성공 호출의 ragSources 가 누적됨
      const meta = (result.meta ?? {}) as unknown as Record<string, unknown>;
      const sources = meta.ragSources as Array<{ chunkId: string }>;
      expect(sources).toHaveLength(1);
      expect(sources[0].chunkId).toBe('c-ok');

      // 실패 호출은 search_failed 로 LLM 에 회신
      const secondCall = mockLlmService.chat.mock.calls[1];
      const toolMsgs = (
        secondCall[1].messages as Array<{
          role: string;
          toolCallId?: string;
          content: string;
        }>
      ).filter((m) => m.role === 'tool');
      const failMsg = toolMsgs.find((m) => m.toolCallId === 'tc-bad');
      expect(failMsg).toBeDefined();
      const failBody = JSON.parse(failMsg!.content) as unknown as {
        error?: string;
      };
      expect(failBody.error).toBe('search_failed');

      // 양쪽 호출 모두 toolCalls 카운트 + 진단에 누적되어야 함.
      expect(meta.toolCalls).toBe(2);
      const diag = meta.ragDiagnostics as Record<string, unknown>;
      expect((diag.queriesUsed as string[]).sort()).toEqual(['fail', 'ok']);
      // 실패 호출의 resultCount=0 + 성공 호출의 resultCount=1 = 합 1.
      expect(diag.resultCount).toBe(1);
    });

    it('truncates within-batch on multi-turn resume too (parity with single-turn)', async () => {
      // multi-turn resume 경로도 single-turn 과 동일 헬퍼(executeProviderToolBatch)
      // 를 사용하므로 잔여 한도 < emit 수 시 동일하게 truncate 해야 한다. 한쪽만
      // 수정될 경우의 회귀를 가드.
      mockRagService.search.mockResolvedValue([]);
      mockLlmService.chat
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: 'tc-r1',
              name: kbToolName('kb-1'),
              arguments: '{"query":"q1"}',
            },
            {
              id: 'tc-r2',
              name: kbToolName('kb-1'),
              arguments: '{"query":"q2"}',
            },
            {
              id: 'tc-r3',
              name: kbToolName('kb-1'),
              arguments: '{"query":"q3"}',
            },
          ],
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'final',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });

      const resumeState = {
        turnCount: 1,
        maxTurns: 5,
        maxToolCalls: 2,
        knowledgeBases: ['kb-1'],
        workspaceId: 'ws-1',
        conditions: [],
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalThinkingTokens: 0,
        toolCalls: 0,
        ragSources: [],
        ragLastDiagnostics: undefined,
        messages: [
          { role: 'system', content: 'sys' },
          { role: 'user', content: 'turn1' },
          { role: 'assistant', content: 'ack' },
        ],
        executionId: 'exec-1',
        nodeId: 'agent-1',
        nodeExecutionId: 'ne-1',
        workflowId: 'wf-1',
        model: 'gpt-4o',
        llmConfigId: 'config-1',
        turnDebugHistory: [],
      };

      await (
        handler as unknown as {
          processMultiTurnMessage: (
            msg: string,
            state: Record<string, unknown>,
          ) => Promise<unknown>;
        }
      ).processMultiTurnMessage('turn2', resumeState);

      // 잔여 한도 2 만큼만 실제 검색 수행.
      expect(mockRagService.search).toHaveBeenCalledTimes(2);

      // 모든 3개 tool_use 가 tool_result 와 매칭되어야 함 (Anthropic 요건).
      const secondCall = mockLlmService.chat.mock.calls[1];
      const toolMsgs = (
        secondCall[1].messages as Array<{
          role: string;
          toolCallId?: string;
          content: string;
        }>
      ).filter((m) => m.role === 'tool');
      expect(toolMsgs).toHaveLength(3);
      const budgetMsg = toolMsgs.find((m) => m.toolCallId === 'tc-r3');
      expect(budgetMsg).toBeDefined();
      expect(JSON.parse(budgetMsg!.content).error).toBe(
        'tool_call_budget_exceeded',
      );
    });

    it('should parse JSON response when responseFormat is json', async () => {
      mockLlmService.chat.mockResolvedValue({
        content: '{"answer": "42"}',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });

      const result = await handler.execute(
        {},
        {
          userPrompt: 'answer',
          responseFormat: 'json',
        },
        baseContext,
      );

      const r = result as unknown as Record<string, unknown>;
      const out = r.output as Record<string, unknown>;
      const res = out.result as Record<string, unknown>;
      expect(res.response).toEqual({ answer: '42' });
    });

    it('should fallback to raw string when JSON parse fails', async () => {
      mockLlmService.chat.mockResolvedValue({
        content: 'not valid json {{{',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });

      const result = await handler.execute(
        {},
        {
          userPrompt: 'answer',
          responseFormat: 'json',
        },
        baseContext,
      );

      const r = result as unknown as Record<string, unknown>;
      const out = r.output as Record<string, unknown>;
      const res = out.result as Record<string, unknown>;
      expect(res.response).toBe('not valid json {{{');
    });

    it('should default to single_turn when mode is not set', async () => {
      const result = await handler.execute(
        {},
        { userPrompt: 'Hello' },
        baseContext,
      );

      const r = result as unknown as Record<string, unknown>;
      const out = r.output as Record<string, unknown>;
      const res = out.result as Record<string, unknown>;
      expect(res.response).toBeDefined();
      // Stage 5: single_turn now emits `status:'ended'` for observability.
      expect(r.status).toBe('ended');
    });
  });

  describe('execute - multi_turn', () => {
    // multi_turn 의 첫 메시지는 항상 사용자가 채팅 UI 에서 입력한다.
    // config.userPrompt 는 single_turn 전용이며, 여기서 LLM 호출을 trigger
    // 하지 않는다 (mode 전환 시 leak 된 값일 수도 있어 server-side 에서도
    // 무시 — frontend clearFields 와 함께 두 계층에서 차단).
    it('returns waiting_for_input immediately without calling LLM', async () => {
      const result = await handler.execute(
        {},
        {
          mode: 'multi_turn',
          systemPrompt: 'You are helpful',
          maxTurns: 10,
        },
        baseContext,
      );

      expect(mockLlmService.chat).not.toHaveBeenCalled();

      const output = result as unknown as Record<string, unknown>;
      expect(output.status).toBe('waiting_for_input');
      // Canonical NodeHandlerOutput shape — top-level type/conversationConfig
      // are no longer present (CONVENTIONS §4.3 + Principle 0).
      expect('type' in output).toBe(false);
      expect('interactionType' in output).toBe(false);
      expect('conversationConfig' in output).toBe(false);
      const meta = output.meta as Record<string, unknown>;
      expect(meta.interactionType).toBe('ai_conversation');

      const config = output.config as Record<string, unknown>;
      expect(config.mode).toBe('multi_turn');
      expect(config.maxTurns).toBe(10);

      // D6 (2026-05-17) — waiting `output.result.*` 단일 경로.
      const conv = (output.output as Record<string, unknown>).result as Record<
        string,
        unknown
      >;
      expect(conv.turnCount).toBe(0);
      expect(conv.message).toBe('');
      expect(conv.messages).toHaveLength(1); // system only
      expect(conv.maxTurns).toBe(10);

      const state = output._resumeState as Record<string, unknown>;
      expect(state.turnCount).toBe(0);
      expect(state.totalInputTokens).toBe(0);
      expect(state.totalOutputTokens).toBe(0);
    });

    it('ignores leaked userPrompt from a previous single_turn config', async () => {
      // Regression: mode 를 single_turn → multi_turn 으로 전환 시 frontend
      // clearFields 가 동작하지 않은 옛 워크플로 (또는 backend 직접 invoke)
      // 의 leak 된 userPrompt 가 들어와도 LLM 호출이 trigger 되지 않아야 한다.
      const result = await handler.execute(
        {},
        {
          mode: 'multi_turn',
          systemPrompt: 'You are helpful',
          userPrompt: 'leaked prompt that must NOT trigger an LLM call',
          maxTurns: 10,
        },
        baseContext,
      );

      expect(mockLlmService.chat).not.toHaveBeenCalled();

      const output = result as unknown as Record<string, unknown>;
      expect(output.status).toBe('waiting_for_input');
      // D6 — waiting `output.result.*` 단일 경로.
      const conv = (output.output as Record<string, unknown>).result as Record<
        string,
        unknown
      >;
      expect(conv.turnCount).toBe(0);
      // 시스템 메시지만 있고 user 메시지는 push 되지 않는다.
      expect(conv.messages).toHaveLength(1);
      const onlyMsg = (conv.messages as Array<Record<string, unknown>>)[0];
      expect(onlyMsg.role).toBe('system');
    });

    it('canonical waiting shape passes adaptHandlerReturn under NODE_ENV=production', async () => {
      // Regression: pre-migration the handler returned a bare object that
      // failed the production-strict validation in adaptHandlerReturn.
      const prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const result = await handler.execute(
          {},
          { mode: 'multi_turn', systemPrompt: 'sp', maxTurns: 5 },
          baseContext,
        );
        expect(() => adaptHandlerReturn(result)).not.toThrow();
      } finally {
        process.env.NODE_ENV = prevEnv;
      }
    });

    it('does not pre-search KB on first turn even when KB is configured', async () => {
      // multi_turn 첫 turn 에서는 LLM 호출 자체가 없으므로 KB tool 호출도 0회.
      // KB 검색은 사용자가 첫 메시지를 보낸 후 processMultiTurnMessage 에서
      // LLM 이 능동 호출할 때 일어난다.
      const result = await handler.execute(
        {},
        {
          mode: 'multi_turn',
          systemPrompt: 'Helper',
          knowledgeBases: ['kb-1'],
        },
        baseContext,
      );

      expect(mockRagService.search).not.toHaveBeenCalled();
      const output = result as unknown as Record<string, unknown>;
      const state = output._resumeState as Record<string, unknown>;
      expect((state.ragSources as unknown[]).length).toBe(0);
    });
  });

  describe('processMultiTurnMessage', () => {
    it('should process user message and return waiting_for_input', async () => {
      const state = {
        llmConfigId: 'config-1',
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 2048,
        knowledgeBases: [],
        ragTopK: 5,
        ragThreshold: 0.7,
        maxToolCalls: 10,
        maxTurns: 10,
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ],
        turnCount: 1,
        totalInputTokens: 100,
        totalOutputTokens: 50,
        toolCalls: 0,
        ragSources: [],
        workspaceId: 'ws-1',
      };

      mockLlmService.chat.mockResolvedValue({
        content: 'Sure, I can help with that.',
        usage: { inputTokens: 150, outputTokens: 30, totalTokens: 180 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });

      const result = await handler.processMultiTurnMessage(
        'Can you help me?',
        state,
      );

      const output = result as Record<string, unknown>;
      expect(output.status).toBe('waiting_for_input');
      expect('conversationConfig' in output).toBe(false);
      const meta = output.meta as Record<string, unknown>;
      expect(meta.interactionType).toBe('ai_conversation');

      // D6 — resumed waiting `output.result.*` 단일 경로.
      const conv = (output.output as Record<string, unknown>).result as Record<
        string,
        unknown
      >;
      expect(conv.message).toBe('Sure, I can help with that.');
      expect(conv.turnCount).toBe(2);

      const newState = output._resumeState as Record<string, unknown>;
      expect(newState.turnCount).toBe(2);
      expect(newState.totalInputTokens).toBe(250);
      expect(newState.totalOutputTokens).toBe(80);
    });

    it('should include debug fields (lastTurnRequest, lastTurnResponse, lastTurnDurationMs)', async () => {
      const state = {
        llmConfigId: 'config-1',
        model: 'gpt-4o',
        temperature: 0.5,
        maxTokens: 1024,
        knowledgeBases: [],
        ragTopK: 5,
        ragThreshold: 0.7,
        maxToolCalls: 10,
        maxTurns: 10,
        messages: [
          { role: 'system', content: 'System prompt' },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
        ],
        turnCount: 1,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        toolCalls: 0,
        ragSources: [],
        workspaceId: 'ws-1',
      };

      const llmResponse = {
        content: 'Response text',
        usage: { inputTokens: 80, outputTokens: 20, totalTokens: 100 },
        model: 'gpt-4o',
        finishReason: 'stop',
      };
      mockLlmService.chat.mockResolvedValue(llmResponse);

      const result = await handler.processMultiTurnMessage('Hi again', state);

      const newState = (result as Record<string, unknown>)
        ._resumeState as Record<string, unknown>;
      expect(newState.lastTurnRequest).toBeDefined();
      expect(newState.lastTurnRequest).toEqual(
        expect.objectContaining({
          model: 'gpt-4o',
          temperature: 0.5,
          maxTokens: 1024,
          tools: undefined,
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'user', content: 'Hi again' }),
          ]),
        }),
      );
      expect(newState.lastTurnResponse).toBeDefined();
      expect(
        (newState.lastTurnResponse as Record<string, unknown>).content,
      ).toBe('Response text');
      expect(typeof newState.lastTurnDurationMs).toBe('number');
      expect(newState.lastTurnDurationMs as number).toBeGreaterThanOrEqual(0);
    });

    it('should not mutate the original messages array', async () => {
      const originalMessages = [
        { role: 'system', content: 'System' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' },
      ];
      const state = {
        llmConfigId: 'config-1',
        model: 'gpt-4o',
        knowledgeBases: [],
        ragTopK: 5,
        ragThreshold: 0.7,
        maxToolCalls: 10,
        maxTurns: 10,
        messages: originalMessages,
        turnCount: 1,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        toolCalls: 0,
        ragSources: [],
        workspaceId: 'ws-1',
      };

      mockLlmService.chat.mockResolvedValue({
        content: 'Reply',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });

      await handler.processMultiTurnMessage('New message', state);

      // Original array should not be mutated
      expect(originalMessages).toHaveLength(3);
    });

    it('should return final output when maxTurns is reached', async () => {
      const state = {
        llmConfigId: 'config-1',
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 2048,
        knowledgeBases: [],
        ragTopK: 5,
        ragThreshold: 0.7,
        maxToolCalls: 10,
        maxTurns: 2,
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
        ],
        turnCount: 1,
        totalInputTokens: 100,
        totalOutputTokens: 50,
        toolCalls: 0,
        ragSources: [],
        workspaceId: 'ws-1',
      };

      mockLlmService.chat.mockResolvedValue({
        content: 'Goodbye!',
        usage: { inputTokens: 150, outputTokens: 20, totalTokens: 170 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });

      const result = await handler.processMultiTurnMessage(
        'Last message',
        state,
      );

      const r = result as Record<string, unknown>;
      // Stage 5: terminal multi-turn emits unified shape with status:'ended'.
      expect(r.status).toBe('ended');
      // Phase 1 (A) — multi-turn `max_turns` routes to the dedicated
      // `max_turns` port (no longer the legacy `out` hardcode).
      expect(r.port).toBe('max_turns');
      const out = r.output as Record<string, unknown>;
      const res = out.result as Record<string, unknown>;
      expect(res.response).toBe('Goodbye!');
      expect(res.endReason).toBe('max_turns');
      expect(res.turnCount).toBe(2);
      expect(res.messages).toBeDefined();
    });

    it('does NOT auto-search KB when user follows up — LLM decides via kb_ tool', async () => {
      const state = {
        llmConfigId: 'config-1',
        model: 'gpt-4o',
        knowledgeBases: ['kb-1'],
        ragTopK: 5,
        ragThreshold: 0.7,
        maxToolCalls: 10,
        maxTurns: 20,
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
        ],
        turnCount: 1,
        totalInputTokens: 100,
        totalOutputTokens: 50,
        toolCalls: 0,
        ragSources: [],
        workspaceId: 'ws-1',
      };

      mockLlmService.chat.mockResolvedValue({
        content: 'Sure, I am here.',
        usage: { inputTokens: 200, outputTokens: 40, totalTokens: 240 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });

      await handler.processMultiTurnMessage('Just chatting', state);

      // No tool call from the LLM means no KB search happens.
      expect(mockRagService.search).not.toHaveBeenCalled();
    });

    it('processes a follow-up kb_ tool call and accumulates ragSources across turns', async () => {
      mockRagService.search.mockResolvedValue([
        {
          chunkId: 'c2',
          documentId: 'd1',
          documentName: 'doc',
          content: 'New context',
          score: 0.85,
          metadata: {},
        },
      ]);

      const state = {
        llmConfigId: 'config-1',
        model: 'gpt-4o',
        knowledgeBases: ['kb-1'],
        ragTopK: 5,
        ragThreshold: 0.7,
        maxToolCalls: 10,
        maxTurns: 20,
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
        ],
        turnCount: 1,
        totalInputTokens: 100,
        totalOutputTokens: 50,
        toolCalls: 0,
        ragSources: [{ chunkId: 'c-prev', score: 0.7 }],
        workspaceId: 'ws-1',
      };

      mockLlmService.chat
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: 'tc-x',
              name: kbToolName('kb-1'),
              arguments: '{"query":"X"}',
            },
          ],
          usage: { inputTokens: 30, outputTokens: 5, totalTokens: 35 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'Based on KB...',
          usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });

      const result = await handler.processMultiTurnMessage(
        'Tell me about X',
        state,
      );

      expect(mockRagService.search).toHaveBeenCalledWith(
        'X',
        ['kb-1'],
        'ws-1',
        { topK: 5, threshold: 0.7 },
      );
      const newState = (result as Record<string, unknown>)
        ._resumeState as Record<string, unknown>;
      // Carries the previous ragSources entry plus the new one.
      expect((newState.ragSources as unknown[]).length).toBe(2);

      // turnDebugHistory 의 최신 항목에는 이번 턴에 호출된 KB delta 만 담긴다
      // (직전 턴의 c-prev 는 포함되지 않아 노드 누적과 분리 노출됨).
      const history = newState.turnDebugHistory as Array<
        Record<string, unknown>
      >;
      const lastTurn = history[history.length - 1];
      expect(lastTurn.turnIndex).toBe(2);
      const turnSources = lastTurn.ragSources as Array<Record<string, unknown>>;
      expect(turnSources).toHaveLength(1);
      expect(turnSources[0].chunkId).toBe('c2');
      const turnDiag = lastTurn.ragDiagnostics as Record<string, unknown>;
      expect(turnDiag.attempted).toBe(true);
      expect(turnDiag.searchedKbCount).toBe(1);
      expect(turnDiag.queriesUsed).toEqual(['X']);
    });

    it('dedupes ragSources by chunkId across turns (no React key collision)', async () => {
      // Multi-turn conversations where the LLM re-queries the same KB chunk
      // used to push the duplicate into ragSources, which surfaced as a
      // duplicate-key warning on `<li key={s.chunkId}>` in the References tab.
      mockRagService.search.mockResolvedValue([
        {
          chunkId: 'c-prev',
          documentId: 'd1',
          documentName: 'doc',
          content: 'Same chunk re-fetched',
          score: 0.9,
          metadata: {},
        },
      ]);

      const state = {
        llmConfigId: 'config-1',
        model: 'gpt-4o',
        knowledgeBases: ['kb-1'],
        ragTopK: 5,
        ragThreshold: 0.7,
        maxToolCalls: 10,
        maxTurns: 20,
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
        ],
        turnCount: 1,
        totalInputTokens: 100,
        totalOutputTokens: 50,
        toolCalls: 0,
        ragSources: [{ chunkId: 'c-prev', score: 0.7 }],
        workspaceId: 'ws-1',
      };

      mockLlmService.chat
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: 'tc-dup',
              name: kbToolName('kb-1'),
              arguments: '{"query":"again"}',
            },
          ],
          usage: { inputTokens: 30, outputTokens: 5, totalTokens: 35 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'OK',
          usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });

      const result = await handler.processMultiTurnMessage('Again', state);
      const newState = (result as Record<string, unknown>)
        ._resumeState as Record<string, unknown>;
      // Node-level accumulator deduped: still just c-prev once.
      expect((newState.ragSources as unknown[]).length).toBe(1);
      // But the turn delta still records this turn's match for grouping.
      const history = newState.turnDebugHistory as Array<
        Record<string, unknown>
      >;
      const lastTurn = history[history.length - 1];
      const turnSources = lastTurn.ragSources as Array<Record<string, unknown>>;
      expect(turnSources).toHaveLength(1);
      expect(turnSources[0].chunkId).toBe('c-prev');
    });

    it('accumulates multiple KB tool calls within the same turn into turnDebug delta', async () => {
      mockRagService.search.mockImplementation((q: string) =>
        Promise.resolve([
          {
            chunkId: `c-${q}`,
            documentId: 'd1',
            documentName: `doc-${q}`,
            content: `payload for ${q}`,
            score: 0.8,
            metadata: {},
          },
        ]),
      );

      const state = {
        llmConfigId: 'config-1',
        model: 'gpt-4o',
        knowledgeBases: ['kb-a', 'kb-b'],
        ragTopK: 5,
        ragThreshold: 0.7,
        maxToolCalls: 10,
        maxTurns: 20,
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
        ],
        turnCount: 1,
        totalInputTokens: 100,
        totalOutputTokens: 50,
        toolCalls: 0,
        ragSources: [],
        workspaceId: 'ws-1',
      };

      mockLlmService.chat
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: 'tc-a',
              name: kbToolName('kb-a'),
              arguments: '{"query":"alpha"}',
            },
            {
              id: 'tc-b',
              name: kbToolName('kb-b'),
              arguments: '{"query":"beta"}',
            },
          ],
          usage: { inputTokens: 30, outputTokens: 5, totalTokens: 35 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'Combined.',
          usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });

      const result = await handler.processMultiTurnMessage(
        'Tell me alpha and beta',
        state,
      );
      const newState = (result as Record<string, unknown>)
        ._resumeState as Record<string, unknown>;
      const history = newState.turnDebugHistory as Array<
        Record<string, unknown>
      >;
      const lastTurn = history[history.length - 1];
      const turnSources = lastTurn.ragSources as Array<Record<string, unknown>>;
      expect(turnSources).toHaveLength(2);
      const turnDiag = lastTurn.ragDiagnostics as Record<string, unknown>;
      expect(turnDiag.searchedKbCount).toBe(2);
      expect((turnDiag.queriesUsed as string[]).sort()).toEqual([
        'alpha',
        'beta',
      ]);
    });

    it('emits turnDebug with empty ragSources when LLM does not call KB', async () => {
      // small-talk 턴은 KB tool 을 호출하지 않으므로 turnDebug.ragSources = []
      // 가 되어야 한다 (전체 누적과 무관하게 turn delta 만 분리 노출).
      const state = {
        llmConfigId: 'config-1',
        model: 'gpt-4o',
        knowledgeBases: ['kb-1'],
        ragTopK: 5,
        ragThreshold: 0.7,
        maxToolCalls: 10,
        maxTurns: 20,
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
        ],
        turnCount: 1,
        totalInputTokens: 100,
        totalOutputTokens: 50,
        toolCalls: 0,
        ragSources: [{ chunkId: 'c-prev', score: 0.7 }],
        workspaceId: 'ws-1',
      };

      mockLlmService.chat.mockResolvedValue({
        content: 'Sure thing.',
        usage: { inputTokens: 30, outputTokens: 10, totalTokens: 40 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });

      const result = await handler.processMultiTurnMessage(
        'Just chatting',
        state,
      );

      const newState = (result as Record<string, unknown>)
        ._resumeState as Record<string, unknown>;
      // 노드 누적은 직전 턴의 c-prev 가 그대로 보존된다.
      expect((newState.ragSources as unknown[]).length).toBe(1);
      const history = newState.turnDebugHistory as Array<
        Record<string, unknown>
      >;
      const lastTurn = history[history.length - 1];
      expect(lastTurn.ragSources).toEqual([]);
      const turnDiag = lastTurn.ragDiagnostics as Record<string, unknown>;
      expect(turnDiag.attempted).toBe(false);
    });
  });

  // spec/4-nodes/3-ai/1-ai-agent.md §6.2 step 2.c / step 2.c.bypass — form
  // bypass 분기. processMultiTurnMessage 가 받는 `options.source` 가
  // dispatch (waitForAiConversation) 의 'form_submitted' vs 'ai_message' 신호를
  // 결정적으로 전달.
  describe('render_form blocking — form bypass dispatch', () => {
    // conversationThreadService mock — form_submitted 분기의 appendPresentationInteraction
    // 호출 검증에 필요 (spec §6.2 step 2.c: presentation_user push + data.via: 'ai_render').
    // appendAiUserMessage / appendAiAssistantMessage 도 포함 — LLM 응답 후 turn push 에 사용.
    let mockConversationThreadService: {
      appendPresentationInteraction: jest.Mock;
      appendAiUserMessage: jest.Mock;
      appendAiAssistantMessage: jest.Mock;
      appendAiToolResult: jest.Mock;
      getThreadExcludingNode: jest.Mock;
    };
    let handlerWithThread: AiAgentHandler;

    beforeEach(() => {
      mockConversationThreadService = {
        appendPresentationInteraction: jest.fn(),
        appendAiUserMessage: jest.fn(),
        appendAiAssistantMessage: jest.fn(),
        appendAiToolResult: jest.fn(),
        getThreadExcludingNode: jest.fn().mockReturnValue({ turns: [] }),
      };
      handlerWithThread = new AiAgentHandler(
        mockLlmService as never,
        [kbProvider],
        mockWebsocketService as never,
        mockConversationThreadService as never,
      );
    });

    const mockConversationThreadRef = {
      turns: [],
      nextSeq: 0,
      totalChars: 0,
    };

    const baseState = () => ({
      llmConfigId: 'config-1',
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 2048,
      knowledgeBases: [],
      ragTopK: 5,
      ragThreshold: 0.7,
      maxToolCalls: 10,
      maxTurns: 10,
      messages: [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: '계정 만들어줘' },
        {
          role: 'assistant',
          content: '',
          toolCalls: [
            { id: 'call_form_1', name: 'render_form', arguments: '{}' },
          ],
        },
        // pending tool_result stub — bypass 분기에서 cancelled 로 swap 대상
        {
          role: 'tool',
          toolCallId: 'call_form_1',
          content: '{"pending":true}',
        },
      ],
      turnCount: 1,
      totalInputTokens: 100,
      totalOutputTokens: 50,
      toolCalls: 1,
      ragSources: [],
      workspaceId: 'ws-1',
      pendingFormToolCall: {
        toolCallId: 'call_form_1',
        formConfig: { title: '계정 만들기', fields: [] },
      },
      // conversationThreadRef 를 포함해야 threadHolderFromState 가 Some 반환
      conversationThreadRef: mockConversationThreadRef,
    });

    it("source: 'form_submitted' + pendingFormToolCall set → tool_result splice + presentation_user thread push + pendingFormToolCall 클리어", async () => {
      const state = baseState();
      mockLlmService.chat.mockResolvedValue({
        content: '계정이 생성됐어요.',
        usage: { inputTokens: 80, outputTokens: 20, totalTokens: 100 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });

      const result = await handlerWithThread.processMultiTurnMessage(
        JSON.stringify({ email: 'a@b.c', name: 'Alice' }),
        state,
        { source: 'form_submitted' },
      );

      // LLM 호출 시 messages 의 form tool_result 가 form_submitted content 로 swap
      const callArgs = mockLlmService.chat.mock.calls.at(-1)?.[1] as {
        messages: Array<{
          role: string;
          toolCallId?: string;
          content?: string;
        }>;
      };
      const toolResultMsg = callArgs.messages.find(
        (m) => m.role === 'tool' && m.toolCallId === 'call_form_1',
      );
      expect(toolResultMsg).toBeDefined();
      const parsed = JSON.parse(toolResultMsg!.content as string) as {
        ok?: boolean;
        type: string;
        data: Record<string, unknown>;
        message?: string;
      };
      expect(parsed.type).toBe('form_submitted');
      expect(parsed.data.email).toBe('a@b.c');
      expect(parsed.data.name).toBe('Alice');
      // spec §12.6 — LLM 재호출 가드 필드 (`ok:true` + `message`) 보강.
      // 동일 form 재호출 회귀 차단 (2026-05-24 회귀, PR #299).
      expect(parsed.ok).toBe(true);
      expect(parsed.message).toEqual(FORM_SUBMITTED_GUIDANCE_MESSAGE);

      // spec §6.2 step 2.c — appendPresentationInteraction 호출 검증
      // (presentation_user thread push + data.via: 'ai_render' sentinel).
      expect(
        mockConversationThreadService.appendPresentationInteraction,
      ).toHaveBeenCalledTimes(1);
      const appendCall = mockConversationThreadService
        .appendPresentationInteraction.mock.calls[0][1] as {
        node: unknown;
        interaction: {
          type: string;
          data: Record<string, unknown>;
          receivedAt: string;
        };
      };
      expect(appendCall.interaction.type).toBe('form_submitted');
      // data.via: 'ai_render' sentinel — 그래프 form 노드 출처와 구분
      expect(appendCall.interaction.data.via).toBe('ai_render');
      expect(appendCall.interaction.data.email).toBe('a@b.c');

      // pendingFormToolCall 클리어
      const newState = (result as Record<string, unknown>)
        ._resumeState as Record<string, unknown>;
      expect(newState.pendingFormToolCall).toBeUndefined();
    });

    it("source: 'ai_message' + pendingFormToolCall set → cancelled tool_result + pendingFormToolCall 클리어 + 정상 ai_user push", async () => {
      const state = baseState();
      mockLlmService.chat.mockResolvedValue({
        content: '폼 대신 다른 도움 요청을 받았어요. 무엇을 도와드릴까요?',
        usage: { inputTokens: 80, outputTokens: 20, totalTokens: 100 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });

      const result = await handler.processMultiTurnMessage(
        '잠깐, 다시 생각해볼게',
        state,
        { source: 'ai_message' },
      );

      const callArgs = mockLlmService.chat.mock.calls.at(-1)?.[1] as {
        messages: Array<{
          role: string;
          toolCallId?: string;
          content?: string;
        }>;
      };
      // cancelled tool_result 검증
      const toolResultMsg = callArgs.messages.find(
        (m) => m.role === 'tool' && m.toolCallId === 'call_form_1',
      );
      expect(toolResultMsg).toBeDefined();
      const parsed = JSON.parse(toolResultMsg!.content as string) as {
        type: string;
        reason: string;
      };
      expect(parsed.type).toBe('cancelled');
      expect(parsed.reason).toBe('user_sent_message_instead');

      // ai_user 정상 push (cancelled tool_result 뒤에 user 메시지)
      const userMsg = callArgs.messages.find(
        (m) => m.role === 'user' && m.content === '잠깐, 다시 생각해볼게',
      );
      expect(userMsg).toBeDefined();

      // pendingFormToolCall 클리어
      const newState = (result as Record<string, unknown>)
        ._resumeState as Record<string, unknown>;
      expect(newState.pendingFormToolCall).toBeUndefined();
    });

    it("source: 'ai_message' + pendingFormToolCall 없음 → 정상 ai_user push (cancelled tool_result 없음)", async () => {
      const state = baseState();
      delete (state as Partial<typeof state>).pendingFormToolCall;
      // form tool_result stub 도 함께 제거 (pre-condition: 정상 대화 상태)
      state.messages = state.messages.filter(
        (m) => !(m.role === 'tool' && m.toolCallId === 'call_form_1'),
      );

      mockLlmService.chat.mockResolvedValue({
        content: '안녕하세요!',
        usage: { inputTokens: 30, outputTokens: 10, totalTokens: 40 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });

      await handler.processMultiTurnMessage('안녕', state, {
        source: 'ai_message',
      });

      const callArgs = mockLlmService.chat.mock.calls.at(-1)?.[1] as {
        messages: Array<{ role: string; content?: string }>;
      };
      // cancelled tool_result 가 추가되지 않음
      const toolResultMsg = callArgs.messages.find((m) => m.role === 'tool');
      expect(
        toolResultMsg &&
          JSON.parse(toolResultMsg.content as string).type === 'cancelled',
      ).toBeFalsy();
      // user 메시지는 정상 push
      const userMsg = callArgs.messages.find(
        (m) => m.role === 'user' && m.content === '안녕',
      );
      expect(userMsg).toBeDefined();
    });

    it("source: 'ai_message' + pendingFormToolCall set + stub 없음 → cancelled push (stubIndex < 0 fallback)", async () => {
      // stub 이 없는 상태 (messages 에 tool role 없음) 에서 bypass 분기가
      // messages.push(cancelledToolResult) fallback 으로 처리되는지 검증.
      const state = baseState();
      // pending tool_result stub 만 제거 — pendingFormToolCall 은 유지
      state.messages = state.messages.filter(
        (m) => !(m.role === 'tool' && m.toolCallId === 'call_form_1'),
      );

      mockLlmService.chat.mockResolvedValue({
        content: '도와드릴게요.',
        usage: { inputTokens: 30, outputTokens: 10, totalTokens: 40 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });

      await handlerWithThread.processMultiTurnMessage('잠깐만요', state, {
        source: 'ai_message',
      });

      const callArgs = mockLlmService.chat.mock.calls.at(-1)?.[1] as {
        messages: Array<{
          role: string;
          toolCallId?: string;
          content?: string;
        }>;
      };
      // stub 이 없었으므로 cancelled tool_result 가 push 로 추가돼야 한다
      const toolResultMsg = callArgs.messages.find(
        (m) => m.role === 'tool' && m.toolCallId === 'call_form_1',
      );
      expect(toolResultMsg).toBeDefined();
      const parsed = JSON.parse(toolResultMsg!.content as string) as {
        type: string;
      };
      expect(parsed.type).toBe('cancelled');
    });

    it("source: 'form_submitted' + pendingFormToolCall set + stub 없음 → form_submitted push (stubIndex < 0 fallback)", async () => {
      // form_submitted 분기에서도 stub 없으면 messages.push 로 처리.
      const state = baseState();
      state.messages = state.messages.filter(
        (m) => !(m.role === 'tool' && m.toolCallId === 'call_form_1'),
      );

      mockLlmService.chat.mockResolvedValue({
        content: '처리됐어요.',
        usage: { inputTokens: 30, outputTokens: 10, totalTokens: 40 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });

      await handlerWithThread.processMultiTurnMessage(
        JSON.stringify({ field: 'value' }),
        state,
        { source: 'form_submitted' },
      );

      const callArgs = mockLlmService.chat.mock.calls.at(-1)?.[1] as {
        messages: Array<{
          role: string;
          toolCallId?: string;
          content?: string;
        }>;
      };
      const toolResultMsg = callArgs.messages.find(
        (m) => m.role === 'tool' && m.toolCallId === 'call_form_1',
      );
      expect(toolResultMsg).toBeDefined();
      const parsed = JSON.parse(toolResultMsg!.content as string) as {
        ok?: boolean;
        type: string;
        data: Record<string, unknown>;
        message?: string;
      };
      expect(parsed.type).toBe('form_submitted');
      expect(parsed.data.field).toBe('value');
      // spec §12.6 — fallback 경로에서도 가드 필드 보강이 동일 적용된다.
      expect(parsed.ok).toBe(true);
      expect(parsed.message).toEqual(FORM_SUBMITTED_GUIDANCE_MESSAGE);
    });

    it("source: 'form_submitted' + plain text userMessage → __raw__ fallback 경로에서도 가드 필드 유지", async () => {
      // JSON 이 아닌 순수 텍스트를 userMessage 로 전달 — try/catch __raw__ 분기.
      // spec §12.6: __raw__ 경로에서도 ok:true + message 가드 필드가 LLM 에게
      // 전달되어야 한다 (회귀 차단).
      const state = baseState();

      mockLlmService.chat.mockResolvedValue({
        content: '알겠어요.',
        usage: { inputTokens: 30, outputTokens: 10, totalTokens: 40 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });

      await handlerWithThread.processMultiTurnMessage('plain text', state, {
        source: 'form_submitted',
      });

      const callArgs = mockLlmService.chat.mock.calls.at(-1)?.[1] as {
        messages: Array<{
          role: string;
          toolCallId?: string;
          content?: string;
        }>;
      };
      const toolResultMsg = callArgs.messages.find(
        (m) => m.role === 'tool' && m.toolCallId === 'call_form_1',
      );
      expect(toolResultMsg).toBeDefined();
      const parsed = JSON.parse(toolResultMsg!.content as string) as {
        ok?: boolean;
        type: string;
        data: Record<string, unknown>;
        message?: string;
      };
      // __raw__ 분기 검증
      expect(parsed.ok).toBe(true);
      expect(parsed.data.__raw__).toBe('plain text');
      expect(parsed.message).toEqual(FORM_SUBMITTED_GUIDANCE_MESSAGE);
    });

    // spec/4-nodes/3-ai/1-ai-agent.md §12.7 — formData 10KB cap. cap 미만은
    // unchanged, 초과는 string 필드만 균등 truncate + formDataTruncation 메타
    // 부착. 다른 type 필드 (number/boolean/array/object) 는 보존.
    describe('formData 크기 cap (spec §12.7)', () => {
      it('cap 미만 formData → unchanged, formDataTruncation 없음', async () => {
        const state = baseState();
        mockLlmService.chat.mockResolvedValue({
          content: 'ok',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });
        await handlerWithThread.processMultiTurnMessage(
          JSON.stringify({ email: 'a@b.c', name: 'Alice' }),
          state,
          { source: 'form_submitted' },
        );
        const callArgs = mockLlmService.chat.mock.calls.at(-1)?.[1] as {
          messages: Array<{
            role: string;
            toolCallId?: string;
            content?: string;
          }>;
        };
        const toolResultMsg = callArgs.messages.find(
          (m) => m.role === 'tool' && m.toolCallId === 'call_form_1',
        );
        const parsed = JSON.parse(toolResultMsg!.content as string) as {
          data: Record<string, unknown>;
          formDataTruncation?: unknown;
        };
        expect(parsed.data.email).toBe('a@b.c');
        expect(parsed.data.name).toBe('Alice');
        expect(parsed.formDataTruncation).toBeUndefined();
      });

      it('cap 초과 formData → string 필드 truncate + formDataTruncation 메타 부착', async () => {
        // 단일 필드를 cap 의 1.5배 길이로 — 균등 truncate 후 cap 이하로 떨어져야 함.
        const longText = 'A'.repeat(Math.floor(FORM_SUBMITTED_MAX_BYTES * 1.5));
        const state = baseState();
        mockLlmService.chat.mockResolvedValue({
          content: 'ok',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });
        await handlerWithThread.processMultiTurnMessage(
          JSON.stringify({ content: longText, subject: 'short' }),
          state,
          { source: 'form_submitted' },
        );
        const callArgs = mockLlmService.chat.mock.calls.at(-1)?.[1] as {
          messages: Array<{
            role: string;
            toolCallId?: string;
            content?: string;
          }>;
        };
        const toolResultMsg = callArgs.messages.find(
          (m) => m.role === 'tool' && m.toolCallId === 'call_form_1',
        );
        const parsed = JSON.parse(toolResultMsg!.content as string) as {
          data: Record<string, unknown>;
          formDataTruncation?: {
            originalBytes: number;
            bytesAfterCap: number;
            truncatedFields: string[];
          };
        };
        // string 필드는 truncate 됐고 마커 부착. 필드명/구조 보존.
        expect(typeof parsed.data.content).toBe('string');
        expect((parsed.data.content as string).length).toBeLessThan(
          longText.length,
        );
        expect(parsed.data.content as string).toMatch(/<truncated>/);
        // 짧은 string 필드 (subject) 는 그대로.
        expect(parsed.data.subject).toBe('short');
        // formDataTruncation 메타 검증.
        expect(parsed.formDataTruncation).toBeDefined();
        expect(parsed.formDataTruncation!.originalBytes).toBeGreaterThan(
          FORM_SUBMITTED_MAX_BYTES,
        );
        expect(parsed.formDataTruncation!.bytesAfterCap).toBeLessThanOrEqual(
          FORM_SUBMITTED_MAX_BYTES,
        );
        expect(parsed.formDataTruncation!.truncatedFields).toContain('content');
        expect(parsed.formDataTruncation!.truncatedFields).not.toContain(
          'subject',
        );
      });

      it('비-string 필드 (number/boolean/array/object) 는 truncate 대상 외 — 그대로 보존', async () => {
        const longText = 'B'.repeat(Math.floor(FORM_SUBMITTED_MAX_BYTES * 1.5));
        const state = baseState();
        mockLlmService.chat.mockResolvedValue({
          content: 'ok',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });
        await handlerWithThread.processMultiTurnMessage(
          JSON.stringify({
            note: longText, // 거대 string — truncate 대상
            count: 42, // number — 보존
            agree: true, // boolean — 보존
            tags: ['a', 'b'], // array — 보존
            meta: { k: 1 }, // object — 보존
          }),
          state,
          { source: 'form_submitted' },
        );
        const callArgs = mockLlmService.chat.mock.calls.at(-1)?.[1] as {
          messages: Array<{
            role: string;
            toolCallId?: string;
            content?: string;
          }>;
        };
        const toolResultMsg = callArgs.messages.find(
          (m) => m.role === 'tool' && m.toolCallId === 'call_form_1',
        );
        const parsed = JSON.parse(toolResultMsg!.content as string) as {
          data: Record<string, unknown>;
          formDataTruncation?: { truncatedFields: string[] };
        };
        expect(parsed.data.count).toBe(42);
        expect(parsed.data.agree).toBe(true);
        expect(parsed.data.tags).toEqual(['a', 'b']);
        expect(parsed.data.meta).toEqual({ k: 1 });
        expect(parsed.formDataTruncation!.truncatedFields).toEqual(['note']);
      });
    });

    it('options 미전달 (구 호출자) + pendingFormToolCall 없음 → 정상 ai_user 경로 (하위 호환)', async () => {
      const state = baseState();
      delete (state as Partial<typeof state>).pendingFormToolCall;
      state.messages = state.messages.filter(
        (m) => !(m.role === 'tool' && m.toolCallId === 'call_form_1'),
      );

      mockLlmService.chat.mockResolvedValue({
        content: '안녕하세요!',
        usage: { inputTokens: 30, outputTokens: 10, totalTokens: 40 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });

      // options 인자 미전달 — handler 가 default 'ai_message' 로 분기해야 한다.
      await handler.processMultiTurnMessage('안녕', state);

      const callArgs = mockLlmService.chat.mock.calls.at(-1)?.[1] as {
        messages: Array<{ role: string; content?: string }>;
      };
      const userMsg = callArgs.messages.find(
        (m) => m.role === 'user' && m.content === '안녕',
      );
      expect(userMsg).toBeDefined();
    });
  });

  describe('single-turn turnDebug ragSources', () => {
    it('emits turnDebug[0] with empty ragSources when LLM responds directly (no KB)', async () => {
      // small-talk 대화: knowledgeBases 가 비어있고 LLM 도 KB tool 을 호출하지
      // 않는 경우 turnDebug[0].ragSources === [], ragDiagnostics.attempted === false
      // 가 되어야 한다 (skipReason='empty_kb_list').
      const result = (await handler.execute(
        {},
        {
          systemPrompt: 'Helper',
          userPrompt: 'Hi!',
        },
        baseContext,
      )) as unknown as Record<string, unknown>;
      const meta = (result.meta ?? {}) as unknown as Record<string, unknown>;
      const turnDebug = meta.turnDebug as Array<Record<string, unknown>>;
      expect(turnDebug).toHaveLength(1);
      expect(turnDebug[0].ragSources).toEqual([]);
      const diag = turnDebug[0].ragDiagnostics as Record<string, unknown>;
      expect(diag.attempted).toBe(false);
      expect(diag.skipReason).toBe('empty_kb_list');
    });

    it('exposes turn-level ragSources in turnDebug[0] for single_turn KB call', async () => {
      mockRagService.search.mockResolvedValue([
        {
          chunkId: 'c1',
          documentId: 'd1',
          documentName: 'refund.md',
          content: '14-day refund window.',
          score: 0.9,
          metadata: {},
        },
      ]);

      mockLlmService.chat
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: 'tc-kb-1',
              name: kbToolName('kb-1'),
              arguments: '{"query":"refund window"}',
            },
          ],
          usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'You have 14 days.',
          usage: { inputTokens: 80, outputTokens: 20, totalTokens: 100 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });

      const result = (await handler.execute(
        {},
        {
          systemPrompt: 'Helper',
          userPrompt: 'When can I request a refund?',
          knowledgeBases: ['kb-1'],
        },
        baseContext,
      )) as unknown as Record<string, unknown>;

      const meta = (result.meta ?? {}) as unknown as Record<string, unknown>;
      const turnDebug = meta.turnDebug as Array<Record<string, unknown>>;
      expect(turnDebug).toHaveLength(1);
      expect(turnDebug[0].turnIndex).toBe(1);
      const sources = turnDebug[0].ragSources as Array<Record<string, unknown>>;
      expect(sources).toHaveLength(1);
      expect(sources[0].chunkId).toBe('c1');
      const diag = turnDebug[0].ragDiagnostics as Record<string, unknown>;
      expect(diag.attempted).toBe(true);
      expect(diag.searchedKbCount).toBe(1);
    });
  });

  describe('buildMultiTurnFinalOutput', () => {
    it('should build correct final output structure', () => {
      const messages = [
        { role: 'system' as const, content: 'System' },
        { role: 'user' as const, content: 'Hi' },
        { role: 'assistant' as const, content: 'Hello!' },
      ];

      const result = handler.buildMultiTurnFinalOutput(
        messages,
        'Hello!',
        3,
        'user_ended',
        {
          model: 'gpt-4o',
          totalInputTokens: 500,
          totalOutputTokens: 200,
          toolCalls: 1,
          ragSources: [],
        },
      );

      const r = result as unknown as Record<string, unknown>;
      const out = r.output as Record<string, unknown>;
      const res = out.result as Record<string, unknown>;
      expect(res.response).toBe('Hello!');
      expect(res.turnCount).toBe(3);
      expect(res.endReason).toBe('user_ended');
      expect(res.messages as unknown[]).toHaveLength(3);

      // Phase 1 (A) — port routes per endReason (no longer hardcoded `out`).
      expect(r.port).toBe('user_ended');
      expect(r.status).toBe('ended');

      const meta = r.meta as Record<string, unknown>;
      expect(meta.model).toBe('gpt-4o');
      expect(meta.inputTokens).toBe(500);
      expect(meta.outputTokens).toBe(200);
      expect(meta.totalTokens).toBe(700);
      expect(meta.toolCalls).toBe(1);
    });

    it('echoes rawConfig (systemPrompt / userPrompt / responseFormat / maxTurns / knowledgeBases / conditions) in output.config', () => {
      const messages = [
        { role: 'system' as const, content: 'System' },
        { role: 'user' as const, content: 'Hi' },
        { role: 'assistant' as const, content: 'Bye' },
      ];
      const rawConfig = {
        mode: 'multi_turn' as const,
        model: '{{ vars.model }}',
        systemPrompt: 'You are {{ vars.persona }}',
        userPrompt: '{{ $input.message }}',
        responseFormat: 'json' as const,
        maxTurns: 12,
        maxToolCalls: 5,
        knowledgeBases: ['kb-1', 'kb-2'],
        conditions: [{ id: 'c1', label: 'Refund', prompt: 'Refund requested' }],
      };
      const result = handler.buildMultiTurnFinalOutput(
        messages,
        'Bye',
        4,
        'user_ended',
        {
          model: 'gpt-4o',
          totalInputTokens: 100,
          totalOutputTokens: 50,
          toolCalls: 0,
          ragSources: [],
        },
        undefined,
        [],
        rawConfig,
      );
      const r = result as unknown as Record<string, unknown>;
      const config = r.config as Record<string, unknown>;
      // raw model template is preserved (not engine-resolved)
      expect(config.model).toBe('{{ vars.model }}');
      expect(config.systemPrompt).toBe('You are {{ vars.persona }}');
      expect(config.userPrompt).toBe('{{ $input.message }}');
      expect(config.responseFormat).toBe('json');
      expect(config.maxTurns).toBe(12);
      expect(config.maxToolCalls).toBe(5);
      expect(config.knowledgeBases).toEqual(['kb-1', 'kb-2']);
      expect(config.conditions).toHaveLength(1);
    });

    it('omits empty knowledgeBases / conditions arrays (symmetric with waiting echo)', () => {
      const result = handler.buildMultiTurnFinalOutput(
        [],
        '',
        1,
        'user_ended',
        {
          model: 'gpt-4o',
          totalInputTokens: 0,
          totalOutputTokens: 0,
          toolCalls: 0,
          ragSources: [],
        },
        undefined,
        [],
        // Empty arrays must not surface — same guard as the initial /
        // resumed waiting tick echoes (`Array.isArray(...) && length > 0`).
        {
          mode: 'multi_turn',
          model: 'gpt-4o',
          knowledgeBases: [],
          conditions: [],
        },
      );
      const config = (result as unknown as Record<string, unknown>)
        .config as Record<string, unknown>;
      expect(config.knowledgeBases).toBeUndefined();
      expect(config.conditions).toBeUndefined();
    });

    it('falls back to fallbackModel when rawConfig is omitted', () => {
      const result = handler.buildMultiTurnFinalOutput(
        [],
        '',
        1,
        'user_ended',
        {
          model: 'gpt-4o',
          totalInputTokens: 0,
          totalOutputTokens: 0,
          toolCalls: 0,
          ragSources: [],
        },
      );
      const r = result as unknown as Record<string, unknown>;
      const config = r.config as Record<string, unknown>;
      expect(config.mode).toBe('multi_turn');
      expect(config.model).toBe('gpt-4o');
      // Optional raw-only fields are absent when rawConfig is missing.
      expect(config.systemPrompt).toBeUndefined();
      expect(config.maxTurns).toBeUndefined();
    });
  });

  // ===== Conditions feature =====

  describe('validate - conditions', () => {
    it('should pass with valid conditions', () => {
      const result = handler.validate({
        systemPrompt: 'You are helpful',
        model: 'gpt-4',
        conditions: [
          {
            id: 'cond-uuid-1',
            label: 'Refund',
            prompt: 'Customer wants a refund',
          },
        ],
      });
      expect(result.valid).toBe(true);
    });

    it('should fail when condition is missing label', () => {
      const result = handler.validate({
        systemPrompt: 'You are helpful',
        model: 'gpt-4',
        conditions: [
          { id: 'cond-uuid-1', label: '', prompt: 'Customer wants a refund' },
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('label');
    });

    it('should fail when condition is missing prompt', () => {
      const result = handler.validate({
        systemPrompt: 'You are helpful',
        model: 'gpt-4',
        conditions: [{ id: 'cond-uuid-1', label: 'Refund', prompt: '' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('prompt');
    });

    it('should fail when condition is missing id', () => {
      const result = handler.validate({
        systemPrompt: 'You are helpful',
        model: 'gpt-4',
        conditions: [
          { id: '', label: 'Refund', prompt: 'Customer wants a refund' },
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('id');
    });

    it('should fail when condition id conflicts with reserved port name', () => {
      const result = handler.validate({
        systemPrompt: 'You are helpful',
        model: 'gpt-4',
        conditions: [{ id: 'out', label: 'Conflict', prompt: 'test' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('reserved');
    });

    it('should fail when prompt exceeds 2000 characters', () => {
      const result = handler.validate({
        systemPrompt: 'You are helpful',
        model: 'gpt-4',
        conditions: [{ id: 'cond-1', label: 'Long', prompt: 'a'.repeat(2001) }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('2000');
    });

    it('should fail when more than 20 conditions', () => {
      const conditions = Array.from({ length: 21 }, (_, i) => ({
        id: `cond-${i}`,
        label: `C${i}`,
        prompt: `Condition ${i}`,
      }));
      const result = handler.validate({
        systemPrompt: 'You are helpful',
        model: 'gpt-4',
        conditions,
      });
      expect(result.valid).toBe(false);
      // Schema warningRule "Conditions are limited to 20 entries." fires.
      expect(result.errors.some((e) => e.includes('20'))).toBe(true);
    });
  });

  describe('buildTools - tool naming', () => {
    it('should use cond_ prefix for condition tools', async () => {
      await handler.execute(
        {},
        {
          userPrompt: 'Hello',
          systemPrompt: 'Be helpful',
          conditions: [
            { id: 'abc-123', label: 'Test', prompt: 'Test condition' },
          ],
        },
        baseContext,
      );
      const chatCall = mockLlmService.chat.mock.calls[0];
      const tools = chatCall[1].tools;
      const condTool = tools.find(
        (t: { name: string }) => t.name === 'cond_abc_123',
      );
      expect(condTool).toBeDefined();
      expect(condTool.description).toBe('Test condition');
    });
  });

  // 스키마 .passthrough() 호환성 가드 — 도구 연결 두 필드는 스키마에서 제거됐지만
  // DB 의 legacy workflow 데이터에는 여전히 toolNodeIds/toolOverrides 가 남아 있을
  // 수 있다. 핸들러는 이를 읽지 않고 일반 도구(`tool_*`)를 LLM 에 등록하지 않는다.
  // 도구 연결 입력 경로 재작성 시 새 필드 기준으로 본 블록 갱신 또는 제거.
  describe('legacy passthrough: tool connection inputs', () => {
    it('ignores legacy toolNodeIds in config (no normal tools registered to LLM)', async () => {
      await handler.execute(
        {},
        {
          userPrompt: 'Hello',
          toolNodeIds: ['abc12345-full-node-id'],
        },
        baseContext,
      );
      const tools =
        (
          mockLlmService.chat.mock.calls[0][1] as {
            tools?: Array<{ name: string }>;
          }
        ).tools ?? [];
      expect(tools.find((t) => t.name.startsWith('tool_'))).toBeUndefined();
    });

    it('ignores legacy toolOverrides in config', async () => {
      await handler.execute(
        {},
        {
          userPrompt: 'Hello',
          toolNodeIds: ['abc12345-full-node-id'],
          toolOverrides: [
            {
              nodeId: 'abc12345-full-node-id',
              toolName: 'custom_name',
              toolDescription: 'custom desc',
            },
          ],
        },
        baseContext,
      );
      const tools =
        (
          mockLlmService.chat.mock.calls[0][1] as {
            tools?: Array<{ name: string }>;
          }
        ).tools ?? [];
      expect(tools.find((t) => t.name === 'custom_name')).toBeUndefined();
    });

    it('preserves condition tools alongside legacy passthrough (regression check)', async () => {
      await handler.execute(
        {},
        {
          userPrompt: 'Hello',
          systemPrompt: 'Be helpful',
          toolNodeIds: ['abc12345-full-node-id'],
          conditions: [
            { id: 'cond-x', label: 'Test', prompt: 'Test condition' },
          ],
        },
        baseContext,
      );
      const tools =
        (
          mockLlmService.chat.mock.calls[0][1] as {
            tools?: Array<{ name: string }>;
          }
        ).tools ?? [];
      expect(tools.find((t) => t.name === 'cond_cond_x')).toBeDefined();
      expect(tools.find((t) => t.name.startsWith('tool_'))).toBeUndefined();
    });
  });

  describe('conditions - single_turn', () => {
    const conditionConfig = {
      userPrompt: 'I want a refund',
      systemPrompt: 'You are a support agent',
      conditions: [
        {
          id: 'a1b2c3d4-refund',
          label: 'Refund',
          prompt: 'Customer requests a refund',
        },
        {
          id: 'e5f6g7h8-escalate',
          label: 'Escalation',
          prompt: 'Issue needs expert help',
        },
      ],
    };

    it('should register condition tools with condition id as name', async () => {
      await handler.execute({}, conditionConfig, baseContext);

      const chatCall = mockLlmService.chat.mock.calls[0];
      const tools = chatCall[1].tools;
      const condTools = tools.filter(
        (t: { name: string }) =>
          t.name === 'cond_a1b2c3d4_refund' ||
          t.name === 'cond_e5f6g7h8_escalate',
      );
      expect(condTools).toHaveLength(2);
      expect(condTools[0].description).toBe('Customer requests a refund');
      expect(condTools[1].description).toBe('Issue needs expert help');
    });

    it('should inject condition instructions into system prompt', async () => {
      await handler.execute({}, conditionConfig, baseContext);

      const chatCall = mockLlmService.chat.mock.calls[0];
      const messages = chatCall[1].messages;
      const systemMsg = messages.find(
        (m: { role: string }) => m.role === 'system',
      );
      expect(systemMsg.content).toContain('조건');
    });

    it('should route to condition port when LLM calls only condition tool', async () => {
      mockLlmService.chat.mockResolvedValueOnce({
        content: 'I will process your refund.',
        toolCalls: [
          {
            id: 'tc-1',
            name: 'cond_a1b2c3d4_refund',
            arguments: '{"reason":"Customer explicitly asked for refund"}',
          },
        ],
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        model: 'gpt-4o',
        finishReason: 'tool_calls',
      });

      const result = (await handler.execute(
        {},
        conditionConfig,
        baseContext,
      )) as unknown as Record<string, unknown>;

      expect(result.port).toBe('a1b2c3d4-refund');
      expect(result.status).toBe('ended');
      // Stage 5: condition-triggered output follows unified shape:
      // { output: { result: { ..., condition:{id,label,reason} } }, meta, port, status }
      const out = result.output as Record<string, unknown>;
      const res = out.result as Record<string, unknown>;
      expect(res.condition).toBeDefined();
      const condition = res.condition as Record<string, unknown>;
      expect(condition.id).toBe('a1b2c3d4-refund');
      expect(condition.label).toBe('Refund');
    });

    it('echoes raw conditions / systemPrompt in condition-triggered output.config', async () => {
      mockLlmService.chat.mockResolvedValueOnce({
        content: 'Routing to refund.',
        toolCalls: [
          {
            id: 'tc-1',
            name: 'cond_a1b2c3d4_refund',
            arguments: '{"reason":"explicit"}',
          },
        ],
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        model: 'gpt-4o',
        finishReason: 'tool_calls',
      });

      // CONVENTIONS Principle 7 — when context.rawConfig carries the raw
      // user-authored values (including templates), the condition-triggered
      // output.config must echo them, not the engine-resolved snapshot.
      const rawConditionConfig = {
        ...conditionConfig,
        systemPrompt: 'You are {{ vars.persona }}',
      };
      const ctxWithRaw = {
        ...baseContext,
        rawConfig: rawConditionConfig,
      };

      const result = (await handler.execute(
        {},
        // engine-resolved per-call config (templates already replaced)
        { ...conditionConfig, systemPrompt: 'You are Refund Bot' },
        ctxWithRaw,
      )) as unknown as Record<string, unknown>;

      const config = result.config as Record<string, unknown>;
      expect(config.systemPrompt).toBe('You are {{ vars.persona }}');
      expect(config.conditions).toEqual(rawConditionConfig.conditions);
    });

    it('should select first-defined condition when multiple conditions are called', async () => {
      mockLlmService.chat.mockResolvedValueOnce({
        content: 'Multiple conditions detected.',
        toolCalls: [
          { id: 'tc-1', name: 'cond_e5f6g7h8_escalate', arguments: '{}' },
          { id: 'tc-2', name: 'cond_a1b2c3d4_refund', arguments: '{}' },
        ],
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        model: 'gpt-4o',
        finishReason: 'tool_calls',
      });

      const result = (await handler.execute(
        {},
        conditionConfig,
        baseContext,
      )) as unknown as Record<string, unknown>;

      // a1b2c3d4-refund is first in conditions array (index 0)
      expect(result.port).toBe('a1b2c3d4-refund');
    });

    it('should return normal output via out port when no condition is triggered', async () => {
      const result = (await handler.execute(
        {},
        conditionConfig,
        baseContext,
      )) as unknown as Record<string, unknown>;

      // Default mock returns no toolCalls, so should go to the normal
      // `out` port (single-turn unified shape).
      expect(result.port).toBe('out');
      const out = result.output as Record<string, unknown>;
      const res = out.result as Record<string, unknown>;
      expect(res.response).toBe('Hello! I am an AI assistant.');
    });
  });

  describe('conditions - multi_turn', () => {
    it('should route to condition port when condition triggered during processMultiTurnMessage', async () => {
      const state = {
        llmConfigId: 'config-1',
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 2048,
        knowledgeBases: [],
        ragTopK: 5,
        ragThreshold: 0.7,
        maxToolCalls: 10,
        maxTurns: 10,
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
        ],
        turnCount: 1,
        totalInputTokens: 100,
        totalOutputTokens: 50,
        toolCalls: 0,
        ragSources: [],
        workspaceId: 'ws-1',
        conditions: [
          {
            id: 'a1b2c3d4-refund',
            label: 'Refund',
            prompt: 'Customer wants refund',
          },
        ],
      };

      mockLlmService.chat.mockResolvedValue({
        content: 'I will process your refund.',
        toolCalls: [
          {
            id: 'tc-1',
            name: 'cond_a1b2c3d4_refund',
            arguments: '{"reason":"refund request"}',
          },
        ],
        usage: { inputTokens: 150, outputTokens: 30, totalTokens: 180 },
        model: 'gpt-4o',
        finishReason: 'tool_calls',
      });

      const result = (await handler.processMultiTurnMessage(
        'I want a refund please',
        state,
      )) as Record<string, unknown>;

      expect(result.port).toBe('a1b2c3d4-refund');
      expect(result.status).toBe('ended');
      const out = result.output as Record<string, unknown>;
      const res = out.result as Record<string, unknown>;
      expect(res.endReason).toBe('condition');
      expect(res.condition).toBeDefined();
    });

    it('should pass conditions to multiTurnState from execute', async () => {
      const result = (await handler.execute(
        {},
        {
          mode: 'multi_turn',
          systemPrompt: 'You are helpful',
          userPrompt: 'Hello',
          conditions: [
            { id: 'cond-1', label: 'Cond1', prompt: 'Test condition' },
          ],
        },
        baseContext,
      )) as unknown as Record<string, unknown>;

      const state = result._resumeState as Record<string, unknown>;
      expect(state.conditions).toBeDefined();
      expect(state.conditions).toHaveLength(1);
    });
  });

  describe('endMultiTurnConversation', () => {
    it('routes user_ended through buildMultiTurnFinalOutput to the user_ended port', () => {
      // Engine entry point used when the user clicks "End conversation"
      // (`execution.end_conversation`). Per spec §3.2 + §7.7 this must
      // emit `port:'user_ended'`, NOT the legacy hardcoded `out`.
      const state = {
        messages: [
          { role: 'system', content: 'sys' },
          { role: 'user', content: 'hi' },
          { role: 'assistant', content: 'last response' },
        ],
        turnCount: 3,
        model: 'gpt-4o',
        totalInputTokens: 100,
        totalOutputTokens: 50,
        totalThinkingTokens: 0,
        toolCalls: 0,
        ragSources: [],
        ragLastDiagnostics: undefined,
        turnDebugHistory: [],
        rawConfig: {
          mode: 'multi_turn',
          model: '{{ vars.model }}',
          systemPrompt: 'You are {{ vars.persona }}',
          maxTurns: 12,
        },
      };
      const result = handler.endMultiTurnConversation(state, 'user_ended');
      const r = result as Record<string, unknown>;
      expect(r.port).toBe('user_ended');
      expect(r.status).toBe('ended');
      const res = (r.output as Record<string, unknown>).result as Record<
        string,
        unknown
      >;
      expect(res.endReason).toBe('user_ended');
      expect(res.response).toBe('last response');
      expect(res.turnCount).toBe(3);
      // raw config echo (Phase 1 D — model template preserved)
      const config = r.config as Record<string, unknown>;
      expect(config.model).toBe('{{ vars.model }}');
      expect(config.systemPrompt).toBe('You are {{ vars.persona }}');
      expect(config.maxTurns).toBe(12);
    });
  });

  describe('buildMultiTurnFinalOutput with port', () => {
    // Phase 1 (A) — multi-turn termination routes to per-reason ports
    // (`user_ended` / `max_turns` / `error`) instead of the legacy `out`
    // hardcode. `condition` matching uses `buildConditionOutput` which
    // sets `port` to the dynamic `{condition.id}` value; if `condition`
    // ever reaches this builder it falls back defensively to `error`.
    it('routes user_ended endReason to the user_ended port', () => {
      const result = handler.buildMultiTurnFinalOutput(
        [],
        '',
        1,
        'user_ended',
        {
          model: 'gpt-4o',
          totalInputTokens: 0,
          totalOutputTokens: 0,
          toolCalls: 0,
          ragSources: [],
        },
      );
      const r = result as unknown as Record<string, unknown>;
      expect(r.port).toBe('user_ended');
      expect(r.status).toBe('ended');
      const res = (r.output as Record<string, unknown>).result as Record<
        string,
        unknown
      >;
      expect(res.endReason).toBe('user_ended');
    });

    it('routes max_turns endReason to the max_turns port', () => {
      const result = handler.buildMultiTurnFinalOutput([], '', 1, 'max_turns', {
        model: 'gpt-4o',
        totalInputTokens: 0,
        totalOutputTokens: 0,
        toolCalls: 0,
        ragSources: [],
      });
      const r = result as unknown as Record<string, unknown>;
      expect(r.port).toBe('max_turns');
      expect(r.status).toBe('ended');
      const res = (r.output as Record<string, unknown>).result as Record<
        string,
        unknown
      >;
      expect(res.endReason).toBe('max_turns');
    });

    it('routes error endReason to the error port', () => {
      const result = handler.buildMultiTurnFinalOutput([], '', 1, 'error', {
        model: 'gpt-4o',
        totalInputTokens: 0,
        totalOutputTokens: 0,
        toolCalls: 0,
        ragSources: [],
      });
      const r = result as unknown as Record<string, unknown>;
      expect(r.port).toBe('error');
      expect(r.status).toBe('ended');
      const res = (r.output as Record<string, unknown>).result as Record<
        string,
        unknown
      >;
      expect(res.endReason).toBe('error');
    });

    it('falls back to error port if condition leaks into buildMultiTurnFinalOutput', () => {
      // Defensive: condition matching should always go through
      // buildConditionOutput which routes to the dynamic {condition.id}
      // port. If a future engine path mistakenly forwards 'condition'
      // here, surface it as `error` rather than a silent mis-route to
      // a non-existent port.
      const result = handler.buildMultiTurnFinalOutput([], '', 1, 'condition', {
        model: 'gpt-4o',
        totalInputTokens: 0,
        totalOutputTokens: 0,
        toolCalls: 0,
        ragSources: [],
      });
      const r = result as unknown as Record<string, unknown>;
      expect(r.port).toBe('error');
      const res = (r.output as Record<string, unknown>).result as Record<
        string,
        unknown
      >;
      expect(res.endReason).toBe('condition');
    });

    it('attaches output.error when errorPayload is provided with endReason=error (spec §7.9)', () => {
      // spec/4-nodes/3-ai/1-ai-agent.md §7.9 — multi-turn LLM 오류 종결 shape:
      // `output.error.{code, message, details}` + 부분 `output.result.*` 가
      // 병존한다. Engine 의 `handleAiTurnError` 가 LLM throw 의 sanitized
      // 결과를 본 빌더로 전달해야 한다. 본 테스트는 빌더가 단일 책임으로
      // 두 필드를 동시에 set 한다는 것을 보장한다.
      const result = handler.buildMultiTurnFinalOutput(
        [
          { role: 'user', content: 'hi' },
          { role: 'assistant', content: 'partial response' },
        ],
        'partial response',
        2,
        'error',
        {
          model: 'gpt-4o',
          totalInputTokens: 120,
          totalOutputTokens: 30,
          toolCalls: 1,
          ragSources: [],
        },
        undefined,
        undefined,
        undefined,
        {
          code: 'LLM_RATE_LIMIT',
          message: 'Anthropic API returned 429 (Too Many Requests)',
          details: { provider: 'anthropic', statusCode: 429 },
        },
      );
      const r = result as unknown as Record<string, unknown>;
      expect(r.port).toBe('error');
      expect(r.status).toBe('ended');
      const output = r.output as Record<string, unknown>;
      const err = output.error as Record<string, unknown>;
      expect(err.code).toBe('LLM_RATE_LIMIT');
      expect(err.message).toBe(
        'Anthropic API returned 429 (Too Many Requests)',
      );
      const details = err.details as Record<string, unknown>;
      expect(details.statusCode).toBe(429);
      // 부분 결과 보존 — spec §7.9 의 "부분 결과 + output.error 병존" 요건.
      const res = output.result as Record<string, unknown>;
      expect(res.endReason).toBe('error');
      expect(res.turnCount).toBe(2);
      expect(res.response).toBe('partial response');
      expect((res.messages as unknown[]).length).toBe(2);
    });

    it('does not attach output.error when errorPayload is absent (non-error endReason)', () => {
      // 정상 종결 (`user_ended` / `max_turns`) 에는 errorPayload 가 비어야
      // 하며 `output.error` 키가 존재해서는 안 된다. 옛 코드의 회귀 (errorPayload
      // 누락 시 빈 객체라도 output.error 가 set 되는 버그) 방지.
      const result = handler.buildMultiTurnFinalOutput(
        [],
        '',
        1,
        'user_ended',
        {
          model: 'gpt-4o',
          totalInputTokens: 0,
          totalOutputTokens: 0,
          toolCalls: 0,
          ragSources: [],
        },
      );
      const r = result as unknown as Record<string, unknown>;
      const output = r.output as Record<string, unknown>;
      expect(output.error).toBeUndefined();
    });
  });

  describe('endMultiTurnConversation — error endReason (spec §7.9)', () => {
    it('forwards errorPayload to buildMultiTurnFinalOutput so output.error is populated', () => {
      // Engine 의 `handleAiTurnError` 가 LLM throw 시 본 entry 로 호출하는
      // 경로. errorPayload 가 누락 없이 빌더로 전달되어 spec §7.9 shape 가
      // 만들어지는지 검증.
      const state = {
        messages: [
          { role: 'system', content: 'sys' },
          { role: 'user', content: 'cause 429' },
        ],
        turnCount: 1,
        model: 'gpt-4o',
        totalInputTokens: 50,
        totalOutputTokens: 0,
        totalThinkingTokens: 0,
        toolCalls: 0,
        ragSources: [],
        ragLastDiagnostics: undefined,
        turnDebugHistory: [],
        rawConfig: {
          mode: 'multi_turn',
          model: 'gpt-4o',
          systemPrompt: 'You are helpful',
          maxTurns: 20,
        },
      };
      const result = handler.endMultiTurnConversation(state, 'error', {
        code: 'LLM_RATE_LIMIT',
        message: 'rate limited',
        details: { statusCode: 429 },
      });
      const r = result as Record<string, unknown>;
      expect(r.port).toBe('error');
      expect(r.status).toBe('ended');
      const output = r.output as Record<string, unknown>;
      const err = output.error as Record<string, unknown>;
      expect(err.code).toBe('LLM_RATE_LIMIT');
      expect(err.message).toBe('rate limited');
      const res = output.result as Record<string, unknown>;
      expect(res.endReason).toBe('error');
      expect(res.turnCount).toBe(1);
    });
  });

  describe('tool call telemetry — WS emit + turnDebug.toolCalls', () => {
    function lastTurnDebug(result: unknown) {
      const meta = ((result as Record<string, unknown>).meta ?? {}) as Record<
        string,
        unknown
      >;
      const arr = (meta.turnDebug ?? []) as Array<Record<string, unknown>>;
      return arr[arr.length - 1] ?? {};
    }

    function emittedEvents() {
      return mockWebsocketService.emitExecutionEvent.mock.calls.map((c) => ({
        executionId: c[0],
        type: c[1],
        payload: c[2],
      }));
    }

    it('emits TOOL_CALL_STARTED + TOOL_CALL_COMPLETED around provider.execute', async () => {
      mockRagService.search.mockResolvedValue([
        {
          chunkId: 'c1',
          documentId: 'd1',
          documentName: 'doc',
          content: 'hello',
          score: 0.9,
          metadata: {},
        },
      ]);
      mockLlmService.chat
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: 'tc-1',
              name: kbToolName('kb-1'),
              arguments: '{"query":"hi"}',
            },
          ],
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'final',
          usage: { inputTokens: 20, outputTokens: 5, totalTokens: 25 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });

      await handler.execute(
        {},
        {
          systemPrompt: 'Helper',
          userPrompt: 'hi',
          knowledgeBases: ['kb-1'],
        },
        baseContext,
      );

      const events = emittedEvents();
      const started = events.find(
        (e) => e.type === 'execution.tool_call_started',
      );
      const completed = events.find(
        (e) => e.type === 'execution.tool_call_completed',
      );
      expect(started).toBeDefined();
      expect(started?.payload).toMatchObject({
        toolCallId: 'tc-1',
        name: kbToolName('kb-1'),
        arguments: '{"query":"hi"}',
        turnIndex: 1,
      });
      expect(completed).toBeDefined();
      expect(completed?.payload).toMatchObject({
        toolCallId: 'tc-1',
        status: 'success',
      });
      expect(typeof completed?.payload.durationMs).toBe('number');
    });

    it('records turnDebug.toolCalls with status=success for the executed provider tool', async () => {
      mockRagService.search.mockResolvedValue([
        {
          chunkId: 'c1',
          documentId: 'd1',
          documentName: 'doc',
          content: 'x',
          score: 0.9,
          metadata: {},
        },
      ]);
      mockLlmService.chat
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: 'tc-1',
              name: kbToolName('kb-1'),
              arguments: '{"query":"x"}',
            },
          ],
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'done',
          usage: { inputTokens: 2, outputTokens: 1, totalTokens: 3 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });

      const result = await handler.execute(
        {},
        {
          systemPrompt: 'h',
          userPrompt: 'x',
          knowledgeBases: ['kb-1'],
        },
        baseContext,
      );

      const td = lastTurnDebug(result);
      const tc = (td.toolCalls ?? []) as Array<Record<string, unknown>>;
      expect(tc).toHaveLength(1);
      expect(tc[0]).toMatchObject({
        toolCallId: 'tc-1',
        name: kbToolName('kb-1'),
        status: 'success',
      });
      expect(typeof tc[0].durationMs).toBe('number');
    });

    it('catches provider.execute errors → status=error, LLM gets error content, turn continues', async () => {
      // First LLM response asks for KB; provider then throws; second LLM call
      // should still happen with the error content as a tool message.
      mockRagService.search.mockRejectedValue(new Error('KB DOWN'));
      mockLlmService.chat
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: 'tc-err',
              name: kbToolName('kb-1'),
              arguments: '{"query":"q"}',
            },
          ],
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: '죄송합니다. 검색에 실패했습니다.',
          usage: { inputTokens: 2, outputTokens: 1, totalTokens: 3 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });

      const result = await handler.execute(
        {},
        {
          systemPrompt: 'h',
          userPrompt: 'q',
          knowledgeBases: ['kb-1'],
        },
        baseContext,
      );

      // Second LLM call must happen with a tool message in the messages array
      expect(mockLlmService.chat).toHaveBeenCalledTimes(2);
      const secondCall = mockLlmService.chat.mock.calls[1];
      const messages = secondCall[1].messages as Array<{
        role: string;
        content: string;
        toolCallId?: string;
      }>;
      const toolMsg = messages.find((m) => m.role === 'tool');
      expect(toolMsg).toBeDefined();
      expect(toolMsg?.toolCallId).toBe('tc-err');
      // tool_result content 는 사용자 가시 영역(LLM 응답에 인용 가능)이므로
      // 원시 예외 메시지("KB DOWN") 가 포함되면 안 된다. 고정된 한국어 안내
      // 만 노출되어야 함. 원시 메시지는 turnDebug.toolCalls[].error 와 WS
      // tool_call_completed payload 의 error 필드, logger.warn 에만 보존된다.
      expect(toolMsg?.content).not.toContain('KB DOWN');
      expect(toolMsg?.content).toContain('search_failed');
      const toolBody = JSON.parse(toolMsg!.content) as unknown as {
        message?: string;
      };
      expect(toolBody.message).toMatch(/일시적으로/);

      // turnDebug carries the error
      const td = lastTurnDebug(result);
      const tc = (td.toolCalls ?? []) as Array<Record<string, unknown>>;
      expect(tc[0]).toMatchObject({
        toolCallId: 'tc-err',
        status: 'error',
        error: 'KB DOWN',
      });

      // WS event reports error too
      const completed = emittedEvents().find(
        (e) => e.type === 'execution.tool_call_completed',
      );
      expect(completed?.payload).toMatchObject({
        toolCallId: 'tc-err',
        status: 'error',
        error: 'KB DOWN',
      });

      // Final assistant response is preserved (turn recovered)
      const out = (result as unknown as Record<string, unknown>)
        .output as Record<string, unknown>;
      const res = out.result as Record<string, unknown>;
      expect(res.response).toBe('죄송합니다. 검색에 실패했습니다.');
    });

    it('does nothing for the WS service when websocketService is not provided (BC)', async () => {
      const noWsHandler = new AiAgentHandler(mockLlmService as never, [
        kbProvider,
      ]);
      mockRagService.search.mockResolvedValue([]);
      mockLlmService.chat
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: 'tc-x',
              name: kbToolName('kb-1'),
              arguments: '{"query":"q"}',
            },
          ],
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'ok',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });

      // Should not throw despite missing WS service.
      const result = await noWsHandler.execute(
        {},
        {
          systemPrompt: 'h',
          userPrompt: 'q',
          knowledgeBases: ['kb-1'],
        },
        baseContext,
      );
      const td = lastTurnDebug(result);
      // turnDebug.toolCalls is still recorded.
      const tc = (td.toolCalls ?? []) as Array<Record<string, unknown>>;
      expect(tc).toHaveLength(1);
      expect(tc[0].status).toBe('success');
    });

    it('runs provider tools in parallel on multi-turn resume too', async () => {
      // single-turn 과 동일한 Promise.all 병렬 실행이 multi-turn resume
      // 경로(processMultiTurnMessage) 에서도 동작해야 한다. inFlight 카운터
      // 의 최대값이 2 이상이면 병렬, 1 이면 직렬 회귀.
      let inFlight = 0;
      let maxInFlight = 0;
      mockRagService.search.mockImplementation(async (q: string) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise<void>((resolve) => setTimeout(resolve, 30));
        inFlight--;
        return [
          {
            chunkId: `c-${q}`,
            documentId: 'd1',
            documentName: `doc-${q}`,
            content: `payload for ${q}`,
            score: 0.8,
            metadata: {},
          },
        ];
      });

      mockLlmService.chat
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: 'tc-r1',
              name: kbToolName('kb-1'),
              arguments: '{"query":"alpha"}',
            },
            {
              id: 'tc-r2',
              name: kbToolName('kb-1'),
              arguments: '{"query":"beta"}',
            },
          ],
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'combined',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });

      const resumeState = {
        turnCount: 1,
        maxTurns: 5,
        maxToolCalls: 5,
        knowledgeBases: ['kb-1'],
        workspaceId: 'ws-1',
        conditions: [],
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalThinkingTokens: 0,
        toolCalls: 0,
        ragSources: [],
        ragLastDiagnostics: undefined,
        messages: [
          { role: 'system', content: 'sys' },
          { role: 'user', content: 'turn1' },
          { role: 'assistant', content: 'ack' },
        ],
        executionId: 'exec-1',
        nodeId: 'agent-1',
        nodeExecutionId: 'ne-1',
        workflowId: 'wf-1',
        model: 'gpt-4o',
        llmConfigId: 'config-1',
        turnDebugHistory: [],
      };

      await (
        handler as unknown as {
          processMultiTurnMessage: (
            msg: string,
            state: Record<string, unknown>,
          ) => Promise<unknown>;
        }
      ).processMultiTurnMessage('turn2 question', resumeState);

      expect(mockRagService.search).toHaveBeenCalledTimes(2);
      expect(maxInFlight).toBeGreaterThanOrEqual(2);
    });

    it('emits TOOL_CALL_* with the correct turnIndex on multi-turn resume', async () => {
      // Resume into the second user turn — telemetry must report turnIndex=2,
      // not 1, so the timeline UI can group the tool call under the right
      // turn. Without this, multi-turn debugging mis-attributes tool events.
      mockRagService.search.mockResolvedValue([]);
      mockLlmService.chat
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: 'tc-mt',
              name: kbToolName('kb-1'),
              arguments: '{"query":"x"}',
            },
          ],
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'turn-2 done',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });

      const resumeState = {
        turnCount: 1,
        maxTurns: 5,
        maxToolCalls: 5,
        knowledgeBases: ['kb-1'],
        workspaceId: 'ws-1',
        conditions: [],
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalThinkingTokens: 0,
        toolCalls: 0,
        ragSources: [],
        ragLastDiagnostics: undefined,
        messages: [
          { role: 'system', content: 'sys' },
          { role: 'user', content: 'turn1' },
          { role: 'assistant', content: 'ack' },
        ],
        executionId: 'exec-1',
        nodeId: 'agent-1',
        nodeExecutionId: 'ne-1',
        workflowId: 'wf-1',
        model: 'gpt-4o',
        llmConfigId: 'config-1',
        turnDebugHistory: [],
      };

      // Reach into the handler's resume path the way the engine does.
      await (
        handler as unknown as {
          processMultiTurnMessage: (
            msg: string,
            state: Record<string, unknown>,
          ) => Promise<unknown>;
        }
      ).processMultiTurnMessage('turn2 question', resumeState);

      const events = emittedEvents();
      const started = events.find(
        (e) => e.type === 'execution.tool_call_started',
      );
      const completed = events.find(
        (e) => e.type === 'execution.tool_call_completed',
      );
      expect(started?.payload.turnIndex).toBe(2);
      expect(completed?.payload.turnIndex).toBe(2);
      expect(started?.payload.nodeId).toBe('agent-1');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Render tool family (`render_*`) handler-level integration coverage.
// spec/4-nodes/3-ai/1-ai-agent.md §4.1·§6.1.d.i·§7.10·§4.1 (retry gate).
// ─────────────────────────────────────────────────────────────────────────

describe('AiAgentHandler — render_* dispatch (spec §4.1)', () => {
  let handler: AiAgentHandler;
  let mockLlmService: Record<string, jest.Mock>;
  let mockWebsocketService: { emitExecutionEvent: jest.Mock };

  beforeEach(() => {
    mockLlmService = {
      resolveConfig: jest.fn().mockResolvedValue({
        id: 'config-1',
        provider: 'openai',
        defaultModel: 'gpt-4o',
      }),
      chat: jest.fn(),
    };
    mockWebsocketService = { emitExecutionEvent: jest.fn() };
    handler = new AiAgentHandler(
      mockLlmService as never,
      [new RenderToolProvider()],
      mockWebsocketService as never,
    );
  });

  const ctx: ExecutionContext = makeExecutionContext({
    executionId: 'exec-rt',
    workflowId: 'wf-rt',
    variables: { __workspaceId: 'ws-rt' },
  });

  it('accumulates display-only render_table payload + emits meta.presentationCalls', async () => {
    mockLlmService.chat
      .mockResolvedValueOnce({
        content: null,
        toolCalls: [
          {
            id: 'tc-1',
            name: 'render_table',
            arguments: JSON.stringify({
              mode: 'static',
              columns: [{ field: 'id', label: 'ID' }],
              rows: [{ id: '1' }, { id: '2' }],
            }),
          },
        ],
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        model: 'gpt-4o',
        finishReason: 'tool_calls',
      })
      .mockResolvedValueOnce({
        content: 'Here is the table',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });

    const result = await handler.execute(
      { x: 1 },
      {
        systemPrompt: 'sys',
        userPrompt: 'show me a table',
        model: 'gpt-4o',
        includeSystemContext: false,
        presentationTools: [{ type: 'table' }],
      },
      ctx,
    );

    const meta = (result as Record<string, unknown>).meta as Record<
      string,
      unknown
    >;
    expect(meta.presentationCalls).toBeDefined();
    const calls = meta.presentationCalls as Array<{
      toolName: string;
      status: string;
    }>;
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      toolName: 'render_table',
      status: 'rendered',
    });
    expect(meta.presentationSchemaViolations).toBeUndefined();
  });

  // spec/4-nodes/3-ai/1-ai-agent.md §12.6 — `render_form` submit 후 LLM 의
  // 동일 form 재호출 회귀 차단. `PRESENTATION_TOOLS_GUIDANCE` 에 form_submitted
  // 케이스 처리 라인이 포함되어야 한다 — `{ok:true, type:'form_submitted'}` 를
  // 받으면 같은 form 재호출 금지 + 후속 답변 / 다른 도구 호출 / turn 종결 유도.
  it('systemPrompt 에 form_submitted 재호출 금지 안내가 포함된다 (spec §12.6)', async () => {
    mockLlmService.chat.mockResolvedValueOnce({
      content: 'ok',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      model: 'gpt-4o',
      finishReason: 'stop',
    });

    await handler.execute(
      { x: 1 },
      {
        systemPrompt: 'sys',
        userPrompt: 'hello',
        model: 'gpt-4o',
        includeSystemContext: false,
        presentationTools: [{ type: 'form' }],
      },
      ctx,
    );

    const callArgs = mockLlmService.chat.mock.calls.at(-1)![1] as {
      messages: Array<{ role: string; content?: string }>;
    };
    const systemMsg = callArgs.messages.find((m) => m.role === 'system');
    expect(systemMsg).toBeDefined();
    expect(systemMsg!.content).toEqual(
      expect.stringContaining('form_submitted'),
    );
    // 핵심 안내: 같은 form 재호출 금지 + 후속 행동 유도
    expect(systemMsg!.content).toContain('다시 호출하지');
  });

  it('retry-gate: silently drops 2nd schema violation for the same tool (spec §4.1)', async () => {
    // First tool_use: invalid JSON arguments → schema_violation, attempts=1.
    // LLM retries with the same broken payload → 2nd violation → silent drop.
    mockLlmService.chat
      .mockResolvedValueOnce({
        content: null,
        toolCalls: [
          { id: 'tc-bad-1', name: 'render_table', arguments: 'not json' },
        ],
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        model: 'gpt-4o',
        finishReason: 'tool_calls',
      })
      .mockResolvedValueOnce({
        content: null,
        toolCalls: [
          { id: 'tc-bad-2', name: 'render_table', arguments: 'still bad' },
        ],
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        model: 'gpt-4o',
        finishReason: 'tool_calls',
      })
      .mockResolvedValueOnce({
        content: 'fallback text',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });

    const result = await handler.execute(
      { x: 1 },
      {
        systemPrompt: 'sys',
        userPrompt: 'try render_table twice',
        model: 'gpt-4o',
        includeSystemContext: false,
        presentationTools: [{ type: 'table' }],
      },
      ctx,
    );

    const meta = (result as Record<string, unknown>).meta as Record<
      string,
      unknown
    >;
    const calls = meta.presentationCalls as Array<{ status: string }>;
    const violations = meta.presentationSchemaViolations as Array<{
      attempts: number;
    }>;
    expect(calls).toHaveLength(2);
    // First call: schema_violation (still LLM-visible error).
    expect(calls[0].status).toBe('schema_violation');
    // Second call: demoted to 'dropped' by the retry-gate.
    expect(calls[1].status).toBe('dropped');
    // Both violations are surfaced in meta; the 2nd one's attempts counter
    // reflects the cumulative retry budget consumed for this toolName.
    expect(violations).toHaveLength(2);
    expect(violations[1].attempts).toBe(2);
  });
});

/**
 * Compact helper to fish meta out of single-turn execute() output.
 * Used in a couple of assertions that only need the diagnostic block.
 */
function readSingleTurnMeta(_handler: AiAgentHandler) {
  return (result: unknown) =>
    ((result as Record<string, unknown>).meta ?? {}) as unknown as Record<
      string,
      unknown
    >;
}
