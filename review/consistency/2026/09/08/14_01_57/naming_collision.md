# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 및 방법

- 프롬프트 번들의 `spec/5-system/` 델타는 **0개 파일**(코드 전용 PR, 정상) — 여기서는 요구사항 ID/API endpoint 신규 부여가 없다.
- 프롬프트 번들에 `## 구현 변경 사항` diff 본문이 예산 초과로 **완전히 누락**되어 있어, 지시에 따라 워킹트리를 절대경로로 직접 조회했다:
  - `git diff origin/main -- codebase/ spec/` (해당 워크트리, HEAD = 변경 후 상태)
  - 결과: 20개 파일 변경 (backend 공용 유틸·integrations·workflow-versions·workspaces·repo-guards 테스트 하네스·tsconfig.build.json·frontend `workflows.ts`).
- 각 신규 식별자를 워킹트리 전체(`codebase/`, `spec/`)에서 `grep`으로 대조해 기존 다른 의미 사용처가 있는지 확인했다.

## 발견사항

신규로 도입된 식별자는 다음과 같이 전수 대조했으며, **어느 것도 기존 사용처와 의미가 다른 충돌을 일으키지 않는다.**

| 신규 식별자 | 종류 | 위치 | 충돌 여부 |
|---|---|---|---|
| `enclosingScopeName` | 함수 (export) | `codebase/backend/src/common/__test-utils__/source-scan.ts` | 없음 — 유일 정의, 두 소비처(`endpoint-path-conflict-wrap-guard.ts`, `user-entity-exposure-guard.ts`)가 동일 함수를 import. 구 이름 `enclosingName`(로컬, `user-entity-exposure-guard.ts`)은 이 PR 에서 완전히 제거됨 |
| `TRIGGER_REPOSITORY` | 상수 (export) | `repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts` | 없음 — 이 파일 유일 정의·유일 사용 |
| `CONFLICT_WRAPPER` | 상수 (export) | 상동 | 없음 — 값은 기존 private 메서드명 `rethrowEndpointPathConflict`(triggers.service.ts, 이 PR 이전부터 존재)를 문자열로 참조할 뿐, 새 런타임 심볼이 아님 |
| `TriggerSaveSite` | interface (export) | 상동 | 없음 |
| `findTriggerRepositorySaves` / `findUnwrappedTriggerSaves` | 함수 (export) | 상동 | 없음 |
| `WorkflowVersionDetailProjection` | type (export, 개명) | `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` | 없음 — 오히려 **기존 충돌을 해소**하는 개명 (아래 참고) |
| 신규 파일 3개 (`endpoint-path-conflict-wrap-guard.ts`, `endpoint-path-conflict-wrap.spec.ts`, `fixtures/endpoint-path-save.fixture.ts`) | 파일 경로 | `repo-guards/__tests__/` | 없음 — 형제 가드(`user-entity-exposure-guard.ts`+`.spec.ts`+`fixtures/*.fixture.ts`, `swagger-dto-contract-guard.ts` 등)와 동일한 `*-guard.ts`/`*.spec.ts`/`fixtures/*.fixture.ts` 명명 컨벤션을 그대로 따름 |
| `TRIGGER_ENDPOINT_PATH_CONFLICT` (webhook e2e 테스트가 참조) | 에러 코드 | `codebase/backend/test/webhook-trigger.e2e-spec.ts` | 신규 아님 — `spec/5-system/3-error-handling.md §1.10`·`spec/2-navigation/2-trigger-list.md`·`triggers.service.ts`/`triggers.controller.ts` 에 이미 등재된 기존 계약을 e2e 로 추가 검증한 것뿐 |
| `pgErrorConstraint` / `isPostgresUniqueViolation` (신규 소비처 확대) | 함수 재사용 | `common/db/pg-error.ts` (이 PR 에서 미변경, 이미 존재) | 신규 아님 — `http-exception.filter.ts`의 로컬 `isUniqueViolation` 함수를 제거하고 기존 공유 헬퍼로 교체한 것. **중복 식별자를 줄이는 방향**(DRY 통합)이며 새 충돌을 만들지 않음 |

### 참고 — 이 PR 이 해소한 기존 이름 충돌 (역방향, 문제 아님)

`WorkflowVersionDetail` 이라는 동일 이름이 backend(`workflow-versions.service.ts`)와 frontend(`lib/api/workflows.ts`)에 **형태가 다른 별도 선언**으로 존재해, 과거 세 라운드 연속 "유일 정의" 오판을 유발한 이력이 있다(`review/consistency/2026/09/06/13_39_25` W3, `review/consistency/2026/09/06/16_29_00` W5, 커밋 메시지에 기록). 이번 PR 이 backend 쪽만 `WorkflowVersionDetailProjection` 으로 개명해 이름 축의 충돌을 닫았다. frontend 는 여전히 `WorkflowVersionDetail` 을 쓰지만 이제 backend 에 동명 선언이 없으므로 grep 오판 위험이 사라졌다 — **이것은 새 충돌이 아니라 기존 충돌의 해소**이며, 두 타입의 wire 형태 차이(옵셔널 `creator`/`string` `createdAt` vs 고정 3필드/`Date`)는 의도적으로 유지된다고 양쪽 헤더 주석에 명시돼 있다.

### 참고 — 이 PR 범위 밖의 기존 동명 함수 (신규 식별자 아님, 정보용)

`isUniqueViolation` 이라는 이름의 로컬(비-export) 헬퍼가 `auth-oauth.service.ts`(1개)·`workspace-invitations.service.ts`(1개)에 여전히 각자 정의돼 있다. 이번 PR 은 `http-exception.filter.ts` 의 동명 로컬 함수 하나만 공유 `isPostgresUniqueViolation` 으로 교체했다. 두 파일은 이 PR 이 손대지 않은 기존 코드이고, 각 로컬 스코프 안에서만 유효해 실제 충돌(같은 스코프 내 다른 의미)은 아니다 — DRY 통합 여부는 별도 리팩터 판단 사안이라 본 검토(신규 식별자 충돌)의 범위 밖으로 본다.

## 요약

이번 diff(20개 파일, `spec/5-system` 델타 0)는 코드 전용 하드닝 PR로, 새로 도입한 식별자(`enclosingScopeName`, `TRIGGER_REPOSITORY`, `CONFLICT_WRAPPER`, `TriggerSaveSite`, `findTriggerRepositorySaves`/`findUnwrappedTriggerSaves`, `WorkflowVersionDetailProjection`, 신규 파일 3개)를 워킹트리 전체와 대조한 결과 기존 사용처와 다른 의미로 충돌하는 사례는 없었다. 오히려 `WorkflowVersionDetailProjection` 개명은 과거 세 라운드 연속 오판을 유발했던 backend/frontend 동명 타입 충돌을 해소했고, `pgErrorConstraint`/`isPostgresUniqueViolation` 재사용은 중복 로컬 함수를 줄이는 방향이다. 신규 테스트 파일 경로도 `repo-guards/__tests__/` 의 기존 `*-guard.ts`/`*.spec.ts`/`fixtures/*.fixture.ts` 컨벤션을 그대로 따른다. `TRIGGER_ENDPOINT_PATH_CONFLICT` 등 도메인 에러 코드는 이 PR 이전에 이미 spec·구현 양쪽에 등재된 기존 계약이며 새로 부여된 것이 아니다.

## 위험도

NONE
