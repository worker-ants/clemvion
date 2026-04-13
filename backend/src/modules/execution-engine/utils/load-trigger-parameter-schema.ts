import type { Repository } from 'typeorm';
import type { Logger } from '@nestjs/common';
import { Node, NodeCategory } from '../../nodes/entities/node.entity';
import { TriggerParameterDefinition } from '../types/trigger-parameter.types';
import { validateTriggerParameterSchema } from './resolve-trigger-parameters';

/**
 * Load and validate a workflow's Manual Trigger node parameter schema.
 *
 * Returns `undefined` when:
 * - no trigger node exists for the workflow, or
 * - trigger node has no `parameters` config, or
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
    where: { workflowId, category: NodeCategory.TRIGGER },
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
