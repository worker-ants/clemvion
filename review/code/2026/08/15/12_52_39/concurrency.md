# 동시성(Concurrency) 리뷰

## 발견사항

없음. CRITICAL/WARNING 없음.

## 분석 메모 (참고용, 액션 아이템 아님)

이번 변경은 `durationMs` 를 종결 이벤트(completed/failed/cancelled) 16경로에 채우는 작업이며,
동시성과 맞닿는 지점은 다음 두 갈래다.

1. **엔티티 미로드 raw UPDATE 5경로**(`cancelParkedExecution`, `markWebChatIdleTimeout`,
   `markExecutionCancelled`, `markQueueWaitTimeout`, `finalizeStalledExhausted` —
   `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`): 신설 상수
   `TERMINAL_DURATION_MS_SQL`(`codebase/backend/src/shared/utils/terminal-duration.ts:102-105`)이
   `duration_ms` 계산을 **같은 UPDATE 문 안에서 SQL 로** 수행하고 `RETURNING` 으로 되받는다.
   기존에 이미 있던 `WHERE id = :id AND status = :expected` 조건부 UPDATE(낙관적 동시성 가드,
   Postgres 행 잠금으로 원자적) 패턴을 그대로 유지한 채 SET 절에 계산식만 추가한 형태라 새
   race window 를 만들지 않는다. `cancelParkedExecution`/`markWebChatIdleTimeout` 은 Execution+
   NodeExecution 이중 UPDATE 를 `dataSource.transaction` 으로 이미 묶어 두고 있고 이번 변경이
   그 경계를 건드리지 않는다.
2. **엔티티 기로드 JS 계산 11경로**(`retry-turn.service.ts`, `execution-engine.service.ts` 나머지):
   `resolveTerminalDurationMs()`(`codebase/backend/src/shared/utils/terminal-duration.ts:37-57`)는
   순수 동기 함수 — 모듈 전역 가변 상태·클로저 캡처가 없어 스레드 세이프 걱정이 원천적으로
   없다(Node 이벤트 루프 단일 스레드 특성과도 무관하게 부작용이 없는 순수 계산). 호출부는
   `execution.finishedAt = new Date()` 직후 **await 갭 없이** 동기로 `durationMs` 를 계산해
   엔티티 필드에 대입하므로, 계산과 대입 사이에 새로운 TOCTOU 창을 열지 않는다. 이후 실제
   영속은 기존에 이미 있던 `finalizeGuarded`/`updateExecutionStatus` 의 조건부 UPDATE(
   `retry-turn.service.ts:580-685` — `WHERE status = :status` 가드, CANCELLED 재진입 분기는
   `COALESCE(finished_at, …)`/`COALESCE(duration_ms, …)` 로 ABA 까지 고려한 설계)로 처리되며,
   이번 diff 는 그 가드 로직 자체를 변경하지 않고 SET 값의 계산식만 교체했다.

`PG_INT4_MAX` 클램프(`LEAST(...)`/`Math.min(span, PG_INT4_MAX)`)는 오히려 원자성을 강화하는
방향의 수정이다 — 클램프가 없으면 `integer out of range` 로 UPDATE 문 전체가 실패해(위 5경로
중 2곳은 트랜잭션 내부이므로 **트랜잭션 롤백**까지 유발) 그 실행이 상태 고착된다. 이 결함은
`review/code/2026/08/15/09_58_24/RESOLUTION.md` 에 기록된 CRITICAL 이 이미 해소한 것이며, 현재
diff 상태(`TERMINAL_DURATION_MS_SQL`·`resolveTerminalDurationMs` 양쪽 모두 클램프 포함)로
일관되게 반영돼 있음을 확인했다.

`resolveTerminalDurationMs` 를 같은 함수 내에서 두 번 호출하는 자리(예:
`retry-turn.service.ts` `completeRetryExecution`)가 있으나, 첫 호출 결과가 이미
`execution.durationMs` 에 유한수로 대입돼 있으므로 헬퍼의 첫 branch(`typeof row.durationMs ===
'number'`)가 그 값을 그대로 반환한다 — 재계산에 의한 값 불일치 위험 없음.

`executions.service.ts` `stop()` 은 기존에 있던 `WHERE id AND status IN (RUNNING, PENDING)`
조건부 UPDATE 를 그대로 쓰고, `durationMs` 계산만 무가드 뺄셈에서 `resolveTerminalDurationMs`
(클램프 포함)로 교체됐다 — 동시성 제어 방식 자체는 무변경.

dashboard/statistics 쪽 변경(`e.status = :completedStatus` / `'completed'` 필터 추가)은 읽기
전용 집계 쿼리라 동시성 관점에서 검토 대상이 아니다(공유 가변 상태·락 없음).

## 요약
이번 diff 가 건드리는 종결 마감 경로들은 이미 조건부 UPDATE(낙관적 동시성 가드) + 필요한
곳은 트랜잭션으로 원자성을 확보해 둔 기존 설계를 그대로 유지한 채, `durationMs` 계산식만
공유 헬퍼(순수 함수)로 교체했다. 새로운 공유 가변 상태·락·await 순서 변경이 없어 경쟁
조건이나 데드락을 유발할 표면이 없고, int4 클램프는 오히려 기존에 있던(그리고 같은 PR 계열의
직전 라운드에서 CRITICAL 로 잡혀 해소된) UPDATE 실패로 인한 상태 고착 위험을 줄이는 방향이다.
신규 CRITICAL/WARNING 없음.

## 위험도
NONE
