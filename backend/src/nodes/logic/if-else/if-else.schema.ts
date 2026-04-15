import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

const conditionSchema = z
  .object({
    field: z.string(),
    operator: z.string(),
    value: z.unknown().optional(),
  })
  .passthrough();

export const ifElseConfigSchema = z
  .object({
    conditions: z.array(conditionSchema),
    combineMode: z.enum(['and', 'or']).optional(),
  })
  .passthrough();
export type IfElseConfig = z.infer<typeof ifElseConfigSchema>;

export const ifElsePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [
    { id: 'true', label: 'True', type: 'data' },
    { id: 'false', label: 'False', type: 'data' },
  ],
};

export const ifElseMetadata: NodeComponentMetadata = {
  type: 'if_else',
  category: 'logic',
  label: 'If/Else',
  description: 'Conditional branching',
  icon: 'GitBranch',
  color: '#3B82F6',
  defaultConfig: { conditions: [], combineMode: 'and' },
};
