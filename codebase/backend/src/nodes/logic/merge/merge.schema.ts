import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const mergeNodeOutputSchema = z
  .object({
    config: z
      .object({
        strategy: z.enum(['wait_all', 'first', 'append']).optional(),
        outputFormat: z.enum(['array', 'merge_object', 'indexed']).optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    // Shape varies by `config.outputFormat`:
    //  - array         → unknown[]
    //  - merge_object  → Record<string, unknown> (shallow-merged)
    //  - indexed       → { in_0, in_1, ... }
    output: z.unknown().optional(),
    port: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const mergeNodeConfigSchema = z
  .object({
    strategy: z
      .enum(['wait_all', 'first', 'append'])
      .default('wait_all')
      .meta({ ui: { label: 'Strategy', widget: 'select' } }),
    outputFormat: z
      .enum(['array', 'merge_object', 'indexed'])
      .default('array')
      .meta({ ui: { label: 'Output Format', widget: 'select' } }),
    timeout: z
      .number()
      .int()
      .default(300)
      .meta({
        ui: {
          label: 'Timeout (seconds)',
          widget: 'number',
          hint: '0 = no timeout (wait indefinitely)',
        },
      }),
    partialOnTimeout: z
      .boolean()
      .default(false)
      .meta({
        ui: {
          label: 'Partial on Timeout',
          widget: 'checkbox',
          hint: 'Merge arrived inputs when timeout elapses',
        },
      }),
  })
  .passthrough();
export type MergeConfig = z.infer<typeof mergeNodeConfigSchema>;

export const mergeNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

export const mergeNodeMetadata: NodeComponentMetadata = {
  type: 'merge',
  category: 'logic',
  label: 'Merge',
  description: 'Combine inputs',
  icon: 'Merge',
  color: '#3B82F6',
  executionMetadata: { kind: 'standard' },
  // SSOT for warnings (frontend canvas + backend handler.validate).
  // Mirror points:
  //  - frontend `mergeSummary` warnings ("Strategy not set"). NOTE: the
  //    formatter also references `config.inputCount` which is NOT in the
  //    canonical schema (schema only has strategy / outputFormat / timeout /
  //    partialOnTimeout — fan-in count is implicit from the predecessor
  //    edges, not a config field). The schema is the SSOT, so we drop the
  //    `inputCount` rule; the gap is reported in the migration notes and
  //    will be reconciled in Step 5 when FORMATTERS is removed.
  //  - backend handler.validate's enum guards (strategy / outputFormat /
  //    timeout >= 0 / partialOnTimeout boolean) are enforced by the zod
  //    schema, not as user-facing warnings — keeping them out of warningRules
  //    matches the existing presentation-node pattern.
  // `strategy` has a `.default('wait_all')` so this rule only fires when the
  // user explicitly clears it (defensive — mirrors the legacy formatter).
  warningRules: [
    {
      id: 'merge:no-strategy',
      when: '!strategy',
      message: 'Merge strategy must be selected.',
    },
    // W-8: timeout / partialOnTimeout 는 schema 에 노출되어 있지만 P1 에서는
    // dormant — handler 가 warn 로그만 남기고 결과에 영향 없다. 사용자가
    // 무의식적으로 설정한 채로 두면 "barrier 가 동작한다" 고 오인할 수 있어
    // 캔버스 배지 단계에서 경고 노출.
    {
      id: 'merge:timeout-dormant',
      when: 'timeout > 0',
      message:
        'Merge timeout is dormant in Phase P1 — value is logged but no barrier is enforced. The Phase P2 barrier will honor it.',
    },
    {
      id: 'merge:partial-on-timeout-dormant',
      // mini-DSL 은 truthy 단일 변수 평가 지원 (===/!== 는 미지원).
      when: 'partialOnTimeout',
      message:
        'Merge partialOnTimeout is dormant in Phase P1 — only takes effect alongside the Phase P2 barrier.',
    },
  ],
};
