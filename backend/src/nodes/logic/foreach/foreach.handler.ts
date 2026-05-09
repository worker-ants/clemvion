import {
  NodeHandler,
  NodeHandlerOutput,
  ValidationResult,
  ExecutionContext,
} from '../../core/node-handler.interface.js';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation.js';
import { resolveFieldValue } from '../../core/nested-value.util.js';
import { foreachNodeMetadata } from './foreach.schema.js';

interface ForEachConfig {
  // Either a dot-path string applied to `$input` (e.g. `"items"`) OR the
  // resolved value itself when an inline expression like `{{ $var.a }}` is
  // used.
  arrayField: unknown;
  errorPolicy: 'stop' | 'skip' | 'continue';
  collectResults: boolean;
}

export class ForEachHandler implements NodeHandler {
  metadata = foreachNodeMetadata;

  validate(config: Record<string, unknown>): ValidationResult {
    // Schema SSOT (warningRules) covers arrayField. Handler keeps the
    // errorPolicy enum guard for non-zod-parsed callers.
    const errors = [...evaluateMetadataBlockingErrors(this.metadata, config)];
    const { errorPolicy } = config as unknown as ForEachConfig;
    if (
      errorPolicy !== undefined &&
      !['stop', 'skip', 'continue'].includes(errorPolicy)
    ) {
      errors.push('errorPolicy must be one of: stop, skip, continue');
    }
    return { valid: errors.length === 0, errors };
  }

  execute(
    input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<NodeHandlerOutput> {
    const { arrayField } = config as unknown as ForEachConfig;

    const resolved = resolveFieldValue(input, arrayField);
    const items = Array.isArray(resolved) ? resolved : [];

    // CONVENTIONS Principle 7 — config echoes the raw arrayField template
    // (`{{ ... }}` preserved). resolved items still flow as the body
    // iteration source (engine override per Principle 9).
    const rawConfig = (context.rawConfig ?? config) as unknown as ForEachConfig;
    return Promise.resolve({
      config: { arrayField: rawConfig.arrayField },
      output: items,
    });
  }
}
