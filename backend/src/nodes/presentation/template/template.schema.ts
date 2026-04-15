import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const templateNodeConfigSchema = z.object({}).passthrough();
export type TemplateConfig = z.infer<typeof templateNodeConfigSchema>;

export const templateNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

export const templateNodeMetadata: NodeComponentMetadata = {
  type: 'template',
  category: 'presentation',
  label: 'Template',
  description: 'Render templates',
  icon: 'FileText',
  color: '#EC4899',

  defaultConfig: {},
};
