import {
  NodeHandler,
  ValidationResult,
} from '../../core/node-handler.interface.js';

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
    // waitForFormSubmission() fills `output.interaction.{type,data,receivedAt}`
    // and flips `status` to `'resumed'` once the user submits the form
    // (CONVENTIONS §4.3 / §4.5).
    //
    // `output` is an empty object because form has no runtime value at the
    // waiting tick — title / submitLabel / fields are literal config and
    // must NOT be echoed here (Principle 1.1).
    return Promise.resolve({
      config,
      output: {},
      status: 'waiting_for_input',
      meta: { interactionType: 'form', durationMs: 0 },
    });
  }
}
