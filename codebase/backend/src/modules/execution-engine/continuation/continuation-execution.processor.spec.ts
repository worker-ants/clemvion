import { Test, TestingModule } from '@nestjs/testing';
import type { Job } from 'bullmq';
import { ContinuationExecutionProcessor } from './continuation-execution.processor';
import { ExecutionEngineService } from '../execution-engine.service';
import type { ContinuationJob } from '../queues/continuation-execution.queue';

/**
 * C5 — ContinuationExecutionProcessor 단위 테스트.
 *
 * 검증 범위:
 *   1. 5개 type dispatch (continue / cancel / button_click / ai_message /
 *      ai_end_conversation) 가 ExecutionEngineService 의 대응 메서드를 호출.
 *   2. type !== 'cancel' 인 경우 isNodeExecutionWaiting=false 이면 ack-and-discard
 *      (applyContinuation 호출 없음).
 *   3. cancel 은 isNodeExecutionWaiting 체크를 건너뜀.
 *   4. default exhaustiveness guard — 알 수 없는 type 은 warn 만 하고 throw 없음.
 */

function makeJob(
  data: Partial<ContinuationJob> & { type: string },
  id = 'job-1',
): Job<ContinuationJob> {
  return {
    id,
    data: {
      executionId: 'exec-1',
      nodeExecutionId: 'ne-1',
      payload: undefined,
      ...data,
    } as ContinuationJob,
  } as unknown as Job<ContinuationJob>;
}

