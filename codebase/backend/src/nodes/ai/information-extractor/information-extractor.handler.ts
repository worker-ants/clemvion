import {
  NodeHandler,
  NodeHandlerOutput,
  ExecutionContext,
  ValidationResult,
  ResumableNodeHandlerOutput,
  ResumableMessageOptions,
} from '../../core/node-handler.interface';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';
import {
  LlmService,
  LlmCallContext,
  extractRetryAfterMs,
} from '../../../modules/llm/llm.service';
import {
  ChatMessage,
  ChatResult,
  ToolCall,
  ToolDef,
} from '../../../modules/llm/interfaces/llm-client.interface';
import { Logger } from '@nestjs/common';
import { informationExtractorNodeMetadata } from './information-extractor.schema';
import { buildSystemContextPrefixFromContext } from '../shared/system-context-prefix';
import { pickNonDefaultSystemContext } from '../shared/system-context-schema';
import { injectConversationContext } from '../shared/conversation-context-injection';
import type { ConversationContextInjectionResult } from '../shared/conversation-context-injection';
import type { ThreadHolder } from '../../../modules/execution-engine/conversation-thread/conversation-thread.service';
import {
  buildRecallBlock,
  appendStablePrefix,
  scheduleMemoryExtraction as sharedScheduleMemoryExtraction,
} from '../shared/agent-memory-injection';
import {
  DEFAULT_MEMORY_TOP_K,
  DEFAULT_MEMORY_THRESHOLD,
} from '../shared/agent-memory-schema';

/** ConversationThread injection debug echo snapshot (conversation-thread.md §5.3). */
type ContextInjectionMeta = ConversationContextInjectionResult['injection'];

interface OutputField {
  name: string;
  type: string;
  description: string;
  required?: boolean;
  enumValues?: string[];
}

interface Example {
  input: string;
  output: Record<string, unknown>;
}

type EndReason =
  | 'completed'
  | 'max_turns'
  | 'user_ended'
  | 'timeout'
  | 'max_retries'
  | 'error';

/**
 * Strip undefined entries so JSON snapshots and downstream consumers don't
 * need to guard against the key being present with an undefined value.
 */
function defined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

interface LlmCallTrace {
  requestPayload: unknown;
  responsePayload: unknown;
  durationMs: number;
}

interface TurnDebugEntry {
  turnIndex: number;
  llmCalls: LlmCallTrace[];
  totalDurationMs: number;
}

// Shape of the user-authored multi-turn config as it appears on
// `context.rawConfig` / `state.rawConfig` after the engine freezes
// `node.config`. All fields optional — pre-Phase-1 state rows omit
// rawConfig entirely. Used by multiTurnConfigEcho to narrow `unknown`.
interface RawInformationExtractorMultiTurnConfig {
  mode?: string;
  model?: string;
  outputSchema?: OutputField[];
  instructions?: string;
  examples?: Example[];
  inputField?: string;
  maxTurns?: number;
  maxCollectionRetries?: number;
}

interface MultiTurnState {
  llmConfigId?: string;
  model: string;
  workspaceId: string;
  outputSchema: OutputField[];
  instructions: string;
  examples: Example[];
  messages: ChatMessage[];
  partialResult: Record<string, unknown>;
  turnCount: number;
  maxTurns: number;
  /** How many times the LLM claimed completion but actually left required
   * fields missing — each reprompt bumps this. 0 means no reprompt has
   * happened yet. */
  collectionRetryCount: number;
  /** User-configurable limit on collection reprompts. 0 means unlimited. */
  maxCollectionRetries: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalThinkingTokens: number;
  /** Persisted per-turn LLM trace — mirrors the shape AI Agent uses so the
   * frontend LlmInformationTab can render both node types uniformly. */
  turnDebugHistory: TurnDebugEntry[];
  /** Frozen snapshot of the user-authored config (templates preserved). The
   * engine merges `node.config` into the resume state on the first waiting
   * tick so subsequent turns read raw values from `state.rawConfig` rather
   * than the per-turn evaluated `config`. CONVENTIONS Principle 7. */
  rawConfig?: Record<string, unknown>;
  /** ConversationThread injection debug echo (conversation-thread.md §5.3 —
   * 세 노드 공통). Captured at first multi-turn entry (the only point injection
   * runs) and carried through resume so the final `completed` / `max_turns`
   * output can echo it. Absent when scope was `none` (noop). */
  contextInjection?: ContextInjectionMeta;
  /**
   * persistent 메모리 전략 (memory-strategy-extend-ie). 멀티턴 resume turn
   * (`processMultiTurnMessage`) / 종결(`buildMultiTurnFinalOutput`) 은 state 만
   * 받으므로, 첫 진입에서 resolve 한 전략을 state 에 실어 운반한다. 미설정 = manual.
   */
  memoryStrategy?: 'manual' | 'persistent';
  /**
   * 첫 멀티턴 진입에서 캡처한 ConversationThread 참조 (memory-strategy-extend-ie).
   * 종결(`buildMultiTurnFinalOutput`) 경로가 context 없이도 thread push + (persistent
   * 시) 추출 source 를 얻기 위해 state 로 운반한다 (ai_agent `conversationThreadRef`
   * 패턴). **전략 무관** — 종결 thread 등록은 manual 에서도 일어나므로 항상 운반한다.
   * 직렬화로 영속되며, resume 시 같은 in-memory thread 로 복원된다.
   */
  conversationThreadRef?: import('../../../shared/conversation-thread/conversation-thread.types').ConversationThread;
  /**
   * 첫 멀티턴 진입의 executionId (memory-strategy-extend-ie). persistent 종결 추출의
   * scope key resolve 에 필요 — `endMultiTurnConversation` 은 context 를 받지 않음.
   * 전략 무관하게 운반(추출 미수행 시 미사용).
   */
  executionId?: string;
  /** 첫 멀티턴 진입의 nodeId — 종결 push 시 NodeRef 구성용 (전략 무관 운반). */
  nodeId?: string;
  /**
   * 첫 멀티턴 진입의 **평가된** 메모리 config 스냅샷 (memory-strategy-extend-ie).
   * rawConfig 는 `{{...}}` 템플릿이 보존된 미평가 값이라 scope key resolve 에
   * 부적합하므로, 종결 추출에 필요한 평가값(memoryKey/llmConfigId/model/모델 폴백/
   * TTL)만 별도로 운반한다. recall(첫 진입)은 evaluated `config` 를 직접 쓰므로 무관.
   */
  memoryConfig?: Record<string, unknown>;
  /**
   * persistent 메모리 증분 추출 watermark (memory-strategy-extend-ie) — 직전
   * extraction enqueue 가 커버한 마지막 turn 의 seq. 멀티턴에서 이 seq 초과 turn 만
   * 새로 snapshot 한다 (ai_agent §M1 패턴). undefined = 아직 추출 안 함.
   *
   * **현재 구조 주의**: IE 멀티턴은 종결(`buildMultiTurnFinalOutput`)에서 1회만
   * 추출 enqueue 하고 그 반환 watermark 를 resume state 로 다시 싣지 않는다(종결은
   * 응답 정규화 직전 fire-and-forget). 따라서 watermark 는 현재 **전진하지 않으며**,
   * 이 필드는 향후 waiting-tick 단위 추출(turn 경계마다 enqueue)을 도입할 때를 대비한
   * forward-looking 운반 슬롯이다 — 운반 invariant(A3)만 지금 핀으로 보장한다.
   *
   * **A3 교훈**: 이 필드는 반드시 `stateBase` → resume state 로 운반돼야 한다.
   * turn2+ 에서 유실되면 매 turn 전체 thread 를 재추출(또는 scopeKey 불일치)하게 된다.
   */
  lastExtractionTurnSeq?: number;
  // Unused by this handler but kept so the engine can pass generic state fields
  toolCalls?: number;
  ragSources?: unknown[];
  lastTurnRequest?: unknown;
  lastTurnResponse?: unknown;
  lastTurnDurationMs?: number;
}

const FINALIZE_TOOL_NAME = 'finalize_extraction';

