import {
  ExecutionContext,
  NodeHandler,
  ValidationResult,
} from '../node-handler.interface.js';

export class SlackHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    if (!config.action || typeof config.action !== 'string') {
      errors.push('action is required and must be a string');
    }

    return { valid: errors.length === 0, errors };
  }

  async execute(
    _input: unknown,
    config: Record<string, unknown>,
    _context: ExecutionContext,
  ): Promise<unknown> {
    const action = config.action as string;
    const channel = config.channel as string | undefined;
    const text = config.text as string | undefined;

    return {
      action,
      channel,
      text,
      status: 'requires_integration',
    };
  }
}
