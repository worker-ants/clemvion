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

// 근거: [EIA 알림 웹훅 「구독 이벤트」](CLE-EIA-NOTIFY-EVENTS#구독-이벤트)
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
//   - [EIA 알림 웹훅 「헤더와 서명」](CLE-EIA-NOTIFY-DELIVERY#헤더와-서명)
//   - [EIA 알림 웹훅 「서명 알고리즘 표기를 인바운드와 나눈다」](CLE-EIA-NOTIFY-DELIVERY#서명-알고리즘-표기를-인바운드와-나눈다)
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

  /**
   * 백오프 전략. v1 은 exponential 만 지원.
   * 재시도 간격은 1초에서 4배씩 늘고 한 간격의 상한은 1시간이다.
   */
  @ApiPropertyOptional({
    description:
      '재시도 백오프. v1 은 exponential 만. 재시도 간격은 1초에서 4배씩 늘고(1초 · 4초 · 16초 …) 한 간격의 상한은 1시간이다.',
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
      'Outbound notification 수신 URL. https 만 허용. 사설 IP/loopback/metadata IP 는 차단. 리다이렉트(3xx)는 따라가지 않고 발송 실패로 보므로 최종 주소를 등록해야 한다.',
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
 * userinfo 가 있는 알림 URL 의 거부 사유. URL 원문과 자격 증명을 싣지 않는 고정 문구다. 등록 응답(`400
 * INVALID_NOTIFICATION_URL` 의 message)과 발송 직전 degraded 사유(`notification_last_error`)가 함께 쓴다.
 */
export const NOTIFICATION_URL_CREDENTIALS_REASON =
  'URL must not include credentials (user:password@)';

/**
 * DTO 외부에서 url 검증 시 사용하는 헬퍼. NestJS pipe 안에서 manual 호출 (class-validator
 * 의 custom validator 사용 시 환경변수 의존이 테스트 격리에 불편하여 호출 측에서 명시 검증).
 * 등록 · 수정(`TriggersService`)과 발송 직전(`NotificationWebhookProcessor`)이 같은 판정을 쓴다.
 *
 * SSRF 판정(`checkSsrfSafeUrl`)을 지난 URL 에 userinfo(사용자명 · 비밀번호, 한쪽만 있어도)가 있으면 거부한다. Node
 * fetch 는 그런 URL 로 요청을 만들지 않고 URL 원문을 담은 오류를 던지므로 발송이 늘 실패한다. userinfo 는 SSRF 판정이
 * 아니라서 `ssrf-safe-url.util.ts` 밖에 둔다. `https://@host` 처럼 userinfo 가 비면 파싱 결과에 남지 않고 fetch 도
 * 받으므로 통과한다(NERV Task `CLE-T-RCQGCC`).
 *
 * 검증 실패 시 `BadRequestException` 호출 측이 throw.
 */
export function validateNotificationUrl(url: string): {
  ok: boolean;
  reason?: string;
} {
  const ssrf = checkSsrfSafeUrl(url);
  if (!ssrf.ok) return ssrf;
  // SSRF 판정이 파싱을 통과시켰으므로 여기서는 던지지 않는다.
  const parsed = new URL(url);
  if (parsed.username !== '' || parsed.password !== '') {
    return { ok: false, reason: NOTIFICATION_URL_CREDENTIALS_REASON };
  }
  return { ok: true };
}
