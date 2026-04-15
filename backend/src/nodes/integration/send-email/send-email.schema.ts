import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

const attachmentSchema = z.object({
  filename: z.string().meta({ ui: { label: 'Filename', widget: 'text' } }),
  content: z
    .string()
    .meta({ ui: { label: 'Content / URL', widget: 'expression' } }),
});

export const sendEmailNodeConfigSchema = z
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
    to: z
      .array(z.string())
      .default([])
      .meta({
        ui: {
          label: 'To',
          widget: 'field-array',
          itemLabel: 'Recipient',
          order: 2,
        },
      }),
    cc: z
      .array(z.string())
      .default([])
      .meta({
        ui: {
          label: 'CC',
          widget: 'field-array',
          itemLabel: 'Recipient',
          order: 3,
        },
      }),
    bcc: z
      .array(z.string())
      .default([])
      .meta({
        ui: {
          label: 'BCC',
          widget: 'field-array',
          itemLabel: 'Recipient',
          order: 4,
        },
      }),
    subject: z
      .string()
      .optional()
      .meta({ ui: { label: 'Subject', widget: 'expression', order: 5 } }),
    body: z
      .string()
      .optional()
      .meta({ ui: { label: 'Body', widget: 'expression', order: 6 } }),
    bodyType: z
      .enum(['text', 'html'])
      .default('text')
      .meta({ ui: { label: 'Body Type', widget: 'select', order: 7 } }),
    attachments: z
      .array(attachmentSchema)
      .default([])
      .meta({
        ui: {
          label: 'Attachments',
          widget: 'field-array',
          itemLabel: 'Attachment',
          order: 8,
        },
      }),
  })
  .passthrough();
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
};
