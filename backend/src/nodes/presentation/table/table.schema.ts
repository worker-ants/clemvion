import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const tableNodeConfigSchema = z.object({}).passthrough();
export type TableConfig = z.infer<typeof tableNodeConfigSchema>;

export const tableNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

export const tableNodeMetadata: NodeComponentMetadata = {
  type: 'table',
  category: 'presentation',
  label: 'Table',
  description: 'Display as table',
  icon: 'Table',
  color: '#EC4899',

  defaultConfig: {
    mode: 'dynamic',
    columns: [],
    rows: [],
    pagination: true,
    pageSize: 20,
    sortOrder: 'asc',
    buttons: [],
  },
};
