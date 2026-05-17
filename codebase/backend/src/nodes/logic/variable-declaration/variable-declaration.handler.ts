import {
  NodeHandler,
  NodeHandlerOutput,
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
  ): Promise<NodeHandlerOutput> {
    const { variables } = config as unknown as VariableDeclarationConfig;

    // Phase 2 (C) — meta observability fields. Principle 2 (meta는 실행 메트릭).
    // Additive / non-breaking: downstream still reads `$var.<name>` for values.
    const declared: string[] = [];
    const skipped: string[] = [];
    const coercionWarnings: Array<{
      name: string;
      attemptedType: string;
      error?: string;
    }> = [];

    for (const variable of variables) {
      if (context.variables[variable.name] !== undefined) {
        skipped.push(variable.name);
        continue;
      }

      const raw = variable.defaultValue ?? null;
      const coerced = coerceToType(raw, variable.type);
      context.variables[variable.name] = coerced;
      declared.push(variable.name);

      // Detect silent null fallback: user provided a non-null defaultValue
      // but `coerceToType` collapsed to null (e.g. `Number('abc') → NaN`,
      // failed JSON.parse → null branches in coerce-type.ts).
      if (raw !== null && coerced === null) {
        coercionWarnings.push({
          name: variable.name,
          attemptedType: variable.type,
          error: `Failed to coerce defaultValue to '${variable.type}' — stored null`,
        });
      }
    }

    // CONVENTIONS Principle 7 — config echoes raw variable definitions
    // (defaultValue templates preserved). The runtime coercion above uses
    // the evaluated `defaultValue` from the resolved `config`.
    const rawConfig = (context.rawConfig ??
      config) as unknown as VariableDeclarationConfig;
    return Promise.resolve({
      config: { variables: rawConfig.variables },
      output: input,
      meta: {
        declared,
        skipped,
        coercionWarnings,
      },
    });
  }
}
