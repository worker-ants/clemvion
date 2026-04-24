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

/**
 * Send Email output: on success surfaces nodemailer's messageId / accepted /
 * rejected lists + deliveryStatus. On failure routes to `port: 'error'` with
 * the standardized `output.error.{code, message, details}` envelope.
 */
export const sendEmailNodeOutputSchema = z
  .object({
    config: z
      .object({
        integrationId: z.string().optional(),
        to: z.array(z.string()).optional(),
        cc: z.array(z.string()).optional(),
        bcc: z.array(z.string()).optional(),
        subject: z.string().optional(),
        bodyType: z.enum(['text', 'html']).optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    output: z
      .object({
        messageId: z.string().optional(),
        accepted: z.array(z.string()).optional(),
        rejected: z.array(z.string()).optional(),
        error: z
          .object({
            code: z.string().optional(),
            message: z.string().optional(),
            details: z.record(z.string(), z.unknown()).optional(),
          })
          .partial()
          .passthrough()
          .optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    meta: z
      .object({
        durationMs: z.number().optional(),
        deliveryStatus: z.enum(['sent', 'failed']).optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    port: z.enum(['out', 'error']).optional(),
    status: z.string().optional(),
  })
  .passthrough();

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
        // Assistant candidate picker 의 후보 조회 범위 힌트.
        // backend 의 CandidateLookupService 가 Integration 테이블을
        // `service_type=email` 로 필터해 이 노드의 picker 에 전달한다.
        // 값이 비면 connected 전체가 후보로 노출된다.
        integrationServiceType: 'email',
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
  outputs: [
    { id: 'out', label: 'Output', type: 'data' },
    { id: 'error', label: 'Error', type: 'error' },
  ],
};

export const sendEmailNodeMetadata: NodeComponentMetadata = {
  type: 'send_email',
  category: 'integration',
  label: 'Send Email',
  description: 'Send emails via SMTP',
  icon: 'Mail',
  color: '#F97316',
};
