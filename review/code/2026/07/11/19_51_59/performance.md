# Performance Review — 공개 웹채팅 위젯 idle-wait execution 회수 reaper (EIA-RL-07)

### 발견사항

- **[INFO]** `WebchatIdleReaperService.reap()` 이 per-execution 순차 UPDATE 2회(execution, node_execution) + emit + revoke 를 bounded-concurrency(10) 루프로 처리 — DB round-trip 은 N+1 형태
  - 위치: `codebase/backend/src/modules/external-interaction/webchat-idle-reaper.service.ts:922-956` (`reap`), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:217-279` (`markWebchatIdleTimeout`)
  - 상세: 배치 조회(`findIdleWebchatExecutionIds`, 최대 500건)는 1쿼리지만, 그 뒤 각 executionId 마다 `markWebchatIdleTimeout` 이 순차로 `execution` UPDATE → `node_execution` UPDATE → (성공 시) `revokeAllForExecution`(SELECT+DELETE) 를 실행한다. `REAP_CONCURRENCY=10` 청크 병렬로 완화하지만, 워스트케이스(500건 만석)에서는 최대 ~50 배치 × 순차 2~4 라운드트립이 발생한다. 다만 이는 EIA-RL-06 `terminal-revoke-reconciler`(`reconcileTerminalRevocations`, concurrency 20)와 **동형 패턴**이며, per-row 상태 가드(멱등 조건부 UPDATE)·개별 이벤트 emit 이 필요해 단일 `UPDATE ... WHERE id = ANY($1)` 벌크로 온전히 대체하기 어렵다. 1분 주기 cron + 500 상한이라 실사용 트래픽(익명 위젯 이탈)에서 매 tick 만석일 가능성은 낮아 실질 리스크는 낮다.
  - 제안: 현 상태로 문제 없음. 다만 향후 익명 위젯 트래픽이 커져 매 tick 이 500건 근처로 포화되는 징후가 보이면 (a) `execution` UPDATE 를 `WHERE id = ANY($1) AND status='waiting_for_input' RETURNING id` 벌크로 1쿼리화하고 실제 영향받은 id 집합에 대해서만 `node_execution` 벌크 UPDATE + per-row emit 을 수행하는 2단계 벌크화, 또는 (b) `REAP_CONCURRENCY` 상향을 고려할 것. system-status 큐 모니터링(이번 diff 의 `MONITORED_QUEUES` 등재)으로 backlog 를 관측할 수 있으므로 조기 신호는 이미 확보됨.

- **[INFO]** `findIdleWebchatExecutionIds` 판정 쿼리 — 인덱스 정합 확인, 성능 리스크 낮음
  - 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts:548-572`
  - 상세: `execution_token(et) ⋈ execution(e) ⋈ trigger(t)` + `GROUP BY et.executionId HAVING MAX(et.expAt) < threshold` 쿼리를 확인했다. `execution.status` 는 `idx_execution_status`(`migrations/V002__indexes.sql`), `execution_token.execution_id` 는 `idx_execution_token_execution_id`(`migrations/V060`)로 커버돼 planner 가 `waiting_for_input` 선택적 필터로 시작해 각 execution 의 토큰만 훑는 경로를 탈 수 있다. `trigger.auth_config_id` 자체엔 인덱스가 없지만 조인 방향(`e.trigger_id = t.id`)은 `trigger` PK 로 충분히 커버된다. 별도 조치 불요 — 확인 목적의 기록.
  - 제안: 없음(현 상태 적절). 다만 신규 인덱스를 추가하지 않았다는 점을 명시적으로 기록해 향후 `EXPLAIN ANALYZE` 벤치마크 시 참고할 수 있게 한다.

