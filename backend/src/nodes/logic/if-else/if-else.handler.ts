import {
  NodeHandler,
  NodeHandlerOutput,
  ValidationResult,
  ExecutionContext,
} from '../../core/node-handler.interface.js';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation.js';
import {
  Condition,
  evaluateCondition,
} from '../../core/condition-evaluator.util.js';
import { ifElseMetadata } from './if-else.schema.js';

interface IfElseConfig {
  conditions: Condition[];
  combineMode: 'and' | 'or';
  strictComparison?: boolean;
}

export class IfElseHandler implements NodeHandler {
  metadata = ifElseMetadata;

  validate(config: Record<string, unknown>): ValidationResult {
    // Schema SSOT (warningRules + validateConfig) covers conditions empty,
    // first-condition.field, per-condition field+operator.
    const errors = [...evaluateMetadataBlockingErrors(this.metadata, config)];
    const { combineMode, strictComparison } = config as unknown as IfElseConfig;
    if (combineMode && combineMode !== 'and' && combineMode !== 'or') {
      errors.push('combineMode must be "and" or "or"');
    }
    if (
      strictComparison !== undefined &&
      typeof strictComparison !== 'boolean'
    ) {
      errors.push('strictComparison must be a boolean');
    }
    return { valid: errors.length === 0, errors };
  }

  execute(
    input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<NodeHandlerOutput> {
    const {
      conditions,
      combineMode = 'and',
      strictComparison,
    } = config as unknown as IfElseConfig;

    const options = { strict: strictComparison === true };
    const results = conditions.map((cond) =>
      evaluateCondition(input, cond, options),
    );

    const passed =
      combineMode === 'and' ? results.every(Boolean) : results.some(Boolean);

    // CONVENTIONS Principle 7 — config echoes raw conditions (template
    // strings preserved). Engine populates `rawConfig`; fallback to evaluated
    // config keeps unit tests that bypass the engine working.
    const rawConfig = (context.rawConfig ?? config) as unknown as IfElseConfig;
    // CONVENTIONS Principle 2 — meta carries execution metrics. `conditionResult`
    // lets downstream expressions read the boolean directly without parsing
    // `port`; `matchedConditions` exposes per-condition results for `or` mode
    // debugging. `meta.durationMs` is injected by the engine, not here
    // (sibling switch handler follows the same pattern). Spec §5.1 / §5.2.
    return Promise.resolve({
      config: {
        conditions: rawConfig.conditions,
        combineMode: rawConfig.combineMode ?? 'and',
      },
      output: input,
      meta: {
        conditionResult: passed,
        matchedConditions: results.map((result, index) => ({
          index,
          field: conditions[index]?.field,
          operator: conditions[index]?.operator,
          value: conditions[index]?.value,
          result,
        })),
      },
      port: passed ? 'true' : 'false',
    });
  }
}
