import { Logger } from '@nestjs/common';
import {
  NodeHandler,
  ExecutionContext,
  ValidationResult,
  ResumableNodeHandlerOutput,
} from '../../core/node-handler.interface';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';
import { LlmService } from '../../../modules/llm/llm.service';
import {
  ChatMessage,
  ToolCall,
  ToolDef,
} from '../../../modules/llm/interfaces/llm-client.interface';
import {
  AgentToolProvider,
  AgentToolResult,
  KbSearchDiagnostic,
} from './tool-providers/agent-tool-provider.interface';
import { aiAgentNodeMetadata } from './ai-agent.schema';
import {
  ExecutionEventType,
  ToolCallCompletedPayload,
  ToolCallStartedPayload,
  WebsocketService,
} from '../../../modules/websocket/websocket.service';

/**
 * Per-tool execution metadata recorded into `meta.turnDebug[].toolCalls`. The
 * UI uses this (rather than parsing tool message content) to render
 * success / error badges and durations on each tool item in the timeline.
 * Source-of-truth for the ConversationItem.toolStatus field on the client.
 */
export interface ToolCallTrace {
  toolCallId: string;
  name: string;
  providerKey?: string;
  status: 'success' | 'error';
  durationMs: number;
  error?: string;
}

/**
 * Cap for tool_result preview broadcast over WebSocket (`tool_call_completed`).
 * The full content is still recorded in `messages` (sent only via the
 * `ai_message` snapshot at turn end) and persisted in `outputData`. The live
 * event is informational — it just needs enough to identify the result.
 * Limits exposure of KB chunks / MCP responses to passive WS subscribers.
 */
const TOOL_RESULT_PREVIEW_CHARS = 200;

function previewContent(content: string): string {
  if (content.length <= TOOL_RESULT_PREVIEW_CHARS) return content;
  return content.slice(0, TOOL_RESULT_PREVIEW_CHARS) + '...';
}

/**
 * Sanitize an exception message before exposing it via WS / UI / outputData.
 * Internal exceptions can carry DB connection strings, internal hostnames,
 * stack details, etc. We surface only a short user-facing summary; the full
 * original message is kept in server logs (see Logger.warn paths in
 * provider implementations).
 */
function sanitizeToolError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  // Strip long base64 / token-shaped substrings and truncate. The leading
  // sentence is usually safe; very long messages are almost always
  // serialized internals.
  const firstLine = raw.split('\n')[0]?.trim() ?? raw;
  if (firstLine.length > 200) return firstLine.slice(0, 200) + '...';
  return firstLine || 'Tool execution failed';
}

/**
 * 한 번의 노드 실행에서 누적된 RAG 진단 정보. KB tool 호출이 일어날 때마다
 * {@link RagAccumulator} 가 채우며, 노드 결과의 `meta.ragDiagnostics` 로 노출된다.
 */
interface RagDiagnostics {
  /** 노드 실행 중 KB tool 이 1번 이상 호출됐는지. */
  attempted: boolean;
  /** 호출된 distinct KB 수. */
  searchedKbCount: number;
  /** LLM 이 보낸 쿼리들의 합집합 (호출 순서 유지). */
  queriesUsed: string[];
  /** 모든 KB tool 호출에서 회수된 chunk 수의 합. */
  resultCount: number;
  /** 사유 — KB 미설정/빈 결과 등 사용자 디버깅용. */
  skipReason?: 'empty_kb_list' | 'no_results';
}

interface ConditionDef {
  id: string;
  label: string;
  prompt: string;
}

interface ConditionClassification {
  providerToolCalls: Array<{ provider: AgentToolProvider; call: ToolCall }>;
  conditionToolCalls: ToolCall[];
  normalToolCalls: ToolCall[];
  matchedCondition: ConditionDef | null;
}

/** Replace non-alphanumeric/underscore chars for LLM-safe tool names. */
function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, '_');
}

/** Build LLM tool name for a condition. */
function condToolName(conditionId: string): string {
  return `cond_${sanitizeId(conditionId)}`;
}

const KB_TOOL_GUIDANCE =
  '\n\n[Knowledge Base] 사용자 질문이 지식 조회를 필요로 하면 등록된 `kb_*` 도구를 호출하세요. ' +
  '다중 의도면 여러 도구를 동시에 호출해도 되고, 결과가 부족하면 다른 query 로 다시 호출하세요. ' +
  'KB 가 필요 없는 small-talk 등에는 호출하지 마세요.';

/**
 * Provider 가 반환한 diagnostic delta 를 노드 단위로 누적.
 * `meta.ragDiagnostics` / `meta.ragSources` 의 값을 한곳에서 만들기 위한 헬퍼.
 */
class RagAccumulator {
  private readonly searchedKbIds = new Set<string>();
  private readonly queries: string[] = [];
  private resultCount = 0;
  private attempted = false;
  private readonly sources: unknown[] = [];
  // Dedupe by chunkId — multi-turn conversations and parallel KB tool calls
  // can return the same chunk multiple times. Keeping the first occurrence
  // (highest score from its first match) keeps the References tab tidy and
  // prevents React key collisions on `<li key={s.chunkId}>` in the UI.
  private readonly seenChunkIds = new Set<string>();

  constructor(private readonly initialKbCount: number) {}

  pushSources(items: unknown[] | undefined): void {
    if (!items || items.length === 0) return;
    for (const item of items) {
      const chunkId =
        item && typeof item === 'object'
          ? ((item as { chunkId?: unknown }).chunkId as string | undefined)
          : undefined;
      if (typeof chunkId === 'string') {
        if (this.seenChunkIds.has(chunkId)) continue;
        this.seenChunkIds.add(chunkId);
      }
      this.sources.push(item);
    }
  }