export class InformationExtractorHandler implements NodeHandler {
  metadata = informationExtractorNodeMetadata;
  private readonly logger = new Logger(InformationExtractorHandler.name);
  constructor(
    private readonly llmService: LlmService,
    /**
     * Optional. Receives the final extracted payload as an `ai_assistant`
     * turn (text = `JSON.stringify(extracted)`) so a downstream AI Agent
     * with `contextScope` can use the extracted fields as context per
     * spec/conventions/conversation-thread.md §1.4 + §2.3 v2. Test
     * fixtures may omit this; the helper degrades to no-op.
     *
     * Both single-turn and multi-turn final-output paths push today
     * (multi-turn push resolved in memory-strategy-extend-ie): the
     * `buildMultiTurnFinalOutput` terminal path pushes the finalized snapshot
     * once (waiting ticks do not push). This gives persistent extraction a
     * `turns` source and downstream contextScope visibility, mirroring
     * single-turn.
     */
    private readonly conversationThreadService?: import('../../../modules/execution-engine/conversation-thread/conversation-thread.service').ConversationThreadService,
    /**
     * Optional. Persistent memory recall (before the extraction LLM call) +
     * turn-boundary async extraction (after the thread push). Only engaged
     * when `config.memoryStrategy === 'persistent'`; `manual` (default) is a
     * 100% no-op — recall/extract are never invoked (regression invariant).
     * Test fixtures may omit this; the helpers degrade to no-op.
     * SoT: spec/4-nodes/3-ai/3-information-extractor.md, spec/5-system/17-agent-memory.md.
     */
    private readonly agentMemoryService?: import('../../../modules/agent-memory/agent-memory.service').AgentMemoryService,
  ) {}

  /**
   * Push the extractor's final result as an `ai_assistant` turn (spec §1.4
   * — `JSON.stringify(extracted)`). No-op without the service.
   */
  private pushExtractorTurn(
    context: ExecutionContext,
    config: Record<string, unknown>,
    extracted: Record<string, unknown>,
  ): void {
    this.pushExtractorTurnTo(
      context,
      context.nodeId ?? '',
      context.rawConfig ?? config,
      extracted,
    );
  }

  /**
   * Push variant that takes an explicit thread holder + nodeId + config so the
   * multi-turn terminal path (which has only `state`, no `context`) can push
   * the finalized snapshot uniformly with single-turn (memory-strategy-extend-ie).
   */
  private pushExtractorTurnTo(
    target: ThreadHolder,
    nodeId: string,
    config: Record<string, unknown> | undefined,
    extracted: Record<string, unknown>,
  ): void {
    if (!this.conversationThreadService) return;
    this.conversationThreadService.appendAiAssistantMessage(target, {
      node: {
        id: nodeId,
        label: nodeId,
        type: 'information_extractor',
        config: config ?? {},
      },
      content: JSON.stringify(extracted),
    });
  }

  /** Thread reference carried in `state` from the first multi-turn turn. */
  private threadHolderFromState(
    state: MultiTurnState,
  ): ThreadHolder | undefined {
    return state.conversationThreadRef
      ? { conversationThread: state.conversationThreadRef }
      : undefined;
  }

  /** Resolve memoryStrategy from config — `manual` (default) | `persistent`. */
  private resolveMemoryStrategy(
    config: Record<string, unknown>,
  ): 'manual' | 'persistent' {
    return config.memoryStrategy === 'persistent' ? 'persistent' : 'manual';
  }

