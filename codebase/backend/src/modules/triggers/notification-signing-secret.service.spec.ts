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
  let secretsRotate: jest.Mock;
  let manager: { query: jest.Mock; findOne: jest.Mock };
  let service: NotificationSigningSecretService;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    query = jest.fn().mockResolvedValue(undefined);
    findOne = jest.fn();
    secretsDelete = jest.fn().mockResolvedValue(undefined);
    secretsRotate = jest.fn().mockResolvedValue(undefined);
    manager = { query, findOne };
    const repo = {
      manager: {
        transaction: jest.fn((fn: (m: unknown) => Promise<unknown>) =>
          fn(manager),
        ),
      },
    };
    service = new NotificationSigningSecretService(
      repo as never,
      { delete: secretsDelete, rotate: secretsRotate } as never,
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
    ])('%s → clearRotation=%s', (_name, v2, rotatedAt, expected) => {
      expect(
        service.settleUnset({
          notificationSecretV2: v2,
          notificationRotatedAt: rotatedAt,
        }),
      ).toEqual({ clearRotation: expected });
    });
  });

  // `settle` 의 `clearRotation` 이 틀리면 승격 job 이 방금 발급한 시크릿을 옛 v2 로 덮는다(NERV Task `CLE-T-XAB6MJ`).
  describe('settle 의 clearRotation', () => {
    const URL = 'https://hooks.example.com/n';
    const rotatedAt = new Date('2026-11-26T00:00:00Z');
    it.each([
      [
        'issue + 교체 대기 값이 남은 행',
        {},
        'wsk_old',
        rotatedAt,
        'issue',
        true,
      ],
      ['issue + 깨끗한 행', {}, null, null, 'issue', false],
      [
        'migrate + 교체 대기 값이 남은 행',
        { signing: { secret: 'wsk_legacy' } },
        'wsk_old',
        rotatedAt,
        'migrate',
        false,
      ],
      [
        'rederive + 교체 대기 값이 남은 행',
        { signing: { secretRef: REF } },
        'wsk_old',
        rotatedAt,
        'rederive',
        false,
      ],
    ])(
      '%s → clearRotation=%s',
      async (_name, stored, v2, storedRotatedAt, kind, expected) => {
        const fresh = {
          id: 't1',
          workspaceId: 'ws-1',
          config: { notification: { url: URL, ...stored } },
          notificationSecretV2: v2,
          notificationRotatedAt: storedRotatedAt,
        };
        const settled = await service.settle(manager as never, fresh as never, {
          notification: { url: URL },
        });
        expect(settled.clearRotation).toBe(expected);
        // 갈래가 의도한 결정인지 함께 본다. 갈래가 바뀌어도 clearRotation 만 맞으면 통과하지 않게 한다.
        if (kind === 'issue') {
          expect(settled.issuedSecret).toMatch(/^wsk_[0-9a-f]{64}$/);
          expect(secretsRotate).toHaveBeenCalledWith(
            REF,
            'ws-1',
            settled.issuedSecret,
            manager,
          );
        } else if (kind === 'migrate') {
          expect(settled.issuedSecret).toBeUndefined();
          expect(secretsRotate).toHaveBeenCalledWith(
            REF,
            'ws-1',
            'wsk_legacy',
            manager,
          );
        } else {
          expect(settled.issuedSecret).toBeUndefined();
          expect(secretsRotate).not.toHaveBeenCalled();
        }
      },
    );
  });

  describe('deleteAfterUnset', () => {
    it('다시 읽은 행에 알림 설정이 없으면 시크릿 행을 지운다', async () => {
      findOne.mockResolvedValue({ id: 't1', config: {} });
      await service.deleteAfterUnset('t1');
      expect(secretsDelete).toHaveBeenCalledWith(REF, manager);
    });

    it('행이 없으면(그사이 트리거 삭제) 지운다', async () => {
      findOne.mockResolvedValue(null);
      await service.deleteAfterUnset('t1');
      expect(secretsDelete).toHaveBeenCalledWith(REF, manager);
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

    it('config 가 null 이면 알림이 없는 것으로 보고 지운다', async () => {
      findOne.mockResolvedValue({ id: 't1', config: null });
      await service.deleteAfterUnset('t1');
      expect(secretsDelete).toHaveBeenCalledWith(REF, manager);
    });

    // 판정은 `typeof === 'object'` 라 배열과 빈 객체도 «알림 설정이 있다» 로 본다. 지금 동작을 고정한다.
    it.each([
      ['배열', []],
      ['빈 객체', {}],
    ])('notification 이 %s 이면 지우지 않는다', async (_n, v) => {
      findOne.mockResolvedValue({ id: 't1', config: { notification: v } });
      await service.deleteAfterUnset('t1');
      expect(secretsDelete).not.toHaveBeenCalled();
    });

    it('잠금 쿼리를 행 재읽기보다 먼저 부른다', async () => {
      findOne.mockResolvedValue({ id: 't1', config: {} });
      await service.deleteAfterUnset('t1');
      // 순서가 바뀌면 잠금 전에 읽은 행으로 판정해 다시 붙인 서명 시크릿을 지울 수 있다.
      expect(query).toHaveBeenCalledTimes(1);
      expect(query.mock.invocationCallOrder[0]).toBeLessThan(
        findOne.mock.invocationCallOrder[0],
      );
    });

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