describe('ContinuationExecutionProcessor', () => {
  let processor: ContinuationExecutionProcessor;
  let engine: jest.Mocked<
    Pick<
      ExecutionEngineService,
      | 'applyContinuation'
      | 'applyCancellation'
      | 'isNodeExecutionWaiting'
      | 'applyRetryLastTurn'
    >
  >;

  beforeEach(async () => {
    const engineMock = {
      applyContinuation: jest.fn().mockResolvedValue(undefined),
      applyCancellation: jest.fn().mockResolvedValue(undefined),
      isNodeExecutionWaiting: jest.fn().mockResolvedValue(true),
      applyRetryLastTurn: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContinuationExecutionProcessor,
        {
          provide: ExecutionEngineService,
          useValue: engineMock,
        },
      ],
    }).compile();

    processor = module.get(ContinuationExecutionProcessor);
    engine = module.get(ExecutionEngineService);
  });

  // ── idempotency guard ─────────────────────────────────────────────────────

  describe('ack-and-discard (isNodeExecutionWaiting=false)', () => {
    it.each([
      'continue',
      'button_click',
      'ai_message',
      'ai_end_conversation',
    ] as const)(
      'type=%s — ack-and-discard when nodeExec already COMPLETED/FAILED',
      async (type) => {
        engine.isNodeExecutionWaiting.mockResolvedValueOnce(false);
        await processor.process(makeJob({ type }));
        expect(engine.applyContinuation).not.toHaveBeenCalled();
        expect(engine.applyCancellation).not.toHaveBeenCalled();
      },
    );

    it('cancel skips isNodeExecutionWaiting check entirely', async () => {
      await processor.process(makeJob({ type: 'cancel' }));
      expect(engine.isNodeExecutionWaiting).not.toHaveBeenCalled();
      expect(engine.applyCancellation).toHaveBeenCalledWith('exec-1');
    });
  });

  // ── dispatch table ────────────────────────────────────────────────────────

  describe('continue dispatch', () => {
    it('calls applyContinuation with executionId, nodeExecutionId, payload', async () => {
      const payload = { type: 'form_submitted', formData: { answer: 42 } };
      await processor.process(makeJob({ type: 'continue', payload }));
      expect(engine.applyContinuation).toHaveBeenCalledWith(
        'exec-1',
        'ne-1',
        payload,
      );
    });

    it('passes undefined payload when absent', async () => {
      await processor.process(
        makeJob({ type: 'continue', payload: undefined }),
      );
      expect(engine.applyContinuation).toHaveBeenCalledWith(
        'exec-1',
        'ne-1',
        undefined,
      );
    });
  });

  describe('cancel dispatch', () => {
    it('calls applyCancellation with executionId (await — Phase B PR-B1: async)', async () => {
      await processor.process(makeJob({ type: 'cancel' }));
      expect(engine.applyCancellation).toHaveBeenCalledWith('exec-1');
    });
  });

  describe('button_click dispatch', () => {
    it('calls applyContinuation with button_click payload wrapping buttonId', async () => {
      await processor.process(
        makeJob({ type: 'button_click', payload: { buttonId: 'btn-yes' } }),
      );
      expect(engine.applyContinuation).toHaveBeenCalledWith('exec-1', 'ne-1', {
        type: 'button_click',
        buttonId: 'btn-yes',
      });
    });

    it('buttonId is undefined when payload omits it', async () => {
      await processor.process(makeJob({ type: 'button_click', payload: {} }));
      expect(engine.applyContinuation).toHaveBeenCalledWith('exec-1', 'ne-1', {
        type: 'button_click',
        buttonId: undefined,
      });
    });
  });

  describe('ai_message dispatch', () => {
    it('calls applyContinuation with ai_message payload wrapping message', async () => {
      await processor.process(
        makeJob({
          type: 'ai_message',
          payload: { message: 'hello world' },
        }),
      );
      expect(engine.applyContinuation).toHaveBeenCalledWith('exec-1', 'ne-1', {
        type: 'ai_message',
        message: 'hello world',
      });
    });

    it('message is undefined when payload omits it', async () => {
      await processor.process(makeJob({ type: 'ai_message', payload: {} }));
      expect(engine.applyContinuation).toHaveBeenCalledWith('exec-1', 'ne-1', {
        type: 'ai_message',
        message: undefined,
      });
    });
  });

  describe('ai_end_conversation dispatch', () => {
    it('calls applyContinuation with ai_end_conversation payload', async () => {
      await processor.process(makeJob({ type: 'ai_end_conversation' }));
      expect(engine.applyContinuation).toHaveBeenCalledWith('exec-1', 'ne-1', {
        type: 'ai_end_conversation',
      });
    });
  });

  // ── retry_last_turn dispatch (spec WS §4.2 worker handoff) ───────────────
  describe('retry_last_turn dispatch', () => {
    it('calls applyRetryLastTurn with the spawned nodeExecutionId from payload', async () => {
      await processor.process(
        makeJob({
          type: 'retry_last_turn',
          nodeExecutionId: 'ne-spawned',
          payload: { spawnedNodeExecutionId: 'ne-spawned' },
        }),
      );
      expect(engine.applyRetryLastTurn).toHaveBeenCalledWith(
        'exec-1',
        'ne-spawned',
      );
      expect(engine.applyContinuation).not.toHaveBeenCalled();
    });

    it('falls back to job.nodeExecutionId when payload omits spawnedNodeExecutionId', async () => {
      await processor.process(
        makeJob({ type: 'retry_last_turn', nodeExecutionId: 'ne-spawned' }),
      );
      expect(engine.applyRetryLastTurn).toHaveBeenCalledWith(
        'exec-1',
        'ne-spawned',
      );
    });

    it('bypasses isNodeExecutionWaiting guard (spawned row is RUNNING, not WAITING)', async () => {
      // even when the guard would report not-waiting, retry must still proceed.
      engine.isNodeExecutionWaiting.mockResolvedValueOnce(false);
      await processor.process(
        makeJob({
          type: 'retry_last_turn',
          payload: { spawnedNodeExecutionId: 'ne-spawned' },
        }),
      );
      expect(engine.isNodeExecutionWaiting).not.toHaveBeenCalled();
      expect(engine.applyRetryLastTurn).toHaveBeenCalled();
    });
  });

  // ── exhaustiveness guard ─────────────────────────────────────────────────

  describe('default exhaustiveness guard', () => {
    it('unknown type emits logger.warn and does not throw', async () => {
      // 'string' type in makeJob already accepts arbitrary values for
      // exhaustiveness testing without a cast.
      const job = makeJob({ type: 'unknown_future_type' });
      engine.isNodeExecutionWaiting.mockResolvedValueOnce(true);
      await expect(processor.process(job)).resolves.not.toThrow();
      expect(engine.applyContinuation).not.toHaveBeenCalled();
      expect(engine.applyCancellation).not.toHaveBeenCalled();
    });
  });

  // ── Phase 3.1 — retry 율 / dead-letter 가시성 ─────────────────────────────
  describe('onFailed (retry-rate 로깅)', () => {
    function failJob(
      attemptsMade: number,
      attempts: number,
    ): Job<ContinuationJob> {
      return {
        id: 'job-x',
        data: { type: 'continue', executionId: 'e1', nodeExecutionId: 'ne1' },
        attemptsMade,
        opts: { attempts },
      } as unknown as Job<ContinuationJob>;
    }

    function warnSpy(): jest.SpyInstance {
      return jest
        .spyOn(
          (processor as unknown as { logger: { warn: jest.Mock } }).logger,
          'warn',
        )
        .mockImplementation(() => undefined);
    }

    it('attemptsMade < attempts → RETRY 태그로 warn', () => {
      const spy = warnSpy();
      processor.onFailed(failJob(1, 3), new Error('boom'));
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('[continuation RETRY]'),
      );
    });

    it('attemptsMade >= attempts → DEAD-LETTER 태그로 warn', () => {
      const spy = warnSpy();
      processor.onFailed(failJob(3, 3), new Error('exhausted'));
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('[continuation DEAD-LETTER]'),
      );
    });

    it('job 핸들 없음 → 안전하게 warn 후 반환 (throw 없음)', () => {
      const spy = warnSpy();
      expect(() =>
        processor.onFailed(undefined, new Error('no handle')),
      ).not.toThrow();
      expect(spy).toHaveBeenCalled();
    });
  });
});
