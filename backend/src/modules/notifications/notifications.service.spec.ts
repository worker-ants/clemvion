import { NotFoundException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { NotificationsService } from './notifications.service';

/**
 * Unit tests for NotificationsService dismiss 도입.
 *
 * spec/data-flow/8-notifications.md §4 (Dismiss 흐름) 가 명시한 동작을
 * repository mock 으로 회귀 잠근다 — 실 DB 동작은 e2e 가 책임.
 *
 * 회귀 포인트:
 *   - findAll / getUnreadCount 가 `dismissed_at IS NULL` 을 적용한다.
 *   - dismiss(id, userId) 가 멱등하다 (이미 dismissed 면 기존 시각 반환).
 *   - dismiss 가 본인 소유 아닌 알림에 404 를 던진다.
 *   - dismissAll 이 `dismissed_at IS NULL` AND workspace + user 매칭 row 만 갱신.
 *   - hasRecentByResource 는 dismissed 필터를 **적용하지 않는다** (over-noise 방지 § 4.4).
 */
describe('NotificationsService — dismiss', () => {
  let service: NotificationsService;
  let repo: {
    createQueryBuilder: jest.Mock;
    count: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
  };

  // helper — chainable QB stub returning a value at the end
  function makeQb(
    finalCount: number,
    finalRows: unknown[],
    updateAffected = 0,
  ): any {
    const qb: any = {
      where: jest.fn(() => qb),
      andWhere: jest.fn(() => qb),
      orderBy: jest.fn(() => qb),
      skip: jest.fn(() => qb),
      take: jest.fn(() => qb),
      getCount: jest.fn().mockResolvedValue(finalCount),
      getMany: jest.fn().mockResolvedValue(finalRows),
      update: jest.fn(() => qb),
      set: jest.fn(() => qb),
      execute: jest.fn().mockResolvedValue({ affected: updateAffected }),
    };
    return qb;
  }

  beforeEach(() => {
    repo = {
      createQueryBuilder: jest.fn(),
      count: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
    };
    service = new NotificationsService(repo as any);
  });

  describe('findAll — dismissed_at IS NULL 필터', () => {
    it('WHERE 절에 dismissed_at IS NULL 을 추가한다', async () => {
      const qb = makeQb(0, []);
      repo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll('ws-1', 'user-1', {} as any);

      // andWhere 호출 중 dismissed_at IS NULL 인자가 있어야 한다
      const filterCalls = qb.andWhere.mock.calls.map((c: unknown[]) => c[0]);
      expect(filterCalls).toContain('n.dismissed_at IS NULL');
    });
  });

  describe('getUnreadCount — dismissed_at IS NULL 필터', () => {
    it('count where 절에 dismissedAt: IsNull() 을 포함한다', async () => {
      repo.count.mockResolvedValue(3);

      const result = await service.getUnreadCount('ws-1', 'user-1');

      expect(repo.count).toHaveBeenCalledTimes(1);
      const where = repo.count.mock.calls[0][0].where;
      expect(where).toEqual(
        expect.objectContaining({
          workspaceId: 'ws-1',
          userId: 'user-1',
          isRead: false,
          dismissedAt: IsNull(),
        }),
      );
      expect(result).toEqual({ count: 3 });
    });
  });

  describe('dismiss — 단건', () => {
    it('visible 알림을 dismissed 로 전환하고 시각을 반환한다', async () => {
      const fixedDate = new Date('2026-05-17T12:00:00Z');
      jest.useFakeTimers().setSystemTime(fixedDate);

      const notif = {
        id: 'notif-1',
        userId: 'user-1',
        dismissedAt: null,
      };
      repo.findOne.mockResolvedValue(notif);
      repo.save.mockImplementation(async (n: any) => n);

      const result = await service.dismiss('notif-1', 'user-1');

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 'notif-1', userId: 'user-1' },
      });
      expect(notif.dismissedAt).toEqual(fixedDate);
      expect(result).toEqual({ id: 'notif-1', dismissedAt: fixedDate });

      jest.useRealTimers();
    });

    it('멱등 — 이미 dismissed 면 기존 시각을 그대로 반환 (save 호출 없음)', async () => {
      const existingTime = new Date('2026-05-10T09:00:00Z');
      const notif = {
        id: 'notif-2',
        userId: 'user-1',
        dismissedAt: existingTime,
      };
      repo.findOne.mockResolvedValue(notif);

      const result = await service.dismiss('notif-2', 'user-1');

      expect(result).toEqual({ id: 'notif-2', dismissedAt: existingTime });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('본인 소유 아닌 알림 (또는 미존재) 은 NotFoundException', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.dismiss('notif-x', 'user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('dismissAll — 일괄', () => {
    it('workspace + user + dismissed_at IS NULL 만 갱신하고 affected 반환', async () => {
      const qb = makeQb(0, [], 5);
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.dismissAll('ws-1', 'user-1');

      expect(qb.where).toHaveBeenCalledWith('workspace_id = :workspaceId', {
        workspaceId: 'ws-1',
      });
      const andWhereArgs = qb.andWhere.mock.calls.map((c: unknown[]) => c[0]);
      expect(andWhereArgs).toContain('user_id = :userId');
      expect(andWhereArgs).toContain('dismissed_at IS NULL');
      expect(result).toEqual({ affected: 5 });
    });

    it('affected 가 undefined 이면 0 으로 정규화', async () => {
      const qb = makeQb(0, []);
      qb.execute.mockResolvedValue({ affected: undefined });
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.dismissAll('ws-1', 'user-1');
      expect(result).toEqual({ affected: 0 });
    });
  });

  describe('hasRecentByResource — dismissed row 포함 (회귀)', () => {
    it('count where 절에 dismissed_at 필터를 포함하지 않는다', async () => {
      repo.count.mockResolvedValue(1);

      await service.hasRecentByResource({
        workspaceId: 'ws-1',
        type: 'integration_action_required',
        resourceId: 'int-1',
        title: 'Integration disconnected',
        withinMs: 86_400_000,
      });

      const where = repo.count.mock.calls[0][0].where;
      // dismissedAt 키 자체가 없어야 한다 — dismissed row 도 counted.
      expect(where).not.toHaveProperty('dismissedAt');
      // 다른 필터는 있다 — spec §4.4 sanity
      expect(where).toEqual(
        expect.objectContaining({
          workspaceId: 'ws-1',
          type: 'integration_action_required',
          resourceId: 'int-1',
          title: 'Integration disconnected',
          createdAt: expect.any(Object), // MoreThanOrEqual(...)
        }),
      );
    });
  });
});
