import type { Integration } from './entities/integration.entity';

/*
 * 개인 통합 사용 판정 — 노드가 개인 통합을 쓸 수 있는가(CLE-INT-MANAGE 「개인 통합 사용 판정」). 누가 통합을 **보는가**
 * (`integration-visibility.ts`)와는 다른 판정이다. 저 판정은 요청자만 보고, 이 판정은 노드가 속한 워크플로우의 작성자를 본다.
 *
 * 실행 시점 조회, 노드 설정 저장 검사, 복제 · 가져오기 · 버전 복원의 참조 비우기가 모두 이 함수 하나를 쓴다. 함수는 저장소를
 * 읽지 않는다. 부르는 쪽이 경로에 필요한 사실을 모아 넘긴다. 조직 통합은 이 판정을 거치지 않는다({@link isPersonalIntegration}).
 */

/**
 * 판정을 통과하지 못한 이유. 서버 로그에만 쓰고 응답 · 노드 출력에는 싣지 않는다(없는 통합과 같아야 한다).
 * 이유가 여럿이면 이 순서에서 먼저 나온 것을 돌려준다.
 */
export const PERSONAL_INTEGRATION_USE_REJECTIONS = [
  'workflow_author_unknown',
  'workflow_author_not_owner',
  'saver_not_owner',
  'owner_not_member',
  'expression_ref',
] as const;

export type PersonalIntegrationUseRejection =
  (typeof PERSONAL_INTEGRATION_USE_REJECTIONS)[number];

interface CommonFacts {
  /** 통합의 `created_by`. */
  integrationOwnerId: string;
  /**
   * 노드가 속한 워크플로우의 `created_by`. 복제 · 가져오기는 요청자(새 워크플로우의 작성자)다. 알 수 없으면 `null` 이다
   * (REQ-INTMGMT-055).
   */
  workflowAuthorId: string | null;
}

/**
 * 경로마다 보는 조건이 다르다. 경로 종류와 그 경로가 모은 사실을 한 값으로 받아, 경로에 없는 사실을 빠뜨리거나 잘못 넣지 못하게 한다.
 *
 * - `execution`: 실행 시점 조회. 작성자 · 소유자 멤버십 · 표현식 여부를 본다.
 * - `save`: 노드 생성 · 노드 설정 수정 · 캔버스 저장. 작성자와 저장자를 본다. 저장자 조건이 멤버십을 대신한다.
 * - `clone`: 복제 · 가져오기. 작성자(요청자)만 본다.
 * - `restore`: 버전 복원. 작성자와 소유자 멤버십을 본다.
 */
export type PersonalIntegrationUseFacts =
  | (CommonFacts & {
      path: 'execution';
      ownerIsMember: boolean;
      fromExpression: boolean;
    })
  | (CommonFacts & { path: 'save'; saverId: string })
  | (CommonFacts & { path: 'clone' })
  | (CommonFacts & { path: 'restore'; ownerIsMember: boolean });

export type PersonalIntegrationUsePath = PersonalIntegrationUseFacts['path'];

/**
 * 실행 시점 조회에 부르는 쪽이 넘기는 인자(CLE-NODE-INT-COMMON 「IntegrationsService API (실행 엔진용)」).
 * `nodeId` 는 지금 실행 중인 노드이고 `fromExpression` 은 참조 값이 평가 전 원본과 같은 리터럴이 아니었는지다.
 */
export interface IntegrationUse {
  nodeId: string | null;
  fromExpression: boolean;
}

/**
 * 참조 값이 리터럴인가(CLE-NODE-INT-COMMON 「IntegrationsService API (실행 엔진용)」). 평가 전 원본이 문자열이고 평가한 값과
 * 같을 때만 리터럴이다. 원본이 없거나 문자열이 아니면 표현식으로 본다. 템플릿(`{{ }}`)과 이스케이프한 `\{\{` 는 평가하면 값이
 * 달라지므로 따로 보지 않아도 표현식이 된다.
 */
export function isLiteralReference(raw: unknown, evaluated: unknown): boolean {
  return typeof raw === 'string' && raw === evaluated;
}

export function isPersonalIntegration(
  row: Pick<Integration, 'scope'>,
): boolean {
  return row.scope === 'personal';
}

/** 개인 통합을 그 경로에서 쓸 수 있으면 `null`, 아니면 통과하지 못한 이유 하나를 돌려준다. */
export function judgePersonalIntegrationUse(
  facts: PersonalIntegrationUseFacts,
): PersonalIntegrationUseRejection | null {
  if (facts.workflowAuthorId === null) return 'workflow_author_unknown';
  if (facts.workflowAuthorId !== facts.integrationOwnerId) {
    return 'workflow_author_not_owner';
  }
  if (facts.path === 'save' && facts.saverId !== facts.integrationOwnerId) {
    return 'saver_not_owner';
  }
  if (
    (facts.path === 'execution' || facts.path === 'restore') &&
    !facts.ownerIsMember
  ) {
    return 'owner_not_member';
  }
  if (facts.path === 'execution' && facts.fromExpression) {
    return 'expression_ref';
  }
  return null;
}
