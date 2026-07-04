# consistency-check --impl-prep SUMMARY — ImportWorkflowDto.settings strict DTO

- 모드: `--impl-prep` scope=`spec/5-system/` · 세션: `review/consistency/2026/07/04/22_46_30`
- 계획: `ImportWorkflowDto.settings` → strict nested `WorkflowSettingsDto`(PR #805 미러), import-vs-patch 비대칭 해소.

## BLOCK: NO (착수 승인) — 5/5 checker

| checker | 결과 | 핵심 |
| --- | --- | --- |
| cross_spec | BLOCK: NO | §2.4/§8/§3.2 무모순. update DTO 와의 비일관성 해소. round-trip 안전. |
| rationale_continuity | BLOCK: NO | #805 가 명시 defer 한 후속 이행(번복 아님). workflow-list §Rationale "permissive config" 는 **node config** 스코프라 workflow settings 와 무관. |
| convention_compliance | BLOCK: NO | UpdateWorkflowDto·파일 내 nodes/edges nested 관례 정확 미러. WorkflowSettingsDto 재사용. |
| plan_coherence | BLOCK: NO | 2개 선행 plan 이 명시 defer 한 항목. 충돌 없음. |
| naming_collision | BLOCK: NO | 신규 식별자 없음(WorkflowSettingsDto 재사용). 에러코드/env/migration 없음. |

## 착수 반영 (문서 완결성 — cross_spec·rationale INFO)

- `spec/2-navigation/1-workflow-list.md §3.2`(import 검증 목록)에 workflow-level `settings` strict 400 동작 note 추가 — node `config` permissive 정책과 **구별**. (permissive Rationale 스코프 명확화 + SoT-dispersion 완화.)
- CHANGELOG(import 엔드포인트 narrowing) 추가.
- spec_impact: `spec/2-navigation/1-workflow-list.md`(§3.2 doc-sync). §5-system 본문 무변경.

## 설계 확정

- `@IsObject @ValidateNested @Type(() => WorkflowSettingsDto)` + swagger thunk. service `importWorkflow` 무변경(신규 생성, `dto.settings ?? {}` 직접 write). strict 안전=#805 논거(단일 키·round-trip).
