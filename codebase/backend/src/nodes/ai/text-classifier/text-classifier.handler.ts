import {
  NodeHandler,
  NodeHandlerOutput,
  ExecutionContext,
  ValidationResult,
} from '../../core/node-handler.interface';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';
import { resolveStablePortId } from '../../core/port-id.util';
import {
  LlmService,
  extractRetryAfterMs,
  isLlmRateLimit,
} from '../../../modules/llm/llm.service';
import { ChatResult } from '../../../modules/llm/interfaces/llm-client.interface';
import { truncateForErrorDetails } from '../../core/error-codes';
import { textClassifierNodeMetadata } from './text-classifier.schema';
import { buildSystemContextPrefixFromContext } from '../shared/system-context-prefix';
import { pickNonDefaultSystemContext } from '../shared/system-context-schema';
import { injectConversationContext } from '../shared/conversation-context-injection';
import type { ChatMessage } from '../../../modules/llm/interfaces/llm-client.interface';
import type { ThreadHolder } from '../../../modules/execution-engine/conversation-thread/conversation-thread.service';

interface Category {
  id?: string;
  name: string;
  description: string;
  examples?: string[];
}

/**
 * Applies `resolveStablePortId` to each category so handler routing uses the
 * exact same id the workflow-assistant resolver publishes. `class_${i}`
 * fallback covers legacy workflows whose categories had no id and inputs that
 * fail the slug regex (defense-in-depth — schema bypass paths).
 */
function buildCategoryPortIds(categories: Category[]): string[] {
  return categories.map((c, i) => resolveStablePortId(c.id, `class_${i}`));
}

export class TextClassifierHandler implements NodeHandler {
  metadata = textClassifierNodeMetadata;

  constructor(
    private readonly llmService: LlmService,
    /**
     * Optional. When provided, the handler pushes the final assistant turn
     * (single-label: category name; multi-label: matched category names
     * comma-joined) into the workflow ConversationThread per
     * spec/conventions/conversation-thread.md §1.4 + §2.3 v2 — so a
     * downstream AI Agent with `contextScope` can read the classifier's
     * decision. Test fixtures may omit this; the helper degrades to no-op.
     */
    private readonly conversationThreadService?: import('../../../modules/execution-engine/conversation-thread/conversation-thread.service').ConversationThreadService,
  ) {}

  /**
   * Push the classifier's final result as an `ai_assistant` turn (spec §1.4
   * — single-label: `category` value, multi-label:
   * `categories.map(c => c.name).join(', ')`). No-op when the service is
   * absent (legacy test path) or when the node opts out via
   * `excludeFromConversationThread`.
   */
  private pushClassifierTurn(
    context: ExecutionContext,
    config: Record<string, unknown>,
    text: string,
  ): void {
    if (!this.conversationThreadService) return;
    const id = context.nodeId ?? '';
    this.conversationThreadService.appendAiAssistantMessage(context, {
      node: {
        id,
        label: id,
        type: 'text_classifier',
        config: context.rawConfig ?? config,
      },
      content: text,
    });
  }

  static readonly NONE_SENTINEL = '__none__';

  validate(config: Record<string, unknown>): ValidationResult {
    // Schema SSOT (warningRules + validateConfig) covers no-llm-provider,
    // no-categories, no-input-field, per-category name + reserved-name
    // collision.
    const errors = evaluateMetadataBlockingErrors(this.metadata, config);
    return { valid: errors.length === 0, errors };
  }

