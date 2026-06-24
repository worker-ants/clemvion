# Rationale 연속성 검토 결과

검토 범위: `06-concurrency C-1+M-7` — `cancelWaitingExecution` async+`ContinuationPublishResult` 반환, `stop()` WAITING queued=false 503 `EXECUTION_ENQUEUE_FAILED`, `nextSeq` random fallback 제거.

---

## 발견사항

### [INFO] M-7 `nextSeq` random fallback 제거 — 합의된 원칙에 부합하나 `exec:cont:seq` vs `exec:seq` 비대칭 장애 정책을 spec 본문에 미명시

- **target 위치**: `continuation-bus.service.ts` `nextSeq()` — try/catch + random fallback 제거, INCR 실패 전파
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §9.2` — `exec:cont:seq:<executionId>` 는 "BullMQ jobId 의 idempotency key" + "seq 단조성은 활성 구간 내내 보존". `§7.4` jobId 행 — "seq 는 Redis INCR per executionId — idempotency key".
- **상세**: spec §9.2 표는 `exec:cont:seq`(continuation publish seq) 의 Redis 미가용 시 동작을 명시하지 않는다. 같은 표에서 **`exec:seq`(WS emit seq) 는 "Redis 미가용 시 in-memory per-instance degraded fallback (수용된 trade-off)" 를 명시**하고 있어 두 seq 키의 장애 처리 정책이 명시적으로 비대칭이다. target 코드 주석은 이 비대칭의 이유를 정확히 기술한다(`seq = idempotency key 계약, §7.4/§9.2`). 변경 방향 자체는 idempotency 원칙에 완전히 부합하며 기각된 대안 재도입이 아니다. 다만 이 비대칭이 spec 표에 설명되지 않아 후속 독자가 `exec:cont:seq` 의 fallback 누락을 우연적 미기록으로 오독할 수 있다.
- **제안**: `spec/5-system/4-execution-engine.md §9.2` `exec:cont:seq` 행 비고에 "Redis 미가용 시 in-memory fallback 미적용 — jobId idempotency 계약 보존을 위한 의도적 fail-fast; `exec:seq` 의 degraded fallback 과 비대칭 (M-7, 06-concurrency)" 1줄 추가. 이번 PR 의 "spec-sync defer" 방침 내 후속 항목.

---

### [INFO] C-1 `cancelWaitingExecution` async 전환 — REST stop() WAITING cancel 실패 시 503 경로가 spec 에 미기록

- **target 위치**: `executions.service.ts` `stop()` WAITING 분기 — `cancelWaitingExecution` 결과 `queued=false` 시 `ServiceUnavailableException({ code: EXECUTION_ENQUEUE_FAILED })` 투척
- **과거 결정 출처**: `spec/5-system/6-websocket-protocol.md §4.2` — `queued: boolean` — "`false` 면 publish 단계 실패 (Redis 장애 등) — 재시도 권장". `spec/5-system/4-execution-engine.md §7.4` — "`continueExecution` / `cancelWaitingExecution` / … 모두 동일 패턴."
- **상세**: WS 경로의 `queued:false` 재시도 계약은 spec §4.2 에 명확히 기록되어 있다. REST `stop()` 경로에서 동일 장애 상황 발생 시 어떻게 surface 할지는 spec 어디에도 정의되지 않았다. target 코드는 503 + `EXECUTION_ENQUEUE_FAILED` 로 결정하고 코드 주석에 "api-convention §6 — Redis 의존성 장애 = upstream 불가용이므로 502 가 아닌 503" 근거를 기술했다. 결정 방향은 WS 계약과 일관하고 기각된 대안 재도입이 아니나, spec 에는 REST stop() 의 이 경로가 미기록 상태이다.
- **제안**: `spec/5-system/4-execution-engine.md §7.4` 또는 에러코드 카탈로그(이번 PR 의 sibling planner defer 대상)에 "REST stop() WAITING cancel 경로에서 `queued:false` 는 503 `EXECUTION_ENQUEUE_FAILED` 로 surface" 를 후속 spec-sync 시 추가. 현재 블로킹 사안 아님.

---

### [INFO] `void cancelWaitingExecution` → `async ... Promise<ContinuationPublishResult>` — spec 의 기존 "동일 패턴" 원칙에 수렴하는 변경

- **target 위치**: `execution-engine.service.ts` `cancelWaitingExecution` 시그니처 변경 + 주석 "옛 `void publish` fire-and-forget 의 에러 유실 제거"
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §7.4` — "`continueExecution` / `cancelWaitingExecution` / `continueButtonClick` / `continueAiConversation` / `endAiConversation` 모두 동일 패턴"
- **상세**: spec §7.4 는 이미 `cancelWaitingExecution` 을 나머지 4종과 "동일 패턴"으로 기술한다. 구현은 이 중 `cancelWaitingExecution` 만 `void` (fire-and-forget) 상태였으므로 spec 이 앞서 있었던 것이며, 이번 C-1 이 구현을 spec 에 맞춘 것이다. 이는 기각된 대안("계속 void 유지")의 재도입이 아니라 spec 준수 방향의 정합화이다. Rationale 연속성 위반 없음.
- **제안**: 변경 방향이 완전히 올바르다. `cancelWaitingExecution` 이 과거 `void` 였던 배경과 C-1 전환 결정을 spec §7.4 Rationale 에 단 한 줄("C-1 — 옛 void fire-and-forget 를 다른 4종과 동일하게 `ContinuationPublishResult` 반환으로 정합화")로 기록하면 히스토리가 완전해진다. 이번 PR 의 spec-sync defer 방침 내 후속 항목.

---

## 요약

이번 `C-1+M-7` 변경은 기존 spec Rationale 에서 **명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 위반하지 않는다**. 두 핵심 결정 — (1) `nextSeq` random fallback 제거(fail-fast) 와 (2) `cancelWaitingExecution` async + `ContinuationPublishResult` 표면화 — 은 각각 spec §9.2 의 idempotency key 단조성 보존 원칙, §7.4 의 "모든 진입점 항상 BullMQ enqueue + 결과 ack" 동일 패턴 원칙과 일관하며 해당 원칙들을 오히려 강화한다. 발견된 세 INFO 항목은 모두 이번 PR 의 명시적 defer 방침("에러코드 카탈로그·spec §7.4/§7.5.2 sync 는 sibling planner defer")에 해당하는 후속 spec 기록 보완 사안이며, 현재 구현의 정합성을 블로킹하지 않는다.

## 위험도

LOW
