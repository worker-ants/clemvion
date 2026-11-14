import type { QueueEvents } from 'bullmq';
import { MakeshopModule } from './makeshop.module';
import type { IntegrationsService } from '../../../modules/integrations/integrations.service';
import type { MakeshopApiClient } from './makeshop-api.client';

/**
 * CLE-T-7H7VET 회귀 테스트. 유휴 상태 종료에서 QueueEvents close 가 바로 끝나면 종료 훅도 grace 타이머를 남기지
 * 않고 끝나야 한다. 예전 구현은 타이머를 남겨 SIGTERM 종료가 늘 31초 늦어졌다.
 */
describe('MakeshopModule.onApplicationShutdown', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('유휴 상태에서 QueueEvents 를 닫고 grace 타이머를 남기지 않는다', async () => {
    const queueEvents = { close: jest.fn().mockResolvedValue(undefined) };
    const module = new MakeshopModule(
      queueEvents as unknown as QueueEvents,
      {} as IntegrationsService,
      {} as MakeshopApiClient,
    );

    await module.onApplicationShutdown();

    expect(queueEvents.close).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
});
