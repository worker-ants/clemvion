# 요구사항(Requirement) 리뷰 결과

리뷰 대상: Phase 2 (workflow-resumable-execution) — BullMQ 기반 Durable Continuation Bus + Rehydration + WS ack queued 필드  
리뷰 일시: 2026-05-25  
관련 spec: `spec/5-system/4-execution-engine.md §7.4 / §7.5`, `spec/5-system/6-websocket-protocol.md §4.2`

---

## 발견사항

### [CRITICAL] spec §7.4 의 ContinuationMessage 스키마에 `nodeExecutionId` 필드 미등재

- **위치**: `spec/5-system/4-execution-engine.md` §7.4 Continuation Bus 표, 742번째 줄
- **상세**: 명세의 메시지 스키마가 `{ type: ContinuationType, executionId: string, payload?: unknown }` 로 고정되어 있으나, Phase 2 구현의 `ContinuationMessage` 타입에는 `nodeExecutionId?: string` 필드가 추가되었고, BullMQ `ContinuationJob` 에서는 동 필드가 **필수** (`nodeExecutionId: string`)로 선언되어 있다. `__no_node_exec__` sentinel 값과 rehydration 1차 키 역할이 spec 본문에 전혀 정의되지 않아 spec-impl 간 필드 정의 차이가 발생한다.
- **제안**: `project-planner` 가 spec §7.4 Continuation Bus 표의 메시지 스키마 행에 `nodeExecutionId` 필드(optional, Phase 2)와 sentinel `__no_node_exec__` 의미론을 추가해야 한다.

---

### [CRITICAL] spec §7.4 가 옛 Redis pub/sub 아키텍처를 기술 — BullMQ 전환 미반영

- **위치**: `spec/5-system/4-execution-engine.md` §7.4 Continuation Bus (Pub/Sub) 표 전체, 735-775번째 줄
- **상세**: 명세는 `execution:continuation` Redis pub/sub 채널, publisher/subscriber 분리 ioredis 인스턴스, 채널 TTL 없음, §9.2 표 내 `execution:continuation (Pub/Sub)` 항목 등을 정의한다. 그러나 Phase 2 구현은 이 채널을 BullMQ 영속 큐 `execution-continuation` 으로 완전 교체했으며, `continuation-bus.service.ts` 는 `@InjectQueue(CONTINUATION_EXECUTION_QUEUE)` 를 사용하고 subscriber 연결 자체가 없다. 두 아키텍처가 spec 과 코드에서 완전히 역전된 상태로 공존한다.
- **제안**: `project-planner` 가 §7.4 를 BullMQ 기반으로 재작성하고 §9.2 의 `execution:continuation` 행을 `execution-continuation` (BullMQ 큐) 로 교체해야 한다. 본 변경은 `plan/in-progress/spec-update-workflow-resumable-execution-phase2-followup.md` 의 변경 1과도 연관됨을 확인.

---

### [CRITICAL] spec §7.5 (`Resume after Restart`) 가 존재하지 않음 — 구현만 있는 RESUME_* 에러 코드

- **위치**: `spec/5-system/4-execution-engine.md` §7 전체 (§7.5 부재)
- **상세**: 구현 코드는 `RESUME_CHECKPOINT_MISSING`, `RESUME_INCOMPATIBLE_STATE`, `RESUME_FAILED` 세 에러 코드와 `rehydrateAndResume` / `rehydrateContext` / `resumeFromCheckpoint` 메서드들을 상세하게 구현하고 있으나, spec 본문에 §7.5 섹션 자체가 없다. 코드 주석에서 "SoT: spec/5-system/4-execution-engine.md §7.5" 를 여러 번 참조하지만 해당 섹션은 현재 존재하지 않는 dead reference다. `plan/in-progress/spec-update-workflow-resumable-execution-phase2-followup.md` 에서 spec 추가를 제안 중이지만 아직 반영되지 않았다.
- **제안**: `project-planner` 가 §7.5 섹션을 신설하여 invariant 체크 순서, RESUME_* 에러 코드 정의, rehydration 경로 상태 전이를 공식 등재해야 한다.

---

### [CRITICAL] 미완성 주석 — `nodeExecutionCount` 문장이 파일 중간에서 잘림

