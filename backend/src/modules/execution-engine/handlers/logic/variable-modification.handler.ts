import {
  NodeHandler,
  ValidationResult,
  ExecutionContext,
} from '../../../../nodes/core/node-handler.interface.js';

interface Modification {
  variable: string;
  operation: string;
  value: unknown;
}

interface VariableModificationConfig {
  modifications: Modification[];
}

const VALID_OPERATIONS = [
  'set',
  'increment',
  'decrement',
  'append',
  'push',
  'pop',
] as const;

export class VariableModificationHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const { modifications } = config as unknown as VariableModificationConfig;

    if (!modifications || !Array.isArray(modifications)) {
      errors.push('modifications must be an array');
    } else {
      if (modifications.length === 0) {
        errors.push('modifications must not be empty');
      }
      for (let i = 0; i < modifications.length; i++) {
        const m = modifications[i];
        if (!m.variable || typeof m.variable !== 'string') {
          errors.push(
            `modifications[${i}].variable is required and must be a string`,
          );
        }
        if (
          !m.operation ||
          !VALID_OPERATIONS.includes(
            m.operation as (typeof VALID_OPERATIONS)[number],
          )
        ) {
          errors.push(
            `modifications[${i}].operation must be one of: ${VALID_OPERATIONS.join(', ')}`,
          );
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  execute(
    input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<unknown> {
    const { modifications } = config as unknown as VariableModificationConfig;

    for (const mod of modifications) {
      this.applyModification(context, mod);
    }

    return Promise.resolve({
      config: { modifications },
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
