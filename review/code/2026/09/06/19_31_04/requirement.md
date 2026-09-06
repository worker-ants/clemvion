# 요구사항(Requirement) 리뷰

## 개요

대상 브랜치(`claude/user-entity-column-defense`, `origin/main` 대비 14개 커밋)는 `User` 엔티티
민감 컬럼(7개: `passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·
`emailVerifyToken`·`passwordResetToken`·`emailChangeToken`) 노출을 검출하는 2축 가드
(`user-entity-exposure-guard.ts` 구조 축, `user-secret-absence.ts` 이름 축)를 신설하고,
그 과정에서 실제로 살아있던 유출(`WorkflowVersionsService.findOne` 이 `creator: User` 를
투영 없이 로드해 컨트롤러가 그대로 반환)을 찾아 고쳤다. 부수적으로 `pg-error.ts` 두 표면
(SoT) 확장(`pgErrorConstraint`), 트리거 `endpointPath` UNIQUE 충돌의 문서화된 409 계약
구현, `WorkspaceMemberDto.joinedAt` 필드 추가, DTO JSDoc 리뷰-인용 가드의 사각 보완이
같은 브랜치에 포함돼 있다. 커밋 이력을 보면 십수 라운드의 review→fix 순환을 거쳤고, 각
라운드가 스스로 발견한 결함을 실측(뮤테이션·프로브)과 함께 좁혀 온 흔적이 코드 자체의
JSDoc/주석에 남아 있다.

핵심 파일들을 직접 열어 대조한 결과는 다음과 같다.

- **`user-entity-exposure-guard.ts`/`.spec.ts`**: `collectUserRelationNames` 가 엔티티
  타입 주석에서 `User` 관계 이름을 파생(`creator`/`executor`/`owner`/`user` 4개, 손으로
  적은 목록이 아님)하고, `findUserRelationLoads` 가 `relations` 배열·객체(중첩 포함)·
  `leftJoinAndSelect`/`innerJoinAndSelect` 세 형태를 AST 로 스캔한다. `select` 로 좁힌
  자리, `leftJoin`+`addSelect`(정상 형태, `executions.service.ts`/`dashboard.service.ts`
  의 `executor` 사용이 실제로 이 형태임을 grep 으로 확인)는 대상에서 제외된다. eager 축은
  별도(`findEagerUserRelations`)로 데코레이터를 직접 보며, 프로덕션 0건을 계약으로 고정하고
  fixture 로 검출력(무력화 뮤테이션 시 fail)까지 확인한다. `EXPECTED_USER_RELATION_LOADS`
  베이스라인 3건(`logout`/`refresh`/`listMembers`)은 안전 사유가 항목별로 다르다는 것까지
  코드가 명시(`listMembers` 는 JS 단 수동 매핑이라 이 가드가 못 지키고, e2e
  `expectNoUserSecrets` 가 유일한 안전망이라고 스스로 적음) — 실제로
  `workspace-rbac.e2e-spec.ts` 의 `J.` 테스트가 그 안전망 역할을 한다.
- **`WorkflowVersionsService`**: `ProjectedCreator = Pick<User,'id'|'name'|'email'>` 로
  `findOne`/`findByWorkflow` 양쪽에 `select` 투영을 적용해 실제 유출을 닫았고,
  `workflow-crud.e2e-spec.ts:559` 가 `expectNoUserSecrets(detail.body)` 로 회귀를 고정한다.
- **`user-secret-absence.ts`**: `USER_SECRET_KEYS` 7개가 `user.entity.ts` 의 실제 민감
  컬럼 7개와 정확히 일치(직접 대조 완료, 다른 후보 필드 없음). `findUserSecretLeaks` 는
  camelCase/snake_case 양쪽, 배열·중첩 객체를 재귀로 훑는다.
- **`triggers.controller.ts`/`triggers.service.ts`**: `spec/2-navigation/2-trigger-list.md
  §3`(`164` 행)이 정의한 "409 `RESOURCE_CONFLICT` (세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`,
  `details.field='endpoint_path'`)"를 `rethrowEndpointPathConflict`(`triggers.service.ts`)가
  정확히 그 필드명·코드로 구현하고, `create`/`update` 두 경로 모두에 `@ApiConflictResponse`
  가 그 문구 그대로 달렸다. `isEndpointPathUniqueViolation` 은 인덱스 이름(`
  idx_trigger_workspace_endpoint`)으로 좁혀 다른 UNIQUE 위반과 구분하며, 두 wrap 표면
  (`driverError`/`top`)·다른 인덱스 위반·비-unique 오류 세 방향 모두 `triggers.service.spec.ts`
  에 대칭 테스트가 있다.
- **`WorkspaceMemberDto.joinedAt`**: `spec/5-system/2-api-convention.md §5.4`(부재 표현 —
  null vs 키 생략)의 "상시 존재 → `@ApiProperty({ nullable: true })` + `field: T | null`"
  규칙과 정확히 일치. "네 자리가 전부 `joinedAt: new Date()`" 주장을 `workspaces.service.ts`
  (3곳: 65/184/262행)·`workspace-invitations.service.ts`(471행) 전수 확인해 정확함을 검증.
