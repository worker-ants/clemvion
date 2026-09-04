# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 success, Critical 0건)

## 전체 위험도
**MEDIUM** — 두 checker(cross_spec, rationale_continuity)가 독립적으로 동일 결함을 MEDIUM 으로 판정: `spec/1-data-model.md` 인덱스 정정이 미러 문서 `spec/data-flow/10-triggers.md:175`에 반영되지 않아 두 spec 문서가 같은 물리 인덱스에 대해 서로 다른 사실을 주장하게 된다. 추가로 소스 plan(`spec-draft-nullable-notation-followups.md`)의 열린 항목이 이 결론을 반영하지 못한 채 남아 있다(plan_coherence, LOW).

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — Critical 이 없으므로 인계 대상 없음. 단, 아래 경고 항목들은 target 문서 자체가 `owner: planner` 이므로 발견된 checker(cross_spec/rationale_continuity)가 이미 planner 관할 문서를 대상으로 하고 있어 별도 인계 없이 target 소유자가 직접 처리 가능.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity (중복 통합) | 인덱스 정정이 `spec/1-data-model.md` §3 한 곳만 반영되고 동일 인덱스를 미러링하는 `spec/data-flow/10-triggers.md` Schema 매핑 표는 그대로 남아, 머지 직후 두 spec 문서가 같은 물리 인덱스(`schedule` 테이블)에 대해 서로 다른 값(`(next_run_at, is_active)` vs `(workspace_id, next_run_at)`)을 주장하게 됨. `spec/1-data-model.md` 자신의 기존 Rationale(`WorkflowVersion.snapshot` 정정 항목)이 이미 "한 문서만 고치고 미러 문서를 놓친" 동일 클래스의 drift 를 기록해 둔 바 있어 재발 위험이 명시적으로 경고돼 있던 패턴 | `plan/in-progress/spec-draft-schedule-index.md` §3 변경안(A), frontmatter `spec_impact: [spec/1-data-model.md]` | `spec/data-flow/10-triggers.md:175` (§2.1 Schema 매핑 — Postgres, "schedule\|발사 후\|...\|`(next_run_at, is_active)`" 행) | `spec/data-flow/10-triggers.md:175` 의 인덱스 열을 `(workspace_id, next_run_at)` 로 같은 PR/같은 planner 턴에서 함께 갱신하고, target frontmatter `spec_impact` 에 이 파일을 추가 |
| 2 | plan_coherence | 출처 plan(`spec-draft-nullable-notation-followups.md`)의 열린 항목(L379-397, 종결조건 표 L434)이 target 의 결론(등재된 선택지 (a)/(b) 둘 다 기각, (c) `(workspace_id, next_run_at)` 채택)을 반영하지 못한 채 "EXPLAIN 필요, 미해결"로 남아 있음. 트랙이 `developer/DBA` 로 열려 있어 target 을 못 본 작업자가 (a) DROP 또는 (b) 재생성으로 실제 마이그레이션을 만들 위험 | `plan/in-progress/spec-draft-schedule-index.md` 전체(L14-17 인용문, §2 L78-109) | `plan/in-progress/spec-draft-nullable-notation-followups.md` L379, L397, L434 (종결조건 표) | L379-397 항목 본문을 "실측 완료 — 답은 (c), 상세는 spec-draft-schedule-index.md 참조"로 정정, L434 종결조건 표의 트랙을 `developer/DBA`→`developer`(V110 적용만 남음), "선행 조건"을 "EXPLAIN·테이블 크기"→"V110 마이그레이션 적용"으로 갱신. 두 draft 가 같은 PR 로 합쳐질 경우 병합 커밋에서 함께 갱신 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | plan_coherence | 항목 트랙 라벨(`developer/DBA`)과 실제 수행 주체(planner) 불일치 — 역할 경계 위반은 아니나 향후 추적 혼선 소지 | `plan/in-progress/spec-draft-schedule-index.md` §5, frontmatter `owner: planner` / 소스 plan L379 | 위 WARNING #2 갱신과 함께 트랙 라벨을 "측정+spec 서술(planner, 완료) / 마이그레이션 실행(developer, 잔여)"로 분리 표기 |
| 2 | convention_compliance | frontmatter `started: 2026-09-05` 가 세션 현재일(2026-09-04)보다 하루 앞섬. 형제 plan은 오늘 날짜 사용 — 규약 위반은 아니나 국소 관행과 어긋남 | frontmatter `started` | 오타 여부 확인 후 `2026-09-04` 로 정정, 또는 의도적이면 그대로 유지 |
| 3 | convention_compliance | "§3 답은 (c)" 단락의 "현재 상태 대비 31배" 서술이 표의 "현재"(부분 인덱스, 7.80ms) 기준으로는 ≈41.5배가 되고, "31배"는 오히려 (a)(인덱스 없음, 5.86ms) 기준(≈31.2배)에 더 가까움 — 규약 준수 범주 밖의 수치 정합성 문제 | "### 답은 (c)" 단락 | 정식 규약 검토 대상은 아니나 기술 정확성 재확인 권장(별도 review 또는 이번 라운드 내 정정) |
| 4 | naming_collision | 신규 마이그레이션 버전 `V110` 은 현재 시점 미점유(main 최대는 V109) — 충돌 없음. 다만 `migrations.md §5` 절차상 PR 열기 직전 재확인 필요 | §3 변경안(A) 표, §5 본문 | developer 단계 착수 시 `ls codebase/backend/migrations \| tail -2` 로 재확인, 점유돼 있으면 번호 갱신 |
| 5 | naming_collision | `Schedule (trigger_id)` 신규 행(§4 변경안 B)은 실제로는 기존 `V106__schedule_trigger_id_index.sql`(`idx_schedule_trigger_id`)의 문서화 공백을 메우는 것 — 충돌 아님, 검증 기록용 | §4 변경안 (B) | 없음(문제 없음) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | `spec/data-flow/10-triggers.md:175` 인덱스 미러가 target 의 `spec_impact` 범위 밖에 있어 정정 후 두 spec 이 같은 인덱스에 대해 서로 다른 값을 주장하게 됨 |
| rationale_continuity | MEDIUM | 동일 결함을 Rationale 연속성 관점에서 확인 — `spec/1-data-model.md` 자신의 과거 Rationale 이 경고한 "한 문서만 고치고 미러를 놓치는" drift 패턴의 재현. 기각된 대안 재도입 등 다른 위반은 없음 |
| convention_compliance | NONE | 정식 규약(migrations.md, plan/spec-draft 명명, frontmatter 스키마, append-only 원칙, 역할 분리) 위반 없음. INFO 2건은 규약 밖 참고사항 |
| plan_coherence | LOW | target 자체는 선행 조건을 충족하며 결론을 도출했으나, 소스 plan(`spec-draft-nullable-notation-followups.md`)의 해당 항목이 그 결론을 반영하도록 아직 동기화되지 않음 |
| naming_collision | NONE | 신규 식별자는 `V110` 하나뿐이며 현재 미점유로 충돌 없음. `trigger_id` 행은 기존 실체의 문서화일 뿐 |

## 권장 조치사항
1. (WARNING #1 해소, 최우선) `spec/data-flow/10-triggers.md:175` 의 `schedule` 인덱스 열을 `(next_run_at, is_active)` → `(workspace_id, next_run_at)` 로 target 과 같은 PR/턴에서 함께 갱신하고, target frontmatter `spec_impact` 에 이 파일 추가.
2. (WARNING #2 해소) `plan/in-progress/spec-draft-nullable-notation-followups.md` L379-397 항목 본문과 L434 종결조건 표를 target 의 결론(답은 (c))으로 갱신 — 트랙을 `developer/DBA`→`developer`(V110 적용만 잔여)로 조정.
3. (INFO, 선택) frontmatter `started` 날짜 정정 여부 확인.
4. (INFO, 선택) "31배" 수치 서술을 기준선("현재" vs "(a) 인덱스 없음") 명확화하여 재확인.
5. (INFO, 선택) developer 단계 착수 시 `V110` 번호 재확인 절차를 그 시점에 실행.
