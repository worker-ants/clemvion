import {
  NodeHandler,
  ValidationResult,
  ExecutionContext,
} from '../node-handler.interface.js';

interface MergeConfig {
  strategy: 'wait_all' | 'first' | 'append';
  outputFormat: 'array' | 'merge_object' | 'indexed';
}

export class MergeHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const { strategy, outputFormat } = config as unknown as MergeConfig;

    if (!strategy || !['wait_all', 'first', 'append'].includes(strategy)) {
      errors.push('strategy must be one of: wait_all, first, append');
    }

    if (
      !outputFormat ||
      !['array', 'merge_object', 'indexed'].includes(outputFormat)
    ) {
      errors.push('outputFormat must be one of: array, merge_object, indexed');
    }

    return { valid: errors.length === 0, errors };
  }

  async execute(
    input: unknown,
    config: Record<string, unknown>,
    _context: ExecutionContext,
  ): Promise<unknown> {
    const { strategy, outputFormat } = config as unknown as MergeConfig;

    const inputs = this.normalizeInputs(input);
    const formatted =
      strategy === 'first'
        ? this.formatOutput([inputs[0]], outputFormat)
        : this.formatOutput(inputs, outputFormat);

    return {
      config: { strategy, outputFormat },
      output: formatted,
    };
  }

  private normalizeInputs(input: unknown): unknown[] {
    if (Array.isArray(input)) {
      return input;
    }

    if (typeof input === 'object' && input !== null) {
      const obj = input as Record<string, unknown>;
      const keys = Object.keys(obj).sort();
      return keys.map((k) => obj[k]);
    }

    return [input];
  }

  private formatOutput(inputs: unknown[], outputFormat: string): unknown {
    switch (outputFormat) {
      case 'array':
        return inputs;
      case 'merge_object': {
        const merged = Object.create(null) as Record<string, unknown>;
        const blockedKeys = new Set(['__proto__', 'constructor', 'prototype']);
        for (const item of inputs) {
          if (typeof item === 'object' && item !== null) {
            for (const [key, value] of Object.entries(
              item as Record<string, unknown>,
            )) {
              if (!blockedKeys.has(key)) {
                merged[key] = value;
              }
            }
          }
        }
        return merged;
      }
      case 'indexed': {
        const indexed: Record<string, unknown> = {};
        for (let i = 0; i < inputs.length; i++) {
          indexed[`in_${i}`] = inputs[i];
        }
        return indexed;
      }
      default:
        return inputs;
    }
  }
}
