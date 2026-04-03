import {
  NodeHandler,
  ValidationResult,
  ExecutionContext,
} from '../node-handler.interface.js';

interface VariableDefinition {
  name: string;
  type: string;
  defaultValue: unknown;
}

interface VariableDeclarationConfig {
  variables: VariableDefinition[];
}

function coerceToType(value: unknown, type: string): unknown {
  if (value === null || value === undefined) return null;

  switch (type) {
    case 'number': {
      if (typeof value === 'number') return value;
      const n = Number(value);
      return Number.isNaN(n) ? null : n;
    }
    case 'boolean': {
      if (typeof value === 'boolean') return value;
      if (value === 'true') return true;
      if (value === 'false') return false;
      return Boolean(value);
    }
    case 'array': {
      if (Array.isArray(value)) return value;
      if (typeof value === 'string' && value.trim().startsWith('[')) {
        try {
          const parsed: unknown = JSON.parse(value);
          if (Array.isArray(parsed)) return parsed;
        } catch {
          /* not valid JSON — return as-is */
        }
      }
      return value;
    }
    case 'object': {
      if (typeof value === 'object' && !Array.isArray(value)) return value;
      if (typeof value === 'string' && value.trim().startsWith('{')) {
        try {
          const parsed: unknown = JSON.parse(value);
          if (typeof parsed === 'object' && parsed !== null) return parsed;
        } catch {
          /* not valid JSON — return as-is */
        }
      }
      return value;
    }
    default:
      // string or unknown type — keep as string
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') {
        return value.toString();
      }
      return JSON.stringify(value);
  }
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

  async execute(
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

    return input;
  }
}