- **[INFO]** `revokeAllForExecution` 재사용 시 idle-reap 경로에서는 Redis 호출이 사실상 no-op
  - 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts:323-355`, 호출부 `webchat-idle-reaper.service.ts:963-971`
  - 상세: `revokeAllForExecution` 은 execution 의 모든 jti 를 순회하며 `ttl = expSec - nowSec > 0` 인 것만 Redis `SET`(`revokePerExecution`) 한다. idle-reap 대상은 정의상 "발급된 모든 토큰이 `now - grace` 이전에 만료"(§R19 판정)이므로 이 경로에서 호출되는 모든 토큰은 `ttl <= 0` → 루프 바디가 항상 `continue` 되어 Redis 왕복이 발생하지 않는다. 실질 비용은 `find()`(인덱스 SELECT) + `delete()`(인덱스 DELETE) 2쿼리뿐이다. 별도 조치 불요 — 함수가 기존 EIA-RL-06 용으로 작성된 범용 API 라 이 최적화가 코드상 명시적이지 않을 뿐, 동작상 문제는 없다.
  - 제안: 없음.

- **[INFO]** `execution_token` 테이블 장기 누적 완화 효과 (성능/스토리지 부수 효과, 긍정적)
  - 위치: 전체 변경(reaper 도입)
  - 상세: 이 PR 이전에는 이탈된 익명 위젯 execution 이 `waiting_for_input` 로 무기한 잔존하면서 그 `execution_token` row 도 함께 무기한 잔존했다(terminal 이 아니라 `revokeAllForExecution`/reconciler 트리거 대상이 아니었음). 본 reaper 가 이런 execution 을 `cancelled` 로 전이시키고 즉시 토큰을 delete 하므로, `execution_token` 테이블의 무한 증가를 막아 장기적으로 `findIdleWebchatExecutionIds`/`reconcileTerminalRevocations` 등 스캔 쿼리의 비용도 낮춘다.
  - 제안: 없음(긍정적 부수 효과 기록).

- **[INFO]** cron 주기·배치 상한값이 형제 서비스(EIA-RL-06)와 대체로 일치하나 concurrency 값만 다름
  - 위치: `codebase/backend/src/modules/external-interaction/webchat-idle-reaper.types.ts:11` (`WEBCHAT_IDLE_REAP_BATCH_LIMIT = 500`, `RECONCILE_BATCH_LIMIT = 500` 과 동일), `webchat-idle-reaper.service.ts:19` (`REAP_CONCURRENCY = 10` vs reconciler `RECONCILE_CONCURRENCY = 20`)
  - 상세: 두 sweep 은 "동형 패턴"으로 문서화돼 있으나 concurrency 상수만 절반이다. 성능에 실질적 문제는 아니고(둘 다 워커/DB pool 여유 안에서 안전한 보수적 값), 단지 의도적 차이인지 우연한 불일치인지 diff 만으로는 판별 불가.
  - 제안: 특별한 조정 불요. 필요 시 주석으로 "10 인 이유"(예: `markWebchatIdleTimeout` 이 UPDATE 2회로 reconciler 의 revoke-only 보다 무거워 더 낮게 잡음)를 한 줄 남기면 향후 리뷰 마찰을 줄일 수 있다.

### 요약

신규 `WebchatIdleReaperService`/`markWebchatIdleTimeout`/`findIdleWebchatExecutionIds` 는 기존 `terminal-revoke-reconciler`(EIA-RL-06)·`cancelParkedExecution`·`markQueueWaitTimeout` 패턴을 그대로 재사용해 판정 쿼리(인덱스로 뒷받침됨)·bounded-concurrency 루프(10)·1분 cron·500건 배치 상한을 갖춘 구조다. 실제 인덱스(`idx_execution_status`, `idx_execution_token_execution_id`, `idx_node_execution_exec_status_active`)를 확인한 결과 새 쿼리·UPDATE 모두 풀스캔 없이 커버되며, 회수 대상 토큰은 정의상 전량 만료라 `revokeAllForExecution` 의 Redis 왕복도 사실상 발생하지 않는다. per-execution 순차 DB 왕복(N+1 형태)이 남아있지만 EIA-RL-06 과 동일하게 concurrency 로 완화되어 있고 실사용 트래픽 규모에서 병목 가능성은 낮다. 새로운 CRITICAL/WARNING 급 성능 이슈는 발견되지 않았다.

### 위험도

LOW
