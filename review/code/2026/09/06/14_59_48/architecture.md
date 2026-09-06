# 아키텍처(Architecture) 리뷰

## 발견사항

- **[WARNING]** `TriggersService` 의 신규 PG 에러 판별 함수가 이미 존재하는 SoT 헬퍼를 재사용하지 않고 스캐터된 duck-typing 패턴을 또 하나 늘렸다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:209-221` (`TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX`, `isEndpointPathUniqueViolation`)
  - 상세: 이 저장소에는 정확히 이 문제("TypeORM `QueryFailedError` 의 wrap 깊이가 호출 경로마다 달라 `err.code`/`err.driverError.code` 를 곳곳에서 각자 검사하던 상태")를 없애려고 만든 SoT 헬퍼 `codebase/backend/src/common/db/pg-error.ts` 의 `pgErrorCode`/`isPostgresUniqueViolation` 이 이미 있다(그 파일 자신의 docstring 이 이 문제를 정확히 그렇게 서술한다). 그런데 이번에 새로 추가된 `isEndpointPathUniqueViolation` 은 그 헬퍼를 import 하지 않고 `err instanceof QueryFailedError` → `err.driverError?.code === '23505'` 를 처음부터 다시 손으로 짰다. 같은 모양의 로컬 재구현이 이미 `codebase/backend/src/common/filters/http-exception.filter.ts:17-23`(`isUniqueViolation`)과 `codebase/backend/src/modules/workspaces/workspace-invitations.service.ts:551-558`에 각각 존재해, 이번 추가로 **동일 로직의 4번째 독립 사본**이 생겼다. `triggers.service.ts` 는 `common/` 하위 다른 유틸을 이미 다양하게 import 하고 있어 순환 의존 위험 없이 바로 재사용 가능했다(예: `isPostgresUniqueViolation(err)` 로 SQLSTATE 판정을 위임하고 `constraint` 비교만 이 파일에 남기는 형태). SoT 헬퍼가 있는데도 새 코드가 그것을 우회하면, 다음에 wrap 깊이 처리 로직이 바뀔 때 이 4곳을 전부 손으로 찾아 고쳐야 하고, 그중 하나를 놓쳐도 컴파일러가 알려주지 않는다.
  - 제안: `isEndpointPathUniqueViolation` 의 SQLSTATE 판정 부분을 `pgErrorCode(err) === '23505'` 또는 `isPostgresUniqueViolation(err)` 호출로 교체하고, `constraint` 비교만 이 파일 고유 로직으로 남긴다. 여유가 있다면 `pg-error.ts` 에 `pgErrorConstraint(err)` 를 추가해 `http-exception.filter.ts`/`workspace-invitations.service.ts`/`integrations.service.ts` 의 기존 3개 사본도 점진적으로 그쪽으로 모은다.

- **[WARNING]** 같은 PR 안에서 신설한 두 형제 가드가 "이름 목록을 손으로 적지 말고 소스에서 파생하라"는, 이 PR 자신이 세운 원칙을 서로 다르게 따른다
  - 위치: `codebase/backend/src/shared/testing/user-secret-absence.ts:24-32` (`USER_SECRET_KEYS` 리터럴 배열) vs `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts:158-166` (`collectUserRelationNames` — 엔티티 AST 에서 파생)
  - 상세: `user-entity-exposure-guard.ts` 의 JSDoc(158~166줄 인근)은 "첫 판이 관계 이름을 손으로 나열해서(`user`/`creator`/`owner`) `executor`(`Execution.executor: User`)를 놓쳤고, 그래서 목록을 넓히는 대신 엔티티 선언을 SoT 로 삼아 파생시키는 쪽으로 설계를 바꿨다"고 명시적으로 기록한다. 그런데 같은 커밋에서 함께 도입된 값-기반 자매 가드 `user-secret-absence.ts` 의 `USER_SECRET_KEYS` 는 정확히 그 "손으로 적은 목록" 형태로 되돌아가 있다 — `user.entity.ts` 의 민감 컬럼 선언과 이 목록을 대조하는 테스트가 저장소 어디에도 없다(`user-secret-absence.spec.ts` 전체 확인, 대조 테스트 0건). 파일 자신의 주석("엔티티에 민감 컬럼을 추가하면 여기에도 넣는다")도 이 동기화가 사람 기억에 의존함을 인정한다. 이 가드가 막으려는 실패 형태 자체가 "누가 컬럼을 추가했는데 방어를 안 넣었다"이므로, 방어 목록의 갱신도 같은 방식으로 깜빡일 수 있는 지점을 남긴 것은 이 가드의 존재 이유와 정면으로 부딪힌다. (구조 축 가드는 이미 이 교훈을 실측 근거로 설계에 반영했는데, 값 축 가드에는 옮겨지지 않았다.)
  - 제안: `user.entity.ts` 를 AST 로 스캔해 `select: false` 가 없고 이름이 비밀스러운 패턴(`*Token`/`*Secret`/`*Hash`/`*RecoveryCodes` 등)인 컬럼 목록을 뽑아 `USER_SECRET_KEYS` 와 대조하는 테스트를 추가하거나, 최소한 엔티티의 컬럼 이름 전체 개수를 상수로 박아 "엔티티 컬럼 수가 바뀌면 이 스펙이 실패한다"는 낮은 수준의 카나리아라도 둔다.

- **[INFO]** `WorkflowVersionDetail`/`WorkflowVersionListItem` 이 프런트엔드에 손으로 미러링된 동명 타입과 공유 계약 없이 계속 갈라지고 있다
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:46-64` (`WorkflowVersionDetail` 선언과 그 위 주석) vs `codebase/frontend/src/lib/api/workflows.ts:109` (`WorkflowVersionDetail`)
  - 상세: 이 PR 의 주석이 스스로 밝히듯 두 선언은 이름은 같지만 이제 형태가 다르다 — 백엔드는 `creator: { id, name, email }` 3필드 고정으로 좁혔고 프런트엔드는 `creator?: { id, name?, email? } | null` 로 더 넓게 남아 있다. `codebase/packages/` 에는 이미 여러 공유 계약 패키지(`sdk`, `web-chat-sdk`, `node-summary` 등)가 있어 FE/BE 타입을 패키지로 공유하는 선례가 있는데, 이 API 표면은 그 경계 밖에 있다. 동일 이름의 독립 선언이 두 레이어에 존재하면 `grep` 기반 "유일 정의" 판단이 갈리기 쉽다는 것이 이미 이 저장소에서 3라운드 연속 오판으로 실증됐다(주석이 인용하는 `review/consistency/2026/09/06/13_39_25` W3). 이번 변경으로 divergence 가 한 단계 더 벌어졌으므로, 향후 이 타입을 또 만질 때 같은 오판이 반복될 여지가 커졌다.
  - 제안: 이번 PR 범위는 아니지만(주석에도 명시), 다음에 이 API 응답 형태를 만질 때는 `codebase/packages/` 에 공유 타입을 옮기거나 최소한 이름을 `BackendWorkflowVersionDetail`/`FrontendWorkflowVersionDetail` 처럼 갈라 "동명이지만 다른 것"임을 이름에서부터 드러내는 것을 고려.

