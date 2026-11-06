import {
  AiTurnExecutor,
  capFormDataBytes,
  FORM_SUBMITTED_MAX_BYTES,
} from './ai-turn-executor';
import { AiConditionEvaluator } from './ai-condition-evaluator';
import { AiMemoryManager } from './ai-memory-manager';
import { ExecutionContext } from '../../core/node-handler.interface';
import type { ProviderBuildCtx } from './tool-providers/agent-tool-provider.interface';
import { ExecutionLookupScope } from '../../../modules/integrations/execution-lookup-scope';
import { makeExecutionContext } from '../../../modules/execution-engine/__test__/make-execution-context';
import { ConversationThreadService } from '../../../modules/execution-engine/conversation-thread/conversation-thread.service';

/**
 * AiTurnExecutor unit — refactor 02-architecture §M-1 3단계로 핸들러에서 분리한
 * turn 실행 엔진(single/multi 루프·tool 실행·출력 조립·thread push)을 입출력
 * 단위로 직접 고정한다. 기존엔 `ai-agent.handler.spec` 134KB 가 핸들러 facade 를
 * 통해 간접 테스트했고, 본 spec 은 executor 를 **직접 구성**해 collaborator 주입·
 * graceful degrade·출력 포트 shape·`_retryState` 생명주기를 격리 검증한다
 * (#665 `AiConditionEvaluator` · #668 `AiMemoryManager` 선례 동형, behavior-preserving).
 *
 * executor 는 무상태 collaborator 이고 외부 의존(llm·tool providers·eventEmitter·
 * thread service)과 선행 collaborator(conditionEvaluator·memoryManager)를 생성자로
 * 받으므로, 실제로 건드리는 작은 표면만 부분 fake 로 주입한다.
 */
