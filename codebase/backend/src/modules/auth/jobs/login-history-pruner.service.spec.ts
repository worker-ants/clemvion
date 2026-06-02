import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import {
  LoginHistoryPrunerService,
  LOGIN_HISTORY_PRUNER_QUEUE,
} from './login-history-pruner.service';
import { LoginHistoryService } from '../login-history.service';

describe('LoginHistoryPrunerService', () => {
  let service: LoginHistoryPrunerService;
  let loginHistory: jest.Mocked<LoginHistoryService>;
  let queue: { upsertJobScheduler: jest.Mock; removeJobScheduler: jest.Mock };

  beforeEach(async () => {
    queue = {
      upsertJobScheduler: jest.fn(),
      removeJobScheduler: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginHistoryPrunerService,
        {
          provide: LoginHistoryService,
          useValue: { pruneOlderThanRetention: jest.fn() },
        },
        {
          provide: getQueueToken(LOGIN_HISTORY_PRUNER_QUEUE),
          useValue: queue,
        },
      ],
    }).compile();

    service = module.get(LoginHistoryPrunerService);
    loginHistory = module.get(LoginHistoryService);
  });

  it('onModuleInit 이 매일 03:00 Asia/Seoul repeatable scheduler 를 등록', async () => {
    await service.onModuleInit();

    expect(queue.upsertJobScheduler).toHaveBeenCalledTimes(1);
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      'login-history-pruner-daily',
      expect.objectContaining({ pattern: '0 3 * * *', tz: 'Asia/Seoul' }),
      expect.objectContaining({ name: expect.any(String) }),
    );
  });

  it('process 는 prune 으로 위임', async () => {
    loginHistory.pruneOlderThanRetention.mockResolvedValue(0);

    await service.process({} as never);

    expect(loginHistory.pruneOlderThanRetention).toHaveBeenCalledTimes(1);
  });

  it('logs nothing when 0 rows removed', async () => {
    loginHistory.pruneOlderThanRetention.mockResolvedValue(0);
    const logSpy = jest.spyOn((service as any).logger, 'log');

    await service.prune();

    expect(loginHistory.pruneOlderThanRetention).toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('logs an info line when rows are removed', async () => {
    loginHistory.pruneOlderThanRetention.mockResolvedValue(42);
    const logSpy = jest.spyOn((service as any).logger, 'log');

    await service.prune();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('42'));
  });

  it('swallows errors and logs them so the scheduled job never crashes the process', async () => {
    loginHistory.pruneOlderThanRetention.mockRejectedValue(
      new Error('db down'),
    );
    const errSpy = jest.spyOn((service as any).logger, 'error');

    await expect(service.prune()).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('db down'));
  });
});
