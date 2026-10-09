import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { checkSsrfSafeUrl } from '../../../common/utils/ssrf-safe-url.util';

// 근거: [EIA 알림 웹훅 「구독 이벤트」](CLE-EIA-NOTIFY#구독-이벤트)
/**
 * Outbound notification webhook 의 구독 가능한 이벤트 type.
 *
 * `websocket/websocket-events.types.ts` 의 `InAppNotificationEventType`(WS 인앱 알림 벨
 * 전용, `notification.new` 단일 값)과는 **무관** — 그쪽은 인앱 알림, 이쪽은 outbound
 * webhook 구독 화이트리스트다.
 */
export const NOTIFICATION_EVENT_TYPES = [
  'execution.waiting_for_input',
  'execution.completed',
  'execution.failed',
  'execution.cancelled',
  'execution.ai_message',
] as const;

export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];

// 근거:
//   - [EIA 알림 웹훅 「헤더와 서명」](CLE-EIA-NOTIFY#헤더와-서명)
//   - [EIA 알림 웹훅 「서명 알고리즘 표기를 인바운드와 나눈다」](CLE-EIA-NOTIFY#서명-알고리즘-표기를-인바운드와-나눈다)
/**
 * Outbound notification 의 HMAC 서명 설정.
 * 외부 표면에서는 `hmac-` prefix 를 명시한다.
 */
export class NotificationSigningDto {
  /** HMAC 알고리즘. 화이트리스트 (`hmac-sha256` / `hmac-sha512`) 만 허용. */
  @ApiPropertyOptional({
    description: 'HMAC 알고리즘. v1 은 sha256/sha512 만 허용.',
    enum: ['hmac-sha256', 'hmac-sha512'],
    default: 'hmac-sha256',
  })
  @IsOptional()
  @IsIn(['hmac-sha256', 'hmac-sha512'])
  algorithm?: 'hmac-sha256' | 'hmac-sha512';
}

// 근거: [EIA 알림 웹훅 「재시도와 실패 처리」](CLE-EIA-NOTIFY#재시도와-실패-처리)
/**
 * Outbound notification 의 재시도 정책.
 */
export class NotificationRetryDto {
  /** 첫 시도를 포함한 총 시도 횟수 (default 5, max 10). 0 은 1(재시도 없음)로 본다. */
  @ApiPropertyOptional({
    description:
      '첫 시도를 포함한 총 시도 횟수. HTTP 2xx 가 아니면 남은 횟수만큼 다시 보낸다. 0 은 1(재시도 없음)로 본다.',
    minimum: 0,
    maximum: 10,
    default: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  maxAttempts?: number;

  /** 백오프 전략. v1 은 exponential 만 지원. */
  @ApiPropertyOptional({
    description: '재시도 백오프. v1 은 exponential 만.',
    enum: ['exponential'],
    default: 'exponential',
  })
  @IsOptional()
  @IsIn(['exponential'])
  backoff?: 'exponential';
}

/**
 * Trigger 의 outbound notification webhook 설정. config JSONB 의 `notification` 서브 필드.
 * [Spec EIA §4 / §7.1].
 *
 * SSRF 정책: URL 은 register-time 에 protocol/hostname 검사 (literal IP 사설 대역 차단).
 * post-resolve 검증은 NotificationDispatcher (P3) 가 발송 시점에 추가로 수행.
 */
export class NotificationConfigDto {
  /** 이벤트 수신 URL. https 만 허용 (개발 ALLOW_HTTP_HOOKS=1 예외). */
  @ApiProperty({
    description:
      'Outbound notification 수신 URL. https 만 허용. 사설 IP/loopback/metadata IP 는 차단.',
    example: 'https://customer.example/webhook/wf-callback',
  })
  @IsString()
  url: string;

  /** 구독할 이벤트 type 목록. */
  @ApiProperty({
    description:
      '구독할 이벤트 type 목록. 빈 배열이면 trigger 자체로는 발송 없음.',
    enum: NOTIFICATION_EVENT_TYPES,
    isArray: true,
    example: [
      'execution.waiting_for_input',
      'execution.completed',
      'execution.failed',
    ],
  })
  @IsArray()
  @IsIn(NOTIFICATION_EVENT_TYPES, { each: true })
  events: NotificationEventType[];

  /** HMAC 서명 설정. */
  @ApiPropertyOptional({ type: () => NotificationSigningDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => NotificationSigningDto)
  signing?: NotificationSigningDto;

  /** 재시도 정책. */
  @ApiPropertyOptional({ type: () => NotificationRetryDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => NotificationRetryDto)
  retry?: NotificationRetryDto;
}

/**
 * DTO 외부에서 url 검증 시 사용하는 헬퍼. NestJS pipe 안에서 manual 호출 (class-validator
 * 의 custom validator 사용 시 환경변수 의존이 테스트 격리에 불편하여 호출 측에서 명시 검증).
 *
 * 검증 실패 시 `BadRequestException` 호출 측이 throw.
 */
export function validateNotificationUrl(url: string): {
  ok: boolean;
  reason?: string;
} {
  return checkSsrfSafeUrl(url);
}