- **위치**: `execution-engine.service.ts` `resumeFromCheckpoint` 메서드 내부, 1688번째 줄 (diff의 `+    // nodeExecutionCount — 재시작 후 budget 은 fr` 라인)
- **상세**: `resumeFromCheckpoint` 메서드 내 `// nodeExecutionCount — 재시작 후 budget 은 fr` 로 문장이 갑자기 끊긴다. diff 의 해당 섹션이 `... (truncated due to prompt size limit)` 으로 리뷰에서 잘렸으나, 코드 원본에 동일한 문자열이 있는지 확인이 필요하다.
- **제안**: diff 전체를 다시 확인하여 `resumeFromCheckpoint` 내 `nodeExecutionCount` 관련 로직 및 주석이 완전한지 점검. 실제 소스에 잘린 주석이 있다면 즉시 수정해야 한다.

---

### [WARNING] `applyCancellation` 의 `await` 제거 — 호출자가 비동기 실패를 감지 불가

- **위치**: `continuation-execution.processor.ts` 82번째 줄
- **상세**: 변경 전 `await this.engine.applyCancellation(executionId)` 를 `this.engine.applyCancellation(executionId)` (await 제거, void 반환) 로 교체했다. 코드 주석은 "applyCancellation 은 sync (rejectPending 만 호출) — await 불필요" 라고 명시했고, 실제 `applyCancellation(executionId): void` 시그니처가 동기 메서드임이 확인된다. 그러나 BullMQ worker `process()` 가 반환하는 Promise 가 완전히 settle 되기 전에 worker 가 다음 job 으로 넘어갈 수 있는지 BullMQ 의 ack 타이밍에서 검토가 필요하다. 또한 `rejectPending` 내부에서 Future 확장 (async 전환) 시 silent 실패 위험이 있다.
- **제안**: 현재 동기 구현에서는 문제없으나, `applyCancellation` 이 향후 async 로 전환될 때를 위해 `void this.engine.applyCancellation(executionId)` 와 같이 의도적 fire-and-forget 임을 명시하거나 Lint 규칙 예외 주석을 추가하는 것이 안전하다.

---

### [WARNING] `on()` no-op 처리 후 `handlers` Map 과 `dispatch()` 메서드가 dead code로 잔류

- **위치**: `continuation-bus.service.ts` (현재 Phase 2 버전)
- **상세**: 변경된 `.spec.ts` 에서 `on()` 이 no-op 으로 처리됨을 검증하지만, 실제 `continuation-bus.service.ts` 구현을 보면 `handlers` Map 과 `dispatch()` private 메서드가 **완전히 제거되어** 있다. spec 테스트에서 `on()` 을 no-op 으로 검증하는 것은 새 서비스 구현과 일치하지만, `CONTINUATION_CHANNEL` 상수와 관련된 subscriber 관련 import/export 가 제거된 상황에서 이전 spec.ts 가 참조하던 `CONTINUATION_CHANNEL` 등이 깔끔하게 정리됐는지 확인 필요.
- **제안**: `continuation-bus.service.ts` 에서 `CONTINUATION_CHANNEL` 상수가 제거됐는지, 다른 곳에서 참조 중인 코드가 없는지 전수 grep 확인.

---

### [WARNING] `isNodeExecutionWaiting` 의 `__no_node_exec__` 처리 — `true` 반환 후 fast-path 만 시도

- **위치**: `execution-engine.service.ts` 662-672번째 줄 `isNodeExecutionWaiting`
- **상세**: `nodeExecutionId === '__no_node_exec__'` 이면 DB lookup 없이 `true` 를 반환한다. 이 결과로 processor 는 status 가드를 통과하고 `applyContinuation` 을 호출하게 되는데, `applyContinuation` 내에서 fast-path (`pendingContinuations.has()`) 가 miss 이면 `rehydrateAndResume` 을 호출하고, 거기서 `__no_node_exec__` sentinel 이 `RESUME_CHECKPOINT_MISSING` 으로 처리된다. 이 경로는 spec §7.5 에 기술되지 않은 암묵적 behavior 이다. 또한 `isNodeExecutionWaiting` 이 `true` 를 반환했으므로 processor 가 "계속 진행" 한다고 판단하지만, 실제로는 always `RESUME_CHECKPOINT_MISSING` 이 발생하는 모순이 있다. 취소(`cancel`) 타입의 경우 `type !== 'cancel'` 가드에 의해 `isNodeExecutionWaiting` 자체를 호출하지 않으므로 이 문제는 cancel 에는 해당하지 않는다.
- **제안**: spec §7.5 에 sentinel path 의 behavior (`__no_node_exec__` → RESUME_CHECKPOINT_MISSING) 를 명시하거나, processor 에서 sentinel job 에 대해 early return 하는 명시적 경로를 두어 가독성을 개선할 것.

---

