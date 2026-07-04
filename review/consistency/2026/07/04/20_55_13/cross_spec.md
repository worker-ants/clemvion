# Cross-Spec 일관성 검토 — workflow-cap-validated-dto

> **payload 참고 안내**: `_prompts/cross_spec.md` 에 번들된 target 문서는 `spec/5-system/1-auth.md`·`10-graph-rag.md`·`spec/0-overview.md`·`spec/1-data-model.md` 전체였고, 실제 변경 대상인 `spec/5-system/4-execution-engine.md` §8 은 포함되어 있지 않았다(경로 스코프 불일치 — mis-scope). 지시에 따라 `git diff origin/main...HEAD`(커밋 전 상태 확인, diff 없음) 및 `spec/5-system/4-execution-engine.md`·`spec/1-data-model.md` §2.2/§2.4·관련 코드(`codebase/backend/src/modules/workflows/**`, `codebase/backend/src/modules/workspaces/**`, `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`)를 직접 조사해 검토했다.

## 대상 변경 요약

`UpdateWorkflowDto.settings`(현재 `@IsObject() Record<string, unknown>`, opaque)를 nested `WorkflowSettingsDto { @IsOptional @IsInt @Min(1) maxConcurrentExecutions? }` + `@ValidateNested`로 전환. 전역 `whitelist:true + forbidNonWhitelisted:true` 파이프로 인해 미지 키는 400. 서비스 계층은 `Object.assign` 전체 교체 → `settings` 만 spread-merge.

## 발견사항

- **[INFO]** `ImportWorkflowDto.settings` 는 여전히 opaque `Record<string, unknown>` — export/import 라운드트립과 PATCH 검증 강도 불일치
  - target 위치: `plan/in-progress/workflow-cap-validated-dto.md` 설계 결정 1·2 (`UpdateWorkflowDto.settings` 만 strict 전환)
  - 충돌 대상: `codebase/backend/src/modules/workflows/dto/import-workflow.dto.ts:160-167` (`settings?: Record<string, unknown>`, opaque, 미검증) / `exportWorkflow`(`workflows.service.ts:206-218`, `settings: workflow.settings` 그대로 재수출)
  - 상세: `PATCH /api/workflows/:id` 는 이번 변경 후 `maxConcurrentExecutions` 외 키를 400 거부하지만, `POST /api/workflows/import`(`ImportWorkflowDto`)는 동일 `Workflow.settings` JSONB 컬럼에 여전히 임의 키를 무검증 저장할 수 있다. 워크플로우를 export(`settings` 그대로 포함) → 다른 워크스페이스로 import 하면 그 임의 키가 DB 에 그대로 들어가고, 이후 그 워크플로우를 `PATCH`로 (예: UI 저장) 갱신하려는 시도만 예기치 않게 400 이 된다 — "동일 엔티티 필드인데 진입점별 검증 강도가 다르다"는 계약 비일관성이다. 다만 이번 target 자체가 만드는 신규 모순이 아니라 기존에도 있던 진입점 간 비대칭(하나는 opaque, 다른 하나는 이번에 strict 화)이 이번 변경으로 더 도드라지는 것이다.
  - 제안: 본 PR 범위 밖이라는 plan 의 명시("import/duplicate 는 별도 DTO, 본 PR 범위 밖")는 타당하나, `plan/in-progress/exec-intake-followups.md` 후속 항목에 "ImportWorkflowDto.settings 도 WorkflowSettingsDto 로 정합화" 를 명시적으로 추가해 두는 것을 권장(현재는 암묵적 gap).

- **[INFO]** §8 표의 "2단계 후속" per-workflow 타임아웃 설정이 같은 `Workflow.settings` 네임스페이스를 예고
  - target 위치: `plan/in-progress/workflow-cap-validated-dto.md` (`WorkflowSettingsDto`에 `maxConcurrentExecutions` 단일 필드만 정의)
  - 충돌 대상: `spec/5-system/4-execution-engine.md:1076-1078` §8 표 "단일 Execution 최대 실행 시간" 행 — "(2단계 후속) per-workflow `Workflow.settings`" + 같은 문서 §Rationale 라인 1524 "per-workflow 설정 필드(+UI)는 2단계 후속"
  - 상세: 오늘 시점에는 그 필드가 미구현이라 직접적 모순은 없다. 그러나 `forbidNonWhitelisted:true` 하의 strict nested DTO 는 스펙이 이미 예고한 두 번째 키(예: `maxActiveRunningMs` 류)가 실제로 추가될 때 `WorkflowSettingsDto` 확장을 반드시 동반해야 한다 — 확장을 잊으면 그 신규 키도 400 거부된다. 이번 target 문서/코드가 이 결합을 명시적으로 언급하지 않는다.
  - 제안: PR 설명 또는 `WorkflowSettingsDto` 상단 주석에 "§8 2단계 타임아웃 필드 추가 시 본 DTO 확장 필수" 한 줄 남겨 향후 구현자가 놓치지 않도록.

