# 신규 식별자 충돌 검토 — spec/2-navigation (impl-done)

## 검토 범위와 실측

- scope(`spec/2-navigation/`) 델타: **0개 파일** — 이 브랜치(`user-entity-column-defense`)는 spec/2-navigation 영역의 spec 문서를 바꾸지 않았다. 따라서 "target 문서가 새로 부여한 요구사항 ID·엔티티명·이벤트명" 자체는 없다.
- 구현 diff(22개 파일 / 2699줄)를 HEAD 워킹트리에서 직접 실측(`git diff origin/main...HEAD -- codebase/`)한 결과, spec/2-navigation 이 `code:` frontmatter 로 지목하는 파일 중 이번 PR 이 건드린 것은 `codebase/backend/src/modules/triggers/triggers.service.ts` (+ 그 spec 파일)뿐이다. 나머지 변경 파일(`user-entity-exposure-guard.ts`, `user-secret-absence.ts`, `dto-jsdoc-citation-guard.ts`, `workflow-versions.service.ts`, `pg-error.ts`, `workspace-response.dto.ts` 등)은 spec/5-system(auth)·spec/3-workflow-editor(version-history) 영역이며 spec/2-navigation 프론트매터에 등재되어 있지 않다.

## 발견사항

### spec/2-navigation 관련 신규 식별자 — 충돌 없음 (정보성)

- **[INFO]** `TRIGGER_ENDPOINT_PATH_CONFLICT` / `details.field='endpoint_path'` 신규 구현은 기존 spec 선언과 정확히 일치
  - target 신규 식별자: `codebase/backend/src/modules/triggers/triggers.service.ts` 신규 `rethrowEndpointPathConflict()` 가 던지는 `code: 'RESOURCE_CONFLICT'` + `details: { field: 'endpoint_path', code: 'TRIGGER_ENDPOINT_PATH_CONFLICT' }`, 그리고 내부 헬퍼 `isEndpointPathUniqueViolation()` / 상수 `TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX = 'idx_trigger_workspace_endpoint'`
  - 기존 사용처: `spec/2-navigation/2-trigger-list.md:94, 164` — "`(workspace_id, endpoint_path)` UNIQUE 위반 시 409 `RESOURCE_CONFLICT` (세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`, `details.field='endpoint_path'`)"; 인덱스 자체는 `codebase/backend/migrations/V002__indexes.sql:26` (`idx_trigger_workspace_endpoint`) 에 이미 존재
  - 상세: 이 식별자들은 spec 이 **이전부터 이미 선언**해 온 계약이며, 이번 diff 는 그 선언에 맞춰 처음으로 구현을 채운 것(코드 주석 자체가 "`TRIGGER_ENDPOINT_PATH_CONFLICT` 문자열이 저장소 어디에도 없었다"는 과거 갭을 언급). 이름이 겹치지만 **의미가 동일**하므로 충돌이 아니라 정합. `isEndpointPathUniqueViolation` export 명·`TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX` 상수명 둘 다 저장소 내 유일 선언(다른 정의 없음, grep 확인).
  - 제안: 없음 — 그대로 유지.

### spec/2-navigation 범위 밖 참고 사항 (판정에 포함하지 않음)

- 같은 diff 안에 `codebase/frontend/src/lib/api/workflows.ts` 의 `WorkflowVersionDetail` 인터페이스가 `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` 의 동명 선언과 형태가 갈린(frontend `creator` optional/nullable vs backend 3필드 고정) 신규 식별자 충돌이 diff 자체의 JSDoc 주석으로 이미 자기-보고되어 있다. 그러나 이 파일들은 spec/2-navigation 어느 문서의 `code:` frontmatter 에도 없고(spec/3-workflow-editor 영역), 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목과 `review/consistency/2026/09/06/16_29_00` W5 로 추적 중이라 본 스코프(spec/2-navigation) 판정 대상이 아니다. 별도 naming_collision 검토(scope=spec/3-workflow-editor 등)에서 다뤄질 사안이라 여기서는 정보 제공만 하고 등급을 매기지 않는다.
- `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` 의 신규 `WorkspaceMemberDto.joinedAt` 필드는 기존 엔티티(`workspace-member.entity.ts:40`)·서비스(`workspaces.service.ts`)·frontend(`workspaces.ts:10`) 전반에서 이미 동일 의미로 쓰이던 필드를 응답 DTO 에 처음 노출한 것뿐이라 신규 식별자 충돌 후보가 아니다. spec/2-navigation/6-config.md 에 `joinedAt` 언급이 없으나(grep 0건), 이는 명명 충돌이 아니라 spec-impl coverage 축의 사안이라 본 검토 관점 밖.

## 요약

이번 PR(`user-entity-column-defense`)은 spec/2-navigation 의 spec 문서를 전혀 수정하지 않았고(델타 0), 구현 diff 22개 파일 중 spec/2-navigation 이 지목하는 코드에 닿는 것은 `triggers.service.ts` 하나뿐이다. 그 안에서 새로 도입된 식별자(`TRIGGER_ENDPOINT_PATH_CONFLICT` 세부 코드, `details.field='endpoint_path'`, 내부 헬퍼/상수명)는 모두 `spec/2-navigation/2-trigger-list.md` 가 이미 선언해 둔 계약과 정확히 일치하며, 저장소 내 다른 정의와도 충돌하지 않는다. diff 안에 있는 진짜 신규 식별자 충돌(`WorkflowVersionDetail` 프론트/백엔드 동명이형 선언)은 spec/2-navigation 범위 밖이고 이미 다른 트래커로 잡혀 있어 본 검토의 판정 대상이 아니다. 결론적으로 spec/2-navigation 스코프 안에서는 신규 식별자 충돌이 발견되지 않았다.

## 위험도

NONE
