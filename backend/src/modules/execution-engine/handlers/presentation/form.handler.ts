import {
  ExecutionContext,
  NodeHandler,
  ValidationResult,
} from '../node-handler.interface.js';

export class FormHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    if (
      !config.fields ||
      !Array.isArray(config.fields) ||
      config.fields.length === 0
    ) {
      errors.push('fields is required and must be a non-empty array');
    }

    return { valid: errors.length === 0, errors };
  }

  async execute(
    _input: unknown,
    config: Record<string, unknown>,
    _context: ExecutionContext,
  ): Promise<unknown> {
    return {
      type: 'form',
      status: 'waiting_for_input',
      formConfig: config,
    };
  }
}
