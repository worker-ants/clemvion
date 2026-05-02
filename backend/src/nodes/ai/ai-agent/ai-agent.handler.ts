import { Logger } from '@nestjs/common';
import {
  NodeHandler,
  ExecutionContext,
  ValidationResult,
} from '../../core/node-handler.interface';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';
import { LlmService } from '../../../modules/llm/llm.service';
import { RagSearchService } from '../../../modules/knowledge-base/search/rag-search.service';
import { ChatMessage } from '../../../modules/llm/interfaces/llm-client.interface';
import { LlmConfig } from '../../../modules/llm-config/entities/llm-config.entity';
import { SearchResult } from '../../../modules/knowledge-base/search/search-result.interface';
import { aiAgentNodeMetadata } from './ai-agent.schema';

// 멀티 쿼리 검색에서 LLM 이 생성할 수 있는 query 의 상한.
// 메시지가 아무리 다중 의도라도 한 turn 에 5개 이상으로 쪼개면 LLM 비용/검색 응답이 비대해진다.
const MAX_REWRITE_QUERIES = 5;
// 쿼리 rewrite 시 LLM 에 넘길 직전 대화 메시지 최대 개수 (user/assistant 합쳐서).
const REWRITE_HISTORY_MESSAGES = 6;

interface ConditionDef {
  id: string;
  label: string;
  prompt: string;
}

interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

interface ConditionClassification {
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

export class AiAgentHandler implements NodeHandler {
  metadata = aiAgentNodeMetadata;

