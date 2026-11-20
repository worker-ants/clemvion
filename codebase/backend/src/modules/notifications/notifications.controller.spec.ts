import { NotFoundException } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';

/**
 * e2e 전용 `_test/send-daily-digest` 의 프로덕션 차단 계약 (CLE-T-BAXAN4).
 * 게이트는 `executions/_test/recover-stuck-executions` 와 같다.
 */
describe('NotificationsController _test/send-daily-digest', () => {
  const orig = {
    NODE_ENV: process.env.NODE_ENV,
    E2E_TEST_HOOKS: process.env.E2E_TEST_HOOKS,
  };
  let digestService: { sendDigests: jest.Mock };
  let controller: NotificationsController;

  beforeEach(() => {
    digestService = {
      sendDigests: jest
        .fn()
        .mockResolvedValue({ recipients: 1, sent: 1, failed: 0 }),
    };
    controller = new NotificationsController({} as any, digestService as any);
  });

  afterEach(() => {
    process.env.NODE_ENV = orig.NODE_ENV;
    if (orig.E2E_TEST_HOOKS === undefined) delete process.env.E2E_TEST_HOOKS;
    else process.env.E2E_TEST_HOOKS = orig.E2E_TEST_HOOKS;
  });

  it('NODE_ENV=test + E2E_TEST_HOOKS=1 이면 지금 시각으로 요약을 한 번 돌린다', async () => {
    process.env.NODE_ENV = 'test';
    process.env.E2E_TEST_HOOKS = '1';
    await expect(controller.sendDailyDigestForTest()).resolves.toEqual({
      recipients: 1,
      sent: 1,
      failed: 0,
    });
    expect(digestService.sendDigests).toHaveBeenCalledWith(expect.any(Date));
  });

  it('NODE_ENV 이 test 가 아니면 404 이고 요약을 돌리지 않는다', async () => {
    process.env.NODE_ENV = 'production';
    process.env.E2E_TEST_HOOKS = '1';
    await expect(controller.sendDailyDigestForTest()).rejects.toThrow(
      NotFoundException,
    );
    expect(digestService.sendDigests).not.toHaveBeenCalled();
  });

  it('E2E_TEST_HOOKS 플래그가 없으면 404 이고 요약을 돌리지 않는다', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.E2E_TEST_HOOKS;
    await expect(controller.sendDailyDigestForTest()).rejects.toThrow(
      NotFoundException,
    );
    expect(digestService.sendDigests).not.toHaveBeenCalled();
  });
});
