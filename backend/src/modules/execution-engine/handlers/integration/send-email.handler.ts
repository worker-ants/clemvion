import {
  ExecutionContext,
  NodeHandler,
  ValidationResult,
} from '../node-handler.interface.js';

export class SendEmailHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    if (!config.to || !Array.isArray(config.to) || config.to.length === 0) {
      errors.push(
        'to is required and must be a non-empty array of email addresses',
      );
    }

    if (!config.subject || typeof config.subject !== 'string') {
      errors.push('subject is required and must be a string');
    }

    if (!config.body || typeof config.body !== 'string') {
      errors.push('body is required and must be a string');
    }

    if (
      config.bodyType !== undefined &&
      !['text', 'html'].includes(config.bodyType as string)
    ) {
      errors.push('bodyType must be either "text" or "html"');
    }

    return { valid: errors.length === 0, errors };
  }

  async execute(
    _input: unknown,
    config: Record<string, unknown>,
    _context: ExecutionContext,
  ): Promise<unknown> {
    const to = config.to as string[];
    const subject = config.subject as string;
    const bodyType = (config.bodyType as string) ?? 'text';

    return {
      to,
      subject,
      bodyType,
      status: 'requires_integration',
    };
  }
}
