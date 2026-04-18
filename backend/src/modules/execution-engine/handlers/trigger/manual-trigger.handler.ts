import type {
  NodeHandler,
  ValidationResult,
  ExecutionContext,
  NodeHandlerOutput,
} from '../../../../nodes/core/node-handler.interface';
import type { TriggerParameterDefinition } from '../../types/trigger-parameter.types';
import { validateTriggerParameterSchema } from '../../utils/resolve-trigger-parameters';

interface ManualTriggerConfig {
  parameters?: TriggerParameterDefinition[];
}

interface ManualTriggerInput {
  parameters?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Manual Trigger handler.
 *
 * Entry node for manual/webhook/schedule triggered workflows. The handler
 * itself does not perform raw-value resolution — that's done upstream by
 * {@link resolveTriggerParameters} in the webhook/schedule/run adapters so
 * that missing-required fields can be reported as 400 responses without
 * creating an Execution record.
 *
 * The handler's job at execute time is to surface the already-resolved
 * `parameters` object on its structured output so downstream expressions
 * (`$input.parameters.*`, `$params.*`) resolve predictably.
 */
export class ManualTriggerHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const cfg = config as ManualTriggerConfig;
    if (cfg.parameters === undefined) {
      return { valid: true, errors: [] };
    }
    const schemaErrors = validateTriggerParameterSchema(cfg.parameters);
    return {
      valid: schemaErrors.length === 0,
      errors: schemaErrors.map((e) => `parameters.${e.field}: ${e.reason}`),
    };
  }

  execute(
    input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<NodeHandlerOutput> {
    void context;
    const cfg = config as ManualTriggerConfig;
    const parameters = cfg.parameters ?? [];

    const typedInput =
      input && typeof input === 'object' && !Array.isArray(input)
        ? (input as ManualTriggerInput)
        : undefined;

    const resolvedParameters =
      typedInput?.parameters &&
      typeof typedInput.parameters === 'object' &&
      !Array.isArray(typedInput.parameters)
        ? typedInput.parameters
        : {};

    const { parameters: _omit, ...rest } = typedInput ?? {};
    void _omit;

    return Promise.resolve({
      config: { parameters },
      output: {
        parameters: resolvedParameters,
        ...rest,
      },
    });
  }
}