  constructor(
    private readonly llmService: LlmService,
    private readonly ragSearchService: RagSearchService,
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
    const ragTopK = (config.ragTopK as number) || 5;
    const ragThreshold = (config.ragThreshold as number) || 0.7;
    const ragQueryRewrite = (config.ragQueryRewrite as boolean) ?? true;
    const maxToolCalls = (config.maxToolCalls as number) || 10;
    const conditions = (config.conditions as ConditionDef[]) || [];

    const workspaceId = (context.variables?.__workspaceId as string) || '';
    const llmConfig = await this.llmService.resolveConfig(
      llmConfigId,
      workspaceId,
    );

    // Build system prompt with RAG context + condition instructions
    let finalSystemPrompt = systemPrompt;
    let ragSources: unknown[] = [];

    if (knowledgeBases.length > 0 && userPrompt) {
      const searchResults = await this.searchKnowledgeBasesWithRewrite({
        llmConfig,
        rewriteModel: model || llmConfig.defaultModel,
        knowledgeBases,
        workspaceId,
        userMessage: userPrompt,
        topK: ragTopK,
        threshold: ragThreshold,
        rewrite: ragQueryRewrite,
      });

      if (searchResults.length > 0) {
        const ragContext = this.ragSearchService.buildContext(searchResults);
        finalSystemPrompt = finalSystemPrompt + ragContext.context;
        ragSources = ragContext.sources;
      }
    }

    // Inject condition instructions into system prompt
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

    // Build tool definitions from tool area nodes + conditions
    const tools = this.buildTools(config);

    // LLM call with tool use loop. Per-call trace is accumulated so the
    // frontend LlmInformationTab can inspect each request/response/usage
    // even for single-turn runs (tool loop commonly spans several calls).
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
      // Classify tool calls into condition and normal
      const classification = this.classifyToolCalls(
        result.toolCalls,
        conditions,
      );

      // Case 1: Only condition tools called (no normal tools)
      if (
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
            ragSources,
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

      // Case 2: Mixed (condition + normal) — execute normal tools, defer condition
      // Case 3: Only normal tools
      messages.push({
        role: 'assistant',
        content: result.content || '',
        toolCalls: result.toolCalls,
      });

      for (const tc of result.toolCalls as ToolCall[]) {
        if (classification.conditionToolCalls.some((ct) => ct.id === tc.id)) {
          // Condition tool: send deferral message (does not count toward toolCallCount)
          messages.push({
            role: 'tool',
            content: JSON.stringify({
              result:
                '확인되었습니다. 도구 실행 결과를 참고하여 최종 판단해주세요.',
            }),
            toolCallId: tc.id,
          });
        } else {
          // Normal tool: execute and count
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
        ragSources,
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
    const userPrompt = (config.userPrompt as string) || '';
    const temperature = config.temperature as number | undefined;
    const maxTokens = config.maxTokens as number | undefined;
    const knowledgeBases = (config.knowledgeBases as string[]) || [];
    const ragTopK = (config.ragTopK as number) || 5;
    const ragThreshold = (config.ragThreshold as number) || 0.7;
    const ragQueryRewrite = (config.ragQueryRewrite as boolean) ?? true;
    const maxToolCalls = (config.maxToolCalls as number) || 10;
    const maxTurns = (config.maxTurns as number) ?? 20;
    const conditions = (config.conditions as ConditionDef[]) || [];

    const workspaceId = (context.variables?.__workspaceId as string) || '';
    const llmConfig = await this.llmService.resolveConfig(
      llmConfigId,
      workspaceId,
    );

    // Build system prompt with RAG context for the initial prompt
    let finalSystemPrompt = systemPrompt;
    let ragSources: unknown[] = [];

    if (knowledgeBases.length > 0 && userPrompt) {
      const searchResults = await this.searchKnowledgeBasesWithRewrite({
        llmConfig,
        rewriteModel: model || llmConfig.defaultModel,
        knowledgeBases,
        workspaceId,
        userMessage: userPrompt,
        topK: ragTopK,
        threshold: ragThreshold,
        rewrite: ragQueryRewrite,
      });

      if (searchResults.length > 0) {
        const ragContext = this.ragSearchService.buildContext(searchResults);
        finalSystemPrompt = finalSystemPrompt + ragContext.context;
        ragSources = ragContext.sources;
      }
    }

    // Inject condition instructions
    if (conditions.length > 0) {
      finalSystemPrompt += this.buildConditionSystemPromptSuffix(conditions);
    }

    // Build initial messages
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
      ragQueryRewrite,
      maxToolCalls,
      maxTurns,
      toolNodeIds: (config.toolNodeIds as string[]) || [],
      toolOverrides: (config.toolOverrides as unknown[]) || [],
      conditions,
      workspaceId,
    };

    // No userPrompt: skip LLM call, wait for user's first message from UI
    if (!userPrompt) {
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
          ragSources,
        },
      };
    }

    // userPrompt provided: perform first LLM call
    messages.push({ role: 'user', content: userPrompt });

    const tools = this.buildTools(config);
    const firstTurnToolsDef = tools.length > 0 ? tools : undefined;
    const firstTurnStartedAt = Date.now();
    const firstTurnRequest = {
      model: resolvedModel,
      messages: [...messages],
      temperature,
      maxTokens,
      tools: firstTurnToolsDef,
    };

    const firstTurnLlmCalls: Array<{
      requestPayload: unknown;
      responsePayload: unknown;
      durationMs: number;
    }> = [];
    let ftCallStart = Date.now();
    let result = await this.llmService.chat(llmConfig, {
      model: resolvedModel,
      messages,
      temperature,
      maxTokens,
      tools: firstTurnToolsDef,
    });
    firstTurnLlmCalls.push({
      requestPayload: firstTurnRequest,
      responsePayload: result,
      durationMs: Date.now() - ftCallStart,
    });

    // Handle tool calls in first turn (with condition detection)
    let toolCallCount = 0;
    while (result.toolCalls?.length && toolCallCount < maxToolCalls) {
      const classification = this.classifyToolCalls(
        result.toolCalls,
        conditions,
      );

      // Condition-only: route immediately
      if (
        classification.normalToolCalls.length === 0 &&
        classification.matchedCondition
      ) {
        const reason = this.extractConditionReason(
          result.toolCalls,
          classification.matchedCondition.id,
        );
        messages.push({ role: 'assistant', content: result.content || '' });
        const ft1DebugHistory = [
          {
            turnIndex: 1,
            llmCalls: firstTurnLlmCalls,
            totalDurationMs: Date.now() - firstTurnStartedAt,
          },
        ];
        return this.buildConditionOutput(
          classification.matchedCondition,
          reason,
          messages,
          1,
          {
            model: resolvedModel,
            totalInputTokens: result.usage?.inputTokens ?? 0,
            totalOutputTokens: result.usage?.outputTokens ?? 0,
            totalThinkingTokens: result.usage?.thinkingTokens ?? 0,
            toolCalls: toolCallCount,
            ragSources,
          },
          {
            llmCalls: firstTurnLlmCalls,
            totalDurationMs: Date.now() - firstTurnStartedAt,
          },
          ft1DebugHistory,
        );
      }

      // Mixed or normal-only: execute tools
      messages.push({
        role: 'assistant',
        content: result.content || '',
        toolCalls: result.toolCalls,
      });

      for (const tc of result.toolCalls as ToolCall[]) {
        toolCallCount++;
        if (classification.conditionToolCalls.some((ct) => ct.id === tc.id)) {
          messages.push({
            role: 'tool',
            content: JSON.stringify({
              result:
                '확인되었습니다. 도구 실행 결과를 참고하여 최종 판단해주세요.',
            }),
            toolCallId: tc.id,
          });
        } else {
          messages.push({
            role: 'tool',
            content: JSON.stringify({
              result: `Tool ${tc.name} executed`,
              arguments: tc.arguments,
            }),
            toolCallId: tc.id,
          });
        }
      }

      const ftLoopReq = {
        model: resolvedModel,
        messages: [...messages],
        temperature,
        maxTokens,
        tools: firstTurnToolsDef,
      };
      ftCallStart = Date.now();
      result = await this.llmService.chat(llmConfig, {
        model: resolvedModel,
        messages,
        temperature,
        maxTokens,
        tools,
      });
      firstTurnLlmCalls.push({
        requestPayload: ftLoopReq,
        responsePayload: result,
        durationMs: Date.now() - ftCallStart,
      });
    }

    const firstTurnDurationMs = Date.now() - firstTurnStartedAt;

    // Add assistant response to messages
    messages.push({ role: 'assistant', content: result.content || '' });

    const totalInputTokens = result.usage?.inputTokens ?? 0;
    const totalOutputTokens = result.usage?.outputTokens ?? 0;
    const totalThinkingTokens = result.usage?.thinkingTokens ?? 0;

    // Return waiting_for_input to trigger blocking in execution engine
    return {
      type: 'ai_conversation',
      status: 'waiting_for_input',
      interactionType: 'ai_conversation',
      config: { mode: 'multi_turn', maxTurns, maxToolCalls },
      conversationConfig: {
        message: result.content || '',
        messages,
        turnCount: 1,
        maxTurns,
      },
      // CONVENTIONS §4.3 — runtime conversation snapshot at top level.
      messages,
      _resumeState: {
        ...multiTurnStateBase,
        messages,
        turnCount: 1,
        totalInputTokens,
        totalOutputTokens,
        totalThinkingTokens,
        toolCalls: toolCallCount,
        ragSources,
        lastTurnRequest: firstTurnRequest,
        lastTurnResponse: result,
        lastTurnDurationMs: firstTurnDurationMs,
        turnDebugHistory: [
          {
            turnIndex: 1,
            llmCalls: firstTurnLlmCalls,
            totalDurationMs: firstTurnDurationMs,
          },
        ],
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
    const ragTopK = (state.ragTopK as number) || 5;
    const ragThreshold = (state.ragThreshold as number) || 0.7;
    const ragQueryRewrite = (state.ragQueryRewrite as boolean) ?? true;
    const workspaceId = (state.workspaceId as string) || '';
    const conditions = (state.conditions as ConditionDef[]) || [];
    let totalInputTokens = state.totalInputTokens as number;
    let totalOutputTokens = state.totalOutputTokens as number;
    let totalThinkingTokens = (state.totalThinkingTokens as number) ?? 0;
    let toolCallCount = state.toolCalls as number;
    let ragSources = state.ragSources as unknown[];

    // 직전 대화 history 를 query rewrite LLM 에 컨텍스트로 넘기기 위해 user message 추가 전 스냅샷.
    const historyForRewrite: ChatMessage[] = [...messages];

    // Add user message
    messages.push({ role: 'user', content: userMessage });

    const llmConfigId = state.llmConfigId as string | undefined;
    const llmConfigForRag = await this.llmService.resolveConfig(
      llmConfigId,
      workspaceId,
    );

    // RAG search on new user message — query rewrite 활성 시 history 를 함께 넘겨 다중 쿼리 생성.
    if (knowledgeBases.length > 0 && userMessage) {
      const searchResults = await this.searchKnowledgeBasesWithRewrite({
        llmConfig: llmConfigForRag,
        rewriteModel: state.model as string,
        knowledgeBases,
        workspaceId,
        userMessage,
        topK: ragTopK,
        threshold: ragThreshold,
        rewrite: ragQueryRewrite,
        history: historyForRewrite,
      });

      if (searchResults.length > 0) {
        const ragContext = this.ragSearchService.buildContext(searchResults);
        // Inject RAG context as a system message for this turn
        messages.push({ role: 'system', content: ragContext.context });
        ragSources = [...ragSources, ...ragContext.sources];
      }
    }
    const llmConfig = llmConfigForRag;
    const model = state.model as string;
    const temperature = state.temperature as number | undefined;
    const maxTokens = state.maxTokens as number | undefined;
    const tools = this.buildTools(state);

    // Call LLM — track all LLM calls for debug
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

    // Handle tool calls with condition detection
    while (result.toolCalls?.length && toolCallCount < maxToolCalls) {
      const classification = this.classifyToolCalls(
        result.toolCalls,
        conditions,
      );

      // Condition-only: route immediately
      if (
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

        // Accumulate debug history including this turn
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
            ragSources,
          },
          { llmCalls, totalDurationMs: Date.now() - turnStartedAt },
          condTurnDebugHistory,
        );
      }

      // Mixed or normal-only: execute tools
      messages.push({
        role: 'assistant',
        content: result.content || '',
        toolCalls: result.toolCalls,
      });

      for (const tc of result.toolCalls as ToolCall[]) {
        toolCallCount++;
        if (classification.conditionToolCalls.some((ct) => ct.id === tc.id)) {
          messages.push({
            role: 'tool',
            content: JSON.stringify({
              result:
                '확인되었습니다. 도구 실행 결과를 참고하여 최종 판단해주세요.',
            }),
            toolCallId: tc.id,
          });
        } else {
          messages.push({
            role: 'tool',
            content: JSON.stringify({
              result: `Tool ${tc.name} executed`,
              arguments: tc.arguments,
            }),
            toolCallId: tc.id,
          });
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

    totalInputTokens += result.usage?.inputTokens ?? 0;
    totalOutputTokens += result.usage?.outputTokens ?? 0;
    totalThinkingTokens += result.usage?.thinkingTokens ?? 0;

    // Accumulate per-turn debug history (with all LLM calls)
    const prevHistory = (state.turnDebugHistory as unknown[]) || [];
    const currentTurnDebug = {
      turnIndex: turnCount,
      llmCalls,
      totalDurationMs: turnDurationMs,
    };
    const turnDebugHistory = [...prevHistory, currentTurnDebug];

    // Check if max turns reached
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
          ragSources,
        },
        { llmCalls, totalDurationMs: turnDurationMs },
        turnDebugHistory,
      );
    }

    // Continue conversation: return waiting_for_input again
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
        ragSources,
        lastTurnRequest: chatParams,
        lastTurnResponse: result,
        lastTurnDurationMs: turnDurationMs,
        turnDebugHistory,
      },
    };
  }

  /**
   * Build the final output when multi-turn conversation ends.
   */
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
        turnDebug: turnDebugHistory ?? [],
      },
      port: condition.id,
      status: 'ended',
    };
  }

  /**
   * Classify tool calls into condition tools and normal tools.
   * If multiple condition tools are called, select the one with the lowest index in conditions array.
   */
  private classifyToolCalls(
    toolCalls: ToolCall[],
    conditions: ConditionDef[],
  ): ConditionClassification {
    // Map cond_ tool name → condition for reverse lookup
    const condNameToCondition = new Map<string, ConditionDef>();
    for (const c of conditions) {
      condNameToCondition.set(condToolName(c.id), c);
    }

    const conditionToolCalls: ToolCall[] = [];
    const normalToolCalls: ToolCall[] = [];

    for (const tc of toolCalls) {
      if (condNameToCondition.has(tc.name)) {
        conditionToolCalls.push(tc);
      } else {
        normalToolCalls.push(tc);
      }
    }

    // Find the matched condition with lowest index in conditions array
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

    return { conditionToolCalls, normalToolCalls, matchedCondition };
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

  private buildTools(config: Record<string, unknown>): Array<{
    name: string;
    description: string;
    parameters: { type: 'object'; properties: Record<string, unknown> };
  }> {
    const toolNodeIds = (config.toolNodeIds as string[]) || [];
    const toolOverrides =
      (config.toolOverrides as Array<{
        nodeId: string;
        toolName: string;
        toolDescription: string;
      }>) || [];
    const conditions = (config.conditions as ConditionDef[]) || [];

    // Build normal tool definitions (tool_ prefix + sanitized UUID)
    const normalTools = toolNodeIds.map((nodeId) => {
      const override = toolOverrides.find((o) => o.nodeId === nodeId);
      return {
        name: override?.toolName || toolName(nodeId),
        description: override?.toolDescription || `Execute node ${nodeId}`,
        parameters: {
          type: 'object' as const,
          properties: {
            input: { type: 'string', description: 'Input for the tool' },
          },
        },
      };
    });

    // Build condition tool definitions (cond_ prefix + sanitized id)
    const conditionTools = conditions.map((c) => ({
      name: condToolName(c.id),
      description: c.prompt,
      parameters: {
        type: 'object' as const,
        properties: {
          reason: {
            type: 'string',
            description: '이 조건을 선택한 이유',
          },
        },
      },
    }));

    return [...normalTools, ...conditionTools];
  }

  // ── RAG: query rewrite + 다중 쿼리 동시 검색 ──

  /**
   * 한 turn 의 RAG 검색을 처리한다.
   *
   * `ragQueryRewrite` 가 켜져 있으면 LLM 으로 사용자 메시지를 1~N 개의 검색 쿼리로 재작성한 뒤,
   * 각 쿼리를 KB 에 동시 검색하고 결과를 chunk 단위로 병합·정렬해 상위 topK 만 반환.
   * 예: "교환 또는 환불 가능한가요?" → ["교환 정책", "환불 정책"] 두 쿼리 동시 검색.
   *
   * rewrite 가 꺼져 있거나 LLM rewrite 가 실패하면 원본 userMessage 단일 쿼리로 폴백.
   */
  private async searchKnowledgeBasesWithRewrite(opts: {
    llmConfig: LlmConfig;
    rewriteModel: string;
    knowledgeBases: string[];
    workspaceId: string;
    userMessage: string;
    topK: number;
    threshold: number;
    rewrite: boolean;
    history?: ChatMessage[];
  }): Promise<SearchResult[]> {
    const {
      llmConfig,
      rewriteModel,
      knowledgeBases,
      workspaceId,
      userMessage,
      topK,
      threshold,
      rewrite,
      history,
    } = opts;
    if (!knowledgeBases.length || !userMessage) return [];

    const queries = rewrite
      ? await this.rewriteQueriesForRag({
          llmConfig,
          model: rewriteModel,
          userMessage,
          history,
        })
      : [userMessage];

    // 각 쿼리에 동일 topK/threshold 를 적용해 병렬 검색. 멀티 쿼리 케이스에서는 같은 chunk 가
    // 여러 쿼리에 매칭될 수 있으므로 chunkId 단위로 dedupe + 최고점 score 채택.
    const perQueryResults = await Promise.all(
      queries.map((q) =>
        this.ragSearchService.search(q, knowledgeBases, workspaceId, {
          topK,
          threshold,
        }),
      ),
    );
    return mergeRagResults(perQueryResults, topK);
  }

  /**
   * userMessage + 직전 대화 history 를 LLM 에 넘겨 검색 쿼리 배열을 생성.
   * 출력은 `responseFormat: 'json'` + `jsonSchema` 로 강제해 파싱 안정성 확보.
   * 실패 / 빈 결과 / 파싱 실패 시 원본 userMessage 단일 쿼리 폴백.
   */
  private async rewriteQueriesForRag(opts: {
    llmConfig: LlmConfig;
    model: string;
    userMessage: string;
    history?: ChatMessage[];
  }): Promise<string[]> {
    const { llmConfig, model, userMessage, history } = opts;
    const recentHistory = (history ?? [])
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-REWRITE_HISTORY_MESSAGES);
    const historyText = recentHistory
      .map((m) => {
        const content = typeof m.content === 'string' ? m.content : '';
        return `${m.role}: ${content}`;
      })
      .filter((line) => line.trim().length > 0)
      .join('\n');

    const systemPrompt =
      'You generate concise knowledge base search queries from a user message.\n' +
      'Look at the user intent and conversation context. If the user asks about multiple distinct topics ' +
      '(e.g. "exchange or refund"), return one query per topic. If a single topic suffices, return one query.\n' +
      'Rules:\n' +
      `- Return at most ${MAX_REWRITE_QUERIES} queries.\n` +
      '- Each query must be a short search phrase (not a full sentence) optimized for retrieval.\n' +
      '- Use the same language as the user message.\n' +
      '- If the user message is small-talk or has no information need, return just the original message as a single query.';
    const userInput =
      (historyText ? `Recent conversation:\n${historyText}\n\n` : '') +
      `Latest user message:\n${userMessage}`;

    try {
      const result = await this.llmService.chat(llmConfig, {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userInput },
        ],
        temperature: 0,
        maxTokens: 200,
        responseFormat: 'json',
        jsonSchema: {
          type: 'object',
          properties: {
            queries: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
              maxItems: MAX_REWRITE_QUERIES,
            },
          },
          required: ['queries'],
          additionalProperties: false,
        },
      });
      const queries = parseRewriteQueries(result.content ?? '');
      if (queries.length === 0) return [userMessage];
      return queries.slice(0, MAX_REWRITE_QUERIES);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      AiAgentHandler.logger.warn(`RAG query rewrite failed: ${msg}`);
      return [userMessage];
    }
  }

  private static readonly logger = new Logger('AiAgentHandler');
}

