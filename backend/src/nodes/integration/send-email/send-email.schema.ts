import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const sendEmailNodeConfigSchema = z.object({}).passthrough();
export type SendEmailConfig = z.infer<typeof sendEmailNodeConfigSchema>;

export const sendEmailNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

export const sendEmailNodeMetadata: NodeComponentMetadata = {
  type: 'send_email',
  category: 'integration',
  label: 'Send Email',
  description: 'Send emails via SMTP',
  icon: 'Mail',
  color: '#F97316',

  defaultConfig: {
    to: [],
    cc: [],
    bcc: [],
    bodyType: 'text',
    attachments: [],
  },
};
