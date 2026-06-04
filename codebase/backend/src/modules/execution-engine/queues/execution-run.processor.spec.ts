import { Test } from '@nestjs/testing';
import type { Job } from 'bullmq';
import { ExecutionRunProcessor } from './execution-run.processor';
import { ExecutionEngineService } from '../execution-engine.service';
import type { ExecutionRunJob } from './execution-run.queue';

describe('ExecutionRunProcessor', () => {
  let processor: ExecutionRunProcessor;
  let engine: { runExecutionFromQueue: jest.Mock };

  beforeEach(async () => {
    engine = { runExecutionFromQueue: jest.fn().mockResolvedValue(undefined) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ExecutionRunProcessor,
        { provide: ExecutionEngineService, useValue: engine },
      ],
    }).compile();
    processor = moduleRef.get(ExecutionRunProcessor);
  });

  const job = (data: ExecutionRunJob): Job<ExecutionRunJob> =>
    ({
      id: data.executionId,
      data,
      attemptsMade: 0,
      opts: {},
    }) as unknown as Job<ExecutionRunJob>;

  it('process() 는 engine.runExecutionFromQueue 에 executionId + input 위임', async () => {
    await processor.process(job({ executionId: 'exec-1', input: { a: 1 } }));
    expect(engine.runExecutionFromQueue).toHaveBeenCalledWith('exec-1', {
      a: 1,
    });
  });

  it('process() 는 engine 위임 결과를 그대로 반환 (throw 안 하면 ack)', async () => {
    await expect(
      processor.process(job({ executionId: 'exec-2' })),
    ).resolves.toBeUndefined();
  });

  it('engine.runExecutionFromQueue 가 throw 하면 전파 (BullMQ 가 dead-letter 처리)', async () => {
    engine.runExecutionFromQueue.mockRejectedValueOnce(new Error('setup boom'));
    await expect(
      processor.process(job({ executionId: 'exec-3' })),
    ).rejects.toThrow('setup boom');
  });

  it('onFailed 는 job 핸들 없어도 throw 하지 않는다', () => {
    expect(() =>
      processor.onFailed(undefined, new Error('no handle')),
    ).not.toThrow();
  });

  // SUMMARY#11 — job 핸들 있는 경우의 onFailed 로그 경로 + opts.attempts undefined fallback
  describe('onFailed — job 핸들 있는 경우', () => {
    it('executionId·jobId·시도 횟수 포함 DEAD-LETTER 경고 로그 출력', () => {
      const warnSpy = jest
        .spyOn(
          (processor as unknown as { logger: { warn: jest.Mock } }).logger,
          'warn',
        )
        .mockImplementation(() => undefined);
      const j = job({ executionId: 'exec-dead', input: {} });
      processor.onFailed(j, new Error('crash'));
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[execution-run DEAD-LETTER]'),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('exec-dead'),
      );
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('crash'));
      warnSpy.mockRestore();
    });

    it('job.opts?.attempts 가 undefined 이면 EXECUTION_RUN_QUEUE_DEFAULT_OPTS.attempts 로 fallback', () => {
      const warnSpy = jest
        .spyOn(
          (processor as unknown as { logger: { warn: jest.Mock } }).logger,
          'warn',
        )
        .mockImplementation(() => undefined);
      // opts.attempts 를 undefined 로 명시
      const j = {
        id: 'exec-opts-undef',
        data: { executionId: 'exec-opts-undef', input: {} },
        attemptsMade: 1,
        opts: { attempts: undefined },
      } as unknown as Parameters<typeof processor.onFailed>[0];
      processor.onFailed(j, new Error('opts-undef'));
      // fallback: EXECUTION_RUN_QUEUE_DEFAULT_OPTS.attempts = 1 → "1/1"
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('1/1'));
      warnSpy.mockRestore();
    });
  });
});
