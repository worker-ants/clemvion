import {
  NodeHandler,
  ExecutionContext,
  ValidationResult,
} from '../node-handler.interface';
import { LlmService } from '../../../llm/llm.service';

interface Category {
  name: string;
  description: string;
  examples?: string[];
}

export class TextClassifierHandler implements NodeHandler {
  constructor(private readonly llmService: LlmService) {}

  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const categories = config.categories as Category[] | undefined;
    if (!categories?.length) {
      errors.push('At least one category is required');
    } else {
      for (let i = 0; i < categories.length; i++) {
        if (!categories[i].name) {
          errors.push(`Category ${i + 1}: name is required`);
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
    const includeConfidence = (config.includeConfidence as boolean) ?? true;

    const workspaceId = (context.variables?.__workspaceId as string) || '';
    const llmConfig = await this.llmService.resolveConfig(
      llmConfigId,
      workspaceId,
    );

    // Build classification prompt
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

    const systemPrompt = `You are a text classifier. Classify the given text into exactly one of the following categories:

${categoryList}

${instructions ? `Additional instructions: ${instructions}\n` : ''}
Respond with a JSON object containing:
- "category": the name of the chosen category (must be exactly one of: ${categoryNames.map((n) => `"${n}"`).join(', ')})
${includeConfidence ? '- "confidence": a number between 0.0 and 1.0 indicating your confidence' : ''}

Respond ONLY with the JSON object, no additional text.`;

    const jsonSchema: Record<string, unknown> = {
      type: 'object',
      properties: {
        category: { type: 'string', enum: categoryNames },
        ...(includeConfidence ? { confidence: { type: 'number' } } : {}),
      },
      required: includeConfidence ? ['category', 'confidence'] : ['category'],
      additionalProperties: false,
    };

    const result = await this.llmService.chat(llmConfig, {
      model: model || llmConfig.defaultModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: inputField },
      ],
      responseFormat: 'json',
      jsonSchema,
    });

    let category = '';
    let confidence = 0;

    try {
      const parsed = JSON.parse(result.content || '{}');
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

    // Find matching port
    const portIndex = categories.findIndex((c) => c.name === category);
    const port = portIndex >= 0 ? `class_${portIndex}` : 'fallback';

    return {
      port,
      data: {
        category,
        confidence,
        originalInput: inputField,
        metadata: {
          model: result.model,
          inputTokens: result.usage?.inputTokens ?? 0,
          outputTokens: result.usage?.outputTokens ?? 0,
          totalTokens: result.usage?.totalTokens ?? 0,
        },
      },
    };
  }
}
