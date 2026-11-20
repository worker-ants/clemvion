import { computeNotificationChannel } from './notification-channel';

/**
 * [알림 설정 「채널 계산」](CLE-OBS-NOTIFY-SETTINGS#채널-계산) 의 네 결과 표와 기본값 규칙 (CLE-T-EJFQ1Y).
 */
describe('computeNotificationChannel', () => {
  describe.each([
    ['execution_failed', 'executionFailedInApp', 'executionFailedEmail'],
    ['schedule_failed', 'scheduleFailedInApp', 'scheduleFailedEmail'],
  ] as const)('%s (이메일 opt-out)', (type, inAppKey, emailKey) => {
    it.each([
      [true, true, 'both'],
      [true, false, 'in_app'],
      [false, true, 'email'],
      [false, false, null],
    ] as const)('인앱 %s · 이메일 %s → %s', (inApp, email, expected) => {
      expect(
        computeNotificationChannel(
          { [inAppKey]: inApp, [emailKey]: email },
          type,
        ),
      ).toBe(expected);
    });

    it('키가 없으면 둘 다 켬으로 본다', () => {
      expect(computeNotificationChannel({}, type)).toBe('both');
      expect(computeNotificationChannel(undefined, type)).toBe('both');
    });
  });

  describe('integration_expired (이메일 opt-in)', () => {
    it.each([
      [true, true, 'both'],
      [true, false, 'in_app'],
      [false, true, 'email'],
      [false, false, null],
    ] as const)('인앱 %s · 이메일 %s → %s', (inApp, email, expected) => {
      expect(
        computeNotificationChannel(
          { integrationExpiryInApp: inApp, integrationExpiryEmail: email },
          'integration_expired',
        ),
      ).toBe(expected);
    });

    it('키가 없으면 인앱만 켬으로 본다', () => {
      expect(computeNotificationChannel({}, 'integration_expired')).toBe(
        'in_app',
      );
    });

    it('인앱을 끄고 이메일 키가 없으면 보내지 않는다', () => {
      expect(
        computeNotificationChannel(
          { integrationExpiryInApp: false },
          'integration_expired',
        ),
      ).toBeNull();
    });
  });
});
