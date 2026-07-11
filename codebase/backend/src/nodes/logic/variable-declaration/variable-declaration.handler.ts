import {
  NodeHandler,
  NodeHandlerOutput,
  ValidationResult,
  ExecutionContext,
} from '../../core/node-handler.interface.js';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation.js';
import { coerceToType } from '../../../modules/execution-engine/utils/coerce-type.js';
import { variableDeclarationNodeMetadata } from './variable-declaration.schema.js';
import {
  isReservedVariableName,
  reservedVariableNameRuntimeError,
} from '../_shared/reserved-variable-name.util.js';

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

  // `async` 필수: 아래 예약 이름 가드는 throw 한다. non-async 함수가
  // `Promise<T>` 를 선언한 채 동기 throw 하면 `execute(...).catch(...)` 처럼
  // await 없이 부르는 호출부에서 잡히지 않는다.
  async execute(
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

    for (let i = 0; i < variables.length; i++) {
      const variable = variables[i];
      // L2 — `config` 는 이미 표현식이 해석된 상태다. 이 노드는
      // EXPRESSION_EXCLUSIONS 에 없으므로 `name` 이 `{{ }}` 였다면 여기서
      // 처음으로 실제 이름을 알 수 있다. 예약 prefix 강제의 실질 지점.
      // (리터럴 이름은 L0 저장 게이트·L1 pre-flight 가 이미 걸렀다.)
      if (isReservedVariableName(variable.name)) {
        throw reservedVariableNameRuntimeError(
          `variables[${i}].name`,
          variable.name,
        );
      }
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
