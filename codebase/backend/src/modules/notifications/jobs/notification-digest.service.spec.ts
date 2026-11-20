import {
  NotificationDigestService,
  type DigestRow,
} from './notification-digest.service';
import {
  DIGEST_ITEMS_PER_WORKSPACE,
  DIGEST_TYPES,
  NOTIFICATION_DIGEST_QUEUE,
} from './notification-digest.constants';
import { PRODUCT_DEFAULT_TIMEZONE } from '../../../common/utils/timezone';

/**
 * 일일 요약 메일 (CLE-OBS-NOTIFY-SETTINGS 「일일 요약」, CLE-T-BAXAN4).
 */
describe('NotificationDigestService', () => {
  const NOW = new Date('2026-11-20T00:00:00Z'); // 09:00 Asia/Seoul
  const FROM = new Date('2026-11-19T00:00:00Z');

  let userQb: {
    select: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    limit: jest.Mock;
    getMany: jest.Mock;
  };
  let userRepo: { createQueryBuilder: jest.Mock };
  let notificationRepo: { query: jest.Mock };
  let mail: { sendDailyDigestEmail: jest.Mock };
  let queue: { upsertJobScheduler: jest.Mock };
  let service: NotificationDigestService;

  function row(p: Partial<DigestRow>): DigestRow {
    return {
      user_id: 'u-1',
      workspace_id: 'ws-1',
      workspace_name: 'Alpha',
      type: 'execution_failed',
      title: 't',
      created_at: new Date('2026-11-19T12:00:00Z'),
      workspace_total: 1,
      ...p,
    };
  }

  beforeEach(() => {
    userQb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    userRepo = { createQueryBuilder: jest.fn().mockReturnValue(userQb) };
    notificationRepo = { query: jest.fn().mockResolvedValue([]) };
    mail = { sendDailyDigestEmail: jest.fn().mockResolvedValue(undefined) };
    queue = { upsertJobScheduler: jest.fn().mockResolvedValue(undefined) };
    service = new NotificationDigestService(
      userRepo as any,
      notificationRepo as any,
      mail as any,
      queue as any,
    );
  });

  it('매일 09:00 제품 기본 시간대로 반복 작업을 등록한다', async () => {
    await service.onModuleInit();
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      `${NOTIFICATION_DIGEST_QUEUE}-daily`,
      { pattern: '0 9 * * *', tz: PRODUCT_DEFAULT_TIMEZONE },
      expect.objectContaining({ name: expect.any(String) }),
    );
    expect(PRODUCT_DEFAULT_TIMEZONE).toBe('Asia/Seoul');
  });

  it('dailyDigestEmail 을 켠 사용자만 고른다', async () => {
    await service.sendDigests(NOW);
    expect(userQb.where).toHaveBeenCalledWith(
      "u.notification_preferences ->> 'dailyDigestEmail' = 'true'",
    );
    // 받을 사람이 없으면 알림 행을 조회하지 않는다.
    expect(notificationRepo.query).not.toHaveBeenCalled();
    expect(mail.sendDailyDigestEmail).not.toHaveBeenCalled();
  });

  it('직전 24시간 · 모으는 유형으로 조회하고 수신자마다 워크스페이스별로 묶어 한 통 보낸다', async () => {
    userQb.getMany.mockResolvedValueOnce([
      { id: 'u-1', email: 'a@x.test' },
      { id: 'u-2', email: 'b@x.test' },
    ]);
    notificationRepo.query.mockResolvedValue([
      row({
        workspace_id: 'ws-1',
        workspace_name: 'Alpha',
        title: 'a1',
        workspace_total: 2,
      }),
      row({
        workspace_id: 'ws-2',
        workspace_name: 'Beta',
        type: 'background_failed',
        title: 'b1',
      }),
      row({
        workspace_id: 'ws-1',
        workspace_name: 'Alpha',
        title: 'a2',
        workspace_total: 2,
      }),
    ]);

    const result = await service.sendDigests(NOW);

    const [sql, params] = notificationRepo.query.mock.calls[0];
    expect(sql).toMatch(/n\.created_at >= \$3 AND n\.created_at < \$4/);
    // 채널과 닫힘 여부로 거르지 않는다.
    expect(sql).not.toMatch(/channel|dismissed_at/);
    // 상한은 SQL 에서 자른다(윈도 함수). 전체 건수는 COUNT 로 따로 얻는다.
    expect(sql).toMatch(/ROW_NUMBER\(\) OVER/);
    expect(sql).toMatch(/COUNT\(\*\) OVER/);
    expect(sql).toMatch(/r\.rn <= \$5/);
    expect(params).toEqual([
      ['u-1', 'u-2'],
      [...DIGEST_TYPES],
      FROM,
      NOW,
      DIGEST_ITEMS_PER_WORKSPACE,
    ]);

    // u-2 는 보낼 것이 없어 보내지 않는다.
    expect(mail.sendDailyDigestEmail).toHaveBeenCalledTimes(1);
    const [to, digest] = mail.sendDailyDigestEmail.mock.calls[0];
    expect(to).toBe('a@x.test');
    expect(digest.total).toBe(3);
    expect(digest.windowStart).toEqual(FROM);
    expect(digest.windowEnd).toEqual(NOW);
    expect(digest.workspaces).toEqual([
      expect.objectContaining({
        name: 'Alpha',
        total: 2,
        items: [
          expect.objectContaining({ title: 'a1' }),
          expect.objectContaining({ title: 'a2' }),
        ],
      }),
      expect.objectContaining({
        name: 'Beta',
        total: 1,
        items: [
          expect.objectContaining({ type: 'background_failed', title: 'b1' }),
        ],
      }),
    ]);
    expect(result).toEqual({ recipients: 2, sent: 1, failed: 0 });
  });

  it('워크스페이스마다 상한 건만 읽고 전체 건수는 조회가 준 건수를 쓴다', async () => {
    userQb.getMany.mockResolvedValueOnce([{ id: 'u-1', email: 'a@x.test' }]);
    // SQL 이 상한까지만 돌려주고 workspace_total 에 전체 건수를 싣는다.
    const many = Array.from({ length: DIGEST_ITEMS_PER_WORKSPACE }, (_, i) =>
      row({ title: `t${i}`, workspace_total: DIGEST_ITEMS_PER_WORKSPACE + 3 }),
    );
    notificationRepo.query.mockResolvedValue(many);

    await service.sendDigests(NOW);

    const digest = mail.sendDailyDigestEmail.mock.calls[0][1];
    expect(digest.workspaces[0].items).toHaveLength(DIGEST_ITEMS_PER_WORKSPACE);
    expect(digest.workspaces[0].total).toBe(DIGEST_ITEMS_PER_WORKSPACE + 3);
    expect(digest.total).toBe(DIGEST_ITEMS_PER_WORKSPACE + 3);
  });

  it('한 사람의 발송이 실패해도 다음 사람에게 보내고 재시도하지 않는다', async () => {
    userQb.getMany.mockResolvedValueOnce([
      { id: 'u-1', email: 'a@x.test' },
      { id: 'u-2', email: 'b@x.test' },
    ]);
    notificationRepo.query.mockResolvedValue([
      row({ user_id: 'u-1' }),
      row({ user_id: 'u-2' }),
    ]);
    mail.sendDailyDigestEmail
      .mockRejectedValueOnce(new Error('smtp down'))
      .mockResolvedValueOnce(undefined);

    const result = await service.sendDigests(NOW);

    expect(mail.sendDailyDigestEmail).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ recipients: 2, sent: 1, failed: 1 });
  });

  it('받는 사람을 id 순 배치로 끝까지 읽는다', async () => {
    const first = Array.from({ length: 500 }, (_, i) => ({
      id: `u-${String(i).padStart(4, '0')}`,
      email: `${i}@x.test`,
    }));
    userQb.getMany
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce([{ id: 'u-9999', email: 'z@x.test' }]);

    const result = await service.sendDigests(NOW);

    expect(userQb.getMany).toHaveBeenCalledTimes(2);
    expect(userQb.andWhere).toHaveBeenLastCalledWith('u.id > :after', {
      after: 'u-0499',
    });
    expect(notificationRepo.query).toHaveBeenCalledTimes(2);
    expect(result.recipients).toBe(501);
  });

  it('process 는 예외를 삼키고 로그만 남긴다', async () => {
    userQb.getMany.mockRejectedValue(new Error('db down'));
    await expect(service.process({} as any)).resolves.toBeUndefined();
  });
});
