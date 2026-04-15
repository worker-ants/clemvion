import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const manualTriggerConfigSchema = z.object({}).passthrough();
export type ManualTriggerConfig = z.infer<typeof manualTriggerConfigSchema>;

export const manualTriggerPorts: NodePorts = {
  inputs: [],
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

export const manualTriggerMetadata: NodeComponentMetadata = {
  type: 'manual_trigger',
  category: 'trigger',
  label: 'Manual Trigger',
  description: 'Start point for manual workflow execution',
  icon: 'Zap',
  color: '#F59E0B',
  defaultConfig: { parameters: [] },
};
