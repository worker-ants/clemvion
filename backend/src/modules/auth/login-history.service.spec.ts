import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LoginHistory } from './entities/login-history.entity';
import { LoginHistoryService } from './login-history.service';

interface SelectQB {
  where: jest.Mock;
  andWhere: jest.Mock;
  orderBy: jest.Mock;
  addOrderBy: jest.Mock;
  take: jest.Mock;
  select: jest.Mock;
  limit: jest.Mock;
  getMany: jest.Mock;
  getQuery: jest.Mock;
  getParameters: jest.Mock;
}

interface DeleteQB {
  delete: jest.Mock;
  from: jest.Mock;
  where: jest.Mock;
  setParameters: jest.Mock;
  execute: jest.Mock;
}

describe('LoginHistoryService', () => {
  let service: LoginHistoryService;
  let selectQb: SelectQB;
  let deleteQb: DeleteQB;
  let repo: {
    create: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  beforeEach(async () => {
    selectQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getQuery: jest.fn().mockReturnValue('SELECT lh.id FROM login_history lh'),
      getParameters: jest.fn().mockReturnValue({ cutoff: new Date() }),
    };
    deleteQb = {
      delete: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      setParameters: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    repo = {
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockImplementation((alias?: string) =>
        // delete 쿼리는 alias 없이, select 는 alias 'lh' 로 호출
        alias ? selectQb : deleteQb,
      ),
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
      selectQb.getMany.mockResolvedValue([
        makeRow({ id: '1', createdAt: new Date('2026-05-12T00:00:00Z') }),
      ]);
      const page = await service.findForUser({ userId: 'u', limit: 10 });
      expect(page.data).toHaveLength(1);
      expect(page.nextCursor).toBeNull();
    });

    it('returns composite cursor when more rows exist', async () => {
      const rows = [
        makeRow({ id: 'r1', createdAt: new Date('2026-05-12T00:00:00Z') }),
        makeRow({ id: 'r2', createdAt: new Date('2026-05-11T00:00:00Z') }),
        makeRow({ id: 'r3', createdAt: new Date('2026-05-10T00:00:00Z') }),
      ];
      selectQb.getMany.mockResolvedValue(rows);
      const page = await service.findForUser({ userId: 'u', limit: 2 });
      expect(page.data).toHaveLength(2);
      expect(page.nextCursor).toBe(
        `${rows[1].createdAt.toISOString()}|${rows[1].id}`,
      );
    });

    it('applies composite cursor filter when provided', async () => {
      await service.findForUser({
        userId: 'u',
        cursor: '2026-05-01T00:00:00.000Z|cursor-id',
        limit: 5,
      });
      expect(selectQb.andWhere).toHaveBeenCalledWith(
        '(lh.created_at, lh.id) < (:cursorTs, :cursorId)',
        expect.objectContaining({
          cursorTs: expect.any(Date),
          cursorId: 'cursor-id',
        }),
      );
    });

    it('caps limit at 100', async () => {
      await service.findForUser({ userId: 'u', limit: 9999 });
      expect(selectQb.take).toHaveBeenCalledWith(101); // 100 + 1
    });

    it('ignores malformed cursor and returns first page', async () => {
      await service.findForUser({ userId: 'u', cursor: 'not-a-cursor' });
      expect(selectQb.andWhere).not.toHaveBeenCalled();
    });
  });

  describe('pruneOlderThanRetention', () => {
    it('returns 0 when no rows are older than retention', async () => {
      deleteQb.execute.mockResolvedValueOnce({ affected: 0 });
      const removed = await service.pruneOlderThanRetention();
      expect(removed).toBe(0);
      expect(deleteQb.execute).toHaveBeenCalledTimes(1);
    });

    it('sums batches and stops when a batch returns < PRUNE_BATCH', async () => {
      deleteQb.execute
        .mockResolvedValueOnce({ affected: 1000 })
        .mockResolvedValueOnce({ affected: 1000 })
        .mockResolvedValueOnce({ affected: 250 });
      const removed = await service.pruneOlderThanRetention();
      expect(removed).toBe(2250);
      expect(deleteQb.execute).toHaveBeenCalledTimes(3);
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
