import {
  ExecutionContext,
  NodeHandler,
  ValidationResult,
} from '../../core/node-handler.interface.js';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation.js';
import { formNodeMetadata } from './form.schema.js';

export class FormHandler implements NodeHandler {
  metadata = formNodeMetadata;

  validate(config: Record<string, unknown>): ValidationResult {
    // Schema SSOT (warningRules — no validateConfig) covers the empty-fields
    // rule. The handler used to also flag a non-array `fields`, but the zod
    // schema constrains it; the residual non-array type guard remains here
    // for direct programmatic callers bypassing zod.
    const errors = [...evaluateMetadataBlockingErrors(this.metadata, config)];
    if (config.fields !== undefined && !Array.isArray(config.fields)) {
      errors.push('fields must be an array');
    }
    return { valid: errors.length === 0, errors };
  }

  execute(
    _input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<unknown> {
    // Initial execution: transition to waiting_for_input. The engine's
    // waitForFormSubmission() fills `output.interaction.{type,data,receivedAt}`
    // and flips `status` to `'resumed'` once the user submits the form
    // (CONVENTIONS §4.3 / §4.5).
    //
    // `output` is an empty object because form has no runtime value at the
    // waiting tick — title / submitLabel / fields are literal config and
    // must NOT be echoed here (Principle 1.1).
    //
    // CONVENTIONS Principle 7 — config echoes raw user input (form fields'
    // defaultValue / label may carry `{{ ... }}` templates that the engine
    // resolved before dispatch).
    const rawConfig = context.rawConfig ?? config;
    return Promise.resolve({
      config: { ...rawConfig },
      output: {},
      status: 'waiting_for_input',
      meta: { interactionType: 'form', durationMs: 0 },
    });
  }
}
