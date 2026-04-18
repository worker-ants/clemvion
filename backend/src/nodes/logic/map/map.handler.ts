import {
  NodeHandler,
  ValidationResult,
  ExecutionContext,
} from '../../core/node-handler.interface.js';
import { resolveFieldValue } from '../../core/nested-value.util.js';

/**
 * Map is a container node that iterates over an array and collects the body
 * subgraph's `emit` output per iteration (Phase 3 of the container runtime
 * refactor). The handler itself only resolves the input array and surfaces
 * it to the engine's container dispatch — iteration + collection is handled
 * by {@link ForEachExecutor}, shared with ForEach.
 */
interface MapConfig {
  // Either a dot-path string applied to `$input` (e.g. `"items"`) OR the
  // resolved value itself when an inline expression like `{{ $var.a }}` is
  // used. The expression resolver replaces full-string `{{ ... }}` payloads
  // with the underlying typed value, so the handler must accept both shapes.
  inputField: unknown;
  errorPolicy?: 'stop' | 'skip' | 'continue';
}

export class MapHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const { inputField, errorPolicy } = config as unknown as MapConfig;

    if (inputField === undefined || inputField === null || inputField === '') {
      errors.push('inputField is required');
    }

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
    _context: ExecutionContext,
  ): Promise<unknown> {
    const { inputField } = config as unknown as MapConfig;

    const resolved = resolveFieldValue(input, inputField);
    const items = Array.isArray(resolved) ? resolved : [];

    return Promise.resolve({
      config: { inputField },
      output: items,
    });
  }
}
