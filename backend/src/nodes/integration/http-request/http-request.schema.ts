import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const httpRequestNodeConfigSchema = z.object({}).passthrough();
export type HttpRequestConfig = z.infer<typeof httpRequestNodeConfigSchema>;

export const httpRequestNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [
    { id: 'success', label: 'Success', type: 'data' },
    { id: 'error', label: 'Error', type: 'error' },
  ],
};

export const httpRequestNodeMetadata: NodeComponentMetadata = {
  type: 'http_request',
  category: 'integration',
  label: 'HTTP Request',
  description: 'Make HTTP requests',
  icon: 'Globe',
  color: '#F97316',

  defaultConfig: {},
};