### [WARNING] WS gateway 의 `queued` ack 필드가 spec §4.2 에 미등재

- **위치**: `spec/5-system/6-websocket-protocol.md §4.2` (버튼 클릭 응답, submit_form 응답 등)
- **상세**: 구현된 WS gateway 는 `execution.form_submitted`, `execution.click_button.ack`, `execution.submit_message.ack`, `execution.end_conversation.ack` 응답에 `queued: boolean`, `executionId: string` 필드를 추가했다. 그러나 spec §4.2 는 `execution.click_button.ack` 에 `resumed: true` 만 정의하고 `queued` 는 없다. `execution.form_submitted` ack 응답 전체가 spec 에 포함되지 않아 있다. consistency check SUMMARY I17 항목에서 "queued: true + resumed: true 동시 성립 케이스 의미론 명확 서술 필요" 로 식별됐으나, 이미 구현에 반영되어 있어 역전된 상태다.
- **제안**: `project-planner` 가 spec §4.2 에 4개 ack 응답의 `queued`/`executionId` 필드를 추가하고 Redis 장애(jobId=null) 케이스의 `success: false` + `error: 'enqueue failed'` 응답을 명시해야 한다.

---

### [WARNING] `rehydrateContext` 에서 loop iteration 처리 — `seenNodeIds` 로 첫 번째 log 행만 처리

- **위치**: `execution-engine.service.ts` `rehydrateContext` 메서드, `seenNodeIds` 처리 블록
- **상세**: 코드 주석은 "같은 nodeId 가 loop iteration 으로 여러 row 일 수 있음 — 1회만 처리" 라고 하며, `seenNodeIds.has(log.nodeId)` 로 첫 번째 row 가 보이면 이후 동일 nodeId 는 skip 한다. 그러나 `logs` 는 `order: { id: 'ASC' }` 이므로 최초 log (가장 오래된 실행)을 기준으로 처리한다. 이 경우 NodeExecution.outputData 는 `status: NodeExecutionStatus.COMPLETED + order: { startedAt: 'DESC' }` 로 lookup 하므로 가장 최신 완료 row 를 얻지만, `executedNodes` Set 에는 첫 번째 log 기준 nodeId 가 등록된다. 주석("같은 nodeId 의 loop iteration 은 마지막 COMPLETED 만 보존") 과 `seenNodeIds` skip 동작이 실제로 최신 값을 보존하는지 logic 흐름을 재확인해야 한다.
- **제안**: `seenNodeIds` skip 로직이 "loop 중 어느 iteration 의 것이든 처음 만난 nodeId 의 NodeExecution lookup 으로 끝낸다" 가 맞는지, 또는 "모든 log row 의 nodeId 를 `executedNodes` 에 등록하되 outputData 는 최신 COMPLETED 만 저장" 이 맞는지 의도를 명확히 하고 코드와 일치시킬 것.

---

### [WARNING] `cancelWaitingExecution` 이 `ContinuationPublishResult` 를 반환하지 않아 WS gateway 패턴 불일치

- **위치**: `execution-engine.service.ts` 2773-2775번째 줄
- **상세**: `cancelWaitingExecution(executionId: string): void` 는 `void this.continuationBus.publish(...)` 패턴을 유지하며 fire-and-forget 이다. 반면 다른 4개 메서드 (`continueExecution` 등) 는 모두 `ContinuationPublishResult` 를 반환하도록 변경됐다. cancel 의 WS gateway 핸들러가 jobId=null 케이스를 처리하지 못하고 Redis 장애 시 클라이언트에 항상 성공 응답을 줄 수 있다.
- **제안**: `cancelWaitingExecution` 도 `async` 로 전환하여 `ContinuationPublishResult` 를 반환하도록 통일하거나, cancel 은 fire-and-forget 이라는 의도를 WS gateway 및 spec 에 명시할 것.

---

### [INFO] 관련 spec 문서 (`spec/5-system/4-execution-engine.md §7.5`) 가 구현 코드에서 참조되지만 해당 섹션 부재

- **위치**: `continuation-execution.queue.ts`, `continuation-bus.service.ts`, `continuation-execution.processor.ts`, `execution-engine.service.ts` 다수 주석
- **상세**: "SoT: spec/5-system/4-execution-engine.md §7.4 / §7.5" 가 코드 주석에 반복적으로 등장하나, spec 에 §7.5 섹션이 없다. `plan/in-progress/spec-update-workflow-resumable-execution-phase2-followup.md` 이 spec 갱신 제안을 담고 있으나 아직 미완료 상태다. 이는 spec 누락이며 CRITICAL 항목 3번과 동일 이슈.

