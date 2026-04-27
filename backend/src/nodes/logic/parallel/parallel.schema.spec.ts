import { evaluateWarnings } from '@workflow/node-summary';
import { ParallelHandler } from './parallel.handler';
import {
  parallelNodeConfigSchema,
  parallelNodeMetadata,
  validateParallelConfig,
} from './parallel.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('Parallel node', () => {
  it('스키마 기본값: branchCount=2, maxConcurrency=0, waitAll=true', () => {
    const parsed = parallelNodeConfigSchema.parse({});
    expect(parsed.branchCount).toBe(2);
    expect(parsed.maxConcurrency).toBe(0);
    expect(parsed.waitAll).toBe(true);
  });

  it('스키마: 명시적으로 값을 전달하면 그대로 유지', () => {
    const parsed = parallelNodeConfigSchema.parse({
      branchCount: 4,
      maxConcurrency: 2,
      waitAll: false,
    });
    expect(parsed.branchCount).toBe(4);
    expect(parsed.maxConcurrency).toBe(2);
    expect(parsed.waitAll).toBe(false);
  });

  it('메타데이터: type=parallel, category=logic', () => {
    expect(parallelNodeMetadata.type).toBe('parallel');
    expect(parallelNodeMetadata.category).toBe('logic');
  });

  describe('handler.validate', () => {
    const handler = new ParallelHandler();

    it('branchCount: 2~16 범위 내는 valid', () => {
      expect(handler.validate({ branchCount: 2 }).valid).toBe(true);
      expect(handler.validate({ branchCount: 16 }).valid).toBe(true);
      expect(handler.validate({ branchCount: 8 }).valid).toBe(true);
    });

    it('branchCount: 1 이하 또는 17 이상은 invalid', () => {
      expect(handler.validate({ branchCount: 1 }).valid).toBe(false);
      expect(handler.validate({ branchCount: 17 }).valid).toBe(false);
    });

    it('maxConcurrency: 0~16 범위 내는 valid (0=제한 없음)', () => {
      expect(
        handler.validate({ branchCount: 4, maxConcurrency: 0 }).valid,
      ).toBe(true);
      expect(
        handler.validate({ branchCount: 4, maxConcurrency: 1 }).valid,
      ).toBe(true);
      expect(
        handler.validate({ branchCount: 4, maxConcurrency: 16 }).valid,
      ).toBe(true);
    });

    it('maxConcurrency: 음수·17 이상·정수 아님은 invalid', () => {
      expect(
        handler.validate({ branchCount: 4, maxConcurrency: -1 }).valid,
      ).toBe(false);
      expect(
        handler.validate({ branchCount: 4, maxConcurrency: 17 }).valid,
      ).toBe(false);
      expect(
        handler.validate({ branchCount: 4, maxConcurrency: 2.5 }).valid,
      ).toBe(false);
    });

    it('maxConcurrency: undefined이면 검증 스킵 (스키마 default 적용 대상)', () => {
      expect(handler.validate({ branchCount: 4 }).valid).toBe(true);
    });

    it('waitAll: boolean 이외는 invalid', () => {
      expect(handler.validate({ branchCount: 4, waitAll: true }).valid).toBe(
        true,
      );
      expect(handler.validate({ branchCount: 4, waitAll: false }).valid).toBe(
        true,
      );
      expect(
        handler.validate({
          branchCount: 4,
          waitAll: 'yes',
        }).valid,
      ).toBe(false);
    });
  });

  describe('warningRules', () => {
    const firedIds = (config: unknown) =>
      evaluateWarnings(
        config as Record<string, unknown>,
        parallelNodeMetadata.warningRules,
      ).map((w) => w.id);

    it('parallel:branch-count-out-of-range — fires for branchCount=1', () => {
      expect(firedIds({ branchCount: 1 })).toContain(
        'parallel:branch-count-out-of-range',
      );
    });

    it('parallel:branch-count-out-of-range — fires for branchCount=17', () => {
      expect(firedIds({ branchCount: 17 })).toContain(
        'parallel:branch-count-out-of-range',
      );
    });

    it('parallel:branch-count-out-of-range — does NOT fire for in-range', () => {
      expect(firedIds({ branchCount: 4 })).not.toContain(
        'parallel:branch-count-out-of-range',
      );
    });
  });

  describe('validateParallelConfig (imperative)', () => {
    it('returns [] for a valid config', () => {
      expect(
        validateParallelConfig({
          branchCount: 4,
          maxConcurrency: 2,
          waitAll: true,
        }),
      ).toEqual([]);
    });

    it('rejects branchCount=2.5 (non-integer)', () => {
      expect(validateParallelConfig({ branchCount: 2.5 })).toContain(
        'branchCount는 정수여야 합니다.',
      );
    });

    it('rejects branchCount=1 (out of range)', () => {
      expect(validateParallelConfig({ branchCount: 1 })).toContain(
        'branchCount는 2 이상 16 이하의 값이어야 합니다.',
      );
    });

    it('rejects maxConcurrency=-1', () => {
      expect(
        validateParallelConfig({ branchCount: 4, maxConcurrency: -1 }),
      ).toContain(
        'maxConcurrency는 0 이상 16 이하의 값이어야 합니다 (0 = 제한 없음).',
      );
    });

    it('rejects waitAll being a non-boolean', () => {
      expect(
        validateParallelConfig({ branchCount: 4, waitAll: 'yes' }),
      ).toContain('waitAll는 boolean이어야 합니다.');
    });
  });

  describe('evaluateMetadataBlockingErrors integration (parallel)', () => {
    it('returns [] for the schema default config', () => {
      expect(
        evaluateMetadataBlockingErrors(
          parallelNodeMetadata,
          parallelNodeConfigSchema.parse({}),
        ),
      ).toEqual([]);
    });

    it('surfaces both declarative and imperative messages for branchCount=1', () => {
      const errors = evaluateMetadataBlockingErrors(parallelNodeMetadata, {
        branchCount: 1,
      });
      expect(errors).toContain('branchCount 는 2 이상 16 이하여야 합니다.');
      expect(errors).toContain(
        'branchCount는 2 이상 16 이하의 값이어야 합니다.',
      );
    });
  });

  describe('handler.execute', () => {
    const handler = new ParallelHandler();

    it('branchCount만큼 branch_N 포트를 모두 활성화', async () => {
      const result = await handler.execute(
        { hello: 'world' },
        { branchCount: 3 },
      );
      expect(result.output).toEqual({ hello: 'world' });
      expect(result.port).toEqual(['branch_0', 'branch_1', 'branch_2']);
    });

    it('config 에 maxConcurrency/waitAll 정규화 값을 포함', async () => {
      const result = await handler.execute(
        {},
        { branchCount: 4, maxConcurrency: 2, waitAll: true },
      );
      expect(result.config).toEqual({
        branchCount: 4,
        maxConcurrency: 2,
        waitAll: true,
      });
    });

    it('branchCount 누락 시 기본 2', async () => {
      const result = await handler.execute({ x: 1 }, {});
      expect(result.port).toEqual(['branch_0', 'branch_1']);
    });

    it('16 초과 값은 16으로 클램프', async () => {
      const result = await handler.execute({}, { branchCount: 100 });
      expect(Array.isArray(result.port) ? result.port.length : 0).toBe(16);
    });

    it('maxConcurrency 음수·초과 값은 0..16 으로 클램프', async () => {
      const result = await handler.execute(
        {},
        { branchCount: 4, maxConcurrency: 100 },
      );
      expect(result.config.maxConcurrency).toBe(16);
      const result2 = await handler.execute(
        {},
        { branchCount: 4, maxConcurrency: -3 },
      );
      expect(result2.config.maxConcurrency).toBe(0);
    });
  });
});
