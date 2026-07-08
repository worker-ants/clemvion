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
    update: jest.Mock;
  };
  let userRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
  };
  let mail: { sendNotificationEmail: jest.Mock };
  let ws: { emitNotificationEvent: jest.Mock };
  let moduleRefMock: { get: jest.Mock };

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
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    userRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    mail = { sendNotificationEmail: jest.fn().mockResolvedValue(undefined) };
    ws = { emitNotificationEvent: jest.fn() };
    // NotificationsService 는 WebsocketService 를 ModuleRef(strict:false) 로 지연 해석.
    moduleRefMock = { get: jest.fn().mockReturnValue(ws) };
    service = new NotificationsService(
      repo as any,
      userRepo as any,
      moduleRefMock as any,
      mail as any,
    );
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

  describe('dismiss — 단건 (atomic UPDATE)', () => {
    it('visible 알림을 dismissed 로 전환하고 ISO 시각을 반환한다', async () => {
      const fixedDate = new Date('2026-05-17T12:00:00Z');
      const qb = makeQb(0, [], 1);
      qb.returning = jest.fn(() => qb);
      qb.execute = jest.fn().mockResolvedValue({
        affected: 1,
        raw: [{ id: 'notif-1', dismissed_at: fixedDate }],
      });
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.dismiss('notif-1', 'user-1');

      expect(qb.where).toHaveBeenCalledWith('id = :id', { id: 'notif-1' });
      const andWhereArgs = qb.andWhere.mock.calls.map((c: unknown[]) => c[0]);
      expect(andWhereArgs).toContain('user_id = :userId');
      expect(andWhereArgs).toContain('dismissed_at IS NULL');
      expect(result).toEqual({
        id: 'notif-1',
        dismissedAt: fixedDate.toISOString(),
      });
      expect(repo.findOne).not.toHaveBeenCalled();
    });

    it('멱등 — 이미 dismissed 면 (affected=0) findOne 으로 기존 시각 회수', async () => {
      const existingTime = new Date('2026-05-10T09:00:00Z');
      const qb = makeQb(0, [], 0);
      qb.returning = jest.fn(() => qb);
      qb.execute = jest.fn().mockResolvedValue({ affected: 0, raw: [] });
      repo.createQueryBuilder.mockReturnValue(qb);
      repo.findOne.mockResolvedValue({
        id: 'notif-2',
        userId: 'user-1',
        dismissedAt: existingTime,
      });

      const result = await service.dismiss('notif-2', 'user-1');

      expect(result).toEqual({
        id: 'notif-2',
        dismissedAt: existingTime.toISOString(),
      });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('본인 소유 아닌 알림 (또는 미존재) 은 NotFoundException', async () => {
      const qb = makeQb(0, [], 0);
      qb.returning = jest.fn(() => qb);
      qb.execute = jest.fn().mockResolvedValue({ affected: 0, raw: [] });
      repo.createQueryBuilder.mockReturnValue(qb);
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

  describe('notify — 단일 적재 + WS emit (spec §1)', () => {
    it('INSERT 후 저장된 row 로 notification.new emit 하고 saved 를 반환', async () => {
      repo.create.mockImplementation((v: unknown) => ({ ...(v as object) }));
      const saved = {
        id: 'notif-1',
        userId: 'user-1',
        type: 'execution_failed',
        title: 'Workflow failed',
        message: 'run xyz failed',
        resourceType: 'execution',
        resourceId: 'exec-9',
      };
      repo.save.mockResolvedValue(saved);

      const result = await service.notify({
        workspaceId: 'ws-1',
        userId: 'user-1',
        type: 'execution_failed',
        title: 'Workflow failed',
        message: 'run xyz failed',
        resourceType: 'execution',
        resourceId: 'exec-9',
      });

      expect(repo.save).toHaveBeenCalledTimes(1);
      // 저장된 row(생성된 id 포함)의 값으로 emit — 입력이 아니라 saved 기준.
      expect(ws.emitNotificationEvent).toHaveBeenCalledTimes(1);
      expect(ws.emitNotificationEvent).toHaveBeenCalledWith('user-1', {
        id: 'notif-1',
        type: 'execution_failed',
        title: 'Workflow failed',
        message: 'run xyz failed',
        resourceType: 'execution',
        resourceId: 'exec-9',
      });
      expect(result).toBe(saved);
    });

    it('resource attribution 이 없으면 emit payload 의 resource* 는 null', async () => {
      repo.create.mockImplementation((v: unknown) => ({ ...(v as object) }));
      repo.save.mockResolvedValue({
        id: 'notif-2',
        userId: 'user-2',
        type: 'team_invite',
        title: 'Invited',
        message: 'welcome',
        resourceType: null,
        resourceId: null,
      });

      await service.notify({
        workspaceId: 'ws-1',
        userId: 'user-2',
        type: 'team_invite',
        title: 'Invited',
        message: 'welcome',
      });

      expect(ws.emitNotificationEvent).toHaveBeenCalledWith('user-2', {
        id: 'notif-2',
        type: 'team_invite',
        title: 'Invited',
        message: 'welcome',
        resourceType: null,
        resourceId: null,
      });
    });
  });

  describe('findByBackgroundRun — background_run_id 기준 attribution (V107)', () => {
    it('background_run_id WHERE + createdAt ASC 로 조회한다', async () => {
      const rows = [{ id: 'n1', type: 'background_failed' }];
      repo.find.mockResolvedValue(rows);

      const result = await service.findByBackgroundRun('bg-run-1');

      expect(repo.find).toHaveBeenCalledWith({
        where: { backgroundRunId: 'bg-run-1' },
        order: { createdAt: 'ASC' },
      });
      expect(result).toBe(rows);
    });
  });

  describe('backgroundRunId attribution 세팅 (V107)', () => {
    it('notify — backgroundRunId 를 딥링크(resource*)와 함께 저장 row 에 반영', async () => {
      repo.create.mockImplementation((v: unknown) => ({ ...(v as object) }));
      let savedRow: any;
      repo.save.mockImplementation((r: any) => {
        savedRow = r;
        return Promise.resolve({ id: 'n1', ...r });
      });

      await service.notify({
        workspaceId: 'ws-1',
        userId: 'user-1',
        type: 'background_failed',
        title: 't',
        message: 'm',
        resourceType: 'workflow',
        resourceId: 'wf-1',
        backgroundRunId: 'bg-run-1',
      });

      expect(savedRow.resourceType).toBe('workflow');
      expect(savedRow.resourceId).toBe('wf-1');
      expect(savedRow.backgroundRunId).toBe('bg-run-1');
    });

    it('createMany — 엔트리별 backgroundRunId 반영, 부재 시 미설정', async () => {
      repo.create.mockImplementation((v: unknown) => ({ ...(v as object) }));
      let savedRows: any[] = [];
      repo.save.mockImplementation((rows: any[]) => {
        savedRows = rows;
        return Promise.resolve(rows.map((r, i) => ({ id: `n${i}`, ...r })));
      });

      await service.createMany([
        {
          workspaceId: 'ws-1',
          userId: 'u1',
          type: 'background_failed',
          title: 't',
          message: 'm',
          resourceType: 'workflow',
          resourceId: 'wf-1',
          backgroundRunId: 'bg-1',
        },
        {
          workspaceId: 'ws-1',
          userId: 'u2',
          type: 'execution_failed',
          title: 't',
          message: 'm',
          resourceType: 'workflow',
          resourceId: 'wf-1',
        },
      ]);

      expect(savedRows[0].backgroundRunId).toBe('bg-1');
      expect(savedRows[1].backgroundRunId).toBeUndefined();
    });
  });

  describe('createMany — 저장 후 per-row WS emit (spec §1·§2.2)', () => {
    it('빈 배열은 no-op — save·emit 모두 미호출', async () => {
      await service.createMany([]);
      expect(repo.save).not.toHaveBeenCalled();
      expect(ws.emitNotificationEvent).not.toHaveBeenCalled();
    });

    it('저장된 각 row 에 대해 notification.new emit', async () => {
      repo.create.mockImplementation((v: unknown) => ({ ...(v as object) }));
      repo.save.mockResolvedValue([
        {
          id: 'n-1',
          userId: 'user-a',
          type: 'background_failed',
          title: 'A',
          message: 'ma',
          resourceType: 'execution',
          resourceId: 'e-1',
        },
        {
          id: 'n-2',
          userId: 'user-b',
          type: 'background_failed',
          title: 'B',
          message: 'mb',
          resourceType: undefined,
          resourceId: undefined,
        },
      ]);

      await service.createMany([
        {
          workspaceId: 'ws-1',
          userId: 'user-a',
          type: 'background_failed',
          title: 'A',
          message: 'ma',
          resourceType: 'execution',
          resourceId: 'e-1',
        },
        {
          workspaceId: 'ws-1',
          userId: 'user-b',
          type: 'background_failed',
          title: 'B',
          message: 'mb',
        },
      ]);

      expect(ws.emitNotificationEvent).toHaveBeenCalledTimes(2);
      expect(ws.emitNotificationEvent).toHaveBeenNthCalledWith(1, 'user-a', {
        id: 'n-1',
        type: 'background_failed',
        title: 'A',
        message: 'ma',
        resourceType: 'execution',
        resourceId: 'e-1',
      });
      expect(ws.emitNotificationEvent).toHaveBeenNthCalledWith(2, 'user-b', {
        id: 'n-2',
        type: 'background_failed',
        title: 'B',
        message: 'mb',
        resourceType: null,
        resourceId: null,
      });
    });
  });

  describe('getWebsocket — ModuleRef 지연 해석 계약 (회귀)', () => {
    it('WebsocketService 를 strict:false 로 해석하고 1회 캐시한다', async () => {
      repo.create.mockImplementation((v: unknown) => ({ ...(v as object) }));
      repo.save.mockResolvedValue({
        id: 'n',
        userId: 'u',
        type: 't',
        title: 'a',
        message: 'm',
        resourceType: null,
        resourceId: null,
      });

      await service.notify({
        workspaceId: 'ws',
        userId: 'u',
        type: 't',
        title: 'a',
        message: 'm',
      });
      await service.notify({
        workspaceId: 'ws',
        userId: 'u',
        type: 't',
        title: 'a',
        message: 'm',
      });

      // strict:false 전역 조회 — 모듈 import 없이 앱 컨텍스트에서 해석.
      expect(moduleRefMock.get).toHaveBeenCalledWith(expect.anything(), {
        strict: false,
      });
      // 캐시 — 두 번 emit 해도 해석은 1회.
      expect(moduleRefMock.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('emit best-effort 격리 (회귀 — WARNING #2)', () => {
    it('ModuleRef.get 이 throw 해도 notify 는 reject 하지 않고 saved 를 반환', async () => {
      repo.create.mockImplementation((v: unknown) => ({ ...(v as object) }));
      const saved = {
        id: 'n-1',
        userId: 'u',
        type: 't',
        title: 'a',
        message: 'm',
        resourceType: null,
        resourceId: null,
      };
      repo.save.mockResolvedValue(saved);
      moduleRefMock.get.mockImplementation(() => {
        throw new Error('WebsocketService not resolvable');
      });

      // 적재(save)는 이미 커밋 — emit 해석 실패가 호출자에 전파되면 안 된다.
      await expect(
        service.notify({
          workspaceId: 'ws',
          userId: 'u',
          type: 't',
          title: 'a',
          message: 'm',
        }),
      ).resolves.toBe(saved);
    });

    it('createMany 도 ModuleRef.get throw 를 삼켜 reject 하지 않는다', async () => {
      repo.create.mockImplementation((v: unknown) => ({ ...(v as object) }));
      repo.save.mockResolvedValue([
        {
          id: 'n-1',
          userId: 'u',
          type: 't',
          title: 'a',
          message: 'm',
          resourceType: null,
          resourceId: null,
        },
      ]);
      moduleRefMock.get.mockImplementation(() => {
        throw new Error('WebsocketService not resolvable');
      });

      await expect(
        service.createMany([
          {
            workspaceId: 'ws',
            userId: 'u',
            type: 't',
            title: 'a',
            message: 'm',
          },
        ]),
      ).resolves.toBeUndefined();
    });
  });

  describe('이메일 발송 + email_sent_at (PR2, spec §1·§2.2·§3)', () => {
    function savedRow(over: Partial<any> = {}) {
      return {
        id: 'n-1',
        userId: 'u-1',
        type: 'execution_failed',
        title: 'Workflow failed',
        message: 'run failed',
        resourceType: null,
        resourceId: null,
        channel: 'in_app',
        ...over,
      };
    }

    it("channel='in_app' 이면 이메일 미발송 (user 조회·발송 모두 skip)", async () => {
      repo.create.mockImplementation((v: unknown) => ({ ...(v as object) }));
      repo.save.mockResolvedValue(savedRow({ channel: 'in_app' }));

      await service.notify({
        workspaceId: 'ws',
        userId: 'u-1',
        type: 'execution_failed',
        title: 'Workflow failed',
        message: 'run failed',
      });

      expect(userRepo.find).not.toHaveBeenCalled();
      expect(mail.sendNotificationEmail).not.toHaveBeenCalled();
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("channel='email' 이면 발송 후 email_sent_at UPDATE", async () => {
      repo.create.mockImplementation((v: unknown) => ({ ...(v as object) }));
      repo.save.mockResolvedValue(savedRow({ channel: 'email' }));
      userRepo.find.mockResolvedValue([{ id: 'u-1', email: 'u1@x.com' }]);

      await service.notify({
        workspaceId: 'ws',
        userId: 'u-1',
        type: 'execution_failed',
        title: 'Workflow failed',
        message: 'run failed',
        channel: 'email',
      });

      expect(mail.sendNotificationEmail).toHaveBeenCalledWith('u1@x.com', {
        title: 'Workflow failed',
        message: 'run failed',
        type: 'execution_failed',
      });
      expect(repo.update).toHaveBeenCalledWith(
        'n-1',
        expect.objectContaining({ emailSentAt: expect.any(Date) }),
      );
    });

    it('createMany — email/both row 만 발송, user email 은 In() 배치 조회', async () => {
      repo.create.mockImplementation((v: unknown) => ({ ...(v as object) }));
      repo.save.mockResolvedValue([
        savedRow({ id: 'n-1', userId: 'u-1', channel: 'both' }),
        savedRow({ id: 'n-2', userId: 'u-2', channel: 'in_app' }),
        savedRow({ id: 'n-3', userId: 'u-3', channel: 'email' }),
      ]);
      userRepo.find.mockResolvedValue([
        { id: 'u-1', email: 'u1@x.com' },
        { id: 'u-3', email: 'u3@x.com' },
      ]);

      await service.createMany([
        {
          workspaceId: 'ws',
          userId: 'u-1',
          type: 't',
          title: 'a',
          message: 'm',
          channel: 'both',
        },
        {
          workspaceId: 'ws',
          userId: 'u-2',
          type: 't',
          title: 'a',
          message: 'm',
        },
        {
          workspaceId: 'ws',
          userId: 'u-3',
          type: 't',
          title: 'a',
          message: 'm',
          channel: 'email',
        },
      ]);

      // email/both(u-1,u-3) 만 발송, in_app(u-2) 제외. user 조회는 1회 배치.
      expect(userRepo.find).toHaveBeenCalledTimes(1);
      const inValue = (userRepo.find.mock.calls[0][0] as any).where.id._value;
      expect(inValue).toEqual(['u-1', 'u-3']);
      expect(mail.sendNotificationEmail).toHaveBeenCalledTimes(2);
      expect(repo.update).toHaveBeenCalledWith('n-1', expect.any(Object));
      expect(repo.update).toHaveBeenCalledWith('n-3', expect.any(Object));
      expect(repo.update).not.toHaveBeenCalledWith('n-2', expect.any(Object));
    });

    it('createMany — 동일 userId 다중 email 알림 모두 해당 이메일로 발송', async () => {
      repo.create.mockImplementation((v: unknown) => ({ ...(v as object) }));
      repo.save.mockResolvedValue([
        savedRow({ id: 'n-1', userId: 'u-1', channel: 'email', title: 'a' }),
        savedRow({ id: 'n-2', userId: 'u-1', channel: 'both', title: 'b' }),
      ]);
      // In(userIds) 는 u-1 하나로 dedup 되지만 두 알림 모두 발송돼야 한다.
      userRepo.find.mockResolvedValue([{ id: 'u-1', email: 'u1@x.com' }]);

      await service.createMany([
        {
          workspaceId: 'ws',
          userId: 'u-1',
          type: 't',
          title: 'a',
          message: 'm',
          channel: 'email',
        },
        {
          workspaceId: 'ws',
          userId: 'u-1',
          type: 't',
          title: 'b',
          message: 'm',
          channel: 'both',
        },
      ]);

      expect(userRepo.find).toHaveBeenCalledTimes(1);
      expect((userRepo.find.mock.calls[0][0] as any).where.id._value).toEqual([
        'u-1',
      ]);
      expect(mail.sendNotificationEmail).toHaveBeenCalledTimes(2);
      expect(mail.sendNotificationEmail).toHaveBeenNthCalledWith(
        1,
        'u1@x.com',
        expect.objectContaining({ title: 'a' }),
      );
      expect(mail.sendNotificationEmail).toHaveBeenNthCalledWith(
        2,
        'u1@x.com',
        expect.objectContaining({ title: 'b' }),
      );
      expect(repo.update).toHaveBeenCalledWith('n-1', expect.any(Object));
      expect(repo.update).toHaveBeenCalledWith('n-2', expect.any(Object));
    });

    it('createMany — 배치 중 1건 발송 실패 시 나머지는 계속 (부분 실패 격리)', async () => {
      repo.create.mockImplementation((v: unknown) => ({ ...(v as object) }));
      repo.save.mockResolvedValue([
        savedRow({ id: 'n-1', userId: 'u-1', channel: 'email' }),
        savedRow({ id: 'n-2', userId: 'u-2', channel: 'email' }),
      ]);
      userRepo.find.mockResolvedValue([
        { id: 'u-1', email: 'u1@x.com' },
        { id: 'u-2', email: 'u2@x.com' },
      ]);
      // u-1 발송 실패, u-2 성공.
      mail.sendNotificationEmail.mockImplementation((to: string) =>
        to === 'u1@x.com'
          ? Promise.reject(new Error('SMTP down'))
          : Promise.resolve(undefined),
      );

      await expect(
        service.createMany([
          {
            workspaceId: 'ws',
            userId: 'u-1',
            type: 't',
            title: 'a',
            message: 'm',
            channel: 'email',
          },
          {
            workspaceId: 'ws',
            userId: 'u-2',
            type: 't',
            title: 'a',
            message: 'm',
            channel: 'email',
          },
        ]),
      ).resolves.toBeUndefined();

      // 실패한 n-1 은 email_sent_at 미갱신, 성공한 n-2 만 갱신.
      expect(repo.update).not.toHaveBeenCalledWith('n-1', expect.any(Object));
      expect(repo.update).toHaveBeenCalledWith('n-2', expect.any(Object));
    });

    it('발송 실패 시 warn 만 — email_sent_at 미갱신, notify 는 reject 안 함', async () => {
      repo.create.mockImplementation((v: unknown) => ({ ...(v as object) }));
      repo.save.mockResolvedValue(savedRow({ channel: 'email' }));
      userRepo.find.mockResolvedValue([{ id: 'u-1', email: 'u1@x.com' }]);
      mail.sendNotificationEmail.mockRejectedValue(new Error('SMTP down'));

      await expect(
        service.notify({
          workspaceId: 'ws',
          userId: 'u-1',
          type: 'execution_failed',
          title: 'Workflow failed',
          message: 'run failed',
          channel: 'email',
        }),
      ).resolves.toBeDefined();

      expect(repo.update).not.toHaveBeenCalled();
    });

    it('user email 이 없으면 발송 skip (email_sent_at 미갱신)', async () => {
      repo.create.mockImplementation((v: unknown) => ({ ...(v as object) }));
      repo.save.mockResolvedValue(savedRow({ channel: 'email' }));
      userRepo.find.mockResolvedValue([]); // 사용자 삭제 등

      await service.notify({
        workspaceId: 'ws',
        userId: 'u-1',
        type: 'execution_failed',
        title: 'Workflow failed',
        message: 'run failed',
        channel: 'email',
      });

      expect(mail.sendNotificationEmail).not.toHaveBeenCalled();
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('user email 이 빈 문자열이면 발송 skip (!email 가드)', async () => {
      repo.create.mockImplementation((v: unknown) => ({ ...(v as object) }));
      repo.save.mockResolvedValue(savedRow({ channel: 'email' }));
      userRepo.find.mockResolvedValue([{ id: 'u-1', email: '' }]);

      await service.notify({
        workspaceId: 'ws',
        userId: 'u-1',
        type: 'execution_failed',
        title: 'Workflow failed',
        message: 'run failed',
        channel: 'email',
      });

      expect(mail.sendNotificationEmail).not.toHaveBeenCalled();
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("notify channel='both' — 이메일 발송 + WS emit 둘 다 (단건 경로)", async () => {
      repo.create.mockImplementation((v: unknown) => ({ ...(v as object) }));
      repo.save.mockResolvedValue(savedRow({ channel: 'both' }));
      userRepo.find.mockResolvedValue([{ id: 'u-1', email: 'u1@x.com' }]);

      await service.notify({
        workspaceId: 'ws',
        userId: 'u-1',
        type: 'execution_failed',
        title: 'Workflow failed',
        message: 'run failed',
        channel: 'both',
      });

      expect(ws.emitNotificationEvent).toHaveBeenCalledTimes(1);
      expect(mail.sendNotificationEmail).toHaveBeenCalledWith('u1@x.com', {
        title: 'Workflow failed',
        message: 'run failed',
        type: 'execution_failed',
      });
      expect(repo.update).toHaveBeenCalledWith('n-1', expect.any(Object));
    });

    it('notify channel 생략(default in_app) — 이메일 미발송', async () => {
      repo.create.mockImplementation((v: unknown) => ({ ...(v as object) }));
      // channel 미지정 → default 'in_app' (create 가 채움) → dispatch 대상 아님.
      repo.save.mockResolvedValue(savedRow({ channel: 'in_app' }));

      await service.notify({
        workspaceId: 'ws',
        userId: 'u-1',
        type: 'execution_failed',
        title: 'Workflow failed',
        message: 'run failed',
      });

      expect(userRepo.find).not.toHaveBeenCalled();
      expect(mail.sendNotificationEmail).not.toHaveBeenCalled();
    });

    it('발송은 성공하나 email_sent_at UPDATE 가 throw — warn 만, notify reject 안 함', async () => {
      repo.create.mockImplementation((v: unknown) => ({ ...(v as object) }));
      const saved = savedRow({ channel: 'email' });
      repo.save.mockResolvedValue(saved);
      userRepo.find.mockResolvedValue([{ id: 'u-1', email: 'u1@x.com' }]);
      mail.sendNotificationEmail.mockResolvedValue(undefined);
      repo.update.mockRejectedValue(new Error('db down'));

      await expect(
        service.notify({
          workspaceId: 'ws',
          userId: 'u-1',
          type: 'execution_failed',
          title: 'Workflow failed',
          message: 'run failed',
          channel: 'email',
        }),
      ).resolves.toBe(saved);
      expect(mail.sendNotificationEmail).toHaveBeenCalledTimes(1);
    });

    it('userRepo.find 가 throw 해도 dispatch 는 삼켜 notify 를 reject 안 함', async () => {
      repo.create.mockImplementation((v: unknown) => ({ ...(v as object) }));
      const saved = savedRow({ channel: 'email' });
      repo.save.mockResolvedValue(saved);
      userRepo.find.mockRejectedValue(new Error('db down'));

      await expect(
        service.notify({
          workspaceId: 'ws',
          userId: 'u-1',
          type: 'execution_failed',
          title: 'Workflow failed',
          message: 'run failed',
          channel: 'email',
        }),
      ).resolves.toBe(saved);
    });
  });

  describe('알림 설정 (§6.2) — getSettings / updateSettings / resolveOptOutEmailChannels', () => {
    it('getSettings — prefs 없으면 타입별 기본값 해소 (integration off/opt-in, failures on/opt-out)', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'u-1',
        notificationPreferences: {},
      });
      const s = await service.getSettings('u-1');
      expect(s).toEqual({
        integrationExpiryEmail: false,
        executionFailedEmail: true,
        scheduleFailedEmail: true,
      });
    });

    it('getSettings — 저장된 값이 기본값보다 우선', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'u-1',
        notificationPreferences: {
          integrationExpiryEmail: true,
          executionFailedEmail: false,
        },
      });
      const s = await service.getSettings('u-1');
      expect(s).toMatchObject({
        integrationExpiryEmail: true,
        executionFailedEmail: false,
        scheduleFailedEmail: true, // 미설정 → 기본 on
      });
    });

    it('updateSettings — 제공 키만 머지(다른 키 보존) 후 해소값 반환', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'u-1',
        notificationPreferences: { integrationExpiryEmail: true },
      });
      const s = await service.updateSettings('u-1', {
        executionFailedEmail: false,
      });
      expect(userRepo.update).toHaveBeenCalledWith('u-1', {
        notificationPreferences: {
          integrationExpiryEmail: true,
          executionFailedEmail: false,
        },
      });
      expect(s).toMatchObject({
        integrationExpiryEmail: true, // 보존
        executionFailedEmail: false, // 갱신
        scheduleFailedEmail: true,
      });
    });

    it('updateSettings — 사용자 없으면 NotFound', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.updateSettings('nope', {})).rejects.toThrow();
    });

    it('resolveOptOutEmailChannels — pref false → in_app, 아니면 both, 미조회 사용자는 map 부재', async () => {
      userRepo.find.mockResolvedValue([
        { id: 'a', notificationPreferences: { executionFailedEmail: false } },
        { id: 'b', notificationPreferences: {} },
      ]);
      const map = await service.resolveOptOutEmailChannels(
        ['a', 'b', 'c'],
        'executionFailedEmail',
      );
      expect(map.get('a')).toBe('in_app');
      expect(map.get('b')).toBe('both');
      expect(map.has('c')).toBe(false); // 미조회 → 호출부가 ?? 'both' 폴백
    });

    it('resolveOptOutEmailChannels — 빈 배열이면 조회 없이 빈 map', async () => {
      const map = await service.resolveOptOutEmailChannels(
        [],
        'scheduleFailedEmail',
      );
      expect(map.size).toBe(0);
      expect(userRepo.find).not.toHaveBeenCalled();
    });
  });
});
