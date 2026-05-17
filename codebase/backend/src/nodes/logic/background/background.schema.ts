import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const backgroundNodeOutputSchema = z
  .object({
    config: z.record(z.string(), z.unknown()).optional(),
    output: z.unknown().optional(),
    // Phase 2 (C — spec/4-nodes/1-logic/12-background.md §5.1): expose fork
    // metrics via `meta.*` (CONVENTIONS Principle 2 — meta carries execution
    // metrics, not config echoes). `jobId` is reserved for the engine-side
    // queue stamp (BullMQ) and stays optional — the handler itself emits
    // `durationMs` / `backgroundRunId` / `forkedAt`.
    meta: z
      .object({
        durationMs: z.number().optional(),
        backgroundRunId: z.string().optional(),
        forkedAt: z.string().optional(),
        jobId: z.string().optional(),
      })
      .partial()
      .passthrough()
      .optional(),
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
          hint: "Describe the background task's purpose or caveats — handy for teammates collaborating later.",
        },
      }),
    notifyOnFailure: z
      .boolean()
      .default(false)
      .meta({
        ui: {
          label: 'Notify on failure',
          hint: 'Send an in-app notification to workspace admins when the background body errors.',
        },
      }),
    maxDurationMs: z
      .number()
      .int()
      .min(0)
      .default(300000)
      .meta({
        ui: {
          label: 'Max Duration (ms)',
          hint: 'Force-stop the body when it exceeds this duration. 0 = unlimited. Default 5 minutes (300000).',
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
