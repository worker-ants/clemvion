import { NodeHandler, ValidationResult } from '../node-handler.interface.js';

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

  execute(...[, config]: Parameters<NodeHandler['execute']>): Promise<unknown> {
    // Initial execution: transition to waiting_for_input. The engine's
    // waitForFormSubmission() will overwrite the structured output with
    // `{ config: <this>, output: { submittedData }, status: 'submitted' }`
    // once the user submits the form.
    return Promise.resolve({
      config,
      output: null,
      status: 'waiting_for_input',
      meta: { interactionType: 'form' },
    });
  }
}