---

### [INFO] `continuation-bus.service.spec.ts` 의 락 클라이언트 초기화 테스트 — `fakeRedisInstances[0]` 인덱싱이 실행 순서에 의존

- **위치**: `continuation-bus.service.spec.ts`, `onModuleDestroy` 테스트 블록
- **상세**: `fakeRedisInstances[0].quit` 를 직접 인덱싱하는 방식은 `getLockClient()` 가 첫 번째 ioredis 인스턴스를 생성한다는 가정에 의존한다. 향후 서비스가 복수의 Redis 클라이언트를 생성하는 구조로 변경되면 인덱스가 어긋날 수 있다. 기능적으로는 현재 구현과 정확히 일치하므로 LOW 리스크이나, 유지보수성 관점에서 명시적 ref capture 가 더 견고하다.

---

### [INFO] `Phase 2.7 e2e 통합 테스트` — `flushPromises` 세 번 호출로 `setImmediate` 타이밍에 의존

- **위치**: `execution-engine.service.spec.ts` Phase 2.7 시나리오 (`await flushPromises()` 세 번 연속)
- **상세**: `resumeFromCheckpoint` 가 `setImmediate` 로 resolver 를 fire 한다는 구현 상세에 의존하는 테스트다. `setImmediate` 콜백이 `flushPromises` 1-3회 차로 소비되는 타이밍은 Node.js event loop 의 구체적 ordering 에 의존하며, 향후 구현이 `Promise.resolve()` 또는 `queueMicrotask` 로 변경되면 테스트 타이밍 오류가 발생할 수 있다. 현재는 구현 의도와 일치한다.

---

### [INFO] `resolveWaitingNodeExecutionId` 다중 row 시 가장 최신 row 사용 — spec 에 미정의

- **위치**: `execution-engine.service.ts` 2878-2882번째 줄
- **상세**: WAITING_FOR_INPUT NodeExecution 이 2건 이상인 경우 `startedAt DESC` 로 정렬해 가장 최신 row 를 사용한다. 이 정책은 spec §7.4 (현재 버전) 에 명시되지 않았다. "정상은 1건이며 2건 이상은 invariant 위반" 으로 warn 로깅하고 best-effort 진행하는 방식이다. `plan/in-progress/spec-update-workflow-resumable-execution-phase2-followup.md` 의 변경 2.3에서 이 경로를 `INVALID_EXECUTION_STATE` 에러로 변환하자는 제안이 있으나 아직 미구현.

---

## 요약

Phase 2 구현은 BullMQ 기반 Durable Continuation Bus, checkpoint 기반 rehydration, WS ack `queued` 필드, 5개 async continuation 진입점을 완전히 구현하였고 대응하는 단위 테스트도 적절하게 재작성되었다. 기능 완전성 측면에서 fast-path(로컬 resolver hit) 와 slow-path(rehydrateAndResume) 의 분기, RESUME_* 에러 코드 분류, `__no_node_exec__` sentinel 처리, WS ack failure 분기 모두 구현되어 있다. 그러나 spec 충실도(spec fidelity) 관점에서 치명적 결함이 복수 존재한다: spec §7.4 는 여전히 구 Redis pub/sub 아키텍처를 기술하고 있으며 BullMQ 전환과 `nodeExecutionId` 필드가 미반영 상태이고, §7.5 섹션 자체가 부재하여 `RESUME_*` 에러 코드, `rehydrateAndResume`, `resumeFromCheckpoint` 의 동작이 spec에 전혀 정의되지 않았다. WS ack 의 `queued` 필드도 spec §4.2 에 없다. `plan/in-progress/spec-update-workflow-resumable-execution-phase2-followup.md` 가 spec 갱신 제안을 담고 있으나 아직 `project-planner` 에 의해 처리되지 않은 상태로, 구현과 spec 간 역전이 지속되고 있다.

## 위험도

**HIGH** — 기능 구현 자체는 의도에 부합하나, spec 과 코드 간 역전된 상태(BullMQ vs Redis pub/sub, §7.5 부재, `nodeExecutionId` 필드 미등재, WS ack 필드 미정의)가 복수의 CRITICAL spec fidelity 위반으로 존재한다. 구현 자체의 런타임 안전성은 양호하나 spec 이 SoT 역할을 하지 못하는 상태이므로 향후 개발 시 혼란이 불가피하다. spec 갱신이 완료되기 전까지 HIGH 위험도를 유지한다.
