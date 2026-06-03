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

/** `${appUrl}/api/3rd-party/makeshop/install/<token>` — MakeShop ShopStore
 *  설치 App URL. cafe24 install URL 과 동일 형식 (install_token capability
 *  모델 재사용). spec/2-navigation/4-integration.md §5.9 설치(ShopStore) +
 *  spec/4-nodes/4-integration/5-makeshop.md §9.8. */
export function buildMakeshopInstallUrl(
  appBaseUrl: string,
  installToken: string,
): string {
  return `${appBaseUrl}/api/${THIRD_PARTY_PREFIX}/makeshop/install/${installToken}`;
}

/**
 * MakeShop `shop_uid` 형식 — 영숫자·하이픈·언더스코어 2~64자.
 * base URL path segment (`/api/v1/{shop_uid}/`) 에 직접 주입되므로 SSRF /
 * path-traversal 방어로 charset 을 제한한다. `makeshop.handler.ts` 의
 * `SHOP_UID_PATTERN` 과 동일 — 단일 진실 지점.
 *
 * ⚠ VERIFY against makeshop docs before production: 정확한 shop_uid 형식
 * 정규식은 makeshop 공식 문서로 확정 (spec/4-nodes/4-integration/5-makeshop.md
 * §9.7 미확인 항목). 현 정규식은 cafe24 mall_id 보다 관대한 안전 추정치.
 */
export const MAKESHOP_SHOP_UID_PATTERN = /^[A-Za-z0-9_-]{2,64}$/;

/** `${appUrl}/api/3rd-party/<provider>/callback` — google/github/cafe24 공통 */
export function buildOauthCallbackUrl(
  appBaseUrl: string,
  provider: string,
): string {
  return `${appBaseUrl}/api/${THIRD_PARTY_PREFIX}/${provider}/callback`;
}
