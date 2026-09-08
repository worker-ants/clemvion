# 신규 식별자 충돌 검토 — spec/5-system (impl-done)

## 전제 확인

- scope(`spec/5-system`) 델타: **0개 파일** — 이 브랜치는 spec 문서를 변경하지 않았다. 따라서 "target 문서가 새로 부여하는 요구사항 ID·엔드포인트" 류의 신규 식별자는 spec 층에는 없다.
- 실제 변경은 코드 diff 16파일/1041줄이며, 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/spec-followups-batch-b-7c31ad`)를 절대경로로 직접 확인해 신규 식별자 후보를 전수 조사했다.

## 발견사항

- **[INFO]** `WorkflowVersionDetail` → `WorkflowVersionDetailProjection` 개명은 기존 충돌의 **해소**다
  - target 신규 식별자: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` 의 `WorkflowVersionDetailProjection`
  - 기존 사용처: `codebase/frontend/src/lib/api/workflows.ts:123` 의 `WorkflowVersionDetail` (형태가 다른 동명 타입, `creator` nullability·`createdAt` 타입 상이)
  - 상세: 이 PR 이전에는 백엔드·프런트엔드가 같은 이름 `WorkflowVersionDetail` 을 서로 다른 형태로 각각 선언해 `review/consistency/2026/09/06/13_39_25` W3·`16_29_00` W5 에서 "유일 정의" 오판을 3라운드 연속 유발했다. 이번 diff 는 백엔드 쪽을 `WorkflowVersionDetailProjection` 으로 개명해 grep 상 동명 충돌 축을 닫았다. 프런트엔드 JSDoc 도 동시에 갱신되어 두 선언이 손-미러(hand-mirror) 관계임을 명시한다.
  - 검증: `grep -rln WorkflowVersionDetailProjection` 결과 백엔드·프런트엔드 주석 참조 각 1곳뿐이며, 실제 인터페이스 선언은 백엔드에만 있다. 새 이름이 다른 영역에서 다른 의미로 쓰이는 곳은 없음.
  - 제안: 없음 — 오히려 이전 라운드가 지적한 명명 충돌을 정정한 변경이므로 반영 확인만 하면 된다.

- **[INFO]** `TRIGGER_ENDPOINT_PATH_CONFLICT` / `rethrowEndpointPathConflict` 는 이미 spec 에 정의된 식별자를 그대로 구현·테스트에 사용 — 신규 부여 아님
  - target 신규 식별자: 없음(신규 아님). e2e 테스트 `webhook-trigger.e2e-spec.ts` 의 `B4` 케이스와 신규 가드 `repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts`/`endpoint-path-conflict-wrap.spec.ts` 가 이 이름을 참조한다.
  - 기존 사용처: `spec/2-navigation/2-trigger-list.md:96,166`, `spec/5-system/2-api-convention.md:200,211`, `spec/5-system/3-error-handling.md:238` 에 `TRIGGER_ENDPOINT_PATH_CONFLICT`(§1.10, `details.field='endpoint_path'`)가 이미 정본으로 정의돼 있다.
  - 상세: 코드(`codebase/backend/src/modules/triggers/triggers.service.ts:1607` `rethrowEndpointPathConflict`, `:1627` 에러 코드 리터럴, `triggers.controller.ts:100,129` Swagger 설명)는 spec 정의와 표기·의미가 일치한다. 새 e2e B4 와 새 가드는 **기존 계약을 검증하는 테스트/래칫**을 추가한 것이지 새 식별자를 도입한 것이 아니다.
  - 제안: 없음 — 충돌 아님, 계약 일치 확인용으로 기록.

