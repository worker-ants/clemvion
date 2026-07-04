# 신규 식별자 충돌 검토 — `WorkflowSettingsDto` (impl-done)

## 점검 대상

`plan/in-progress/workflow-cap-validated-dto.md` 구현 완료분: `codebase/backend/src/modules/workflows/dto/workflow-settings.dto.ts` 에 `WorkflowSettingsDto` 신설 (`maxConcurrentExecutions?: number` — `@IsOptional @IsInt @Min(1)`). `UpdateWorkflowDto.settings` 를 opaque `Record<string, unknown>` 에서 `@ValidateNested @Type(() => WorkflowSettingsDto)` 로 전환하고, `workflows.service.ts` 의 `update()` 에 spread-merge 를 추가했다.

## 프롬프트 payload 스코프 이상 (선행 확인)

`_prompts/naming_collision.md` 의 "Target 문서" 번들은 `spec/5-system/1-auth.md`, `2-telegram-integration.md`(또는 유사 통합 가이드), `spec/conventions/api-naming.md`, `spec/conventions/api-catalog-convention.md`, cafe24 field-level 카탈로그 등으로 구성되어 있고 이번 태스크의 신규 식별자인 `WorkflowSettingsDto`, `Workflow.settings.maxConcurrentExecutions`, §8 동시 실행 admission gate 관련 문구가 **전혀 포함되어 있지 않다** (payload 전체 grep 0건, "구현 변경 사항" diff 섹션 자체도 부재). 실제 SoT 는 `spec/5-system/4-execution-engine.md §8`(동시 실행 제한)이며 이 파일은 번들에서 완전히 빠져 있다.