- **[INFO]** `settings` merge 의미 변경 (full-replace → spread-merge)이 export/버저닝 스펙과 별도 경로이나 문서화 안 됨
  - target 위치: `plan/in-progress/workflow-cap-validated-dto.md` 설계 결정 3 (spread-merge)
  - 충돌 대상: `spec/data-flow/11-workflow.md:61,232` ("`workflow.settings` 는 버전 스냅샷에 포함되지 않는다")
  - 상세: 직접 충돌은 아니다 — 버전 스냅샷이 애초에 `settings` 를 다루지 않으므로 merge 의미 변경과 무관하다. 다만 `PATCH` 의 merge 동작 변경 자체(현재 full-replace → 부분 병합)는 API 계약 변경이며 `spec/5-system/4-execution-engine.md` §8 이나 `spec/1-data-model.md` §2.4 본문에는 이 merge-vs-replace 의미가 명시되어 있지 않다(코드/plan 에만 존재). 향후 재조회 시 "PATCH 로 settings 일부만 보내도 기존 다른 키가 보존된다" 는 계약이 spec 에 없어 API 소비자가 문서만 보고는 알 수 없다.
  - 제안: `spec/1-data-model.md` §2.4 `settings` 셀 또는 `spec/5-system/4-execution-engine.md` §8 각주에 "PATCH 는 지정된 키만 병합, 나머지 보존(workspace 와 동형)" 한 줄 추가 권장(필수는 아님 — Rationale 섹션으로도 충분).

## 정합성 확인된 사항 (충돌 없음)

- **데이터 모델**: `spec/1-data-model.md` §2.4 Workflow 는 이미 `settings JSONB` 의 "알려진 키"를 `maxConcurrentExecutions` 단 하나로 명시(§2.2 Workspace 도 동형: `timezone`/`interactionAllowedOrigins`/`maxConcurrentExecutions` 3키 명시) — target DTO 설계가 정확히 이 계약을 코드로 강제하는 것이라 모순 없음, 오히려 spec-코드 간극을 좁힘.
- **API 계약**: `spec/5-system/4-execution-engine.md` §8 표의 `Workflow.settings.maxConcurrentExecutions (Editor+ — PATCH /api/workflows/:id)` 와 코드의 `@Roles('editor')` 가드(`workflows.controller.ts:164-165`)·엔드포인트 경로 완전 일치.
- **RBAC**: `spec/1-auth.md` §3.2 매트릭스의 `Workflow: CRUD`(Editor) 와 어긋나지 않음. Workspace 쪽(`PATCH /api/workspaces/:id/settings`, Admin+)과의 권한 분리도 각 스펙 위치(§8 표 각 행)에 정확히 반영되어 있어 두 엔드포인트가 혼동되지 않음.
- **소비처 검증**: `resolveConcurrencyCap`(`execution-engine.service.ts:2635` 부근)이 실제로 `workflow.settings`에서 읽는 유일한 키가 `maxConcurrentExecutions` 임을 코드로 확인 — plan 의 "backend 가 소비하는 workflow settings 키는 하나뿐" 주장은 정확.
- **프론트엔드 호출부**: `workflowsApi.update` 유일 호출부(`page.tsx:229`)가 `{ isActive }` 만 전송 — `settings` 미전송, strict 화로 인한 프론트엔드 회귀 없음.
- **Workspace 대칭성**: `UpdateWorkspaceSettingsDto`(`update-workspace-settings.dto.ts`)가 이미 3개 필드 모두 명시적 `@IsOptional`/`@IsInt`/`@Min(1)` 등으로 검증하며 opaque 여지가 전혀 없음 — target 의 workflow 쪽 대칭화는 기존 강한 선례를 따르는 것으로 방향성 일관.

## 요약

이번 target(workflow-level cap validated DTO)은 `spec/1-data-model.md` §2.4·`spec/5-system/4-execution-engine.md` §8 이 이미 문서화한 "Workflow.settings 의 유일한 알려진 키 = maxConcurrentExecutions" 계약을 코드 검증으로 그대로 강제하는 변경이며, workspace 측 기존 validated DTO 선례와 방향이 완전히 일치한다. RBAC(Editor+)·엔드포인트 경로·소비 로직 모두 spec 과 정확히 부합해 CRITICAL/WARNING 급 모순은 발견되지 않았다. 다만 (1) `ImportWorkflowDto.settings` 가 여전히 opaque 로 남아 PATCH 대비 검증 강도 비대칭이 생기는 점, (2) §8 이 이미 예고한 "2단계 후속" 두 번째 settings 키가 등장할 때 DTO 확장이 강제되는 결합, (3) full-replace→spread-merge 의미 변경이 spec 본문에 명시되지 않은 점은 INFO 레벨로 기록해 후속 정합화 대상으로 남긴다.

## 위험도

LOW

BLOCK: NO
STATUS: SUCCESS
