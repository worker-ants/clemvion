# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 없음

## 전체 위험도
**LOW** — Critical/충돌 없음. WARNING 1건(`plan/complete/` 선인용, 이미 plan 체크리스트가 추적 중인 저위험 창)과 harness 자체의 컨텍스트 예산 절단(INFO, 5개 checker 중 3개가 동일 갭을 각자 실측·직접 파일 조회로 우회) 만 확인됨.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance, plan_coherence (중복 통합, 상위 등급 채택) | `spec/1-data-model.md` Rationale 이 아직 `plan/in-progress/`에 있는 draft(`spec-draft-graph-fk-indexes.md`)를 `plan/complete/` 경로로 선인용 | `spec/1-data-model.md` `## Rationale` → "그래프 RAG 삭제 연쇄의 FK 인덱스 넷 (2026-09-18)" 절 말미(약 1001~1002행) | `plan/in-progress/spec-draft-graph-fk-indexes.md` (아직 `complete/` 미이동, 체크리스트 마지막 항목 미완료) — 직전 선례 V112~V116(`6dbac1f53`)은 인용과 이동을 같은 커밋에서 원자적으로 처리해 이 창이 없었음 | (a) 인용을 현재 시점 실제 경로(`plan/in-progress/...`, 완료 후 `complete/`로 갱신 예정 명시)로 정정하거나, (b) PR 마지막 커밋(트래커 `complete/` 이동)에서 이 스펙 인용문 + 다음에 작성할 V117~V120 SQL 헤더 인용을 함께 검증하는 체크리스트 항목을 명시적으로 추가. plan 체크리스트가 이미 이동 항목을 갖고 있어 실전 위험은 낮으나, PR 이 여러 개로 쪼개지면 참조가 영구히 깨질 수 있으므로 --impl-prep 단계에서 명시적으로 기록. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, convention_compliance (중복 통합) | `--impl-prep` 번들의 컨텍스트 예산이 `spec/conventions/migrations.md` 등 이번 작업과 가장 밀접한 컨벤션 본문을 "본문 생략됨"으로 절단(반면 무관한 `audit-actions.md`·cafe24 카탈로그는 전문 실림) | 호출 payload `_prompts/*.md` 전체 | target 문서 결함 아님 — harness 백로그. 3개 checker(cross_spec/convention_compliance/naming_collision)가 각자 실제 파일을 직접 Read 해 우회했으나 재발 방지책 없음. 번들러가 diff/scope 와 직접 관련된 conventions 파일을 우선 포함하도록 예산 배분 개선 검토(기존 메모 `feedback_consistency_spec_mode_budget.md`와 동일 클래스가 `--impl-prep` 경로에도 재발함을 추가 기록) |
| 2 | naming_collision | `spec/1-data-model.md` 내 세 Rationale 절 제목("삭제 연쇄의 FK 인덱스 다섯/넷", "Trigger `(workflow_id)` 인덱스")이 같은 날짜 라벨·유사 형태를 공유 | `spec/1-data-model.md:968, 1004, 1054` | 의미 충돌 아님(서로 다른 테이블 계열, 새 절이 관계를 본문에 명시). 이전 라운드(`14_54_15/naming_collision.md`)에서 이미 지적·수용되어 커밋에 반영된 상태 — 조치 불요, 향후 유사 절 추가 시 테이블/도메인 접두어 유지 관례만 지속 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 3개 spec 문서(`1-data-model.md`/`10-graph-rag.md`/`6-knowledge-base.md`)·실 DB 스키마(V025)·`migrations.md` 규약 간 모순 없음. harness 번들 절단 INFO 1건 |
| rationale_continuity | NONE | V111~V116 선례의 0-DROP 패턴·partial-index 판단 축·"다섯" 절 선행 예측 갱신 방식을 그대로 계승, 무근거 번복 없음 |
| convention_compliance | LOW | V번호·CONCURRENTLY·네이밍 규약 준수 확인. `plan/complete/` 선인용 WARNING 1건 + 번들 절단 INFO 1건 |
| plan_coherence | LOW | V번호 충돌·트래커 산술·인접 미해결 결정과의 스키마 비중첩 확인. 동일 선인용 이슈를 INFO로 보고(WARNING으로 상향 통합) |
| naming_collision | NONE | 신규 마이그레이션 버전(V117~V120)·인덱스 이름 넷 워크트리+origin/main 전수 grep 0건 충돌. Rationale 제목 근접 INFO 1건(기수용) |

## 권장 조치사항
1. (BLOCK 해소 대상 없음 — BLOCK: NO)
2. `spec/1-data-model.md` Rationale 의 `plan/complete/spec-draft-graph-fk-indexes.md` 인용을 현재 시점에 맞게 정정하거나, PR 마지막 커밋(트래커 이동)에서 이 인용 + 향후 V117~V120 SQL 헤더 인용을 함께 검증하는 체크리스트 항목을 `plan/in-progress/spec-draft-graph-fk-indexes.md` 에 명시적으로 추가한다.
3. (harness 백로그, target 결함 아님) `--impl-prep`/`--spec` 번들러가 diff-scope 와 직접 관련된 `spec/conventions/*.md` 를 우선 포함하도록 예산 배분을 개선하거나, 절단된 파일 목록을 checker 프롬프트 상단에 강조해 "직접 Read 로 보완" 을 명시적으로 지시하는 방안을 검토한다.