## 요약

핵심 신규 산출물(구조 축 `user-entity-exposure-guard.ts` + 값 축 `user-secret-absence.ts`, `dto-jsdoc-citation-guard.ts`, `WorkflowVersionsService` 의 `CREATOR_PROJECTION`/`rethrowEndpointPathConflict`)은 전반적으로 이 저장소의 기존 아키텍처 관례(순수 스캔 로직과 소비 spec 분리, DTO 판정 로직 재사용 — `dto-jsdoc-citation-guard.ts` 가 `isResponseDtoFile` 을 새로 안 짜고 `swagger-dto-contract-guard.ts` 에서 재사용, 서비스 계층에서 영속성 예외를 도메인 예외로 번역하는 계층 분리, DTO 스키마와 상수를 코드로 대조하는 fitness-function 테스트)을 잘 따르고 있고, `select:false` vs 전역 인터셉터를 기각한 근거(19곳 공유 깔때기·46개 호출지점·fail-silent 인증 위험)도 실측에 근거해 타당하다. 다만 두 가지는 이 PR 이 내세우는 "재발 방지" 철학과 어긋난다: (1) 이미 SoT 로 지정된 `common/db/pg-error.ts` 를 우회해 PG 에러 판별 duck-typing 을 4번째로 손수 복제했고, (2) 구조 축 가드가 실측으로 배운 "이름을 손으로 나열하지 말고 소스에서 파생하라"는 교훈이 같은 커밋의 값 축 가드(`USER_SECRET_KEYS`)에는 적용되지 않아 그 목록 자체가 이 방어가 막으려는 것과 같은 종류의 누락에 노출돼 있다. FE/BE 타입 미러 divergence 는 기존에 알려진 부채이고 이번 PR 이 투명하게 disclose 했으므로 참고 수준으로 남긴다.

## 위험도

MEDIUM
