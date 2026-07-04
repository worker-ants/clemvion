# Cross-Spec 일관성 검토 — workflow-cap-validated-dto

> **payload 스코프 안내**: `_prompts/cross_spec.md` 에 번들된 target 문서는 `spec/5-system/1-auth.md`
> 와 `spec/5-system/10-graph-rag.md` 였고, 실제 변경 대상(`Workflow.settings.maxConcurrentExecutions`
> 관련 spec)인 `spec/1-data-model.md` §2.4·`spec/5-system/4-execution-engine.md` §8 은 포함되어
> 있지 않았다 — mis-scope. 지시에 따라 `git diff origin/main...HEAD`(실제 코드 diff)와 해당 spec
> 섹션을 직접 조사해 검토했다. 동일 target 에 대한 직전 실행 결과가
> `review/consistency/2026/07/04/20_55_13/cross_spec.md` 에 이미 존재하며(코드 변경 없이 재실행),
> 아래는 그 결과를 diff 로 독립 재검증한 것이다.

## 대상 변경 요약

`UpdateWorkflowDto.settings`(기존 `@IsObject() Record<string, unknown>`, opaque)를 nested
`WorkflowSettingsDto { @IsOptional @IsInt @Min(1) maxConcurrentExecutions? }` + `@ValidateNested`
+ `@Type(() => WorkflowSettingsDto)` 로 전환. 전역 `CustomValidationPipe`(whitelist +
forbidNonWhitelisted)로 인해 미지 키는 400 거부. `workflows.service.ts#update` 는 `settings` 를
`Object.assign` 전체 교체 대상에서 분리해 `{ ...(workflow.settings ?? {}), ...settings }` spread-merge
로 처리(workspace 측과 대칭).

## 발견사항

- **[INFO]** `ImportWorkflowDto.settings` 는 여전히 opaque `Record<string, unknown>` — 진입점 간 검증 강도 비대칭
  - target 위치: `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts`(strict 화) vs
    `codebase/backend/src/modules/workflows/dto/import-workflow.dto.ts`(opaque, 미변경)
  - 충돌 대상: 동일 `Workflow.settings` JSONB 컬럼([`spec/1-data-model.md` §2.4](../../../../spec/1-data-model.md))
  - 상세: `PATCH /api/workflows/:id` 는 이제 `maxConcurrentExecutions` 외 키를 400 거부하지만,
    `POST /api/workflows/import`(`ImportWorkflowDto`)는 동일 컬럼에 여전히 임의 키를 무검증 저장할 수
    있다. export(설정 그대로 포함) → 다른 워크스페이스 import → 이후 PATCH 시도만 예기치 않게 400 이
    되는 비대칭이 발생. 이번 변경이 새로 만든 모순은 아니고 기존 비대칭(하나는 opaque, 다른 하나가
    이번에 strict 화)이 더 도드라지는 것.
  - 제안: 본 PR 범위 밖 결정(plan 명시)은 타당. 후속 plan(`exec-intake-followups.md` 류)에
    "ImportWorkflowDto.settings 도 WorkflowSettingsDto 로 정합화" 항목을 명시적으로 남겨두는 것을 권장.

- **[INFO]** §8 "2단계 후속" per-workflow 타임아웃 설정이 같은 `Workflow.settings` 네임스페이스를 예고
  - target 위치: `codebase/backend/src/modules/workflows/dto/workflow-settings.dto.ts`(단일 필드
    `maxConcurrentExecutions` 만 정의)
  - 충돌 대상: `spec/5-system/4-execution-engine.md` §8 표 "단일 Execution 최대 실행 시간" 행 —
    "(2단계 후속) per-workflow `Workflow.settings`" 예고 + 동 문서 Rationale
  - 상세: 현재는 그 필드가 미구현이라 직접 모순은 없다. 그러나 `forbidNonWhitelisted:true` strict DTO
    이므로, spec 이 이미 예고한 두 번째 키가 실제 추가될 때 `WorkflowSettingsDto` 확장이 반드시
    동반돼야 한다(잊으면 신규 키도 400). 코드/PR 어디에도 이 결합이 명시되어 있지 않음.
  - 제안: `WorkflowSettingsDto` 상단 주석 또는 PR 설명에 "§8 2단계 필드 추가 시 본 DTO 확장 필수" 한 줄
    권장(필수 아님).

