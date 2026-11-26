import { Logger } from '@nestjs/common';
import { NotificationSigningSecretService } from './notification-signing-secret.service';
import { notificationSigningSecretRef } from './notification-signing-secret-ref';

// 근거: [EIA 알림 웹훅 「시크릿 교체」](CLE-EIA-NOTIFY#시크릿-교체), [시크릿 저장소 「규칙」](CLE-INT-SECRET#규칙)
// (NERV Task `CLE-T-919WVA`)
const REF = notificationSigningSecretRef('t1');

describe('NotificationSigningSecretService 알림 해제', () => {
  let query: jest.Mock;
  let findOne: jest.Mock;
  let secretsDelete: jest.Mock;
  let service: NotificationSigningSecretService;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    query = jest.fn().mockResolvedValue(undefined);
    findOne = jest.fn();
    secretsDelete = jest.fn().mockResolvedValue(undefined);
    const manager = { query, findOne };
    const repo = {
      manager: {
        transaction: jest.fn((fn: (m: unknown) => Promise<unknown>) =>
          fn(manager),
        ),
      },
    };
    service = new NotificationSigningSecretService(
      repo as never,
      { delete: secretsDelete } as never,
      {} as never,
    );
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => warn.mockRestore());

  describe('settleUnset', () => {
    it.each([
      ['v2 만 남았다', 'wsk_v2', null, true],
      ['교체 시각만 남았다', null, new Date('2026-11-26T00:00:00Z'), true],
      ['둘 다 남았다', 'wsk_v2', new Date('2026-11-26T00:00:00Z'), true],
      ['둘 다 없다', null, null, false],
    ])('%s → clearRotation=%s', (_name, v2, at, expected) => {
      expect(
        service.settleUnset({
          notificationSecretV2: v2,
          notificationRotatedAt: at,
        }),
      ).toEqual({ clearRotation: expected });
    });
  });

  describe('deleteAfterUnset', () => {
    it('다시 읽은 행에 알림 설정이 없으면 시크릿 행을 지운다', async () => {
      findOne.mockResolvedValue({ id: 't1', config: {} });
      await service.deleteAfterUnset('t1');
      expect(secretsDelete).toHaveBeenCalledWith(REF, expect.anything());
    });

    it('행이 없으면(그사이 트리거 삭제) 지운다', async () => {
      findOne.mockResolvedValue(null);
      await service.deleteAfterUnset('t1');
      expect(secretsDelete).toHaveBeenCalledWith(REF, expect.anything());
    });

    it.each([
      ['null', null],
      ['문자열', 'x'],
    ])(
      'notification 이 %s 이면 알림이 없는 것으로 보고 지운다',
      async (_n, v) => {
        findOne.mockResolvedValue({ id: 't1', config: { notification: v } });
        await service.deleteAfterUnset('t1');
        expect(secretsDelete).toHaveBeenCalledTimes(1);
      },
    );

    it('notification 이 객체면 지우지 않는다', async () => {
      findOne.mockResolvedValue({
        id: 't1',
        config: { notification: { url: 'https://hooks.example.com/n' } },
      });
      await service.deleteAfterUnset('t1');
      expect(secretsDelete).not.toHaveBeenCalled();
    });

    it('잠금을 얻지 못해도 던지지 않고 warn 만 남기고 지우지 않는다', async () => {
      query.mockRejectedValue(new Error('lock timeout'));
      await expect(service.deleteAfterUnset('t1')).resolves.toBeUndefined();
      expect(findOne).not.toHaveBeenCalled();
      expect(secretsDelete).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('lock timeout'),
      );
    });

    it('삭제가 실패해도 던지지 않고 warn 만 남긴다', async () => {
      findOne.mockResolvedValue({ id: 't1', config: {} });
      secretsDelete.mockRejectedValue(new Error('store down'));
      await expect(service.deleteAfterUnset('t1')).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('store down'));
    });
  });
});
