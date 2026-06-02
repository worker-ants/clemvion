/**
 * NotificationSecretRotatorService 단위 테스트 — BullMQ scheduler 등록(onModuleInit) +
 * worker 진입(process) 위임 + 비즈니스 메서드(handleHourly) 호출만 검증.
 * 실 비즈니스 로직은 TriggersService.promoteRotatedNotificationSecrets (별 spec) 가 담당.
 */
import type { Queue } from 'bullmq';
import { NotificationSecretRotatorService } from './notification-secret-rotator.service';
import type { TriggersService } from './triggers.service';

function makeTriggersServiceMock(): jest.Mocked<TriggersService> {
  return {
    promoteRotatedNotificationSecrets: jest.fn(),
  } as unknown as jest.Mocked<TriggersService>;
}

function makeQueueMock(): jest.Mocked<Queue> {
  return {
    upsertJobScheduler: jest.fn(),
    removeJobScheduler: jest.fn(),
  } as unknown as jest.Mocked<Queue>;
}

describe('NotificationSecretRotatorService', () => {
  it('onModuleInit 이 매시간(0 * * * *) repeatable scheduler 를 등록', async () => {
    const triggers = makeTriggersServiceMock();
    const queue = makeQueueMock();
    const svc = new NotificationSecretRotatorService(triggers, queue);

    await svc.onModuleInit();

    expect(queue.upsertJobScheduler).toHaveBeenCalledTimes(1);
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      'notification-secret-rotator-hourly',
      expect.objectContaining({ pattern: '0 * * * *' }),
      expect.objectContaining({ name: expect.any(String) }),
    );
  });

  it('onModuleInit 은 scheduler 등록 실패를 전파 — Redis 장애 시 fail-fast (부팅 거부)', async () => {
    const triggers = makeTriggersServiceMock();
    const queue = makeQueueMock();
    queue.upsertJobScheduler.mockRejectedValue(new Error('redis down'));
    const svc = new NotificationSecretRotatorService(triggers, queue);

    await expect(svc.onModuleInit()).rejects.toThrow('redis down');
  });

  it('process 는 handleHourly 로 위임', async () => {
    const triggers = makeTriggersServiceMock();
    triggers.promoteRotatedNotificationSecrets.mockResolvedValue({
      promoted: 0,
    });
    const svc = new NotificationSecretRotatorService(triggers, makeQueueMock());

    await svc.process({} as never);

    expect(triggers.promoteRotatedNotificationSecrets).toHaveBeenCalledTimes(1);
  });

  it('promoted > 0 시 log', async () => {
    const triggers = makeTriggersServiceMock();
    triggers.promoteRotatedNotificationSecrets.mockResolvedValue({
      promoted: 2,
    });
    const svc = new NotificationSecretRotatorService(triggers, makeQueueMock());
    const logSpy = jest.spyOn((svc as any).logger, 'log');

    await svc.handleHourly();

    expect(triggers.promoteRotatedNotificationSecrets).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('2'));
  });

  it('promoted = 0 시 silent', async () => {
    const triggers = makeTriggersServiceMock();
    triggers.promoteRotatedNotificationSecrets.mockResolvedValue({
      promoted: 0,
    });
    const svc = new NotificationSecretRotatorService(triggers, makeQueueMock());
    const logSpy = jest.spyOn((svc as any).logger, 'log');

    await expect(svc.handleHourly()).resolves.toBeUndefined();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('throw 시 swallow + 다음 시간 재시도 (재 throw 안 함)', async () => {
    const triggers = makeTriggersServiceMock();
    triggers.promoteRotatedNotificationSecrets.mockRejectedValue(
      new Error('db down'),
    );
    const svc = new NotificationSecretRotatorService(triggers, makeQueueMock());
    await expect(svc.handleHourly()).resolves.toBeUndefined();
  });
});
