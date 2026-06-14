# RESOLUTION — ai-review 15_59_50 (terminal-revoke reconciler)

RISK MEDIUM · Critical 0 · WARNING 7 · INFO 21. 아래와 같이 처리.

## WARNING

| # | 처리 | 내용 |
|---|------|------|
| W1 보안(JWT fallback secret) | **dismiss (선존)** | `interaction-token.service` constructor 의 기존 동작 — **prod 는 fail-closed throw**, dev/test 만 placeholder. 본 PR(reconciler)이 도입한 코드 아님. prod 안전성은 이미 확보됨. |
| W2 성능(N+1 Redis SET) | **fix** | `reconcileTerminalRevocations` 의 execution 루프를 `Promise.allSettled` bounded-concurrency(`RECONCILE_CONCURRENCY=20`)로 병렬화 — 직렬 수백 왕복 완화. |
| W3 성능(N+1 DB) | **부분 fix** | execution 단위 병렬화로 wall-time 단축 + `batchLimit` clamp(≤1000)로 상한. per-execution find/delete 는 `revokeAllForExecution` 재사용(보통 sweep row 0~소수 — live 경로가 대부분 처리). |
| W4 DB(인덱스) | **dismiss** | sweep 쿼리는 `execution_token`(`idx_execution_token_execution_id`, V060) 주도 → `execution` 은 PK join. full table scan 아님. |
| W5 보안(revoke 실패 메트릭) | **defer (설계)** | R15 가 fail-open 관측 메트릭/알람 wiring 을 명시적 후속 항목으로 규정. 별도 observability plan. |
| W6 보안(batchLimit 상한) | **fix** | `Math.min(Math.max(1, ⌊n⌋), RECONCILE_BATCH_MAX=1000)` clamp + 단위 테스트. |
| W7 테스트(reconcile 단독) | **fix** | `service.reconcile()` 직접 호출 테스트(성공·throw swallow) 2건 추가. |

## INFO (처리)
- I1 SPEC-DRIFT → spec §10 파일 목록에 `terminal-revoke-reconciler.service.ts` 추가.
- I5/I6/I9 매직넘버 → `RECONCILE_BATCH_LIMIT`/`RECONCILE_BATCH_MAX`/`RECONCILE_CONCURRENCY`/`TERMINAL_STATUSES`/`REMOVE_ON_*_AGE_SEC` 상수 추출.
- I7/I18 reconcile() public 유지(직접 테스트 위함) + JSDoc 추가.
- I8 module wire-up JSDoc 갱신. I10 `@Processor(..., { concurrency: 1 })` 명시.
- I14/I15/I16/I17 테스트 갭 → limit(500)·distinct·select 단언 + 만료토큰(ttl<=0) 케이스 추가.
- I19 `@param batchLimit` JSDoc. I7(유지보수성 이중 로그) → reconciler 의 중복 swept 로그 제거(token service 단일 책임).
- I2/I3/I4/I11/I12/I13/I20/I21 → 현 규모 허용 / spec 충분 / 후속. (I12/I13: spec §9.3 R15 가 sweep·worst-case 를 이미 기술; batchLimit 은 impl 상수.)

## 검증
- be lint(0 errors, `--fix` 무관 3파일 revert) · 타깃 unit 46 pass · build ✓.
- 후속: 전체 unit + fresh /ai-review 로 stale 회피.
