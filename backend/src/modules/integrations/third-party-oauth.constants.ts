/**
 * 3rd-party OAuth namespace 의 공유 상수 / URL 빌더.
 *
 * spec/2-navigation/4-integration.md §9.2 Rationale "Cafe24 App URL 100자
 * 한도 대응" — install_token 형식과 URL prefix 가 한 곳에서 정의되어
 * 토큰 생성·검증·URL 조립의 불일치를 컴파일 타임에 막는다.
 */

/** install_token: 16 byte → base64url no-padding = 22자, 128-bit 엔트로피.
 *  생성은 `randomBytes(16).toString('base64url')`. */
export const INSTALL_TOKEN_BYTES = 16;
export const INSTALL_TOKEN_LENGTH = 22;
export const INSTALL_TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/;

/** 3rd-party OAuth controller URL prefix. NestJS controller decorator 와
 *  URL 조립 함수가 동일 상수를 참조한다. */
export const THIRD_PARTY_PREFIX = '3rd-party';

/** `${appUrl}/api/3rd-party/cafe24/install/<token>` */
export function buildCafe24InstallUrl(
  appBaseUrl: string,
  installToken: string,
): string {
  return `${appBaseUrl}/api/${THIRD_PARTY_PREFIX}/cafe24/install/${installToken}`;
}

/** `${appUrl}/api/3rd-party/<provider>/callback` — google/github/cafe24 공통 */
export function buildOauthCallbackUrl(
  appBaseUrl: string,
  provider: string,
): string {
  return `${appBaseUrl}/api/${THIRD_PARTY_PREFIX}/${provider}/callback`;
}
