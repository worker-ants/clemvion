import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LoginHistory } from './entities/login-history.entity';
import { LoginHistoryService } from './login-history.service';

describe('LoginHistoryService', () => {
  let service: LoginHistoryService;
  let repo: {
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let queryBuilder: {
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    take: jest.Mock;
    getMany: jest.Mock;
  };

  beforeEach(async () => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    repo = {
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginHistoryService,
        { provide: getRepositoryToken(LoginHistory), useValue: repo },
      ],
    }).compile();

    service = module.get(LoginHistoryService);
  });

  describe('record', () => {
    it('writes a row with deviceLabel derived from userAgent', async () => {
      await service.record({
        userId: 'u1',
        email: 'a@b.c',
        event: 'login_success',
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          email: 'a@b.c',
          event: 'login_success',
          deviceLabel: 'Chrome on macOS',
          userAgent: expect.any(String),
        }),
      );
      expect(repo.save).toHaveBeenCalled();
    });

    it('swallows save errors so auth flow continues', async () => {
      repo.save.mockRejectedValueOnce(new Error('db down'));
      await expect(
        service.record({ userId: 'u', email: 'a@b', event: 'login_failed' }),
      ).resolves.toBeUndefined();
    });

    it('records anonymous failure with userId=null', async () => {
      await service.record({
        userId: null,
        email: 'ghost@example.com',
        event: 'login_failed',
        failureReason: 'USER_NOT_FOUND',
      });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: null,
          failureReason: 'USER_NOT_FOUND',
          deviceLabel: null,
        }),
      );
    });
  });

  describe('findForUser', () => {
    it('returns one page with no cursor when rows ≤ limit', async () => {
      const now = new Date('2026-05-12T00:00:00Z');
      queryBuilder.getMany.mockResolvedValue([
        makeRow({ id: '1', createdAt: now }),
      ]);
      const page = await service.findForUser({ userId: 'u', limit: 10 });
      expect(page.data).toHaveLength(1);
      expect(page.nextCursor).toBeNull();
    });

    it('returns nextCursor when more rows exist', async () => {
      const dates = [
        new Date('2026-05-12T00:00:00Z'),
        new Date('2026-05-11T00:00:00Z'),
        new Date('2026-05-10T00:00:00Z'),
      ];
      queryBuilder.getMany.mockResolvedValue(
        dates.map((createdAt, i) => makeRow({ id: String(i), createdAt })),
      );
      const page = await service.findForUser({ userId: 'u', limit: 2 });
      expect(page.data).toHaveLength(2);
      expect(page.nextCursor).toBe(dates[1].toISOString());
    });

    it('applies cursor filter when provided', async () => {
      await service.findForUser({
        userId: 'u',
        cursor: '2026-05-01T00:00:00.000Z',
        limit: 5,
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'lh.created_at < :cursor',
        expect.objectContaining({ cursor: expect.any(Date) }),
      );
    });

    it('caps limit at 100', async () => {
      await service.findForUser({ userId: 'u', limit: 9999 });
      expect(queryBuilder.take).toHaveBeenCalledWith(101); // 100 + 1
    });
  });

  describe('pruneOlderThanRetention', () => {
    it('deletes rows older than 180 days and returns affected count', async () => {
      repo.delete.mockResolvedValueOnce({ affected: 7 });
      const now = new Date('2026-05-12T00:00:00Z');
      const result = await service.pruneOlderThanRetention(now);
      expect(result).toBe(7);
      const arg = repo.delete.mock.calls[0][0] as { createdAt: unknown };
      expect(arg.createdAt).toBeDefined();
    });
  });
});

function makeRow(over: Partial<LoginHistory> = {}): LoginHistory {
  return {
    id: 'lh-id',
    userId: 'u',
    user: null,
    email: 'a@b.c',
    event: 'login_success',
    ipAddress: null,
    userAgent: null,
    deviceLabel: null,
    familyId: null,
    failureReason: null,
    createdAt: new Date(),
    ...over,
  } as LoginHistory;
}
