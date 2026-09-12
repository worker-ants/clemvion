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
    // 실제 커서의 id 성분은 `LoginHistory.id`(= `@PrimaryGeneratedColumn('uuid')`) 다.
    const CURSOR_UUID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

    it('returns one page with no cursor when rows ≤ limit', async () => {
      selectQb.getMany.mockResolvedValue([
        makeRow({ id: '1', createdAt: new Date('2026-05-12T00:00:00Z') }),
      ]);
      const page = await service.findForUser({ userId: 'u', limit: 10 });
      expect(page.items).toHaveLength(1);
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
      expect(page.items).toHaveLength(2);
      expect(page.nextCursor).toBe(
        `${rows[1].createdAt.toISOString()}|${rows[1].id}`,
      );
    });

    it('applies composite cursor filter when provided', async () => {
      // **fixture 가 `'cursor-id'` 였다** — `lh.id` 가 `uuid` 컬럼인데 그 값이 그대로
      // 바인딩되는 것을 이 테스트가 **정상으로 고정**하고 있었다(아래 새 케이스가 그 자리를
      // RED 로 드러냈다). 실제 커서가 갖는 형태(UUID)로 바꾼다.
      await service.findForUser({
        userId: 'u',
        cursor: `2026-05-01T00:00:00.000Z|${CURSOR_UUID}`,
        limit: 5,
      });
      expect(selectQb.andWhere).toHaveBeenCalledWith(
        '(lh.created_at, lh.id) < (:cursorTs, :cursorId)',
        expect.objectContaining({
          cursorTs: expect.any(Date),
          cursorId: CURSOR_UUID,
        }),
      );
    });

    it('[대조군] nil UUID 처럼 느슨한 형태도 통과시킨다 (엄격한 술어를 쓰면 안 되는 이유)', () => {
      // `isValidUuid`(RFC v1–v5)로 조이면 Postgres 가 **정상 조회하는** 커서를 거부하게 된다.
      // 이 케이스가 그 회귀를 고정한다 — 술어 교체 시 RED.
      return service
        .findForUser({
          userId: 'u',
          cursor:
            '2026-05-01T00:00:00.000Z|00000000-0000-0000-0000-000000000000',
        })
        .then(() => {
          expect(selectQb.andWhere).toHaveBeenCalledWith(
            '(lh.created_at, lh.id) < (:cursorTs, :cursorId)',
            expect.objectContaining({
              cursorId: '00000000-0000-0000-0000-000000000000',
            }),
          );
        });
    });

    it('caps limit at 100', async () => {
      await service.findForUser({ userId: 'u', limit: 9999 });
      expect(selectQb.take).toHaveBeenCalledWith(101); // 100 + 1
    });

    it('ignores malformed cursor and returns first page', async () => {
      await service.findForUser({ userId: 'u', cursor: 'not-a-cursor' });
      expect(selectQb.andWhere).not.toHaveBeenCalled();
    });

    it('id 성분이 UUID 가 아니면 커서를 무시한다 (22P02 → 500 마스킹 방지)', async () => {
      // `lh.id` 는 `uuid` 컬럼이라, 파싱 불가 값이 바인딩되면 Postgres 가 SQLSTATE 22P02 로
      // 거부한다. `GlobalExceptionFilter` 에는 그 분기가 없어 **500 INTERNAL_ERROR 로
      // 마스킹**된다 — 인증된 사용자가 임의로 5xx 를 만들 수 있다는 뜻이다.
      // 날짜·구분자가 잘못됐을 때와 **같은 처분**(무시하고 1페이지)으로 맞춘다.
      await service.findForUser({
        userId: 'u',
        cursor: '2026-05-01T00:00:00.000Z|not-a-uuid',
      });
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
