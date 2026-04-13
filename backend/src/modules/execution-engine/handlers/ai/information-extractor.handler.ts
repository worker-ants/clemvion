import {
  NodeHandler,
  ExecutionContext,
  ValidationResult,
} from '../node-handler.interface';
import { LlmService } from '../../../llm/llm.service';
import { ChatMessage } from '../../../llm/interfaces/llm-client.interface';

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

type EndReason = 'completed' | 'max_turns' | 'user_ended' | 'timeout';

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
  turnTimeout: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  // Unused by this handler but kept so the engine can pass generic state fields
  toolCalls?: number;
  ragSources?: unknown[];
  lastTurnRequest?: unknown;
  lastTurnResponse?: unknown;
  lastTurnDurationMs?: number;
  turnDebugHistory?: unknown[];
}

export class InformationExtractorHandler implements NodeHandler {
  constructor(private readonly llmService: LlmService) {}

  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const schema = config.outputSchema as OutputField[] | undefined;
    if (!schema?.length) {
      errors.push('At least one output field is required');
    } else {
      for (let i = 0; i < schema.length; i++) {
        if (!schema[i].name) {
          errors.push(`Field ${i + 1}: name is required`);
        }
        if (!schema[i].type) {
          errors.push(`Field ${i + 1}: type is required`);
        }
      }
    }
    const mode = (config.mode as string) || 'single_turn';
    // inputField is only required in single_turn mode. In multi_turn the
    // user drives the first message from the UI, mirroring the AI Agent's
    // optional userPrompt behavior.
    if (mode !== 'multi_turn' && !config.inputField) {
      errors.push('inputField is required');
    }

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

  // ======================================================================
  // Single turn
  // ======================================================================

  private async executeSingleTurn(
    _input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<unknown> {
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

    const systemPrompt = this.buildSingleTurnSystemPrompt(
      outputSchema,
      instructions,
      examples,
    );
    const jsonSchema = this.buildJsonSchema(outputSchema, false);

    const maxRetries = 2;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const result = await this.llmService.chat(llmConfig, {
        model: model || llmConfig.defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: inputField },
        ],
        responseFormat: 'json',
        jsonSchema,
      });