  pushDiagnostic(d: KbSearchDiagnostic | undefined): void {
    if (!d) return;
    this.attempted = true;
    this.searchedKbIds.add(d.kbId);
    this.queries.push(d.query);
    this.resultCount += d.resultCount;
  }

  getSources(): unknown[] {
    return this.sources;
  }

  getDiagnostics(): RagDiagnostics {
    if (this.initialKbCount === 0) {
      return {
        attempted: false,
        searchedKbCount: 0,
        queriesUsed: [],
        resultCount: 0,
        skipReason: 'empty_kb_list',
      };
    }
    if (!this.attempted) {
      return {
        attempted: false,
        searchedKbCount: 0,
        queriesUsed: [],
        resultCount: 0,
      };
    }
    const base: RagDiagnostics = {
      attempted: true,
      searchedKbCount: this.searchedKbIds.size,
      queriesUsed: [...this.queries],
      resultCount: this.resultCount,
    };
    if (this.resultCount === 0) {
      base.skipReason = 'no_results';
    }
    return base;
  }

  /** Multi-turn resume 를 위해 기존 ragSources 배열을 hydrate. */
  static fromState(
    initialKbCount: number,
    existingSources: unknown[],
  ): RagAccumulator {
    const acc = new RagAccumulator(initialKbCount);
    // Hydrate the dedupe set so subsequent pushSources() calls don't
    // re-add chunks that were already collected on prior turns.
    for (const item of existingSources) {
      const chunkId =
        item && typeof item === 'object'
          ? ((item as { chunkId?: unknown }).chunkId as string | undefined)
          : undefined;
      if (typeof chunkId === 'string') acc.seenChunkIds.add(chunkId);
    }
    acc.sources.push(...existingSources);
    return acc;
  }
}

/**
 * 노드 누적과 turn delta 두 accumulator 를 동시에 갱신하는 thin wrapper.
 * "delta 의 합 = 노드 전체 누적" 불변식을 호출자 규율 대신 타입 시스템 수준에서
 * 강제한다. provider 결과를 한 번 push 하면 두 곳이 항상 동기 상태.
 */
class RagAccumulatorGroup {
  constructor(
    readonly node: RagAccumulator,
    readonly turn: RagAccumulator,
  ) {}

  pushSources(items: unknown[] | undefined): void {
    this.node.pushSources(items);
    this.turn.pushSources(items);
  }

  pushDiagnostic(d: KbSearchDiagnostic | undefined): void {
    this.node.pushDiagnostic(d);
    this.turn.pushDiagnostic(d);
  }
}

export class AiAgentHandler implements NodeHandler {
  metadata = aiAgentNodeMetadata;

  constructor(
    private readonly llmService: LlmService,
    private readonly toolProviders: AgentToolProvider[] = [],
    /**
     * Optional. When provided, each provider tool execution emits
     * `tool_call_started` / `tool_call_completed` events on the WS channel
     * `execution:{executionId}` so the debugging timeline can render
     * pending → success / error transitions live. Test fixtures may omit
     * this — the handler runs unchanged otherwise.
     */
    private readonly websocketService?: WebsocketService,
  ) {}

