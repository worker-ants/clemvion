# 신규 식별자 충돌 검토 — `WorkflowSettingsDto`

## 점검 대상

`plan/in-progress/workflow-cap-validated-dto.md` 이행 목표: `codebase/backend/src/modules/workflows/dto/` 하위에 `WorkflowSettingsDto` 신설(§8 `Workflow.settings.maxConcurrentExecutions` nested validated DTO), `UpdateWorkflowDto.settings` 를 opaque `Record<string, unknown>` → `@ValidateNested @Type(() => WorkflowSettingsDto)` 로 전환.

## 프롬프트 payload 스코프 이상 (선행 확인)

`_prompts/naming_collision.md` 의 "Target 문서" 번들은 `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`, `spec/0-overview.md`, `spec/1-data-model.md`, `spec/conventions/cafe24-api-catalog/**` 로 구성되어 있고 **`WorkflowSettingsDto`·`Workflow.settings.maxConcurrentExecutions`·§8 동시 실행 제한 문구가 전혀 포함되어 있지 않다**(grep 0건). 실제 SoT 는 `spec/5-system/4-execution-engine.md#8-동시-실행-제한` 이며 이 파일은 번들에서 빠져 있다. `feedback_impl_done_spec_bundle_bug`(MEMORY) 와 동일한 payload mis-scope 패턴으로 판단해 사용자 지시대로 **실제 저장소를 직접 grep 하여** 아래 결론을 검증했다(번들 텍스트가 아닌 real repo 기준).

## 저장소 직접 검증 결과

- `grep -rn "WorkflowSettingsDto" codebase/ spec/` → **0건**. 신규 클래스명은 현재 저장소 어디에도 존재하지 않는다 — 순수 신규 도입이며 재사용/재정의 충돌 없음.
- `grep -rln "class .*Settings" codebase/backend/src` → `update-workspace-settings.dto.ts`(`UpdateWorkspaceSettingsDto`), `workspace-response.dto.ts` 두 건만 존재. `Workflow*Settings*` 계열은 전무.
- `codebase/backend/src/modules/workflows/dto/` 디렉터리 현재 파일: `create-workflow.dto.ts`, `execute-node.dto.ts`, `import-workflow.dto.ts`, `query-workflow.dto.ts`, `save-canvas.dto.ts`, `update-workflow.dto.ts`, `responses/` — 명명 규칙은 전부 kebab-case 파일 + `PascalCase + Dto` suffix (`update-workflow.dto.ts` → `UpdateWorkflowDto`). 신규 파일이 `workflow-settings.dto.ts` 로 명명된다면 이 컨벤션과 정합.
- `spec/1-data-model.md:120` 과 `spec/5-system/4-execution-engine.md:1076` 이 이미 `Workflow.settings.maxConcurrentExecutions` 를 §8 admission gate SoT 로 명시하고 있어 신규 DTO 의 필드/의미는 spec 과 완전히 정합.

## 발견사항

### [INFO] `WorkflowSettingsDto` — 신규 도입, 충돌 없음. `UpdateWorkspaceSettingsDto` 대칭 네이밍 확인
- target 신규 식별자: `WorkflowSettingsDto` (nested validated DTO, `maxConcurrentExecutions?: number` 단일 필드)
- 기존 사용처: 없음. 비교 대상 `UpdateWorkspaceSettingsDto` 는 `codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts:13`
- 상세: `UpdateWorkspaceSettingsDto` 는 이름에 `Update` prefix 가 붙어 있고(PATCH body 전체를 대표), `WorkflowSettingsDto` 는 `Update` 없이 nested 객체만을 나타낸다. 이는 **의도된 비대칭**이다 — workspace 쪽은 `settings` 가 PATCH endpoint 의 top-level body 그 자체(flat, `UpdateWorkspaceSettingsDto` 가 controller 진입점 DTO 겸용)인 반면, workflow 쪽은 `UpdateWorkflowDto`(controller 진입점, name/description/isActive/tags/folderId/settings 를 아우름)의 **nested 필드 하나**로 `settings` 가 내려가므로 별도 `Update` prefix 를 붙이면 오히려 "PATCH 요청 최상위 DTO" 로 오인될 위험이 있다. 현재 명명(`WorkflowSettingsDto`, no `Update` prefix)이 스코프를 더 정확히 반영한다.
- 제안: 변경 불필요. 다만 파일명은 기존 kebab-case 컨벤션에 맞춰 `workflow-settings.dto.ts` 로 생성 권장(다른 workflows/dto 파일과 동일 패턴).

### [INFO] payload 번들 mis-scope — 실제 impl-prep 대상 spec 미포함
- target 신규 식별자: 해당 없음(payload 구성 이슈)
- 기존 사용처: `_prompts/naming_collision.md` 의 Target 문서 섹션 (`spec/5-system/1-auth.md`, `10-graph-rag.md`, `spec/0-overview.md`, `spec/1-data-model.md`, `spec/conventions/cafe24-api-catalog/**`)
- 상세: `--impl-prep, scope=spec/5-system/` 로 지정되어 있음에도 실제 이행 대상인 `spec/5-system/4-execution-engine.md`(§8, `Workflow.settings.maxConcurrentExecutions` SoT) 가 번들에서 누락되었다. `spec/1-data-model.md` 는 포함되어 있어 §Workflow.settings 정의 자체는 번들 내에서도 확인 가능했으나(그 결과 위 결론에 영향 없음), execution-engine 문서 부재는 --impl-prep 오케스트레이션의 target 문서 수집 로직 점검이 필요함을 시사.
- 제안: 코드 변경 대상 아님(리뷰어가 직접 real repo 로 우회 검증 완료, 결론 영향 없음). orchestrator 측 --impl-prep payload 조립 로직에서 diff/plan 기반 관련 spec 파일 선정 규칙을 재점검 권장(별도 이슈로 기록, 본 리뷰의 BLOCK 사유 아님).

## 요약

`WorkflowSettingsDto` 는 저장소 전체 grep 기준 완전히 신규인 식별자로 기존 클래스/타입과 충돌하지 않는다. `UpdateWorkspaceSettingsDto` 와 이름 패턴이 다르지만(Update prefix 유무) 이는 controller 진입점 DTO(workspace) vs nested 필드 DTO(workflow) 라는 실제 스코프 차이를 반영한 의도된 비대칭이며 오인 소지가 낮다. 파일 배치 위치(`codebase/backend/src/modules/workflows/dto/`)와 파일명 컨벤션도 기존 디렉터리 관례와 정합한다. 다만 이번 `_prompts/naming_collision.md` payload 는 실제 구현 대상 spec(execution-engine.md §8)을 빠뜨린 채 무관한 auth/graph-rag/cafe24 문서 번들로 구성되어 있어, real repo 직접 검증으로 결론을 대체했다 — 이 우회는 결론 신뢰도에 영향 없음.

## 위험도

NONE

BLOCK: NO

STATUS: SUCCESS
