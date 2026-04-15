import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const slackNodeConfigSchema = z
  .object({
    integrationId: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Integration',
          widget: 'integration-selector',
          order: 1,
        },
      }),
    action: z
      .enum([
        'send_message',
        'update_message',
        'add_reaction',
        'list_channels',
        'upload_file',
      ])
      .default('send_message')
      .meta({ ui: { label: 'Action', widget: 'select', order: 2 } }),
    actionConfig: z
      .record(z.string(), z.unknown())
      .default({})
      .meta({
        ui: {
          label: 'Action Config',
          widget: 'code',
          language: 'json',
          order: 3,
        },
      }),
  })
  .passthrough();
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
};