  /**
   * Run a provider tool with telemetry: emit started/completed WS events,
   * catch exceptions so the LLM can still recover in the next turn, and
   * record a {@link ToolCallTrace} for `meta.turnDebug[].toolCalls`.
   */
  private async runProviderTool(args: {
    provider: AgentToolProvider;
    call: ToolCall;
    executionId: string;
    nodeId: string;
    nodeExecutionId?: string;
    workflowId?: string;
    workspaceId: string;
    config: Record<string, unknown>;
    turnIndex: number;
  }): Promise<{ result: AgentToolResult; trace: ToolCallTrace }> {
    const { provider, call, executionId, nodeId, turnIndex } = args;
    const startedAt = Date.now();

    const startedPayload: ToolCallStartedPayload = {
      nodeId,
      turnIndex,
      toolCallId: call.id,
      name: call.name,
      arguments: call.arguments,
    };
    this.websocketService?.emitExecutionEvent(
      executionId,
      ExecutionEventType.TOOL_CALL_STARTED,
      startedPayload,
    );

    let result: AgentToolResult;
    let status: 'success' | 'error';
    let error: string | undefined;

    try {
      result = await provider.execute(call, {
        config: args.config,
        workspaceId: args.workspaceId,
        executionId,
        nodeExecutionId: args.nodeExecutionId,
        workflowId: args.workflowId,
      });
      status = result.status ?? 'success';
      error = result.error;
    } catch (err: unknown) {
      // Log the full original exception server-side for debugging and
      // surface only a sanitized summary to client / LLM context.
      const sanitized = sanitizeToolError(err);
      AiAgentHandler.logger.warn(
        `Provider "${provider.key}" tool ${call.name} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      result = {
        toolCallId: call.id,
        content: JSON.stringify({ error: sanitized }),
        status: 'error',
        error: sanitized,
      };
      status = 'error';
      error = sanitized;
    }

    const durationMs = Date.now() - startedAt;
    const trace: ToolCallTrace = {
      toolCallId: call.id,
      name: call.name,
      providerKey: provider.key,
      status,
      durationMs,
      ...(error !== undefined ? { error } : {}),
    };

    if (status === 'error') {
      AiAgentHandler.logger.warn(
        `Tool call ${call.name} (${call.id}) finished with status=error in ${durationMs}ms: ${error}`,
      );
    }

    const completedPayload: ToolCallCompletedPayload = {
      nodeId,
      turnIndex,
      toolCallId: call.id,
      // Preview only — full result lives in the messages snapshot sent via
      // `ai_message` and in persisted outputData.
      content: previewContent(result.content),
      status,
      ...(error !== undefined ? { error } : {}),
      durationMs,
    };
    this.websocketService?.emitExecutionEvent(
      executionId,
      ExecutionEventType.TOOL_CALL_COMPLETED,
      completedPayload,
    );

    return { result, trace };
  }

  validate(config: Record<string, unknown>): ValidationResult {
    // Schema SSOT (warningRules + validateConfig) covers no-llm-provider,
    // multi-turn-needs-system-prompt, single-turn-needs-prompt,
    // too-many-conditions, maxTurns numeric guard, per-condition
    // id/label/prompt + reserved-port collision + 2000-char prompt cap.
    const errors = evaluateMetadataBlockingErrors(this.metadata, config);
    return { valid: errors.length === 0, errors };
  }

  async execute(
    input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<unknown> {
    const mode = (config.mode as string) || 'single_turn';

    try {
      if (mode === 'multi_turn') {
        return await this.executeMultiTurn(input, config, context);
      }
      return await this.executeSingleTurn(input, config, context);
    } finally {
      // Cleanup hook fires on every execute() return — including the
      // multi-turn `waiting_for_input` path. Sessions held by providers
      // (e.g. MCP) are torn down here so the next turn rebuilds them
      // deterministically from config. Cleanup errors are swallowed —
      // they would mask the upstream success/failure that triggered the
      // return.
      await this.cleanupProviders(context.executionId);
    }
  }

  private async cleanupProviders(executionId: string): Promise<void> {
    await Promise.allSettled(
      this.toolProviders.map((p) =>
        p.cleanup
          ? p.cleanup({ executionId }).catch((err: unknown) => {
              const msg = err instanceof Error ? err.message : String(err);
              AiAgentHandler.logger.warn(
                `Provider "${p.key}" cleanup failed: ${msg}`,
              );
            })
          : Promise.resolve(),
      ),
    );
  }

  private async executeSingleTurn(
    _input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<unknown> {
    const llmConfigId = config.llmConfigId as string | undefined;
    const model = config.model as string | undefined;
    const systemPrompt = (config.systemPrompt as string) || '';
    const userPrompt = (config.userPrompt as string) || '';
    const temperature = config.temperature as number | undefined;
    const maxTokens = config.maxTokens as number | undefined;
    const responseFormat = (config.responseFormat as 'text' | 'json') || 'text';
    const jsonSchema = config.jsonSchema as Record<string, unknown> | undefined;
    const knowledgeBases = (config.knowledgeBases as string[]) || [];
    const maxToolCalls = (config.maxToolCalls as number) || 10;
    const conditions = (config.conditions as ConditionDef[]) || [];

    const workspaceId = (context.variables?.__workspaceId as string) || '';
    const llmConfig = await this.llmService.resolveConfig(
      llmConfigId,
      workspaceId,
    );

    const ragAcc = new RagAccumulator(knowledgeBases.length);
    // Single-turn 은 한 턴이라 turn delta = 노드 누적이지만, turnDebug[0]
    // 도 동일 키로 노출해 멀티턴 출력과 스키마 일관성을 유지한다.
    const turnRagAcc = new RagAccumulator(knowledgeBases.length);
    const ragGroup = new RagAccumulatorGroup(ragAcc, turnRagAcc);

    // System prompt: KB 검색은 더 이상 prefill 하지 않는다. LLM 이 능동 호출 결정.
    let finalSystemPrompt = systemPrompt;
    if (knowledgeBases.length > 0) {
      finalSystemPrompt += KB_TOOL_GUIDANCE;
    }
    if (conditions.length > 0) {
      finalSystemPrompt += this.buildConditionSystemPromptSuffix(conditions);
    }

    // Build messages
    const messages: ChatMessage[] = [];
    if (finalSystemPrompt) {
      messages.push({ role: 'system', content: finalSystemPrompt });
    }
    if (userPrompt) {
      messages.push({ role: 'user', content: userPrompt });
    }

    const tools = await this.buildTools(
      config,
      workspaceId,
      context.executionId,
    );

    // Per-call trace so the frontend LlmInformationTab can inspect each
    // request/response/usage even for single-turn runs (tool loop commonly
    // spans several calls).
    const llmCalls: Array<{
      requestPayload: unknown;
      responsePayload: unknown;
      durationMs: number;
    }> = [];
    const toolCallTraces: ToolCallTrace[] = [];
    const singleTurnStartedAt = Date.now();
    const firstRequest = {
      model: model || llmConfig.defaultModel,
      messages: [...messages],
      temperature,
      maxTokens,
      responseFormat,
      jsonSchema,
      tools: tools.length > 0 ? tools : undefined,
    };
    let callStartedAt = Date.now();
    let result = await this.llmService.chat(llmConfig, {
      model: model || llmConfig.defaultModel,
      messages,
      temperature,
      maxTokens,
      responseFormat,
      jsonSchema,
      tools: tools.length > 0 ? tools : undefined,
    });
    llmCalls.push({
      requestPayload: firstRequest,
      responsePayload: result,
      durationMs: Date.now() - callStartedAt,
    });

    let toolCallCount = 0;
    while (result.toolCalls?.length && toolCallCount < maxToolCalls) {
      const classification = this.classifyToolCalls(
        result.toolCalls,
        conditions,
      );

      // Case 1: Only condition tools (no provider, no normal) — route immediately.
      if (
        classification.providerToolCalls.length === 0 &&
        classification.normalToolCalls.length === 0 &&
        classification.matchedCondition
      ) {
        const reason = this.extractConditionReason(
          result.toolCalls,
          classification.matchedCondition.id,
        );
        messages.push({ role: 'assistant', content: result.content || '' });
        return this.buildConditionOutput(
          classification.matchedCondition,
          reason,
          messages,
          1,
          {
            model: result.model ?? (model || llmConfig.defaultModel),
            totalInputTokens: result.usage?.inputTokens ?? 0,
            totalOutputTokens: result.usage?.outputTokens ?? 0,
            totalThinkingTokens: result.usage?.thinkingTokens ?? 0,
            toolCalls: toolCallCount,
            ragSources: ragAcc.getSources(),
            ragDiagnostics: ragAcc.getDiagnostics(),
          },
          {
            llmCalls,
            totalDurationMs: Date.now() - singleTurnStartedAt,
          },
          [
            {
              turnIndex: 1,
              llmCalls,
              totalDurationMs: Date.now() - singleTurnStartedAt,
              ...(toolCallTraces.length > 0
                ? { toolCalls: [...toolCallTraces] }
                : {}),
              ragSources: turnRagAcc.getSources(),
              ragDiagnostics: turnRagAcc.getDiagnostics(),
            },
          ],
        );
      }

      // Case 2/3: provider / normal / mixed-with-condition — execute and continue.
      messages.push({
        role: 'assistant',
        content: result.content || '',
        toolCalls: result.toolCalls,
      });

      // Provider tools (KB 등) — 핸들러 내부 직접 실행, 결과 메시지 + ragGroup
      // 누적 (node total + turn delta 동시 갱신). throw 는 trace.error 로
      // 잡혀 다음 LLM turn 에 에러 content 가 전달된다 (turn 자체는 회복).
      for (const { provider, call } of classification.providerToolCalls) {
        toolCallCount++;
        const { result: execResult, trace } = await this.runProviderTool({
          provider,
          call,
          executionId: context.executionId,
          nodeId: context.nodeId ?? '',
          nodeExecutionId: context.nodeExecutionId,
          workflowId: context.workflowId,
          workspaceId,
          config,
          turnIndex: 1,
        });
        toolCallTraces.push(trace);
        ragGroup.pushSources(execResult.ragSourcesDelta);
        ragGroup.pushDiagnostic(execResult.ragDiagnosticsDelta);
        messages.push({
          role: 'tool',
          content: execResult.content,
          toolCallId: execResult.toolCallId,
        });
      }

      for (const tc of classification.conditionToolCalls) {
        // Condition tool: send deferral message (does not count toward toolCallCount).
        messages.push({
          role: 'tool',
          content: JSON.stringify({
            result:
              '확인되었습니다. 도구 실행 결과를 참고하여 최종 판단해주세요.',
          }),
          toolCallId: tc.id,
        });
      }

      for (const tc of classification.normalToolCalls) {
        toolCallCount++;
        messages.push({
          role: 'tool',
          content: JSON.stringify({
            result: `Tool ${tc.name} executed`,
            arguments: tc.arguments,
          }),
          toolCallId: tc.id,
        });
      }

      const loopRequest = {
        model: model || llmConfig.defaultModel,
        messages: [...messages],
        temperature,
        maxTokens,
        responseFormat,
        jsonSchema,
        tools,
      };
      callStartedAt = Date.now();
      result = await this.llmService.chat(llmConfig, {
        model: model || llmConfig.defaultModel,
        messages,
        temperature,
        maxTokens,
        responseFormat,
        jsonSchema,
        tools,
      });
      llmCalls.push({
        requestPayload: loopRequest,
        responsePayload: result,
        durationMs: Date.now() - callStartedAt,
      });
    }

    // Parse JSON response if needed
    let response: unknown = result.content;
    if (responseFormat === 'json' && result.content) {
      try {
        response = JSON.parse(result.content);
      } catch {
        response = result.content;
      }
    }

    // CONVENTIONS §8 — LLM-category nodes surface their domain result under
    // `output.result.*`. Single-turn AI Agent returns a final text/JSON
    // response plus per-turn debug trace; tokens and tool-call counts move
    // to `meta.*` (Principle 2).
    const singleTurnDurationMs = Date.now() - singleTurnStartedAt;
    return {
      config: {
        mode: 'single_turn' as const,
        model: model ?? llmConfig.defaultModel,
        systemPrompt,
        userPrompt,
        responseFormat,
        ...(conditions.length > 0 ? { conditions } : {}),
      },
      output: {
        result: {
          response,
          endReason: 'out' as const,
          turnCount: 1,
        },
      },
      meta: {
        durationMs: singleTurnDurationMs,
        model: result.model,
        inputTokens: result.usage?.inputTokens ?? 0,
        outputTokens: result.usage?.outputTokens ?? 0,
        totalTokens: result.usage?.totalTokens ?? 0,
        thinkingTokens: result.usage?.thinkingTokens ?? 0,
        toolCalls: toolCallCount,
        ragSources: ragAcc.getSources(),
        ragDiagnostics: ragAcc.getDiagnostics(),
        turnDebug: [
          {
            turnIndex: 1,
            llmCalls,
            totalDurationMs: singleTurnDurationMs,
            ...(toolCallTraces.length > 0
              ? { toolCalls: [...toolCallTraces] }
              : {}),
            ragSources: turnRagAcc.getSources(),
            ragDiagnostics: turnRagAcc.getDiagnostics(),
          },
        ],
      },
      port: 'out',
      status: 'ended',
    };
  }

  private async executeMultiTurn(
    _input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<unknown> {
    const llmConfigId = config.llmConfigId as string | undefined;
    const model = config.model as string | undefined;
    const systemPrompt = (config.systemPrompt as string) || '';
    const temperature = config.temperature as number | undefined;
    const maxTokens = config.maxTokens as number | undefined;
    const knowledgeBases = (config.knowledgeBases as string[]) || [];
    const ragTopK = (config.ragTopK as number) || 5;
    const ragThreshold = (config.ragThreshold as number) || 0.7;
    const maxToolCalls = (config.maxToolCalls as number) || 10;
    const maxTurns = (config.maxTurns as number) ?? 20;
    const conditions = (config.conditions as ConditionDef[]) || [];

    const workspaceId = (context.variables?.__workspaceId as string) || '';
    const llmConfig = await this.llmService.resolveConfig(
      llmConfigId,
      workspaceId,
    );

    // multi_turn 의 첫 메시지는 항상 사용자가 채팅 UI 에서 입력한다 — config
    // 의 userPrompt 는 single_turn 전용이며, mode 전환 시 leak 된 값일 수
    // 있어 무시한다 (frontend clearFields 는 이후 mode 변경에만 동작하므로
    // 여기서 server-side safety net 을 제공).
    const ragAcc = new RagAccumulator(knowledgeBases.length);

    let finalSystemPrompt = systemPrompt;
    if (knowledgeBases.length > 0) {
      finalSystemPrompt += KB_TOOL_GUIDANCE;
    }
    if (conditions.length > 0) {
      finalSystemPrompt += this.buildConditionSystemPromptSuffix(conditions);
    }

    const messages: ChatMessage[] = [];
    if (finalSystemPrompt) {
      messages.push({ role: 'system', content: finalSystemPrompt });
    }

    const resolvedModel = model || llmConfig.defaultModel;
    const multiTurnStateBase = {
      llmConfigId,
      model: resolvedModel,
      temperature,
      maxTokens,
      knowledgeBases,
      ragTopK,
      ragThreshold,
      maxToolCalls,
      maxTurns,
      // Persist mcpServers across multi-turn resumes so each post-resume turn
      // re-materializes MCP sessions deterministically from the saved config.
      mcpServers: (config.mcpServers as unknown[]) || [],
      conditions,
      workspaceId,
      executionId: context.executionId,
      nodeId: context.nodeId,
      nodeExecutionId: context.nodeExecutionId,
      workflowId: context.workflowId,
    };

    const waitingResult: ResumableNodeHandlerOutput = {
      config: { mode: 'multi_turn', maxTurns, maxToolCalls },
      // CONVENTIONS §4.3 — waiting `output` carries the live conversation
      // snapshot. `message` (current AI turn content) and `turnCount` are
      // surfaced alongside `messages` so workflow authors can reference
      // `$node["X"].output.message` / `.turnCount` while the node is paused.
      output: {
        messages,
        message: '',
        turnCount: 0,
        maxTurns,
      },
      meta: { interactionType: 'ai_conversation' },
      status: 'waiting_for_input',
      _resumeState: {
        ...multiTurnStateBase,
        messages,
        turnCount: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalThinkingTokens: 0,
        toolCalls: 0,
        ragSources: ragAcc.getSources(),
        ragLastDiagnostics: ragAcc.getDiagnostics(),
      },
    };
    return waitingResult;
  }

  /**
   * Process user message in multi-turn conversation.
   * Called by the execution engine when a user submits a message.
   */
  async processMultiTurnMessage(
    userMessage: string,
    state: Record<string, unknown>,
  ): Promise<unknown> {
    const stateExecutionId = state.executionId as string | undefined;
    try {
      return await this.processMultiTurnMessageInner(userMessage, state);
    } finally {
      if (stateExecutionId) {
        await this.cleanupProviders(stateExecutionId);
      }
    }
  }

  private async processMultiTurnMessageInner(
    userMessage: string,
    state: Record<string, unknown>,
  ): Promise<unknown> {
    const messages = [...(state.messages as ChatMessage[])];
    const turnCount = (state.turnCount as number) + 1;
    const maxTurns = state.maxTurns as number;
    const maxToolCalls = state.maxToolCalls as number;
    const knowledgeBases = (state.knowledgeBases as string[]) || [];
    const workspaceId = (state.workspaceId as string) || '';
    const conditions = (state.conditions as ConditionDef[]) || [];
    let totalInputTokens = state.totalInputTokens as number;
    let totalOutputTokens = state.totalOutputTokens as number;
    let totalThinkingTokens = (state.totalThinkingTokens as number) ?? 0;
    let toolCallCount = state.toolCalls as number;

    // ragSources 는 turn 누적 — 새 turn 의 KB tool 호출 결과를 push 한다.
    const ragAcc = RagAccumulator.fromState(
      knowledgeBases.length,
      (state.ragSources as unknown[]) ?? [],
    );
    // 이번 턴에서만 호출된 KB delta — meta.turnDebug[].ragSources 로 노출되어
    // run-results UI 가 "어느 응답이 어느 청크를 사용했는지" 를 매핑한다.
    const turnRagAcc = new RagAccumulator(knowledgeBases.length);
    const ragGroup = new RagAccumulatorGroup(ragAcc, turnRagAcc);

    // Add user message
    messages.push({ role: 'user', content: userMessage });

    const llmConfigId = state.llmConfigId as string | undefined;
    const llmConfig = await this.llmService.resolveConfig(
      llmConfigId,
      workspaceId,
    );
    const model = state.model as string;
    const temperature = state.temperature as number | undefined;
    const maxTokens = state.maxTokens as number | undefined;
    // multi-turn resume 시 buildTools 에 전달할 config 은 turn-1 에서 수집한 state 를 사용.
    // 도구 연결(`toolNodeIds` / `toolOverrides`)은 스키마 제거 — 재작성 시 신규 필드로 복원.
    const turnConfig: Record<string, unknown> = {
      knowledgeBases,
      ragTopK: state.ragTopK,
      ragThreshold: state.ragThreshold,
      mcpServers: state.mcpServers,
      conditions,
    };
    const executionId = state.executionId as string | undefined;
    const tools = await this.buildTools(turnConfig, workspaceId, executionId);

    const turnStartedAt = Date.now();
    const toolsDef = tools.length > 0 ? tools : undefined;
    const chatParams = {
      model,
      messages: [...messages],
      temperature,
      maxTokens,
      tools: toolsDef,
    };
    const llmCalls: Array<{
      requestPayload: unknown;
      responsePayload: unknown;
      durationMs: number;
    }> = [];
    const toolCallTraces: ToolCallTrace[] = [];
    let callStart = Date.now();
    let result = await this.llmService.chat(llmConfig, {
      model,
      messages,
      temperature,
      maxTokens,
      tools: toolsDef,
    });
    llmCalls.push({
      requestPayload: chatParams,
      responsePayload: result,
      durationMs: Date.now() - callStart,
    });

    while (result.toolCalls?.length && toolCallCount < maxToolCalls) {
      const classification = this.classifyToolCalls(
        result.toolCalls,
        conditions,
      );

      // Condition-only: route immediately.
      if (
        classification.providerToolCalls.length === 0 &&
        classification.normalToolCalls.length === 0 &&
        classification.matchedCondition
      ) {
        const reason = this.extractConditionReason(
          result.toolCalls,
          classification.matchedCondition.id,
        );
        messages.push({ role: 'assistant', content: result.content || '' });

        totalInputTokens += result.usage?.inputTokens ?? 0;
        totalOutputTokens += result.usage?.outputTokens ?? 0;
        totalThinkingTokens += result.usage?.thinkingTokens ?? 0;

        const prevHistory = (state.turnDebugHistory as unknown[]) || [];
        const condTurnDebugHistory = [
          ...prevHistory,
          {
            turnIndex: turnCount,
            llmCalls,
            totalDurationMs: Date.now() - turnStartedAt,
            ...(toolCallTraces.length > 0
              ? { toolCalls: [...toolCallTraces] }
              : {}),
            ragSources: turnRagAcc.getSources(),
            ragDiagnostics: turnRagAcc.getDiagnostics(),
          },
        ];

        return this.buildConditionOutput(
          classification.matchedCondition,
          reason,
          messages,
          turnCount,
          {
            model,
            totalInputTokens,
            totalOutputTokens,
            totalThinkingTokens,
            toolCalls: toolCallCount,
            ragSources: ragAcc.getSources(),
            ragDiagnostics: ragAcc.getDiagnostics(),
          },
          { llmCalls, totalDurationMs: Date.now() - turnStartedAt },
          condTurnDebugHistory,
        );
      }

      messages.push({
        role: 'assistant',
        content: result.content || '',
        toolCalls: result.toolCalls,
      });

      for (const { provider, call } of classification.providerToolCalls) {
        toolCallCount++;
        const { result: execResult, trace } = await this.runProviderTool({
          provider,
          call,
          executionId: executionId ?? '',
          // Multi-turn resume doesn't carry the new turn's nodeId / nodeExecutionId
          // through state — usage logs and WS events from MCP calls during
          // resume are attributed to the original waiting NodeExecution.
          // Acceptable for activity-tab readability.
          nodeId: (state.nodeId as string | undefined) ?? '',
          nodeExecutionId: state.nodeExecutionId as string | undefined,
          workflowId: state.workflowId as string | undefined,
          workspaceId,
          config: turnConfig,
          turnIndex: turnCount,
        });
        toolCallTraces.push(trace);
        ragGroup.pushSources(execResult.ragSourcesDelta);
        ragGroup.pushDiagnostic(execResult.ragDiagnosticsDelta);
        messages.push({
          role: 'tool',
          content: execResult.content,
          toolCallId: execResult.toolCallId,
        });
      }

      for (const tc of classification.conditionToolCalls) {
        toolCallCount++;
        messages.push({
          role: 'tool',
          content: JSON.stringify({
            result:
              '확인되었습니다. 도구 실행 결과를 참고하여 최종 판단해주세요.',
          }),
          toolCallId: tc.id,
        });
      }

      for (const tc of classification.normalToolCalls) {
        toolCallCount++;
        messages.push({
          role: 'tool',
          content: JSON.stringify({
            result: `Tool ${tc.name} executed`,
            arguments: tc.arguments,
          }),
          toolCallId: tc.id,
        });
      }

      const loopReq = {
        model,
        messages: [...messages],
        temperature,
        maxTokens,
        tools: toolsDef,
      };
      callStart = Date.now();
      result = await this.llmService.chat(llmConfig, {
        model,
        messages,
        temperature,
        maxTokens,
        tools,
      });
      llmCalls.push({
        requestPayload: loopReq,
        responsePayload: result,
        durationMs: Date.now() - callStart,
      });
    }

    const turnDurationMs = Date.now() - turnStartedAt;
    messages.push({ role: 'assistant', content: result.content || '' });

    totalInputTokens += result.usage?.inputTokens ?? 0;
    totalOutputTokens += result.usage?.outputTokens ?? 0;
    totalThinkingTokens += result.usage?.thinkingTokens ?? 0;

    const prevHistory = (state.turnDebugHistory as unknown[]) || [];
    const currentTurnDebug = {
      turnIndex: turnCount,
      llmCalls,
      totalDurationMs: turnDurationMs,
      ...(toolCallTraces.length > 0 ? { toolCalls: [...toolCallTraces] } : {}),
      ragSources: turnRagAcc.getSources(),
      ragDiagnostics: turnRagAcc.getDiagnostics(),
    };
    // WARN #5 (DB) — turnDebugHistory 가 무제한 누적되어 outputData JSONB 가
    // 수십 MB 까지 증가하던 문제. 직전 N 턴만 유지 (보통 디버깅·재실행 UI 용도).
    const MAX_TURN_DEBUG_HISTORY = 50;
    const turnDebugHistory = [...prevHistory, currentTurnDebug].slice(
      -MAX_TURN_DEBUG_HISTORY,
    );

    const isLastTurn = maxTurns > 0 && turnCount >= maxTurns;

    if (isLastTurn) {
      return this.buildMultiTurnFinalOutput(
        messages,
        result.content || '',
        turnCount,
        'max_turns',
        {
          model,
          totalInputTokens,
          totalOutputTokens,
          totalThinkingTokens,
          toolCalls: toolCallCount,
          ragSources: ragAcc.getSources(),
          ragDiagnostics: ragAcc.getDiagnostics(),
        },
        { llmCalls, totalDurationMs: turnDurationMs },
        turnDebugHistory,
      );
    }

    const waitingResult: ResumableNodeHandlerOutput = {
      config: { mode: 'multi_turn', maxTurns, maxToolCalls },
      output: {
        messages,
        message: result.content || '',
        turnCount,
        maxTurns,
      },
      meta: { interactionType: 'ai_conversation' },
      status: 'waiting_for_input',
      _resumeState: {
        ...state,
        messages,
        turnCount,
        totalInputTokens,
        totalOutputTokens,
        totalThinkingTokens,
        toolCalls: toolCallCount,
        ragSources: ragAcc.getSources(),
        ragLastDiagnostics: ragAcc.getDiagnostics(),
        lastTurnRequest: chatParams,
        lastTurnResponse: result,
        lastTurnDurationMs: turnDurationMs,
        turnDebugHistory,
      },
    };
    return waitingResult;
  }

  /**
   * Engine-facing entry point used when the user ends a conversation or the
   * per-turn timer fires. Unpacks the accumulated multi-turn state and
   * delegates to the in-handler {@link buildMultiTurnFinalOutput}.
   */
  endMultiTurnConversation(
    state: Record<string, unknown>,
    endReason: 'user_ended' | 'max_turns' | 'condition' | 'error',
  ): unknown {
    const messages = (state.messages as ChatMessage[]) ?? [];
    const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
    const lastResponse = (lastMsg?.content as string) ?? '';
    return this.buildMultiTurnFinalOutput(
      messages,
      lastResponse,
      (state.turnCount as number) ?? 0,
      endReason,
      {
        model: state.model as string,
        totalInputTokens: (state.totalInputTokens as number) ?? 0,
        totalOutputTokens: (state.totalOutputTokens as number) ?? 0,
        totalThinkingTokens: (state.totalThinkingTokens as number) ?? 0,
        toolCalls: (state.toolCalls as number) ?? 0,
        ragSources: (state.ragSources as unknown[]) ?? [],
        ragDiagnostics: state.ragLastDiagnostics as RagDiagnostics | undefined,
      },
      undefined,
      (state.turnDebugHistory as unknown[]) ?? [],
    );
  }

  buildMultiTurnFinalOutput(
    messages: ChatMessage[],
    lastResponse: string,
    turnCount: number,
    endReason: 'user_ended' | 'max_turns' | 'condition' | 'error',
    metadata: {
      model: string;
      totalInputTokens: number;
      totalOutputTokens: number;
      totalThinkingTokens?: number;
      toolCalls: number;
      ragSources: unknown[];
      ragDiagnostics?: RagDiagnostics;
    },
    turnDebug?: {
      llmCalls?: unknown[];
      totalDurationMs?: number;
    },
    turnDebugHistory?: unknown[],
  ): unknown {
    // CONVENTIONS §8 — wrap conversation result under `output.result.*`.
    // Tokens + tool-call counts go to `meta.*` (Principle 2). The legacy
    // `interactionType: 'ai_conversation'` marker moves to `meta.interactionType`
    // so the run-results UI's conversation Preview tab keeps rendering.
    return {
      config: { mode: 'multi_turn' as const, model: metadata.model },
      output: {
        result: {
          response: lastResponse,
          messages,
          turnCount,
          endReason,
        },
      },
      meta: {
        durationMs: turnDebug?.totalDurationMs ?? 0,
        model: metadata.model,
        interactionType: 'ai_conversation',
        inputTokens: metadata.totalInputTokens,
        outputTokens: metadata.totalOutputTokens,
        totalTokens: metadata.totalInputTokens + metadata.totalOutputTokens,
        thinkingTokens: metadata.totalThinkingTokens ?? 0,
        toolCalls: metadata.toolCalls,
        ragSources: metadata.ragSources,
        ragDiagnostics: metadata.ragDiagnostics,
        turnDebug: turnDebugHistory ?? [],
      },
      port: 'out',
      status: 'ended',
    };
  }

  /**
   * Build condition-triggered output with port routing.
   */
  private buildConditionOutput(
    condition: ConditionDef,
    reason: string,
    messages: ChatMessage[],
    turnCount: number,
    metadata: {
      model: string;
      totalInputTokens: number;
      totalOutputTokens: number;
      totalThinkingTokens?: number;
      toolCalls: number;
      ragSources: unknown[];
      ragDiagnostics?: RagDiagnostics;
    },
    turnDebug?: {
      llmCalls?: unknown[];
      totalDurationMs?: number;
    },
    turnDebugHistory?: unknown[],
  ): unknown {
    const lastMsg = messages[messages.length - 1];
    const lastResponse = lastMsg?.content ?? '';

    return {
      config: { mode: 'multi_turn' as const, model: metadata.model },
      output: {
        result: {
          response: lastResponse,
          messages,
          turnCount,
          endReason: 'condition' as const,
          condition: {
            id: condition.id,
            label: condition.label,
            reason,
          },
        },
      },
      meta: {
        durationMs: turnDebug?.totalDurationMs ?? 0,
        model: metadata.model,
        interactionType: 'ai_conversation',
        inputTokens: metadata.totalInputTokens,
        outputTokens: metadata.totalOutputTokens,
        totalTokens: metadata.totalInputTokens + metadata.totalOutputTokens,
        thinkingTokens: metadata.totalThinkingTokens ?? 0,
        toolCalls: metadata.toolCalls,
        ragSources: metadata.ragSources,
        ragDiagnostics: metadata.ragDiagnostics,
        turnDebug: turnDebugHistory ?? [],
      },
      port: condition.id,
      status: 'ended',
    };
  }

  /**
   * Classify tool calls into provider (KB 등 핸들러 내부 실행), condition,
   * normal (외부 노드 stub) 그룹으로 분리. condition 다중 호출 시 conditions
   * 배열에서 가장 앞쪽 정의된 항목을 winner 로 채택.
   */
  private classifyToolCalls(
    toolCalls: ToolCall[],
    conditions: ConditionDef[],
  ): ConditionClassification {
    const condNameToCondition = new Map<string, ConditionDef>();
    for (const c of conditions) {
      condNameToCondition.set(condToolName(c.id), c);
    }

    const providerToolCalls: Array<{
      provider: AgentToolProvider;
      call: ToolCall;
    }> = [];
    const conditionToolCalls: ToolCall[] = [];
    const normalToolCalls: ToolCall[] = [];

    for (const tc of toolCalls) {
      const matchedProvider = this.toolProviders.find((p) =>
        p.matches(tc.name),
      );
      if (matchedProvider) {
        providerToolCalls.push({ provider: matchedProvider, call: tc });
      } else if (condNameToCondition.has(tc.name)) {
        conditionToolCalls.push(tc);
      } else {
        normalToolCalls.push(tc);
      }
    }

    let matchedCondition: ConditionDef | null = null;
    if (conditionToolCalls.length > 0) {
      let lowestIndex = Infinity;
      for (const ctc of conditionToolCalls) {
        const cond = condNameToCondition.get(ctc.name);
        if (cond) {
          const idx = conditions.indexOf(cond);
          if (idx !== -1 && idx < lowestIndex) {
            lowestIndex = idx;
            matchedCondition = cond;
          }
        }
      }
    }

    return {
      providerToolCalls,
      conditionToolCalls,
      normalToolCalls,
      matchedCondition,
    };
  }

  /**
   * Extract the reason argument from a condition tool call.
   */
  private extractConditionReason(
    toolCalls: ToolCall[],
    conditionId: string,
  ): string {
    const name = condToolName(conditionId);
    const tc = toolCalls.find((t) => t.name === name);
    if (!tc) return '';
    try {
      const args = JSON.parse(tc.arguments) as Record<string, unknown>;
      const reason = typeof args.reason === 'string' ? args.reason : '';
      return reason.slice(0, 500);
    } catch {
      return '';
    }
  }

  /**
   * Build system prompt suffix that instructs the LLM about available conditions.
   */
  private buildConditionSystemPromptSuffix(conditions: ConditionDef[]): string {
    const condList = conditions
      .map((c) => `- ${condToolName(c.id)}: ${c.prompt}`)
      .join('\n');
    return `\n\n[조건 안내] 대화 중 아래 조건에 해당하는 상황이 감지되면, 해당 조건 도구를 호출하세요:\n${condList}\n조건에 해당하지 않으면 대화를 계속하세요.`;
  }

  private async buildTools(
    config: Record<string, unknown>,
    workspaceId: string,
    executionId?: string,
  ): Promise<ToolDef[]> {
    // 일반 도구(`tool_*`) 입력 경로는 스키마에서 제거됨 — 재작성 시 새 디자인으로 복원.
    // 스키마 .passthrough() 로 DB 의 legacy toolNodeIds/toolOverrides 는 silently
    // 통과하지만 여기서 읽지 않으므로 LLM 에 등록되지 않는다.
    const normalTools: ToolDef[] = [];
    const conditions = (config.conditions as ConditionDef[]) || [];

    // Provider tools (KB / MCP 등) — 핸들러 내부 실행. 우선순위 가장 높음.
    const providerTools: ToolDef[] = [];
    for (const provider of this.toolProviders) {
      try {
        const built = await provider.buildTools({
          config,
          workspaceId,
          executionId,
        });
        providerTools.push(...built);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        AiAgentHandler.logger.warn(
          `Provider "${provider.key}" buildTools failed: ${msg}`,
        );
      }
    }

    const conditionTools: ToolDef[] = conditions.map((c) => ({
      name: condToolName(c.id),
      description: c.prompt,
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: '이 조건을 선택한 이유',
          },
        },
      },
    }));

    return [...providerTools, ...normalTools, ...conditionTools];
  }

  private static readonly logger = new Logger('AiAgentHandler');
}
