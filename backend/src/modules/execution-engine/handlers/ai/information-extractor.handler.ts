import {
  NodeHandler,
  ExecutionContext,
  ValidationResult,
} from '../node-handler.interface';
import { LlmService } from '../../../llm/llm.service';

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
    const outputSchema = config.outputSchema as OutputField[];
    const examples = (config.examples as Example[]) || [];
    const instructions = (config.instructions as string) || '';

    const workspaceId = (context.variables?.__workspaceId as string) || '';
    const llmConfig = await this.llmService.resolveConfig(
      llmConfigId,
      workspaceId,
    );

    // Build JSON schema description
    const schemaDesc = outputSchema
      .map((f) => {
        let desc = `- "${f.name}" (${f.type}${f.required !== false ? ', required' : ', optional'}): ${f.description || 'no description'}`;
        if (f.enumValues?.length) {
          desc += ` [allowed values: ${f.enumValues.join(', ')}]`;
        }
        return desc;
      })
      .join('\n');

    // Build few-shot examples
    let examplesText = '';
    if (examples.length > 0) {
      examplesText =
        '\n\nExamples:\n' +
        examples
          .map(
            (ex, i) =>
              `Example ${i + 1}:\nInput: ${ex.input}\nOutput: ${JSON.stringify(ex.output)}`,
          )
          .join('\n\n');
    }

    const systemPrompt = `You are an information extraction expert. Extract structured data from the given text according to the following schema:

${schemaDesc}

${instructions ? `Additional instructions: ${instructions}\n` : ''}${examplesText}

Respond ONLY with a JSON object containing the extracted fields. Use null for fields that cannot be extracted.`;

    // Build JSON schema for structured output
    const jsonSchemaProperties: Record<string, unknown> = {};
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
      jsonSchemaProperties[field.name] = prop;
    }

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
        jsonSchema: {
          type: 'object',
          properties: jsonSchemaProperties,
          required: outputSchema
            .filter((f) => f.required !== false)
            .map((f) => f.name),
          additionalProperties: false,
        },
      });

      try {
        const extracted = JSON.parse(result.content || '{}');

        return {
          extracted,
          metadata: {
            model: result.model,
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
            totalTokens: result.usage.totalTokens,
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
}