  async execute(
    input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<NodeHandlerOutput> {
    // CONVENTIONS Principle 2 — meta.durationMs 는 핸들러 책임. execute()
    // 진입 직후 stamp 하여 resolveConfig·프롬프트 빌드까지 포함한 전체 소요
    // 시간을 측정 (성공/에러/fallback 모든 경로 동일 기준).
    const executeStartedAt = Date.now();
    const llmConfigId = config.llmConfigId as string | undefined;
    const model = config.model as string | undefined;
    const inputField = config.inputField as string;
    const categories = config.categories as Category[];
    const instructions = (config.instructions as string) || '';
    const includeConfidence = (config.includeConfidence as boolean) ?? false;
    const includeEvidence = (config.includeEvidence as boolean) ?? false;
    const multiLabel = (config.multiLabel as boolean) ?? false;

    // CONVENTIONS Principle 7 — config echoes raw inputField (`{{ ... }}`
    // template preserved) and raw categories. Engine resolves expressions
    // before dispatch so the local variables above hold evaluated values
    // for runtime use.
    const rawConfig = context.rawConfig ?? config;
    const configEcho = {
      categories: (rawConfig.categories as Category[]) ?? categories,
      inputField: rawConfig.inputField ?? inputField,
      multiLabel: rawConfig.multiLabel ?? multiLabel,
      ...(rawConfig.llmConfigId !== undefined
        ? { llmConfigId: rawConfig.llmConfigId }
        : {}),
      ...(rawConfig.model !== undefined ? { model: rawConfig.model } : {}),
      ...(rawConfig.instructions !== undefined
        ? { instructions: rawConfig.instructions }
        : {}),
      // spec §11.7 — default 일치 시 생략, 명시 변경 시 echo.
      ...pickNonDefaultSystemContext(rawConfig),
    };

    const workspaceId = (context.variables?.__workspaceId as string) || '';
    const llmConfig = await this.llmService.resolveConfig(
      llmConfigId,
      workspaceId,
    );

    const categoryList = categories
      .map((c, i) => {
        let desc = `${i + 1}. "${c.name}"`;
        if (c.description) desc += `: ${c.description}`;
        if (c.examples?.length)
          desc += `\n   Examples: ${c.examples.join(', ')}`;
        return desc;
      })
      .join('\n');

    const categoryNames = categories.map((c) => c.name);

    const { systemPrompt, jsonSchema } = multiLabel
      ? this.buildMultiLabelPrompt(
          categoryList,
          categoryNames,
          instructions,
          includeConfidence,
          includeEvidence,
        )
      : this.buildSingleLabelPrompt(
          categoryList,
          categoryNames,
          instructions,
          includeConfidence,
          includeEvidence,
        );

    // System Context Prefix — spec/4-nodes/3-ai/0-common.md §11.4 ordering [1].
    const systemContextPrefix = buildSystemContextPrefixFromContext({
      context,
      config,
      now: new Date(),
    });
    const finalSystemPrompt = systemContextPrefix + systemPrompt;

    // Conversation Context 자동 주입 (spec/4-nodes/3-ai/0-common.md §10) —
    // `contextScope ≠ none` 이면 ConversationThread (자기 노드 turn 제외) 를
    // LLM 호출 직전 messages/systemPrompt 에 주입한다. 공유 유틸 (3 노드 공통).
    // service 미주입(legacy 테스트) / scope=none(default) 면 noop — 기존 동작 불변.
    const baseMessages: ChatMessage[] = [
      { role: 'system', content: finalSystemPrompt },
      { role: 'user', content: inputField },
    ];
    const injected = injectConversationContext<ThreadHolder>({
      reader: this.conversationThreadService,
      target: context,
      selfNodeId: context.nodeId ?? '',
      config,
      messages: baseMessages,
      finalSystemPrompt,
    });

    // system_text 모드에서도 injected.finalSystemPrompt 는 별도로 쓰지 않는다 —
    // injectConversationContext 가 messages[0](system) 의 content 를 이미 동일하게
    // 갱신하므로 injected.messages 만 LLM 으로 넘기면 충분 (두 표면 동기화됨).
    let result: ChatResult;
    const requestPayload = {
      model: model || llmConfig.defaultModel,
      messages: injected.messages,
      responseFormat: 'json' as const,
      jsonSchema,
    };
    const callStartedAt = Date.now();
    try {
      result = await this.llmService.chat(
        llmConfig,
        requestPayload,
        undefined,
        {
          signal: context.abortSignal,
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // CONVENTIONS §7 — truncate originalInput in the error envelope so long
      // user prompts / PII don't land full-length in `output.error.details`.
      // D6 (2026-05-17) — 정상 (`output.result.originalInput`) / 에러
      // (`output.error.details.originalInput`) 모두 단일 경로로 통일.
      // 종전 top-level `output.originalInput` (full) 은 폐기 — error 시
      // truncated 버전 (500 char cap) 만 surface 한다.
      const truncatedInput = truncateForErrorDetails(inputField, 500);
      // CONVENTIONS Principle 2 — meta carries execution metrics in every
      // case (success / fallback / error). Token fields are 0-defaulted on
      // error so `$node[X].meta.{inputTokens,outputTokens,totalTokens}`
      // expressions stay numeric and don't fall through to `undefined` in
      // downstream arithmetic. `meta.durationMs` is the per-call duration
      // from `callStartedAt` (LLM throw boundary); `llmCalls[0].durationMs`
      // currently equals it (single attempt) but the two are separate
      // semantic axes — `meta.durationMs` may diverge once retry/timeout
      // logic lands.
      const llmCallDurationMs = Date.now() - callStartedAt;
      // spec §5.3/§6 + CONVENTIONS Principle 3.2.1 — classify the throw and
      // expose `details.retryable` (and `retryAfterSec` when the provider
      // signalled a `Retry-After`). Rate-limit detection mirrors
      // `LlmService.chatWithRetry` (429 / "rate limit" substring). Both
      // LLM_RATE_LIMIT and LLM_CALL_FAILED are transient → retryable.
      const isRateLimit = isLlmRateLimit(message);
      const code = isRateLimit ? 'LLM_RATE_LIMIT' : 'LLM_CALL_FAILED';
      const retryAfterMs = isRateLimit ? extractRetryAfterMs(error) : null;
      const retryDetails: { retryable: boolean; retryAfterSec?: number } =
        retryAfterMs !== null
          ? { retryable: true, retryAfterSec: Math.ceil(retryAfterMs / 1000) }
          : { retryable: true };
      return {
        config: configEcho,
        output: {
          error: {
            code,
            message,
            details: { originalInput: truncatedInput, ...retryDetails },
          },
        },
        meta: {
          durationMs: Date.now() - executeStartedAt,
          model: requestPayload.model,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          llmCalls: [
            {
              requestPayload,
              responsePayload: null,
              durationMs: llmCallDurationMs,
            },
          ],
        },
        port: 'error',
      };
    }

    const llmCalls = [
      {
        requestPayload,
        responsePayload: result,
        durationMs: Date.now() - callStartedAt,
      },
    ];
    // Compute success-path durationMs at the same boundary (just after the
    // LLM call returned, before result post-processing) so its semantics
    // match the error path — both fields equal "time until LLM call
    // resolved" plus the small fixed pre-LLM setup cost.
    const successDurationMs = Date.now() - executeStartedAt;

    if (multiLabel) {
      const out = this.processMultiLabelResult(
        result,
        categories,
        inputField,
        includeConfidence,
        includeEvidence,
        llmCalls,
        configEcho,
        successDurationMs,
      );
      // ConversationThread push (spec §1.4 v2 — multi-label).
      const labels = (out.output?.result?.categories ?? [])
        .map((c) => c.name)
        .filter((n): n is string => typeof n === 'string')
        .join(', ');
      this.pushClassifierTurn(context, config, labels);
      // ConversationThread injection debug echo (conversation-thread.md §5.3 —
      // 세 노드 공통). Echo only when injection actually happened so noop runs
      // keep the meta lean (ai_agent 와 동일 형태).
      return injected.injection.appliedScope !== 'none'
        ? {
            ...out,
            meta: { ...out.meta, contextInjection: injected.injection },
          }
        : out;
    }
    const out = this.processSingleLabelResult(
      result,
      categories,
      inputField,
      includeConfidence,
      includeEvidence,
      llmCalls,
      configEcho,
      successDurationMs,
    );
    // ConversationThread push (spec §1.4 v2 — single-label).
    const single =
      typeof out.output?.result?.category === 'string'
        ? out.output.result.category
        : '';
    this.pushClassifierTurn(context, config, single);
    // ConversationThread injection debug echo (conversation-thread.md §5.3 —
    // 세 노드 공통). Echo only when injection actually happened so noop runs
    // keep the meta lean (ai_agent 와 동일 형태).
    return injected.injection.appliedScope !== 'none'
      ? { ...out, meta: { ...out.meta, contextInjection: injected.injection } }
      : out;
  }

  private buildSingleLabelPrompt(
    categoryList: string,
    categoryNames: string[],
    instructions: string,
    includeConfidence: boolean,
    includeEvidence: boolean,
  ) {
    const NONE = TextClassifierHandler.NONE_SENTINEL;
    const schemaEnum = [...categoryNames, NONE];

    const responseFields = [
      `- "category": the name of the chosen category (must be exactly one of: ${categoryNames.map((n) => `"${n}"`).join(', ')}) or "${NONE}" if no category fits`,
      includeConfidence
        ? '- "confidence": a number between 0.0 and 1.0 indicating your confidence'
        : '',
      includeEvidence
        ? '- "evidence": an array of short word or phrase excerpts from the input that directly support the chosen category. Use [] when the input does not fit any category.'
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    const systemPrompt = `You are a text classifier. Classify the given text into exactly one of the following categories:

${categoryList}

${instructions ? `Additional instructions: ${instructions}\n` : ''}
If the text does not clearly fit any of the above categories, use "${NONE}" as the category.

Respond with a JSON object containing:
${responseFields}

Respond ONLY with the JSON object, no additional text.`;

    const properties: Record<string, unknown> = {
      category: { type: 'string', enum: schemaEnum },
    };
    const required: string[] = ['category'];
    if (includeConfidence) {
      properties.confidence = { type: 'number' };
      required.push('confidence');
    }
    if (includeEvidence) {
      properties.evidence = { type: 'array', items: { type: 'string' } };
      required.push('evidence');
    }

    const jsonSchema: Record<string, unknown> = {
      type: 'object',
      properties,
      required,
      additionalProperties: false,
    };

    return { systemPrompt, jsonSchema };
  }

  private buildMultiLabelPrompt(
    categoryList: string,
    categoryNames: string[],
    instructions: string,
    includeConfidence: boolean,
    includeEvidence: boolean,
  ) {
    const itemFields = [
      `  - "name": the category name (must be one of: ${categoryNames.map((n) => `"${n}"`).join(', ')})`,
      includeConfidence
        ? '  - "confidence": a number between 0.0 and 1.0 indicating your confidence'
        : '',
      includeEvidence
        ? '  - "evidence": an array of short word or phrase excerpts from the input that directly support THIS category'
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    const systemPrompt = `You are a text classifier. Classify the given text into ALL applicable categories from the following list:

${categoryList}

${instructions ? `Additional instructions: ${instructions}\n` : ''}
Select every category that applies to the text. If no category fits, return an empty array.

Respond with a JSON object containing:
- "categories": an array of matching categories. Each element is an object with:
${itemFields}

Respond ONLY with the JSON object, no additional text.`;

    const itemProperties: Record<string, unknown> = {
      name: { type: 'string', enum: categoryNames },
    };
    const itemRequired: string[] = ['name'];
    if (includeConfidence) {
      itemProperties.confidence = { type: 'number' };
      itemRequired.push('confidence');
    }
    if (includeEvidence) {
      itemProperties.evidence = { type: 'array', items: { type: 'string' } };
      itemRequired.push('evidence');
    }

    const jsonSchema: Record<string, unknown> = {
      type: 'object',
      properties: {
        categories: {
          type: 'array',
          items: {
            type: 'object',
            properties: itemProperties,
            required: itemRequired,
            additionalProperties: false,
          },
        },
      },
      required: ['categories'],
      additionalProperties: false,
    };

    return { systemPrompt, jsonSchema };
  }

  private processSingleLabelResult(
    result: ChatResult,
    categories: Category[],
    inputField: string,
    includeConfidence: boolean,
    includeEvidence: boolean,
    llmCalls: Array<{
      requestPayload: unknown;
      responsePayload: unknown;
      durationMs: number;
    }>,
    configEcho: Record<string, unknown>,
    durationMs: number,
  ) {
    const NONE = TextClassifierHandler.NONE_SENTINEL;
    let category = '';
    let confidence = 0;
    let evidence: string[] = [];

    try {
      const parsed = JSON.parse(result.content || '{}') as {
        category?: string;
        confidence?: number;
        evidence?: unknown;
      };
      category = parsed.category || '';
      confidence = parsed.confidence ?? 0;
      if (includeEvidence) {
        evidence = sanitizeEvidence(parsed.evidence);
      }
    } catch {
      // Fallback: try to extract category name from text
      for (const c of categories) {
        if (result.content?.includes(c.name)) {
          category = c.name;
          break;
        }
      }
      evidence = [];
    }

    const isFallback = !category || category === NONE;
    const portIndex = isFallback
      ? -1
      : categories.findIndex((c) => c.name === category);
    const portIds = buildCategoryPortIds(categories);
    const port = portIndex >= 0 ? portIds[portIndex] : 'fallback';

    return {
      config: configEcho,
      output: {
        result: {
          category: isFallback ? null : category,
          ...(includeConfidence ? { confidence } : {}),
          ...(includeEvidence ? { evidence: isFallback ? [] : evidence } : {}),
          originalInput: inputField,
        },
      },
      meta: {
        durationMs,
        model: result.model,
        inputTokens: result.usage?.inputTokens ?? 0,
        outputTokens: result.usage?.outputTokens ?? 0,
        totalTokens: result.usage?.totalTokens ?? 0,
        thinkingTokens: result.usage?.thinkingTokens,
        llmCalls,
      },
      port,
    };
  }

  private processMultiLabelResult(
    result: ChatResult,
    categories: Category[],
    inputField: string,
    includeConfidence: boolean,
    includeEvidence: boolean,
    llmCalls: Array<{
      requestPayload: unknown;
      responsePayload: unknown;
      durationMs: number;
    }>,
    configEcho: Record<string, unknown>,
    durationMs: number,
  ) {
    let matchedCategories: {
      name: string;
      confidence?: number;
      evidence?: string[];
    }[] = [];

    try {
      const parsed = JSON.parse(result.content || '{}') as {
        categories?: {
          name?: string;
          confidence?: number;
          evidence?: unknown;
        }[];
      };
      const rawCategories = Array.isArray(parsed.categories)
        ? parsed.categories
        : [];
      matchedCategories = rawCategories
        .filter((c) => c.name && categories.some((cat) => cat.name === c.name))
        .map((c) => ({
          name: c.name!,
          ...(includeConfidence ? { confidence: c.confidence ?? 0 } : {}),
          ...(includeEvidence
            ? { evidence: sanitizeEvidence(c.evidence) }
            : {}),
        }));
    } catch {
      // Fallback: try to extract category names from text
      for (const c of categories) {
        if (result.content?.includes(c.name)) {
          matchedCategories.push({
            name: c.name,
            ...(includeConfidence ? { confidence: 0 } : {}),
            ...(includeEvidence ? { evidence: [] } : {}),
          });
        }
      }
    }

    const portIds = buildCategoryPortIds(categories);
    const matchedPorts = matchedCategories
      .map((mc) => categories.findIndex((c) => c.name === mc.name))
      .filter((i) => i >= 0)
      .map((i) => portIds[i]);

    const port: string | string[] =
      matchedPorts.length > 0 ? matchedPorts : 'fallback';

    return {
      config: configEcho,
      output: {
        result: {
          categories: matchedCategories,
          originalInput: inputField,
        },
      },
      meta: {
        durationMs,
        model: result.model,
        inputTokens: result.usage?.inputTokens ?? 0,
        outputTokens: result.usage?.outputTokens ?? 0,
        totalTokens: result.usage?.totalTokens ?? 0,
        thinkingTokens: result.usage?.thinkingTokens,
        llmCalls,
      },
      port,
    };
  }
}

// Caps a manipulated/runaway LLM response so a single classifier call cannot
// inflate the response payload, log line, or downstream node input without bound.
const MAX_EVIDENCE_ITEMS = 20;
const MAX_EVIDENCE_ITEM_LENGTH = 200;

function sanitizeEvidence(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const strings = value.filter((v): v is string => typeof v === 'string');
  return strings
    .slice(0, MAX_EVIDENCE_ITEMS)
    .map((s) =>
      s.length > MAX_EVIDENCE_ITEM_LENGTH
        ? s.slice(0, MAX_EVIDENCE_ITEM_LENGTH)
        : s,
    );
}