      try {
        const extracted = JSON.parse(result.content || '{}') as Record<
          string,
          unknown
        >;

        return {
          config: { schema: outputSchema },
          output: { extracted },
          meta: {
            model: result.model,
            inputTokens: result.usage?.inputTokens ?? 0,
            outputTokens: result.usage?.outputTokens ?? 0,
            totalTokens: result.usage?.totalTokens ?? 0,
          },
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < maxRetries) {
          continue;
        }
      }
    }

    throw lastError || new Error('Failed to extract information');
  }

  // ======================================================================
  // Multi turn
  // ======================================================================

  private async executeMultiTurn(
    _input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<unknown> {
    const llmConfigId = config.llmConfigId as string | undefined;
    const model = config.model as string | undefined;
    const inputField = config.inputField as string;
    const outputSchema = config.outputSchema as OutputField[];
    const examples = (config.examples as Example[]) || [];
    const instructions = (config.instructions as string) || '';
    const maxTurns = (config.maxTurns as number) ?? 10;
    const turnTimeout = (config.turnTimeout as number) ?? 1800;

    const workspaceId = (context.variables?.__workspaceId as string) || '';
    const llmConfig = await this.llmService.resolveConfig(
      llmConfigId,
      workspaceId,
    );
    const resolvedModel = model || llmConfig.defaultModel;

    const systemPrompt = this.buildMultiTurnSystemPrompt(
      outputSchema,
      instructions,
      examples,
    );

    const stateBase = {
      llmConfigId,
      model: resolvedModel,
      workspaceId,
      outputSchema,
      instructions,
      examples,
      maxTurns,
      turnTimeout,
    };

    // No inputField: skip initial LLM call and wait for the user's first
    // message from the UI. Mirrors AiAgentHandler's empty-userPrompt path.
    if (!inputField) {
      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
      ];
      const state: MultiTurnState = {
        ...stateBase,
        messages,
        partialResult: {},
        turnCount: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
      };
      return this.buildWaitingResponse(state, '');
    }

    const jsonSchema = this.buildJsonSchema(outputSchema, true);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: inputField },
    ];

    const result = await this.llmService.chat(llmConfig, {
      model: resolvedModel,
      messages: [...messages],
      responseFormat: 'json',
      jsonSchema,
    });

    const parsed = this.safeParseJson(result.content);
    const partialResult = this.mergePartial({}, parsed, outputSchema);
    const followUp = (parsed._followUpQuestion as string) || '';

    messages.push({ role: 'assistant', content: result.content || '' });

    const totalInputTokens = result.usage?.inputTokens ?? 0;
    const totalOutputTokens = result.usage?.outputTokens ?? 0;
    const turnCount = 1;

    const state: MultiTurnState = {
      ...stateBase,
      messages,
      partialResult,
      turnCount,
      totalInputTokens,
      totalOutputTokens,
    };

    if (this.isComplete(partialResult, outputSchema)) {
      return this.buildMultiTurnFinalOutput(state, 'completed');
    }

    if (maxTurns > 0 && turnCount >= maxTurns) {
      return this.buildMultiTurnFinalOutput(state, 'max_turns');
    }

    return this.buildWaitingResponse(state, followUp);
  }

  async processMultiTurnMessage(
    userMessage: string,
    stateRaw: Record<string, unknown>,
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

    const jsonSchema = this.buildJsonSchema(state.outputSchema, true);
    const result = await this.llmService.chat(llmConfig, {
      model: state.model,
      messages: [...messages],
      responseFormat: 'json',
      jsonSchema,
    });

    const parsed = this.safeParseJson(result.content);
    const partialResult = this.mergePartial(
      state.partialResult,
      parsed,
      state.outputSchema,
    );
    const followUp = (parsed._followUpQuestion as string) || '';

    messages.push({ role: 'assistant', content: result.content || '' });

    const turnCount = state.turnCount + 1;
    const nextState: MultiTurnState = {
      ...state,
      messages,
      partialResult,
      turnCount,
      totalInputTokens:
        state.totalInputTokens + (result.usage?.inputTokens ?? 0),
      totalOutputTokens:
        state.totalOutputTokens + (result.usage?.outputTokens ?? 0),
    };

    if (this.isComplete(partialResult, state.outputSchema)) {
      return this.buildMultiTurnFinalOutput(nextState, 'completed');
    }

    if (state.maxTurns > 0 && turnCount >= state.maxTurns) {
      return this.buildMultiTurnFinalOutput(nextState, 'max_turns');
    }

    return this.buildWaitingResponse(nextState, followUp);
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
  ): unknown {
    const totalTokens = state.totalInputTokens + state.totalOutputTokens;

    // Always emit every schema field under `extracted` so downstream nodes
    // can reference `$node.output.extracted.<field>` unconditionally. Missing
    // values become `null` rather than disappearing.
    const extracted: Record<string, unknown> = {};
    for (const field of state.outputSchema) {
      const v = state.partialResult[field.name];
      extracted[field.name] = v === undefined ? null : v;
    }

    return {
      config: { schema: state.outputSchema, mode: 'multi_turn' },
      output: {
        extracted,
        messages: state.messages,
        endReason,
        turnCount: state.turnCount,
      },
      meta: {
        model: state.model,
        inputTokens: state.totalInputTokens,
        outputTokens: state.totalOutputTokens,
        totalTokens,
        interactionType: 'ai_conversation',
      },
    };
  }

  // ======================================================================
  // Helpers
  // ======================================================================

  private buildWaitingResponse(
    state: MultiTurnState,
    followUp: string,
  ): unknown {
    return {
      type: 'ai_conversation',
      status: 'waiting_for_input',
      interactionType: 'ai_conversation',
      conversationConfig: {
        message: followUp,
        messages: state.messages,
        turnCount: state.turnCount,
        maxTurns: state.maxTurns,
        turnTimeout: state.turnTimeout,
      },
      _multiTurnState: state,
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

    return `You are an information extraction expert engaged in a multi-turn conversation with a user. Extract structured data incrementally:

${schemaDesc}

${instructions ? `Additional instructions: ${instructions}\n` : ''}${examplesText}

For every response emit a single JSON object with these rules:
- Include every schema field. Use the extracted value when known, or null when still unknown in this turn.
- Include "_missingFields": an array of required field names that are still unknown after this turn (empty if everything required is filled).
- Include "_followUpQuestion": one short natural-language question asking the user for the most important missing required field. Leave it as an empty string when nothing is missing.
- Never invent information. Preserve previously extracted values by returning null for unchanged fields so the caller can merge safely.`;
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
      turnTimeout: (raw.turnTimeout as number) ?? 1800,
      totalInputTokens: (raw.totalInputTokens as number) || 0,
      totalOutputTokens: (raw.totalOutputTokens as number) || 0,
    };
  }
}
