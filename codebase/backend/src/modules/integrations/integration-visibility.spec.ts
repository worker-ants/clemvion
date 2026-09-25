import {
  INTEGRATION_USER_PARAM,
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
