/**
 * ChatChannelTokenRotatorService 단위 테스트 — BullMQ scheduler 등록(onModuleInit) +
 * worker 진입(process) 위임 + 비즈니스 메서드(handleHourly) 호출만 검증.
 * 실 비즈니스 로직은 TriggersService.cleanupRotatedChatChannelTokens (별 spec) 가 담당.
 */
import type { Queue } from 'bullmq';
import { ChatChannelTokenRotatorService } from './chat-channel-token-rotator.service';
import type { TriggersService } from '../triggers/triggers.service';

function makeTriggersServiceMock(): jest.Mocked<TriggersService> {
  return {
    cleanupRotatedChatChannelTokens: jest.fn(),
  } as unknown as jest.Mocked<TriggersService>;
}

function makeQueueMock(): jest.Mocked<Queue> {
  return {
    upsertJobScheduler: jest.fn(),
    removeJobScheduler: jest.fn(),
  } as unknown as jest.Mocked<Queue>;
}

describe('ChatChannelTokenRotatorService', () => {
  it('onModuleInit 이 매시간(0 * * * *) repeatable scheduler 를 등록', async () => {
    const triggers = makeTriggersServiceMock();
    const queue = makeQueueMock();
    const svc = new ChatChannelTokenRotatorService(triggers, queue);

    await svc.onModuleInit();

    expect(queue.upsertJobScheduler).toHaveBeenCalledTimes(1);
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      'chat-channel-token-rotator-hourly',
      expect.objectContaining({ pattern: '0 * * * *' }),
      expect.objectContaining({ name: expect.any(String) }),
    );
  });

  it('onModuleInit 은 scheduler 등록 실패를 전파 — Redis 장애 시 fail-fast (부팅 거부)', async () => {
    const triggers = makeTriggersServiceMock();
    const queue = makeQueueMock();
    queue.upsertJobScheduler.mockRejectedValue(new Error('redis down'));
    const svc = new ChatChannelTokenRotatorService(triggers, queue);

    await expect(svc.onModuleInit()).rejects.toThrow('redis down');
  });

  it('process 는 handleHourly 로 위임', async () => {
    const triggers = makeTriggersServiceMock();
    triggers.cleanupRotatedChatChannelTokens.mockResolvedValue({ cleaned: 0 });
    const svc = new ChatChannelTokenRotatorService(triggers, makeQueueMock());

    await svc.process({} as never);

    expect(triggers.cleanupRotatedChatChannelTokens).toHaveBeenCalledTimes(1);
  });

  it('cleanupRotatedChatChannelTokens 호출 — cleaned > 0 시 log', async () => {
    const triggers = makeTriggersServiceMock();
    triggers.cleanupRotatedChatChannelTokens.mockResolvedValue({ cleaned: 3 });
    const svc = new ChatChannelTokenRotatorService(triggers, makeQueueMock());
    await svc.handleHourly();
    expect(triggers.cleanupRotatedChatChannelTokens).toHaveBeenCalledTimes(1);
  });

  it('cleaned = 0 시 silent', async () => {
    const triggers = makeTriggersServiceMock();
    triggers.cleanupRotatedChatChannelTokens.mockResolvedValue({ cleaned: 0 });
    const svc = new ChatChannelTokenRotatorService(triggers, makeQueueMock());
    await expect(svc.handleHourly()).resolves.toBeUndefined();
  });

  it('throw 시 swallow + 다음 시간 재시도 (재 throw 안 함)', async () => {
    const triggers = makeTriggersServiceMock();
    triggers.cleanupRotatedChatChannelTokens.mockRejectedValue(
      new Error('db down'),
    );
    const svc = new ChatChannelTokenRotatorService(triggers, makeQueueMock());
    await expect(svc.handleHourly()).resolves.toBeUndefined();
  });
});
