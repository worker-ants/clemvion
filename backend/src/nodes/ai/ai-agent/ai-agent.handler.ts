import {
  NodeHandler,
  ExecutionContext,
  ValidationResult,
} from '../../core/node-handler.interface';
import { LlmService } from '../../../modules/llm/llm.service';
import { RagSearchService } from '../../../modules/knowledge-base/search/rag-search.service';
import { ChatMessage } from '../../../modules/llm/interfaces/llm-client.interface';

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
  constructor(
    private readonly llmService: LlmService,
    private readonly ragSearchService: RagSearchService,
  ) {}

  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const mode = (config.mode as string) || 'single_turn';
    if (mode === 'multi_turn') {
      // Multi Turn: systemPrompt is sufficient (userPrompt comes from UI)
      if (!config.systemPrompt) {
        errors.push('systemPrompt is required for multi_turn mode');
      }
    } else {
      if (!config.systemPrompt && !config.userPrompt) {
        errors.push('Either systemPrompt or userPrompt is required');
      }
    }
    if (mode === 'multi_turn') {
      const maxTurns = config.maxTurns as number | undefined;
      if (maxTurns !== undefined && maxTurns < 0) {
        errors.push('maxTurns must be 0 (unlimited) or a positive integer');
      }
    }

    // Validate conditions
    const conditions = config.conditions as ConditionDef[] | undefined;
    if (Array.isArray(conditions)) {
      if (conditions.length > 20) {
        errors.push('conditions: maximum 20 conditions allowed');
      }
      const reservedPortIds = new Set([
        'out',
        'in',
        'error',
        'user_ended',
        'max_turns',
      ]);
      for (let i = 0; i < conditions.length; i++) {
        const c = conditions[i];
        if (!c.id) {
          errors.push(`conditions[${i}]: id is required`);
        } else if (reservedPortIds.has(c.id)) {
          errors.push(
            `conditions[${i}]: id '${c.id}' conflicts with reserved port name`,
          );
        }
        if (!c.label) {
          errors.push(`conditions[${i}]: label is required`);
        }
        if (!c.prompt) {
          errors.push(`conditions[${i}]: prompt is required`);
        } else if (c.prompt.length > 2000) {
          errors.push(
            `conditions[${i}]: prompt must be 2000 characters or less`,
          );
        }
      }
    }

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
      const searchResults = await this.ragSearchService.search(
        userPrompt,
        knowledgeBases,
        workspaceId,
        { topK: ragTopK, threshold: ragThreshold },
      );

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
      const searchResults = await this.ragSearchService.search(
        userPrompt,
        knowledgeBases,
        workspaceId,
        { topK: ragTopK, threshold: ragThreshold },
      );

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
    const workspaceId = (state.workspaceId as string) || '';
    const conditions = (state.conditions as ConditionDef[]) || [];
    let totalInputTokens = state.totalInputTokens as number;
    let totalOutputTokens = state.totalOutputTokens as number;
    let totalThinkingTokens = (state.totalThinkingTokens as number) ?? 0;
    let toolCallCount = state.toolCalls as number;
    let ragSources = state.ragSources as unknown[];

    // Add user message
    messages.push({ role: 'user', content: userMessage });

    // RAG search on new user message
    if (knowledgeBases.length > 0 && userMessage) {
      const searchResults = await this.ragSearchService.search(
        userMessage,
        knowledgeBases,
        workspaceId,
        { topK: ragTopK, threshold: ragThreshold },
      );

      if (searchResults.length > 0) {
        const ragContext = this.ragSearchService.buildContext(searchResults);
        // Inject RAG context as a system message for this turn
        messages.push({ role: 'system', content: ragContext.context });
        ragSources = [...ragSources, ...ragContext.sources];
      }
    }

    const llmConfigId = state.llmConfigId as string | undefined;
    const llmConfig = await this.llmService.resolveConfig(
      llmConfigId,
      workspaceId,
    );
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
}
