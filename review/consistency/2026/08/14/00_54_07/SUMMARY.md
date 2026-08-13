# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — `spec/**` diff 0 (순수 코드 버그 수정 PR). 5개 checker 전원이 target(`spec/5-system/`)과의
충돌을 발견하지 못했고, 유일한 실질 항목은 이미 plan 에 `[planner 위임]`으로 추적 중인 에러 코드
카탈로그 미등재 1건(WARNING)뿐이다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

> 해당 없음 — 이번 회차에 Critical 이 없으므로 인계 대상도 없다. 다만 아래 WARNING/INFO 중
> `developer` 권한 밖(spec/ 쓰기)인 항목은 이미 `plan/in-progress/` 에 `[planner 위임]` 으로
> 스스로 추적되고 있어(§경고 표 참고), 별도 인계 표는 불필요하다.

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `OAUTH_STATE_MISMATCH` 가 `spec/5-system/3-error-handling.md` 중앙 에러 카탈로그에 미등재 (형제 코드 `KB_REEMBED_IN_PROGRESS`/`KB_REEXTRACT_IN_PROGRESS` 는 §1.8 등재, 이 코드만 빠짐) | `spec/5-system/3-error-handling.md` §1.2/§1.2.1 | `spec/conventions/error-codes.md` §1 (카탈로그 가시성 원칙), `spec/2-navigation/4-integration.md:851`(이미 등재된 표면) | (a) `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`(§"추가 위임 #12")의 위임을 planner 턴에서 그대로 집행해 카탈로그 행 추가, 삽입 위치는 §1.8(KB/GraphRAG 전용) 아닌 §1.2 계열(인증/인가)로 정정. (b) 그 전까지는 `3-error-handling.md` frontmatter `pending_plans:` 에도 해당 plan 을 등재해 역방향 추적성 확보 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 4개월간 위반됐던 spec 서술(§1.1 admission gate/종결 이벤트 원자성, §7.3 CAS 락, §5.1 동시 호출)의 소급 각주가 아직 spec 본문에 없음 | `spec/5-system/4-execution-engine.md` §1.1, `8-embedding-pipeline.md` §7.3, `10-graph-rag.md` §5.1 | 이미 `plan/in-progress/update-returning-tuple-shape.md` 의 `[planner 위임]` 으로 정확히 추적 중 — 새 조치 불요, 위임 실행만 남음 |
| 2 | rationale_continuity | raw SQL RETURNING shape 처리 헬퍼가 4번째로 독립 재발(코드 주석이 스스로 인정) — `spec/conventions/` 미문서화 | `codebase/backend/src/common/utils/update-returning-rows.ts` | `spec/conventions/migrations.md` 또는 신규 `spec/conventions/raw-sql-result-shape.md` 에 "raw UPDATE/DELETE RETURNING 은 반드시 `updateReturningRows` 경유" invariant 승격을 후속 plan 항목으로 등재 권고 |
| 3 | convention_compliance | 위임 plan 이 지정한 `OAUTH_STATE_MISMATCH` 신규 카탈로그 행의 삽입 위치(§1.8 인근)가 실제로는 KB/GraphRAG 전용 절이라 주제와 어긋남 | `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md:626` | WARNING #1 집행 시 §1.2 계열로 정정(plan 오기 정정, 규약 갱신 불요) |
| 4 | naming_collision | 신규 `AuthOAuthStateRow` 인터페이스가 기존 엔티티 `AuthOAuthState` 와 이름이 유사 | `codebase/backend/src/modules/auth/auth-oauth.service.ts` | 조치 불요 — `XRow` 접미사는 저장소 기존 선례(`WaitingNodeRow`/`KbRow`/`ChunkRow`)를 따른 명명이며 의미도 docstring 으로 구분돼 혼동 소지 낮음 |
| 5 | plan_coherence | `e34a85b44` 의 `rememberMe` 결함(별개 발견)은 프로덕션 미노출(동일 미병합 브랜치 내부에서 상위 tuple-shape 버그로 항상 죽은 코드였음) — 추가 spec 각주 불요 | `codebase/backend/src/modules/auth/auth-oauth.service.ts` | 조치 불요 — 기존 `spec/data-flow/2-auth.md` caveat 이 이미 이 사건 전체를 덮음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `spec/**` diff 0. 고친 동작(auth-oauth/execution-engine/knowledge-base 의 RETURNING 튜플 오인)이 오히려 기존 spec 서술과 정합하는 방향. 소급 각주 위임은 이미 plan 에 추적 중(INFO) |
| rationale_continuity | NONE | 기존 Rationale(OAuth state one-shot DELETE, admission gate TOCTOU, KB CAS 락) 위반 없음 — 오히려 복원. raw-SQL-shape 헬퍼 4번째 재발은 convention 승격 제안(INFO) |
| convention_compliance | LOW | spec 문서 직접 변경 없음. `OAUTH_STATE_MISMATCH` 카탈로그 미등재 1건(WARNING, 이미 위임 추적 중) + 위임 plan 의 삽입 위치 오기(INFO) |
| plan_coherence | LOW | 직전 두 회차 WARNING 2건 모두 반영 확인. 신규 커밋(`e34a85b44`)의 `rememberMe` 수정도 target 과 충돌 없음. 발견사항 없음 |
| naming_collision | NONE | 신규 식별자 2개(`updateReturningRows`, `AuthOAuthStateRow`) 모두 저장소 전역에서 유일, 기존 명명 관례(`XRow` 접미사) 준수 — 충돌 없음 |

## 권장 조치사항
1. (선택, BLOCK 무관) `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` §"추가 위임 #12" 를 planner 턴에서 집행 — `3-error-handling.md` 에 `OAUTH_STATE_MISMATCH (400)` 를 §1.2 계열(§1.8 아님)에 추가하고, 반영 전까지는 해당 문서 frontmatter `pending_plans:` 에 위 plan 을 등재.
2. (선택) raw SQL `UPDATE`/`DELETE ... RETURNING` shape invariant(`updateReturningRows` 단일 SoT)를 `spec/conventions/` 레벨로 승격하는 후속 plan 항목 등재 검토 — 5번째 독립 재발 방지.
3. 현재 diff 자체는 BLOCK 사유 없음 — 위 항목들은 모두 후속 plan/spec 갱신이며 이번 PR 의 머지를 막지 않는다.
