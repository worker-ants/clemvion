import {
  ExecutionContext,
  NodeHandler,
  ValidationResult,
} from '../node-handler.interface.js';

export class SendEmailHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    if (!isRecipientsLike(config.to)) {
      errors.push(
        'to is required and must be a non-empty string or array of email addresses',
      );
    }

    if (
      config.cc !== undefined &&
      config.cc !== null &&
      config.cc !== '' &&
      !isRecipientsLike(config.cc)
    ) {
      errors.push('cc must be a string or array of email addresses');
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
    const to = normalizeRecipients(config.to);
    const cc = normalizeRecipients(config.cc);
    const subject = config.subject as string;
    const bodyType = (config.bodyType as string) ?? 'text';

    return {
      to,
      cc,
      subject,
      bodyType,
      status: 'requires_integration',
    };
  }
}

/**
 * Accept either a non-empty string (literal or expression, possibly comma-
 * separated) or a non-empty array of strings. Expressions such as
 * `{{ $input.to }}` are validated as strings here and resolved before
 * `execute()` runs.
 */
function isRecipientsLike(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) {
    return (
      value.length > 0 &&
      value.every((v) => typeof v === 'string' && v.trim().length > 0)
    );
  }
  return false;
}

function normalizeRecipients(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((v): v is string => typeof v === 'string')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  }
  return [];
}
