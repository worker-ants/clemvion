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
    return { valid: errors.length === 0, errors };
  }

  async execute(
    input: unknown,
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

    // Resolve LLM config (from workspace context)
    // WorkspaceId is stored in execution context variables
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
    const toolNodeIds = (config.toolNodeIds as string[]) || [];
    const toolOverrides =
      (config.toolOverrides as Array<{
        nodeId: string;
        toolName: string;
        toolDescription: string;
      }>) || [];

    const tools = toolNodeIds.map((nodeId) => {
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
      // Add assistant message with tool calls
      messages.push({
        role: 'assistant',
        content: result.content || '',
        toolCalls: result.toolCalls,
      });

      // Execute tool calls (simplified - returns tool results)
      for (const tc of result.toolCalls) {
        toolCallCount++;
        // In a full implementation, this would execute the tool node
        // For now, we add a placeholder tool result
        messages.push({
          role: 'tool',
          content: JSON.stringify({
            result: `Tool ${tc.name} executed`,
            arguments: tc.arguments,
          }),
          toolCallId: tc.id,
        });
      }

      // Continue conversation
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
}
