import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const mappingDefSchema = z
  .object({
    paramName: z
      .string()
      .default('')
      .meta({
        ui: {
          label: 'Parameter Name',
          widget: 'text',
          placeholder: 'param1',
        },
      }),
    expression: z
      .string()
      .default('')
      .meta({
        ui: {
          label: 'Expression',
          widget: 'expression',
          placeholder: '{{ $input.data }}',
        },
      }),
  })
  .passthrough();

/**
 * Sub-Workflow output is the invoked workflow's final output (sync mode) or
 * a tracking envelope (async mode). Since the nested workflow can be any
 * user-defined workflow, the concrete shape of the sync result is unknowable
 * from this node's config alone — Tier 3 per node-jazzy-liskov plan.
 *
 *  - sync  → `output: { result: <nested workflow final output> }` (1-level wrap)
 *  - async → `output: { executionId, workflowId, status: 'started' }` + top-level `status: 'started'`
 *  - error → `output: { error: { code, message, details? } }` + `port: 'error'`
 *
 * Error codes (CONVENTIONS §3.2):
 *  - `SUB_WORKFLOW_NOT_FOUND` — target workflow does not exist
 *  - `SUB_WORKFLOW_TIMEOUT` — sync execution exceeded timeout
 *  - `SUB_WORKFLOW_QUEUE_FAILED` — async enqueue failed
 *  - `SUB_WORKFLOW_FAILED` — generic runtime failure (default)
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
    // `meta` reserved for engine-injected metrics (e.g. `durationMs`).
    // Async progress markers live on the top-level `status` field instead
    // of `meta.status`, so we do not declare a `status` shape here.
    meta: z.object({}).partial().passthrough().optional(),
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
  // Canvas one-liner: resolved workflow name (or the raw id when only a
  // manual UUID was entered) · execution mode. `fallback:workflowId`
  // resolves the *value* of the workflowId field — unlike `default:`, which
  // would emit the literal string "workflowId". `warnWhen` surfaces the
  // "missing workflow" badge: a `workflowId` set without a `workflowName`
  // means the reference is not backed by a known workflow in the catalog
  // (the selector always co-writes `workflowName` on pick; only manual /
  // since-deleted references leave it empty). `no-workflow-selected`
  // (warningRules, blocking) wins first when there is no id at all, so this
  // warn channel only fires for the set-id-but-unresolved case.
  summaryTemplate: {
    template: '{{workflowName|fallback:workflowId}} · {{mode|default:sync}}',
    warnWhen: 'workflowId && !workflowName',
    warnMessage: 'Missing workflow',
  },
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
      message: 'Target workflow must be selected.',
    },
  ],
  validateConfig: validateWorkflowConfig,
};
