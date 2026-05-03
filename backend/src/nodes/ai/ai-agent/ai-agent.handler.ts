import { Logger } from '@nestjs/common';
import {
  NodeHandler,
  ExecutionContext,
  ValidationResult,
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
  KbSearchDiagnostic,
} from './tool-providers/agent-tool-provider.interface';
import { aiAgentNodeMetadata } from './ai-agent.schema';

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

/** Build LLM tool name for a normal (Tool Area) node. */
function toolName(nodeId: string): string {
  return `tool_${sanitizeId(nodeId)}`;
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

  constructor(private readonly initialKbCount: number) {}

  pushSources(items: unknown[] | undefined): void {
    if (!items || items.length === 0) return;
    this.sources.push(...items);
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
    acc.sources.push(...existingSources);
    return acc;
  }
}

export class AiAgentHandler implements NodeHandler {
  metadata = aiAgentNodeMetadata;

  constructor(
    private readonly llmService: LlmService,
    private readonly toolProviders: AgentToolProvider[] = [],
  ) {}

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

    if (mode === 'multi_turn') {
      return this.executeMultiTurn(input, config, context);
    }
    return this.executeSingleTurn(input, config, context);
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

    const tools = await this.buildTools(config, workspaceId);

    // Per-call trace so the frontend LlmInformationTab can inspect each
    // request/response/usage even for single-turn runs (tool loop commonly
    // spans several calls).
    const llmCalls: Array<{
      requestPayload: unknown;
      responsePayload: unknown;
      durationMs: number;
    }> = [];
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

      // Provider tools (KB 등) — 핸들러 내부 직접 실행, 결과 메시지 + ragAcc 누적.
      for (const { provider, call } of classification.providerToolCalls) {
        toolCallCount++;
        const execResult = await provider.execute(call, {
          config,
          workspaceId,
        });
        ragAcc.pushSources(execResult.ragSourcesDelta);
        ragAcc.pushDiagnostic(execResult.ragDiagnosticsDelta);
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
      toolNodeIds: (config.toolNodeIds as string[]) || [],
      toolOverrides: (config.toolOverrides as unknown[]) || [],
      conditions,
      workspaceId,
    };

    return {
      type: 'ai_conversation',
      status: 'waiting_for_input',
      interactionType: 'ai_conversation',
      config: { mode: 'multi_turn', maxTurns, maxToolCalls },
      conversationConfig: {
        message: '',
        messages,
        turnCount: 0,
        maxTurns,
      },
      // CONVENTIONS §4.3 — runtime conversation snapshot mirrored at top
      // level. `$node["X"].output.messages` resolves via the adapter's
      // legacy-bare branch alongside `conversationConfig` (which will be
      // retired once frontend consumers migrate).
      messages,
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
  }

  /**
   * Process user message in multi-turn conversation.
   * Called by the execution engine when a user submits a message.
   */
  async processMultiTurnMessage(
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
    const turnConfig: Record<string, unknown> = {
      knowledgeBases,
      ragTopK: state.ragTopK,
      ragThreshold: state.ragThreshold,
      toolNodeIds: state.toolNodeIds,
      toolOverrides: state.toolOverrides,
      conditions,
    };
    const tools = await this.buildTools(turnConfig, workspaceId);

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
        const execResult = await provider.execute(call, {
          config: turnConfig,
          workspaceId,
        });
        ragAcc.pushSources(execResult.ragSourcesDelta);
        ragAcc.pushDiagnostic(execResult.ragDiagnosticsDelta);
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
    };
    const turnDebugHistory = [...prevHistory, currentTurnDebug];

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

    return {
      type: 'ai_conversation',
      status: 'waiting_for_input',
      interactionType: 'ai_conversation',
      config: { mode: 'multi_turn', maxTurns, maxToolCalls },
      conversationConfig: {
        message: result.content || '',
        messages,
        turnCount,
        maxTurns,
      },
      // CONVENTIONS §4.3 — runtime conversation snapshot at top level.
      messages,
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
      const matchedProvider = this.toolProviders.find((p) => p.matches(tc.name));
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
  ): Promise<ToolDef[]> {
    const toolNodeIds = (config.toolNodeIds as string[]) || [];
    const toolOverrides =
      (config.toolOverrides as Array<{
        nodeId: string;
        toolName: string;
        toolDescription: string;
      }>) || [];
    const conditions = (config.conditions as ConditionDef[]) || [];

    // Provider tools (KB 등) — 핸들러 내부 실행. 우선순위 가장 높음.
    const providerTools: ToolDef[] = [];
    for (const provider of this.toolProviders) {
      try {
        const built = await provider.buildTools({ config, workspaceId });
        providerTools.push(...built);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        AiAgentHandler.logger.warn(
          `Provider "${provider.key}" buildTools failed: ${msg}`,
        );
      }
    }

    const normalTools: ToolDef[] = toolNodeIds.map((nodeId) => {
      const override = toolOverrides.find((o) => o.nodeId === nodeId);
      return {
        name: override?.toolName || toolName(nodeId),
        description: override?.toolDescription || `Execute node ${nodeId}`,
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string', description: 'Input for the tool' },
          },
        },
      };
    });

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
