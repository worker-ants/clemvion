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
    // 기본값 0 (CLE-T-AGDM92): 값이 0 보다 크면 아래 dormant 경고가 차단(blocking)으로
    // 평가된다. 기본값이 경고를 켜면 새 노드 · 가져온 노드가 실행 전 검증에서 막힌다.
    timeout: z
      .number()
      .int()
      .nonnegative()
      .default(0)
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
    // W-8: timeout / partialOnTimeout 는 schema 에 남아 있지만 동작하지 않는다
    // (dormant). 엔진은 모든 선행 노드가 끝난 뒤에 Merge 를 실행하고, fan-in
    // barrier 는 CLE-NODE-MERGE Rationale «비동기 fan-in barrier 활성화를 재검토
    // 과제로 미룬다 (2026-07-17)» 로 무기한 미뤘다. handler 는
    // warn 로그만 남기고 결과에 영향이 없다. 값을 둔 채로 두면 "barrier 가
    // 동작한다" 고 오인할 수 있어 캔버스 배지와 실행 전 검증에서 막는다
    // (severity 생략 = blocking, REQ-MERGE-016).
    {
      id: 'merge:timeout-dormant',
      when: 'timeout > 0',
      message:
        'Merge timeout has no effect — Merge runs only after every connected input has finished, so there is nothing to wait for. Set it to 0.',
    },
    {
      id: 'merge:partial-on-timeout-dormant',
      // mini-DSL 은 truthy 단일 변수 평가 지원 (===/!== 는 미지원).
      when: 'partialOnTimeout',
      message:
        'Merge partialOnTimeout has no effect — Merge never times out, so there are no partial inputs to merge. Turn it off.',
    },
  ],
};