  /**
   * persistent 회수 (spec/5-system/17-agent-memory.md §4) — 추출 LLM 콜 직전에
   * 1회 동기 호출. 이전 세션에서 추출·저장된 사실을 top-k 의미검색으로 회수해
   * systemPrompt 의 안정 프리픽스(recall 블록)로 주입한다 (ai_agent
   * `injectMemoryContext` 의 [5a] 블록 패턴 모방). manual / 서비스 미주입 시
   * 입력 systemPrompt 그대로 반환 (no-op). 회수 실패는 graceful (빈 회수).
   *
   * IE 는 working-memory 압축(summary_buffer)이 없으므로 휘발성 꼬리/요약 블록은
   * 다루지 않는다 — 안정 프리픽스(recall)만 systemPrompt 에 append.
   */
  private async injectRecallPrefix(args: {
    strategy: 'manual' | 'persistent';
    config: Record<string, unknown>;
    systemPrompt: string;
    workspaceId: string;
    executionId: string;
    queryText: string;
  }): Promise<{ systemPrompt: string; recalledCount: number }> {
    if (args.strategy !== 'persistent' || !this.agentMemoryService) {
      return { systemPrompt: args.systemPrompt, recalledCount: 0 };
    }
    const evaluatedMemoryKey = args.config.memoryKey as
      | string
      | undefined
      | null;
    const scopeKey = this.agentMemoryService.resolveScopeKey(
      evaluatedMemoryKey,
      args.executionId,
    );
    const topK = (args.config.memoryTopK as number) || DEFAULT_MEMORY_TOP_K;
    const threshold =
      args.config.memoryThreshold !== undefined
        ? (args.config.memoryThreshold as number)
        : DEFAULT_MEMORY_THRESHOLD;
    // 빈 query 면 systemPrompt 로 폴백 (저장만 되고 회수 0 이 되는 비대칭 방지 —
    // ai_agent M2 와 동형).
    const queryText = args.queryText?.trim()
      ? args.queryText
      : args.systemPrompt;

    let recalled: Awaited<
      ReturnType<
        import('../../../modules/agent-memory/agent-memory.service').AgentMemoryService['recall']
      >
    > = [];
    try {
      recalled = await this.agentMemoryService.recall(
        args.workspaceId,
        scopeKey,
        queryText,
        {
          llmConfigId: args.config.llmConfigId as string | undefined,
          // 회수/추출 동일 embeddingModel — query/저장 임베딩 차원 일치 (§3).
          embeddingModel: args.config.embeddingModel as string | undefined,
        },
        { topK, threshold },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Information Extractor memory recall failed (graceful): ${message}`,
      );
      recalled = [];
    }

    const recallBlock = buildRecallBlock(recalled);
    const newSystemPrompt = appendStablePrefix(
      args.systemPrompt,
      recallBlock,
      '',
    );
    return { systemPrompt: newSystemPrompt, recalledCount: recalled.length };
  }

  /**
   * 턴 경계 비동기 추출 enqueue (spec/5-system/17-agent-memory.md §3) — persistent
   * 전략에서만, thread push 직후(추출 source 가 thread 에 들어간 뒤) 호출한다.
   * ai_agent `scheduleMemoryExtraction` 모방 — hot-path 비차단(enqueue 까지만 await),
   * 증분 watermark(`lastExtractionTurnSeq`) 로 seq 초과 turn 만 snapshot, enqueue
   * 가 실제 수락된 경우에만 watermark 전진(M1). manual / 서비스·thread 미주입 시 no-op.
   *
   * @returns 전진된(또는 보존된) watermark — 멀티턴 resume state 로 영속한다.
   */
  private async scheduleMemoryExtraction(args: {
    strategy: 'manual' | 'persistent';
    target: ThreadHolder | undefined;
    config: Record<string, unknown>;
    workspaceId: string;
    executionId: string;
    lastExtractionTurnSeq?: number;
  }): Promise<number | undefined> {
    // 구조 로직은 공유 헬퍼로 추출 (#484 후속, 동작 불변). ai_agent 와 동일
    // 경로 — persistent 외 no-op, getThread 전체 thread snapshot, M1 watermark.
    return sharedScheduleMemoryExtraction(
      {
        agentMemoryService: this.agentMemoryService,
        conversationThreadService: this.conversationThreadService,
      },
      {
        strategy: args.strategy,
        target: args.target,
        config: args.config,
        workspaceId: args.workspaceId,
        executionId: args.executionId,
        lastExtractionTurnSeq: args.lastExtractionTurnSeq,
      },
    );
  }

  validate(config: Record<string, unknown>): ValidationResult {
    // Schema SSOT (warningRules + validateConfig) covers no-llm-provider,
    // no-output-schema, single-turn-needs-input-field, per-field name+type,
    // multi-turn maxTurns numeric guard.
    const errors = evaluateMetadataBlockingErrors(this.metadata, config);
    return { valid: errors.length === 0, errors };
  }

  async execute(
    input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<NodeHandlerOutput> {
    const mode = (config.mode as string) || 'single_turn';
    if (mode === 'multi_turn') {
      return this.executeMultiTurn(input, config, context);
    }
    return this.executeSingleTurn(input, config, context);
  }

  // ======================================================================
  // Single turn
  // ======================================================================

  private async executeSingleTurn(
    _input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<NodeHandlerOutput> {
    const llmConfigId = config.llmConfigId as string | undefined;
    const model = config.model as string | undefined;
    const inputField = config.inputField as string;
    const outputSchema = config.outputSchema as OutputField[];
    const examples = (config.examples as Example[]) || [];
    const instructions = (config.instructions as string) || '';

    const workspaceId = (context.variables?.__workspaceId as string) || '';
    const llmConfig = await this.llmService.resolveConfig(
      llmConfigId,
      workspaceId,
    );

    // System Context Prefix — spec/4-nodes/3-ai/0-common.md §11.4 ordering [1].
    // info-extractor 의 systemPrompt 는 단일 build 단계라 prefix prepend 면 충분.
    const systemContextPrefix = buildSystemContextPrefixFromContext({
      context,
      config,
      now: new Date(),
    });
    const systemPrompt =
      systemContextPrefix +
      this.buildSingleTurnSystemPrompt(outputSchema, instructions, examples);
    const jsonSchema = this.buildJsonSchema(outputSchema, false);

    // Conversation Context 자동 주입 (spec/4-nodes/3-ai/0-common.md §10) —
    // `contextScope ≠ none` 이면 ConversationThread (자기 노드 turn 제외) 를
    // LLM 호출 직전 messages/systemPrompt 에 주입한다. retry 루프 전에 1회 빌드해
    // 모든 attempt 가 동일 messages 를 쓴다. scope=none(default) / service 미주입
    // 이면 noop — 기존 동작 불변.
    const injected = injectConversationContext<ThreadHolder>({
      reader: this.conversationThreadService,
      target: context,
      selfNodeId: context.nodeId ?? '',
      config,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: inputField },
      ],
      finalSystemPrompt: systemPrompt,
    });
    // system_text 모드에서도 injected.finalSystemPrompt 는 별도로 쓰지 않는다 —
    // injectConversationContext 가 messages[0](system) content 를 이미 동일하게
    // 갱신하므로 injected.messages 만 LLM 으로 넘기면 충분 (두 표면 동기화됨).
    let singleTurnMessages = injected.messages;

    // persistent 회수 (spec/5-system/17-agent-memory.md §4) — contextScope 주입
    // 위에 별도 안정 프리픽스(recall 블록)를 system 메시지에 append 한다. manual
    // (기본) 이면 no-op (recall 미호출, messages 불변 — 회귀 불변식).
    const memoryStrategy = this.resolveMemoryStrategy(config);
    const recalledSystemContent =
      singleTurnMessages.find((m) => m.role === 'system')?.content ??
      systemPrompt;
    const recall = await this.injectRecallPrefix({
      strategy: memoryStrategy,
      config,
      systemPrompt: recalledSystemContent,
      workspaceId,
      executionId: context.executionId,
      queryText: inputField,
    });
    if (recall.recalledCount > 0) {
      singleTurnMessages = singleTurnMessages.map((m) =>
        m.role === 'system' ? { ...m, content: recall.systemPrompt } : m,
      );
    }

    const startedAt = Date.now();
    const maxRetries = 2;
    let lastError: Error | undefined;
    let lastResponse: string | undefined;
    let lastModel: string | undefined;
    const llmCalls: LlmCallTrace[] = [];
    const totalAttempts = maxRetries + 1;
    // CONVENTIONS Principle 7 — config echoes raw inputField / model /
    // schema / instructions / examples (`{{ ... }}` templates preserved on
    // user-authored fields). Engine resolves expressions before dispatch
    // so the local variables hold evaluated values for runtime LLM calls.
    const rawConfig = context.rawConfig ?? config;
    const configEcho = {
      mode: 'single_turn' as const,
      model: rawConfig.model ?? model ?? llmConfig.defaultModel,
      schema: rawConfig.outputSchema ?? outputSchema,
      instructions: rawConfig.instructions ?? instructions,
      examples: rawConfig.examples ?? examples,
      inputField: rawConfig.inputField ?? inputField,
      // spec §11.7 — default 일치 시 생략, 명시 변경 시 echo.
      ...pickNonDefaultSystemContext(rawConfig),
    };

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let call: { result: ChatResult; trace: LlmCallTrace };
      try {
        call = await this.traceChat(
          llmConfig,
          {
            model: model || llmConfig.defaultModel,
            messages: singleTurnMessages,
            responseFormat: 'json',
            jsonSchema,
          },
          context.abortSignal,
          // [Spec 7-llm-usage §1.3] attribution 갭 해소 — WARNING#5.
          {
            workflowId: context.workflowId,
            executionId: context.executionId,
            nodeExecutionId: context.nodeExecutionId,
          },
        );
      } catch (error) {
        const errMessage =
          error instanceof Error ? error.message : String(error);
        return this.buildErrorOutput(configEcho, {
          code: 'LLM_CALL_FAILED',
          message: errMessage,
          details: {
            attempts: attempt + 1,
            originalInput: inputField,
            ...this.retryabilityDetails('LLM_CALL_FAILED', error),
          },
          durationMs: Date.now() - startedAt,
          model: lastModel,
          turnDebug: this.buildSingleTurnDebug(llmCalls, startedAt),
        });
      }
      llmCalls.push(call.trace);
      const result = call.result;
      lastResponse = result.content ?? undefined;
      lastModel = result.model;

      try {
        const extracted = JSON.parse(result.content || '{}') as Record<
          string,
          unknown
        >;

        // ConversationThread push (spec §1.4 v2 — single-turn final).
        this.pushExtractorTurn(context, config, extracted);

        // 턴 경계 비동기 추출 (persistent) — push 직후, 추출 source 가 thread 에
        // 들어간 뒤 호출. manual 이면 no-op (hot-path 비차단). enqueue reject 가
        // 응답 hot-path 를 막지 않도록 graceful — 실패해도 추출된 결과는 정상 반환.
        await this.scheduleMemoryExtraction({
          strategy: memoryStrategy,
          target: context,
          config,
          workspaceId,
          executionId: context.executionId,
        }).catch((err) => {
          this.logger.warn(
            'IE single-turn memory extraction enqueue 실패',
            err instanceof Error ? err.message : String(err),
          );
          return undefined;
        });

        return {
          config: configEcho,
          output: {
            result: {
              extracted,
              endReason: 'out' as const,
              turnCount: 1,
              originalInput: inputField,
            },
          },
          meta: defined({
            durationMs: Date.now() - startedAt,
            model: result.model,
            inputTokens: result.usage?.inputTokens ?? 0,
            outputTokens: result.usage?.outputTokens ?? 0,
            totalTokens: result.usage?.totalTokens ?? 0,
            thinkingTokens: result.usage?.thinkingTokens ?? 0,
            turnDebug: this.buildSingleTurnDebug(llmCalls, startedAt),
            // ConversationThread injection debug echo (conversation-thread.md
            // §5.3 — 세 노드 공통). Echo only when injection happened so noop
            // runs keep the meta lean (ai_agent 와 동일 형태).
            ...(injected.injection.appliedScope !== 'none'
              ? { contextInjection: injected.injection }
              : {}),
          }),
          port: 'out',
          status: 'ended',
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < maxRetries) {
          continue;
        }
      }
    }

    // All retries exhausted — route to error port instead of throwing
    return this.buildErrorOutput(configEcho, {
      code: 'LLM_RESPONSE_INVALID',
      message: lastError?.message || 'Failed to extract information',
      details: {
        attempts: totalAttempts,
        originalInput: inputField,
        lastResponse,
        ...this.retryabilityDetails('LLM_RESPONSE_INVALID'),
      },
      durationMs: Date.now() - startedAt,
      model: lastModel,
      turnDebug: this.buildSingleTurnDebug(llmCalls, startedAt),
    });
  }

  // ======================================================================
  // Multi turn
  // ======================================================================

  private async executeMultiTurn(
    _input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<NodeHandlerOutput> {
    const llmConfigId = config.llmConfigId as string | undefined;
    const model = config.model as string | undefined;
    const inputField = config.inputField as string;
    const outputSchema = config.outputSchema as OutputField[];
    const examples = (config.examples as Example[]) || [];
    const instructions = (config.instructions as string) || '';
    const maxTurns = (config.maxTurns as number) ?? 10;
    const maxCollectionRetries = (config.maxCollectionRetries as number) ?? 3;

    const workspaceId = (context.variables?.__workspaceId as string) || '';
    const llmConfig = await this.llmService.resolveConfig(
      llmConfigId,
      workspaceId,
    );
    const resolvedModel = model || llmConfig.defaultModel;

    // System Context Prefix — spec/4-nodes/3-ai/0-common.md §11.4 ordering [1].
    // executeMultiTurn 은 첫 진입 시점에만 호출되며 결과 systemPrompt 가
    // state.messages 의 일부로 영속된다 (system role 메시지). 후속 turn
    // (processMultiTurnMessage / endMultiTurnConversation) 은 systemPrompt 를
    // 새로 빌드하지 않고 영속된 messages 를 그대로 재사용하므로 prefix 는 자연히
    // turn 간 frozen.
    const systemContextPrefix = buildSystemContextPrefixFromContext({
      context,
      config,
      now: new Date(),
    });
    const systemPrompt =
      systemContextPrefix +
      this.buildMultiTurnSystemPrompt(outputSchema, instructions, examples);

    // CONVENTIONS Principle 7 — capture rawConfig so the multi-turn ended
    // echo (multiTurnConfigEcho) and downstream resume turns surface
    // user-authored templates rather than engine-resolved values. The
    // engine ALSO merges node.config into resumeState on first waiting tick
    // (execution-engine.service.ts), but storing it here too keeps the
    // initial-turn ended path (forcedEnd / completed / max_turns within
    // executeMultiTurn) consistent before any waiting tick has happened.
    const rawConfig: Record<string, unknown> = context.rawConfig ?? config;
    // persistent 메모리 전략 — resume turn / 종결이 state 만 받으므로 stateBase 에
    // 실어 운반한다 (A3 교훈: 신규 memory state 필드 유실 방지). manual=기존 동작.
    const memoryStrategy = this.resolveMemoryStrategy(config);
    const stateBase = {
      llmConfigId,
      model: resolvedModel,
      workspaceId,
      outputSchema,
      instructions,
      examples,
      maxTurns,
      maxCollectionRetries,
      rawConfig,
      memoryStrategy,
      // 종결(buildMultiTurnFinalOutput) thread push 는 **전략 무관** (spec §4.2 +
      // conversation-thread.md §2.3 — multi-turn 종결 결과를 thread 에 1회 등록,
      // v2 limitation 해소; 등록=가시성 ↔ 추출=persistent 전용은 별개). 따라서
      // thread ref + push target 식별자(nodeId/executionId)는 manual 에서도 운반한다.
      // A3 교훈 — resume turn 에서 유실 방지 위해 stateBase 에 싣는다.
      conversationThreadRef: context.conversationThread,
      executionId: context.executionId,
      nodeId: context.nodeId ?? '',
      // memoryConfig 는 추출(persistent 전용) scope/모델 폴백에만 쓰이므로 persistent
      // 일 때만 운반한다 (manual 종결은 push 만 하고 추출하지 않음).
      ...(memoryStrategy === 'persistent'
        ? {
            // 평가된 메모리 config 스냅샷 — 종결 추출 scope/모델 폴백에 사용.
            memoryConfig: {
              memoryKey: config.memoryKey,
              llmConfigId: config.llmConfigId,
              model: config.model,
              extractionModel: config.extractionModel,
              embeddingModel: config.embeddingModel,
              memoryTtlDays: config.memoryTtlDays,
            },
          }
        : {}),
    };

    // No inputField: skip initial LLM call and wait for the user's first
    // message from the UI. Mirrors AiAgentHandler's empty-userPrompt path.
    // context injection 은 LLM 콜이 있는 resume 진입(아래 첫 turn)에서 1회 수행
    // 한다 — 이 대기(no-LLM) 경로는 주입 불요 (주입은 첫 LLM 호출 직전에만 의미).
    if (!inputField) {
      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
      ];
      const state: MultiTurnState = {
        ...stateBase,
        messages,
        partialResult: {},
        turnCount: 0,
        collectionRetryCount: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalThinkingTokens: 0,
        turnDebugHistory: [],
      };
      return this.buildWaitingResponse(state, '');
    }

    const multiTurnStartedAt = Date.now();
    // Conversation Context 자동 주입 (spec/4-nodes/3-ai/0-common.md §10) —
    // multi-turn 은 첫 진입 시 1회 주입하고, 주입된 turn 은 runResult.messages →
    // state.messages → 이후 turn 의 _resumeState.messages 로 운반된다 (AI Agent
    // multi-turn 과 동일 패턴 — 후속 turn 은 재주입하지 않음). scope=none(default)
    // / service 미주입이면 noop.
    const injected = injectConversationContext<ThreadHolder>({
      reader: this.conversationThreadService,
      target: context,
      selfNodeId: context.nodeId ?? '',
      config,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: inputField },
      ],
      finalSystemPrompt: systemPrompt,
    });
    let messages: ChatMessage[] = injected.messages;

    // persistent 회수 (spec §4) — 멀티턴 첫 진입 시 1회. 회수 블록을 system
    // 메시지에 append 하면 state.messages → 후속 turn 으로 자연히 운반된다
    // (재주입 안 함, contextScope 와 동형). manual 이면 no-op.
    const recalledSystemContent =
      messages.find((m) => m.role === 'system')?.content ?? systemPrompt;
    const recall = await this.injectRecallPrefix({
      strategy: memoryStrategy,
      config,
      systemPrompt: recalledSystemContent,
      workspaceId,
      executionId: context.executionId,
      queryText: inputField,
    });
    if (recall.recalledCount > 0) {
      messages = messages.map((m) =>
        m.role === 'system' ? { ...m, content: recall.systemPrompt } : m,
      );
    }

    const turnStartedAt = Date.now();
    const llmCalls: LlmCallTrace[] = [];
    const turnIndex = 1;

    const runResult = await this.runTurnWithCollectionRetries(
      {
        llmConfig,
        model: resolvedModel,
        outputSchema,
        maxCollectionRetries,
        initialMessages: messages,
        initialPartialResult: {},
        startingRetryCount: 0,
        llmCalls,
        abortSignal: context.abortSignal,
        // [Spec 7-llm-usage §1.3] attribution 갭 해소 — WARNING#5.
        llmContext: {
          workflowId: context.workflowId,
          executionId: context.executionId,
          nodeExecutionId: context.nodeExecutionId,
        },
      },
      outputSchema,
    );

    if (runResult.kind === 'error') {
      return this.buildErrorOutput(this.multiTurnConfigEcho(stateBase), {
        code: 'LLM_CALL_FAILED',
        message: runResult.error,
        details: {
          originalInput: inputField,
          turnCount: 0,
          ...this.retryabilityDetails('LLM_CALL_FAILED', runResult.rawError),
        },
        durationMs: Date.now() - multiTurnStartedAt,
        model: resolvedModel,
        turnDebug: [],
      });
    }

    const turnDurationMs = Date.now() - turnStartedAt;
    const turnDebugHistory: TurnDebugEntry[] = [
      { turnIndex, llmCalls, totalDurationMs: turnDurationMs },
    ];

    const state: MultiTurnState = {
      ...stateBase,
      messages: runResult.messages,
      partialResult: runResult.partialResult,
      turnCount: turnIndex,
      collectionRetryCount: runResult.collectionRetryCount,
      totalInputTokens: runResult.totalInputTokens,
      totalOutputTokens: runResult.totalOutputTokens,
      totalThinkingTokens: runResult.totalThinkingTokens,
      turnDebugHistory,
      // Carry the injection echo through resume so the final output can surface
      // it (conversation-thread.md §5.3). Omit on noop to keep the state lean.
      ...(injected.injection.appliedScope !== 'none'
        ? { contextInjection: injected.injection }
        : {}),
    };

    const durationMs = Date.now() - multiTurnStartedAt;
    if (runResult.forcedEnd) {
      return this.buildMultiTurnFinalOutput(state, runResult.forcedEnd, {
        durationMs,
      });
    }
    if (this.isComplete(state.partialResult, outputSchema)) {
      return this.buildMultiTurnFinalOutput(state, 'completed', { durationMs });
    }
    if (maxTurns > 0 && turnIndex >= maxTurns) {
      return this.buildMultiTurnFinalOutput(state, 'max_turns', { durationMs });
    }
    return this.buildWaitingResponse(state, runResult.followUp);
  }

  async processMultiTurnMessage(
    userMessage: string,
    stateRaw: Record<string, unknown>,
    // information_extractor 는 render_form 을 발행하지 않으므로 source 신호를
    // 사용하지 않는다. 인터페이스 호환을 위해 받기만 한다 (spec/4-nodes/3-ai/
    // 1-ai-agent.md §6.2 step 2.c.bypass 는 AI Agent 한정).
    _options?: ResumableMessageOptions,
  ): Promise<unknown> {
    const state = this.hydrateState(stateRaw);
    const llmConfig = await this.llmService.resolveConfig(
      state.llmConfigId,
      state.workspaceId,
    );

    const messages: ChatMessage[] = [
      ...state.messages,
      { role: 'user', content: userMessage },
    ];

    const processStartedAt = Date.now();
    const turnStartedAt = Date.now();
    const llmCalls: LlmCallTrace[] = [];
    const turnIndex = state.turnCount + 1;

    const runResult = await this.runTurnWithCollectionRetries(
      {
        llmConfig,
        model: state.model,
        outputSchema: state.outputSchema,
        maxCollectionRetries: state.maxCollectionRetries,
        initialMessages: messages,
        initialPartialResult: state.partialResult,
        startingRetryCount: state.collectionRetryCount,
        llmCalls,
        // resume(continuation) 경로 — cancel-others-on-fail 같은 abort 컨텍스트가
        // 없으므로 signal 미전파 (optional). 초기 실행 경로(executeMultiTurn)만 전파.
        // [Spec 7-llm-usage §1.3] 재개 경로에서는 state 에 저장된 executionId/nodeId 로
        // attribution 최대 제공 (workflowId 는 state 에 없어 null, 추후 개선 가능).
        llmContext: state.executionId
          ? { executionId: state.executionId, nodeExecutionId: state.nodeId }
          : undefined,
      },
      state.outputSchema,
    );

    if (runResult.kind === 'error') {
      return this.buildErrorOutput(this.multiTurnConfigEcho(state), {
        code: 'LLM_CALL_FAILED',
        message: runResult.error,
        details: {
          turnCount: state.turnCount,
          collectionRetryCount: state.collectionRetryCount,
          ...this.retryabilityDetails('LLM_CALL_FAILED', runResult.rawError),
        },
        durationMs: Date.now() - processStartedAt,
        model: state.model,
        turnDebug: state.turnDebugHistory,
        result: {
          extracted: this.buildExtractedSnapshot(
            state.partialResult,
            state.outputSchema,
          ),
          endReason: 'error',
          turnCount: state.turnCount,
          messages,
        },
      });
    }

    const turnDurationMs = Date.now() - turnStartedAt;
    const nextState: MultiTurnState = {
      ...state,
      messages: runResult.messages,
      partialResult: runResult.partialResult,
      turnCount: turnIndex,
      collectionRetryCount: runResult.collectionRetryCount,
      totalInputTokens: state.totalInputTokens + runResult.totalInputTokens,
      totalOutputTokens: state.totalOutputTokens + runResult.totalOutputTokens,
      totalThinkingTokens:
        state.totalThinkingTokens + runResult.totalThinkingTokens,
      turnDebugHistory: [
        ...state.turnDebugHistory,
        { turnIndex, llmCalls, totalDurationMs: turnDurationMs },
      ],
    };

    const durationMs = Date.now() - processStartedAt;
    if (runResult.forcedEnd) {
      return this.buildMultiTurnFinalOutput(nextState, runResult.forcedEnd, {
        durationMs,
      });
    }
    if (this.isComplete(nextState.partialResult, state.outputSchema)) {
      return this.buildMultiTurnFinalOutput(nextState, 'completed', {
        durationMs,
      });
    }
    if (state.maxTurns > 0 && turnIndex >= state.maxTurns) {
      return this.buildMultiTurnFinalOutput(nextState, 'max_turns', {
        durationMs,
      });
    }
    return this.buildWaitingResponse(nextState, runResult.followUp);
  }

  /**
   * Run one turn's LLM exchange using function calling.
   *
   * The LLM is given a `finalize_extraction` tool. Three response shapes:
   *
   *   1. Content only (no tool call) — the LLM is asking a followup. Return
   *      to caller as waiting; `partialResult` unchanged.
   *
   *   2. Tool call `finalize_extraction` with every required field present —
   *      the args become the completed extraction. Return to caller which
   *      routes to the `completed` port.
   *
   *   3. Tool call `finalize_extraction` with required fields missing —
   *      merge whatever non-null values were provided into `partialResult`,
   *      push a `tool` role message back to the LLM explaining what's still
   *      needed, bump `collectionRetryCount`, and loop. If the retry budget
   *      is spent, return with `forcedEnd='max_retries'` so the caller
   *      routes to the `error` port.
   */
  private async runTurnWithCollectionRetries(
    params: {
      llmConfig: Parameters<LlmService['chat']>[0];
      model: string;
      outputSchema: OutputField[];
      maxCollectionRetries: number;
      initialMessages: ChatMessage[];
      initialPartialResult: Record<string, unknown>;
      startingRetryCount: number;
      llmCalls: LlmCallTrace[];
      abortSignal?: AbortSignal;
      /** [Spec 7-llm-usage §1.3] attribution — WARNING#5. */
      llmContext?: LlmCallContext;
    },
    outputSchema: OutputField[],
  ): Promise<
    | {
        kind: 'ok';
        messages: ChatMessage[];
        partialResult: Record<string, unknown>;
        followUp: string;
        collectionRetryCount: number;
        totalInputTokens: number;
        totalOutputTokens: number;
        totalThinkingTokens: number;
        forcedEnd?: 'max_retries';
      }
    | { kind: 'error'; error: string; rawError: unknown }
  > {
    const finalizeTool = this.buildFinalizationTool(outputSchema);
    let messages = [...params.initialMessages];
    let partialResult = { ...params.initialPartialResult };
    let collectionRetryCount = params.startingRetryCount;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalThinkingTokens = 0;
    let followUp = '';

    for (;;) {
      let trace: LlmCallTrace;
      let result: ChatResult;
      try {
        // multi-turn 루프의 각 LLM 호출에 abortSignal 전파 (node-cancellation §2.1)
        // — cancel-others-on-fail / 사용자 cancel 발화 시 진행 중 turn 의 LLM 호출이
        // 즉시 abort 된다. abort 시 SDK 가 throw 하는 AbortError 는 그대로 전파돼
        // 엔진이 cancelled 로 분류한다 (§5.1).
        const call = await this.traceChat(
          params.llmConfig,
          {
            model: params.model,
            messages: [...messages],
            tools: [finalizeTool],
            toolChoice: 'auto',
          },
          params.abortSignal,
          // [Spec 7-llm-usage §1.3] attribution 갭 해소 — WARNING#5.
          params.llmContext,
        );
        result = call.result;
        trace = call.trace;
      } catch (error) {
        return {
          kind: 'error',
          error: error instanceof Error ? error.message : String(error),
          rawError: error,
        };
      }
      params.llmCalls.push(trace);
      totalInputTokens += result.usage?.inputTokens ?? 0;
      totalOutputTokens += result.usage?.outputTokens ?? 0;
      totalThinkingTokens += result.usage?.thinkingTokens ?? 0;

      const toolCall = this.pickFinalizeCall(result.toolCalls);

      // Append the assistant turn. `toolCalls` is preserved so downstream
      // frontend tool-call badges render identically to AI Agent.
      messages = [
        ...messages,
        {
          role: 'assistant',
          content: result.content ?? '',
          ...(result.toolCalls && result.toolCalls.length > 0
            ? { toolCalls: result.toolCalls }
            : {}),
        },
      ];

      // 1. Content-only response — treat as followup question.
      if (!toolCall) {
        followUp = result.content ?? '';
        return {
          kind: 'ok',
          messages,
          partialResult,
          followUp,
          collectionRetryCount,
          totalInputTokens,
          totalOutputTokens,
          totalThinkingTokens,
        };
      }

      // 2 & 3. LLM called finalize_extraction. Parse args, merge, validate.
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(toolCall.arguments || '{}') as Record<
          string,
          unknown
        >;
      } catch (err) {
        this.logger.warn(
          `finalize_extraction args not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      partialResult = this.mergePartial(partialResult, args, outputSchema);

      if (this.isComplete(partialResult, outputSchema)) {
        return {
          kind: 'ok',
          messages,
          partialResult,
          followUp: '',
          collectionRetryCount,
          totalInputTokens,
          totalOutputTokens,
          totalThinkingTokens,
        };
      }

      // Partial finalize — missing required fields. Nudge and retry.
      collectionRetryCount += 1;
      if (
        params.maxCollectionRetries > 0 &&
        collectionRetryCount > params.maxCollectionRetries
      ) {
        return {
          kind: 'ok',
          messages,
          partialResult,
          followUp: '',
          collectionRetryCount,
          totalInputTokens,
          totalOutputTokens,
          totalThinkingTokens,
          forcedEnd: 'max_retries',
        };
      }

      const missing = this.computeMissingFields(partialResult, outputSchema);
      messages = [
        ...messages,
        {
          role: 'tool',
          toolCallId: toolCall.id,
          content: JSON.stringify({
            error: 'incomplete_extraction',
            missingRequiredFields: missing,
            instruction:
              'Do NOT call finalize_extraction again yet. Ask the user one short question to gather each missing field, then call the tool only when every required field has a real user-provided value.',
          }),
        },
      ];
      // loop — LLM will receive the tool_result and should reply with a
      // natural-language followup for the user.
    }
  }

  /**
   * Pick the first `finalize_extraction` tool call from the LLM response,
   * if any. Extra/unknown tool calls are logged and ignored — defensive
   * handling for models that return multiple concurrent calls.
   */
  private pickFinalizeCall(toolCalls: ToolCall[] | undefined): ToolCall | null {
    if (!toolCalls || toolCalls.length === 0) return null;
    const finalize = toolCalls.find((tc) => tc.name === FINALIZE_TOOL_NAME);
    if (!finalize) {
      this.logger.warn(
        `LLM issued unexpected tool call(s): ${toolCalls
          .map((tc) => tc.name)
          .join(', ')} — treating as followup-only response.`,
      );
      return null;
    }
    if (toolCalls.length > 1) {
      this.logger.warn(
        `LLM issued ${toolCalls.length} tool calls; only the finalize_extraction call is honoured.`,
      );
    }
    return finalize;
  }

  /**
   * Called by the engine when the user ends the conversation or the
   * per-turn timer expires. Delegates to {@link buildMultiTurnFinalOutput}.
   */
  endMultiTurnConversation(
    stateRaw: Record<string, unknown>,
    endReason: EndReason,
  ): unknown {
    const state = this.hydrateState(stateRaw);
    return this.buildMultiTurnFinalOutput(state, endReason);
  }

  buildMultiTurnFinalOutput(
    state: MultiTurnState,
    endReason: EndReason,
    opts: { durationMs?: number } = {},
  ): NodeHandlerOutput {
    const totalTokens = state.totalInputTokens + state.totalOutputTokens;
    const extracted = this.buildExtractedSnapshot(
      state.partialResult,
      state.outputSchema,
    );
    const port = this.portForEndReason(endReason);

    // ── ConversationThread push (멀티턴 종결 — memory-strategy-extend-ie) ──
    // 종결 시점에 최종 추출 스냅샷을 ai_assistant turn 으로 1회 push 한다
    // (single-turn 과 동형, 현 v2 limitation 해소). waiting 상태에선 push 하지
    // 않으므로 종결 경로에서만 발생. 이 push 가 persistent 추출 source + 다운스트림
    // contextScope 가시성을 준다. thread ref/식별자는 state 가 운반한다.
    //
    // push 는 동기. 추출 enqueue 는 fire-and-forget (hot-path 비차단 — 본 메서드는
    // 엔진이 동기 호출 후 즉시 정규화하므로 await 불가; 추출은 비동기 producer 라
    // 응답을 막지 않는다). 멀티턴은 종결 1회 push 라 watermark 운반 불필요.
    //
    // `error` endReason 은 LLM 호출 실패 종결이므로 push 하지 않는다 (불완전 결과를
    // thread/메모리에 누적하지 않음 — single-turn error 경로도 push 안 함).
    const target = this.threadHolderFromState(state);
    if (endReason !== 'error' && target) {
      this.pushExtractorTurnTo(
        target,
        state.nodeId ?? '',
        state.rawConfig,
        extracted,
      );
      // 턴 경계 비동기 추출 (persistent) — push 직후, fire-and-forget. manual /
      // 서비스 미주입이면 즉시 no-op. enqueue 실패는 서비스 내부에서 삼켜진다.
      void this.scheduleMemoryExtraction({
        strategy: state.memoryStrategy ?? 'manual',
        target,
        config: state.memoryConfig ?? {},
        workspaceId: state.workspaceId,
        executionId: state.executionId ?? '',
        lastExtractionTurnSeq: state.lastExtractionTurnSeq,
      }).catch((err) =>
        this.logger.warn(
          'IE multi-turn memory extraction enqueue 실패',
          err instanceof Error ? err.message : String(err),
        ),
      );
    }

    const meta = defined({
      durationMs: opts.durationMs ?? 0,
      model: state.model,
      inputTokens: state.totalInputTokens,
      outputTokens: state.totalOutputTokens,
      totalTokens,
      thinkingTokens: state.totalThinkingTokens,
      collectionRetryCount: state.collectionRetryCount,
      turnDebug: state.turnDebugHistory,
      // ConversationThread injection debug echo (conversation-thread.md §5.3 —
      // 세 노드 공통). Carried from first-entry state; absent on noop runs.
      ...(state.contextInjection &&
      state.contextInjection.appliedScope !== 'none'
        ? { contextInjection: state.contextInjection }
        : {}),
    });

    // `max_retries` is an error path but with partial extraction preserved.
    // Both `output.error` and `output.result` coexist per CONVENTIONS §3.2.
    if (endReason === 'max_retries') {
      const missingFields = this.computeMissingFields(
        state.partialResult,
        state.outputSchema,
      );
      return {
        config: this.multiTurnConfigEcho(state),
        output: {
          error: {
            code: 'MAX_COLLECTION_RETRIES_EXCEEDED' as const,
            message:
              state.maxCollectionRetries > 0
                ? `LLM attempted finalize_extraction ${state.maxCollectionRetries + 1} times with missing required fields`
                : 'Max collection retries exceeded',
            details: {
              extracted,
              missingFields,
              turnCount: state.turnCount,
              collectionRetryCount: state.collectionRetryCount,
              ...this.retryabilityDetails('MAX_COLLECTION_RETRIES_EXCEEDED'),
            },
          },
          result: {
            extracted,
            endReason,
            turnCount: state.turnCount,
            messages: state.messages,
          },
        },
        meta,
        port,
        status: 'ended',
      };
    }

    // `error` endReason (LLM call failure mid-conversation) routes to the
    // error port with partial result preserved for observability.
    if (endReason === 'error') {
      return {
        config: this.multiTurnConfigEcho(state),
        output: {
          error: {
            code: 'LLM_CALL_FAILED' as const,
            message: 'Conversation terminated due to LLM call failure',
            details: {
              turnCount: state.turnCount,
              collectionRetryCount: state.collectionRetryCount,
              ...this.retryabilityDetails('LLM_CALL_FAILED'),
            },
          },
          result: {
            extracted,
            endReason,
            turnCount: state.turnCount,
            messages: state.messages,
          },
        },
        meta,
        port,
        status: 'ended',
      };
    }

    return {
      config: this.multiTurnConfigEcho(state),
      output: {
        result: {
          extracted,
          endReason,
          turnCount: state.turnCount,
          messages: state.messages,
        },
      },
      meta,
      port,
      status: 'ended',
    };
  }

  /**
   * Snapshot the current partialResult across the full schema, replacing
   * missing fields with `null` so downstream references are stable.
   */
  private buildExtractedSnapshot(
    partialResult: Record<string, unknown>,
    outputSchema: OutputField[],
  ): Record<string, unknown> {
    const extracted: Record<string, unknown> = {};
    for (const field of outputSchema) {
      const v = partialResult[field.name];
      extracted[field.name] = v === undefined ? null : v;
    }
    return extracted;
  }

  private multiTurnConfigEcho(state: {
    model: string;
    outputSchema: OutputField[];
    instructions: string;
    examples: Example[];
    maxTurns: number;
    maxCollectionRetries: number;
    rawConfig?: Record<string, unknown>;
  }): Record<string, unknown> {
    // CONVENTIONS Principle 7 — multi-turn ended echo surfaces the frozen
    // rawConfig (engine merges it into both `context.rawConfig` and
    // `state.rawConfig`) so downstream nodes see user-authored templates,
    // not engine-resolved values. Falls back to evaluated state values when
    // a legacy state row was persisted before rawConfig plumbing existed.
    const raw = (state.rawConfig ??
      {}) as RawInformationExtractorMultiTurnConfig;
    return defined({
      mode: raw.mode ?? 'multi_turn',
      model: raw.model ?? state.model,
      schema: raw.outputSchema ?? state.outputSchema,
      instructions: raw.instructions ?? state.instructions,
      examples: raw.examples ?? state.examples,
      inputField: raw.inputField,
      maxTurns: raw.maxTurns ?? state.maxTurns,
      maxCollectionRetries:
        raw.maxCollectionRetries ?? state.maxCollectionRetries,
      // spec §11.7 — default 일치 시 생략, 명시 변경 시 echo.
      ...pickNonDefaultSystemContext(state.rawConfig),
    });
  }

  private buildSingleTurnDebug(
    llmCalls: LlmCallTrace[],
    startedAt: number,
  ): TurnDebugEntry[] {
    if (llmCalls.length === 0) return [];
    return [
      {
        turnIndex: 1,
        llmCalls,
        totalDurationMs: Date.now() - startedAt,
      },
    ];
  }

  /**
   * spec §5.3 / CONVENTIONS Principle 3.2.1 — every LLM-node error envelope
   * exposes `details.retryable` (and `details.retryAfterSec` when retryable
   * and the provider signalled a `Retry-After`). Invariant: transient
   * provider failures (`LLM_CALL_FAILED` / `LLM_RATE_LIMIT`) are retryable;
   * deterministic failures (`LLM_RESPONSE_INVALID` /
   * `MAX_COLLECTION_RETRIES_EXCEEDED`) are not. `rawError` is the original
   * thrown value (when available) so `extractRetryAfterMs` can read the
   * RFC 7231 header; ms→sec, rounded up.
   */
  private retryabilityDetails(
    code: string,
    rawError?: unknown,
  ): { retryable: boolean; retryAfterSec?: number } {
    const retryable = code === 'LLM_CALL_FAILED' || code === 'LLM_RATE_LIMIT';
    if (!retryable) return { retryable: false };
    const retryAfterMs =
      rawError !== undefined ? extractRetryAfterMs(rawError) : null;
    return retryAfterMs !== null
      ? { retryable: true, retryAfterSec: Math.ceil(retryAfterMs / 1000) }
      : { retryable: true };
  }

  private buildErrorOutput(
    configEcho: Record<string, unknown>,
    params: {
      code: string;
      message: string;
      details?: Record<string, unknown>;
      durationMs: number;
      model?: string;
      turnDebug?: unknown[];
      collectionRetryCount?: number;
      result?: {
        extracted: Record<string, unknown>;
        endReason: EndReason;
        turnCount: number;
        messages: ChatMessage[];
      };
    },
  ): NodeHandlerOutput {
    const outputBody: Record<string, unknown> = {
      error: defined({
        code: params.code,
        message: params.message,
        details: params.details,
      }),
    };
    if (params.result) {
      outputBody.result = params.result;
    }
    return {
      config: configEcho,
      output: outputBody,
      meta: defined({
        durationMs: params.durationMs,
        model: params.model,
        collectionRetryCount: params.collectionRetryCount,
        turnDebug: params.turnDebug,
      }),
      port: 'error',
      status: 'ended',
    };
  }

  // ======================================================================
  // Helpers
  // ======================================================================

  private buildWaitingResponse(
    state: MultiTurnState,
    followUp: string,
  ): ResumableNodeHandlerOutput {
    // Surface partialResult + missingFields so the Output tab can show
    // what has been gathered so far while the node is still waiting for
    // user input. Frontend renders the same ExtractedFieldsCard against
    // either this waiting shape or the completed `output.extracted` shape.
    const extracted: Record<string, unknown> = {};
    for (const field of state.outputSchema) {
      const v = state.partialResult[field.name];
      extracted[field.name] = v === undefined ? null : v;
    }
    const missingFields = this.computeMissingFields(
      state.partialResult,
      state.outputSchema,
    );

    return {
      // Echo node config so the UI's Config tab renders during waiting state
      // (same shape as the completed `data.config`). Without this, the
      // frontend's `unwrapNodeOutput` treats a waiting payload as legacy and
      // shows "no config recorded".
      config: {
        schema: state.outputSchema,
        mode: 'multi_turn',
        maxCollectionRetries: state.maxCollectionRetries,
      },
      // CONVENTIONS §4.3 — waiting payload. D6 (2026-05-17) — multi-turn
      // 대화 상태(`messages` / `message` / `turnCount`) 를 종결 시점
      // (`output.result.*`) 과 단일 경로로 통일. `maxTurns` 는 static config
      // 값이라 output 에 echo 하지 않는다 (Principle 1.1 — UI 진행률 분모는
      // config.maxTurns). 진행 중 부분 수집은 별도 `output.partial.*` 슬롯
      // (5필드 invariant 안에서 result/partial 의 의미적 분리 유지).
      output: {
        result: {
          messages: state.messages,
          message: followUp,
          turnCount: state.turnCount,
        },
        partial: {
          extracted,
          missingFields,
          collectionRetryCount: state.collectionRetryCount,
        },
      },
      meta: { interactionType: 'ai_conversation' },
      status: 'waiting_for_input',
      _resumeState: state as unknown as Record<string, unknown>,
    };
  }

  private buildJsonSchema(
    outputSchema: OutputField[],
    multiTurn: boolean,
  ): Record<string, unknown> {
    const properties: Record<string, unknown> = {};
    for (const field of outputSchema) {
      const prop: Record<string, unknown> = {
        description: field.description || field.name,
      };
      switch (field.type) {
        case 'number':
          prop.type = ['number', 'null'];
          break;
        case 'boolean':
          prop.type = ['boolean', 'null'];
          break;
        case 'array':
          prop.type = ['array', 'null'];
          break;
        case 'object':
          prop.type = ['object', 'null'];
          break;
        default:
          prop.type = ['string', 'null'];
      }
      if (field.enumValues?.length) {
        prop.enum = [...field.enumValues, null];
      }
      properties[field.name] = prop;
    }

    if (multiTurn) {
      properties._missingFields = {
        type: 'array',
        items: { type: 'string' },
        description:
          'Names of required fields still missing. Empty when all required fields are filled.',
      };
      properties._followUpQuestion = {
        type: 'string',
        description:
          'One natural-language question to ask the user for the missing information. Empty when nothing is missing.',
      };
    }

    // In multi_turn mode every turn should emit _missingFields and _followUpQuestion
    // even when they are empty — requiring them keeps the schema validator honest.
    const required = multiTurn
      ? ['_missingFields', '_followUpQuestion']
      : outputSchema.filter((f) => f.required !== false).map((f) => f.name);

    return {
      type: 'object',
      properties,
      required,
      additionalProperties: false,
    };
  }

  private buildSingleTurnSystemPrompt(
    outputSchema: OutputField[],
    instructions: string,
    examples: Example[],
  ): string {
    const schemaDesc = this.describeSchema(outputSchema);
    const examplesText = this.formatExamples(examples);

    return `You are an information extraction expert. Extract structured data from the given text according to the following schema:

${schemaDesc}

${instructions ? `Additional instructions: ${instructions}\n` : ''}${examplesText}

Respond ONLY with a JSON object containing the extracted fields. Use null for fields that cannot be extracted.`;
  }

  private buildMultiTurnSystemPrompt(
    outputSchema: OutputField[],
    instructions: string,
    examples: Example[],
  ): string {
    const schemaDesc = this.describeSchema(outputSchema);
    const examplesText = this.formatExamples(examples);

    return `You are engaged in a multi-turn conversation with a user to collect structured information.

Your goal is to gather the following fields:
${schemaDesc}

${instructions ? `Additional instructions:\n${instructions}\n` : ''}${examplesText}

========================
LANGUAGE POLICY (STRICT)
========================

- You MUST always respond in the same language as the user's most recent message.
- This rule has the HIGHEST priority and overrides all other style instructions.

- If the user writes in Korean → respond in Korean.
- If the user writes in English → respond in English.
- If the user switches language → immediately switch to that language.

- NEVER default to English unless the user is speaking English.
- NEVER mix multiple languages in a single response.

- If the user's message contains multiple languages:
  → Use the dominant language of the message.

========================
CORE BEHAVIOR
========================

- Ask only for missing fields.
- Keep the conversation concise, clear, and natural.

========================
STRICT RULES (MUST FOLLOW)
========================

1. EXTRACT VALUES (DO NOT BLINDLY ACCEPT INPUT)
- Extract the most likely field value from the user's message.
- Ignore surrounding words, particles, or casual phrases.
- Example:
  User: "It's 312321-1331231."
  → Extracted value: "312321-1331231"

2. CONFIDENCE-BASED CONFIRMATION
- If the extracted value is clear and unambiguous, accept it.
- If there is ANY ambiguity:
  → Ask for confirmation before saving the value.
  → Example: "Is the order number '312321-1331231' correct?"

3. HANDLE PARTIAL RESPONSES
- If the user provides only some of the requested fields:
  → Save the provided values (after extraction/confirmation if needed)
  → Ask only for the remaining missing fields

4. NO RE-ASKING AFTER CONFIRMATION
- Once a value is confirmed, NEVER ask for it again.

5. NO GUESSING
- NEVER infer or assume missing values.

6. TRACK COMPLETION STATE
- Continue until ALL required fields have confirmed values.

========================
FINAL CONFIRMATION FLOW (MANDATORY)
========================

7. FINAL REVIEW STEP (REQUIRED BEFORE TOOL CALL)
- When ALL required fields are collected, DO NOT call the tool yet.
- Present a clear summary of all collected values.
- Ask the user to confirm.

8. WAIT FOR USER CONFIRMATION
- Only proceed after explicit confirmation.

9. HANDLE CORRECTIONS
- If the user corrects something:
  → Update only the corrected fields
  → Do NOT re-ask confirmed fields
  → Repeat the confirmation step

========================
FINALIZATION (MANDATORY RULE)
========================

10. CALL TOOL AFTER CONFIRMATION ONLY
- After confirmation, immediately call \`${FINALIZE_TOOL_NAME}\`.
- Pass ALL collected values.
- Do NOT output natural language when calling the tool.

11. TOOL CALL RESTRICTION
- Do NOT call the tool before confirmation.

========================
QUESTION STRATEGY
========================

- You MAY ask multiple fields in a single turn when appropriate.

Guidelines:
- If 1–2 fields are missing → ask together.
- If 3 or more → ask 1–2 at a time.
- If logically related → group them.
- If input is sensitive/precise → ask fewer at once.
- If user seems confused → ask one at a time.

========================
CONVERSATION STYLE
========================

- Be polite, concise, and helpful.
- Avoid repeating confirmed values except in the final confirmation step.
- Keep questions short and easy to answer.

========================
STRICT SEPARATION RULE
========================

- Asking for confirmation and calling the tool MUST happen in separate turns.
- NEVER call the tool in the same response where you ask for confirmation.
- If your message includes a question (e.g., "Is this correct?"), you MUST NOT call the tool.

========================
EXAMPLE FLOW
========================

User: 안녕하세요
You: 안녕하세요! 주문번호와 상품번호를 알려주시겠어요?

User: 주문번호는 312321-1331231이고 상품은 XYZ-001이에요
You: 다음 정보를 확인해주세요:
     - 주문번호: 312321-1331231
     - 상품번호: XYZ-001
     맞나요?

User: 네 맞아요
You: (call ${FINALIZE_TOOL_NAME} with order_id="312321-1331231", product_id="XYZ-001")`;
  }

  /**
   * Build the tool definition that the LLM must call to finalize extraction.
   * Reuses `buildJsonSchema(outputSchema, false)` so the tool parameters
   * match the caller's schema exactly (no `_missingFields`/`_followUpQuestion`
   * wrappers — those were an artefact of the previous JSON-response flow).
   */
  private buildFinalizationTool(outputSchema: OutputField[]): ToolDef {
    return {
      name: FINALIZE_TOOL_NAME,
      description:
        'Call this ONLY AFTER the user has explicitly confirmed that all collected values are correct. NEVER call this before confirmation.',
      parameters: this.buildJsonSchema(outputSchema, false),
    };
  }

  private describeSchema(outputSchema: OutputField[]): string {
    return outputSchema
      .map((f) => {
        let desc = `- "${f.name}" (${f.type}${f.required !== false ? ', required' : ', optional'}): ${f.description || 'no description'}`;
        if (f.enumValues?.length) {
          desc += ` [allowed values: ${f.enumValues.join(', ')}]`;
        }
        return desc;
      })
      .join('\n');
  }

  private formatExamples(examples: Example[]): string {
    if (examples.length === 0) return '';
    return (
      '\n\nExamples:\n' +
      examples
        .map(
          (ex, i) =>
            `Example ${i + 1}:\nInput: ${ex.input}\nOutput: ${JSON.stringify(ex.output)}`,
        )
        .join('\n\n')
    );
  }

  private safeParseJson(
    content: string | null | undefined,
  ): Record<string, unknown> {
    try {
      return JSON.parse(content || '{}') as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  /**
   * Merge incoming extraction into the accumulated partial result. An incoming
   * null/undefined value is treated as "no new information"; existing values
   * are preserved so the user's earlier answers are never overwritten.
   */
  private mergePartial(
    prev: Record<string, unknown>,
    incoming: Record<string, unknown>,
    outputSchema: OutputField[],
  ): Record<string, unknown> {
    const merged = { ...prev };
    for (const field of outputSchema) {
      const value = incoming[field.name];
      if (value !== null && value !== undefined) {
        merged[field.name] = value;
      }
    }
    return merged;
  }

  private isComplete(
    partial: Record<string, unknown>,
    outputSchema: OutputField[],
  ): boolean {
    return outputSchema
      .filter((f) => f.required !== false)
      .every((f) => {
        const v = partial[f.name];
        return v !== null && v !== undefined && v !== '';
      });
  }

  private hydrateState(raw: Record<string, unknown>): MultiTurnState {
    return {
      llmConfigId: raw.llmConfigId as string | undefined,
      model: raw.model as string,
      workspaceId: (raw.workspaceId as string) || '',
      outputSchema: raw.outputSchema as OutputField[],
      instructions: (raw.instructions as string) || '',
      examples: (raw.examples as Example[]) || [],
      messages: (raw.messages as ChatMessage[]) || [],
      partialResult: (raw.partialResult as Record<string, unknown>) || {},
      turnCount: (raw.turnCount as number) || 0,
      maxTurns: (raw.maxTurns as number) ?? 10,
      collectionRetryCount: (raw.collectionRetryCount as number) || 0,
      maxCollectionRetries: (raw.maxCollectionRetries as number) ?? 3,
      totalInputTokens: (raw.totalInputTokens as number) || 0,
      totalOutputTokens: (raw.totalOutputTokens as number) || 0,
      totalThinkingTokens: (raw.totalThinkingTokens as number) || 0,
      turnDebugHistory:
        (raw.turnDebugHistory as TurnDebugEntry[] | undefined) ?? [],
      rawConfig: raw.rawConfig as Record<string, unknown> | undefined,
      contextInjection: raw.contextInjection as
        | ContextInjectionMeta
        | undefined,
      memoryStrategy: raw.memoryStrategy as 'manual' | 'persistent' | undefined,
      conversationThreadRef: raw.conversationThreadRef as
        | import('../../../shared/conversation-thread/conversation-thread.types').ConversationThread
        | undefined,
      executionId: raw.executionId as string | undefined,
      nodeId: raw.nodeId as string | undefined,
      memoryConfig: raw.memoryConfig as Record<string, unknown> | undefined,
      lastExtractionTurnSeq: raw.lastExtractionTurnSeq as number | undefined,
    };
  }

  /** List required fields still missing from partialResult. */
  private computeMissingFields(
    partialResult: Record<string, unknown>,
    outputSchema: OutputField[],
  ): string[] {
    return outputSchema
      .filter((f) => f.required !== false)
      .filter((f) => {
        const v = partialResult[f.name];
        return v === null || v === undefined || v === '';
      })
      .map((f) => f.name);
  }

  /** Wrap `llmService.chat` with a trace entry so per-call debug data lands
   * in `_turnDebugHistory` for the frontend's LlmInformationTab.
   *
   * [Spec 7-llm-usage §1.3] llmContext (workflowId/executionId/nodeExecutionId) 를 선택적으로
   * 전달해 llm_usage_log 의 attribution 컬럼이 NULL 이 되는 갭을 해소 (WARNING#5).
   */
  private async traceChat(
    llmConfig: Parameters<LlmService['chat']>[0],
    params: Parameters<LlmService['chat']>[1],
    signal?: AbortSignal,
    llmContext?: LlmCallContext,
  ): Promise<{ result: ChatResult; trace: LlmCallTrace }> {
    const startedAt = Date.now();
    const result = await this.llmService.chat(llmConfig, params, llmContext, {
      signal,
    });
    return {
      result,
      trace: {
        requestPayload: params,
        responsePayload: result,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  /**
   * Map a conversation `endReason` to the Info Extractor's output port set.
   *  - `completed` → `completed` port (all required fields captured)
   *  - `user_ended` → `user_ended`
   *  - `max_turns` → `max_turns`
   *  - `max_retries` / `error` / `timeout` → `error`
   */
  private portForEndReason(endReason: EndReason): string {
    switch (endReason) {
      case 'completed':
        return 'completed';
      case 'user_ended':
        return 'user_ended';
      case 'max_turns':
        return 'max_turns';
      default:
        return 'error';
    }
  }
}