/** rewrite LLM 응답을 안전하게 string[] 로 파싱. 실패 시 빈 배열. */
function parseRewriteQueries(text: string): string[] {
  if (!text) return [];
  try {
    const parsed = JSON.parse(text) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as { queries?: unknown }).queries)
    ) {
      const arr = (parsed as { queries: unknown[] }).queries;
      return arr
        .filter((q): q is string => typeof q === 'string')
        .map((q) => q.trim())
        .filter((q) => q.length > 0);
    }
  } catch {
    // ignore — fallthrough to []
  }
  return [];
}

/**
 * 여러 쿼리에서 회수한 SearchResult[] 를 chunkId 단위로 dedupe + 최고점 score 채택.
 * 정렬 후 상위 topK 만 반환.
 */
function mergeRagResults(
  perQueryResults: SearchResult[][],
  topK: number,
): SearchResult[] {
  const byChunk = new Map<string, SearchResult>();
  for (const list of perQueryResults) {
    for (const r of list) {
      const existing = byChunk.get(r.chunkId);
      if (!existing || r.score > existing.score) {
        byChunk.set(r.chunkId, r);
      }
    }
  }
  const merged = Array.from(byChunk.values());
  merged.sort((a, b) => b.score - a.score);
  return merged.slice(0, topK);
}
