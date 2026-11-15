import type { QueueEvents } from 'bullmq';
import { Cafe24Module } from './cafe24.module';
import type { IntegrationsService } from '../../../modules/integrations/integrations.service';
import type { Cafe24ApiClient } from './cafe24-api.client';

/**
 * CLE-T-7H7VET 회귀 테스트. 유휴 상태 종료에서 QueueEvents close 가 바로 끝나면 종료 훅도 grace 타이머를 남기지
 * 않고 끝나야 한다. 예전 구현은 타이머를 남겨 SIGTERM 종료가 늘 31초 늦어졌다.
 */
describe('Cafe24Module.onApplicationShutdown', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('유휴 상태에서 QueueEvents 를 닫고 grace 타이머를 남기지 않는다', async () => {
    const queueEvents = { close: jest.fn().mockResolvedValue(undefined) };
    const module = new Cafe24Module(
      queueEvents as unknown as QueueEvents,
      {} as IntegrationsService,
      {} as Cafe24ApiClient,
    );

    await module.onApplicationShutdown();

    expect(queueEvents.close).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
});
