import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const slackNodeConfigSchema = z.object({}).passthrough();
export type SlackConfig = z.infer<typeof slackNodeConfigSchema>;

export const slackNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

export const slackNodeMetadata: NodeComponentMetadata = {
  type: 'slack',
  category: 'integration',
  label: 'Slack',
  description: 'Send Slack messages',
  icon: 'MessageSquare',
  color: '#F97316',

  defaultConfig: { action: 'send_message' },
};
