import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { NotificationRetryDto } from '../triggers/dto/notification-config.dto';
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

/**
 * 상한과 기본값의 출처가 둘이다 — 발송 쪽 상수(이 모듈)와 입력 검증 쪽 DTO(`@Max` · OpenAPI). DTO 가 이 모듈의 상수를
 * 가져오면 `triggers` 가 `external-interaction` 에 기대는 방향이 하나 더 생겨서 상수를 공유하지 않는다. 대신 둘이 같은
 * 값임을 이 테스트가 고정한다. 한쪽만 바꾸면 DTO 는 통과시키는데 발송 단계에서 조용히 잘리는 값이 생긴다.
 */
describe('notification.retry.maxAttempts — DTO 와 발송 상수의 일치', () => {
  /** `@ApiProperty*` 가 속성마다 쓰는 메타데이터 키(`@nestjs/swagger` 의 `DECORATORS.API_MODEL_PROPERTIES`). */
  const API_MODEL_PROPERTIES = 'swagger/apiModelProperties';

  function errorsFor(maxAttempts: unknown): string[] {
    const dto = plainToInstance(NotificationRetryDto, { maxAttempts });
    return validateSync(dto).flatMap((e) => Object.keys(e.constraints ?? {}));
  }

  it('DTO 는 발송 상한까지 받고 그 위는 거부한다', () => {
    expect(errorsFor(MAX_NOTIFICATION_ATTEMPTS)).toEqual([]);
    expect(errorsFor(MAX_NOTIFICATION_ATTEMPTS + 1)).toContain('max');
  });

  it('DTO 는 0 까지 받고 그 아래는 거부한다 — 0 은 발송에서 1 로 본다', () => {
    expect(errorsFor(0)).toEqual([]);
    expect(errorsFor(-1)).toContain('min');
    expect(notificationAttemptsFromRetry({ maxAttempts: 0 })).toBe(1);
  });

  it('OpenAPI 가 광고하는 상한과 기본값이 발송 상수와 같다', () => {
    const meta = Reflect.getMetadata(
      API_MODEL_PROPERTIES,
      NotificationRetryDto.prototype,
      'maxAttempts',
    ) as { maximum?: number; default?: number; minimum?: number };
    expect(meta.maximum).toBe(MAX_NOTIFICATION_ATTEMPTS);
    expect(meta.default).toBe(DEFAULT_NOTIFICATION_ATTEMPTS);
    expect(meta.minimum).toBe(0);
  });
});