describe('AiTurnExecutor', () => {
  let mockLlmService: Record<string, jest.Mock>;
  let mockEventEmitter: { emitExecution: jest.Mock };

  const buildExecutor = (
    opts: {
      toolProviders?: unknown[];
      withEventEmitter?: boolean;
      /** 주입하면 thread 주입(`contextScope`)과 push 가 실제로 동작한다. */
      thread?: ConversationThreadService;
    } = {},
  ): AiTurnExecutor =>
    new AiTurnExecutor(
      mockLlmService as never,
      new AiConditionEvaluator(),
      // agent-memory service 미주입 — persistent 전략은 graceful degrade.
      // thread 미주입이면 summary_buffer 도 thread 없이 동작한다.
      new AiMemoryManager(mockLlmService as never, opts.thread, undefined),
      (opts.toolProviders ?? []) as never,
      opts.withEventEmitter === false ? undefined : (mockEventEmitter as never),
      // 미주입이면 thread push 는 no-op 으로 degrade.
      opts.thread,
    );

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
    };
    mockEventEmitter = { emitExecution: jest.fn() };
  });

  const baseContext: ExecutionContext = makeExecutionContext({
    executionId: 'exec-1',
    workflowId: 'wf-1',
    variables: { __workspaceId: 'ws-1' },
  });

  describe('executeSingleTurn', () => {
    it('produces an `out` port ended result for a plain text response', async () => {
      const executor = buildExecutor();
      const result = (await executor.executeSingleTurn(
        undefined,
        {
          mode: 'single_turn',
          systemPrompt: 'You are helpful.',
          userPrompt: 'Hi',
        },
        baseContext,
      )) as Record<string, unknown>;

      expect(result.port).toBe('out');
      expect(result.status).toBe('ended');
      const output = result.output as { result: Record<string, unknown> };
      expect(output.result.response).toBe('Hello! I am an AI assistant.');
      expect(output.result.turnCount).toBe(1);
      expect(mockLlmService.chat).toHaveBeenCalledTimes(1);
    });

    // §12.16 defense-in-depth — single-turn chat 호출이 app-level 타임아웃 +
    // context.abortSignal 을 opts(4번째 인자)로 **실제 전파**하는지 고정.
    it('passes an app-level timeoutMs (§12.16) + context.abortSignal to chat', async () => {
      const prev = process.env.AI_AGENT_LLM_CALL_TIMEOUT_MS;
      delete process.env.AI_AGENT_LLM_CALL_TIMEOUT_MS; // default 600000
      try {
        const controller = new AbortController();
        const ctx = { ...baseContext, abortSignal: controller.signal };
        const executor = buildExecutor();
        await executor.executeSingleTurn(
          undefined,
          { mode: 'single_turn', systemPrompt: 'S', userPrompt: 'Hi' },
          ctx,
        );
        // chat(config, params, context, opts) — 4번째 인자가 LlmCallOptions.
        const opts = mockLlmService.chat.mock.calls[0][3] as {
          timeoutMs?: number;
          signal?: unknown;
        };
        expect(opts.timeoutMs).toBe(600000);
        // tautology 가 아니라 실제 context.abortSignal 이 전파돼야 한다.
        expect(opts.signal).toBe(controller.signal);
      } finally {
        if (prev === undefined) delete process.env.AI_AGENT_LLM_CALL_TIMEOUT_MS;
        else process.env.AI_AGENT_LLM_CALL_TIMEOUT_MS = prev;
      }
    });

    // [노드 취소](CLE-EXEC-CANCEL#노드-핸들러-의무) 규칙 3 — 노드 취소 신호가 켜진 뒤의 LLM 실패는
    // AbortError 로 엔진까지 가야 `cancelled` 로 기록된다. Anthropic · OpenAI SDK 는 abort 때
    // name 이 'Error' 인 APIUserAbortError 를 던지므로 그대로 올리면 엔진이 `failed` 로 본다.
    it('rethrows as AbortError when the first chat call fails after the node signal aborted', async () => {
      const controller = new AbortController();
      const sdkAbort = new Error('Request was aborted.');
      mockLlmService.chat.mockImplementationOnce(() => {
        controller.abort();
        return Promise.reject(sdkAbort);
      });
      const executor = buildExecutor();
      await expect(
        executor.executeSingleTurn(
          undefined,
          { mode: 'single_turn', systemPrompt: 'S', userPrompt: 'Hi' },
          { ...baseContext, abortSignal: controller.signal },
        ),
      ).rejects.toMatchObject({ name: 'AbortError', cause: sdkAbort });
    });

    // 도구 반복까지 가려면 첫 호출의 도구 호출이 실제로 실행돼야 한다. 성공만 돌려주는 MCP provider.
    const okToolProvider = () => ({
      key: 'mcp',
      matches: (n: string) => n.startsWith('mcp_'),
      buildTools: async () => [
        {
          name: 'mcp_abcd1234__do',
          description: 'd',
          parameters: { type: 'object', properties: {} },
        },
      ],
      execute: async (call: { id: string }) => ({
        toolCallId: call.id,
        content: '{}',
        status: 'success' as const,
      }),
    });
    const toolCallTurn = {
      content: '',
      toolCalls: [{ id: 'tc-1', name: 'mcp_abcd1234__do', arguments: {} }],
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      model: 'gpt-4o',
      finishReason: 'tool_calls',
    };
    const toolLoopConfig = {
      mode: 'single_turn',
      systemPrompt: 'S',
      userPrompt: 'Hi',
      mcpServers: [{ integrationId: 'i-a' }],
    };

    it('rethrows as AbortError when a tool-loop chat call fails after the node signal aborted', async () => {
      const controller = new AbortController();
      const sdkAbort = new Error('Request was aborted.');
      mockLlmService.chat
        .mockResolvedValueOnce(toolCallTurn)
        .mockImplementationOnce(() => {
          controller.abort();
          return Promise.reject(sdkAbort);
        });
      const executor = buildExecutor({ toolProviders: [okToolProvider()] });
      await expect(
        executor.executeSingleTurn(undefined, toolLoopConfig, {
          ...baseContext,
          abortSignal: controller.signal,
        }),
      ).rejects.toMatchObject({ name: 'AbortError', cause: sdkAbort });
      expect(mockLlmService.chat).toHaveBeenCalledTimes(2);
    });

    // REQ-AGENT-024 — 노드 취소가 아닌 단일 턴 LLM 실패는 멀티턴과 같은 분류로 error 포트에 낸다.
    describe('LLM call failure while the node signal is open → error port', () => {
      const httpError = (
        status: number,
        message: string,
        extra: Record<string, unknown> = {},
      ) => Object.assign(new Error(message), { status, ...extra });
      const openSignalContext = {
        ...baseContext,
        abortSignal: new AbortController().signal,
      };
      // 단일 턴 결과의 공통 shape. `error` 포트는 `output.error` 를, `out` 포트는
      // `output.result` 를 싣는다.
      type SingleTurnOutput = {
        config: Record<string, unknown>;
        output: {
          result?: Record<string, unknown>;
          error?: {
            code: string;
            message: string;
            details: Record<string, unknown>;
          };
        };
        meta: Record<string, unknown> & {
          turnDebug: Array<Record<string, unknown> & { llmCalls: unknown[] }>;
        };
        port: string;
        status: string;
      };
      const executeSingleTurnAs = async (
        executor: AiTurnExecutor,
        config: Record<string, unknown>,
        context: ExecutionContext,
      ) =>
        (await executor.executeSingleTurn(
          undefined,
          config,
          context,
        )) as unknown as SingleTurnOutput;

      it('routes a first-call 503 to the error port as retryable LLM_CALL_FAILED', async () => {
        mockLlmService.chat.mockRejectedValueOnce(
          httpError(503, '503 Service Unavailable'),
        );
        const executor = buildExecutor();
        const result = await executeSingleTurnAs(
          executor,
          { mode: 'single_turn', systemPrompt: 'S', userPrompt: 'Hi' },
          openSignalContext,
        );

        expect(result.port).toBe('error');
        expect(result.status).toBe('ended');
        expect(result.config.mode).toBe('single_turn');
        expect(result.output.error).toEqual({
          code: 'LLM_CALL_FAILED',
          message: '503 Service Unavailable',
          details: { retryable: true },
        });
        // 성공한 호출이 없으므로 부분 결과도 비어 있다.
        expect(result.meta).toMatchObject({
          model: 'gpt-4o',
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          toolCalls: 0,
        });
        expect(typeof result.meta.durationMs).toBe('number');
        expect(result.meta.turnDebug).toHaveLength(1);
        expect(result.meta.turnDebug[0].turnIndex).toBe(1);
        expect(result.meta.turnDebug[0].llmCalls).toEqual([]);
      });

      it('maps a 429 to retryable LLM_RATE_LIMIT with retryAfterSec', async () => {
        mockLlmService.chat.mockRejectedValueOnce(
          httpError(429, 'Rate limit exceeded', {
            headers: { 'retry-after': '30' },
          }),
        );
        const executor = buildExecutor();
        const result = await executeSingleTurnAs(
          executor,
          { mode: 'single_turn', systemPrompt: 'S', userPrompt: 'Hi' },
          openSignalContext,
        );

        expect(result.port).toBe('error');
        expect(result.output.error?.code).toBe('LLM_RATE_LIMIT');
        expect(result.output.error?.details).toEqual({
          retryable: true,
          retryAfterSec: 30,
        });
      });

      it('maps a 401 to non-retryable LLM_CALL_FAILED', async () => {
        mockLlmService.chat.mockRejectedValueOnce(
          httpError(401, 'Incorrect API key provided'),
        );
        const executor = buildExecutor();
        const result = await executeSingleTurnAs(
          executor,
          { mode: 'single_turn', systemPrompt: 'S', userPrompt: 'Hi' },
          openSignalContext,
        );

        expect(result.port).toBe('error');
        expect(result.output.error?.code).toBe('LLM_CALL_FAILED');
        expect(result.output.error?.details.retryable).toBe(false);
      });

      it('treats the chat app-level timeout as retryable', async () => {
        // `LlmService.chat` 의 타임아웃(`withTimeout`)이 던지는 메시지 그대로다.
        mockLlmService.chat.mockRejectedValueOnce(
          new Error('Request timed out after 600000ms'),
        );
        const executor = buildExecutor();
        const result = await executeSingleTurnAs(
          executor,
          { mode: 'single_turn', systemPrompt: 'S', userPrompt: 'Hi' },
          openSignalContext,
        );

        expect(result.port).toBe('error');
        expect(result.output.error?.details.retryable).toBe(true);
      });

      it('keeps an AbortError from the call itself (e.g. its own timeout) on the error port', async () => {
        // 노드 취소 신호에서 오지 않은 AbortError 는 노드 자신의 실패다.
        mockLlmService.chat.mockRejectedValueOnce(
          Object.assign(new Error('This operation was aborted'), {
            name: 'AbortError',
          }),
        );
        const executor = buildExecutor();
        const result = await executeSingleTurnAs(
          executor,
          { mode: 'single_turn', systemPrompt: 'S', userPrompt: 'Hi' },
          openSignalContext,
        );

        expect(result.port).toBe('error');
        expect(result.output.error?.code).toBe('LLM_CALL_FAILED');
      });

      it('routes a tool-loop failure to the error port with the partial trace so far', async () => {
        mockLlmService.chat
          .mockResolvedValueOnce(toolCallTurn)
          .mockRejectedValueOnce(httpError(500, 'Internal server error'));
        const executor = buildExecutor({ toolProviders: [okToolProvider()] });
        const result = await executeSingleTurnAs(
          executor,
          toolLoopConfig,
          openSignalContext,
        );

        expect(mockLlmService.chat).toHaveBeenCalledTimes(2);
        expect(result.port).toBe('error');
        expect(result.output.error?.code).toBe('LLM_CALL_FAILED');
        expect(result.output.error?.details.retryable).toBe(true);
        // 실패 전에 성공한 첫 호출과 도구 실행 1건이 남는다.
        expect(result.meta).toMatchObject({
          inputTokens: 10,
          outputTokens: 5,
          totalTokens: 15,
          // 호출 usage 에 thinkingTokens 가 없어도 합은 NaN 이 아니라 0 이다.
          thinkingTokens: 0,
          toolCalls: 1,
        });
        expect(result.meta.turnDebug[0].llmCalls).toHaveLength(1);
        expect(result.meta.turnDebug[0].toolCalls).toHaveLength(1);
      });

      // `buildSingleTurnMeta` 가 정상 완료와 error 포트에 공통인 조건부 `meta` 키를 싣는지
      // 값으로 고정한다. 도구 호출 둘이 성공한 뒤 세 번째 chat 이 실패하는 시나리오다.
      describe('partial meta carried on the error port', () => {
        const usageTurn = (
          id: string,
          usage: {
            inputTokens: number;
            outputTokens: number;
            totalTokens: number;
            thinkingTokens: number;
          },
        ) => ({
          content: '',
          toolCalls: [{ id, name: 'mcp_abcd1234__do', arguments: {} }],
          usage,
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        });
        const turnA = usageTurn('tc-1', {
          inputTokens: 10,
          outputTokens: 5,
          totalTokens: 15,
          thinkingTokens: 3,
        });
        const turnB = usageTurn('tc-2', {
          inputTokens: 20,
          outputTokens: 10,
          totalTokens: 30,
          thinkingTokens: 4,
        });
        // 첫 도구 호출만 RAG · 표시 도구 진단을 싣고, 둘째는 평범하게 성공한다.
        const diagnosticToolProvider = () => ({
          ...okToolProvider(),
          execute: async (call: { id: string }) => ({
            toolCallId: call.id,
            content: '{}',
            status: 'success' as const,
            ...(call.id === 'tc-1'
              ? {
                  ragSourcesDelta: [{ chunkId: 'chunk-1', content: 'c' }],
                  ragDiagnosticsDelta: {
                    kbId: 'kb-1',
                    query: 'refund policy',
                    resultCount: 1,
                  },
                  presentationCall: {
                    toolName: 'render_table',
                    toolCallId: 'tc-1',
                    status: 'schema_violation' as const,
                  },
                  presentationSchemaViolation: {
                    toolName: 'render_table',
                    toolCallId: 'tc-1',
                    issues: ['rows is required'],
                    attempts: 1,
                  },
                }
              : {}),
          }),
        });
        const diagnosticConfig = {
          ...toolLoopConfig,
          knowledgeBases: ['kb-1'],
        };
        const finalTurn = {
          content: 'done',
          usage: {
            inputTokens: 1,
            outputTokens: 1,
            totalTokens: 2,
            thinkingTokens: 0,
          },
          model: 'gpt-4o',
          finishReason: 'stop',
        };
        it('sums every usage field of the successful calls, thinkingTokens included', async () => {
          mockLlmService.chat
            .mockResolvedValueOnce(turnA)
            .mockResolvedValueOnce(turnB)
            .mockRejectedValueOnce(httpError(503, 'unavailable'));
          const result = await executeSingleTurnAs(
            buildExecutor({ toolProviders: [diagnosticToolProvider()] }),
            diagnosticConfig,
            openSignalContext,
          );

          expect(result.port).toBe('error');
          expect(mockLlmService.chat).toHaveBeenCalledTimes(3);
          expect(result.meta).toMatchObject({
            inputTokens: 30,
            outputTokens: 15,
            totalTokens: 45,
            thinkingTokens: 7,
            toolCalls: 2,
          });
          // 합산 대상은 turnDebug 에 남은 성공 호출 둘이다(실패 호출은 없다).
          expect(result.meta.turnDebug[0].llmCalls).toHaveLength(2);
        });

        it('keeps the token sum finite when a successful call reports no usage', async () => {
          mockLlmService.chat
            .mockResolvedValueOnce(turnA)
            .mockResolvedValueOnce({ ...turnB, usage: undefined })
            .mockRejectedValueOnce(httpError(503, 'unavailable'));
          const result = await executeSingleTurnAs(
            buildExecutor({ toolProviders: [diagnosticToolProvider()] }),
            diagnosticConfig,
            openSignalContext,
          );

          expect(result.port).toBe('error');
          // usage 없는 둘째 호출은 0 으로 더해져 첫 호출 값만 남는다.
          expect(result.meta).toMatchObject({
            inputTokens: 10,
            outputTokens: 5,
            totalTokens: 15,
            thinkingTokens: 3,
          });
        });

        it('carries the rag, mcp and presentation diagnostics gathered before the failure', async () => {
          mockLlmService.chat
            .mockResolvedValueOnce(turnA)
            .mockResolvedValueOnce(turnB)
            .mockRejectedValueOnce(httpError(503, 'unavailable'));
          const result = await executeSingleTurnAs(
            buildExecutor({ toolProviders: [diagnosticToolProvider()] }),
            diagnosticConfig,
            openSignalContext,
          );

          expect(result.meta.ragSources).toEqual([
            { chunkId: 'chunk-1', content: 'c' },
          ]);
          expect(result.meta.ragDiagnostics).toMatchObject({
            attempted: true,
            searchedKbCount: 1,
            queriesUsed: ['refund policy'],
            resultCount: 1,
          });
          expect(result.meta.mcpDiagnostics).toMatchObject({
            attempted: true,
            toolCalls: 2,
          });
          expect(result.meta.presentationCalls).toEqual([
            {
              toolName: 'render_table',
              toolCallId: 'tc-1',
              status: 'schema_violation',
            },
          ]);
          expect(result.meta.presentationSchemaViolations).toEqual([
            {
              toolName: 'render_table',
              toolCallId: 'tc-1',
              issues: ['rows is required'],
              attempts: 1,
            },
          ]);
          // 턴 단위 delta 는 노드 누적과 같은 값이다.
          expect(result.meta.turnDebug[0]).toMatchObject({
            turnIndex: 1,
            ragSources: [{ chunkId: 'chunk-1', content: 'c' }],
            ragDiagnostics: { attempted: true, queriesUsed: ['refund policy'] },
          });
          expect(result.meta.turnDebug[0].toolCalls).toHaveLength(2);
          // 이 설정에는 thread 주입 · 메모리 전략이 없으므로 두 키는 싣지 않는다.
          expect(result.meta).not.toHaveProperty('contextInjection');
          expect(result.meta).not.toHaveProperty('memory');
        });

        it('omits the optional meta keys on a first-call failure with nothing gathered', async () => {
          mockLlmService.chat.mockRejectedValueOnce(
            httpError(503, 'unavailable'),
          );
          const result = await executeSingleTurnAs(
            buildExecutor(),
            { mode: 'single_turn', systemPrompt: 'S', userPrompt: 'Hi' },
            openSignalContext,
          );

          for (const key of [
            'mcpDiagnostics',
            'presentationCalls',
            'presentationSchemaViolations',
            'contextInjection',
            'memory',
          ]) {
            expect(result.meta).not.toHaveProperty(key);
          }
          expect(result.meta.thinkingTokens).toBe(0);
          expect(result.meta.ragSources).toEqual([]);
          expect(result.meta.ragDiagnostics).toMatchObject({
            attempted: false,
            skipReason: 'empty_kb_list',
          });
        });

        it('echoes meta.contextInjection when thread injection was applied', async () => {
          const thread = new ConversationThreadService();
          const context = makeExecutionContext({
            executionId: 'exec-inj',
            workflowId: 'wf-1',
            nodeId: 'agent-1',
            variables: { __workspaceId: 'ws-1' },
            abortSignal: new AbortController().signal,
          });
          thread.appendAiAssistantMessage(context, {
            node: { id: 'agent-prev', label: 'Prev', type: 'ai_agent' },
            content: 'Earlier assistant turn',
          });
          mockLlmService.chat.mockRejectedValueOnce(
            httpError(503, 'unavailable'),
          );
          const result = await executeSingleTurnAs(
            buildExecutor({ thread }),
            {
              mode: 'single_turn',
              systemPrompt: 'S',
              userPrompt: 'Hi',
              contextScope: 'thread',
              contextInjectionMode: 'messages',
            },
            context,
          );

          expect(result.port).toBe('error');
          expect(result.meta.contextInjection).toMatchObject({
            appliedScope: 'thread',
            appliedMode: 'messages',
            injectedTurns: 1,
            droppedTurns: 0,
          });
          expect(result.meta).not.toHaveProperty('memory');
        });

        it('echoes meta.memory for an auto memory strategy and no contextInjection', async () => {
          // thread 를 주입한 실행기는 `ai_user` 턴을 컨텍스트에 push 하므로 공유 컨텍스트 대신
          // 이 테스트 전용 컨텍스트를 만든다.
          const context = makeExecutionContext({
            executionId: 'exec-mem',
            workflowId: 'wf-1',
            nodeId: 'agent-1',
            variables: { __workspaceId: 'ws-1' },
            abortSignal: new AbortController().signal,
          });
          mockLlmService.chat.mockRejectedValueOnce(
            httpError(503, 'unavailable'),
          );
          const result = await executeSingleTurnAs(
            buildExecutor({ thread: new ConversationThreadService() }),
            {
              mode: 'single_turn',
              systemPrompt: 'S',
              userPrompt: 'Hi',
              memoryStrategy: 'summary_buffer',
              memoryTokenBudget: 100000,
            },
            context,
          );

          expect(result.port).toBe('error');
          expect(result.meta.memory).toMatchObject({
            strategy: 'summary_buffer',
            summarized: false,
            recalledCount: 0,
          });
          expect(result.meta).not.toHaveProperty('contextInjection');
        });

        // 두 경로가 `buildSingleTurnMeta` 를 함께 쓰는지(복제로 다시 갈라지지 않는지)를 키
        // 집합으로 고정한다. 정상 완료의 토큰은 마지막 호출 하나, 실패는 성공 호출의 합이라
        // 값은 두 경로를 서로 비교하지 않고 각각 단언한다(실패 쪽은 위 합산 테스트).
        it('gives the normal completion and the error port the same meta key set', async () => {
          const buildSeeded = () => {
            const thread = new ConversationThreadService();
            const context = makeExecutionContext({
              executionId: 'exec-parity',
              workflowId: 'wf-1',
              nodeId: 'agent-1',
              variables: { __workspaceId: 'ws-1' },
              abortSignal: new AbortController().signal,
            });
            thread.appendAiAssistantMessage(context, {
              node: { id: 'agent-prev', label: 'Prev', type: 'ai_agent' },
              content: 'Earlier assistant turn',
            });
            return {
              context,
              executor: buildExecutor({
                thread,
                toolProviders: [diagnosticToolProvider()],
              }),
            };
          };
          const config = {
            ...diagnosticConfig,
            contextScope: 'thread',
            contextInjectionMode: 'messages',
          };

          mockLlmService.chat
            .mockResolvedValueOnce(turnA)
            .mockResolvedValueOnce(turnB)
            .mockResolvedValueOnce(finalTurn);
          const ok = buildSeeded();
          const success = await executeSingleTurnAs(
            ok.executor,
            config,
            ok.context,
          );
          expect(success.port).toBe('out');
          // 정상 완료는 마지막 호출(finalTurn) 하나의 usage 만 싣는다. 도구 호출 둘의 usage
          // (30 · 15 · 45)는 합산하지 않는다. 합산으로 바꾸는 후속 Task 는 CLE-T-9VRXGD 다.
          expect(success.meta).toMatchObject({
            inputTokens: 1,
            outputTokens: 1,
            totalTokens: 2,
            thinkingTokens: 0,
            model: 'gpt-4o',
            toolCalls: 2,
          });

          mockLlmService.chat
            .mockResolvedValueOnce(turnA)
            .mockResolvedValueOnce(turnB)
            .mockRejectedValueOnce(httpError(503, 'unavailable'));
          const bad = buildSeeded();
          const failure = await executeSingleTurnAs(
            bad.executor,
            config,
            bad.context,
          );
          expect(failure.port).toBe('error');

          const successKeys = Object.keys(success.meta).sort();
          expect(Object.keys(failure.meta).sort()).toEqual(successKeys);
          // 비교 대상이 비어 있지 않은지(두 경로가 함께 줄어드는 경우)를 막는다.
          expect(successKeys).toEqual(
            expect.arrayContaining([
              'contextInjection',
              'durationMs',
              'mcpDiagnostics',
              'model',
              'presentationCalls',
              'presentationSchemaViolations',
              'ragDiagnostics',
              'ragSources',
              'thinkingTokens',
              'toolCalls',
              'turnDebug',
            ]),
          );
        });
      });

      it('adds no ai_assistant thread turn and schedules no memory extraction', async () => {
        const thread = new ConversationThreadService();
        const memoryManager = new AiMemoryManager(
          mockLlmService as never,
          undefined,
          undefined,
        );
        const scheduleSpy = jest.spyOn(
          memoryManager,
          'scheduleMemoryExtraction',
        );
        const executor = new AiTurnExecutor(
          mockLlmService as never,
          new AiConditionEvaluator(),
          memoryManager,
          [],
          mockEventEmitter as never,
          thread,
        );
        const context = makeExecutionContext({
          executionId: 'exec-err',
          workflowId: 'wf-1',
          nodeId: 'agent-1',
          variables: { __workspaceId: 'ws-1' },
          abortSignal: new AbortController().signal,
        });
        mockLlmService.chat.mockRejectedValueOnce(
          httpError(503, 'unavailable'),
        );

        const result = await executeSingleTurnAs(
          executor,
          { mode: 'single_turn', systemPrompt: 'S', userPrompt: 'Hi' },
          context,
        );

        expect(result.port).toBe('error');
        // LLM 호출 전에 넣은 ai_user 턴만 남는다.
        expect(thread.getThread(context).turns.map((t) => t.source)).toEqual([
          'ai_user',
        ]);
        expect(scheduleSpy).not.toHaveBeenCalled();
      });
    });

    it('propagates AI_AGENT_LLM_CALL_TIMEOUT_MS=0 (disabled) through to chat opts', async () => {
      const prev = process.env.AI_AGENT_LLM_CALL_TIMEOUT_MS;
      process.env.AI_AGENT_LLM_CALL_TIMEOUT_MS = '0';
      try {
        const executor = buildExecutor();
        await executor.executeSingleTurn(
          undefined,
          { mode: 'single_turn', systemPrompt: 'S', userPrompt: 'Hi' },
          baseContext,
        );
        const opts = mockLlmService.chat.mock.calls[0][3] as {
          timeoutMs?: number;
        };
        // 0 = 비활성 → 그대로 0 전파 (LlmService.chat 이 timeoutMs>0 조건에서만
        // withTimeout 적용하므로 0 은 타임아웃 없음).
        expect(opts.timeoutMs).toBe(0);
      } finally {
        if (prev === undefined) delete process.env.AI_AGENT_LLM_CALL_TIMEOUT_MS;
        else process.env.AI_AGENT_LLM_CALL_TIMEOUT_MS = prev;
      }
    });

    it('honours AI_AGENT_LLM_CALL_TIMEOUT_MS override on the chat call', async () => {
      const prev = process.env.AI_AGENT_LLM_CALL_TIMEOUT_MS;
      process.env.AI_AGENT_LLM_CALL_TIMEOUT_MS = '30000';
      try {
        const executor = buildExecutor();
        await executor.executeSingleTurn(
          undefined,
          { mode: 'single_turn', systemPrompt: 'S', userPrompt: 'Hi' },
          baseContext,
        );
        const opts = mockLlmService.chat.mock.calls[0][3] as {
          timeoutMs?: number;
        };
        expect(opts.timeoutMs).toBe(30000);
      } finally {
        if (prev === undefined) delete process.env.AI_AGENT_LLM_CALL_TIMEOUT_MS;
        else process.env.AI_AGENT_LLM_CALL_TIMEOUT_MS = prev;
      }
    });

    it('degrades gracefully without an eventEmitter (telemetry omitted)', async () => {
      const executor = buildExecutor({ withEventEmitter: false });
      const result = (await executor.executeSingleTurn(
        undefined,
        { mode: 'single_turn', systemPrompt: 'sys', userPrompt: 'Hi' },
        baseContext,
      )) as Record<string, unknown>;
      expect(result.status).toBe('ended');
      expect(mockEventEmitter.emitExecution).not.toHaveBeenCalled();
    });

    // C-2 1차 — buildSingleTurnSystemPrompt 의 §11.4 ordering 분기(KB/condition/
    // presentation guidance)를 executor 레벨에서 직접 고정. setup 추출(메서드 분리)
    // 후 system 프롬프트 조립 회귀를 핸들러 spec 간접 커버에 의존하지 않고 잡는다.
    it('composes the §11.4-ordered system prompt (systemPrompt → KB → condition → presentation)', async () => {
      const executor = buildExecutor();
      await executor.executeSingleTurn(
        undefined,
        {
          mode: 'single_turn',
          systemPrompt: 'You are helpful.',
          userPrompt: 'Hi',
          knowledgeBases: ['kb-1'],
          conditions: [{ id: 'c1', prompt: '환불 요청' }],
          presentationTools: [{ type: 'render_table' }],
        },
        baseContext,
      );

      expect(mockLlmService.chat).toHaveBeenCalledTimes(1);
      const chatPayload = mockLlmService.chat.mock.calls[0][1] as {
        messages: Array<{ role: string; content: string }>;
      };
      const sys = chatPayload.messages.find(
        (m) => m.role === 'system',
      )?.content;
      expect(sys).toBeDefined();
      // [2] 사용자 systemPrompt · [3] KB · [4] condition · presentation guidance 모두 포함
      expect(sys).toContain('You are helpful.');
      expect(sys).toContain('[Knowledge Base]');
      expect(sys).toContain('[조건 안내]');
      expect(sys).toContain('환불 요청');
      expect(sys).toContain('[Presentation Tools]');
      // §11.4 ordering: systemPrompt → KB_TOOL_GUIDANCE → condition suffix (인덱스 단조 증가)
      expect(sys!.indexOf('You are helpful.')).toBeLessThan(
        sys!.indexOf('[Knowledge Base]'),
      );
      expect(sys!.indexOf('[Knowledge Base]')).toBeLessThan(
        sys!.indexOf('[조건 안내]'),
      );
    });

    // C-2 2차 (review W10) — condition-only 라우팅(handleSingleTurnConditionRoute)
    // 을 executor 레벨에서 고정: LLM 이 조건 도구만 호출하면 즉시 condition 분기로
    // 종결한다 (루프 미진입).
    it('routes to the condition branch when the LLM calls only a condition tool', async () => {
      mockLlmService.chat.mockResolvedValueOnce({
        content: '',
        toolCalls: [{ id: 't1', name: 'cond_c1', arguments: {} }],
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        model: 'gpt-4o',
        finishReason: 'tool_calls',
      });
      const executor = buildExecutor();
      const result = (await executor.executeSingleTurn(
        undefined,
        {
          mode: 'single_turn',
          systemPrompt: 'sys',
          userPrompt: '환불해주세요',
          conditions: [{ id: 'c1', label: '환불', prompt: '환불 요청' }],
        },
        baseContext,
      )) as Record<string, unknown>;

      const output = result.output as { result: Record<string, unknown> };
      expect(output.result.endReason).toBe('condition');
      expect((output.result.condition as { id: string }).id).toBe('c1');
      // condition-only → 즉시 분기, 루프 미진입(첫 호출 후 종결).
      expect(mockLlmService.chat).toHaveBeenCalledTimes(1);
    });

    // C-2 2차 (review W1/W6) — single-turn 도구 루프에서 condition deferral 은
    // toolCallCount 에 합산되지 않고(§3.f-g), normal 도구만 합산되는 비대칭을
    // executor 레벨에서 고정 (multi-turn 의 동명 helper 는 의도적으로 합산 — 다름).
    it('counts only normal tools, not condition tools, toward toolCalls (single-turn)', async () => {
      mockLlmService.chat
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [
            { id: 't1', name: 'cond_c1', arguments: {} },
            { id: 't2', name: 'do_thing', arguments: {} },
          ],
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: '완료했습니다.',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });
      const executor = buildExecutor();
      const result = (await executor.executeSingleTurn(
        undefined,
        {
          mode: 'single_turn',
          systemPrompt: 'sys',
          userPrompt: 'go',
          conditions: [{ id: 'c1', label: 'c', prompt: 'p' }],
        },
        baseContext,
      )) as Record<string, unknown>;

      expect(result.status).toBe('ended');
      // cond_c1 은 미합산, do_thing(normal) 만 +1 → toolCalls === 1.
      expect((result.meta as { toolCalls: number }).toolCalls).toBe(1);
      expect(mockLlmService.chat).toHaveBeenCalledTimes(2);
      // §12.16 — tool-loop 재호출(2번째 chat)도 1번째와 동일하게 app-level
      // 타임아웃을 opts 로 전달하는지 (배선 대칭) 고정.
      const firstOpts = mockLlmService.chat.mock.calls[0][3] as {
        timeoutMs?: number;
      };
      const secondOpts = mockLlmService.chat.mock.calls[1][3] as {
        timeoutMs?: number;
      };
      expect(typeof secondOpts.timeoutMs).toBe('number');
      expect(secondOpts.timeoutMs).toBe(firstOpts.timeoutMs);
    });

    it('emits structured meta.mcpDiagnostics (serverSummaries + 종류별 counters) — spec §6.2', async () => {
      // 가짜 MCP provider — buildTools 에서 connected serverSummary 를 push 하고,
      // 일반/메타 도구를 노출한다. execute 는 성공 stub.
      const mcpProvider = {
        key: 'mcp',
        matches: (n: string) => n.startsWith('mcp_'),
        buildTools: async (ctx: {
          mcpDiagnostics?: Array<Record<string, unknown>>;
        }) => {
          ctx.mcpDiagnostics?.push({
            integrationId: 'i-a',
            serviceType: 'mcp',
            status: 'connected',
            toolCount: 1,
          });
          return [
            {
              name: 'mcp_abcd1234__do',
              description: 'd',
              parameters: { type: 'object', properties: {} },
            },
          ];
        },
        execute: async (call: { id: string }) => ({
          toolCallId: call.id,
          content: '{}',
          status: 'success' as const,
        }),
      };
      mockLlmService.chat
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [
            { id: 't1', name: 'mcp_abcd1234__do', arguments: {} },
            { id: 't2', name: 'mcp_abcd1234__read_resource', arguments: {} },
            { id: 't3', name: 'mcp_abcd1234__get_prompt', arguments: {} },
            { id: 't4', name: 'mcp_abcd1234__list_resources', arguments: {} },
          ],
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: '완료.',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });
      const executor = buildExecutor({ toolProviders: [mcpProvider] });
      const result = (await executor.executeSingleTurn(
        undefined,
        {
          mode: 'single_turn',
          systemPrompt: 'sys',
          userPrompt: 'go',
          mcpServers: [{ integrationId: 'i-a' }],
        },
        baseContext,
      )) as Record<string, unknown>;

      const diag = (result.meta as { mcpDiagnostics?: Record<string, unknown> })
        .mcpDiagnostics;
      expect(diag).toEqual({
        attempted: true,
        serverCount: 1,
        // do → tool, read_resource → resource, get_prompt → prompt,
        // list_resources(discovery) → 미집계.
        toolCalls: 1,
        resourceReads: 1,
        promptGets: 1,
        serverSummaries: [
          {
            integrationId: 'i-a',
            serviceType: 'mcp',
            status: 'connected',
            toolCount: 1,
          },
        ],
        errors: [],
      });
    });

    it('provider 의 mcpErrorDelta 를 meta.mcpDiagnostics.errors[] 로 누적 — spec §8.1', async () => {
      const mcpProvider = {
        key: 'mcp',
        matches: (n: string) => n.startsWith('mcp_'),
        buildTools: async (ctx: {
          mcpDiagnostics?: Array<Record<string, unknown>>;
        }) => {
          ctx.mcpDiagnostics?.push({
            integrationId: 'i-a',
            serviceType: 'mcp',
            status: 'connected',
            toolCount: 1,
          });
          return [
            {
              name: 'mcp_abcd1234__do',
              description: 'd',
              parameters: { type: 'object', properties: {} },
            },
          ];
        },
        // call-phase 서버 실패를 delta 로 보고.
        execute: async (call: { id: string }) => ({
          toolCallId: call.id,
          content: JSON.stringify({ error: 'MCP_CALL_FAILED' }),
          status: 'error' as const,
          mcpErrorDelta: {
            integrationId: 'i-a',
            phase: 'tools/call' as const,
            code: 'MCP_CALL_FAILED',
            message: 'upstream 500',
          },
        }),
      };
      mockLlmService.chat
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [{ id: 't1', name: 'mcp_abcd1234__do', arguments: {} }],
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: '완료.',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });
      const executor = buildExecutor({ toolProviders: [mcpProvider] });
      const result = (await executor.executeSingleTurn(
        undefined,
        {
          mode: 'single_turn',
          systemPrompt: 'sys',
          userPrompt: 'go',
          mcpServers: [{ integrationId: 'i-a' }],
        },
        baseContext,
      )) as Record<string, unknown>;

      const diag = (result.meta as { mcpDiagnostics?: Record<string, unknown> })
        .mcpDiagnostics;
      // 실패해도 toolCalls 는 시도로 집계, errors[] 에 delta 누적.
      expect(diag).toMatchObject({
        attempted: true,
        toolCalls: 1,
        errors: [
          {
            integrationId: 'i-a',
            phase: 'tools/call',
            code: 'MCP_CALL_FAILED',
            message: 'upstream 500',
          },
        ],
      });
    });

    it('omits meta.mcpDiagnostics when no MCP server is configured (lean)', async () => {
      const executor = buildExecutor();
      const result = (await executor.executeSingleTurn(
        undefined,
        { mode: 'single_turn', systemPrompt: 'sys', userPrompt: 'hi' },
        baseContext,
      )) as Record<string, unknown>;
      expect(
        (result.meta as { mcpDiagnostics?: unknown }).mcpDiagnostics,
      ).toBeUndefined();
    });
  });

  describe('executeMultiTurn (first-turn park)', () => {
    it('returns waiting_for_input + _resumeState without calling the LLM', async () => {
      const executor = buildExecutor();
      const result = (await executor.executeMultiTurn(
        undefined,
        { mode: 'multi_turn', systemPrompt: 'You are a support agent.' },
        baseContext,
      )) as Record<string, unknown>;

      expect(result.status).toBe('waiting_for_input');
      // 첫 진입은 LLM 호출을 사용자 메시지 수신 후로 미룬다 (spec §6.2 step 1.b).
      expect(mockLlmService.chat).not.toHaveBeenCalled();
      const resumeState = result._resumeState as Record<string, unknown>;
      expect(resumeState).toBeDefined();
      expect(resumeState.turnCount).toBe(0);
      // credential 은 _resumeState 에는 담기되 마스킹은 엔진 boundary 책임.
      const output = result.output as { result: Record<string, unknown> };
      expect(output.result.turnCount).toBe(0);
      expect(output.result.message).toBe('');
    });
  });

  describe('processMultiTurnMessage (resume loop)', () => {
    const resumeState = (): Record<string, unknown> => ({
      llmConfigId: 'cfg-1',
      model: 'gpt-4o',
      maxToolCalls: 10,
      maxTurns: 20,
      knowledgeBases: [],
      conditions: [],
      mcpServers: [],
      presentationTools: [],
      messages: [{ role: 'system', content: 'You are a support agent.' }],
      turnCount: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalThinkingTokens: 0,
      toolCalls: 0,
      ragSources: [],
      workspaceId: 'ws-1',
      executionId: 'exec-1',
      memoryStrategy: 'manual',
    });

    it('appends the user turn, calls the LLM, and re-enters waiting_for_input', async () => {
      const executor = buildExecutor();
      const result = (await executor.processMultiTurnMessage(
        '환불 문의입니다',
        resumeState(),
      )) as Record<string, unknown>;

      expect(result.status).toBe('waiting_for_input');
      expect(mockLlmService.chat).toHaveBeenCalledTimes(1);
      const next = result._resumeState as Record<string, unknown>;
      expect(next.turnCount).toBe(1);
      const output = result.output as { result: { messages: unknown[] } };
      // system + user + assistant 누적.
      expect(output.result.messages.length).toBeGreaterThanOrEqual(3);
    });

    // §12.16 defense-in-depth — resume 턴 chat 호출도 app-level 타임아웃을 opts 로
    // 전달(초기 실행과 대칭). resume 경로 abort 소스는 아직 없어 signal 은 대개
    // undefined 지만 timeout 백스톱은 독립 동작한다.
    it('passes an app-level timeoutMs (§12.16) to the resume-turn chat', async () => {
      const prev = process.env.AI_AGENT_LLM_CALL_TIMEOUT_MS;
      delete process.env.AI_AGENT_LLM_CALL_TIMEOUT_MS; // default 600000
      try {
        const executor = buildExecutor();
        await executor.processMultiTurnMessage(
          '환불 문의입니다',
          resumeState(),
        );
        const opts = mockLlmService.chat.mock.calls[0][3] as {
          timeoutMs?: number;
          signal?: unknown;
        };
        expect(opts.timeoutMs).toBe(600000);
        // options.signal 배선 — 소스 미도입이라 undefined 이나 키는 전달.
        expect('signal' in opts).toBe(true);
      } finally {
        if (prev === undefined) delete process.env.AI_AGENT_LLM_CALL_TIMEOUT_MS;
        else process.env.AI_AGENT_LLM_CALL_TIMEOUT_MS = prev;
      }
    });

    // [Spec 7-llm-usage §1.3] resume 턴 attribution 회귀 고정. resume 메인 chat 호출은
    // engine 이 재구성 state 에 실어준 workflowId + NodeExecution row PK(nodeExecutionId)
    // 를 llmContext(3번째 인자)로 전달해야 하며, nodeId(정의 id)를 넣으면 안 된다
    // (llm_usage_log.node_execution_id 는 NodeExecution row FK).
    it('passes llmContext (workflowId/executionId/nodeExecutionId row PK) to the resume-turn LLM chat', async () => {
      const executor = buildExecutor();
      // nodeId(정의)와 nodeExecutionId(row PK)를 서로 다른 값으로 둬 혼동 배제.
      await executor.processMultiTurnMessage('환불 문의입니다', {
        ...resumeState(),
        workflowId: 'wf-1',
        nodeId: 'node-def-1',
        nodeExecutionId: 'nodeexec-row-1',
      });

      // chat(config, params, context, opts) — 3번째 인자가 LlmCallContext.
      const llmContext = mockLlmService.chat.mock.calls[0][2] as Record<
        string,
        unknown
      >;
      expect(llmContext).toEqual(
        expect.objectContaining({
          workflowId: 'wf-1',
          executionId: 'exec-1',
          nodeExecutionId: 'nodeexec-row-1',
        }),
      );
      // 회귀 방지: 정의 id 가 row PK 자리에 유입되면 안 된다.
      expect(llmContext.nodeExecutionId).not.toBe('node-def-1');
    });

    it('routes to max_turns when the turn budget is exhausted', async () => {
      const executor = buildExecutor();
      const state = { ...resumeState(), turnCount: 19, maxTurns: 20 };
      const result = (await executor.processMultiTurnMessage(
        'one more',
        state,
      )) as Record<string, unknown>;
      expect(result.status).toBe('ended');
      expect(result.port).toBe('max_turns');
    });

    // C-2 후속 (review W7 / impl-prep BLOCK 해소) — multi-turn 도구 루프에서
    // condition deferral 은 toolCallCount 에 합산하지 않고(spec §7.1 조건 도구
    // 제외) normal 도구만 합산. single-turn 과 동일 정책으로 통일됨을 고정.
    it('does not count condition tools toward toolCalls in multi-turn, only normal tools', async () => {
      mockLlmService.chat
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [
            { id: 't1', name: 'cond_c1', arguments: {} },
            { id: 't2', name: 'do_thing', arguments: {} },
          ],
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: '처리했습니다.',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });
      const executor = buildExecutor();
      const state = {
        ...resumeState(),
        conditions: [{ id: 'c1', label: 'c', prompt: 'p' }],
        workflowId: 'wf-1',
        nodeExecutionId: 'nodeexec-row-1',
      };
      const result = (await executor.processMultiTurnMessage(
        'go',
        state,
      )) as Record<string, unknown>;

      expect(result.status).toBe('waiting_for_input');
      // cond_c1 미합산, do_thing(normal)만 +1 → toolCalls === 1 (single-turn 과 동일).
      const next = result._resumeState as { toolCalls: number };
      expect(next.toolCalls).toBe(1);
      expect(mockLlmService.chat).toHaveBeenCalledTimes(2);
      // [Spec 7-llm-usage §1.3] tool-loop 후속(2번째) chat 호출도 동일 llmContext 로
      // attribution 을 채워야 한다 (ai-review INFO#3 — 간접 커버 → 직접 단언).
      const secondCallCtx = mockLlmService.chat.mock.calls[1][2] as Record<
        string,
        unknown
      >;
      expect(secondCallCtx).toEqual(
        expect.objectContaining({
          workflowId: 'wf-1',
          executionId: 'exec-1',
          nodeExecutionId: 'nodeexec-row-1',
        }),
      );
      // §12.16 — resume tool-loop 후속(2번째) chat 도 app-level 타임아웃을 opts 로
      // 대칭 전달(배선 대칭)한다.
      const secondOpts = mockLlmService.chat.mock.calls[1][3] as {
        timeoutMs?: number;
      };
      expect(typeof secondOpts.timeoutMs).toBe('number');
    });

    it('multi-turn: max_turns 종결 output 에 구조화 meta.mcpDiagnostics(카운터 포함) emit — spec §6.2', async () => {
      const mcpProvider = {
        key: 'mcp',
        matches: (n: string) => n.startsWith('mcp_'),
        buildTools: async (ctx: {
          mcpDiagnostics?: Array<Record<string, unknown>>;
        }) => {
          ctx.mcpDiagnostics?.push({
            integrationId: 'i-a',
            serviceType: 'mcp',
            status: 'connected',
            toolCount: 1,
          });
          return [
            {
              name: 'mcp_abcd1234__do',
              description: 'd',
              parameters: { type: 'object', properties: {} },
            },
          ];
        },
        execute: async (call: { id: string }) => ({
          toolCallId: call.id,
          content: '{}',
          status: 'success' as const,
        }),
      };
      mockLlmService.chat
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [{ id: 't1', name: 'mcp_abcd1234__do', arguments: {} }],
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: '처리했습니다.',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });
      const executor = buildExecutor({ toolProviders: [mcpProvider] });
      // turnCount 19 + maxTurns 20 → 이번 턴 종결 시 max_turns ended.
      const state = {
        ...resumeState(),
        turnCount: 19,
        maxTurns: 20,
        mcpServers: [{ integrationId: 'i-a' }],
      };
      const result = (await executor.processMultiTurnMessage(
        'go',
        state,
      )) as Record<string, unknown>;

      expect(result.port).toBe('max_turns');
      const diag = (result.meta as { mcpDiagnostics?: Record<string, unknown> })
        .mcpDiagnostics;
      expect(diag).toMatchObject({
        attempted: true,
        serverCount: 1,
        toolCalls: 1,
        resourceReads: 0,
        promptGets: 0,
        serverSummaries: [
          {
            integrationId: 'i-a',
            serviceType: 'mcp',
            status: 'connected',
            toolCount: 1,
          },
        ],
        errors: [],
      });
    });

    it('multi-turn: MCP 미구성 시 meta.mcpDiagnostics omit (lean)', async () => {
      const executor = buildExecutor();
      const state = { ...resumeState(), turnCount: 19, maxTurns: 20 };
      const result = (await executor.processMultiTurnMessage(
        'go',
        state,
      )) as Record<string, unknown>;
      expect(result.port).toBe('max_turns');
      expect(
        (result.meta as { mcpDiagnostics?: unknown }).mcpDiagnostics,
      ).toBeUndefined();
    });

    it('재개 시 turnDebugHistory/allPresentations 를 누적·보존 (M-7 enrich 회귀 가드)', async () => {
      // z.custom enrich 로 array 캐스트를 제거한 뒤에도 이전 turn 의
      // turnDebugHistory(prepend+append)·allPresentations(보존)가 다음
      // _resumeState 로 이어지는지 고정.
      const executor = buildExecutor();
      const prevPresentation = { type: 'card', id: 'p-prev' };
      const state = {
        ...resumeState(),
        turnDebugHistory: [{ turnIndex: 0, llmCalls: [] }],
        allPresentations: [prevPresentation],
      };
      const result = (await executor.processMultiTurnMessage(
        '이어서',
        state,
      )) as Record<string, unknown>;
      const next = result._resumeState as {
        turnDebugHistory: unknown[];
        allPresentations: unknown[];
      };
      // 이전 1건 + 이번 turn 1건 누적.
      expect(next.turnDebugHistory).toHaveLength(2);
      // 이전 presentation 보존(이번 turn 신규 없음).
      expect(next.allPresentations).toContainEqual(prevPresentation);
    });
  });

  describe('endMultiTurnConversation', () => {
    const endState = (): Record<string, unknown> => ({
      messages: [
        { role: 'user', content: 'bye' },
        { role: 'assistant', content: 'Goodbye!' },
      ],
      turnCount: 3,
      model: 'gpt-4o',
      totalInputTokens: 100,
      totalOutputTokens: 30,
      toolCalls: 0,
      ragSources: [],
    });

    it('maps user_ended to the user_ended port', () => {
      const executor = buildExecutor();
      const result = executor.endMultiTurnConversation(
        endState(),
        'user_ended',
      ) as Record<string, unknown>;
      expect(result.port).toBe('user_ended');
      expect(result.status).toBe('ended');
    });

    it('carries output.error + _retryState only for retryable errors', () => {
      const executor = buildExecutor();
      const result = executor.endMultiTurnConversation(
        endState(),
        'error',
        {
          code: 'LLM_TIMEOUT',
          message: 'timeout',
          details: { retryable: true },
        },
        'failed message',
      ) as Record<string, unknown>;
      expect(result.port).toBe('error');
      const output = result.output as { error?: { code: string } };
      expect(output.error?.code).toBe('LLM_TIMEOUT');
      const retryState = result._retryState as Record<string, unknown>;
      expect(retryState).toBeDefined();
      expect(retryState.expiresAt).toEqual(expect.any(String));
      // spec §7.9 — credential (llmConfigId) 미동봉.
      expect(retryState.llmConfigId).toBeUndefined();
      expect(retryState.lastUserMessage).toBe('failed message');
    });

    it('carries resume-state allow-list fields into _retryState (M-7 cast 제거 회귀 가드)', () => {
      // buildRetryState 가 mcpServers/knowledgeBases/pendingFormToolCall/
      // totalThinkingTokens 의 `as` 단언을 ResumeState 타입화로 제거한 뒤에도
      // non-default 값을 그대로 운반하는지 검증 (behavior-preserving).
      const executor = buildExecutor();
      const mcpServers = [{ id: 'srv-1', tools: ['t'] }];
      const knowledgeBases = [{ id: 'kb-1' }];
      const pendingFormToolCall = { toolCallId: 'call-1', formSchema: {} };
      const state = {
        ...endState(),
        totalThinkingTokens: 7,
        mcpServers,
        knowledgeBases,
        pendingFormToolCall,
      };
      const result = executor.endMultiTurnConversation(state, 'error', {
        code: 'LLM_TIMEOUT',
        message: 'timeout',
        details: { retryable: true },
      }) as Record<string, unknown>;
      const retryState = result._retryState as Record<string, unknown>;
      expect(retryState.mcpServers).toEqual(mcpServers);
      expect(retryState.knowledgeBases).toEqual(knowledgeBases);
      expect(retryState.pendingFormToolCall).toEqual(pendingFormToolCall);
      expect(retryState.totalThinkingTokens).toBe(7);
    });

    it('omits _retryState for non-retryable errors', () => {
      const executor = buildExecutor();
      const result = executor.endMultiTurnConversation(endState(), 'error', {
        code: 'BAD_REQUEST',
        message: 'nope',
        details: { retryable: false },
      }) as Record<string, unknown>;
      expect(result._retryState).toBeUndefined();
    });

    it('enrich 로 캐스트 제거된 필드(messages/allPresentations/turnDebugHistory)를 non-default 값으로 출력에 전달 (M-7 회귀 가드)', () => {
      // z.custom<T>() enrich 로 domain 캐스트를 제거한 필드가 실제로 출력에
      // 그대로 실려 나가는지 고정 — `?? []` fallback 경로가 아닌 값 경로 검증.
      const executor = buildExecutor();
      const turnDebugHistory = [{ turnIndex: 0, llmCalls: [] }];
      const presentation = { type: 'card', id: 'p-1' };
      const state = {
        ...endState(),
        turnDebugHistory,
        allPresentations: [presentation],
      };
      const result = executor.endMultiTurnConversation(
        state,
        'user_ended',
      ) as Record<string, unknown>;
      const output = result.output as {
        result: { messages: unknown[]; presentations?: unknown[] };
      };
      const meta = result.meta as { turnDebug: unknown[] };
      // messages (endState 의 2건) → output.result.messages.
      expect(output.result.messages).toHaveLength(2);
      // allPresentations → output.result.presentations.
      expect(output.result.presentations).toEqual([presentation]);
      // turnDebugHistory → meta.turnDebug.
      expect(meta.turnDebug).toEqual(turnDebugHistory);
    });
  });

  describe('buildMultiTurnFinalOutput', () => {
    const meta = {
      model: 'gpt-4o',
      totalInputTokens: 10,
      totalOutputTokens: 5,
      toolCalls: 0,
      ragSources: [],
    };

    // spec §3.2 — 종결 사유별 전용 포트. `condition` 은 buildConditionOutput
    // 경로이므로 이 함수로 새면 방어적으로 `error` 로 매핑한다.
    it.each([
      ['max_turns', 'max_turns'],
      ['user_ended', 'user_ended'],
      ['error', 'error'],
      ['condition', 'error'],
    ] as const)('maps endReason=%s to port %s', (endReason, port) => {
      const executor = buildExecutor();
      const result = executor.buildMultiTurnFinalOutput(
        [],
        '',
        1,
        endReason,
        meta,
      ) as Record<string, unknown>;
      expect(result.port).toBe(port);
      expect(result.status).toBe('ended');
    });
  });

  // spec §12.7 — form 제출 tool_result content 의 byte cap. 복잡한 순수 함수라
  // executor 모듈에서 export 해 직접 단위 고정한다 (ai-review WARNING #7).
  describe('capFormDataBytes', () => {
    it('returns formData unchanged below the cap (no truncation meta)', () => {
      const formData = { name: '홍길동', note: 'short' };
      const { capped, formDataTruncation } = capFormDataBytes(
        formData,
        FORM_SUBMITTED_MAX_BYTES,
      );
      expect(capped).toEqual(formData);
      expect(formDataTruncation).toBeUndefined();
    });

    it('truncates oversized string fields and reports truncation meta', () => {
      const big = 'a'.repeat(FORM_SUBMITTED_MAX_BYTES + 5000);
      const { capped, formDataTruncation } = capFormDataBytes(
        { essay: big, keep: 1 },
        FORM_SUBMITTED_MAX_BYTES,
      );
      expect(formDataTruncation).toBeDefined();
      expect(formDataTruncation?.truncatedFields).toContain('essay');
      // 비-string 필드는 보존, 구조도 보존.
      expect((capped as { keep: number }).keep).toBe(1);
      expect(
        Buffer.byteLength(JSON.stringify(capped), 'utf8'),
      ).toBeLessThanOrEqual(
        Buffer.byteLength(JSON.stringify({ essay: big, keep: 1 }), 'utf8'),
      );
    });

    it('truncates on UTF-8 byte boundaries (multibyte safe)', () => {
      // 한글은 3 bytes/char — byte 단위 절단이 valid UTF-8 을 깨지 않아야 한다.
      const big = '가'.repeat(FORM_SUBMITTED_MAX_BYTES);
      const { capped } = capFormDataBytes(
        { ko: big },
        FORM_SUBMITTED_MAX_BYTES,
      );
      // round-trip 가능한 valid UTF-8 인지 확인 (깨진 surrogate 없음).
      expect(() => JSON.stringify(capped)).not.toThrow();
      expect(typeof (capped as { ko: string }).ko).toBe('string');
    });

    it('attaches truncation meta even when no string field is truncatable', () => {
      // 모든 필드가 비-string 인데 cap 초과 — truncate 대상 없음이지만 메타는 부착.
      const arr = Array.from({ length: 4000 }, (_, i) => i);
      const { capped, formDataTruncation } = capFormDataBytes(
        { ids: arr },
        FORM_SUBMITTED_MAX_BYTES,
      );
      expect(capped).toEqual({ ids: arr });
      expect(formDataTruncation?.truncatedFields).toEqual([]);
    });
  });

  // spec §6.2 step 2.c — render_form 제출 resume 분기를 executor 레벨에서 직접
  // 고정 (ai-review WARNING #8). pendingFormToolCall 클리어 부작용 포함.
  describe('processMultiTurnMessage — form_submitted resume', () => {
    const formResumeState = (): Record<string, unknown> => ({
      llmConfigId: 'cfg-1',
      model: 'gpt-4o',
      maxToolCalls: 10,
      maxTurns: 20,
      knowledgeBases: [],
      conditions: [],
      mcpServers: [],
      presentationTools: [],
      // 직전 turn 의 render_form tool_use 가 messages 에 남아 있어야 tool_result
      // splice 가 toolCallId 로 매칭된다 (tool_use ↔ tool_result 페어링).
      messages: [
        { role: 'system', content: 'sys' },
        {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'form-tc-1', name: 'render_form', arguments: {} }],
        },
      ],
      turnCount: 1,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalThinkingTokens: 0,
      toolCalls: 0,
      ragSources: [],
      workspaceId: 'ws-1',
      executionId: 'exec-1',
      memoryStrategy: 'manual',
      pendingFormToolCall: { toolCallId: 'form-tc-1', formConfig: {} },
    });

    it('splices the form tool_result, clears pendingFormToolCall, and continues', async () => {
      const executor = buildExecutor();
      const state = formResumeState();
      const result = (await executor.processMultiTurnMessage(
        JSON.stringify({ email: 'a@b.com' }),
        state,
        { source: 'form_submitted' },
      )) as Record<string, unknown>;

      // form 제출 후 LLM 재호출 → waiting 재진입.
      expect(result.status).toBe('waiting_for_input');
      expect(mockLlmService.chat).toHaveBeenCalledTimes(1);
      // pendingFormToolCall 클리어 부작용 (호출자 state 변이).
      expect(state.pendingFormToolCall).toBeUndefined();
      // 다음 turn resume state 에도 pendingFormToolCall 이 남지 않는다.
      const next = result._resumeState as Record<string, unknown>;
      expect(next.pendingFormToolCall).toBeUndefined();
    });

    // C-2 2차 (review W3) — form bypass(handleMultiTurnUserMessageEntry §6.2
    // 2.c.bypass): 사용자가 form 활성 중 일반 ai_message 를 보내면 render_form
    // tool_use 를 cancelled tool_result 로 채우고 pendingFormToolCall 클리어 +
    // 정상 ai_user turn 진행 (tool_use↔tool_result 매칭 보존).
    it('bypasses the active form on a plain ai_message: cancels the tool_result and clears pendingFormToolCall', async () => {
      const executor = buildExecutor();
      const state = formResumeState();
      const result = (await executor.processMultiTurnMessage(
        '그냥 다른 질문할게요',
        state,
        { source: 'ai_message' },
      )) as Record<string, unknown>;

      expect(result.status).toBe('waiting_for_input');
      expect(mockLlmService.chat).toHaveBeenCalledTimes(1);
      // bypass: pendingFormToolCall 클리어 (caller state + resume state).
      expect(state.pendingFormToolCall).toBeUndefined();
      const next = result._resumeState as Record<string, unknown>;
      expect(next.pendingFormToolCall).toBeUndefined();
      // cancelled tool_result 가 render_form tool_use(form-tc-1)와 매칭되어 삽입됨.
      const msgs = next.messages as Array<{
        role: string;
        toolCallId?: string;
        content?: string;
      }>;
      const cancelled = msgs.find(
        (m) => m.role === 'tool' && m.toolCallId === 'form-tc-1',
      );
      expect(cancelled).toBeDefined();
      expect(cancelled!.content).toContain('user_sent_message_instead');
    });
  });

  // spec §4.2 / §7.3 / §10 — buildTools 결과 도구 정의 payload 예산 fail-fast.
  // 예산 초과 도구셋을 가짜 provider 로 주입해, single-turn 이 LLM 호출 전에
  // error 포트 output 을 **return** 하는지 (throw 전파 아님) 를 고정한다.
  describe('tool-definition payload budget (§4.2)', () => {
    const HARD = 'AI_AGENT_TOOL_PAYLOAD_HARD_BYTES';
    let savedHard: string | undefined;
    beforeEach(() => {
      savedHard = process.env[HARD];
    });
    afterEach(() => {
      if (savedHard === undefined) delete process.env[HARD];
      else process.env[HARD] = savedHard;
    });

    // 예산 초과 도구를 노출하는 최소 provider (mcp_ 접두 → culprit 지목 검증).
    const bloatedProvider = () => ({
      key: 'mcp',
      matches: (name: string) => name.startsWith('mcp_'),
      buildTools: jest.fn().mockResolvedValue([
        {
          name: 'mcp_cafe24__giant_op',
          description: 'x'.repeat(400),
          parameters: { type: 'object', properties: {} },
        },
      ]),
      execute: jest.fn(),
    });

    it('returns the `error` port with TOOL_DEFINITION_PAYLOAD_EXCEEDED before calling the LLM', async () => {
      process.env[HARD] = '50'; // 아주 낮게 → hard 초과 강제.
      const provider = bloatedProvider();
      const executor = buildExecutor({ toolProviders: [provider] });

      const result = (await executor.executeSingleTurn(
        undefined,
        {
          mode: 'single_turn',
          model: '{{ vars.model }}',
          systemPrompt: 'sys',
          userPrompt: 'Hi',
          mcpServers: [{ integrationId: 'i-1' }],
        },
        baseContext,
      )) as Record<string, unknown>;

      expect(result.port).toBe('error');
      expect(result.status).toBe('ended');
      // LLM 호출 전 fail-fast — chat 미호출 (6분 hang 제거의 핵심).
      expect(mockLlmService.chat).not.toHaveBeenCalled();

      const output = result.output as {
        error: {
          code: string;
          message: string;
          details: Record<string, unknown>;
        };
      };
      expect(output.error.code).toBe('TOOL_DEFINITION_PAYLOAD_EXCEEDED');
      expect(output.error.details.retryable).toBe(false);
      expect(output.error.details.budgetBytes).toBe(50);
      expect(output.error.details.toolCount).toBe(1);
      expect(output.error.details.culpritProvider).toBe('mcp:cafe24');
      expect(output.error.message).toContain('mcpServers[].enabledTools');

      // config echo (Principle 7) — raw template 보존, 정상 out 종결과 동일 shape.
      const cfg = result.config as Record<string, unknown>;
      expect(cfg.mode).toBe('single_turn');
      expect(cfg.model).toBe('{{ vars.model }}');
      const meta = result.meta as Record<string, unknown>;
      expect(typeof meta.durationMs).toBe('number');
    });

    it('does not fire under the default (generous) budget', async () => {
      const provider = bloatedProvider();
      const executor = buildExecutor({ toolProviders: [provider] });
      const result = (await executor.executeSingleTurn(
        undefined,
        { mode: 'single_turn', systemPrompt: 'sys', userPrompt: 'Hi' },
        baseContext,
      )) as Record<string, unknown>;
      expect(result.port).toBe('out');
      expect(mockLlmService.chat).toHaveBeenCalledTimes(1);
    });

    it('throws out of buildTools so multi-turn resume can route via extractAiTurnErrorPayload', async () => {
      process.env[HARD] = '50';
      const provider = bloatedProvider();
      const executor = buildExecutor({ toolProviders: [provider] });
      // processMultiTurnMessage 는 buildTools throw 를 감싸지 않는다 (orchestrator
      // 의 handleAiMessageTurn try/catch → extractAiTurnErrorPayload 가 code/details
      // 를 passthrough) — 여기선 throw 가 전파됨을 고정한다.
      await expect(
        executor.processMultiTurnMessage('안녕하세요', {
          llmConfigId: 'cfg-1',
          model: 'gpt-4o',
          maxToolCalls: 10,
          maxTurns: 20,
          knowledgeBases: [],
          conditions: [],
          mcpServers: [{ integrationId: 'i-1' }],
          presentationTools: [],
          messages: [{ role: 'system', content: 'sys' }],
          turnCount: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalThinkingTokens: 0,
          toolCalls: 0,
          ragSources: [],
          workspaceId: 'ws-1',
          executionId: 'exec-1',
          memoryStrategy: 'manual',
        }),
      ).rejects.toMatchObject({ code: 'TOOL_DEFINITION_PAYLOAD_EXCEEDED' });
      expect(mockLlmService.chat).not.toHaveBeenCalled();
    });

    // 03 W7 — executeSingleTurn 의 buildTools try/catch 는 `Tool
    // DefinitionPayloadExceededError` 만 흡수해 error 포트로 반환하고, 그 외
    // 에러는 rethrow(else 분기)한다. buildTools 내부 `enforceToolPayloadBudget`
    // 호출은 provider try/catch 로 감싸지 않으므로, malformed 도구 이름(비-string)
    // 이 `toolProviderGroupKey` 에서 TypeError 를 유발하도록 해 non-budget 에러
    // 전파 경로를 고정한다.
    it('rethrows non-budget errors surfaced from buildTools instead of routing them to the error port', async () => {
      const brokenProvider = {
        key: 'broken',
        matches: () => true,
        buildTools: jest.fn().mockResolvedValue([
          // name 이 string 이 아니면 toolProviderGroupKey(tool.name) 가 던진다 —
          // ToolDefinitionPayloadExceededError 가 아닌 에러의 유일한 현실적 트리거.
          { name: undefined, description: 'x', parameters: {} },
        ]),
        execute: jest.fn(),
      };
      const executor = buildExecutor({ toolProviders: [brokenProvider] });

      await expect(
        executor.executeSingleTurn(
          undefined,
          { mode: 'single_turn', systemPrompt: 'sys', userPrompt: 'Hi' },
          baseContext,
        ),
      ).rejects.toBeInstanceOf(TypeError);
      expect(mockLlmService.chat).not.toHaveBeenCalled();
    });
  });

  // 재실행 dry-run 임시 가드 — provider 는 ProviderExecCtx.dryRun 을 보고 MCP 도구
  // 호출을 건너뛴다. 단일 턴 · 멀티턴 첫 턴 · resume 턴 모두 값이 전달돼야 한다.
  describe('ProviderExecCtx.dryRun (re-run dry-run guard)', () => {
    const recordingProvider = () => {
      const execute = jest.fn(
        async (call: { id: string }, _ctx?: { dryRun?: boolean }) => ({
          toolCallId: call.id,
          content: '{}',
          status: 'success' as const,
        }),
      );
      return {
        execute,
        provider: {
          key: 'mcp',
          matches: (n: string) => n.startsWith('mcp_'),
          buildTools: async () => [
            {
              name: 'mcp_abcd1234__do',
              description: 'd',
              parameters: { type: 'object', properties: {} },
            },
          ],
          execute,
        },
      };
    };
    const toolCallThenStop = () =>
      mockLlmService.chat
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [{ id: 't1', name: 'mcp_abcd1234__do', arguments: {} }],
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'done',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          model: 'gpt-4o',
          finishReason: 'stop',
        });
    const dryContext = makeExecutionContext({
      executionId: 'exec-1',
      workflowId: 'wf-1',
      variables: { __workspaceId: 'ws-1', __dryRun: true },
    });

    it.each([
      ['dry-run', dryContext, true],
      ['normal run', baseContext, false],
    ])(
      'single-turn passes dryRun to provider.execute on a %s',
      async (_label, context, expected) => {
        const { provider, execute } = recordingProvider();
        toolCallThenStop();
        const executor = buildExecutor({ toolProviders: [provider] });

        await executor.executeSingleTurn(
          undefined,
          {
            mode: 'single_turn',
            systemPrompt: 'sys',
            userPrompt: 'Hi',
            mcpServers: [{ integrationId: 'i-a' }],
          },
          context,
        );

        expect(execute).toHaveBeenCalledTimes(1);
        expect(execute.mock.calls[0][1]).toMatchObject({ dryRun: expected });
      },
    );

    it('multi-turn first turn carries dryRun into _resumeState', async () => {
      const executor = buildExecutor();
      const result = (await executor.executeMultiTurn(
        undefined,
        { mode: 'multi_turn', systemPrompt: 'sys' },
        dryContext,
      )) as unknown as Record<string, unknown>;

      expect((result._resumeState as { dryRun?: unknown }).dryRun).toBe(true);
    });

    it.each([
      [true, true],
      [undefined, false],
    ])(
      'resume turn with state.dryRun=%s passes dryRun=%s to provider.execute',
      async (stateDryRun, expected) => {
        const { provider, execute } = recordingProvider();
        toolCallThenStop();
        const executor = buildExecutor({ toolProviders: [provider] });

        await executor.processMultiTurnMessage('go', {
          llmConfigId: 'cfg-1',
          model: 'gpt-4o',
          maxToolCalls: 10,
          maxTurns: 20,
          knowledgeBases: [],
          conditions: [],
          mcpServers: [{ integrationId: 'i-a' }],
          presentationTools: [],
          messages: [{ role: 'system', content: 'sys' }],
          turnCount: 0,
          toolCalls: 0,
          ragSources: [],
          workspaceId: 'ws-1',
          executionId: 'exec-1',
          memoryStrategy: 'manual',
          ...(stateDryRun === undefined ? {} : { dryRun: stateDryRun }),
        });

        expect(execute).toHaveBeenCalledTimes(1);
        expect(execute.mock.calls[0][1]).toMatchObject({ dryRun: expected });
      },
    );
  });

  // CLE-NODE-INT-COMMON 「IntegrationsService API (실행 엔진용)」 · CLE-EXEC-STATE 「보존 예외 `_resumeCheckpoint`」 —
  // 도구 목록 구성 문맥에 노드 ID 를 싣고, 서버 항목마다 첫 턴의 표현식 여부를 싣는다.
  describe('ProviderBuildCtx — nodeId · 서버 항목의 fromExpression', () => {
    const A = '11111111-1111-4111-8111-111111111111';
    const B = '22222222-2222-4222-8222-222222222222';
    const capturingProvider = () => {
      const buildTools = jest.fn(async (_ctx: ProviderBuildCtx) => []);
      return {
        buildTools,
        provider: {
          key: 'mcp',
          matches: (n: string) => n.startsWith('mcp_'),
          buildTools,
          execute: jest.fn(),
        },
      };
    };
    const ctxWithRaw = (rawMcpServers: unknown) =>
      makeExecutionContext({
        executionId: 'exec-1',
        workflowId: 'wf-1',
        nodeId: 'node-1',
        variables: { __workspaceId: 'ws-1' },
        rawConfig: Object.freeze({ mcpServers: rawMcpServers }),
      });

    it('single-turn: context.nodeId 를 싣고 원본과 비교한 fromExpression 으로 덮어쓴다', async () => {
      const { buildTools, provider } = capturingProvider();
      const executor = buildExecutor({ toolProviders: [provider] });
      await executor.executeSingleTurn(
        undefined,
        {
          mode: 'single_turn',
          systemPrompt: 'sys',
          userPrompt: 'go',
          mcpServers: [
            { integrationId: A, fromExpression: true },
            { integrationId: B, fromExpression: false },
          ],
        },
        ctxWithRaw([{ integrationId: A }, { integrationId: '{{ $vars.b }}' }]),
      );
      const ctx = buildTools.mock.calls[0][0];
      expect(ctx.nodeId).toBe('node-1');
      expect(ctx.config.mcpServers).toEqual([
        { integrationId: A, fromExpression: false },
        { integrationId: B, fromExpression: true },
      ]);
    });

    it('single-turn: rawConfig 가 없으면 모든 서버 항목이 표현식이다(평가값으로 폴백하지 않는다)', async () => {
      const { buildTools, provider } = capturingProvider();
      const executor = buildExecutor({ toolProviders: [provider] });
      await executor.executeSingleTurn(
        undefined,
        {
          mode: 'single_turn',
          systemPrompt: 'sys',
          userPrompt: 'go',
          mcpServers: [{ integrationId: A }],
        },
        makeExecutionContext({
          executionId: 'exec-1',
          workflowId: 'wf-1',
          nodeId: 'node-1',
          variables: { __workspaceId: 'ws-1' },
        }),
      );
      expect(buildTools.mock.calls[0][0].config.mcpServers).toEqual([
        { integrationId: A, fromExpression: true },
      ]);
    });

    // CLE-T-92RQWB — 한 번의 도구 목록 만들기 안에서 프로바이더들이 같은 통합 조회 범위를 쓰고, 다음 호출은 새 범위를 쓴다.
    it('도구 목록을 만들 때마다 조회 범위를 하나 만들어 모든 프로바이더에 같은 것을 넘긴다', async () => {
      const first = capturingProvider();
      const second = capturingProvider();
      const executor = buildExecutor({
        toolProviders: [first.provider, { ...second.provider, key: 'cafe24' }],
      });
      const runTurn = () =>
        executor.executeSingleTurn(
          undefined,
          {
            mode: 'single_turn',
            systemPrompt: 'sys',
            userPrompt: 'go',
            mcpServers: [{ integrationId: A, fromExpression: false }],
          },
          ctxWithRaw([{ integrationId: A }]),
        );

      await runTurn();
      await runTurn();

      expect(first.buildTools).toHaveBeenCalledTimes(2);
      expect(second.buildTools).toHaveBeenCalledTimes(2);
      const turn1 = first.buildTools.mock.calls[0][0].integrationLookupScope;
      const turn2 = first.buildTools.mock.calls[1][0].integrationLookupScope;
      expect(turn1).toBeInstanceOf(ExecutionLookupScope);
      expect(second.buildTools.mock.calls[0][0].integrationLookupScope).toBe(
        turn1,
      );
      expect(turn2).toBeInstanceOf(ExecutionLookupScope);
      expect(turn2).not.toBe(turn1);
      expect(second.buildTools.mock.calls[1][0].integrationLookupScope).toBe(
        turn2,
      );
    });

    it.each<[string, unknown]>([
      ['키 없음', undefined],
      ['표현식을 평가하지 못한 문자열', '{{ $vars.servers }}'],
    ])(
      'single-turn: 평가한 서버 목록이 배열이 아니면(%s) 프로바이더는 빈 목록을 받는다',
      async (_label, evaluated) => {
        const { buildTools, provider } = capturingProvider();
        const executor = buildExecutor({ toolProviders: [provider] });
        await executor.executeSingleTurn(
          undefined,
          {
            mode: 'single_turn',
            systemPrompt: 'sys',
            userPrompt: 'go',
            ...(evaluated === undefined ? {} : { mcpServers: evaluated }),
          },
          ctxWithRaw([{ integrationId: A }]),
        );
        expect(buildTools.mock.calls[0][0].config.mcpServers).toEqual([]);
      },
    );

    it('multi-turn 첫 턴: 평가한 서버 목록이 배열이 아니면 _resumeState.mcpServers 는 빈 목록이다', async () => {
      const executor = buildExecutor();
      const result = (await executor.executeMultiTurn(
        undefined,
        {
          mode: 'multi_turn',
          systemPrompt: 'sys',
          mcpServers: '{{ $vars.servers }}',
        },
        ctxWithRaw([{ integrationId: A }]),
      )) as { _resumeState: Record<string, unknown> };
      expect(result._resumeState.mcpServers).toEqual([]);
    });

    it('multi-turn 첫 턴: _resumeState.mcpServers 에 서버별 fromExpression 을 저장한다', async () => {
      const executor = buildExecutor();
      const result = (await executor.executeMultiTurn(
        undefined,
        {
          mode: 'multi_turn',
          systemPrompt: 'sys',
          mcpServers: [{ integrationId: A }, { integrationId: B }],
        },
        ctxWithRaw([{ integrationId: '{{ $vars.a }}' }, { integrationId: B }]),
      )) as { _resumeState: Record<string, unknown> };
      expect(result._resumeState.nodeId).toBe('node-1');
      expect(result._resumeState.mcpServers).toEqual([
        { integrationId: A, fromExpression: true },
        { integrationId: B, fromExpression: false },
      ]);
    });

    it('재개 턴: 상태의 nodeId 와 저장된 서버 항목을 그대로 싣는다(원본과 다시 맞추지 않는다)', async () => {
      const { buildTools, provider } = capturingProvider();
      const executor = buildExecutor({ toolProviders: [provider] });
      const stored = [
        { integrationId: A, fromExpression: false },
        { integrationId: B },
      ];
      await executor.processMultiTurnMessage('hi', {
        llmConfigId: 'cfg-1',
        model: 'gpt-4o',
        maxToolCalls: 10,
        maxTurns: 20,
        knowledgeBases: [],
        conditions: [],
        mcpServers: stored,
        presentationTools: [],
        messages: [{ role: 'system', content: 'sys' }],
        turnCount: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalThinkingTokens: 0,
        toolCalls: 0,
        ragSources: [],
        workspaceId: 'ws-1',
        executionId: 'exec-1',
        nodeId: 'node-1',
        memoryStrategy: 'manual',
        // 재개마다 다시 만드는 rawConfig 는 읽지 않는다.
        rawConfig: {
          mcpServers: [{ integrationId: '{{ x }}' }, { integrationId: B }],
        },
      });
      const ctx = buildTools.mock.calls[0][0];
      expect(ctx.nodeId).toBe('node-1');
      expect(ctx.config.mcpServers).toEqual(stored);
    });
  });
});
