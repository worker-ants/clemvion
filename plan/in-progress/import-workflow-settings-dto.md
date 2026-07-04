---
worktree: import-settings-dto-1df4ae
started: 2026-07-04
owner: developer
spec_impact:
  - spec/2-navigation/1-workflow-list.md
---

# ImportWorkflowDto.settings strict DTO (PR #805 파생 비대칭 해소)

PR #805 가 `UpdateWorkflowDto.settings` 를 strict `WorkflowSettingsDto`(nested validated)로 만들었으나, 같은 `Workflow.settings` jsonb 를 쓰는 `ImportWorkflowDto.settings`(`POST /api/workflows/import`)는 opaque `@IsObject() Record` 로 남아 **import(opaque) vs patch(strict) 검증 강도 비대칭**. ai-review(#806·#805 cross_spec INFO)이 반복 지적한 후속.

## 현황(변경 전)

- `import-workflow.dto.ts` `ImportWorkflowDto.settings` = `@IsOptional @IsObject settings?: Record<string, unknown>`. (같은 파일 `nodes`/`edges` 는 이미 `@ValidateNested @Type`.)
- `workflows.service.importWorkflow` 는 새 엔티티에 `settings: dto.settings ?? {}` 직접 write(merge 아님 — 신규 생성). DTO 검증이 write 경계 게이트.
- export(`exportWorkflow`)는 `settings: workflow.settings`(DB jsonb) as-is emit.

## 설계 결정

1. `ImportWorkflowDto.settings` 를 `@IsObject @ValidateNested @Type(() => WorkflowSettingsDto)` + `@ApiPropertyOptional({ type: () => WorkflowSettingsDto })` 로 전환(UpdateWorkflowDto·트리거 DTO 관례 동일). 미지 키·비양수·비정수 → 400(전역 whitelist+forbidNonWhitelisted).
2. **strict 안전성(=#805 논거 재사용)**: backend 소비 키는 `maxConcurrentExecutions` 단 하나, export 는 post-#805 settings(그 키만) as-is emit → export→import round-trip 안전. §2.4 가 이미 Workflow.settings 를 이 키로 스코프(import 도 같은 컬럼). 신규 nested DTO/파일 없음(WorkflowSettingsDto 재사용).
3. service `importWorkflow` 무변경(신규 생성이라 merge 불요, `dto.settings ?? {}` 직접 write 유지).

## 체크리스트

- [x] impl-prep consistency (spec/5-system/) — 5/5 BLOCK: NO (22_46_30)
- [x] TDD: DTO 검증 9(정상·경계1·empty·omit·0/음수/소수·문자열·미지키) + service import 저장 2 + e2e round-trip(영속·미지키 400)
- [x] 구현 (ImportWorkflowDto.settings nested DTO + service jsonb 평탄화)
- [x] CHANGELOG + spec/2-navigation/1-workflow-list.md §3.2·Rationale doc-sync
- [x] TEST WORKFLOW (lint·unit(신규 11)·build·e2e(235))
- [ ] ai-review + impl-done consistency
- [ ] PR
