# 신규 식별자 충돌 검토 결과

## 참고: payload 스코프 검증

`_prompts/naming_collision.md` 의 "Target 문서" 섹션은 `spec/2-navigation/` 하위 전 파일(대시보드·워크플로우 목록·인증 플로우·에러/빈 상태·`_layout` 등)과 `spec/conventions/cafe24-api-catalog/**` 조각이 이어붙은 대용량 번들이다. 이번에는 실제 target 인 "`ImportWorkflowDto.settings` 에 기존 `WorkflowSettingsDto` 재사용" 변경이 `spec/2-navigation/1-workflow-list.md` §3.2/Rationale §2 에 정확히 반영되어 있음을 확인했다(§3.2 item 6, Rationale §2 마지막 문단 — `grep -n "WorkflowSettingsDto"` 로 1621번째 줄 부근 확인). 이전 세션(22:46:30 회차)에서 지적된 mis-scope(당시는 `spec/5-system/` 로 오배치)와 달리 이번 payload 는 올바른 영역을 담고 있어 스코프 문제는 없다.

다만 지시에 따라 코드 현실을 워킹트리 절대경로로 직접 재확인했다(아래 "실제 조사 대상").

실제 조사 대상 (전부 `/Volumes/project/private/clemvion/.claude/worktrees/import-settings-dto-1df4ae` 절대경로 기준):

- `codebase/backend/src/modules/workflows/dto/import-workflow.dto.ts` — 변경 대상. `settings?: Record<string, unknown>` → `settings?: WorkflowSettingsDto` (`@ValidateNested @Type(() => WorkflowSettingsDto)`)
- `codebase/backend/src/modules/workflows/dto/workflow-settings.dto.ts` — 재사용 대상 클래스 정의(`export class WorkflowSettingsDto`, PR #805 산출물, HEAD 이전부터 존재)
- `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts` — 동일 클래스를 이미 사용 중인 선례(patch 경로)
- `codebase/backend/src/modules/workflows/workflows.service.ts` — `settings: dto.settings ?? {}` → `settings: { ...dto.settings } as Record<string, unknown>` (jsonb 평탄화만, 신규 식별자 없음)
- `spec/2-navigation/1-workflow-list.md` §3.2 item 6 + Rationale §2 (신규 문장 추가, 기존 `POST /api/workflows/import` endpoint·기존 `WorkflowSettingsDto` 참조만 사용)
- `plan/in-progress/import-workflow-settings-dto.md` (target plan, `spec_impact: [spec/2-navigation/1-workflow-list.md]`)
- `CHANGELOG.md` Unreleased 항목 (신규 error code/endpoint/ENV 언급 없음, 기존 `400 VALIDATION_ERROR` 재사용)

`git diff origin/main --stat` 로 변경 파일 전체(9개 소스/문서 + review 산출물)를 확인했고, 신규 마이그레이션 파일·신규 ENV var·신규 endpoint·신규 에러코드는 diff 어디에도 없다.

## 발견사항

- **[INFO]** 신규 식별자 없음 — 계획대로 순수 재사용
  - target 신규 식별자: 없음. `ImportWorkflowDto.settings` 의 타입을 opaque `Record<string, unknown>` 에서 기존 클래스 `WorkflowSettingsDto`(`codebase/backend/src/modules/workflows/dto/workflow-settings.dto.ts:12`)로 좁힌 것이 전부다.
  - 기존 사용처: `WorkflowSettingsDto` 는 이미 `update-workflow.dto.ts` 에서 patch 경로 검증용으로 사용 중(PR #805 도입, HEAD 이전부터 존재). `grep -rln "WorkflowSettingsDto" codebase/backend/src` 결과 `workflow-settings.dto.ts`(정의) / `update-workflow.dto.ts`(기존 사용) / `import-workflow.dto.ts`(target 신규 사용) / `workflows.service.ts` / `workflow-dto-validation.spec.ts` 5개 파일 — 클래스 정의는 단 1곳, 중복 정의 없음.
  - 상세: 요구사항 ID·엔티티/DTO명·API endpoint·이벤트명·ENV/설정키·spec 파일 경로 6개 점검 관점 중 어느 것도 새로 생성되지 않는다. `POST /api/workflows/import` endpoint 는 기존에 이미 정의돼 있고(spec `spec/2-navigation/1-workflow-list.md` §3 표, §3.2) method+path 변경 없음. 에러코드는 기존 `VALIDATION_ERROR`(400) 재사용(신규 코드 없음). `grep -rn "class.*SettingsDto" codebase/backend/src` 결과 `WorkflowSettingsDto` / `UpdateWorkspaceSettingsDto` / `WorkspaceSettingsDto` 3건 — 전부 target 이전부터 존재하던 서로 다른 도메인 클래스로, target 이 유발한 신규 충돌이 아니다.
  - 제안: 없음(충돌 없음). `WorkflowSettingsDto` 를 `UpdateWorkflowDto`·`ImportWorkflowDto` 양쪽이 공유하는 것은 동일 논리적 개념(`Workflow.settings` jsonb, `spec/1-data-model.md` §2.4 단일 키 스코프)의 정합적 재사용이며 오히려 검증 강도 비대칭 해소가 목적이므로 바람직한 방향이다.

## 요약

target 작업(`ImportWorkflowDto.settings` 를 기존 `WorkflowSettingsDto` 로 strict 검증화)은 새 식별자를 전혀 도입하지 않는다 — 요구사항 ID·엔티티/DTO/인터페이스명·API endpoint·이벤트/메시지명·ENV/설정키·spec 파일 경로 6개 점검 관점 모두 신규 생성이 없어 충돌 대상 자체가 존재하지 않는다. 재사용 대상 `WorkflowSettingsDto` 는 PR #805 로 이미 도입되어 `UpdateWorkflowDto` 에서 쓰이던 클래스이며, 저장소 전체에 동일 클래스명 중복 정의도 없다. `git diff origin/main` 으로 코드·spec·CHANGELOG·plan 전 변경분을 절대경로 기준 직접 확인해 위 결론을 뒷받침했다.

## 위험도

NONE

BLOCK: NO
STATUS: SUCCESS
