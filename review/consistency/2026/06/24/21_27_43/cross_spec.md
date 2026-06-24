# Cross-Spec 일관성 검토 결과

검토 대상: `06-concurrency C-1+M-7` — continuation publish 실패 fail-fast 통일
diff-base: `origin/main`
검토 일시: 2026-06-24

---

## 발견사항

### 1. [INFO] `EXECUTION_ENQUEUE_FAILED` 신규 에러 코드가 spec 에 미등록

- **target 위치**: `codebase/backend/src/nodes/core/error-codes.ts` — `ErrorCode.EXECUTION_ENQUEUE_FAILED` 추가. 코드 주석에 "C-1 (06-concurrency)" 근거 기술
- **충돌 대상**: `spec/conventions/error-codes.md` — 에러 코드 명명 규약 SoT. `spec/5-system/3-error-handling.md §1` — 에러 코드 카탈로그 SoT
- **상세**: 신규 코드 `EXECUTION_ENQUEUE_FAILED` 가 `error-codes.ts` 에 등재됐으나 spec 카탈로그(`3-error-handling.md §1.4` 워크플로우 실행 에러 표)·명명 규약 문서(`error-codes.md`)에 추가되지 않았다. `spec/5-system/4-execution-engine.md §7.5.2` 는 "신규 client-safe 코드는 `EXECUTION_*` 네임스페이스를 확장한다"고 명시하고 있으므로 해당 섹션에도 언급이 필요하다. 코드 자체의 의미(BullMQ enqueue 실패)는 `EXECUTION_ENQUEUE_FAILED` 라는 이름과 정합하며 §1 의 의미 기반 명명 원칙을 충족한다. 계획(plan)이 "spec §7.4/§7.5.2 + 에러코드 카탈로그는 sibling planner spec-sync defer" 로 명시 처리됐으므로 의도된 defer 다.
- **제안**: sibling planner spec-sync 에서 `spec/5-system/4-execution-engine.md §7.5.2` 의 `EXECUTION_*` 네임스페이스 목록에 `EXECUTION_ENQUEUE_FAILED` 추가, `spec/5-system/3-error-handling.md §1.4` 워크플로우 실행 에러 표에 행 추가.

---

### 2. [INFO] spec §7.5.2 의 "4종" 기술이 `cancelWaitingExecution` 포함 누락

- **target 위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `cancelWaitingExecution` 이 `async`·`ContinuationPublishResult` 반환으로 변경. 관련 spec 에서 "5종" 확장이 반영되지 않음
- **충돌 대상**: `spec/5-system/4-execution-engine.md §7.5.2` 첫 문장 — "§7.4 의 **4종** continuation 핸들러(`execution.submit_form` / `click_button` / `submit_message` / `end_conversation`)"
- **상세**: spec §7.5.2 는 `ContinuationPublishResult` 반환 + typed error 표면 정책을 명시적으로 4종 핸들러에만 적용한다. `cancelWaitingExecution` 이 동일 패턴으로 확장됐으나 §7.5.2 목록에 누락돼 있다. 동작 자체의 모순은 아니고(§7.4 에 "모두 동일 패턴" 문장이 있어 논리적으로 포함 가능), spec 기술이 현실을 따라가지 못한 gap 이다.
- **제안**: sibling planner spec-sync 에서 `§7.5.2` 첫 문장을 "5종(`submit_form` / `click_button` / `submit_message` / `end_conversation` / `cancelWaitingExecution`)" 으로 갱신.

---

### 3. [INFO] REST `stop()` 의 `queued:false` → 503 경로가 spec 에 미정의

- **target 위치**: `codebase/backend/src/modules/executions/executions.service.ts` — WAITING_FOR_INPUT cancel 경로에서 `result.queued === false` 이면 `ServiceUnavailableException({ code: 'EXECUTION_ENQUEUE_FAILED', ... })` throw
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md §4.2` — `queued:false` 는 "재시도 권장" 이지만 "클라이언트 routing 결정에 사용하지 않는다" 고 기술 (단, 이 문장은 WS ack 맥락). `spec/5-system/4-execution-engine.md §7.4` — publish `queued:false` 에 대한 REST caller 동작 미정의
- **상세**: WS spec §4.2 의 "routing 결정에 사용하지 않는다" 는 WS gateway 4종 ack 맥락이며, REST `stop()` 호출자가 503 을 내는 것과 계층이 다르다. 그러나 spec 어디에도 "REST stop()에서 `queued:false` = 503 EXECUTION_ENQUEUE_FAILED" 정책이 명시되지 않아 spec-impl 간 gap 이 존재한다. 기능적으로는 의미 있고 WS spec 과 모순이 아니나, 향후 누군가 "왜 REST만 503을 내는가"를 물을 때 근거 문서가 없다.
- **제안**: sibling planner spec-sync 에서 `spec/5-system/4-execution-engine.md §7.4` 내 `cancelWaitingExecution` 항목 또는 별도 박스에 "REST `POST /executions/:id/stop` 의 WAITING 경로에서 `queued:false` → 503 `EXECUTION_ENQUEUE_FAILED`" 행동 명시 추가.

---

### 4. [INFO] `nextSeq` random fallback 제거 — spec 정합이나 Rationale 부재

- **target 위치**: `codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.ts` — `nextSeq` 의 `try/catch` (random fallback `Math.random()`) 제거, INCR 실패 시 throw 전파
- **충돌 대상**: `spec/5-system/4-execution-engine.md §9.2` — `exec:cont:seq:` 키: "seq 단조성은 활성 구간 내내 보존". §7.4 jobId 셀: "seq 는 Redis INCR per executionId — idempotency key"
- **상세**: spec §9.2 는 이미 seq 를 "monotonic" + "idempotency key" 로 정의한다. random fallback 은 이 정의와 이미 모순된 옛 구현이었으며 M-7 이 spec 원래 의도에 맞게 정렬했다. spec 과 구현이 이제 정합하며 spec 본문 갱신은 불필요하다. 다만 이 결정 근거(왜 fail-fast인가)가 코드 주석에만 있고 spec Rationale 에는 없어, 향후 동일 결정이 재검토될 위험이 있다.
- **제안**: sibling planner spec-sync 에서 `spec/5-system/4-execution-engine.md §9.2` `exec:cont:seq:` 행 또는 `§Rationale` 섹션에 "INCR 실패 시 random fallback 은 idempotency 계약 위반 — fail-fast 채택 (M-7, 06-concurrency)" 한 줄 추가.

---

## 요약

이번 C-1+M-7 구현 변경은 `spec/5-system/4-execution-engine.md §7.4/§9.2` 의 기존 idempotency 계약·단조성 원칙과 직접 모순되지 않는다. 오히려 spec 의 원래 정의에 맞게 random fallback 을 제거하고, `cancelWaitingExecution` 을 나머지 continuation 메서드와 동일한 결과 반환 패턴으로 통일한 방향이다. 발견된 4건은 모두 INFO 등급이며, spec 에 반영되지 않은 구현 선행(sibling planner spec-sync 로 defer 된 카탈로그 등재·섹션 기술)에 해당한다. 동작을 차단하는 CRITICAL·WARNING 은 없다.

---

## 위험도

LOW
