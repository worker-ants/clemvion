# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 CRITICAL 0건)

## 전체 위험도
**LOW** — Cross-Spec/Rationale/Plan/Naming 4개 checker 는 NONE, Convention Compliance 1개 checker 만 WARNING 1건(LOW) 보고. 구현 착수를 막을 근거 없음.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `spec/1-data-model.md` 신설 Rationale 절이 아직 `plan/in-progress/`에만 있는 draft(`spec-draft-trigger-workflow-index.md`)를 이미 `plan/complete/`로 이동된 것처럼 서술(`실측 절차는 plan/complete/spec-draft-trigger-workflow-index.md`) — `ls plan/complete/spec-draft-trigger-workflow-index.md` 결과 실재하지 않음. 이 PR 자신의 승인된 draft 본문은 "이동 예정"으로 더 신중하게 표현했었는데 실제 커밋에서 유보 표현이 사라짐. `spec-link-integrity.test.ts` 는 backtick 텍스트라 이 참조를 잡지 못함(마크다운 링크가 아님) | `spec/1-data-model.md` `## Rationale` → `### Trigger \`(workflow_id)\` 인덱스 (2026-09-18)` 절 말미 | `spec/conventions/spec-impl-evidence.md` §3.1(R-11) "spec 의 plan 참조는 그 시점의 실제 파일 위치를 가리킨다" 원칙, 및 선례(V110/#1285, `7eb9815ee`)가 plan 이동과 같은 원자적 커밋에서만 이 문구를 추가한 패턴 | 이번 PR 이 V111 구현 + 트래커 반영 + draft `plan/complete/` 이동까지 한 PR 에서 완결한다면 문구가 착지 시점에 참이 되어 실질적 위해는 없음. 안전하게 가려면 (a) `--impl-done` 전까지 `plan/in-progress/...`로 적었다가 plan 이동 커밋에서 `plan/complete/...`로 교체하거나, (b) 이 커밋과 plan 이동 커밋을 분리하지 않는다는 것을 plan 체크리스트에 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | 마이그레이션 명명·감사 액션·Secret Store 비노출·Swagger DTO 명명·에러 코드·frontmatter evidence 스키마 등 다축 대조 — 전부 준수 확인(양성) | `spec/2-navigation/2-trigger-list.md`, `spec/1-data-model.md §3`, `spec/data-flow/10-triggers.md §2.1` | 조치 불필요 (참고용 기록) |
| 2 | naming_collision | `V111` 마이그레이션 번호는 병렬 세션이 동시 점유할 구조적 가능성 있음 — 의미 충돌이 아니라 `spec/conventions/migrations.md`가 다루는 "머지 race 안전망" 범주 | `codebase/backend/migrations/V111__trigger_workflow_id_index.{sql,conf}` (아직 미생성, 현재 max V110) | plan 이 이미 명시한 "커밋 직전 V111 미점유 재확인" 절차를 구현 시 실행 |
| 3 | plan_coherence | 트래커(`spec-draft-nullable-notation-followups.md`) "부모 삭제 경로의 성능 후속" 첫째·셋째 불릿 반영 및 나머지 6개 FK 신규 트래커 항목 추가는 draft 체크리스트상 "구현 완료 후"로 예정 — 현재 미착수이나 순서상 정상 | `plan/in-progress/spec-draft-nullable-notation-followups.md`, `plan/in-progress/spec-draft-trigger-workflow-index.md` `## 체크리스트` | `--impl-done` 단계에서 트래커 반영이 실제로 이뤄졌는지 재확인 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 데이터 모델·API·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 충돌 없음. `select` 좁히기가 실제 소비 필드(`id`/`type`/`config`)와 정확히 일치, V111 마이그레이션 형태(DROP-먼저)가 컨벤션과 일치 |
| rationale_continuity | NONE | 기각된 대안 재도입·합의 원칙 위반·무근거 번복·invariant 우회 모두 미발견. Schedule 인덱스 "선두는 술어 컬럼" 원칙과 User 민감 컬럼 방어의 select 투영/select:false 구분을 정확히 계승 |
| convention_compliance | LOW | WARNING 1건(plan/complete 미이동 참조, 자동 가드 미탐지 경로) 외 나머지 전 축 준수. 컨텍스트 예산 절단을 파일시스템 직접 대조로 보완 |
| plan_coherence | NONE | 미해결 결정·선행 plan 미해소·후속 항목 누락 모두 없음. spec 커밋(S1~S3)이 이미 draft 문구와 일치, 선행 트리거 자원 정리(#1345~#1348) 전부 머지 완료 |
| naming_collision | NONE | 신규 식별자(`idx_trigger_workflow_id`, `V111`, Rationale 절 제목, 표 신규 행) 전수 검색 결과 기존 정의와 충돌 없음. 명명 패턴도 선례(`idx_<table>_<column>`, V-단조증가)와 일치 |

## 권장 조치사항
1. (선택, 비차단) `spec/1-data-model.md` Rationale 의 `plan/complete/spec-draft-trigger-workflow-index.md` 참조를 이번 PR 완결 시점(V111 구현 + 트래커 반영 + draft 이동)까지 실제로 맞출 것 — 완결되지 않을 가능성이 있다면 지금 `plan/in-progress/...`로 되돌려 두는 편이 안전.
2. `--impl-done` 단계에서 `plan-draft-nullable-notation-followups.md` 트래커 반영(첫째·셋째 불릿 완료 표시 + 나머지 6개 FK 신규 항목) 및 draft 의 `plan/complete/` 이동 여부를 재확인.
3. 구현 커밋 직전 `V111` 마이그레이션 번호 미점유 재확인(병렬 세션 race 대비, plan 이 이미 명시한 절차).
