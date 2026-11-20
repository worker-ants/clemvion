// Outbound notification URL 의 클라이언트 측 사전 검증 — spec EIA-NX-09.
//
// 백엔드(`EIA-NX-09` / `EIA-NX-10`)가 최종 권위다: `https://` 만 허용하고
// SSRF (사설 IP·loopback·metadata IP) 를 차단한다. SSRF 차단은 호스트네임
// DNS 해석이 필요하므로 클라이언트에서 재현할 수 없다 — 본 함수는 명백한
// 형식 오류(http://, 잘못된 URL)를 저장 전에 잡아 round-trip 을 줄이는 UX
// 가드일 뿐, 보안 경계가 아니다.

/**
 * notification URL 이 등록 가능한 형식인지 검사한다.
 *
 * - 빈 문자열(공백 포함)은 "미설정" 으로 간주해 `true` (notification 은 선택).
 * - 그 외에는 파싱 가능한 `https://` URL 일 때만 `true`.
 */
export function isValidNotificationUrl(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed.length === 0) return true;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  return parsed.protocol === "https:";
}

/**
 * notification URL 에 userinfo(사용자명 · 비밀번호, 한쪽만 있어도)가 있는지 본다.
 *
 * 서버는 이런 URL 을 `400 INVALID_NOTIFICATION_URL` 로 거부한다(fetch 가 요청을 만들지 않아 발송이 늘 실패한다,
 * NERV Task CLE-T-RCQGCC). 저장 전에 전용 안내를 보여 주려는 UX 가드다. 파싱되지 않는 값과 `https://@host` 처럼
 * userinfo 가 빈 값은 `false` 다.
 */
export function hasNotificationUrlCredentials(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return false;
  }
  return parsed.username !== "" || parsed.password !== "";
}
