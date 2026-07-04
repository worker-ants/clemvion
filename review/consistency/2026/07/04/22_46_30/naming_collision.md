# 신규 식별자 충돌 검토 결과

## 참고: payload mis-scope

`_prompts/naming_collision.md` 의 "Target 문서" 섹션(3462줄)은 `spec/5-system/1-auth.md`(인증/인가/세션/감사) 전체, `spec/5-system/10-graph-rag.md` 전체, 그리고 Slack Socket Mode plan·Chart/Table/Carousel plan·감사 액션 명명 규약·Cafe24 API Catalog 등 서로 무관한 문서 조각들이 이어붙은 것이다. 이 파일 전체를 `grep -in "ImportWorkflowDto\|WorkflowSettingsDto\|PR #805"` 로 검색한 결과 **0건** — 실제 target 인 "`ImportWorkflowDto.settings` 에 기존 `WorkflowSettingsDto`(PR #805) 재사용" 작업과는 전혀 무관하다. `feedback_impl_done_spec_bundle_bug` 로 기록된 것과 동일한 payload 생성 결함으로 판단, 오탐(auth/graph-rag 관련 새 식별자 검토)을 방지하기 위해 지시대로 실제 저장소를 직접 조사했다.

실제 조사 대상:
- `plan/in-progress/import-workflow-settings-dto.md` (target plan, `spec_impact: none`)
- `codebase/backend/src/modules/workflows/dto/workflow-settings.dto.ts` (PR #805 산출물, 재사용 대상)
- `codebase/backend/src/modules/workflows/dto/import-workflow.dto.ts` (변경 대상, 현재 `settings?: Record<string, unknown>`)
- `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts` (동일 패턴의 선례)
- `spec/2-navigation/1-workflow-list.md` §3.2 (Export/Import JSON 포맷 SoT)

## 발견사항

- **[INFO]** 신규 식별자 없음 — 계획대로 순수 재사용
  - target 신규 식별자: 없음. `ImportWorkflowDto.settings` 의 타입만 `Record<string, unknown>` → `WorkflowSettingsDto`(기존 클래스, `codebase/backend/src/modules/workflows/dto/workflow-settings.dto.ts:12`)로 좁힌다.
  - 기존 사용처: `WorkflowSettingsDto` 는 현재 `update-workflow.dto.ts:13,72,79-80` 단 한 곳에서만 import·사용 중(PR #805 도입). 저장소 전체에 동일 클래스명 중복 정의 없음(`grep "class.*SettingsDto"` → `WorkflowSettingsDto`, `UpdateWorkspaceSettingsDto`, `WorkspaceSettingsDto` 3건, 전부 이름·도메인 상이).
  - 상세: 새 요구사항 ID, 새 엔티티/DTO/인터페이스명, 새 API endpoint, 새 이벤트명, 새 ENV/설정키, 새 spec 파일 경로 — 6개 점검 관점 중 어느 것도 새로 생성되지 않는다. `POST /api/workflows/import` endpoint 자체도 기존(spec `spec/2-navigation/1-workflow-list.md:127,154`)에 이미 정의돼 있고 method+path 변경 없음. 에러코드·마이그레이션·env var 도 plan/dto/서비스 어디에도 새로 등장하지 않음(grep 결과 전무, `migrations/` 최신 파일은 V105 로 본 작업과 무관).
  - 제안: 없음(충돌 없음). 클래스 재사용이 두 DTO(`UpdateWorkflowDto`, `ImportWorkflowDto`) 간 Swagger 스키마 이름도 공유하게 되는데, 이는 동일한 논리적 개념(`Workflow.settings` JSONB, §2.4 단일 키 스코프)을 나타내므로 스키마 통합이 오히려 올바른 방향이며 충돌이 아니다.

- **[INFO]** `WorkflowSettingsDto` vs `WorkspaceSettingsDto`/`UpdateWorkspaceSettingsDto` 이름 유사성 — 기존에 이미 존재, target 기인 아님
  - target 신규 식별자: 해당 없음(target 은 새 이름을 만들지 않음).
  - 기존 사용처: `codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts:13` (`UpdateWorkspaceSettingsDto`), `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:37` (`WorkspaceSettingsDto`).
  - 상세: `Workflow-` 접두사와 `Workspace-` 접두사가 5글자 차이만 나 시각적으로 유사하지만, 이는 PR #805 이전부터 이미 존재하던 명명 관례(플랜 문서도 "workspace 의 UpdateWorkspaceSettingsDto 와 동일한 strict 정책" 이라고 명시적으로 대응 관계를 밝힘, `workflow-settings.dto.ts:8`)이며, target 작업은 이 이름 자체에 아무 변경도 가하지 않는다. 즉 target 이 유발한 신규 충돌이 아니라 기존 상태의 연속.
  - 제안: target 범위 밖. 향후 리네이밍 필요 시 별도 정리 이슈로 다룰 것(본 검토에서는 차단 사유 아님).

## 요약

target 작업은 새 식별자를 전혀 도입하지 않는다 — PR #805 에서 이미 만들어진 `WorkflowSettingsDto`(`workflow-settings.dto.ts`)를 `ImportWorkflowDto.settings` 타입으로 그대로 재사용해 `Record<string, unknown>` opaque 검증을 strict nested 검증으로 좁히는 것이 전부다. 요구사항 ID·엔티티/DTO명·API endpoint·이벤트명·ENV/설정키·spec 파일 경로 6개 점검 관점 모두 신규 생성이 없어 충돌 대상 자체가 존재하지 않는다. payload 는 `spec/5-system/` 전체와 무관 문서가 섞여 mis-scope 되어 있었으나(오탐 방지를 위해 실제 저장소로 직접 검증 완료), 이는 검토 절차상의 결함이지 target 작업 자체의 문제는 아니다.

## 위험도

NONE

BLOCK: NO
STATUS: SUCCESS
