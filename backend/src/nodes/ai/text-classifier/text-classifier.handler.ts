import {
  NodeHandler,
  ExecutionContext,
  ValidationResult,
} from '../../core/node-handler.interface';
import { LlmService } from '../../../modules/llm/llm.service';
import { ChatResult } from '../../../modules/llm/interfaces/llm-client.interface';

interface Category {
  name: string;
  description: string;
  examples?: string[];
}

export class TextClassifierHandler implements NodeHandler {
  constructor(private readonly llmService: LlmService) {}

  static readonly NONE_SENTINEL = '__none__';

  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const categories = config.categories as Category[] | undefined;
    if (!categories?.length) {
      errors.push('At least one category is required');
    } else {
      for (let i = 0; i < categories.length; i++) {
        if (!categories[i].name) {
          errors.push(`Category ${i + 1}: name is required`);
        } else if (categories[i].name === TextClassifierHandler.NONE_SENTINEL) {
          errors.push(
            `Category ${i + 1}: "${TextClassifierHandler.NONE_SENTINEL}" is a reserved name`,
          );
        }
      }
    }
    if (!config.inputField) {
      errors.push('inputField is required');
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
    const inputField = config.inputField as string;
    const categories = config.categories as Category[];
    const instructions = (config.instructions as string) || '';
    const includeConfidence = (config.includeConfidence as boolean) ?? false;
    const multiLabel = (config.multiLabel as boolean) ?? false;

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
        )
      : this.buildSingleLabelPrompt(
          categoryList,
          categoryNames,
          instructions,
          includeConfidence,
        );

