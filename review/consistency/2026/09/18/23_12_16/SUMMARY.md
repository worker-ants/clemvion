# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원이 전문을 확보했고, CRITICAL 위반이 하나도 발견되지 않았다.

## 전체 위험도
**LOW** — 실제 diff(FK 인덱스 V121~V130 + e2e + 관련 spec/data-flow 갱신)는 spec·convention·plan·naming 네 축 모두와 정합하며, 발견된 것은 INFO 수준 기록사항과 이 PR 이전부터 있던 pre-existing WARNING(이미 트래커 등재) 하나뿐이다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `spec/conventions/` 문서군 3섹션(Overview/본문/Rationale) 구조 편차 — `migrations.md` 는 번호 붙은 `## 7. 폐기 대안 (Rationale)` + `## 참고` 종결, 최상위 23개 중 13개가 `## Overview` 생략 | `spec/conventions/migrations.md` 전체 구조, `spec/conventions/` 최상위 문서군 | `.claude/skills/project-planner/SKILL.md` "Spec 문서 구조(3섹션 권장)" | 이번 PR 이 만든 위반이 아니며 `plan/in-progress/spec-draft-nullable-notation-followups.md`(라인 4644~4648)에 "결정할 것: 관례로 맞출지 예외로 둘지"로 이미 미결 항목 등재됨. 신규 조치 불요 — 트래커에서 계속 추적 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `plan/complete/spec-draft-fk-remaining-dispositions.md` 선인용 — 실제 파일은 아직 `plan/in-progress/`에 있음(`status: in-progress`) | 10개 마이그레이션 헤더 주석, `spec/1-data-model.md ## Rationale`, e2e 스펙 주석 | target 문서 자신이 "PR 마지막 커밋에서 이동" 을 전제한다고 명시 — 마무리 커밋에서 `git mv plan/in-progress/spec-draft-fk-remaining-dispositions.md plan/complete/` 실제 수행 여부 확인 |
| 2 | Cross-Spec | `AuthConfig.workspace_id`(V127) 는 어떤 data-flow 문서에도 전용 Sink 행이 없음(기존 구조 그대로 상속, 이 PR 이 만든 공백 아님) | `spec/1-data-model.md:931`(§3 행), `:1159`(Rationale) | cross-spec 실익 낮음 — 별도 트래커 항목으로만 남기고 본 PR 범위 밖 |
| 3 | Rationale Continuity | 이전 절의 셈 오류(«37개»)를 삭제·치환하지 않고 방법론 각주로 정정(→40) — 침묵 번복 아닌 스코프 명시형 정정, 저장소 기존 관례와 결이 같음 | `spec/1-data-model.md ## Rationale` «쓸 인덱스가 없는 FK 서른하나의 처분» 「셈법 보정」 문단 | 조치 불요(기록용) — 향후 유사 정정 시 선례로 인용 가능 |
| 4 | Rationale Continuity | `alert_rule.workflow_id` 비대상 결정을 워크플로 10만 규모로 재실측(1.3ms) 후 유지 — 옛 결론 무비판 상속 아님 | `spec/1-data-model.md ## Rationale` «삭제 연쇄의 FK 인덱스 다섯» 절 말미 | 조치 불요(기록용) |
| 5 | Plan Coherence | V121~V130 실제 파일명·컬럼 매핑이 draft 처분표(`spec-draft-fk-remaining-dispositions.md`)와 정확히 1:1 일치, V번호 정책(main max+1) 충돌 없음 | `spec/conventions/migrations.md` §1·§2 | 조치 불요 |
| 6 | Plan Coherence | "트래커 반영" 체크리스트 마지막 항목이 예고대로 uncommitted 상태로 실행 중(부록 갱신 + 신규 항목 2건) | `plan/in-progress/spec-draft-fk-remaining-dispositions.md` "## 트래커 반영" 절 | 조치 불요 — draft 체크리스트 잔여 2항목(`--impl-done`, `complete/` 이동) 완료 시 시퀀스 종결 |
| 7 | Plan Coherence | `spec/conventions/` 3섹션 구조 편차 미해결 결정은 target 상태와 계속 무충돌 — 이번 PR 이 그 구조에 손대지 않고 열린 채로 둠 | `spec/conventions/migrations.md` §7 + `## 참고` | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | V121~V130 이름·컬럼·partial 조건·측정치가 spec/data-flow 와 리터럴 일치. plan 파일 이동 선인용(계획된 절차)·AuthConfig sink 행 부재(기존 구조 상속)만 INFO |
| Rationale Continuity | NONE | 셈 오류 정정·비대상 유지 결정 모두 실측 기반 재검증, 기각 대안 재도입·무근거 번복 없음 |
| Convention Compliance | NONE | 명명·V번호·CONCURRENTLY DROP-먼저 패턴 10개 파일 전부 준수, 가드 스크립트 실측 통과. 유일 WARNING 은 pre-existing·이미 트래킹 |
| Plan Coherence | NONE | target(`spec/conventions/`) diff 0, draft 체크리스트 예고와 실제 갱신 내용 일치, 미해결 결정 우회 없음 |
| Naming Collision | NONE | 신규 Flyway 버전·인덱스명·plan 파일명·Rationale 제목 전부 origin/main·병렬 브랜치·기존 spec 과 비충돌 |

## 권장 조치사항
1. (BLOCK 없음 — 필수 조치 없음) `plan/in-progress/spec-draft-fk-remaining-dispositions.md` 를 마무리 커밋에서 `plan/complete/` 로 실제 이동했는지 확인(INFO #1).
2. `spec/conventions/` 3섹션 구조 편차 WARNING 은 이번 PR 과 무관 — 별도 planner 턴에서 트래커(`spec-draft-nullable-notation-followups.md`)의 미결 항목으로 계속 처리.
3. `AuthConfig` sink 행 부재(INFO #2)는 필요 시 후속 data-flow 문서 정비 항목으로만 등재.
