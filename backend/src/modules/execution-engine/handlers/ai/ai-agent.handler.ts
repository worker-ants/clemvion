import {
  NodeHandler,
  ExecutionContext,
  ValidationResult,
} from '../node-handler.interface';
import { LlmService } from '../../../llm/llm.service';
import { RagSearchService } from '../../../knowledge-base/search/rag-search.service';
import { ChatMessage } from '../../../llm/interfaces/llm-client.interface';

export class AiAgentHandler implements NodeHandler {
  constructor(
    private readonly llmService: LlmService,
    private readonly ragSearchService: RagSearchService,
  ) {}

  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    if (!config.systemPrompt && !config.userPrompt) {
      errors.push('Either systemPrompt or userPrompt is required');
    }
    const mode = (config.mode as string) || 'single_turn';
    if (mode === 'multi_turn') {
      const maxTurns = config.maxTurns as number | undefined;
      if (maxTurns !== undefined && maxTurns < 0) {
        errors.push('maxTurns must be 0 (unlimited) or a positive integer');
      }
      const turnTimeout = config.turnTimeout as number | undefined;
      if (turnTimeout !== undefined && turnTimeout <= 0) {
        errors.push('turnTimeout must be a positive integer');
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

    const workspaceId = (context.variables?.__workspaceId as string) || '';
    const llmConfig = await this.llmService.resolveConfig(
      llmConfigId,
      workspaceId,
    );

    // Build system prompt with RAG context
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

    // Build messages
    const messages: ChatMessage[] = [];
    if (finalSystemPrompt) {
      messages.push({ role: 'system', content: finalSystemPrompt });
    }
    if (userPrompt) {
      messages.push({ role: 'user', content: userPrompt });
    }

    // Build tool definitions from tool area nodes
    const tools = this.buildTools(config);

    // LLM call with tool use loop
    let result = await this.llmService.chat(llmConfig, {
      model: model || llmConfig.defaultModel,
      messages,
      temperature,
      maxTokens,
      responseFormat,
      jsonSchema,
      tools: tools.length > 0 ? tools : undefined,
    });

    let toolCallCount = 0;
    while (result.toolCalls?.length && toolCallCount < maxToolCalls) {
      messages.push({
        role: 'assistant',
        content: result.content || '',
        toolCalls: result.toolCalls,
      });

      for (const tc of result.toolCalls) {
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

      result = await this.llmService.chat(llmConfig, {
        model: model || llmConfig.defaultModel,
        messages,
        temperature,
        maxTokens,
        responseFormat,
        jsonSchema,
        tools,
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

    return {
      response,
      metadata: {
        model: result.model,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        totalTokens: result.usage.totalTokens,
        toolCalls: toolCallCount,
        ragSources,
      },
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
    const turnTimeout = (config.turnTimeout as number) ?? 1800;

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

    // Build initial messages
    const messages: ChatMessage[] = [];
    if (finalSystemPrompt) {
      messages.push({ role: 'system', content: finalSystemPrompt });
    }
    if (userPrompt) {
      messages.push({ role: 'user', content: userPrompt });
    }

    const tools = this.buildTools(config);

    // First turn: call LLM
    let result = await this.llmService.chat(llmConfig, {
      model: model || llmConfig.defaultModel,
      messages,
      temperature,
      maxTokens,
      tools: tools.length > 0 ? tools : undefined,
    });

    // Handle tool calls in first turn
    let toolCallCount = 0;
    while (result.toolCalls?.length && toolCallCount < maxToolCalls) {
      messages.push({
        role: 'assistant',
        content: result.content || '',
        toolCalls: result.toolCalls,
      });

      for (const tc of result.toolCalls) {
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

      result = await this.llmService.chat(llmConfig, {
        model: model || llmConfig.defaultModel,
        messages,
        temperature,
        maxTokens,
        tools,
      });
    }

    // Add assistant response to messages
    messages.push({ role: 'assistant', content: result.content || '' });

    const totalInputTokens = result.usage.inputTokens;
    const totalOutputTokens = result.usage.outputTokens;

    // Return waiting_for_input to trigger blocking in execution engine
    return {
      type: 'ai_conversation',
      status: 'waiting_for_input',
      interactionType: 'ai_conversation',
      conversationConfig: {
        message: result.content || '',
        messages,
        turnCount: 1,
        maxTurns,
        turnTimeout,
      },
      // Internal state for continuation
      _multiTurnState: {
        llmConfigId,
        model: model || llmConfig.defaultModel,
        temperature,
        maxTokens,
        knowledgeBases,
        ragTopK,
        ragThreshold,
        maxToolCalls,
        maxTurns,
        turnTimeout,
        toolNodeIds: (config.toolNodeIds as string[]) || [],
        toolOverrides: (config.toolOverrides as unknown[]) || [],
        messages,
        turnCount: 1,
        totalInputTokens,
        totalOutputTokens,
        toolCalls: toolCallCount,
        ragSources,
        workspaceId,
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
    const turnTimeout = state.turnTimeout as number;
    const knowledgeBases = (state.knowledgeBases as string[]) || [];
    const ragTopK = (state.ragTopK as number) || 5;
    const ragThreshold = (state.ragThreshold as number) || 0.7;
    const workspaceId = (state.workspaceId as string) || '';
    let totalInputTokens = state.totalInputTokens as number;
    let totalOutputTokens = state.totalOutputTokens as number;
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

    // Call LLM
    let result = await this.llmService.chat(llmConfig, {
      model,
      messages,
      temperature,
      maxTokens,
      tools: tools.length > 0 ? tools : undefined,
    });

    // Handle tool calls
    while (result.toolCalls?.length && toolCallCount < maxToolCalls) {
      messages.push({
        role: 'assistant',
        content: result.content || '',
        toolCalls: result.toolCalls,
      });

      for (const tc of result.toolCalls) {
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

      result = await this.llmService.chat(llmConfig, {
        model,
        messages,
        temperature,
        maxTokens,
        tools,
      });
    }

    messages.push({ role: 'assistant', content: result.content || '' });

    totalInputTokens += result.usage.inputTokens;
    totalOutputTokens += result.usage.outputTokens;

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
          toolCalls: toolCallCount,
          ragSources,
        },
      );
    }

    // Continue conversation: return waiting_for_input again
    return {
      type: 'ai_conversation',
      status: 'waiting_for_input',
      interactionType: 'ai_conversation',
      conversationConfig: {
        message: result.content || '',
        messages,
        turnCount,
        maxTurns,
        turnTimeout,
      },
      _multiTurnState: {
        ...state,
        messages,
        turnCount,
        totalInputTokens,
        totalOutputTokens,
        toolCalls: toolCallCount,
        ragSources,
      },
    };
  }

  /**
   * Build the final output when multi-turn conversation ends.
   */
  buildMultiTurnFinalOutput(
    messages: ChatMessage[],
    lastResponse: string,
    turnCount: number,
    endReason: 'user_ended' | 'max_turns' | 'timeout',
    metadata: {
      model: string;
      totalInputTokens: number;
      totalOutputTokens: number;
      toolCalls: number;
      ragSources: unknown[];
    },
  ): unknown {
    return {
      response: lastResponse,
      messages,
      turnCount,
      endReason,
      metadata: {
        model: metadata.model,
        totalInputTokens: metadata.totalInputTokens,
        totalOutputTokens: metadata.totalOutputTokens,
        totalTokens: metadata.totalInputTokens + metadata.totalOutputTokens,
        toolCalls: metadata.toolCalls,
        ragSources: metadata.ragSources,
      },
    };
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

    return toolNodeIds.map((nodeId) => {
      const override = toolOverrides.find((o) => o.nodeId === nodeId);
      return {
        name: override?.toolName || `tool_${nodeId.substring(0, 8)}`,
        description: override?.toolDescription || `Execute node ${nodeId}`,
        parameters: {
          type: 'object' as const,
          properties: {
            input: { type: 'string', description: 'Input for the tool' },
          },
        },
      };
    });
  }
}
