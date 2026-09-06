/**
 * 응답 본문 **어디에도** `User` 의 민감 컬럼이 없음을 단언한다.
 *
 * ## 왜 계약 검증자로 충분하지 않은가
 *
 * `assertMatchesContract` 는 **선언과 대조**한다 — 선언되지 않은 키를 잡으므로 감사 로그의
 * 26키 유출을 실제로 잡았다. 그러나 그것은 **그 엔드포인트가 배선된 경우**에만이고, 배선은
 * 아직 전 엔드포인트에 닿지 않았다. 이 단언은 **선언과 무관하게** 이름만 보고 판정하므로
 * 배선 여부와 독립이다 — 누가 실수로 `passwordHash` 를 DTO 에 *선언까지* 해 버려도 잡는다.
 *
 * ## 왜 깊이 훑는가
 *
 * 유출은 최상위가 아니라 **중첩**에서 났다(`data.items[].user.passwordHash`). 최상위 키만
 * 보는 단언은 그 형태를 통째로 놓친다.
 */

/**
 * 응답에 절대 나타나서는 안 되는 `User` 컬럼 — `user.entity.ts` 의 민감 7컬럼.
 *
 * `select: false` 도 `@Exclude()` 도 없으므로(2026-09-06 실측) 이 목록이 **이름으로 거는
 * 유일한 그물**이다. 엔티티에 민감 컬럼을 추가하면 여기에도 넣는다 — 형제 가드
 * `user-entity-exposure-guard.ts` 는 *구조*를 보고 이쪽은 *값이 나간 결과*를 본다.
 */
export const USER_SECRET_KEYS = [
  'passwordHash',
  'twoFactorSecret',
  'totpRecoveryCodes',
  'webauthnRecoveryCodes',
  'emailVerifyToken',
  'passwordResetToken',
  'emailChangeToken',
] as const;

/** snake_case 로 나가는 경로(raw 쿼리 결과 등)도 함께 막는다. */
function snakeCase(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

const FORBIDDEN = new Set<string>([
  ...USER_SECRET_KEYS,
  ...USER_SECRET_KEYS.map(snakeCase),
]);

/** 발견된 위반 경로. 비어 있으면 통과. */
export function findUserSecretLeaks(body: unknown): string[] {
  const hits: string[] = [];
  const walk = (node: unknown, trail: string): void => {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, `${trail}[${i}]`));
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      const here = trail ? `${trail}.${key}` : key;
      if (FORBIDDEN.has(key)) hits.push(here);
      walk(value, here);
    }
  };
  walk(body, '');
  return hits;
}

/**
 * @param body 응답 본문 전체 (`res.body`). 봉투째 넘긴다 — `data` 만 보면 봉투의 다른
 *   가지로 새는 형태를 놓친다.
 */
export function expectNoUserSecrets(body: unknown): void {
  // 실패 메시지가 **어느 경로에서** 샜는지 말하도록 경로 배열로 단언한다.
  expect(findUserSecretLeaks(body)).toEqual([]);
}
