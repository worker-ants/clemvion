# 요구사항(Requirement) Review — workflow-level cap validated write DTO (fresh, post-INFO-fix)

## 점검 대상

- `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts`
- `codebase/backend/src/modules/workflows/dto/workflow-settings.dto.ts`
- `codebase/backend/src/modules/workflows/workflows.service.ts`
- `codebase/backend/src/modules/workflows/dto/workflow-dto-validation.spec.ts`
- `codebase/backend/src/modules/workflows/workflows.service.spec.ts`
- `codebase/backend/test/workflow-crud.e2e-spec.ts`
- `CHANGELOG.md` / `plan/in-progress/workflow-cap-validated-dto.md`

payload 로 전달된 requirement.md 는 실제 코드 diff(파일 1-7)에 더해 이전 회차 `review/code/2026/07/04/21_11_10/**` 및 `review/consistency/2026/07/04/20_55_13/**` 산출물(파일 8-28)까지 번들되어 있었다. `git diff origin/main...HEAD --stat` 로 대조한 결과 실제 코드/plan 변경분(파일 1-8)은 payload 내용과 정확히 일치하고, 나머지는 이전 리뷰 세션의 부가 산출물(참고용, 리뷰 대상 아님) — 미스코프 아님. 폴백 없이 원 payload 기준으로 진행.

## 발견사항 (이전 회차 대비 재검증)

- **[INFO]** `PATCH { settings: null }` 이 검증을 통과하고 서비스에서 조용히 no-op 이 된다 (변동 없음, 재확인)
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` L177-183 (`if (settings !== undefined) { workflow.settings = { ...(workflow.settings ?? {}), ...settings }; }`)
  - 상세: 이번 회차(swagger thunk fix)는 이 로직을 건드리지 않았으며, 코드 재확인 결과 동일 동작(`@IsOptional()` 이 null/undefined 모두 skip → 서비스는 `!== undefined` 만 체크 → `null` spread 는 no-op)이 유지된다. spec §8/§2.4 는 `null` 을 통한 초기화 동작을 정의하지 않아 spec 위반은 아니다(회색지대, 무해).
  - 제안: 변경 없음(이전 회차와 동일 결론). cap 초기화 UX 가 필요해지면 별도 후속 검토.

- **[해소 확인]** swagger nested-type 참조 thunk 전환 완료
  - 위치: `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts` L86 (`@ApiPropertyOptional({ type: () => WorkflowSettingsDto, ... })`)
  - 상세: `git diff origin/main...HEAD` 로 실제 파일 확인 — 이전 회차 INFO(`type: WorkflowSettingsDto` 직접 참조, thunk 없음)가 `type: () => WorkflowSettingsDto` 로 정확히 수정됐다. `spec/conventions/swagger.md` §nested-object 관례 및 저장소 선례(`UpdateTriggerDto` 의 `notification`/`interaction`/`chatChannel`)와 이제 line-level 로 일치한다. 더 이상 발견사항 아님.

- **[INFO]** `ImportWorkflowDto.settings` 는 여전히 opaque `Record<string, unknown>` — 검증 강도 비대칭 (변동 없음, 의도적 defer)
  - 위치: `codebase/backend/src/modules/workflows/dto/import-workflow.dto.ts`
  - 상세: 같은 `Workflow.settings` jsonb 컬럼에 대해 PATCH 경로는 strict validated DTO 인데 import 경로는 여전히 무검증. `plan/in-progress/workflow-cap-validated-dto.md` 말미에 낮은 우선순위 후속으로 명시적으로 defer 됨. 본 PR 이 만든 회귀 아님.
  - 제안: 별도 계획대로 후속 검토, 병합 차단 사유 아님.

## Spec fidelity 검증 (line-level, 재확인)

- `spec/5-system/4-execution-engine.md` L1076: `워크플로우당 동시 Execution 수 = 3, Workflow.settings.maxConcurrentExecutions (Editor+ — PATCH /api/workflows/:id, §2.4)` — 코드의 `WorkflowSettingsDto.maxConcurrentExecutions`, 컨트롤러 `@Patch(':id') @Roles('editor')` (`workflows.controller.ts` L164-165, 본 diff 밖·기존 부합), `DEFAULT_WORKFLOW_MAX_CONCURRENT_EXECUTIONS = 3` (`execution-limits.ts` L44, `execution-engine.service.ts` L2642 사용)과 필드명·기본값·권한·엔드포인트 모두 일치.
- `spec/1-data-model.md` L120 (§2.4 Workflow): `settings.maxConcurrentExecutions: number?` (미설정 시 기본 3, 편집 `PATCH /api/workflows/:id` Editor+) — 위와 동일 일치.
- workspace 대칭 검증: `UpdateWorkspaceSettingsDto.maxConcurrentExecutions` (`update-workspace-settings.dto.ts` L45-59) 가 동일하게 `@IsOptional @IsInt @Min(1)` + JSDoc 패턴(§8 admission gate 언급, Parallel 노드 config.maxConcurrency 와 스코프 구분 언급)을 사용 — `WorkflowSettingsDto` 와 line-level 대칭 확인.
- spread-merge 대칭: `workspaces.service.ts` L335 `{ ...(workspace.settings ?? {}), ... }` 패턴과 `workflows.service.ts` L182 `{ ...(workflow.settings ?? {}), ...settings }` 가 동일 패턴 — CHANGELOG/plan 의 "workspace 대칭" 서술과 실제 코드 일치.
- 미지 키 거부(400): 전역 `whitelist+forbidNonWhitelisted` pipe + e2e(B2, `workflow-crud.e2e-spec.ts` L102-141) 가 0/미지키/정상값 3가지 경로를 HTTP 레벨로 검증 — spec 의 admission-gate write validation 의도와 일치.

## 실행 검증

- 코드 리뷰만으로 정적 대조(이전 회차에서 이미 jest 68/68·tsc 0 오류 확인됨, 이번 회차는 swagger 데코레이터 1줄 변경만이라 기능적 재실행 불요 — 타입 레벨 변경 아님, `type:` 옵션은 swagger 스키마 생성에만 영향).
- `git diff origin/main...HEAD -- codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts` 로 실제 fix 라인 직접 확인 완료.

## TODO/FIXME

없음.

## 요약

이전 회차(21_11_10)에서 식별된 INFO 3건 중 swagger nested-type thunk 미준수 건이 `type: () => WorkflowSettingsDto` 로 정확히 수정되어 해소됐음을 실제 diff 로 확인했다. 나머지 2건(`settings: null` no-op 동작 미문서화, `ImportWorkflowDto.settings` opaque 비대칭)은 이번 변경 범위 밖이라 그대로 유지되며 여전히 병합을 막을 사유가 아니다. `Workflow.settings.maxConcurrentExecutions` write 경로는 spec §8(`spec/5-system/4-execution-engine.md` L1076)·§2.4(`spec/1-data-model.md` L120)이 문서화한 필드명·기본값(3)·권한(Editor+)·엔드포인트(`PATCH /api/workflows/:id`)와 line-level 로 정확히 일치하며, workspace 측 `UpdateWorkspaceSettingsDto`/`updateWorkspaceSettings` 와 데코레이터·spread-merge 패턴이 대칭적으로 구현됐다. CRITICAL/WARNING 없음.

## 위험도

LOW