    let result: ChatResult;
    const requestPayload = {
      model: model || llmConfig.defaultModel,
      messages: [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: inputField },
      ],
      responseFormat: 'json' as const,
      jsonSchema,
    };
    const callStartedAt = Date.now();
    try {
      result = await this.llmService.chat(llmConfig, requestPayload);
    } catch (error) {
      return {
        config: { categories, inputField, multiLabel },
        output: {
          error: error instanceof Error ? error.message : String(error),
          originalInput: inputField,
          _llmCalls: [
            {
              requestPayload,
              responsePayload: null,
              durationMs: Date.now() - callStartedAt,
            },
          ],
        },
        meta: {},
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

    if (multiLabel) {
      return this.processMultiLabelResult(
        result,
        categories,
        inputField,
        includeConfidence,
        llmCalls,
      );
    }
    return this.processSingleLabelResult(
      result,
      categories,
      inputField,
      includeConfidence,
      llmCalls,
    );
  }

  private buildSingleLabelPrompt(
    categoryList: string,
    categoryNames: string[],
    instructions: string,
    includeConfidence: boolean,
  ) {
    const NONE = TextClassifierHandler.NONE_SENTINEL;
    const schemaEnum = [...categoryNames, NONE];

    const systemPrompt = `You are a text classifier. Classify the given text into exactly one of the following categories:

${categoryList}

${instructions ? `Additional instructions: ${instructions}\n` : ''}
If the text does not clearly fit any of the above categories, use "${NONE}" as the category.

Respond with a JSON object containing:
- "category": the name of the chosen category (must be exactly one of: ${categoryNames.map((n) => `"${n}"`).join(', ')}) or "${NONE}" if no category fits
${includeConfidence ? '- "confidence": a number between 0.0 and 1.0 indicating your confidence' : ''}

Respond ONLY with the JSON object, no additional text.`;

    const jsonSchema: Record<string, unknown> = {
      type: 'object',
      properties: {
        category: { type: 'string', enum: schemaEnum },
        ...(includeConfidence ? { confidence: { type: 'number' } } : {}),
      },
      required: includeConfidence ? ['category', 'confidence'] : ['category'],
      additionalProperties: false,
    };

    return { systemPrompt, jsonSchema };
  }

  private buildMultiLabelPrompt(
    categoryList: string,
    categoryNames: string[],
    instructions: string,
    includeConfidence: boolean,
  ) {
    const systemPrompt = `You are a text classifier. Classify the given text into ALL applicable categories from the following list:

${categoryList}

${instructions ? `Additional instructions: ${instructions}\n` : ''}
Select every category that applies to the text. If no category fits, return an empty array.

Respond with a JSON object containing:
- "categories": an array of matching categories. Each element is an object with:
  - "name": the category name (must be one of: ${categoryNames.map((n) => `"${n}"`).join(', ')})
${includeConfidence ? '  - "confidence": a number between 0.0 and 1.0 indicating your confidence' : ''}

Respond ONLY with the JSON object, no additional text.`;

    const itemProperties: Record<string, unknown> = {
      name: { type: 'string', enum: categoryNames },
    };
    if (includeConfidence) {
      itemProperties.confidence = { type: 'number' };
    }

    const jsonSchema: Record<string, unknown> = {
      type: 'object',
      properties: {
        categories: {
          type: 'array',
          items: {
            type: 'object',
            properties: itemProperties,
            required: includeConfidence ? ['name', 'confidence'] : ['name'],
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
    llmCalls: Array<{
      requestPayload: unknown;
      responsePayload: unknown;
      durationMs: number;
    }>,
  ) {
    const NONE = TextClassifierHandler.NONE_SENTINEL;
    let category = '';
    let confidence = 0;

    try {
      const parsed = JSON.parse(result.content || '{}') as {
        category?: string;
        confidence?: number;
      };
      category = parsed.category || '';
      confidence = parsed.confidence ?? 0;
    } catch {
      // Fallback: try to extract category name from text
      for (const c of categories) {
        if (result.content?.includes(c.name)) {
          category = c.name;
          break;
        }
      }
    }

    const isFallback = !category || category === NONE;
    const portIndex = isFallback
      ? -1
      : categories.findIndex((c) => c.name === category);
    const port = portIndex >= 0 ? `class_${portIndex}` : 'fallback';

    return {
      config: { categories, inputField, multiLabel: false },
      output: {
        category: isFallback ? null : category,
        ...(includeConfidence ? { confidence } : {}),
        originalInput: inputField,
        _llmCalls: llmCalls,
      },
      meta: {
        model: result.model,
        inputTokens: result.usage?.inputTokens ?? 0,
        outputTokens: result.usage?.outputTokens ?? 0,
        totalTokens: result.usage?.totalTokens ?? 0,
        thinkingTokens: result.usage?.thinkingTokens,
      },
      port,
    };
  }

  private processMultiLabelResult(
    result: ChatResult,
    categories: Category[],
    inputField: string,
    includeConfidence: boolean,
    llmCalls: Array<{
      requestPayload: unknown;
      responsePayload: unknown;
      durationMs: number;
    }>,
  ) {
    let matchedCategories: { name: string; confidence?: number }[] = [];

    try {
      const parsed = JSON.parse(result.content || '{}') as {
        categories?: { name?: string; confidence?: number }[];
      };
      const rawCategories = Array.isArray(parsed.categories)
        ? parsed.categories
        : [];
      matchedCategories = rawCategories
        .filter((c) => c.name && categories.some((cat) => cat.name === c.name))
        .map((c) => ({
          name: c.name!,
          ...(includeConfidence ? { confidence: c.confidence ?? 0 } : {}),
        }));
    } catch {
      // Fallback: try to extract category names from text
      for (const c of categories) {
        if (result.content?.includes(c.name)) {
          matchedCategories.push({
            name: c.name,
            ...(includeConfidence ? { confidence: 0 } : {}),
          });
        }
      }
    }

    const matchedPorts = matchedCategories
      .map((mc) => categories.findIndex((c) => c.name === mc.name))
      .filter((i) => i >= 0)
      .map((i) => `class_${i}`);

    const port: string | string[] =
      matchedPorts.length > 0 ? matchedPorts : 'fallback';

    return {
      config: { categories, inputField, multiLabel: true },
      output: {
        categories: matchedCategories,
        originalInput: inputField,
        _llmCalls: llmCalls,
      },
      meta: {
        model: result.model,
        inputTokens: result.usage?.inputTokens ?? 0,
        outputTokens: result.usage?.outputTokens ?? 0,
        totalTokens: result.usage?.totalTokens ?? 0,
        thinkingTokens: result.usage?.thinkingTokens,
      },
      port,
    };
  }
}
