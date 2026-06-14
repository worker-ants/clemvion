# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 0. 기능은 spec 정합, 심각 결함 없음. reconcile sweep 의 N+1 DB/Redis(성능)와 batchLimit 미검증(보안)이 주요 WARNING.

## Critical
없음.

## 경고 (WARNING) — 처리

| # | 카테고리 | 발견 | 처리 |
|---|----------|------|------|
| 1 | 보안 | JWT secret dev fallback 하드코딩(`'interaction-fallback'`) | **dismiss (선존)** — constructor 의 기존 동작, 본 PR 무관(reconciler 아님). 별도 보안 백로그 |
| 2 | 성능 | reconcile 루프 직렬 N+1 Redis SET | **fix** — executionId 루프 bounded-concurrency(Promise.allSettled, 20) 병렬화 |
| 3 | 성능 | reconcile 루프 N+1 DB(find+delete) | **부분 fix** — execution 단위 병렬화로 wall-time 단축. per-execution find/delete 는 revokeAllForExecution 재사용 유지(보통 0~소수 row), batchLimit clamp 로 상한 |
| 4 | DB | `execution_token.executionId`/`execution.status` 인덱스 미확인 | **dismiss** — 쿼리는 `execution_token`(idx_execution_token_execution_id, V060) 주도 → execution 은 PK join. full scan 아님 |
| 5 | 보안 | fail-open revoke 실패 메트릭 미수집 | **defer (설계)** — R15 가 메트릭/알람 wiring 을 후속 항목으로 명시. 별도 plan |
| 6 | 보안 | batchLimit 상한 미검증 | **fix** — `Math.min(Math.max(1, n), 1000)` clamp |
| 7 | 테스트 | `reconcile()` 단독 테스트 부재 | **fix** — 직접 호출 테스트(성공/throw swallow) 추가 |

## 참고 (INFO) — 처리
- I1 (SPEC-DRIFT) spec §10 파일 목록에 reconciler 미등재 → **fix**(§10 행 추가).
- I5/I6/I9 매직넘버(batchLimit/TERMINAL_STATUSES/removeOn age) → **fix**(상수 추출).
- I7/I18 reconcile() public + JSDoc → **유지**(직접 테스트 위해 public) + JSDoc 추가.
- I10 concurrency:1 명시 → **fix**. I12/I13 spec §9.3/R15 batchLimit·fail-fast note → **fix**.
- I14/I15/I16/I17 테스트 갭(경계·만료토큰·체이닝·clearMocks) → **fix**.
- I8 module JSDoc wire-up → **fix**. I20 plan D3=A 경위 note → **fix**.
- I2/I3/I4/I11/I19/I21 등 나머지 → 현 규모 허용/후속.

## 에이전트별 위험도
| 에이전트 | 위험도 |
|----------|--------|
| security | MEDIUM (W1 선존·W5 defer·W6 fix) |
| performance | MEDIUM (W2/W3 — 백그라운드 sweep, 병렬화 fix) |
| database | LOW (쿼리 execution_token 주도) |
| testing | LOW (W7 fix + 갭 보강) |
| maintainability/architecture/requirement/scope/그외 | LOW/NONE |

RISK LOW (Critical 0). 후속 RESOLUTION.md 참조.
