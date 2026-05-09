import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const backgroundNodeOutputSchema = z
  .object({
    config: z.record(z.string(), z.unknown()).optional(),
    output: z.unknown().optional(),
    port: z.literal('main').optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const backgroundNodeConfigSchema = z
  .object({
    notes: z
      .string()
      .default('')
      .meta({
        ui: {
          label: 'Notes',
          widget: 'textarea',
          hint: '백그라운드에서 수행할 작업의 목적·주의사항을 적어두면 협업할 때 편해요.',
        },
      }),
    notifyOnFailure: z
      .boolean()
      .default(false)
      .meta({
        ui: {
          label: 'Notify on failure',
          hint: '백그라운드 본문에서 오류가 발생하면 워크스페이스 Admin에게 인앱 알림을 보내요.',
        },
      }),
    maxDurationMs: z
      .number()
      .int()
      .min(0)
      .default(300000)
      .meta({
        ui: {
          label: 'Max duration (ms)',
          hint: '본문이 이 시간을 넘기면 강제 종료해요. 0을 입력하면 무제한이에요. 기본 5분(300000).',
        },
      }),
  })
  .passthrough();
export type BackgroundConfig = z.infer<typeof backgroundNodeConfigSchema>;

export const backgroundNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [
    { id: 'main', label: 'Main', type: 'data' },
    { id: 'background', label: 'Background', type: 'data' },
  ],
};

export const backgroundNodeMetadata: NodeComponentMetadata = {
  type: 'background',
  category: 'logic',
  label: 'Background',
  description:
    'Run downstream branch in background without blocking the main flow',
  icon: 'Layers',
  color: '#8B5CF6',
  executionMetadata: { kind: 'background' },
};
