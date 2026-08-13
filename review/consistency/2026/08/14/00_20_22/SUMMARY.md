# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — `spec/5-system/` 자체는 diff 0건(순수 백엔드 버그 수정: TypeORM `UPDATE`/`DELETE ... RETURNING` 튜플-shape 오인 8곳 수정). 5개 checker 전원이 CRITICAL/WARNING 없이 수렴했고, 직전 회차(00_00_45)가 낸 WARNING 2건은 이번 커밋에서 반영 확인됨.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `spec_impact` 5개 파일의 spec 각주 미반영 (착수 전 상태) | `plan/in-progress/update-returning-tuple-shape.md` frontmatter `spec_impact` → `spec/5-system/4-execution-engine.md`·`8-embedding-pipeline.md`·`10-graph-rag.md`·`data-flow/2-auth.md`·`spec/conventions/node-cancellation.md` | project-planner 턴에서 admission/CAS 락/OAuth state/node-cancellation persisted 4갈래를 각 문서 1곳씩 각주로 배치. `plan_coherence` 확인상 이미 `spec-update-node-cancellation-shutdown-classification.md` `#12`에 위임 등재돼 있어 후속 스윕에서 누락 위험 낮음 |
| 2 | cross_spec | `OAUTH_STATE_MISMATCH` 가 중앙 에러 카탈로그 미등재 | `spec/5-system/3-error-handling.md` (자매 코드 `KB_REEMBED_IN_PROGRESS`/`KB_REEXTRACT_IN_PROGRESS`는 등재돼 있음) | `3-error-handling.md` 인증 에러 코드 절에 `OAUTH_STATE_MISMATCH`(400) 한 줄 + `data-flow/2-auth.md` 상호링크 추가 권고. fix 이후 이 코드가 "항상 발생"에서 "실제 이상 상황에서만 발생"으로 의미가 되살아나 카탈로그 완결성 중요도가 상승했음 |
| 3 | rationale_continuity | admission gate·OAuth state·KB CAS 락 버그 수정은 기존 Rationale(advisory-lock+조건부 UPDATE, one-shot DELETE, CAS 락)을 뒤집지 않고 오히려 실제로 작동하게 복구 | `execution-engine.service.ts`/`auth-oauth.service.ts`/`knowledge-base.service.ts` | 조치 불요(정보성). 원하면 `4-execution-engine.md` §Rationale "동시성 cap admission gate" 항목 말미에 튜플-shape 사문화 이력 한 줄 추가 가능하나 필수 아님 |
| 4 | naming_collision | 신규 유틸 `updateReturningRows` 명명 정합 확인 | `codebase/backend/src/common/utils/update-returning-rows.ts:36` | 조치 불필요. 향후 3번째 "raw query 결과 언랩" 헬퍼 추가 시 동일 파일 docstring 표에 등재해 분산 억제 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `spec/5-system/` diff 0건. admission cap·KB CAS 락 409·OAuth state 소비·node-cancellation persisted 4갈래 모두 "코드가 기존 문서화된 보장을 못 지키다가 이번 fix로 복구" 패턴 — cross-spec 신규 충돌 없음. INFO 2건(spec 각주 추적, 에러 카탈로그 누락) |
| rationale_continuity | NONE | spec 미변경, 코드 변경도 기존 3대 invariant(advisory-lock+조건부 UPDATE, one-shot DELETE, CAS 락)를 뒤집지 않고 복구. 대안 재도입·원칙 위반·무근거 번복 없음 |
| convention_compliance | NONE | `spec/` diff 0. 코드 diff는 명명·출력 포맷·문서 구조·API 문서 규약 표면과 접점 없음. 신규 헬퍼는 기존 `assertRowArray` 패턴 재사용 |
| plan_coherence | LOW | `spec/5-system/` diff 0으로 결정 충돌 여지 낮음. 직전 회차 WARNING 2건(자매 plan 소급 정정, spec 위임 5건 집결 티켓) 모두 커밋 `304679959`에서 반영 확인. 잔여(`pending_plans:` frontmatter 등재)는 developer 권한 밖이며 이미 plan에 pending으로 명시돼 신규 발견 아님 |
| naming_collision | NONE | `spec/5-system/` diff 0. 신규 식별자는 `updateReturningRows` 하나뿐이며 자매 헬퍼 `assertRowArray`와 이름·역할 명확히 분리, 타 영역 동명 심벌 없음. endpoint/이벤트/env/config/spec 파일 경로 5축 모두 신규 도입 없음 |

## 권장 조치사항
1. (BLOCK 해소 불요 — Critical 없음) 후속 project-planner 턴에서 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` `#12`에 등재된 5개 spec 각주 위임(admission/CAS 락/OAuth state/node-cancellation)을 실제 반영하고, `4-execution-engine.md`·`node-cancellation.md` frontmatter `pending_plans:`에 `update-returning-tuple-shape.md`를 등재할 것.
2. `spec/5-system/3-error-handling.md`에 `OAUTH_STATE_MISMATCH`(400) 카탈로그 항목 추가를 같은 planner 턴에서 함께 처리하면 비용이 최소화됨.
