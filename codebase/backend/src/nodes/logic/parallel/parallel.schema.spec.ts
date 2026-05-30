import { evaluateWarnings } from '@workflow/node-summary';
import { ParallelHandler } from './parallel.handler';
import {
  parallelNodeConfigSchema,
  parallelNodeMetadata,
  validateParallelConfig,
} from './parallel.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';
import { createEmptyConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';

describe('Parallel node', () => {
  it('스키마 기본값: branchCount=2, maxConcurrency=0, waitAll=true, errorPolicy=stop', () => {
    const parsed = parallelNodeConfigSchema.parse({});
    expect(parsed.branchCount).toBe(2);
    expect(parsed.maxConcurrency).toBe(0);
    expect(parsed.waitAll).toBe(true);
    // W-7
    expect(parsed.errorPolicy).toBe('stop');
  });

  it('스키마: 명시적으로 값을 전달하면 그대로 유지 (zod 단계는 boolean 만 검증 — waitAll=false 는 validateParallelConfig 에서 reject. 결정 K-5: 옛 워크플로우 마이그레이션 호환성 위해 zod 는 그대로)', () => {
    const parsed = parallelNodeConfigSchema.parse({
      branchCount: 4,
      maxConcurrency: 2,
      waitAll: false,
      errorPolicy: 'continue',
    });
    expect(parsed.branchCount).toBe(4);
    expect(parsed.maxConcurrency).toBe(2);
    expect(parsed.waitAll).toBe(false);
    expect(parsed.errorPolicy).toBe('continue');
  });

  it('스키마: errorPolicy 가 enum 외 값이면 reject (W-7)', () => {
    expect(() =>
      parallelNodeConfigSchema.parse({ errorPolicy: 'silly' }),
    ).toThrow();
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

    it('waitAll=true 만 valid, false 와 non-boolean 모두 invalid (결정 K)', () => {
      expect(handler.validate({ branchCount: 4, waitAll: true }).valid).toBe(
        true,
      );
      // 결정 K (2026-05-30): waitAll=false 지원 spec out
      expect(handler.validate({ branchCount: 4, waitAll: false }).valid).toBe(
        false,
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
        'branchCount must be an integer.',
      );
    });

    it('rejects branchCount=1 (out of range)', () => {
      expect(validateParallelConfig({ branchCount: 1 })).toContain(
        'branchCount must be a value between 2 and 16.',
      );
    });

    it('rejects maxConcurrency=-1', () => {
      expect(
        validateParallelConfig({ branchCount: 4, maxConcurrency: -1 }),
      ).toContain(
        'maxConcurrency must be a value between 0 and 16 (0 = unlimited).',
      );
    });

    it('rejects waitAll being a non-boolean', () => {
      expect(
        validateParallelConfig({ branchCount: 4, waitAll: 'yes' }),
      ).toContain('waitAll must be a boolean.');
    });

    it('rejects errorPolicy 외 값 (W-7)', () => {
      expect(
        validateParallelConfig({ branchCount: 2, errorPolicy: 'panic' }),
      ).toContain("errorPolicy must be 'stop' or 'continue'.");
    });

    it('errorPolicy=stop / continue 는 통과 (W-7)', () => {
      expect(
        validateParallelConfig({ branchCount: 2, errorPolicy: 'stop' }),
      ).toEqual([]);
      expect(
        validateParallelConfig({ branchCount: 2, errorPolicy: 'continue' }),
      ).toEqual([]);
    });

    it('rejects waitAll=false (결정 K, 2026-05-30 — spec out)', () => {
      expect(
        validateParallelConfig({ branchCount: 2, waitAll: false }),
      ).toContain(
        'waitAll=false is not supported. Use waitAll=true (default) or the Background node for fire-and-forget semantics.',
      );
    });

    it('waitAll=true / 미지정 (default) 는 통과 (결정 K)', () => {
      expect(validateParallelConfig({ branchCount: 2, waitAll: true })).toEqual(
        [],
      );
      expect(validateParallelConfig({ branchCount: 2 })).toEqual([]);
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
      expect(errors).toContain('branchCount must be 2 to 16.');
      expect(errors).toContain('branchCount must be a value between 2 and 16.');
    });
  });

  describe('handler.execute', () => {
    const handler = new ParallelHandler();
    const ctx = {
      executionId: 'exec-1',
      workflowId: 'wf-1',
      variables: {},
      nodeOutputCache: {},
      structuredOutputCache: {},
      engineResolvedConfigCache: {},
      conversationThread: createEmptyConversationThread(),
      recursionDepth: 0,
    };

    it('branchCount만큼 branch_N 포트를 모두 활성화 + output: null (Principle 9 컨테이너 컨트랙트)', async () => {
      const result = await handler.execute(
        { hello: 'world' },
        { branchCount: 3 },
        ctx,
      );
      // CONVENTIONS Principle 9: 컨테이너 핸들러는 시작 시점에 `output: null`
      // 을 반환하고, 엔진이 완료 시점에 `{ branches: [...] }` 로 오버라이트한다
      // (loop/foreach/map 과 동일 패턴).
      expect(result.output).toBeNull();
      expect(result.port).toEqual(['branch_0', 'branch_1', 'branch_2']);
    });

    it('config 에 maxConcurrency/waitAll 정규화 값을 포함', async () => {
      const result = await handler.execute(
        {},
        { branchCount: 4, maxConcurrency: 2, waitAll: true },
        ctx,
      );
      expect(result.config).toEqual({
        branchCount: 4,
        maxConcurrency: 2,
        waitAll: true,
      });
    });

    it('branchCount 누락 시 기본 2', async () => {
      const result = await handler.execute({ x: 1 }, {}, ctx);
      expect(result.port).toEqual(['branch_0', 'branch_1']);
    });

    it('16 초과 값은 16으로 클램프', async () => {
      const result = await handler.execute({}, { branchCount: 100 }, ctx);
      expect(Array.isArray(result.port) ? result.port.length : 0).toBe(16);
    });

    it('maxConcurrency 음수·초과 값은 raw 그대로 echo (clamping 은 engine 내부)', async () => {
      // CONVENTIONS Principle 7 — config echoes the raw user input. The 0..16
      // clamping policy is an engine-side branch-count concern; observable
      // clamping is via `result.port.length` (always 2..16) rather than the
      // echoed config field.
      const result = await handler.execute(
        {},
        { branchCount: 4, maxConcurrency: 100 },
        ctx,
      );
      expect(result.config.maxConcurrency).toBe(100);
      const result2 = await handler.execute(
        {},
        { branchCount: 4, maxConcurrency: -3 },
        ctx,
      );
      expect(result2.config.maxConcurrency).toBe(-3);
    });
  });
});
