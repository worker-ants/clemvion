import { ParallelHandler } from '../../../modules/execution-engine/handlers/logic/parallel.handler';
import {
  parallelNodeConfigSchema,
  parallelNodeMetadata,
} from './parallel.schema';

describe('Parallel node', () => {
  it('스키마 기본값으로 branchCount=2', () => {
    const parsed = parallelNodeConfigSchema.parse({});
    expect(parsed.branchCount).toBe(2);
  });

  it('메타데이터: type=parallel, category=logic', () => {
    expect(parallelNodeMetadata.type).toBe('parallel');
    expect(parallelNodeMetadata.category).toBe('logic');
  });

  describe('handler', () => {
    const handler = new ParallelHandler();

    it('검증: 2~16 범위 내는 valid', () => {
      expect(handler.validate({ branchCount: 2 }).valid).toBe(true);
      expect(handler.validate({ branchCount: 16 }).valid).toBe(true);
      expect(handler.validate({ branchCount: 8 }).valid).toBe(true);
    });

    it('검증: 1 이하 또는 17 이상은 invalid', () => {
      expect(handler.validate({ branchCount: 1 }).valid).toBe(false);
      expect(handler.validate({ branchCount: 17 }).valid).toBe(false);
    });

    it('execute: branchCount만큼 branch_N 포트를 모두 활성화', async () => {
      const result = await handler.execute(
        { hello: 'world' },
        { branchCount: 3 },
      );
      expect(result.output).toEqual({ hello: 'world' });
      expect(result.port).toEqual(['branch_0', 'branch_1', 'branch_2']);
    });

    it('execute: branchCount 누락 시 기본 2', async () => {
      const result = await handler.execute({ x: 1 }, {});
      expect(result.port).toEqual(['branch_0', 'branch_1']);
    });

    it('execute: 16 초과 값은 16으로 클램프', async () => {
      const result = await handler.execute({}, { branchCount: 100 });
      expect(Array.isArray(result.port) ? result.port.length : 0).toBe(16);
    });
  });
});