- **[INFO]** 신규 파일 경로는 기존 `repo-guards/__tests__/` 명명 컨벤션을 그대로 따름
  - target 신규 식별자(경로): `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts`, `endpoint-path-conflict-wrap.spec.ts`, `fixtures/endpoint-path-save.fixture.ts`
  - 기존 사용처(컨벤션 근거): 형제 파일 `user-entity-exposure-guard.ts`/`user-entity-exposure.spec.ts`, `production-build-devdep-guard.ts`/`production-build-devdep.spec.ts`, `swagger-dto-contract-guard.ts`, fixture 형제 `user-relation-load.fixture.ts`/`user-eager-relation.fixture.ts`
  - 상세: `<주제>-guard.ts`(순수 파서/판정 로직) + `<주제>.spec.ts`(소비 테스트, `-guard` 접미 생략) + `fixtures/<주제>.fixture.ts` 3분할 패턴을 그대로 재현했다. 각 guard 파일이 로컬 `export const SRC_ROOT = path.resolve(__dirname, '..', '..')` 를 개별 선언하는 것도 기존 4개 guard(`dto-jsdoc-citation-guard.ts`, `nullable-type-lie-cast-guard.ts`, `user-entity-exposure-guard.ts` 등)와 동일한 기존 관행이며, 각 파일이 독립 ES 모듈이라 같은 이름이라도 실제 네임스페이스 충돌은 없다.
  - 제안: 없음 — 컨벤션 준수 확인.

- **[INFO]** `CONFLICT_WRAPPER`/`TRIGGER_REPOSITORY`/`TriggerSaveSite` 등 신규 상수·타입명은 저장소 전역에서 유일
  - target 신규 식별자: `CONFLICT_WRAPPER`(`'rethrowEndpointPathConflict'`), `TRIGGER_REPOSITORY`(`'triggerRepository'`), `TriggerSaveSite`, `findTriggerRepositorySaves`, `findUnwrappedTriggerSaves` — 전부 `endpoint-path-conflict-wrap-guard.ts` 신규.
  - 기존 사용처: 없음(전수 grep 결과 이 신규 파일 외 정의·재사용 없음).
  - 상세: 이름 형태가 일반적이라 향후 다른 리포지토리 가드가 유사한 이름(`REPOSITORY`, `WRAPPER` 등)을 재사용할 여지는 있으나 현재는 충돌 없음.
  - 제안: 없음.

- **[INFO]** `tsconfig.build.json` exclude 패턴 `**/__test-utils__/**` 추가는 기존 두 exclude 패턴(`repo-guards`, `shared/testing`)과 같은 축의 세 번째 항목 — 이름·경로 충돌 아님
  - target 신규 식별자: exclude glob `**/__test-utils__/**`
  - 기존 사용처: 같은 파일의 `src/repo-guards/**`, `src/shared/testing/**` (동일 목적, 다른 디렉터리)
  - 상세: 디렉터리 이름 기반으로 확장한 것이며 실측 5파일(`common/__test-utils__/**`, `modules/integrations/__test-utils__/**`)을 정확히 커버한다. 새 glob 이 의도치 않게 프로덕션 코드를 배제할 위험은 디렉터리명이 `__test-utils__` 로 테스트 전용임이 명확해 낮다.
  - 제안: 없음.

## 요약

이 diff 는 `spec/5-system` 을 변경하지 않았고(0 파일 델타), 코드 diff 가 도입한 신규 식별자(guard 파일 3종·`pgErrorConstraint` export·`CONFLICT_WRAPPER`/`TRIGGER_REPOSITORY`/`TriggerSaveSite` 등)는 저장소 전역 grep 전수 확인 결과 기존 식별자와 의미 충돌 없이 유일하며, 파일 경로도 `repo-guards/__tests__/` 의 기존 3분할(guard/spec/fixture) 컨벤션을 그대로 따른다. 유일하게 "이름"이 걸린 항목이던 `WorkflowVersionDetail` 백엔드/프런트엔드 동명 충돌은 이번 diff 가 `WorkflowVersionDetailProjection` 으로 개명해 오히려 **해소**했다(이전 라운드 W3·W5 지적 반영). `TRIGGER_ENDPOINT_PATH_CONFLICT`/`rethrowEndpointPathConflict` 는 신규 부여가 아니라 이미 spec(`2-trigger-list.md`, `2-api-convention.md`, `3-error-handling.md`)에 정의된 식별자를 구현·테스트가 그대로 재사용한 것으로 확인되어 충돌 소지가 없다. 신규 식별자 충돌 관점에서 이 PR 은 문제가 없으며, 오히려 순 항목이 있다면 감점(-)이 아니라 개선(기존 충돌 정정)이다.

## 위험도

NONE
