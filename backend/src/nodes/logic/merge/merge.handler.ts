import { Logger } from '@nestjs/common';
import {
  NodeHandler,
  NodeHandlerOutput,
  ValidationResult,
  ExecutionContext,
} from '../../core/node-handler.interface.js';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation.js';
import { mergeNodeMetadata } from './merge.schema.js';

type MergeStrategy = 'wait_all' | 'first' | 'append';
type MergeOutputFormat = 'array' | 'merge_object' | 'indexed';

interface MergeConfig {
  strategy?: MergeStrategy;
  outputFormat?: MergeOutputFormat;
  timeout?: number;
  partialOnTimeout?: boolean;
}

const VALID_STRATEGIES: readonly MergeStrategy[] = [
  'wait_all',
  'first',
  'append',
] as const;
const VALID_OUTPUT_FORMATS: readonly MergeOutputFormat[] = [
  'array',
  'merge_object',
  'indexed',
] as const;
const DEFAULT_STRATEGY: MergeStrategy = 'wait_all';
const DEFAULT_OUTPUT_FORMAT: MergeOutputFormat = 'array';

export class MergeHandler implements NodeHandler {
  private readonly logger = new Logger(MergeHandler.name);

  metadata = mergeNodeMetadata;

  validate(config: Record<string, unknown>): ValidationResult {
    // Schema SSOT (warningRules) catches the explicit "no strategy" case.
    // The remaining type/enum guards stay handler-side because zod normally
    // narrows them at parse time but raw fixtures and direct callers still
    // exercise this path.
    const errors = [...evaluateMetadataBlockingErrors(this.metadata, config)];
    const { strategy, outputFormat, timeout, partialOnTimeout } =
      config as unknown as MergeConfig;

    if (strategy !== undefined && !VALID_STRATEGIES.includes(strategy)) {
      errors.push(`strategy must be one of: ${VALID_STRATEGIES.join(', ')}`);
    }
    if (
      outputFormat !== undefined &&
      !VALID_OUTPUT_FORMATS.includes(outputFormat)
    ) {
      errors.push(
        `outputFormat must be one of: ${VALID_OUTPUT_FORMATS.join(', ')}`,
      );
    }
    if (timeout !== undefined && (typeof timeout !== 'number' || timeout < 0)) {
      errors.push('timeout must be a non-negative number (0 = no timeout)');
    }
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
    context: ExecutionContext,
  ): Promise<NodeHandlerOutput> {
    const {
      strategy = DEFAULT_STRATEGY,
      outputFormat = DEFAULT_OUTPUT_FORMAT,
      timeout,
      partialOnTimeout,
    } = config as unknown as MergeConfig;

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
    const effectiveInputs = strategy === 'first' ? [inputs[0]] : inputs;
    const { output: formatted, skippedKeys } = this.formatOutput(
      effectiveInputs,
      outputFormat,
    );

    // CONVENTIONS Principle 2 — meta carries execution metrics.
    //  - inputCount: number of effective merged inputs (post strategy slicing,
    //    so `first` reports 1). Lets downstream nodes know fan-in size without
    //    re-deriving it from `output` (whose shape varies by outputFormat).
    //  - strategy / outputFormat: echo the resolved values (defaults applied)
    //    so downstream branches can key on meta without falling back to config.
    //  - skippedKeys: prototype-pollution drops surfaced for merge_object
    //    (Principle 3 — silent failure 해소). Always present (empty array for
    //    other formats) so consumers don't need conditional guards.
    //  - dormantFields: P1-dormant config fields (`timeout` > 0,
    //    `partialOnTimeout=true`) that were configured but have no runtime
    //    effect until the Phase P2 fan-in barrier ships. Mirrors the warn log.
    //    Always present (empty array when none) for consumer simplicity.
    // `meta.durationMs` is injected by the engine, not here.

    // CONVENTIONS Principle 7 — config echoes raw strategy / outputFormat.
    // merge config fields are bounded enums (no `{{ ... }}` templates), so
    // raw === evaluated in the common case; rawConfig is still used for
    // consistency.
    const rawConfig = (context.rawConfig ?? config) as unknown as MergeConfig;
    const dormantFields: string[] = [];
    if (typeof timeout === 'number' && timeout > 0) {
      dormantFields.push('timeout');
    }
    if (partialOnTimeout === true) {
      dormantFields.push('partialOnTimeout');
    }

    return {
      config: {
        strategy: rawConfig.strategy ?? DEFAULT_STRATEGY,
        outputFormat: rawConfig.outputFormat ?? DEFAULT_OUTPUT_FORMAT,
      },
      output: formatted,
      meta: {
        inputCount: effectiveInputs.length,
        strategy,
        outputFormat,
        skippedKeys,
        dormantFields,
      },
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

  private formatOutput(
    inputs: unknown[],
    outputFormat: string,
  ): { output: unknown; skippedKeys: string[] } {
    switch (outputFormat) {
      case 'array':
        return { output: inputs, skippedKeys: [] };
      case 'merge_object': {
        const merged = Object.create(null) as Record<string, unknown>;
        const blockedKeys = new Set(['__proto__', 'constructor', 'prototype']);
        // Use Set to dedupe — same blocked key may appear in multiple inputs
        // and we only need one entry per dropped key in meta.skippedKeys.
        const skipped = new Set<string>();
        for (const item of inputs) {
          if (typeof item === 'object' && item !== null) {
            // Use Object.getOwnPropertyNames to also detect __proto__ when set
            // as an own property (literal object syntax doesn't create it as
            // own, but Object.defineProperty / Object.assign with computed key
            // can). Object.entries skips non-enumerable, so we mirror that.
            for (const [key, value] of Object.entries(
              item as Record<string, unknown>,
            )) {
              if (blockedKeys.has(key)) {
                skipped.add(key);
              } else {
                merged[key] = value;
              }
            }
          }
        }
        return { output: merged, skippedKeys: Array.from(skipped).sort() };
      }
      case 'indexed': {
        const indexed: Record<string, unknown> = {};
        for (let i = 0; i < inputs.length; i++) {
          indexed[`in_${i}`] = inputs[i];
        }
        return { output: indexed, skippedKeys: [] };
      }
      default:
        return { output: inputs, skippedKeys: [] };
    }
  }
}
