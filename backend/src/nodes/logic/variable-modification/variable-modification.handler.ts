import {
  NodeHandler,
  NodeHandlerOutput,
  ValidationResult,
  ExecutionContext,
} from '../../core/node-handler.interface.js';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation.js';
import { maskValueForLog } from '../_shared/value-masking.util.js';
import { variableModificationNodeMetadata } from './variable-modification.schema.js';

interface Modification {
  variable: string;
  operation: string;
  value: unknown;
}

interface VariableModificationConfig {
  modifications: Modification[];
  recordValues?: boolean;
}

interface AppliedModificationMeta {
  variable: string;
  operation: string;
  applied: boolean;
  /**
   * Variable value before this modification, masked per the value-masking
   * policy. Present only when `config.recordValues === true` (opt-in).
   */
  before?: unknown;
  /** Variable value after this modification, masked. opt-in. */
  after?: unknown;
}

interface CoercionWarningMeta {
  variable: string;
  operation: string;
  fromType: string;
  error?: string;
}

// VALID_OPERATIONS was removed alongside the inline validate() body —
// variable-modification.schema.ts owns the canonical whitelist now.

export class VariableModificationHandler implements NodeHandler {
  metadata = variableModificationNodeMetadata;

  validate(config: Record<string, unknown>): ValidationResult {
    // Schema SSOT (warningRules + validateConfig) covers empty-modifications,
    // first-modification.variable, per-item variable+operation. The
    // non-array type guard remains handler-side for raw fixtures.
    const errors = [...evaluateMetadataBlockingErrors(this.metadata, config)];
    const { modifications } = config as unknown as VariableModificationConfig;
    if (modifications !== undefined && !Array.isArray(modifications)) {
      errors.push('modifications must be an array');
    }
    return { valid: errors.length === 0, errors };
  }

  execute(
    input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<NodeHandlerOutput> {
    const { modifications, recordValues } =
      config as unknown as VariableModificationConfig;

    const appliedMods: AppliedModificationMeta[] = [];
    const coercionWarnings: CoercionWarningMeta[] = [];
    const createdVariables: string[] = [];

    for (const mod of modifications) {
      this.applyModification(
        context,
        mod,
        appliedMods,
        coercionWarnings,
        createdVariables,
        recordValues === true,
      );
    }

    // CONVENTIONS Principle 7 — config echoes raw modifications (`value`
    // templates preserved); runtime mutations above use the evaluated
    // `mod.value` from the resolved `config`.
    const rawConfig = (context.rawConfig ??
      config) as unknown as VariableModificationConfig;
    return Promise.resolve({
      config: {
        modifications: rawConfig.modifications,
        ...(recordValues === true ? { recordValues: true } : {}),
      },
      output: input,
      // CONVENTIONS Principle 2 — meta surfaces execution metrics for
      // debugging / audit (additive, non-breaking).
      meta: {
        modifications: appliedMods,
        coercionWarnings,
        createdVariables,
      },
    });
  }

  private applyModification(
    context: ExecutionContext,
    mod: Modification,
    appliedMods: AppliedModificationMeta[],
    coercionWarnings: CoercionWarningMeta[],
    createdVariables: string[],
    recordValues: boolean,
  ): void {
    // Guard: missing/non-string variable (defense-in-depth — validate()
    // should have caught this, but execute() is invoked for raw fixtures
    // and resilient against partial config).
    if (typeof mod.variable !== 'string' || mod.variable.length === 0) {
      appliedMods.push({
        variable: typeof mod.variable === 'string' ? mod.variable : '',
        operation: mod.operation,
        applied: false,
      });
      return;
    }

    const hadVariable = Object.prototype.hasOwnProperty.call(
      context.variables,
      mod.variable,
    );
    const current = context.variables[mod.variable];
    const currentType = current === null ? 'null' : typeof current;
    // Snapshot the pre-mutation value when opt-in is enabled. Captured
    // BEFORE the switch so push/pop's in-place mutations don't shift the
    // recorded "before" to the post-mutation state.
    const beforeSnapshot = recordValues
      ? maskValueForLog(mod.variable, current)
      : undefined;
    let applied = true;
    let createdNew = false;

    switch (mod.operation) {
      case 'set':
        if (!hadVariable) createdNew = true;
        context.variables[mod.variable] = mod.value;
        break;
      case 'increment':
        if (current !== undefined && typeof current !== 'number') {
          coercionWarnings.push({
            variable: mod.variable,
            operation: mod.operation,
            fromType: currentType,
          });
        }
        if (!hadVariable) createdNew = true;
        context.variables[mod.variable] =
          (typeof current === 'number' ? current : 0) + Number(mod.value ?? 1);
        break;
      case 'decrement':
        if (current !== undefined && typeof current !== 'number') {
          coercionWarnings.push({
            variable: mod.variable,
            operation: mod.operation,
            fromType: currentType,
          });
        }
        if (!hadVariable) createdNew = true;
        context.variables[mod.variable] =
          (typeof current === 'number' ? current : 0) - Number(mod.value ?? 1);
        break;
      case 'append': {
        if (current !== undefined && typeof current !== 'string') {
          coercionWarnings.push({
            variable: mod.variable,
            operation: mod.operation,
            fromType: currentType,
          });
        }
        const addition =
          typeof mod.value === 'string'
            ? mod.value
            : mod.value === null || mod.value === undefined
              ? ''
              : JSON.stringify(mod.value);
        if (!hadVariable) createdNew = true;
        context.variables[mod.variable] =
          (typeof current === 'string' ? current : '') + addition;
        break;
      }
      case 'push':
        if (Array.isArray(current)) {
          current.push(mod.value);
        } else {
          if (current !== undefined) {
            coercionWarnings.push({
              variable: mod.variable,
              operation: mod.operation,
              fromType: currentType,
            });
          }
          if (!hadVariable) createdNew = true;
          context.variables[mod.variable] = [mod.value];
        }
        break;
      case 'pop':
        if (Array.isArray(current)) {
          current.pop();
        } else {
          // pop on non-array is a no-op; record fromType when a non-array
          // value is present (missing variable surfaces fromType=undefined).
          if (current !== undefined) {
            coercionWarnings.push({
              variable: mod.variable,
              operation: mod.operation,
              fromType: currentType,
            });
          }
          applied = false;
        }
        break;
      default:
        // Unknown operation — validate() rejects this pre-flight, but
        // resilient meta tracking marks it as not applied.
        applied = false;
        break;
    }

    const entry: AppliedModificationMeta = {
      variable: mod.variable,
      operation: mod.operation,
      applied,
    };
    if (recordValues) {
      entry.before = beforeSnapshot;
      entry.after = maskValueForLog(
        mod.variable,
        context.variables[mod.variable],
      );
    }
    appliedMods.push(entry);
    if (applied && createdNew) {
      createdVariables.push(mod.variable);
    }
  }
}
