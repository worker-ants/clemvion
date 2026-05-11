import { Test, TestingModule } from '@nestjs/testing';
import { LoginHistoryPrunerService } from './login-history-pruner.service';
import { LoginHistoryService } from '../login-history.service';

describe('LoginHistoryPrunerService', () => {
  let service: LoginHistoryPrunerService;
  let loginHistory: jest.Mocked<LoginHistoryService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginHistoryPrunerService,
        {
          provide: LoginHistoryService,
          useValue: { pruneOlderThanRetention: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(LoginHistoryPrunerService);
    loginHistory = module.get(LoginHistoryService);
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

  it('swallows errors and logs them so the cron job never crashes the process', async () => {
    loginHistory.pruneOlderThanRetention.mockRejectedValue(
      new Error('db down'),
    );
    const errSpy = jest.spyOn((service as any).logger, 'error');

    await expect(service.prune()).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('db down'));
  });
});
