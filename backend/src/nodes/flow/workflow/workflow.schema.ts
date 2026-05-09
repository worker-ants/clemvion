import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const mappingDefSchema = z
  .object({
    target: z
      .string()
      .default('')
      .meta({
        ui: {
          label: 'Target',
          widget: 'text',
          placeholder: 'param1',
        },
      }),
    source: z
      .string()
      .default('')
      .meta({
        ui: {
          label: 'Source',
          widget: 'expression',
          placeholder: '{{ $input.data }}',
        },
      }),
  })
  .passthrough();

/**
 * Sub-Workflow output is the invoked workflow's final output (sync mode) or
 * a tracking envelope (async mode). Since the nested workflow can be any
 * user-defined workflow, the concrete shape is unknowable from this node's
 * config alone — Tier 3 per node-jazzy-liskov plan.
 *
 *  - sync  → `output: <nested workflow final output>` (unknown shape)
 *  - async → `output: { executionId: string }` + `meta.status: 'started'`
 *  - error → `output: { error: { code, message, details? } }` + `port: 'error'`
 */
export const workflowNodeOutputSchema = z
  .object({
    config: z
      .object({
        workflowId: z.string().optional(),
        mode: z.enum(['sync', 'async']).optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    output: z.unknown().optional(),
    meta: z
      .object({
        status: z.string().optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    port: z.enum(['out', 'error']).optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const workflowNodeConfigSchema = z
  .object({
    workflowId: z
      .string()
      .default('')
      .meta({
        ui: {
          label: 'Target Workflow',
          widget: 'workflow-selector',
          placeholder: 'Select a workflow or enter UUID',
        },
      }),
    workflowName: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Workflow Name',
          widget: 'text',
          hidden: true,
        },
      }),
    mode: z
      .enum(['sync', 'async'])
      .default('sync')
      .meta({ ui: { label: 'Mode', widget: 'select' } }),
    inputMapping: z
      .array(mappingDefSchema)
      .default([])
      .meta({
        ui: {
          label: 'Input Mapping',
          widget: 'field-array',
          itemLabel: 'Parameter',
        },
      }),
    timeout: z
      .number()
      .int()
      .default(300)
      .meta({
        ui: {
          label: 'Timeout (seconds)',
          widget: 'number',
          hint: '0 = no timeout (wait indefinitely)',
          visibleWhen: { field: 'mode', equals: 'sync' },
        },
      }),
  })
  .passthrough();
export type WorkflowConfig = z.infer<typeof workflowNodeConfigSchema>;

export const workflowNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [
    { id: 'out', label: 'Output', type: 'data' },
    { id: 'error', label: 'Error', type: 'error' },
  ],
};

/**
 * Imperative escape hatch — `inputMapping` per-item `paramName` requires
 * array iteration, and `timeout` numeric range needs `>= 0` AND non-numeric
 * type guard the mini-DSL can't model in a single rule. Single-field
 * "is workflowId set?" lives in `warningRules` so the canvas badge fires.
 */
export function validateWorkflowConfig(config: unknown): string[] {
  const c = (config ?? {}) as Record<string, unknown>;
  const errors: string[] = [];

  if (
    c.timeout !== undefined &&
    (typeof c.timeout !== 'number' || c.timeout < 0)
  ) {
    errors.push('timeout must be a non-negative number (0 = no timeout)');
  }

  const inputMapping = c.inputMapping;
  if (inputMapping !== undefined) {
    if (!Array.isArray(inputMapping)) {
      errors.push('inputMapping must be an array');
    } else {
      for (let i = 0; i < inputMapping.length; i++) {
        const m = inputMapping[i] as Record<string, unknown>;
        if (
          !m ||
          typeof m !== 'object' ||
          typeof m.paramName !== 'string' ||
          !m.paramName
        ) {
          errors.push(
            `inputMapping[${i}].paramName is required and must be a string`,
          );
        }
      }
    }
  }

  return errors;
}

export const workflowNodeMetadata: NodeComponentMetadata = {
  type: 'workflow',
  category: 'flow',
  label: 'Sub-Workflow',
  description: 'Call another workflow',
  icon: 'Workflow',
  color: '#8B5CF6',
  executionMetadata: { kind: 'standard' },
  // SSOT for warnings (frontend canvas + backend handler.validate).
  // Mirror points:
  //  - frontend `workflowSummary` warning ("Workflow not selected")
  //  - backend handler.validate's "workflowId is required" rule.
  // `mode` enum is bounded by zod, so no rule is needed there. `timeout`
  // and per-item inputMapping validation live in `validateConfig` because
  // they need numeric range / array iteration.
  warningRules: [
    {
      id: 'workflow:no-workflow-selected',
      when: '!workflowId',
      message: '실행할 워크플로우를 선택해야 합니다.',
    },
  ],
  validateConfig: validateWorkflowConfig,
};
