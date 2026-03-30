import {
  ExecutionContext,
  NodeHandler,
  ValidationResult,
} from '../node-handler.interface.js';

export class PdfHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    if (!config.template || typeof config.template !== 'string') {
      errors.push('template is required and must be a string');
    }

    return { valid: errors.length === 0, errors };
  }

  async execute(
    _input: unknown,
    config: Record<string, unknown>,
    _context: ExecutionContext,
  ): Promise<unknown> {
    const template = config.template as string;
    const fileName = (config.fileName as string) ?? 'document.pdf';
    const pageSize = (config.pageSize as string) ?? 'A4';
    const orientation = (config.orientation as string) ?? 'portrait';

    return {
      type: 'pdf',
      status: 'requires_playwright',
      fileName,
      pageSize,
      orientation,
      template,
    };
  }
}
