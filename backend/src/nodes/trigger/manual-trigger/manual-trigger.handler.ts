import type {
  NodeHandler,
  ValidationResult,
  ExecutionContext,
  NodeHandlerOutput,
} from '../../core/node-handler.interface';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';
import type { TriggerParameterDefinition } from '../../../modules/execution-engine/types/trigger-parameter.types';
import { validateTriggerParameterSchema } from '../../../modules/execution-engine/utils/resolve-trigger-parameters';
import { manualTriggerMetadata } from './manual-trigger.schema';

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
  metadata = manualTriggerMetadata;

  validate(config: Record<string, unknown>): ValidationResult {
    // Schema has no warningRules / validateConfig today (parameter slots are
    // bounded by zod). The trigger-parameter schema check below stays
    // handler-side because it depends on the runtime
    // resolveTriggerParameters helper which we don't want to drag into the
    // schema bundle (frontend would import it transitively).
    const errors = [...evaluateMetadataBlockingErrors(this.metadata, config)];
    const cfg = config as ManualTriggerConfig;
    if (cfg.parameters !== undefined) {
      const schemaErrors = validateTriggerParameterSchema(cfg.parameters);
      for (const e of schemaErrors) {
        errors.push(`parameters.${e.field}: ${e.reason}`);
      }
    }
    return { valid: errors.length === 0, errors };
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
