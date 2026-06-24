# 요구사항(Requirement) Review — C-1 + M-7 (publish fail-fast 통일)

검토 커밋: `fabdd47cd9b41c89ed7b7478a7f83fc5824e24ae`
검토 범위: 8개 코드 파일 + consistency check 산출물

---

## 발견사항

### [INFO] [SPEC-DRIFT] REST `stop()` WAITING 분기 503 동작이 spec 미기술
- 위치: `/Volumes/project/private/clemvion/spec/5-system/2-api-convention.md §6` HTTP 상태 코드 표; `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md §7.4/§7.5`
- 상세: api-convention §6 상태 코드 표에는 200/201/204/400/401/403/404/409/422/429/500 만 열거되어 있고 503 이 없다. 코드 주석은 "api-convention §6 — Redis 의존성 장애=upstream 불가 → 503" 을 근거로 들지만, 해당 §6 본문에는 503 이 정의되지 않았다. 기존 503 사용처는 §11.1 shutdown 게이트뿐이다 (SERVER_SHUTTING_DOWN). 코드의 선택(Redis 의존성 장애에 503 사용)은 의미론적으로 합리적이고 의도적 결정이나 spec §6 이 이를 뒷받침하지 않는다.
- 제안: 코드 유지 + spec 반영. `/Volumes/project/private/clemvion/spec/5-system/2-api-convention.md §6` 상태 코드 표에 503(Service Unavailable — upstream 의존성 장애)을 추가하고, `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md §7.4` 또는 §7.5 에 REST stop() WAITING 분기의 queued=false → 503 EXECUTION_ENQUEUE_FAILED 동작을 1줄 기술해야 한다. 이는 commit message 에서도 "sibling planner spec-sync 로 defer — merge-gate: 동행 머지 권장" 으로 이미 인지되어 있다.

### [INFO] [SPEC-DRIFT] `EXECUTION_ENQUEUE_FAILED` 에러코드가 `spec/5-system/3-error-handling.md §1` 카탈로그에 미등재
- 위치: `/Volumes/project/private/clemvion/spec/5-system/3-error-handling.md §1`; `/Volumes/project/private/clemvion/codebase/backend/src/nodes/core/error-codes.ts` L1617
- 상세: spec §7.5.2 는 신규 client-safe 에러코드를 중앙 `ErrorCode` enum 의 `EXECUTION_*` 네임스페이스로 확장하도록 명시하며, 코드는 이를 준수하여 `EXECUTION_ENQUEUE_FAILED` 로 등재했다. 그러나 에러코드 카탈로그의 SoT 인 `3-error-handling.md §1` 에는 아직 반영되지 않았다.
- 제안: 코드 유지 + spec 반영. sibling planner spec-sync PR 이 `3-error-handling.md §1` 에 `EXECUTION_ENQUEUE_FAILED` 를 등재해야 한다. commit message 에 이미 "동행 머지 권장" 명시됨.

### [INFO] [SPEC-DRIFT] `cancelWaitingExecution` async 전환이 spec §7.5.2 "4종 continuation 핸들러" 목록에 미반영
- 위치: `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md §7.5.2` L1017
- 상세: 현재 §7.5.2 본문은 "§7.4 의 4종 continuation 핸들러(`execution.submit_form` / `click_button` / `submit_message` / `end_conversation`)" 라고 명시한다. C-1 으로 `cancelWaitingExecution` 이 동일 패턴(`ContinuationPublishResult` 반환)을 공유하게 됐으나, §7.5.2 목록에는 `cancel` 이 포함되지 않는다. spec §7.4 의 메시지 타입 목록(L868)에는 `cancel` 이 포함되어 있어 상위 컨텍스트는 정합하나, §7.5.2 의 핸들러 열거가 낡았다.
- 제안: 코드 유지 + spec 반영. sibling planner spec-sync 에서 §7.5.2 핸들러 목록에 `cancelWaitingExecution` 을 추가하거나 "4종 → 5종" 또는 "continuation 핸들러들" 로 일반화.

### [INFO] [SPEC-DRIFT] M-7 INCR throw → publish null → `queued:false` 인과가 spec 미기술
- 위치: `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md §7.4`; spec §9.2 Redis 키 표 L1090
- 상세: spec §9.2 키 표(L1090)는 `exec:cont:seq:<executionId>` 키와 sliding-window TTL 을 기술하지만, INCR 실패 시 random fallback 없이 throw 전파 → publish null 으로 귀결된다는 fail-fast 계약이 spec 본문에는 없다. §7.4 rationale 에는 jobId 의 idempotency key 개념이 있고 코드의 추론은 이와 정합하나, 이 경로의 명시적 기술은 spec에 없다.
- 제안: 코드 유지 + spec 반영. sibling planner spec-sync 에서 §7.4 또는 §9.2 에 "INCR 실패는 random fallback 없이 throw 전파 → publish outer catch → null(queued:false)" 계약을 1줄 기술.

