# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL/WARNING 0건, 위험도 NONE.

## 전체 위험도
**NONE** — 이번 diff(`codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 1개 파일, 테스트 전용)는 검토 스코프로 지정된 `spec/2-navigation/`과 무관(델타 0)하며, 실제 대상인 `spec/1-data-model.md` §2.16/§2.20 의 기존 `default=` 서술·Rationale·선행 plan과도 완전히 정합한다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 테스트 파일 주석이 "근거: `plan/complete/column-guard-gaps.md`"를 인용하나 실제로는 `plan/in-progress/column-guard-gaps.md`로 남아 있음 (plan-doc 동기화, cross-spec 충돌 아님) | `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 주석 / `plan/in-progress/column-guard-gaps.md` | 이 세션 마무리 커밋에서 `git mv`로 `plan/complete/`에 이동해 인용을 실제화 (plan_coherence·convention_compliance 두 checker도 동일 사안을 확인 후 "정상 워크플로 — 마무리 커밋에서 처리"로 기결 처분) |
| 2 | plan_coherence / convention_compliance | scope 인자가 무관한 `spec/2-navigation/`으로 전달되었고, 프롬프트 보정 블록으로 실제 대상(`spec/1-data-model.md`)을 지정한 절차적 특이점 | orchestrator 호출 인자 | `plan/in-progress/harness-review-gate-followups.md` §O에 이미 등재된 기존 한계(`--impl-prep`/`--impl-done`이 `spec/` 최상위 파일을 scope로 못 받음) — 신규 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | `spec/2-navigation/` 델타 0, 실제 diff는 무관한 데이터모델 테스트. `spec/1-data-model.md` §2.16/§2.20 기존 계약과 값 일치, 신규 모순 없음 |
| rationale_continuity | NONE | `entity-column-declaration-drift.md` 4라운드 리뷰가 "수렴 예외"로 남긴 두 빈칸(예방 계층 회귀 테스트, `default` RETURNING 왕복)을 트래커가 좁힌 scope 그대로 닫는 계획된 후속. `code:` 전용 e2e 가드 셋 원칙·기능 e2e 배제 원칙 모두 유지 |
| convention_compliance | NONE | 명명·raw SQL 결과 처리(`raw-query-results.md`)·문서 구조·API 문서·금지 항목(리뷰 인용 형식·시크릿·마이그레이션) 전 축 정합. `spec_impact: none` bare sentinel도 Gate C 정형과 일치 |
| plan_coherence | NONE | 선행 plan(`entity-column-declaration-drift.md`, `spec-draft-spec-fact-orm-defaults.md`) 둘 다 `plan/complete/`로 종결, 미해소 전제 없음. 트래커 항목 `[x]` 처리 및 `plan/complete/column-guard-gaps.md` 선인용은 마무리 커밋 처리 예정으로 기결 |
| naming_collision | NONE | target spec 델타 0으로 신규 식별자 자체가 스코프 밖. diff가 도입한 로컬 식별자(헬퍼 함수명·임시 테이블명·테스트 제목)도 grep 전수 확인 결과 충돌 없음 |

## 권장 조치사항
1. (선택, 비차단) 이 세션 마무리 커밋에서 `plan/in-progress/column-guard-gaps.md`를 `plan/complete/column-guard-gaps.md`로 `git mv`하여, 테스트 주석과 트래커 항목이 이미 인용 중인 경로를 실제화한다.
2. 그 외 추가 조치 불필요 — 5개 checker 전원 CRITICAL/WARNING 0건으로 수렴.
