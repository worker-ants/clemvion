import { Logger } from '@nestjs/common';
import {
  NodeHandler,
  NodeHandlerOutput,
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
import type { McpServerSummary } from './tool-providers/mcp-diagnostics';
import {
  aiAgentNodeMetadata,
  DEFAULT_CONTEXT_SCOPE_N,
} from './ai-agent.schema';
import {
  ExecutionEventType,
  ToolCallCompletedPayload,
  ToolCallStartedPayload,
  WebsocketService,
} from '../../../modules/websocket/websocket.service';
import type {
  ConversationThread,
  ConversationTurnToolCall,
} from '../../../shared/conversation-thread/conversation-thread.types';
import type {
  NodeRef,
  ThreadHolder,
} from '../../../modules/execution-engine/conversation-thread/conversation-thread.service';
import {
  applyCap,
  renderThreadAsSystemText,
} from '../../../shared/conversation-thread/thread-renderer';

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

// Shape of the user-authored multi-turn config as it appears on
// `context.rawConfig` / `state.rawConfig` after the engine freezes
// `node.config`. All fields optional — partial configs may exist (e.g.
// no conditions / no KB) and pre-Phase-1 state rows omit rawConfig
// entirely. Used by buildMultiTurnConfigEcho to narrow `unknown` casts.
interface RawAiAgentMultiTurnConfig {
  mode?: string;
  model?: string;
  systemPrompt?: string;
  userPrompt?: string;
  responseFormat?: string;
  maxTurns?: number;
  maxToolCalls?: number;
  knowledgeBases?: string[];
  conditions?: ConditionDef[];
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

/**
 * multi-turn `_resumeState.ragSources` 의 최대 보존 개수. 노드 출력 메타용
 * `meta.ragSources` 와 별개로 resume state 에는 직전 N 건만 유지해, 장기 대화
 * 에서 outputData JSONB 가 무제한으로 비대해지는 것을 막는다. 같은 의도로
 * `MAX_TURN_DEBUG_HISTORY` 가 turnDebug 누적에 적용되어 있다.
 *
 * resume 직후 RagAccumulator.fromState 가 이 배열을 hydrate 해 chunkId dedup
 * 셋을 재구성하므로, 잘려 나간 더 오래된 청크는 향후 turn 의 dedup 에서 제외된다
 * (이는 의도된 trade-off — 장기 대화의 메모리 안정성 우선).
 */
const MAX_RESUME_RAG_SOURCES = 200;

const KB_TOOL_GUIDANCE =
  '\n\n[Knowledge Base] 사용자 질문이 지식 조회를 필요로 하면 등록된 `kb_*` 도구를 호출하세요. ' +
  '사용자 입력을 그대로 query 로 쓰지 말고, 답변에 필요한 **지식 단위** 로 분해해 능동적으로 검색하세요. ' +
  '하나의 query 에는 하나의 주제만 담고, 별개의 정보가 필요하다고 판단되면 같은 turn 에 `kb_*` 를 여러 번 호출하세요 (같은 KB 라도 별개 호출). ' +
  '예) "교환과 반품 정책 알려줘" → `query="교환정책"` + `query="반품정책"` 두 번. ' +
  '각 호출의 결과는 분리된 채로 전달되며, 에이전트가 결과를 그대로 인용·종합해 답변하세요 (점수 기준 병합 없음). ' +
  '결과가 부족하면 다른 어휘 / 더 구체적인 query 로 재호출하세요. ' +
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

/**
 * Map ConversationTurn → LLM ChatMessage (messages-mode injection,
 * spec/conventions/conversation-thread.md §5.1). Pure function — extracted
 * from `injectThreadContext` so unit tests can exercise the per-source
 * mapping in isolation.
 *
 * `presentation_user` turns are prefixed with `[from <nodeLabel>]` so the
 * LLM can attribute the input back to the originating node.
 *
 * Every returned message carries `source: 'injected'` for the WebSocket
 * emit layer (spec/5-system/6-websocket-protocol.md §4.4.6) — set once at
 * the bottom of the function rather than per-case so adding a new turn
 * source can't accidentally drop the marker. System messages are filtered
 * out before reaching the emit payload (`buildConversationConfigFromOutput`),
 * so the marker on them is harmless.
 */
function mapTurnsToChatMessages(
  turns: readonly import('../../../shared/conversation-thread/conversation-thread.types').ConversationTurn[],
): ChatMessage[] {
  return turns
    .map((t): ChatMessage => {
      switch (t.source) {
        case 'presentation_user':
          return {
            role: 'user',
            content: `[from ${t.nodeLabel}] ${t.text}`,
          } as ChatMessage;
        case 'ai_user':
          return { role: 'user', content: t.text } as ChatMessage;
        case 'ai_assistant':
          return {
            role: 'assistant',
            content: t.text,
            ...(t.toolCalls ? { toolCalls: t.toolCalls } : {}),
          } as ChatMessage;
        case 'ai_tool':
          return {
            role: 'tool',
            content: t.text,
            ...(t.toolCallId ? { toolCallId: t.toolCallId } : {}),
          } as ChatMessage;
        case 'system':
          return { role: 'system', content: t.text } as ChatMessage;
        default:
          return { role: 'user', content: t.text } as ChatMessage;
      }
    })
    .map((m) => ({ ...m, source: 'injected' as const }));
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
    /**
     * Optional. When provided, the handler pushes user / assistant turns
     * into the workflow-scoped ConversationThread (single mutation entrypoint
     * per spec/conventions/conversation-thread.md §2.2) and auto-injects the
     * thread on chat calls when `contextScope` is enabled.
     *
     * Test fixtures that exercise the handler in isolation may omit this;
     * the handler then degrades to its original (no-thread) behaviour.
     */
    private readonly conversationThreadService?: import('../../../modules/execution-engine/conversation-thread/conversation-thread.service').ConversationThreadService,
  ) {}

  /* ─── ConversationThread push helpers (spec §2.2) ─────────────────────── */

  /**
   * NodeRef from the engine-injected ExecutionContext (executeSingleTurn /
   * executeMultiTurn first-turn path). Engine doesn't yet propagate
   * label/type; fall back to nodeId for label and hard-code 'ai_agent' for
   * type — sufficient for thread display until engine ships richer node
   * metadata to handlers (v2).
   */
  private buildAiNodeRefFromContext(
    context: ExecutionContext,
    config: Record<string, unknown>,
  ): NodeRef {
    const id = context.nodeId ?? '';
    return {
      id,
      label: id,
      type: 'ai_agent',
      config: context.rawConfig ?? config,
    };
  }

  /**
   * NodeRef from `state` carried across multi-turn resumes. `state.rawConfig`
   * is the frozen snapshot taken at the first turn (engine `state.rawConfig`
   * policy — `spec/5-system/4-execution-engine.md §6.1`).
   */
  private buildAiNodeRefFromState(state: Record<string, unknown>): NodeRef {
    const id = (state.nodeId as string | undefined) ?? '';
    return {
      id,
      label: id,
      type: 'ai_agent',
      config: (state.rawConfig as Record<string, unknown> | undefined) ?? {},
    };
  }

  /** Thread reference carried in `state` from the first multi-turn turn. */
  private threadHolderFromState(
    state: Record<string, unknown>,
  ): ThreadHolder | undefined {
    const ref = state.conversationThreadRef as ConversationThread | undefined;
    return ref ? { conversationThread: ref } : undefined;
  }

  /**
   * Push a single user/assistant turn onto the thread. No-op when the
   * service or thread reference is missing (test fixtures, legacy paths).
   */
  private pushAiThreadTurn(
    target: ThreadHolder | undefined,
    nodeRef: NodeRef,
    source: 'ai_user' | 'ai_assistant',
    content: string,
    toolCalls?: ConversationTurnToolCall[],
  ): void {
    if (!this.conversationThreadService || !target) return;
    if (source === 'ai_user') {
      this.conversationThreadService.appendAiUserMessage(target, {
        node: nodeRef,
        content,
      });
    } else {
      this.conversationThreadService.appendAiAssistantMessage(target, {
        node: nodeRef,
        content,
        ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {}),
      });
    }
  }

  /**
   * Inject the ConversationThread (excluding the current node's own turns)
   * into the LLM chat. spec/conventions/conversation-thread.md §5.
   *
   * Returns the mutated messages + system prompt so the caller can hand
   * them to llmService.chat, plus a debug snapshot for `meta.contextInjection`.
   *
   * Single-turn: invoke once immediately before the first chat.
   * Multi-turn: invoke once during executeMultiTurn (the injected turns are
   *   then carried in `_resumeState.messages` for every subsequent chat).
   */
  private injectThreadContext(args: {
    target: ThreadHolder | undefined;
    selfNodeId: string;
    config: Record<string, unknown>;
    messages: ChatMessage[];
    finalSystemPrompt: string;
  }): {
    messages: ChatMessage[];
    finalSystemPrompt: string;
    injection: {
      appliedScope: 'none' | 'thread' | 'lastN';
      appliedMode: 'messages' | 'system_text';
      injectedTurns: number;
      droppedTurns: number;
      totalInjectedChars: number;
    };
  } {
    const noopMeta = {
      appliedScope: 'none' as const,
      appliedMode: 'messages' as const,
      injectedTurns: 0,
      droppedTurns: 0,
      totalInjectedChars: 0,
    };

    const scope = args.config.contextScope as
      | 'none'
      | 'thread'
      | 'lastN'
      | undefined;
    if (
      !this.conversationThreadService ||
      !args.target ||
      !scope ||
      scope === 'none'
    ) {
      return {
        messages: args.messages,
        finalSystemPrompt: args.finalSystemPrompt,
        injection: noopMeta,
      };
    }

    const allTurns = this.conversationThreadService.getThreadExcludingNode(
      args.target,
      args.selfNodeId,
    );
    if (allTurns.length === 0) {
      return {
        messages: args.messages,
        finalSystemPrompt: args.finalSystemPrompt,
        injection: { ...noopMeta, appliedScope: scope },
      };
    }

    const scoped =
      scope === 'lastN'
        ? allTurns.slice(
            -Math.max(
              1,
              (args.config.contextScopeN as number) ?? DEFAULT_CONTEXT_SCOPE_N,
            ),
          )
        : allTurns;

    // Cap (per spec §5.3 — char-based, last-resort safety).
    const capped = applyCap(scoped);

    const mode =
      (args.config.contextInjectionMode as 'messages' | 'system_text') ??
      'messages';

    if (mode === 'system_text') {
      const text = renderThreadAsSystemText(capped.turns);
      const newSystemPrompt = args.finalSystemPrompt
        ? `${args.finalSystemPrompt}\n\n${text}`
        : text;
      // Mirror the appended thread text into the messages array's system
      // entry so callers don't need to re-sync the two surfaces.
      const newMessages = args.messages.map((m) =>
        m.role === 'system' ? { ...m, content: newSystemPrompt } : m,
      );
      return {
        messages: newMessages,
        finalSystemPrompt: newSystemPrompt,
        injection: {
          appliedScope: scope,
          appliedMode: 'system_text',
          injectedTurns: capped.turns.length,
          droppedTurns: capped.droppedCount,
          totalInjectedChars: capped.totalChars,
        },
      };
    }

    // 'messages' mode — prepend (after system) per spec §5.1 mapping.
    const injected: ChatMessage[] = mapTurnsToChatMessages(capped.turns);

    // Insert injected turns after the leading system message (if any).
    const systemIdx = args.messages.findIndex((m) => m.role === 'system');
    const newMessages = [...args.messages];
    const insertAt = systemIdx >= 0 ? systemIdx + 1 : 0;
    newMessages.splice(insertAt, 0, ...injected);

    return {
      messages: newMessages,
      finalSystemPrompt: args.finalSystemPrompt,
      injection: {
        appliedScope: scope,
        appliedMode: 'messages',
        injectedTurns: capped.turns.length,
        droppedTurns: capped.droppedCount,
        totalInjectedChars: capped.totalChars,
      },
    };
  }

  /**
   * Tool turn opt-in gate. `includeToolTurns: true` lets KB / MCP / condition
   * tool-loop turns flow into the thread; default false keeps the thread
   * lean (only final assistant per spec §2.2 / §2.4).
   */
  private isToolTurnsEnabled(
    source: Record<string, unknown> | undefined,
  ): boolean {
    return source?.includeToolTurns === true;
  }

  /** Tool result push (opt-in via `state.includeToolTurns === true`). */
  private pushAiToolResultTurn(
    target: ThreadHolder | undefined,
    nodeRef: NodeRef,
    toolCallId: string,
    content: string,
  ): void {
    if (!this.conversationThreadService || !target) return;
    this.conversationThreadService.appendAiToolResult(target, {
      node: nodeRef,
      toolCallId,
      content,
    });
  }

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

  /**
   * 한 turn 의 provider tool 호출 묶음을 Promise.all 로 병렬 실행하고 결과를
   * 입력 순서대로 messages·trace·ragGroup 에 결정적으로 누적한다. 잔여 한도를
   * 초과하는 호출은 'tool_call_budget_exceeded' tool_result 로 회신해 모든
   * tool_use ↔ tool_result 매칭 요건(Anthropic) 을 만족시킨다.
   *
   * single-turn / multi-turn resume 양쪽에서 동일 정책을 보장하기 위한 단일
   * 진입점 — 이 메서드를 거치지 않고 provider 를 직접 실행하는 신규 경로는
   * 추가하지 않는다.
   */
  private async executeProviderToolBatch(args: {
    calls: Array<{ provider: AgentToolProvider; call: ToolCall }>;
    remainingBudget: number;
    executionId: string;
    nodeId: string;
    nodeExecutionId?: string;
    workflowId?: string;
    workspaceId: string;
    config: Record<string, unknown>;
    turnIndex: number;
    ragGroup: RagAccumulatorGroup;
    toolCallTraces: ToolCallTrace[];
    messages: ChatMessage[];
  }): Promise<{ executedCount: number }> {
    const safeBudget = Math.max(0, args.remainingBudget);
    const toRun = args.calls.slice(0, safeBudget);
    const truncated = args.calls.slice(safeBudget);

    const batchResults = await Promise.all(
      toRun.map(({ provider, call }) =>
        this.runProviderTool({
          provider,
          call,
          executionId: args.executionId,
          nodeId: args.nodeId,
          nodeExecutionId: args.nodeExecutionId,
          workflowId: args.workflowId,
          workspaceId: args.workspaceId,
          config: args.config,
          turnIndex: args.turnIndex,
        }),
      ),
    );

    for (const { result: execResult, trace } of batchResults) {
      args.toolCallTraces.push(trace);
      args.ragGroup.pushSources(execResult.ragSourcesDelta);
      args.ragGroup.pushDiagnostic(execResult.ragDiagnosticsDelta);
      args.messages.push({
        role: 'tool',
        content: execResult.content,
        toolCallId: execResult.toolCallId,
      });
    }

    for (const { call } of truncated) {
      args.messages.push({
        role: 'tool',
        content: JSON.stringify({ error: 'tool_call_budget_exceeded' }),
        toolCallId: call.id,
      });
    }

    return { executedCount: batchResults.length };
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
  ): Promise<NodeHandlerOutput> {
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
  ): Promise<NodeHandlerOutput> {
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

    // CONVENTIONS Principle 7 — config echoes raw user input
    // (systemPrompt / userPrompt / per-condition prompt may be `{{ ... }}`
    // templates). Engine resolves expressions before dispatch so the local
    // variables hold evaluated values for runtime LLM calls. Tool-connection
    // fields (`toolNodeIds` / `toolOverrides`) are out of scope per the
    // tool-connection-rewrite plan; the rest of the config schema is
    // covered.
    const rawConfig = context.rawConfig ?? config;

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
    // MCP build 결과 (skipReason / connected) 누적. spec §6.2 의
    // serverSummaries[] 가 본 array 의 1:1 echo. buildTools 호출 시 ctx 로
    // 흘러간다. 비어있으면 meta emit 시 자동 omit (buildMcpDiagnosticsMeta).
    const mcpDiagnosticsAcc: McpServerSummary[] = [];

    // System prompt: KB 검색은 더 이상 prefill 하지 않는다. LLM 이 능동 호출 결정.
    let finalSystemPrompt = systemPrompt;
    if (knowledgeBases.length > 0) {
      finalSystemPrompt += KB_TOOL_GUIDANCE;
    }
    if (conditions.length > 0) {
      finalSystemPrompt += this.buildConditionSystemPromptSuffix(conditions);
    }

    // Build messages
    let messages: ChatMessage[] = [];
    if (finalSystemPrompt) {
      messages.push({ role: 'system', content: finalSystemPrompt });
    }
    if (userPrompt) {
      messages.push({ role: 'user', content: userPrompt });
      // ConversationThread push (spec §2.2 — single-turn ai_user, 1회).
      this.pushAiThreadTurn(
        context,
        this.buildAiNodeRefFromContext(context, config),
        'ai_user',
        userPrompt,
      );
    }

    // ConversationThread inject (spec §5) — single-turn runs once before
    // the first chat. The helper updates both the system prompt and the
    // messages array in lockstep.
    const singleTurnInjection = this.injectThreadContext({
      target: context,
      selfNodeId: context.nodeId ?? '',
      config,
      messages,
      finalSystemPrompt,
    });
    messages = singleTurnInjection.messages;
    finalSystemPrompt = singleTurnInjection.finalSystemPrompt;

    const tools = await this.buildTools(
      config,
      workspaceId,
      context.executionId,
      mcpDiagnosticsAcc,
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
        // ConversationThread push (spec §2.2 — single-turn ai_assistant on
        // condition route).
        this.pushAiThreadTurn(
          context,
          this.buildAiNodeRefFromContext(context, config),
          'ai_assistant',
          result.content || '',
        );
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
            mcpServerSummaries: mcpDiagnosticsAcc,
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
          rawConfig,
        );
      }

      // Case 2/3: provider / normal / mixed-with-condition — execute and continue.
      messages.push({
        role: 'assistant',
        content: result.content || '',
        toolCalls: result.toolCalls,
      });
      // Tool-loop assistant push (opt-in via `includeToolTurns`).
      if (this.isToolTurnsEnabled(config)) {
        this.pushAiThreadTurn(
          context,
          this.buildAiNodeRefFromContext(context, config),
          'ai_assistant',
          result.content || '',
          result.toolCalls as ConversationTurnToolCall[] | undefined,
        );
      }

      // Provider tool 호출은 같은 turn 내 Promise.all 로 병렬 실행 + budget
      // 부분 truncate 까지 일괄 처리하는 단일 진입점을 사용 (single-turn /
      // multi-turn resume 두 경로의 정책 일관성 보장). 상세 동작은
      // {@link executeProviderToolBatch} 주석 참조.
      const { executedCount: providerExecuted } =
        await this.executeProviderToolBatch({
          calls: classification.providerToolCalls,
          remainingBudget: maxToolCalls - toolCallCount,
          executionId: context.executionId,
          nodeId: context.nodeId ?? '',
          nodeExecutionId: context.nodeExecutionId,
          workflowId: context.workflowId,
          workspaceId,
          config,
          turnIndex: 1,
          ragGroup,
          toolCallTraces,
          messages,
        });
      toolCallCount += providerExecuted;

      for (const tc of classification.conditionToolCalls) {
        // Condition tool: send deferral message (does not count toward toolCallCount).
        const condDeferralContent = JSON.stringify({
          result:
            '확인되었습니다. 도구 실행 결과를 참고하여 최종 판단해주세요.',
        });
        messages.push({
          role: 'tool',
          content: condDeferralContent,
          toolCallId: tc.id,
        });
        if (this.isToolTurnsEnabled(config)) {
          this.pushAiToolResultTurn(
            context,
            this.buildAiNodeRefFromContext(context, config),
            tc.id,
            condDeferralContent,
          );
        }
      }

      // 일반 도구도 maxToolCalls 합산 대상이므로 잔여 한도를 초과한 항목은
      // budget_exceeded 로 회신해 LLM 의 다음 turn 에서 모든 tool_use 가
      // tool_result 와 매칭되도록 한다. 현재 일반 도구는 stub 결과만 만들므로
      // 실제 외부 호출 비용은 없으나, maxToolCalls 합산 시맨틱은 spec §3.f-g
      // 와 일치시킨다.
      for (const tc of classification.normalToolCalls) {
        if (toolCallCount >= maxToolCalls) {
          const budgetContent = JSON.stringify({
            error: 'tool_call_budget_exceeded',
          });
          messages.push({
            role: 'tool',
            content: budgetContent,
            toolCallId: tc.id,
          });
          if (this.isToolTurnsEnabled(config)) {
            this.pushAiToolResultTurn(
              context,
              this.buildAiNodeRefFromContext(context, config),
              tc.id,
              budgetContent,
            );
          }
          continue;
        }
        toolCallCount++;
        const normalContent = JSON.stringify({
          result: `Tool ${tc.name} executed`,
          arguments: tc.arguments,
        });
        messages.push({
          role: 'tool',
          content: normalContent,
          toolCallId: tc.id,
        });
        if (this.isToolTurnsEnabled(config)) {
          this.pushAiToolResultTurn(
            context,
            this.buildAiNodeRefFromContext(context, config),
            tc.id,
            normalContent,
          );
        }
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
    // ConversationThread push (spec §2.2 — single-turn final ai_assistant,
    // 1회). Stringify JSON-mode responses so the thread always carries a
    // displayable text payload.
    {
      const finalText =
        typeof response === 'string'
          ? response
          : response === undefined || response === null
            ? ''
            : JSON.stringify(response);
      this.pushAiThreadTurn(
        context,
        this.buildAiNodeRefFromContext(context, config),
        'ai_assistant',
        finalText,
      );
    }
    return {
      config: {
        mode: 'single_turn' as const,
        model: rawConfig.model ?? model ?? llmConfig.defaultModel,
        systemPrompt: rawConfig.systemPrompt ?? systemPrompt,
        userPrompt: rawConfig.userPrompt ?? userPrompt,
        responseFormat: rawConfig.responseFormat ?? responseFormat,
        ...(rawConfig.conditions !== undefined
          ? Array.isArray(rawConfig.conditions) &&
            (rawConfig.conditions as unknown[]).length > 0
            ? { conditions: rawConfig.conditions }
            : {}
          : conditions.length > 0
            ? { conditions }
            : {}),
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
        ...(AiAgentHandler.buildMcpDiagnosticsMeta(mcpDiagnosticsAcc) ?? {}),
        // ConversationThread injection debug echo (spec §5.3). Echo only
        // when injection actually happened so noop runs keep the meta lean.
        ...(singleTurnInjection.injection.appliedScope !== 'none'
          ? { contextInjection: singleTurnInjection.injection }
          : {}),
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
  ): Promise<NodeHandlerOutput> {
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

    // CONVENTIONS Principle 7 — config echoes raw user input on the
    // initial waiting tick (multi-turn resume snapshots `state.rawConfig`
    // separately, see Phase 1).
    const rawConfig = context.rawConfig ?? config;

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

    let messages: ChatMessage[] = [];
    if (finalSystemPrompt) {
      messages.push({ role: 'system', content: finalSystemPrompt });
    }

    // ConversationThread inject (spec §5) — multi-turn injects once during
    // executeMultiTurn so the resulting `messages` carry the prepended
    // turns into `_resumeState.messages` for every subsequent chat. Each
    // future `processMultiTurnMessage` then just appends the new user/
    // assistant pair without re-injecting.
    const multiTurnInjection = this.injectThreadContext({
      target: context,
      selfNodeId: context.nodeId ?? '',
      config,
      messages,
      finalSystemPrompt,
    });
    messages = multiTurnInjection.messages;
    finalSystemPrompt = multiTurnInjection.finalSystemPrompt;

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
      // ConversationThread mutation 단일 진입점이 service.append* 인데,
      // multi-turn 후속 turn 은 ExecutionContext 가 직접 주입되지 않으므로
      // 첫 turn 시점의 thread reference 를 state 에 보관해 다음 turn 에서도
      // 같은 thread 객체를 mutate 하도록 한다 (in-memory ExecutionContext
      // 정책에 의존 — spec/conventions/conversation-thread.md §2.2 / §4).
      conversationThreadRef: context.conversationThread,
    };

    const waitingResult: ResumableNodeHandlerOutput = {
      config: {
        mode: 'multi_turn' as const,
        model: rawConfig.model ?? model ?? llmConfig.defaultModel,
        systemPrompt: rawConfig.systemPrompt ?? systemPrompt,
        maxTurns: rawConfig.maxTurns ?? maxTurns,
        maxToolCalls: rawConfig.maxToolCalls ?? maxToolCalls,
        ...(rawConfig.knowledgeBases !== undefined
          ? { knowledgeBases: rawConfig.knowledgeBases }
          : knowledgeBases.length > 0
            ? { knowledgeBases }
            : {}),
        ...(rawConfig.conditions !== undefined &&
        Array.isArray(rawConfig.conditions) &&
        (rawConfig.conditions as unknown[]).length > 0
          ? { conditions: rawConfig.conditions }
          : conditions.length > 0
            ? { conditions }
            : {}),
      },
      // CONVENTIONS §4.3 — waiting `output.result.*` carries the live
      // conversation snapshot. D6 (2026-05-17) — `messages` / `message` /
      // `turnCount` / `maxTurns` 가 종결 시점 (`output.result.*`) 과 단일
      // 경로로 통일되어 다운스트림 expression `$node["X"].output.result.*`
      // 가 waiting/ended 양쪽에서 동일하게 동작.
      output: {
        result: {
          messages,
          message: '',
          turnCount: 0,
          maxTurns,
        },
      },
      meta: {
        interactionType: 'ai_conversation',
        // Echo the multi-turn first-turn injection so the run-results UI can
        // show what the agent saw at the conversation's start. Subsequent
        // turns do not re-inject (spec §5: prepended turns are carried in
        // `_resumeState.messages`).
        ...(multiTurnInjection.injection.appliedScope !== 'none'
          ? { contextInjection: multiTurnInjection.injection }
          : {}),
      },
      status: 'waiting_for_input',
      _resumeState: {
        ...multiTurnStateBase,
        messages,
        turnCount: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalThinkingTokens: 0,
        toolCalls: 0,
        ragSources: ragAcc.getSources().slice(-MAX_RESUME_RAG_SOURCES),
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
    // MCP build 결과 — multi-turn 은 매 turn 마다 buildTools 재호출이므로 본
    // accumulator 도 turn 단위. 직전 turn 의 summary 는 resumeState 에 보존
    // 하지 않고 매 turn 새로 결정 — buildTools 가 결정론적이므로 안전.
    const mcpDiagnosticsAcc: McpServerSummary[] = [];

    // Add user message
    messages.push({ role: 'user', content: userMessage });
    // ConversationThread push (spec §2.2 — multi-turn ai_user)
    this.pushAiThreadTurn(
      this.threadHolderFromState(state),
      this.buildAiNodeRefFromState(state),
      'ai_user',
      userMessage,
    );

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
    const tools = await this.buildTools(
      turnConfig,
      workspaceId,
      executionId,
      mcpDiagnosticsAcc,
    );

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
        // ConversationThread push (spec §2.2 — multi-turn ai_assistant on
        // condition route).
        this.pushAiThreadTurn(
          this.threadHolderFromState(state),
          this.buildAiNodeRefFromState(state),
          'ai_assistant',
          result.content || '',
        );

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
            mcpServerSummaries: mcpDiagnosticsAcc,
          },
          { llmCalls, totalDurationMs: Date.now() - turnStartedAt },
          condTurnDebugHistory,
          state.rawConfig as Record<string, unknown> | undefined,
        );
      }

      messages.push({
        role: 'assistant',
        content: result.content || '',
        toolCalls: result.toolCalls,
      });
      // Tool-loop assistant push (multi-turn opt-in via state.rawConfig
      // .includeToolTurns).
      if (
        this.isToolTurnsEnabled(
          state.rawConfig as Record<string, unknown> | undefined,
        )
      ) {
        this.pushAiThreadTurn(
          this.threadHolderFromState(state),
          this.buildAiNodeRefFromState(state),
          'ai_assistant',
          result.content || '',
          result.toolCalls as ConversationTurnToolCall[] | undefined,
        );
      }

      // single-turn 과 동일하게 단일 진입점을 사용. resume state 는 새 turn 의
      // nodeId/nodeExecutionId 를 운반하지 않으므로 ?? '' fallback 만 다르다.
      // (usage logs / WS 이벤트는 원래 waiting NodeExecution 에 귀속)
      const { executedCount: providerExecuted } =
        await this.executeProviderToolBatch({
          calls: classification.providerToolCalls,
          remainingBudget: maxToolCalls - toolCallCount,
          executionId: executionId ?? '',
          nodeId: (state.nodeId as string | undefined) ?? '',
          nodeExecutionId: state.nodeExecutionId as string | undefined,
          workflowId: state.workflowId as string | undefined,
          workspaceId,
          config: turnConfig,
          turnIndex: turnCount,
          ragGroup,
          toolCallTraces,
          messages,
        });
      toolCallCount += providerExecuted;

      for (const tc of classification.conditionToolCalls) {
        toolCallCount++;
        const condDeferralContent = JSON.stringify({
          result:
            '확인되었습니다. 도구 실행 결과를 참고하여 최종 판단해주세요.',
        });
        messages.push({
          role: 'tool',
          content: condDeferralContent,
          toolCallId: tc.id,
        });
        if (
          this.isToolTurnsEnabled(
            state.rawConfig as Record<string, unknown> | undefined,
          )
        ) {
          this.pushAiToolResultTurn(
            this.threadHolderFromState(state),
            this.buildAiNodeRefFromState(state),
            tc.id,
            condDeferralContent,
          );
        }
      }

      for (const tc of classification.normalToolCalls) {
        if (toolCallCount >= maxToolCalls) {
          const budgetContent = JSON.stringify({
            error: 'tool_call_budget_exceeded',
          });
          messages.push({
            role: 'tool',
            content: budgetContent,
            toolCallId: tc.id,
          });
          if (
            this.isToolTurnsEnabled(
              state.rawConfig as Record<string, unknown> | undefined,
            )
          ) {
            this.pushAiToolResultTurn(
              this.threadHolderFromState(state),
              this.buildAiNodeRefFromState(state),
              tc.id,
              budgetContent,
            );
          }
          continue;
        }
        toolCallCount++;
        const normalContent = JSON.stringify({
          result: `Tool ${tc.name} executed`,
          arguments: tc.arguments,
        });
        messages.push({
          role: 'tool',
          content: normalContent,
          toolCallId: tc.id,
        });
        if (
          this.isToolTurnsEnabled(
            state.rawConfig as Record<string, unknown> | undefined,
          )
        ) {
          this.pushAiToolResultTurn(
            this.threadHolderFromState(state),
            this.buildAiNodeRefFromState(state),
            tc.id,
            normalContent,
          );
        }
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
    // ConversationThread push (spec §2.2 — multi-turn final assistant per
    // turn). The thread accumulates one assistant turn per LLM round-trip;
    // downstream AI Agent nodes with `contextScope` see the running history.
    this.pushAiThreadTurn(
      this.threadHolderFromState(state),
      this.buildAiNodeRefFromState(state),
      'ai_assistant',
      result.content || '',
    );

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
          mcpServerSummaries: mcpDiagnosticsAcc,
        },
        { llmCalls, totalDurationMs: turnDurationMs },
        turnDebugHistory,
        state.rawConfig as Record<string, unknown> | undefined,
      );
    }

    // CONVENTIONS Principle 7 — multi-turn resume echo. Engine snapshots
    // `state.rawConfig` (frozen) at the first turn (Phase 1), so the
    // post-resume waiting tick echoes from that snapshot rather than the
    // resolved per-turn `config`. State persisted from before Phase 1 may
    // not have rawConfig — fall back to evaluated state values for both
    // model and systemPrompt to avoid `undefined` echo (review CRIT #1).
    const turnRawConfig =
      (state.rawConfig as Record<string, unknown> | undefined) ?? {};
    const stateSystemPrompt = (state.systemPrompt as string | undefined) ?? '';
    const waitingResult: ResumableNodeHandlerOutput = {
      config: {
        mode: 'multi_turn' as const,
        model: turnRawConfig.model ?? model,
        systemPrompt: turnRawConfig.systemPrompt ?? stateSystemPrompt,
        maxTurns: turnRawConfig.maxTurns ?? maxTurns,
        maxToolCalls: turnRawConfig.maxToolCalls ?? maxToolCalls,
        ...(turnRawConfig.knowledgeBases !== undefined
          ? { knowledgeBases: turnRawConfig.knowledgeBases }
          : knowledgeBases.length > 0
            ? { knowledgeBases }
            : {}),
        ...(turnRawConfig.conditions !== undefined &&
        Array.isArray(turnRawConfig.conditions) &&
        (turnRawConfig.conditions as unknown[]).length > 0
          ? { conditions: turnRawConfig.conditions }
          : conditions.length > 0
            ? { conditions }
            : {}),
      },
      // D6 (2026-05-17) — resumed waiting tick 도 단일 경로로 통일.
      output: {
        result: {
          messages,
          message: result.content || '',
          turnCount,
          maxTurns,
        },
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
        ragSources: ragAcc.getSources().slice(-MAX_RESUME_RAG_SOURCES),
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
      state.rawConfig as Record<string, unknown> | undefined,
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
      mcpServerSummaries?: McpServerSummary[];
    },
    turnDebug?: {
      llmCalls?: unknown[];
      totalDurationMs?: number;
    },
    turnDebugHistory?: unknown[],
    rawConfig?: Record<string, unknown>,
  ): NodeHandlerOutput {
    // CONVENTIONS §8 — wrap conversation result under `output.result.*`.
    // Tokens + tool-call counts go to `meta.*` (Principle 2). The legacy
    // `interactionType: 'ai_conversation'` marker moves to `meta.interactionType`
    // so the run-results UI's conversation Preview tab keeps rendering.
    //
    // Port routing per spec §3.2 (Multi Turn 출력 포트):
    //  - `user_ended` → `user_ended`
    //  - `max_turns` → `max_turns`
    //  - `error` → `error`
    //  - `condition` → caller must use `buildConditionOutput` so that the
    //     dynamic `{condition.id}` port is set; if it ever leaks here we
    //     fall back to `error` (defensive — there is no generic `out` port
    //     in multi-turn mode).
    const port = AiAgentHandler.multiTurnPortForEndReason(endReason);
    return {
      config: this.buildMultiTurnConfigEcho(rawConfig, metadata.model),
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
        ...(AiAgentHandler.buildMcpDiagnosticsMeta(metadata.mcpServerSummaries) ??
          {}),
        turnDebug: turnDebugHistory ?? [],
      },
      port,
      status: 'ended',
    };
  }

  /**
   * Map a multi-turn `endReason` to the corresponding output port id per
   * spec §3.2. Centralised so {@link buildMultiTurnFinalOutput} and any
   * future error-routing helper share a single source of truth.
   *
   * `condition` should never reach this function — `buildConditionOutput`
   * routes to the dynamic `{condition.id}` port instead. We map it to
   * `error` defensively so a programming mistake surfaces as an error
   * rather than a silent mis-route.
   */
  private static multiTurnPortForEndReason(
    endReason: 'user_ended' | 'max_turns' | 'condition' | 'error',
  ): string {
    switch (endReason) {
      case 'user_ended':
        return 'user_ended';
      case 'max_turns':
        return 'max_turns';
      case 'error':
        return 'error';
      case 'condition':
      default:
        return 'error';
    }
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
      mcpServerSummaries?: McpServerSummary[];
    },
    turnDebug?: {
      llmCalls?: unknown[];
      totalDurationMs?: number;
    },
    turnDebugHistory?: unknown[],
    rawConfig?: Record<string, unknown>,
  ): NodeHandlerOutput {
    const lastMsg = messages[messages.length - 1];
    const lastResponse = lastMsg?.content ?? '';

    return {
      config: this.buildMultiTurnConfigEcho(rawConfig, metadata.model),
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
        ...(AiAgentHandler.buildMcpDiagnosticsMeta(metadata.mcpServerSummaries) ??
          {}),
        turnDebug: turnDebugHistory ?? [],
      },
      port: condition.id,
      status: 'ended',
    };
  }

  // CONVENTIONS Principle 7 — multi-turn ended/condition echo. Surfaces the
  // frozen rawConfig (engine merges it into both `context.rawConfig` and
  // `state.rawConfig`) symmetric with the inline echoes at the initial /
  // resumed waiting ticks. Empty arrays are excluded uniformly across
  // `knowledgeBases` and `conditions` to match the waiting-tick echo
  // (line ~870 / ~1213) — surfacing `[]` would mislead downstream nodes
  // into treating "no entries configured" as "configured but empty".
  private buildMultiTurnConfigEcho(
    rawConfig: Record<string, unknown> | undefined,
    fallbackModel: string,
  ): Record<string, unknown> {
    const raw = (rawConfig ?? {}) as RawAiAgentMultiTurnConfig;
    const echo: Record<string, unknown> = {
      mode: raw.mode ?? 'multi_turn',
      model: raw.model ?? fallbackModel,
    };
    if (raw.systemPrompt !== undefined) echo.systemPrompt = raw.systemPrompt;
    if (raw.userPrompt !== undefined) echo.userPrompt = raw.userPrompt;
    if (raw.maxTurns !== undefined) echo.maxTurns = raw.maxTurns;
    if (raw.maxToolCalls !== undefined) echo.maxToolCalls = raw.maxToolCalls;
    if (raw.responseFormat !== undefined)
      echo.responseFormat = raw.responseFormat;
    if (Array.isArray(raw.knowledgeBases) && raw.knowledgeBases.length > 0) {
      echo.knowledgeBases = raw.knowledgeBases;
    }
    if (Array.isArray(raw.conditions) && raw.conditions.length > 0) {
      echo.conditions = raw.conditions;
    }
    return echo;
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

  /**
   * spec/5-system/11-mcp-client.md §6.2 — buildTools 가 수집한 serverSummaries
   * 를 meta 로 emit 할 때 쓰는 helper. 비어있으면 omit (정상 케이스에 noise
   * 추가 안 함). 2026-05-18 시점에는 `mcpDiagnostics` 의 `serverSummaries`
   * slice 만 채워지며 (`attempted`/`serverCount`/`toolCalls`/`resourceReads`/
   * `promptGets`/`errors`) 는 후속 작업에서 추가 예정.
   */
  private static buildMcpDiagnosticsMeta(
    summaries: McpServerSummary[] | undefined,
  ): { mcpDiagnostics: { serverSummaries: McpServerSummary[] } } | undefined {
    if (!summaries || summaries.length === 0) return undefined;
    return { mcpDiagnostics: { serverSummaries: summaries } };
  }

  private async buildTools(
    config: Record<string, unknown>,
    workspaceId: string,
    executionId?: string,
    mcpDiagnostics?: McpServerSummary[],
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
          mcpDiagnostics,
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
