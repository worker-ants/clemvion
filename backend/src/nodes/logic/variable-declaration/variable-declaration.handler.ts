import {
  NodeHandler,
  ValidationResult,
  ExecutionContext,
} from '../../core/node-handler.interface.js';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation.js';
import { coerceToType } from '../../../modules/execution-engine/utils/coerce-type.js';
import { variableDeclarationNodeMetadata } from './variable-declaration.schema.js';

interface VariableDefinition {
  name: string;
  type: string;
  defaultValue: unknown;
}

interface VariableDeclarationConfig {
  variables: VariableDefinition[];
}

export class VariableDeclarationHandler implements NodeHandler {
  metadata = variableDeclarationNodeMetadata;

  validate(config: Record<string, unknown>): ValidationResult {
    // Schema SSOT (warningRules + validateConfig) covers the empty-variables
    // / first-variable-name / per-variable name+type rules. Handler retains
    // the non-array type guard for raw fixtures bypassing zod.
    const errors = [...evaluateMetadataBlockingErrors(this.metadata, config)];
    const { variables } = config as unknown as VariableDeclarationConfig;
    if (variables !== undefined && !Array.isArray(variables)) {
      errors.push('variables must be an array');
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