### [INFO] `executions.service.ts` — `queued=false` 시 re-fetch 경로 미실행 (설계 확인)
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/executions/executions.service.ts` L1404-1413
- 상세: `queued=false` 시 `throw ServiceUnavailableException` 으로 503 을 반환하고, `queued=true` 시에만 `executionRepository.findOne` re-fetch 후 반환하는 구조다. 이는 의도한 설계이며 정상이다. re-fetch 결과가 `null` 인 엣지 케이스는 `updated ?? execution` 으로 처리하여 안전하다.
- 제안: 변경 불필요. 구현이 의도한 동작과 일치한다.

---

## 기능 완전성 평가

**C-1 — cancelWaitingExecution fire-and-forget 에러 유실 제거:**
- `ExecutionEngineService.cancelWaitingExecution` 가 `void` → `async Promise<ContinuationPublishResult>` 로 전환되고 `buildPublishResult(jobId)` 로 결과를 표면한다. 4종 continuation 메서드와 동일 패턴이다.
- `ExecutionsService.stop()` WAITING 분기에서 `await cancelWaitingExecution` + `result.queued` 검사 + 503 throw 로 올바르게 구현되었다.
- `WebsocketGateway` spec 의 `cancelWaitingExecution` mock 이 `mockResolvedValue` 로 전환되어 void 가정 제거가 완전히 이루어졌다.
- 모든 호출부(executions.service, websocket.gateway.spec, execution-engine.service.spec)가 함께 갱신되어 기능이 완전하다.

**M-7 — nextSeq INCR 실패 random fallback 제거:**
- `try/catch` 를 제거하고 INCR 실패가 상위 `publish` 의 outer catch 로 전파되도록 리팩터링되었다.
- EXPIRE 실패는 여전히 swallow(catch+warn)하여 정상 seq 를 무효화하지 않는 기존 설계를 보존한다.
- 테스트가 `null` 반환을 검증하며 이전 "fallback random seq" 테스트를 정확히 역전했다.

**엣지 케이스:**
- INCR 성공 + EXPIRE 실패 → 정상 jobId 반환 (테스트 보장)
- BullMQ `queue.add` 실패 → null 반환 + logger.error (기존 테스트)
- `nodeExecutionId` 미설정 → `__no_node_exec__` sentinel 사용 (기존 테스트)
- `queued=false` 시 re-fetch 생략, 503 throw — 의도한 fast-fail 경로

**TODO/FIXME 주석:** 발견 없음.

**의도와 구현 간 괴리:** 없음. 함수명·JSDoc·실제 구현이 일치한다.

**에러 시나리오 coverage:**
- Redis 완전 장애(INCR 실패): fail-fast, null 반환, caller 503 surface
- BullMQ 장애(queue.add 실패): null 반환, logger.error
- EXPIRE 실패(부분 장애): swallow, 정상 continue
- cancel publish 실패: 503 EXECUTION_ENQUEUE_FAILED, 클라이언트 재시도 유도

**반환값:** publish()는 모든 경로에서 string|null 반환. cancelWaitingExecution()은 모든 경로에서 ContinuationPublishResult 반환. stop()은 queued=true 시 Execution, queued=false 시 throw. 모든 경로가 명시적으로 처리되어 있다.

---

## 요약

C-1 + M-7 변경은 의도한 기능(publish 실패 fail-fast 통일, 에러 유실 제거, random fallback 계약 위반 수정)을 완전히 구현한다. 코드 품질·엣지 케이스 처리·테스트 커버리지 모두 양호하다. spec fidelity 관점에서는 4개 항목이 [SPEC-DRIFT] — 코드가 합리적이고 의도적으로 개선된 동작을 구현했으나 spec 본문이 아직 이를 반영하지 않은 상태다. 이는 commit message 에서 이미 "sibling planner spec-sync merge-gate" 로 인지되어 있다. 코드 자체를 되돌릴 이유는 없으며, spec 갱신은 planner spec-sync PR 에서 수행되어야 한다. CRITICAL 또는 WARNING 위반 없음.

---

## 위험도

LOW

---

## 관련 spec 위치 (갱신 필요, planner spec-sync 범위)

- `/Volumes/project/private/clemvion/spec/5-system/2-api-convention.md §6` — 503 상태 코드 추가
- `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md §7.4` 또는 §7.5 — REST stop() WAITING 분기 503 + INCR fail-fast 계약 1줄
- `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md §7.5.2` — cancel 핸들러 목록 추가
- `/Volumes/project/private/clemvion/spec/5-system/3-error-handling.md §1` — EXECUTION_ENQUEUE_FAILED 카탈로그 등재
