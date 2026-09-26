# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 CRITICAL 0, WARNING 0, INFO 만 존재)

## 전체 위험도
**LOW** — 코드 전용(Swagger DTO 광고) 변경이 기존 spec §3.2 서술과 필드 단위로 정확히 일치하며, 남은 항목은 전부 이미 트래킹 중인 사소한 INFO.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, convention_compliance | 프런트엔드 export 타입(`ExportedNode.description?` 등)이 optional 로 선언돼 있으나 서버는 항상 키를 싣고 값만 `null` — 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 2026-09-26 자로 등재, 현재 소비처가 필드를 읽지 않아 동작 결함 아님 | `codebase/frontend/src/lib/api/workflows.ts` / `spec/2-navigation/1-workflow-list.md` §3.2 | 조치 불요 — 재등재 금지. 필드를 실제로 읽는 소비처가 생길 때 `string \| null` 로 맞출 것 |
| 2 | convention_compliance | 부모 DTO `ExportWorkflowDto`(동사형 `Export`)와 자식 `ExportedNodeDto`/`ExportedEdgeDto`(과거분사형 `Exported`) 접두 형태 불일치 — 강제 규약 없음 | `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts` | 지금 수정 불요. 재발 방지하려면 `swagger.md` §1-7 형태로 "export 응답 원소는 `Exported<Entity>Dto`" 짧은 규약 추가 검토 |
| 3 | convention_compliance | `spec/2-navigation/4-integration.md` §9.4 실패 응답 포맷(`{code,message,details?}`)이 `spec/5-system/2-api-convention.md` §5.3(`{error:{code,message,requestId,details?}}`)과 불일치 — 이번 diff 와 무관, 이미 `--impl-prep`(22:52:28) WARNING 으로 보고돼 트래커 등재됨 | `spec/2-navigation/4-integration.md` §9.4 | 조치 불요 — planner 가 `spec-draft-nullable-notation-followups.md` 처리 시 함께 고칠 예정. 중복 재상신 금지 |
| 4 | plan_coherence | `plan/in-progress/spec-draft-nullable-notation-followups.md:1315` 의 `ExportWorkflowDto.nodes/.edges` 결정 항목이 이번 PR 로 실제 해소(응답 전용 DTO 확정·구현)됐음에도 체크박스 `[ ]`·미결 문구가 그대로 남아 있음 | `plan/in-progress/spec-draft-nullable-notation-followups.md:1315` | `--impl-done` 통과 후 마무리 커밋에서 `[x]` 체크 + 자매 항목(1307~1313행)과 동일 형식으로 "해소" 문구 갱신 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | spec 델타 0, index 기반 참조 등 신규 DTO 필드가 §3.2/data-flow/data-model 과 전부 일치. INFO 1건(프런트 null 미반영, 기추적) |
| rationale_continuity | NONE | 기각 대안 재도입·원칙 위반·무근거 번복·암묵 가정 충돌 어느 것도 해당 없음. §3.2 서술을 코드로 정확히 구현, `canvas-save-typed` 후속 예정 작업의 실행 |
| convention_compliance | LOW | `swagger.md` DTO 명명·enum·nullable 규약 전부 준수. INFO 3건(접두 형태, §9.4 기존 이슈, 프런트 null 기추적) — 전부 비신규 또는 스타일 수준 |
| plan_coherence | LOW | spec_impact:none 실측 일치, 다른 in-progress plan 과 충돌 없음. INFO 1건(트래커 체크박스 미갱신, plan 자체가 다음 단계로 이미 인지) |
| naming_collision | NONE | `ExportedNodeDto`/`ExportedEdgeDto` 및 필드명 전체 저장소 유일 정의, enum 은 재사용(신규 아님). 충돌 표면 없음 |

## 권장 조치사항
1. (BLOCK 없음 — 필수 조치 없음) `--impl-done` 머지 마무리 커밋에서 `plan/in-progress/spec-draft-nullable-notation-followups.md:1315` 항목을 `[x]` 로 체크하고 자매 항목과 동일 형식으로 해소 문구 기록 (INFO #4).
2. INFO #1~#3 은 이미 `spec-draft-nullable-notation-followups.md` 에 등재된 별도 followup 이므로 이번 라운드에서 추가 조치·재등재 불필요 — planner 턴에서 그 트래커를 처리할 때 함께 반영.