import {
  REINSTALL_REQUEST_TTL_HOURS,
  isCafe24PrivateRow,
  isInstallFlowRow,
  isReinstallRequestActive,
} from './reinstall-request';

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;
const NOW = new Date('2026-10-10T12:00:00.000Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe('reinstall-request', () => {
  it('유효 시간은 설치 대기 TTL 과 같은 24시간이다', () => {
    expect(REINSTALL_REQUEST_TTL_HOURS).toBe(24);
  });

  describe('isReinstallRequestActive', () => {
    it('표시가 없으면 무효다', () => {
      expect(
        isReinstallRequestActive({ reinstallRequestedAt: null }, NOW),
      ).toBe(false);
    });

    it('방금 남긴 표시는 유효하다', () => {
      expect(isReinstallRequestActive({ reinstallRequestedAt: NOW }, NOW)).toBe(
        true,
      );
    });

    it('23시간 59분이 지난 표시는 아직 유효하다', () => {
      expect(
        isReinstallRequestActive(
          { reinstallRequestedAt: ago(24 * HOUR - MINUTE) },
          NOW,
        ),
      ).toBe(true);
    });

    it('정확히 24시간이 지난 표시는 무효다(경계는 닫힌다)', () => {
      expect(
        isReinstallRequestActive({ reinstallRequestedAt: ago(24 * HOUR) }, NOW),
      ).toBe(false);
    });

    it('24시간을 넘긴 표시는 무효다', () => {
      expect(
        isReinstallRequestActive(
          { reinstallRequestedAt: ago(24 * HOUR + MINUTE) },
          NOW,
        ),
      ).toBe(false);
    });

    it('읽을 수 없는 값은 무효다(fail-closed)', () => {
      expect(
        isReinstallRequestActive(
          { reinstallRequestedAt: new Date('not-a-date') },
          NOW,
        ),
      ).toBe(false);
    });

    it('now 를 생략하면 현재 시각으로 본다', () => {
      expect(
        isReinstallRequestActive({
          reinstallRequestedAt: new Date(Date.now() - HOUR),
        }),
      ).toBe(true);
      expect(
        isReinstallRequestActive({
          reinstallRequestedAt: new Date(Date.now() - 25 * HOUR),
        }),
      ).toBe(false);
    });
  });

  describe('isInstallFlowRow', () => {
    it('설치 대기 행은 표시와 무관하게 설치 흐름이다', () => {
      expect(
        isInstallFlowRow(
          { status: 'pending_install', reinstallRequestedAt: null },
          NOW,
        ),
      ).toBe(true);
    });

    it.each(['connected', 'error', 'expired'] as const)(
      'status=%s 는 유효한 표시가 있을 때만 설치 흐름이다',
      (status) => {
        expect(
          isInstallFlowRow({ status, reinstallRequestedAt: ago(HOUR) }, NOW),
        ).toBe(true);
        expect(
          isInstallFlowRow(
            { status, reinstallRequestedAt: ago(25 * HOUR) },
            NOW,
          ),
        ).toBe(false);
        expect(
          isInstallFlowRow({ status, reinstallRequestedAt: null }, NOW),
        ).toBe(false);
      },
    );
  });

  describe('isCafe24PrivateRow', () => {
    it.each([
      ['cafe24', 'private', true],
      ['cafe24', 'public', false],
      ['cafe24', undefined, false],
      ['makeshop', 'private', false],
      ['google', undefined, false],
    ] as const)(
      'serviceType=%s app_type=%s → %s',
      (serviceType, appType, expected) => {
        expect(
          isCafe24PrivateRow({
            serviceType,
            credentials: appType ? { app_type: appType } : {},
          }),
        ).toBe(expected);
      },
    );
  });
});
