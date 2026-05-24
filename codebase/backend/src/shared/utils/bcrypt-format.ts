/**
 * bcrypt hash 포맷 검증 유틸. SoT: `spec/5-system/1-auth.md §"비밀번호 저장"`
 * — bcrypt (cost factor ≥ 12), `user.password_hash` 는 nullable (OAuth-only
 * 사용자는 NULL).
 *
 * 본 헬퍼는 그 invariant 의 application-level enforcement 용. `User` entity 의
 * `@BeforeInsert/@BeforeUpdate` hook 이 본 함수로 raw string 형태의 잘못된
 * passwordHash 저장을 차단한다 (ai-review PR #301 security W1 후속).
 *
 * bcrypt hash 포맷:
 *   `$2[aby]$<rounds:2자리>$<salt:22자> + <hash:31자>` — 총 60자.
 *   - 합법 prefix: `$2a$` (legacy), `$2b$` (현행 bcrypt), `$2y$` (PHP 호환).
 *     `$2x$` / `$2z$` 등은 명세 외.
 *   - 22+31 = 53 char base64-like (`./A-Za-z0-9`).
 *
 * null / undefined / non-string 은 모두 false 반환. 호출자가 nullable 필드인
 * 경우 명시적으로 short-circuit 해야 한다 (예: entity hook 의 `value == null`
 * 사전 검사).
 */
const BCRYPT_HASH_REGEX = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

export function isValidBcryptHash(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  if (value.length !== 60) return false;
  return BCRYPT_HASH_REGEX.test(value);
}
