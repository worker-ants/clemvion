import { NodeHandler, ValidationResult } from '../node-handler.interface.js';

export class PdfHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    if (!config.template || typeof config.template !== 'string') {
      errors.push('template is required and must be a string');
    }

    return { valid: errors.length === 0, errors };
  }

  execute(...[, config]: Parameters<NodeHandler['execute']>): Promise<unknown> {
    const template = config.template as string;
    const fileName = (config.fileName as string) ?? 'document.pdf';
    const pageSize = (config.pageSize as string) ?? 'A4';
    const orientation = (config.orientation as string) ?? 'portrait';

    return Promise.resolve({
      config: { fileName, pageSize, orientation },
      output: { type: 'pdf', fileName, pageSize, orientation, template },
      status: 'requires_playwright',
    });
  }
}
