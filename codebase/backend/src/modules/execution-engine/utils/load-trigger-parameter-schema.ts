import type { Repository } from 'typeorm';
import type { Logger } from '@nestjs/common';
import { Node } from '../../nodes/entities/node.entity';
import { NODE_TYPES } from '../../../nodes/core/node-types.constants';
import { TriggerParameterDefinition } from '../types/trigger-parameter.types';
import { validateTriggerParameterSchema } from './resolve-trigger-parameters';

/**
 * Load and validate a workflow's Manual Trigger node parameter schema.
 *
 * The node is looked up by `type = 'manual_trigger'` — NOT by
 * `category = TRIGGER`. The parameter schema lives exclusively on the Manual
 * Trigger node, and real data contains manual-trigger nodes whose `category`
 * column is missing/incorrect (the frontend defends against exactly this with
 * a `type === 'manual_trigger'` fallback in `is-trigger.ts`). A category-based
 * lookup silently misses those nodes → empty schema → every default is
 * stripped even though the node's `config.parameters` is valid and saved. The
 * type-based lookup is the robust match.
 *
 * Returns `undefined` when:
 * - no Manual Trigger node exists for the workflow, or
 * - the node has no `parameters` config, or
 * - the schema is structurally invalid (a warning is logged).
 *
 * Callers receiving `undefined` should pass-through with empty parameters
 * (see {@link resolveTriggerParameters}).
 */
export async function loadTriggerParameterSchema(
  nodeRepository: Pick<Repository<Node>, 'findOne'>,
  workflowId: string,
  logger?: Pick<Logger, 'warn'>,
): Promise<TriggerParameterDefinition[] | undefined> {
  const triggerNode = await nodeRepository.findOne({
    where: { workflowId, type: NODE_TYPES.MANUAL_TRIGGER },
  });
  const raw = (triggerNode?.config ?? {}) as { parameters?: unknown };
  const schema = raw.parameters;
  const schemaErrors = validateTriggerParameterSchema(schema);
  if (schemaErrors.length > 0) {
    logger?.warn(
      `Workflow ${workflowId} trigger node has invalid parameter schema: ${schemaErrors
        .map((e) => `${e.field}(${e.reason})`)
        .join(', ')}`,
    );
    return undefined;
  }
  return schema as TriggerParameterDefinition[] | undefined;
}
