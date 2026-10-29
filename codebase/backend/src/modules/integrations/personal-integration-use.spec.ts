import {
  PERSONAL_INTEGRATION_USE_REJECTIONS,
  isLiteralReference,
  isPersonalIntegration,
  judgePersonalIntegrationUse,
  type PersonalIntegrationUseFacts,
} from './personal-integration-use';

/**
 * CLE-INT-MANAGE 「개인 통합 사용 판정」 — 조건 넷과 경로 넷의 진리표. 이유가 여럿이면 목록에서 먼저 나온 것을 돌려준다.
 */
const OWNER = 'owner';
const OTHER = 'other';

describe('judgePersonalIntegrationUse', () => {
  describe('execution — 작성자 · 소유자 멤버십 · 표현식', () => {
    const base = {
      path: 'execution' as const,
      integrationOwnerId: OWNER,
      workflowAuthorId: OWNER,
      ownerIsMember: true,
      fromExpression: false,
    };

    it.each<[string, Partial<typeof base>, string | null]>([
      ['작성자 = 소유자 · 멤버 · 리터럴 → 통과', {}, null],
      [
        '작성자를 알 수 없음',
        { workflowAuthorId: null } as never,
        'workflow_author_unknown',
      ],
      [
        '작성자 ≠ 소유자',
        { workflowAuthorId: OTHER },
        'workflow_author_not_owner',
      ],
      ['소유자가 멤버가 아님', { ownerIsMember: false }, 'owner_not_member'],
      ['표현식 참조', { fromExpression: true }, 'expression_ref'],
      [
        '작성자 ≠ 소유자 이면서 표현식 → 앞선 이유',
        { workflowAuthorId: OTHER, fromExpression: true },
        'workflow_author_not_owner',
      ],
      [
        '작성자 불명 이면서 멤버 아님 → 앞선 이유',
        { workflowAuthorId: null, ownerIsMember: false } as never,
        'workflow_author_unknown',
      ],
      [
        '멤버 아님 이면서 표현식 → 앞선 이유',
        { ownerIsMember: false, fromExpression: true },
        'owner_not_member',
      ],
    ])('%s', (_label, override, expected) => {
      expect(judgePersonalIntegrationUse({ ...base, ...override })).toBe(
        expected,
      );
    });
  });

  describe('save — 작성자 · 저장자', () => {
    const base = {
      path: 'save' as const,
      integrationOwnerId: OWNER,
      workflowAuthorId: OWNER,
      saverId: OWNER,
    };

    it.each<[string, Partial<typeof base>, string | null]>([
      ['저장자 = 작성자 = 소유자 → 통과', {}, null],
      ['저장자 ≠ 소유자', { saverId: OTHER }, 'saver_not_owner'],
      [
        '작성자 ≠ 소유자(저장자는 소유자)',
        { workflowAuthorId: OTHER },
        'workflow_author_not_owner',
      ],
      [
        '작성자 ≠ 소유자 이면서 저장자 ≠ 소유자 → 앞선 이유',
        { workflowAuthorId: OTHER, saverId: OTHER },
        'workflow_author_not_owner',
      ],
    ])('%s', (_label, override, expected) => {
      expect(judgePersonalIntegrationUse({ ...base, ...override })).toBe(
        expected,
      );
    });
  });

  describe('clone — 요청자가 새 작성자', () => {
    it.each<[string, string | null, string | null]>([
      ['요청자 = 소유자 → 통과', OWNER, null],
      ['요청자 ≠ 소유자', OTHER, 'workflow_author_not_owner'],
      ['작성자 불명', null, 'workflow_author_unknown'],
    ])('%s', (_label, author, expected) => {
      expect(
        judgePersonalIntegrationUse({
          path: 'clone',
          integrationOwnerId: OWNER,
          workflowAuthorId: author,
        }),
      ).toBe(expected);
    });
  });

  describe('restore — 작성자 · 소유자 멤버십', () => {
    it.each<[string, string, boolean, string | null]>([
      ['작성자 = 소유자 · 멤버 → 통과', OWNER, true, null],
      ['작성자 ≠ 소유자', OTHER, true, 'workflow_author_not_owner'],
      ['소유자가 멤버가 아님', OWNER, false, 'owner_not_member'],
    ])('%s', (_label, author, ownerIsMember, expected) => {
      expect(
        judgePersonalIntegrationUse({
          path: 'restore',
          integrationOwnerId: OWNER,
          workflowAuthorId: author,
          ownerIsMember,
        }),
      ).toBe(expected);
    });
  });

  it('저장 · 복제 · 복원은 표현식 여부를 보지 않는다 — 사실에 그 칸이 없다', () => {
    const facts: PersonalIntegrationUseFacts[] = [
      {
        path: 'save',
        integrationOwnerId: OWNER,
        workflowAuthorId: OWNER,
        saverId: OWNER,
      },
      { path: 'clone', integrationOwnerId: OWNER, workflowAuthorId: OWNER },
      {
        path: 'restore',
        integrationOwnerId: OWNER,
        workflowAuthorId: OWNER,
        ownerIsMember: true,
      },
    ];
    for (const f of facts) {
      expect(judgePersonalIntegrationUse(f)).toBeNull();
    }
  });

  it('이유 목록은 스펙 순서다', () => {
    expect(PERSONAL_INTEGRATION_USE_REJECTIONS).toEqual([
      'workflow_author_unknown',
      'workflow_author_not_owner',
      'saver_not_owner',
      'owner_not_member',
      'expression_ref',
    ]);
  });
});

describe('isLiteralReference', () => {
  const ID = '11111111-1111-4111-8111-111111111111';
  it.each<[string, unknown, unknown, boolean]>([
    ['원본 = 평가값 문자열 → 리터럴', ID, ID, true],
    ['템플릿 원본 → 표현식', '{{ $vars.integration }}', ID, false],
    ['이스케이프 원본 → 표현식', '\\{\\{x}}', '{{x}}', false],
    ['원본 없음 → 표현식', undefined, ID, false],
    ['원본 null → 표현식', null, ID, false],
    ['원본이 문자열 아님 → 표현식', 42, 42, false],
    ['원본 객체 → 표현식', { id: ID }, ID, false],
  ])('%s', (_label, raw, evaluated, expected) => {
    expect(isLiteralReference(raw, evaluated)).toBe(expected);
  });
});

describe('isPersonalIntegration', () => {
  it.each([
    ['personal', true],
    ['organization', false],
  ])('%s → %s', (scope, expected) => {
    expect(isPersonalIntegration({ scope })).toBe(expected);
  });
});
