# consistency-check --impl-prep SUMMARY — workflow cap validated DTO

- 모드: `--impl-prep` scope=`spec/5-system/` · 세션: `review/consistency/2026/07/04/20_55_13`
- 계획: `Workflow.settings.maxConcurrentExecutions` nested validated DTO(`WorkflowSettingsDto`) 로 대칭화 (workspace `UpdateWorkspaceSettingsDto` 미러).

## BLOCK: NO (착수 승인) — 5/5 checker

| checker | 결과 | 비고 |
| --- | --- | --- |
| cross_spec | BLOCK: NO | strict `WorkflowSettingsDto` 가 §2.4·§8 이 이미 문서화한 계약과 정확히 일치. workspace 선례 미러. |
| rationale_continuity | BLOCK: NO | "arbitrary settings" 는 DTO Swagger 주석일 뿐 합의된 Rationale 아님. §2.4 가 이미 Workflow.settings 를 maxConcurrentExecutions 로 스코프. narrowing = 정합(번복 아님). |
| convention_compliance | BLOCK: NO | trigger DTO nested 패턴·swagger.md 정합. INFO: `@IsObject()`+`@ValidateNested`+`@Type` 동반, 파일명 `workflow-settings.dto.ts`, swagger type 갱신. |
| plan_coherence | BLOCK: NO | PR2b settings-governance 결정 위에 DTO 검증 strictness 만 추가. 타 in-progress plan 충돌 없음. |
| naming_collision | BLOCK: NO | `WorkflowSettingsDto` 신규(0 hit). nested 이므로 `Update` prefix 미부여가 올바름. |

## 설계 확정 (checker 검증 반영)

- strict nested DTO 채택 — 전역 pipe whitelist+forbidNonWhitelisted → 미지 settings 키 400. §2.4 가 이미 단일 키로 스코프하므로 계약 narrowing 아닌 정합.
- `@IsObject()` + `@ValidateNested()` + `@Type(() => WorkflowSettingsDto)` (trigger DTO 관례).
- service spread-merge (DB 잔여 키 보존).

## 후속 기록 (INFO, 본 PR 밖)

- `ImportWorkflowDto.settings` 는 opaque 유지 → 같은 jsonb 컬럼에 import-vs-patch 검증 강도 비대칭(별도 후속 검토).
- §8 "stage 2" per-workflow timeout 키 도입 시 `WorkflowSettingsDto` 확장 필요(future).
- full-replace→spread-merge 는 내부 service 동작(스펙 산문 무관).
