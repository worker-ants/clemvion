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
});
