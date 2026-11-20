import { checkSsrfSafeUrl } from '../../common/utils/ssrf-safe-url.util';
import { VALUE_MASK_MARKER } from '../../shared/utils/sanitize-error-message';

// 근거: [EIA 알림 웹훅 — SSRF 방지](CLE-EIA-NOTIFY-SSRF#ssrf-방지), [트리거 응답의 마지막 오류](CLE-API-EGRESS-TRIGGER)
//
// 알림 수신 URL 의 검증과 응답 가림을 한곳에 둔다. 등록 · 수정(`TriggersService`), 발송 직전
// (`NotificationWebhookProcessor`), 트리거 응답 정화(`TriggersService.sanitizeForResponse`)가 같은 userinfo 판정
// (`hasUrlUserinfo`)을 쓴다. 프런트 편집 폼의 사전 검증(`frontend/src/lib/utils/url-validation.ts`)은 패키지가 달라
// 따로 두고, 판정 기준(WHATWG URL 파서의 username · password)을 맞춘다.

/**
 * userinfo 가 있는 알림 URL 의 거부 사유. URL 원문과 자격 증명을 싣지 않는 고정 문구다. 등록 응답(`400
 * INVALID_NOTIFICATION_URL` 의 message)과 발송 직전 degraded 사유(`notification_last_error`)가 함께 쓴다.
 */
export const NOTIFICATION_URL_CREDENTIALS_REASON =
  'URL must not include credentials (user:password@)';

/**
 * 파싱한 URL 에 userinfo(사용자명 · 비밀번호, 한쪽만 있어도)가 있는지 본다. `https://@host` 처럼 userinfo 가 비면
 * 파싱 결과에 남지 않으므로 없는 것으로 본다.
 */
export function hasUrlUserinfo(parsed: URL): boolean {
  return parsed.username !== '' || parsed.password !== '';
}

/**
 * 알림 URL 검증. NestJS pipe 안에서 manual 호출한다(class-validator 의 custom validator 를 쓰면 환경변수 의존이
 * 테스트 격리에 불편해서 호출 측에서 명시 검증한다). 검증 실패 시 `BadRequestException` 은 호출 측이 던진다.
 *
 * SSRF 판정(`checkSsrfSafeUrl`)을 지난 URL 에 userinfo 가 있으면 거부한다. Node fetch 는 그런 URL 로 요청을 만들지
 * 않고 URL 원문을 담은 오류를 던지므로 발송이 늘 실패한다. userinfo 는 SSRF 판정이 아니라서
 * `ssrf-safe-url.util.ts` 밖에 둔다. `https://@host` 는 fetch 도 받으므로 통과한다.
 */
export function validateNotificationUrl(url: string): {
  ok: boolean;
  reason?: string;
} {
  const ssrf = checkSsrfSafeUrl(url);
  if (!ssrf.ok) return ssrf;
  // SSRF 판정이 파싱을 통과시켰으므로 여기서는 던지지 않는다.
  if (hasUrlUserinfo(new URL(url))) {
    return { ok: false, reason: NOTIFICATION_URL_CREDENTIALS_REASON };
  }
  return { ok: true };
}

/**
 * 응답의 `config.notification.url` 에서 userinfo 를 `***` 로 가린다. 나머지(호스트 · 경로 · 쿼리 · 조각)는 글자 그대로
 * 둔다. 등록 검사(`validateNotificationUrl`)가 userinfo 를 거부하기 전에 저장된 행이 대상이다. 편집 폼이 가린 값을
 * 다시 보내면 같은 검사가 400 으로 거부하므로 마커가 저장되지 않는다(CLE-API-EGRESS 규칙 9).
 *
 * userinfo 여부는 `hasUrlUserinfo` 로 정한다. 가리는 자리는 스킴 뒤 authority 의 마지막 `@` 까지다. 파서도
 * authority 안의 마지막 `@` 를 userinfo 끝으로 본다.
 */
export function maskNotificationUrlUserinfo(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (!hasUrlUserinfo(parsed)) return url;
  const masked = url.replace(
    /^([A-Za-z][A-Za-z0-9+.-]*:\/\/)[^/?#\\]*@/,
    `$1${VALUE_MASK_MARKER}@`,
  );
  if (masked !== url) return masked;
  // 원문 모양이 위 패턴과 다르면(역슬래시 구분자 등) 파서 결과로 다시 쓴다. 이때는 정규화된 모양이 나간다.
  parsed.username = VALUE_MASK_MARKER;
  parsed.password = '';
  return parsed.href;
}

/**
 * 알림 마지막 오류에만 거는 userinfo 국소 패턴. 공유 값 패턴(`redactSecrets`)은 `user:pass@` 만 가리고 사용자명만
 * 있는 형태(`https://tok@host`)와 빈 사용자명(`https://:pw@host`)은 두는데, 이 칸에는 fetch 가 알림 URL 원문을 담아
 * 저장한 옛 값이 남아 있을 수 있어 비어 있지 않은 userinfo 를 모두 `***` 로 바꾼다. 공유 패턴을 넓히지 않는 이유는
 * CLE-API-EGRESS-TRIGGER Rationale 에 있다.
 */
const NOTIFICATION_LAST_ERROR_USERINFO_PATTERN = /(?<=:\/\/)[^/\s@]+(?=@)/g;

/** `notificationLastError` 원문(`redactSecrets` 를 건 뒤)에 남은 userinfo 를 `***` 로 바꾼다. */
export function maskNotificationLastErrorUserinfo(text: string): string {
  return text.replace(
    NOTIFICATION_LAST_ERROR_USERINFO_PATTERN,
    VALUE_MASK_MARKER,
  );
}
