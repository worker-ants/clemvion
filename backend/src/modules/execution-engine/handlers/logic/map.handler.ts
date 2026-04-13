import {
  NodeHandler,
  ValidationResult,
  ExecutionContext,
} from '../node-handler.interface.js';
import { getNestedValue } from './nested-value.util.js';

/**
 * Map is a container node that iterates over an array and collects the body
 * subgraph's `emit` output per iteration (Phase 3 of the container runtime
 * refactor). The handler itself only resolves the input array and surfaces
 * it to the engine's container dispatch — iteration + collection is handled
 * by {@link ForEachExecutor}, shared with ForEach.
 */
interface MapConfig {
  inputField: string;
  errorPolicy?: 'stop' | 'skip' | 'continue';
}

export class MapHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const { inputField, errorPolicy } = config as unknown as MapConfig;

    if (!inputField || typeof inputField !== 'string') {
      errors.push('inputField is required and must be a string');
    }

    if (
      errorPolicy !== undefined &&
      !['stop', 'skip', 'continue'].includes(errorPolicy)
    ) {
      errors.push('errorPolicy must be one of: stop, skip, continue');
    }

    return { valid: errors.length === 0, errors };
  }

  async execute(
    input: unknown,
    config: Record<string, unknown>,
    _context: ExecutionContext,
  ): Promise<unknown> {
    const { inputField } = config as unknown as MapConfig;

    const array = getNestedValue(input, inputField);
    const items = Array.isArray(array) ? array : [];

    return {
      config: { inputField },
      output: items,
    };
  }
}