- **`dto-jsdoc-citation-guard.ts`**: 직전 라운드에서 지적된 "bare 시각은 백틱 두른 형태만
  본다" 결함이 `/(?<![\w\/-])\d{2}_\d{2}_\d{2}(?![\w-])/` 로 수정돼 있고, fixture
  (`ViolationBareTimeNoBacktickDto`)와 "세 형태 각각 최소 1회 관측" 단언이 함께 있어 회귀를
  막는다.
- **`pg-error.ts`/`pg-error-fixtures.ts`**: `pgErrorConstraint` 가 `pgErrorCode` 와 동일하게
  `driverError`/최상위 두 표면을 흡수하고, fixture SoT(`pg-error-fixtures.ts`)를 통해
  `pg-error.spec.ts`·`triggers.service.spec.ts` 양쪽이 같은 헬퍼를 공유한다(손 복제 재발
  방지).

## 발견사항

- **[INFO]** `http-exception.filter.ts` 의 전역 `isUniqueViolation` 이 `pg-error.ts` SoT
  (두 표면 흡수)를 쓰지 않고 `instanceof QueryFailedError` 를 먼저 요구해, raw 표면 SQLSTATE
  23505 가 이론상 500 으로 샐 수 있는 구조적 불일치가 남아 있다. 이번 PR의 변경 파일에는
  포함되지 않으며, `plan/in-progress/spec-draft-nullable-notation-followups.md:490-508`
  에 실측된 blast radius(~0, 요청 경로에 우리 스키마를 치는 raw query 없음)와 함께 명시적으로
  등재·이연돼 있다.
  - 위치: (참고, 본 PR 변경 범위 밖) `codebase/backend/src/common/filters/http-exception.filter.ts`
  - 상세: 코드 결함은 아니고 이연 사유가 근거와 함께 문서화돼 있어 조치 불요. 다음에 이 파일을
    건드릴 때 `isPostgresUniqueViolation(err)` 로 교체하도록 등재된 항목을 그대로 두면 된다.
  - 제안: 조치 불요(다음 담당자가 등재 항목을 참조).

- **[INFO]** `integration-oauth.service.ts` 의 손-작성 constraint 추출 2곳이 신설된
  `pgErrorConstraint()` 로 치환 가능하지만 이번 PR 범위에서 제외됐다. 이미 두 표면을 정확히
  보고 있어(동작 정상) 위험은 없고 중복만 남은 상태이며, 같은 plan 문서 526-538행에 등재돼
  있다. 조치 불요.

- **[INFO]** spec fidelity 교차검증 결과 이번 PR 변경 범위(트리거 409 계약, `WorkspaceMemberDto.
  joinedAt`, `User` 컬럼 방어 2축)는 관련 spec 본문(`spec/2-navigation/2-trigger-list.md §3`,
  `spec/5-system/2-api-convention.md §5.4`)과 필드명·에러 코드·기본형 선택 모두 line-level 로
  일치한다. `User` 컬럼 방어 자체는 spec 문서로 정의된 항목이 아니라 `plan/in-progress/
  spec-draft-nullable-notation-followups.md` 에 등재된 조사·구현 항목이며, 그 항목이 요구한
  선행 실측(7컬럼 읽는 자리 전수·`select:false` vs 인터셉터 비교)을 그대로 수행한 뒤 셋째
  대안(구조+이름 검출)을 근거와 함께 명시적으로 택했다. spec 본문 자체의 결함은 발견되지
  않았다.

발견된 CRITICAL/WARNING 급 요구사항 결함은 없다. 핵심 기능(User 컬럼 노출 검출 2축, 트리거
409 계약, DTO 부재 표현)의 완전성·엣지 케이스(빈 값·다른 인덱스·다른 wrap 표면·eager
관계·중첩 객체)·에러 시나리오·반환값·spec 정합성을 각각 대조했고 전부 일치했다. 코드 안에
남은 TODO/FIXME/HACK/XXX 는 diff 전체에서 0건이며, "미완성"으로 보이는 부분은 모두 사유·
실측과 함께 `plan/in-progress/` 로 명시적으로 이연된 것이지 방치된 것이 아니다.

## 요약

이번 변경은 `User` 엔티티 민감 컬럼 노출 방어라는 목표를 완전하게 구현했다 — 실제 유출
지점(`WorkflowVersionsService.findOne`)을 찾아 투영으로 닫았고, 그 회귀를 막는 e2e·유닛
테스트가 모두 배선돼 있으며, 검출 가드 자체의 검출력(eager 축·bare 시각 정규식 등)도
무수정 프로브/뮤테이션으로 재확인됐다. 곁가지로 포함된 트리거 409 계약·`joinedAt` 필드는
관련 spec 본문과 필드명·코드·기본형 선택 모두 정확히 일치한다. 남은 두 이연 항목(전역 필터
SoT 미교체, integration-oauth 중복)은 현재 버그가 아니라 실측된 근거와 함께 후속으로 명시
등재돼 있어 이번 PR의 요구사항 충족도를 낮추지 않는다.

## 위험도

NONE
