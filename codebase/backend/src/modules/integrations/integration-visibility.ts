import type { Integration } from './entities/integration.entity';

/**
 * 통합이 요청자에게 **보이는가** — `spec/2-navigation/4-integration.md` §8 판정 규칙.
 *
 * Personal 통합은 생성자(`created_by`)에게만 보인다. 역할 우위가 없다 — Owner · Admin 도 남의 personal 을 보거나
 * 바꾸지 못한다. 보이지 않는 통합은 **없는 통합과 같다**: 목록에서 빠지고 `:id` 경로는 부재와 같은 404 를 낸다.
 * Organization 통합은 워크스페이스 멤버 모두에게 보인다(변경은 Admin 이상 — 그 판정은 호출부의 몫이다).
 *
 * 같은 규칙을 SQL 로 옮긴 것이 {@link integrationVisibilityClause} 다. 둘은 한 규칙의 두 표현이라 이 파일에 함께 둔다.
 */
export function isIntegrationVisibleTo(
  row: Pick<Integration, 'scope' | 'createdBy'>,
  userId: string,
): boolean {
  return row.scope !== 'personal' || row.createdBy === userId;
}

/**
 * {@link isIntegrationVisibleTo} 의 SQL 표현 — QueryBuilder 의 `andWhere` 에 넣는다. 파라미터 이름은
 * {@link INTEGRATION_VIEWER_PARAM} 이고 값은 요청자 id 다.
 *
 * 목록을 메모리에서 거르지 않고 SQL 로 거르는 이유: 페이지네이션의 `total` · `limit` 이 남의 personal 을 세면 안 된다.
 */
export function integrationVisibilityClause(alias: string): string {
  return `(${alias}.scope <> 'personal' OR ${alias}.created_by = :${INTEGRATION_VIEWER_PARAM})`;
}

export const INTEGRATION_VIEWER_PARAM = 'integrationViewerId';
