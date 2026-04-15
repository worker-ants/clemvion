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
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

export const workflowNodeMetadata: NodeComponentMetadata = {
  type: 'workflow',
  category: 'flow',
  label: 'Sub-Workflow',
  description: 'Call another workflow',
  icon: 'Workflow',
  color: '#8B5CF6',
};
