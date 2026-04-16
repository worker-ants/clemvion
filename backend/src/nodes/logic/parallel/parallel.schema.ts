import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const parallelNodeConfigSchema = z
  .object({
    branchCount: z
      .number()
      .int()
      .min(2)
      .max(16)
      .default(2)
      .meta({
        ui: {
          label: 'Branch Count',
          widget: 'number',
          hint: '동시에 실행할 분기 수 (2~16)',
        },
      }),
  })
  .passthrough();
export type ParallelConfig = z.infer<typeof parallelNodeConfigSchema>;

// 정적 출력 포트는 없음 — branchCount에 따라 frontend가 `branch_0` ~ `branch_{N-1}` 동적 생성
export const parallelNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [],
};

export const parallelNodeMetadata: NodeComponentMetadata = {
  type: 'parallel',
  category: 'logic',
  label: 'Parallel',
  description: 'Run N branches concurrently with the same input',
  icon: 'Split',
  color: '#3B82F6',
};
