import {
  NodeHandler,
  NodeHandlerOutput,
  ValidationResult,
  ExecutionContext,
} from '../../core/node-handler.interface.js';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation.js';
import { variableModificationNodeMetadata } from './variable-modification.schema.js';

interface Modification {
  variable: string;
  operation: string;
  value: unknown;
}

interface VariableModificationConfig {
  modifications: Modification[];
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
    const { modifications } = config as unknown as VariableModificationConfig;

    for (const mod of modifications) {
      this.applyModification(context, mod);
    }

    // CONVENTIONS Principle 7 — config echoes raw modifications (`value`
    // templates preserved); runtime mutations above use the evaluated
    // `mod.value` from the resolved `config`.
    const rawConfig = (context.rawConfig ??
      config) as unknown as VariableModificationConfig;
    return Promise.resolve({
      config: { modifications: rawConfig.modifications },
      output: input,
    });
  }

  private applyModification(
    context: ExecutionContext,
    mod: Modification,
  ): void {
    const current = context.variables[mod.variable];

    switch (mod.operation) {
      case 'set':
        context.variables[mod.variable] = mod.value;
        break;
      case 'increment':
        context.variables[mod.variable] =
          (typeof current === 'number' ? current : 0) + Number(mod.value ?? 1);
        break;
      case 'decrement':
        context.variables[mod.variable] =
          (typeof current === 'number' ? current : 0) - Number(mod.value ?? 1);
        break;
      case 'append': {
        const addition =
          typeof mod.value === 'string'
            ? mod.value
            : mod.value === null || mod.value === undefined
              ? ''
              : JSON.stringify(mod.value);
        context.variables[mod.variable] =
          (typeof current === 'string' ? current : '') + addition;
        break;
      }
      case 'push':
        if (Array.isArray(current)) {
          current.push(mod.value);
        } else {
          context.variables[mod.variable] = [mod.value];
        }
        break;
      case 'pop':
        if (Array.isArray(current)) {
          current.pop();
        }
        break;
    }
  }
}
