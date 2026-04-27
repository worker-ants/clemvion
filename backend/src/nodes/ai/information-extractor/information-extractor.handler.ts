import {
  NodeHandler,
  NodeHandlerOutput,
  ExecutionContext,
  ValidationResult,
} from '../../core/node-handler.interface';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';
import { LlmService } from '../../../modules/llm/llm.service';
import {
  ChatMessage,
  ChatResult,
  ToolCall,
  ToolDef,
} from '../../../modules/llm/interfaces/llm-client.interface';
import { Logger } from '@nestjs/common';
import { informationExtractorNodeMetadata } from './information-extractor.schema';

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
  constructor(private readonly llmService: LlmService) {}

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

    const systemPrompt = this.buildSingleTurnSystemPrompt(
      outputSchema,
      instructions,
      examples,
    );
    const jsonSchema = this.buildJsonSchema(outputSchema, false);

    const startedAt = Date.now();
    const maxRetries = 2;
    let lastError: Error | undefined;
    let lastResponse: string | undefined;
    let lastModel: string | undefined;
    const llmCalls: LlmCallTrace[] = [];
    const totalAttempts = maxRetries + 1;
    const configEcho = {
      mode: 'single_turn' as const,
      model: model ?? llmConfig.defaultModel,
      schema: outputSchema,
      instructions,
      examples,
      inputField,
    };

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let call: { result: ChatResult; trace: LlmCallTrace };
      try {
        call = await this.traceChat(llmConfig, {
          model: model || llmConfig.defaultModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: inputField },
          ],
          responseFormat: 'json',
          jsonSchema,
        });
      } catch (error) {
        const errMessage =
          error instanceof Error ? error.message : String(error);
        return this.buildErrorOutput(configEcho, {
          code: 'LLM_CALL_FAILED',
          message: errMessage,
          details: {
            attempts: attempt + 1,
            originalInput: inputField,
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
  ): Promise<unknown> {
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
      maxCollectionRetries,
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
        collectionRetryCount: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalThinkingTokens: 0,
        turnDebugHistory: [],
      };
      return this.buildWaitingResponse(state, '');
    }

    const multiTurnStartedAt = Date.now();
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: inputField },
    ];

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
    | { kind: 'error'; error: string }
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
        const call = await this.traceChat(params.llmConfig, {
          model: params.model,
          messages: [...messages],
          tools: [finalizeTool],
          toolChoice: 'auto',
        });
        result = call.result;
        trace = call.trace;
      } catch (error) {
        return {
          kind: 'error',
          error: error instanceof Error ? error.message : String(error),
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

    const meta = defined({
      durationMs: opts.durationMs ?? 0,
      model: state.model,
      inputTokens: state.totalInputTokens,
      outputTokens: state.totalOutputTokens,
      totalTokens,
      thinkingTokens: state.totalThinkingTokens,
      collectionRetryCount: state.collectionRetryCount,
      turnDebug: state.turnDebugHistory,
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
  }): Record<string, unknown> {
    return defined({
      mode: 'multi_turn' as const,
      model: state.model,
      schema: state.outputSchema,
      instructions: state.instructions,
      examples: state.examples,
      maxTurns: state.maxTurns,
      maxCollectionRetries: state.maxCollectionRetries,
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
  ): unknown {
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
      type: 'ai_conversation',
      status: 'waiting_for_input',
      interactionType: 'ai_conversation',
      // Echo node config so the UI's Config tab renders during waiting state
      // (same shape as the completed `data.config`). Without this, the
      // frontend's `unwrapNodeOutput` treats a waiting payload as legacy and
      // shows "no config recorded".
      config: {
        schema: state.outputSchema,
        mode: 'multi_turn',
        maxCollectionRetries: state.maxCollectionRetries,
      },
      conversationConfig: {
        message: followUp,
        messages: state.messages,
        turnCount: state.turnCount,
        maxTurns: state.maxTurns,
        extracted,
        missingFields,
        collectionRetryCount: state.collectionRetryCount,
        maxCollectionRetries: state.maxCollectionRetries,
      },
      // CONVENTIONS §4.3 — runtime calculated fields mirrored at top level
      // so `$node["X"].output.messages` / `$node["X"].output.partial.*`
      // resolves via the adapter's legacy-bare branch. `conversationConfig`
      // above is retained for the live WS event and the in-flight frontend
      // ConversationInspector; both paths will converge once the frontend
      // migrates (tracked in memory/node-specs-improvement-progress.md).
      messages: state.messages,
      partial: {
        extracted,
        missingFields,
        collectionRetryCount: state.collectionRetryCount,
      },
      _resumeState: state,
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
   * in `_turnDebugHistory` for the frontend's LlmInformationTab. */
  private async traceChat(
    llmConfig: Parameters<LlmService['chat']>[0],
    params: Parameters<LlmService['chat']>[1],
  ): Promise<{ result: ChatResult; trace: LlmCallTrace }> {
    const startedAt = Date.now();
    const result = await this.llmService.chat(llmConfig, params);
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
