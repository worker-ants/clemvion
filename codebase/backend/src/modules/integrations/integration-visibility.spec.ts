import { ROLE_REQUIRED } from '../../common/constants/workspace-roles';
import {
  INTEGRATION_USER_PARAM,
  adminRequiredError,
  assertOrgScopeModifiable,
  integrationNotFoundError,
  integrationVisibilityClause,
  isIntegrationVisibleTo,
} from './integration-visibility';

/**
 * `spec/2-navigation/4-integration.md` §8 판정 규칙 — Personal 은 생성자(`created_by`)에게만 보이고, Organization 은
 * 워크스페이스 멤버 모두에게 보인다. 역할은 이 판정에 들어오지 않는다(시그니처에 없다).
 */
describe('isIntegrationVisibleTo', () => {
  it.each([
    ['personal · 생성자 본인', 'personal', 'user-1', true],
    ['personal · 다른 멤버', 'personal', 'user-2', false],
    ['organization · 생성자 본인', 'organization', 'user-1', true],
    ['organization · 다른 멤버', 'organization', 'user-2', true],
  ])('%s → %s', (_label, scope, viewer, expected) => {
    expect(isIntegrationVisibleTo({ scope, createdBy: 'user-1' }, viewer)).toBe(
      expected,
    );
  });
});

describe('integrationVisibilityClause', () => {
  it('별칭을 받아 같은 규칙을 SQL 로 — personal 이 아니거나 생성자가 요청자', () => {
    expect(integrationVisibilityClause('i')).toBe(
      `(i.scope <> 'personal' OR i.created_by = :${INTEGRATION_USER_PARAM})`,
    );
  });
});

describe('integrationNotFoundError', () => {
  it('없는 통합과 남의 personal 이 같은 응답 — 404 RESOURCE_NOT_FOUND', () => {
    const err = integrationNotFoundError();
    expect(err.getStatus()).toBe(404);
    expect(err.getResponse()).toEqual({
      code: 'RESOURCE_NOT_FOUND',
      message: 'Integration not found',
    });
  });
});

describe('adminRequiredError', () => {
  /**
   * 프런트엔드는 이 메시지를 그대로 토스트로 보인다 — 공유 거부 문구(`ROLE_REQUIRED.admin`, 한국어)에 동작을 앞에 붙인다.
   * 영문으로 덮어쓰면 한국어 화면에 영문이 뜬다(`/ai-review` `review/code/2026/09/25/23_23_40` CRITICAL 1).
   */
  it.each([
    ['create', 'Organization 통합을 만들려면'],
    ['modify', 'Organization 통합을 수정하려면'],
    ['delete', 'Organization 통합을 삭제하려면'],
    ['rotate', 'Organization 통합의 자격 증명을 교체하려면'],
    ['reauthorize', 'Organization 통합을 재인증하려면'],
    ['request-scopes', 'Organization 통합에 scope 를 추가하려면'],
    ['change-scope', '통합의 범위를 전환하려면'],
  ] as const)(
    '%s — 403 ADMIN_REQUIRED · «%s …» + 공유 문구',
    (action, phrase) => {
      const err = adminRequiredError(action);
      expect(err.getStatus()).toBe(403);
      expect(err.getResponse()).toEqual({
        code: ROLE_REQUIRED.admin.code,
        message: `${phrase} ${ROLE_REQUIRED.admin.message}`,
      });
    },
  );
});

describe('assertOrgScopeModifiable', () => {
  it.each(['owner', 'admin'])('Organization — %s 는 통과', (role) => {
    expect(() =>
      assertOrgScopeModifiable({ scope: 'organization' }, role, 'modify'),
    ).not.toThrow();
  });

  it.each([['editor'], ['viewer'], [null]])(
    'Organization — %s 는 ADMIN_REQUIRED',
    (role) => {
      expect(() =>
        assertOrgScopeModifiable({ scope: 'organization' }, role, 'delete'),
      ).toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'ADMIN_REQUIRED' }),
        }),
      );
    },
  );

  it.each([['viewer'], [null]])(
    'Personal — 역할과 무관하게 막지 않는다(%s) — 가시성은 따로 본다',
    (role) => {
      expect(() =>
        assertOrgScopeModifiable({ scope: 'personal' }, role, 'modify'),
      ).not.toThrow();
    },
  );
});
