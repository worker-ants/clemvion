import {
  DEFAULT_NOTIFICATION_ATTEMPTS,
  MAX_NOTIFICATION_ATTEMPTS,
  notificationAttemptsFromRetry,
} from './notification-dispatcher.types';

/**
 * `notification.retry.maxAttempts` → BullMQ `attempts` 변환.
 *
 * 근거: [EIA 알림 웹훅 「재시도와 실패 처리」](CLE-EIA-NOTIFY#재시도와-실패-처리) — 첫 시도를 포함한 총
 * 시도 횟수, 기본 5, 상한 10, 0 은 1(큐 재시도 없음).
 */
describe('notificationAttemptsFromRetry', () => {
  it('retry 설정이 없으면 기본 5회다', () => {
    expect(notificationAttemptsFromRetry(undefined)).toBe(
      DEFAULT_NOTIFICATION_ATTEMPTS,
    );
    expect(DEFAULT_NOTIFICATION_ATTEMPTS).toBe(5);
    expect(notificationAttemptsFromRetry({})).toBe(5);
    expect(notificationAttemptsFromRetry(null)).toBe(5);
  });

  it('저장한 maxAttempts 를 총 시도 횟수 그대로 쓴다', () => {
    expect(notificationAttemptsFromRetry({ maxAttempts: 3 })).toBe(3);
    expect(notificationAttemptsFromRetry({ maxAttempts: 1 })).toBe(1);
    expect(notificationAttemptsFromRetry({ maxAttempts: 10 })).toBe(10);
  });

  it('0 은 1(큐 재시도 없음)로 본다', () => {
    expect(notificationAttemptsFromRetry({ maxAttempts: 0 })).toBe(1);
  });

  // 타입 필드는 DTO 가 0~10 정수로 막지만 원시 `config` 로 들어온 값은 검증을 지나지 않는다.
  it('원시 config 로 들어온 범위 밖 값은 1~10 으로 자른다', () => {
    expect(MAX_NOTIFICATION_ATTEMPTS).toBe(10);
    expect(notificationAttemptsFromRetry({ maxAttempts: 11 })).toBe(10);
    expect(notificationAttemptsFromRetry({ maxAttempts: 1000 })).toBe(10);
    expect(notificationAttemptsFromRetry({ maxAttempts: -3 })).toBe(1);
    expect(notificationAttemptsFromRetry({ maxAttempts: 2.7 })).toBe(2);
  });

  it('숫자가 아닌 값은 기본 5회로 본다', () => {
    expect(notificationAttemptsFromRetry({ maxAttempts: '7' })).toBe(5);
    expect(notificationAttemptsFromRetry({ maxAttempts: Number.NaN })).toBe(5);
    expect(
      notificationAttemptsFromRetry({ maxAttempts: Number.POSITIVE_INFINITY }),
    ).toBe(5);
    expect(notificationAttemptsFromRetry('retry')).toBe(5);
  });
});
