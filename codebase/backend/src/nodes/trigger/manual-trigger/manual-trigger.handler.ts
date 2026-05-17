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

/**
 * Internal marker that adapters (webhook / schedule / manual) stamp onto the
 * engine input so the handler can record `meta.source` deterministically. The
 * `__` prefix marks it as engine-internal — the handler strips it before
 * exposing the output, and downstream expression resolvers never see it.
 */
type TriggerSource = 'manual' | 'webhook' | 'schedule';
export const TRIGGER_SOURCE_INPUT_KEY = '__triggerSource';

interface ManualTriggerInput {
  parameters?: Record<string, unknown>;
  __triggerSource?: TriggerSource;
  body?: unknown;
  headers?: unknown;
  query?: unknown;
  method?: unknown;
  [key: string]: unknown;
}

const TRANSPORT_KEYS = ['body', 'headers', 'query', 'method'] as const;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function detectTriggerSource(
  input: ManualTriggerInput | undefined,
): TriggerSource {
  // 1. Explicit marker stamped by the adapter wins.
  const marker = input?.__triggerSource;
  if (marker === 'manual' || marker === 'webhook' || marker === 'schedule') {
    return marker;
  }
  // 2. Backward-resilient detection: if input carries any HTTP transport
  //    field (body / headers / query / method) the adapter must be webhook.
  //    Manual / schedule adapters only ever pass `{ parameters }`.
  if (input && TRANSPORT_KEYS.some((k) => k in input)) {
    return 'webhook';
  }
  // 3. Default to manual — schedule adapters that omit the marker are
  //    indistinguishable from manual at this layer; the marker should
  //    always be set, so this is just a safety net.
  return 'manual';
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
 * The handler's job at execute time is to:
 * 1. Surface the already-resolved `parameters` object on `output.parameters`
 *    so downstream expressions (`$input.parameters.*`, `$params.*`) resolve
 *    predictably.
 * 2. Group webhook HTTP transport fields under `output.request.{method,
 *    headers, query, body}` so they don't collide with user-defined parameter
 *    names at the top level.
 * 3. Tag `meta.source: 'manual' | 'webhook' | 'schedule'` (CONVENTIONS
 *    Principle 2 — execution metadata) for debugging/branching downstream.
 *
 * Source detection prefers the explicit `__triggerSource` marker stamped by
 * the adapter, with HTTP transport-shape detection as a fallback.
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
    // CONVENTIONS Principle 7 — `config` echoes raw parameter definitions
    // (defaultValue templates preserved). `output.parameters` carries the
    // already-resolved values produced by `resolveTriggerParameters` upstream.
    const rawConfig = (context.rawConfig ?? config) as ManualTriggerConfig;
    const rawParameters = rawConfig.parameters ?? [];

    const typedInput = isPlainRecord(input)
      ? (input as ManualTriggerInput)
      : undefined;

    const resolvedParameters = isPlainRecord(typedInput?.parameters)
      ? typedInput.parameters
      : {};

    const source = detectTriggerSource(typedInput);

    // Build output. `parameters` is always present (Principle 10 — null/empty
    // input fallback to {}). `request` is only emitted when the webhook
    // adapter actually populated one of the transport fields, to avoid
    // surfacing an empty `{ method: undefined, ... }` shape on manual /
    // schedule executions.
    const output: Record<string, unknown> = { parameters: resolvedParameters };
    if (source === 'webhook' && typedInput) {
      output.request = {
        method: typedInput.method,
        headers: typedInput.headers,
        query: typedInput.query,
        body: typedInput.body,
      };
    }

    return Promise.resolve({
      config: { parameters: rawParameters },
      output,
      meta: { source },
    });
  }
}
