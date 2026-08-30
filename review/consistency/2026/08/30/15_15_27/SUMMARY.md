# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**NONE** — `origin/main...HEAD` diff 는 `spec/**` 를 전혀 건드리지 않는 순수 backend 테스트 하드닝(raw `UPDATE/DELETE … RETURNING` 발견형 가드 신설 + `kb-stats.helper.ts` 튜플 타입 정정)이며, 5개 checker 전원이 CRITICAL/WARNING 없이 NONE 위험도로 수렴했다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | "래퍼 대신 발견형 가드를 택한" 신규 설계 결정이 spec Rationale 이 아니라 테스트 파일 docstring 에만 존재 | `codebase/backend/src/common/utils/update-returning-rows.spec.ts` (diff L722-728, "## 왜 래퍼(타입 경계)로 가지 않았나") | 조치 불요. 도메인 결정이 아닌 내부 테스트 하네스 설계라 위반 아님. 필요 시 추후 `spec/conventions/spec-impl-evidence.md` 류 문서로 "발견형 vs 큐레이션형 가드" 원칙 승격 고려 |
| 2 | convention_compliance | 컨텍스트 예산 초과로 절단된 `spec/data-flow/6-knowledge-base.md` 를 이번 diff 가 건드린 `kb-stats.helper.ts` 의 raw-RETURNING 튜플 계약 관점에서 직접 대조하지 못함 | `spec/data-flow/6-knowledge-base.md` (미절단 확인 필요) | 후속으로 해당 문서를 직접 Read 해 `kb_stats` 관련 서술이 `{...}[]` (비튜플) 형태로 남아있지 않은지만 확인. 이번 diff 는 코드 주석/타입만 정정했고 그 문서를 건드리지 않았으므로 시급성 낮음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | `spec/**` diff 0줄 — 비교 대상 신규/변경 spec 서술이 없어 cross-spec 충돌 후보 자체가 없음 |
| rationale_continuity | NONE | 기각된 대안 재도입·합의 원칙 위반·무근거 번복 없음. 오히려 기존 `2-auth.md`/`4-execution-engine.md`/`8-embedding-pipeline.md` 의 "원자적 conditional UPDATE/DELETE…RETURNING" 패턴을 타입 레벨로 뒷받침 |
| convention_compliance | NONE | `spec/conventions/` 23개 파일 전수 확인 결과 이 변경 클래스(raw-RETURNING 소스-스캔 가드)를 규율하는 정식 규약 자체가 없음 — 위반 대상 부재 |
| plan_coherence | NONE | `plan/in-progress/update-returning-tuple-shape.md` 의 기존 체크리스트 항목(가드 손 큐레이션 한계)을 발견형 가드로 완결. plan 문서도 동일 커밋 범위에서 동기 갱신됨. 유예 조건(`__test-utils__` 비의존)도 재확인 결과 위반 없음 |
| naming_collision | NONE | 신규 식별자(`countRawUpdateReturning`, `hasRawUpdateReturning`, `findUnguarded` 등) 저장소 전수 검색 결과 기존 사용처와 충돌 없음. 요구사항 ID/엔티티명/API endpoint/이벤트명/ENV키/spec 경로 신설 없음 |

## 권장 조치사항
1. (선택, 비차단) `spec/data-flow/6-knowledge-base.md` 를 직접 Read 해 `kb_stats` 관련 서술이 raw `UPDATE … RETURNING` 의 튜플 반환(`[rows, affectedCount]`)과 어긋나는 비튜플 서술을 남기고 있지 않은지 확인.
2. (선택, 비차단) "래퍼 대신 발견형 가드" 설계 결정을 향후 `spec/conventions/spec-impl-evidence.md` 류 문서에 "발견형 vs 큐레이션형 가드" 원칙으로 승격할지 검토 — 이번 라운드 필수 조치는 아님.