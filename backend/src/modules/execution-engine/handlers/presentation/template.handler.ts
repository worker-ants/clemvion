import {
  ExecutionContext,
  NodeHandler,
  ValidationResult,
} from '../node-handler.interface.js';

export class TemplateHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    if (!config.template || typeof config.template !== 'string') {
      errors.push('template is required and must be a string');
    }

    if (
      config.outputFormat !== undefined &&
      !['html', 'markdown', 'text'].includes(config.outputFormat as string)
    ) {
      errors.push('outputFormat must be one of: html, markdown, text');
    }

    return { valid: errors.length === 0, errors };
  }

  async execute(
    input: unknown,
    config: Record<string, unknown>,
    _context: ExecutionContext,
  ): Promise<unknown> {
    const template = config.template as string;
    const outputFormat = (config.outputFormat as string) ?? 'text';

    const data =
      typeof input === 'object' && input !== null
        ? (input as Record<string, unknown>)
        : {};

    const content = this.renderTemplate(template, data);

    return { type: 'template', format: outputFormat, content };
  }

  private renderTemplate(
    template: string,
    data: Record<string, unknown>,
  ): string {
    return template.replace(
      /\{\{(\s*[\w.]+\s*)\}\}/g,
      (_match, key: string) => {
        const trimmedKey = key.trim();
        const value = this.resolveNestedValue(data, trimmedKey);
        return value !== undefined ? String(value) : '';
      },
    );
  }

  private resolveNestedValue(
    data: Record<string, unknown>,
    path: string,
  ): unknown {
    const parts = path.split('.');
    let current: unknown = data;

    for (const part of parts) {
      if (
        current === null ||
        current === undefined ||
        typeof current !== 'object'
      ) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }
}
