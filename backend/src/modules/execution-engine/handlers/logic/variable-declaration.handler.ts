import {
  NodeHandler,
  ValidationResult,
  ExecutionContext,
} from '../../../../nodes/core/node-handler.interface.js';
import { coerceToType } from '../../utils/coerce-type.js';

interface VariableDefinition {
  name: string;
  type: string;
  defaultValue: unknown;
}

interface VariableDeclarationConfig {
  variables: VariableDefinition[];
}

export class VariableDeclarationHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const { variables } = config as unknown as VariableDeclarationConfig;

    if (!variables || !Array.isArray(variables)) {
      errors.push('variables must be an array');
    } else {
      if (variables.length === 0) {
        errors.push('variables must not be empty');
      }
      for (let i = 0; i < variables.length; i++) {
        const v = variables[i];
        if (!v.name || typeof v.name !== 'string') {
          errors.push(`variables[${i}].name is required and must be a string`);
        }
        if (!v.type || typeof v.type !== 'string') {
          errors.push(`variables[${i}].type is required and must be a string`);
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
    const { variables } = config as unknown as VariableDeclarationConfig;

    for (const variable of variables) {
      if (context.variables[variable.name] === undefined) {
        const raw = variable.defaultValue ?? null;
        context.variables[variable.name] = coerceToType(raw, variable.type);
      }
    }

    return Promise.resolve({
      config: { variables },
      output: input,
    });
  }
}
