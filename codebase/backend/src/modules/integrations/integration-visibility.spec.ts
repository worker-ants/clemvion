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
   * 문구는 동작을 말하는 영문이다. 한국어 화면은 프런트엔드가 `ADMIN_REQUIRED` 코드로 문구를 고른다
   * (CLE-UI-I18N-BACKEND 규칙 5, NERV Task `CLE-T-CHP94Z`).
   */
  it.each([
    ['create', 'create an Organization integration'],
    ['modify', 'modify an Organization integration'],
    ['delete', 'delete an Organization integration'],
    ['rotate', 'rotate the credentials of an Organization integration'],
    ['reauthorize', 'reauthorize an Organization integration'],
    ['request-scopes', 'add scopes to an Organization integration'],
    ['change-scope', 'change the scope of an integration'],
  ] as const)('%s — 403 ADMIN_REQUIRED · «… to %s.»', (action, phrase) => {
    const err = adminRequiredError(action);
    expect(err.getStatus()).toBe(403);
    expect(err.getResponse()).toEqual({
      code: ROLE_REQUIRED.admin.code,
      message: `Admin role or higher is required to ${phrase}.`,
    });
  });
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
