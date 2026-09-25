import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  ADMIN_ROLES,
  ROLE_REQUIRED,
} from '../../common/constants/workspace-roles';
import type { Integration } from './entities/integration.entity';

/*
 * 통합의 가시성 · 변경 판정 — `spec/2-navigation/4-integration.md` §8 판정 규칙. `IntegrationsService`(요청 경로)와
 * `IntegrationOAuthService`(재인증 콜백의 커밋 직전 재판정)가 같은 판정 · 같은 응답을 쓰도록 순수 함수로 둔다 — 두 서비스는
 * 서로를 주입하지 못한다(`IntegrationsService` 가 OAuth 서비스를 주입한다).
 */

/**
 * 통합이 요청자에게 **보이는가**.
 *
 * Personal 통합은 생성자(`created_by`)에게만 보인다. 역할 우위가 없다 — Owner · Admin 도 남의 personal 을 보거나
 * 바꾸지 못한다. 보이지 않는 통합은 **없는 통합과 같다**: 목록에서 빠지고 `:id` 경로는 부재와 같은 404 를 낸다
 * ({@link integrationNotFoundError}). Organization 통합은 워크스페이스 멤버 모두에게 보인다(변경은 Admin 이상 —
 * {@link assertOrgScopeModifiable}).
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
 * {@link INTEGRATION_USER_PARAM} 이고 값은 요청자 id 다.
 *
 * 목록을 메모리에서 거르지 않고 SQL 로 거르는 이유: 페이지네이션의 `total` · `limit` 이 남의 personal 을 세면 안 된다.
 */
export function integrationVisibilityClause(alias: string): string {
  return `(${alias}.scope <> 'personal' OR ${alias}.created_by = :${INTEGRATION_USER_PARAM})`;
}

export const INTEGRATION_USER_PARAM = 'integrationUserId';

/**
 * «없다» — 없는 통합과 남의 personal 이 **같은** 응답을 받는다(구별되면 존재를 드러낸다). 같은 리터럴이 두 서비스에
 * 흩어지지 않도록 여기서만 만든다.
 */
export function integrationNotFoundError(): NotFoundException {
  return new NotFoundException({
    code: 'RESOURCE_NOT_FOUND',
    message: 'Integration not found',
  });
}

/**
 * Admin 이 필요한 통합 동작 — 거부 문구의 동사를 고른다. 판정 자체는 동작과 무관하다.
 * `change-scope` 만 Organization 여부와 무관하게 늘 Admin 이다(범위 전환은 Admin 동작).
 */
export type IntegrationModifyAction =
  | 'create'
  | 'modify'
  | 'delete'
  | 'rotate'
  | 'reauthorize'
  | 'request-scopes'
  | 'change-scope';

const ADMIN_ACTION_PHRASE: Record<IntegrationModifyAction, string> = {
  create: 'Organization 통합을 만들려면',
  modify: 'Organization 통합을 수정하려면',
  delete: 'Organization 통합을 삭제하려면',
  rotate: 'Organization 통합의 자격 증명을 교체하려면',
  reauthorize: 'Organization 통합을 재인증하려면',
  'request-scopes': 'Organization 통합에 scope 를 추가하려면',
  'change-scope': '통합의 범위를 전환하려면',
};

/**
 * Admin 거부 — 라우트 가드의 역할 거부와 **같은 코드 · 같은 문구**(`ROLE_REQUIRED.admin`, 한국어)에 동작을 앞에 붙인다.
 * 프런트엔드는 이 메시지를 그대로 토스트로 보인다 — 공유 문구를 영문으로 덮어쓰면 한국어 화면에 영문이 뜬다.
 */
export function adminRequiredError(
  action: IntegrationModifyAction,
): ForbiddenException {
  return new ForbiddenException({
    ...ROLE_REQUIRED.admin,
    message: `${ADMIN_ACTION_PHRASE[action]} ${ROLE_REQUIRED.admin.message}`,
  });
}

/**
 * Organization 통합의 변경은 Admin 이상이다. Personal 통합은 여기서 막지 않는다 — 보이는 personal 은 본인 것이고 본인은
 * 역할과 무관하게 바꾼다(가시성은 {@link isIntegrationVisibleTo} 가 먼저 본다).
 */
export function assertOrgScopeModifiable(
  row: Pick<Integration, 'scope'>,
  userRole: string | null,
  action: IntegrationModifyAction,
): void {
  if (row.scope !== 'organization') return;
  if (userRole && ADMIN_ROLES.has(userRole)) return;
  throw adminRequiredError(action);
}