- **[INFO]** `settings` merge 의미 변경(full-replace → spread-merge)이 spec 본문에 미기재
  - target 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` (`update`)
  - 충돌 대상: `spec/1-data-model.md` §2.4 / `spec/5-system/4-execution-engine.md` §8 — 두 문서 모두
    PATCH 의 merge-vs-replace 의미를 명시하지 않음(코드/plan 에만 존재)
  - 상세: 직접 충돌은 아니나(버전 스냅샷은 애초 `settings` 를 다루지 않으므로 무관), PATCH 의 부분
    병합 동작 자체는 API 계약 변경이며 spec 본문에 문서화되어 있지 않다.
  - 제안: `spec/1-data-model.md` §2.4 `settings` 셀 또는 `spec/5-system/4-execution-engine.md` §8
    각주에 "PATCH 는 지정된 키만 병합, 나머지 키 보존(workspace 와 동형)" 한 줄 추가 권장.

## 정합성 확인된 사항 (충돌 없음)

- **데이터 모델**: `spec/1-data-model.md` §2.4 는 이미 `Workflow.settings JSONB` 의 알려진 키를
  `maxConcurrentExecutions` 단 하나로 명시(§2.2 Workspace 도 동형: `timezone` /
  `interactionAllowedOrigins` / `maxConcurrentExecutions` 3키). `WorkflowSettingsDto` 는 정확히 이
  계약을 코드로 강제하는 것이라 모순 없음 — 오히려 spec-코드 간극을 좁힘.
- **API 계약**: `spec/5-system/4-execution-engine.md` §8 표의
  `Workflow.settings.maxConcurrentExecutions (Editor+ — PATCH /api/workflows/:id)` 와 코드의
  `@Roles('editor')` 가드(`workflows.controller.ts:164-165`)·엔드포인트 경로가 완전히 일치.
- **RBAC**: `spec/5-system/1-auth.md` §3.2 매트릭스의 `Workflow: CRUD (Editor)` 와 어긋나지 않음.
  Workspace 쪽(`PATCH /api/workspaces/:id/settings`, Admin+, `spec/1-data-model.md` §2.2)과의
  권한 분리도 각자 spec 위치(§8 표 각 행)에 정확히 반영되어 두 엔드포인트가 혼동되지 않음.
- **Workspace 대칭성**: `UpdateWorkspaceSettingsDto`(`update-workspace-settings.dto.ts`)가 이미
  동일 필드명(`maxConcurrentExecutions`)·동일 검증(`@IsOptional @IsInt @Min(1)`)·동일 admission-gate
  주석 패턴으로 선례를 세워두었고, 이번 workflow 측 DTO 는 그 선례를 그대로 따른다 — 방향성 일관.
- **테스트/CHANGELOG**: `workflow-dto-validation.spec.ts`(신규 65줄) · `workflows.service.spec.ts`
  (spread-merge 52줄 추가) · `workflow-crud.e2e-spec.ts`(40줄) 가 신규 검증·병합 동작을 커버하며
  CHANGELOG.md 항목도 동일 변경을 정확히 반영.

## 요약

이번 target(workflow-level cap validated DTO)은 `spec/1-data-model.md` §2.4 와
`spec/5-system/4-execution-engine.md` §8 이 이미 문서화한 "Workflow.settings 의 유일한 알려진 키 =
maxConcurrentExecutions" 계약을 코드 검증으로 강제하는 변경이며, workspace 측 기존 validated DTO
선례(`UpdateWorkspaceSettingsDto`)와 필드명·검증 규칙·주석 패턴까지 완전히 대칭이다. RBAC(Editor+
`PATCH /api/workflows/:id`)·엔드포인트 경로·소비 로직(`resolveConcurrencyCap`) 모두 spec 과 정확히
부합하며, 다른 영역(1-auth RBAC 매트릭스·데이터 모델 §2.2/§2.4)과의 충돌은 발견되지 않았다. CRITICAL/
WARNING 급 cross-spec 모순은 없고, ImportWorkflowDto 비대칭·§8 2단계 후속 필드 확장 결합·merge 의미
미문서화 3건만 INFO 로 기록해 후속 정합화 대상으로 남긴다. 직전 실행(`20_55_13`)과 결론이 동일하며
코드 변경은 그 사이 없었다.

## 위험도

LOW

BLOCK: NO
STATUS: SUCCESS