이는 MEMORY 의 `feedback_impl_done_spec_bundle_bug`("--impl-done 가 target spec 본문을 프롬프트에 못 실어 새 요구사항 ID 오탐 BLOCK") 및 직전 impl-prep 리뷰(`review/consistency/2026/07/04/20_55_13/naming_collision.md`)에서 이미 동일하게 확인된 payload mis-scope 패턴과 일치한다. 사용자 지시("payload 마스코프 시 real repo 로 검증")에 따라 payload 텍스트가 아닌 **HEAD 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/workflow-cap-dto-bca77e`)를 절대경로/`git -C`로 직접 검증**했다.

## 저장소 직접 검증 결과 (HEAD, impl-done 기준)

- `git -C <worktree> grep -n "class WorkflowSettingsDto" -- codebase` → 정확히 **1건**: `codebase/backend/src/modules/workflows/dto/workflow-settings.dto.ts:12`. 소스 트리 전체에서 이 클래스명의 정의는 이번 신설분이 유일하다 (참고: `codebase/backend/dist/**` 하위에 컴파일 산출물 `.js`/`.d.ts` 사본이 존재하나 이는 동일 소스의 빌드 결과물일 뿐 별도 정의가 아니므로 충돌로 집계하지 않음).
- `git -C <worktree> grep -n "WorkflowSettings\b"` (Dto 접미사 제외) → 0건. `Workflow` + `Settings` 조합의 다른 타입/인터페이스 없음.
- 유사 명명 `UpdateWorkspaceSettingsDto`(`codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts`)는 여전히 별개 존재 — 의도된 비대칭(workspace 는 controller top-level DTO 겸용이라 `Update` prefix, workflow 는 `UpdateWorkflowDto` 의 nested 필드라 prefix 없음)이며 직전 impl-prep 리뷰에서도 동일 결론이 확인되어 재검토 결과가 일관된다.
- 신규 endpoint 없음 — `git -C <worktree> diff origin/main --stat -- codebase/backend/src/modules/workflows/workflows.controller.ts` 결과 컨트롤러 변경 자체가 없다(기존 `PATCH /api/workflows/:id` 를 그대로 사용, method+path 신규 도입 없음 → endpoint 충돌 벡터 해당 없음).
- 신규 ENV var/config key 없음 — diff 내 `process.env`/`ConfigService` 참조 없음.
- 신규 이벤트/webhook/queue 이름 없음 — 이번 변경은 순수 validation DTO + service merge 로직, 이벤트 발행 코드 변경 없음.
- 파일 경로 `codebase/backend/src/modules/workflows/dto/workflow-settings.dto.ts` 는 동일 디렉터리의 기존 파일들(`create-workflow.dto.ts`, `update-workflow.dto.ts`, `import-workflow.dto.ts`, `query-workflow.dto.ts`, `execute-node.dto.ts`, `save-canvas.dto.ts`)과 동일한 kebab-case + `.dto.ts` 컨벤션을 따르며 기존 파일과 이름이 겹치지 않는다.
- `spec/1-data-model.md`(§2.4 `Workflow.settings`)와 `spec/5-system/4-execution-engine.md`(§8 admission gate)가 이미 `maxConcurrentExecutions` 를 SoT 로 규정하고 있어 신규 DTO 필드 의미가 기존 spec 정의와 완전히 정합한다 — 새 의미의 중복 부여 없음.

## 발견사항

### [INFO] `WorkflowSettingsDto` — 신규 도입, 충돌 없음 (impl-done 재확인)
- target 신규 식별자: `WorkflowSettingsDto` (`codebase/backend/src/modules/workflows/dto/workflow-settings.dto.ts:12`)
- 기존 사용처: 없음 (저장소 전체 유일 정의). 비교 참고용 유사 명명 `UpdateWorkspaceSettingsDto` — `codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts`
- 상세: impl-prep 시점(20:55:13 리뷰)에서 이미 0건으로 확인되었고, 구현 완료 후(현 시점) 재검증해도 정의는 정확히 1곳뿐이다. `Update` prefix 유무 비대칭은 controller top-level DTO(workspace) vs nested 필드 DTO(workflow) 의 실제 스코프 차이를 반영한 의도된 설계로, 두 리뷰 시점 모두 동일 결론.
- 제안: 변경 불필요.

### [INFO] payload 번들 mis-scope — impl-done 대상 spec 미포함 (반복 패턴)
- target 신규 식별자: 해당 없음 (payload 구성 이슈)
- 기존 사용처: `_prompts/naming_collision.md` 의 Target 문서 섹션 (auth/telegram/naming-convention/api-catalog-convention/cafe24 카탈로그 등, `spec/5-system/4-execution-engine.md` 및 diff 섹션 부재)
- 상세: `--impl-done, scope=spec/5-system/` 로 지정되어 있음에도 실제 변경 대상 spec(`4-execution-engine.md §8`)과 구현 diff 자체가 번들에 누락되었다. 동일 plan 의 impl-prep 리뷰(20:55:13)에서도 동일한 mis-scope 가 보고된 바 있어 1회성이 아니라 이 plan 의 orchestrator payload 조립 단계에서 반복되는 패턴으로 보인다.
- 제안: 코드 변경 대상 아님 (본 리뷰는 real repo 직접 검증으로 우회해 결론 신뢰도 영향 없음). orchestrator 측 --impl-prep/--impl-done 공통의 target 문서 수집 로직(diff/plan 기반 관련 spec 파일 선정 규칙)을 별도로 재점검 권장 — 반복 재현되므로 우선순위를 높여 기록.

## 요약

`WorkflowSettingsDto` 는 구현 완료 후 재검증한 결과에서도 저장소 전체에서 정확히 1곳(`workflow-settings.dto.ts:12`)에만 정의되어 있으며, 기존 어떤 요구사항 ID·엔티티·API endpoint·이벤트명·환경변수·파일 경로와도 충돌하지 않는다. 신규 endpoint 도입이 없고(기존 `PATCH /api/workflows/:id` 재사용), 파일 배치·명명도 `workflows/dto/` 디렉터리 기존 컨벤션과 정합하며, `UpdateWorkspaceSettingsDto` 와의 명명 비대칭은 스코프 차이를 반영한 의도된 설계로 impl-prep 시점 결론과 일관된다. 다만 이번 `_prompts/naming_collision.md` payload 는 impl-done 이행 대상 spec(execution-engine.md §8)과 구현 diff를 빠뜨린 채 무관한 문서 번들로 구성되어 있어(직전 impl-prep 리뷰와 동일한 반복 패턴), real repo 직접 검증(git grep/diff, HEAD 워킹트리 절대경로 기준)으로 결론을 대체했다 — 이 우회는 결론 신뢰도에 영향을 주지 않는다.

## 위험도

NONE

BLOCK: NO

STATUS: SUCCESS
