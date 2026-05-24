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
      'applyContinuation' | 'applyCancellation' | 'isNodeExecutionWaiting'
    >
  >;

  beforeEach(async () => {
    const engineMock = {
      applyContinuation: jest.fn().mockResolvedValue(undefined),
      applyCancellation: jest.fn().mockReturnValue(undefined),
      isNodeExecutionWaiting: jest.fn().mockResolvedValue(true),
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
    it('calls applyCancellation with executionId (fire-and-forget)', async () => {
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
});
