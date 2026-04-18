import { Logger } from '@nestjs/common';
import {
  NodeHandler,
  ValidationResult,
  ExecutionContext,
} from '../../core/node-handler.interface.js';

interface MergeConfig {
  strategy: 'wait_all' | 'first' | 'append';
  outputFormat: 'array' | 'merge_object' | 'indexed';
  timeout?: number;
  partialOnTimeout?: boolean;
}

export class MergeHandler implements NodeHandler {
  private readonly logger = new Logger(MergeHandler.name);

  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const { strategy, outputFormat, timeout } =
      config as unknown as MergeConfig;

    if (!strategy || !['wait_all', 'first', 'append'].includes(strategy)) {
      errors.push('strategy must be one of: wait_all, first, append');
    }

    if (
      !outputFormat ||
      !['array', 'merge_object', 'indexed'].includes(outputFormat)
    ) {
      errors.push('outputFormat must be one of: array, merge_object, indexed');
    }

    if (timeout !== undefined && (typeof timeout !== 'number' || timeout < 0)) {
      errors.push('timeout must be a non-negative number (0 = no timeout)');
    }

    const { partialOnTimeout } = config as unknown as MergeConfig;
    if (
      partialOnTimeout !== undefined &&
      typeof partialOnTimeout !== 'boolean'
    ) {
      errors.push('partialOnTimeout must be a boolean');
    }

    return { valid: errors.length === 0, errors };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async execute(
    input: unknown,
    config: Record<string, unknown>,

    _context: ExecutionContext,
  ): Promise<unknown> {
    const { strategy, outputFormat, timeout, partialOnTimeout } =
      config as unknown as MergeConfig;

    // Phase P1 runs on a sequential engine where all predecessors are
    // already resolved before Merge executes, so a barrier is unnecessary.
    // Surface a warning so operators notice the config is dormant until
    // Phase P2 introduces true per-branch arrival tracking.
    if (typeof timeout === 'number' && timeout > 0) {
      this.logger.warn(
        `Merge node timeout=${timeout}s is configured but will take effect in Phase P2 ` +
          `(real-time fan-in barrier). In Phase P1 all predecessors are already resolved ` +
          `before Merge runs, so this setting is dormant.`,
      );
    }
    if (partialOnTimeout === true) {
      this.logger.warn(
        `Merge node partialOnTimeout=true is configured but only applies alongside the ` +
          `Phase P2 barrier timeout. In Phase P1 this setting is dormant.`,
      );
    }

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
