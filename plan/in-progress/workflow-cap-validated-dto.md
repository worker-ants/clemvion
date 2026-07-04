---
worktree: workflow-cap-dto-bca77e
started: 2026-07-04
owner: developer
spec_impact:
  - none
---

# workflow-level cap validated write DTO (exec-intake followup)

`exec-intake-followups.md` "workflow-level cap validated write DTO" 이행. spec §8: 워크플로우당 동시 Execution cap 은 `Workflow.settings.maxConcurrentExecutions` (Editor+ — `PATCH /api/workflows/:id`). Workspace 는 이미 validated DTO(`UpdateWorkspaceSettingsDto`: `@IsOptional @IsInt @Min(1)`) 제공 — workflow 도 대칭화.

## 현황(변경 전)

- `UpdateWorkflowDto.settings` = `@IsObject() Record<string, unknown>` (opaque passthrough — nested 미검증).
- `workflows.service.update` = `Object.assign(workflow, dto)` → settings 전체 교체(full replace).
- 런타임 방어: `resolveExecutionRunPriority`… 아니라 `resolveConcurrencyCap`(execution-limits.ts) 가 `typeof number && isInteger && >0` 아니면 defaultCap fallback → hard-break 는 없었음(방어만).

## 설계 결정

1. **nested validated DTO**: `WorkflowSettingsDto { @IsOptional @IsInt @Min(1) maxConcurrentExecutions? }` 신설. `UpdateWorkflowDto.settings` 를 `@IsOptional @ValidateNested @Type(() => WorkflowSettingsDto)` 로 전환.
2. **strict 채택 근거(계약 축소 안전성 검증)**: 전역 `CustomValidationPipe` 가 `whitelist:true + forbidNonWhitelisted:true` → nested DTO 전환 시 **미지 settings 키는 400**. 이는 workspace 와 동일한 strict 동작이며 안전한 이유:
   - backend 에서 소비되는 workflow settings 키는 `maxConcurrentExecutions` 단 하나(grep 확인; `timeoutMs/retryCount` 는 DTO 예시일 뿐 미소비).
   - frontend `workflowsApi.update` 유일 호출부는 `{ isActive }` 만 전송 — settings 미전송(page.tsx:229). 워크플로우 settings 쓰기 UI 없음.
   - import/duplicate 는 별도 DTO(본 PR 범위 밖).
3. **spread-merge**: service 에서 `settings` 만 `{ ...(workflow.settings ?? {}), ...dto.settings }` 로 병합(나머지 필드는 기존 Object.assign 유지) — DB 잔여 키 보존, workspace 대칭.

## 체크리스트

- [x] impl-prep consistency (spec/5-system/) — 5/5 BLOCK: NO (20_55_13)
- [x] TDD: 검증 거부(0·음수·소수·문자열·미지키 → 400) + 정상 저장 + spread-merge 보존 유닛/e2e
- [x] 구현 (WorkflowSettingsDto + UpdateWorkflowDto + service merge)
- [x] TEST WORKFLOW (lint·unit(신규 12)·build·e2e(232))
- [x] ai-review (21_11_10 → INFO 3건 조치 → fresh 21_28_18 Critical/Warning 0) + impl-done consistency (21_27_41 BLOCK: NO)
- [x] PR

## 후속(별도) — ImportWorkflowDto.settings opaque 비대칭

cross_spec INFO: `ImportWorkflowDto.settings` 는 여전히 opaque `Record` → 같은 `Workflow.settings` jsonb 에 import(opaque) vs patch(strict) 검증 강도 비대칭. 낮은 우선순위 후속 검토(별도 항목).
