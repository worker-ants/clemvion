# 동시성(Concurrency) 리뷰 결과

리뷰 대상: `execution-engine.service.ts` (PR-B1 park 즉시 해제 + slow-path 일원화)
검토 일시: 2026-06-06

---

## 발견사항

### **[WARNING]** `firstSegmentBarriers` 덮어쓰기 시 race window

- **위치**: `armFirstSegmentBarrier` (line ~776–786), `runExecutionFromQueue` (line ~2629–2647)
- **상세**: `armFirstSegmentBarrier` 는 동일 `executionId` 로 기존 배리어가 있으면 `settleFirstSegment` 로 깨운 뒤 새 배리어를 `Map.set` 으로 교체한다. 이 두 연산 사이에(JS 이벤트 루프상 tick 사이) 이전 배리어를 await 하던 caller 가 깨어나 `Map.get` 을 수행하면 이미 삭제된 배리어를 보게 된다. Node.js 단일 스레드라 동시 접근은 아니지만, `settleFirstSegment` → `Map.delete` 후 `barrier.resolve()` 호출이 resolve 직후 곧바로 `runExecutionFromQueue` 의 `await settled` 가 unblock 되어 반환하는 반면, 새 `Map.set` 은 같은 microtask queue 안에서 순서가 보장되므로 **현재 코드에서는 실제 위험이 낮다**. 그러나 이 패턴은 `settleFirstSegment` 내부의 `Map.delete` → `barrier.resolve()` 호출 순서에 암묵적으로 의존하며, 리팩토링 시 버그화 위험이 있다. 코드 자체는 `settleFirstSegment` 가 delete 후 resolve 해 기존 awaiter 가 해제되도록 구현되어 있어 실제 hang 은 발생하지 않지만 명시적 불변식 주석이 없다.
- **제안**: `armFirstSegmentBarrier` 내부에 "먼저 settle → 그 다음 set" 의 순서가 안전한 이유를 인라인 주석으로 명시. 또는 `firstSegmentBarriers` Map 에 `version` 필드를 추가해 덮어쓰기 여부를 명시적으로 추적한다.

---

### **[WARNING]** `rehydrateAndResume` → `resumeFromCheckpoint` → `driveResumeDetached` 의 cleanup 경쟁

- **위치**: `rehydrateAndResume` (line ~1175), `finalizeRehydrationCleanup` (line ~2217), `driveResumeDetached` finally (line ~2148)
- **상세**: `rehydrateAndResume` 의 outer catch 블록은 "launch 이전 실패" 시 `finalizeRehydrationCleanup` 을 호출한다. `resumeFromCheckpoint` 가 `driveResumeDetached(...)` 를 fire-and-forget(`.catch(...)` 만 등록) 하므로, launch 직후 outer catch 를 탈출하는 시점에 `driveResumeDetached` 가 이미 비동기로 시작돼 동일 `executionId` 의 `pendingContinuations` 와 context 를 읽고 있는 상태일 수 있다. `rehydrateAndResume` outer catch 가 `finalizeRehydrationCleanup` 을 호출하는 경로(invariant 검증 실패)는 launch **이전** 이므로 실제로는 `driveResumeDetached` 가 아직 시작되지 않아 겹치지 않는다. 그러나 `resumeFromCheckpoint` 내부의 pre-check(graph load, schemaVersion 가드 등)에서 throw 가 발생하면 launch 가 일어나지 않고 `rehydrateAndResume` outer catch 로 떨어지는데, `resumeFromCheckpoint` 자체도 `async` 이므로 throw 시점에 이미 `driveResumeDetached` 가 시작됐을 가능성을 확인해야 한다. 코드 상 `this.driveResumeDetached(...)` 호출은 `resumeFromCheckpoint` 의 **마지막** 문장이어서 pre-check 에서 throw 하면 `driveResumeDetached` 호출에 도달하지 않는다. 이 구조는 안전하지만 향후 `resumeFromCheckpoint` 내부에서 `driveResumeDetached` 호출 **이후** 에 코드를 추가하면 cleanup 경쟁이 실제화된다.
- **제안**: `driveResumeDetached` 호출 후에는 어떤 state-mutating 코드도 `resumeFromCheckpoint` 에 추가하지 않도록 주석으로 명시. 혹은 `resumeFromCheckpoint` 를 "setup phase" 와 "launch phase" 두 함수로 분리해 의도를 구조로 강제한다.

---

### **[WARNING]** `firePayload` 폴링(setTimeout 루프)과 단발 보장 — AI 멀티턴 재개 시 pending 미등록으로 한도 소진 warn

- **위치**: `resumeFromCheckpoint` (line ~1847–1870)
- **상세**: `firePayload` 는 `pendingContinuations.has(executionId)` 를 폴링해 form/button 재개의 resolver 등록을 기다린다. AI 재개(`isAiConversation === true`) 이면 스케줄하지 않는다는 분기가 있으나, `driveResumeDetached` 가 내부에서 `waitForFormSubmission` / `waitForButtonInteraction` 을 `parkMode='await'` 로 호출(중첩 path)하는 경우 `pendingContinuations` 에 등록이 이루어지므로 `firePayload` 가 필요하다. 그러나 AI 경로에서 `driveResumeDetached` 가 `waitForFormSubmission` 을 직접 호출하는 경로(`ai_form_render`)가 존재하면, `isAiConversation === true` 분기에서 `firePayload` 를 skip 해 resolver 가 영구적으로 fire 되지 않는다. 현재 `isAiConversation` 은 `persistedInteractionType === 'ai_conversation' || persistedInteractionType === 'ai_form_render'` 로 판단되며, `ai_form_render` 경로에서 `driveResumeDetached` 는 `waitForFormSubmission` 을 호출하므로 pending 등록이 일어난다. `firePayload` 가 skip 되면 resolver 가 fire 되지 않아 `waitForFormSubmission` 이 영구 hang 할 수 있다.
- **제안**: `ai_form_render` 경로를 `isAiConversation` skip 조건에서 분리하거나, `driveResumeDetached` 내에서 `waitForFormSubmission` 호출 이전에 `firePayload` 를 스케줄하는 내부 hook 을 만들어 명시적으로 처리한다. 또는 `ai_form_render` 재개는 `waitForFormSubmission` 대신 `processAiResumeTurn` 경로로 통일한다.

---

### **[INFO]** `resolveWaitingNodeExecutionId` 의 TOCTOU — status 조회 후 publish 사이의 전이

- **위치**: `continueExecution`, `continueButtonClick`, `continueAiConversation`, `endAiConversation` (line ~3894–3974)
- **상세**: 각 메서드는 `resolveWaitingNodeExecutionId(executionId)` 로 `WAITING_FOR_INPUT` 상태의 `NodeExecution` id 를 조회한 뒤 `continuationBus.publish` 한다. 두 연산 사이에 Execution 이 이미 cancel 되거나 다른 인스턴스의 continuation job 이 먼저 처리돼 COMPLETED 로 전이할 수 있다. 이 경우 stale `nodeExecutionId` 를 BullMQ 에 enqueue 하게 된다. worker 의 `isNodeExecutionWaiting` 멱등 가드가 이를 걸러주므로 **실질적 손상은 없다**. 단, 사용자 입력이 silently drop 되어 프론트엔드는 응답 없음 상태가 될 수 있다.
- **제안**: 이 TOCTOU 는 코드 상 이미 인지되어 있으며(`SUMMARY#1` 주석) 향후 conditional UPDATE 원자화 계획이 있다. 현재 단계에서는 worker 멱등 가드가 충분한 보호이나, drop 시 caller 에 `queued: false` 를 반환해 프론트엔드가 재시도 안내를 할 수 있도록 개선을 검토한다.

---

### **[INFO]** `segmentStartMs` Map — 단일 인스턴스 제약 인식 필요

- **위치**: `segmentStartMs` (line ~721), `assertActiveTimeWithinLimit` (호출처)
- **상세**: `segmentStartMs` 는 인스턴스-로컬 in-memory Map 으로 active 세그먼트 시작 시각을 추적한다. 코드 주석에 "단일 Execution 은 한 번에 하나의 active 세그먼트만 처리된다(직렬화 불변)" 와 "Graceful Shutdown under-count 허용" 이 명시되어 있어 설계 의도가 문서화돼 있다. Node.js 단일 이벤트 루프 내에서는 같은 `executionId` 에 대한 `set/delete` 가 동시에 일어나지 않으므로 경쟁 조건은 없다. 다중 인스턴스 환경에서 SIGTERM 후 재배달 시의 under-count 는 의도된 허용이다.
- **제안**: 현재 설계는 적절하다. 다만 `clearLlmDefaultConfigCache` 와 `segmentStartMs` 의 정리가 모두 `runExecution` finally 에서 일어나는데, 두 Map 의 정리 순서가 달라지면 (`segmentStartMs` 가 먼저 정리되면 다른 경로의 `assertActiveTimeWithinLimit` 가 `undefined`를 읽어 0ms 로 해석) 문제가 발생하지 않는지 확인 — 현재는 `assertActiveTimeWithinLimit` 가 entry 없으면 early return 하므로 안전.

---

### **[INFO]** `llmDefaultConfigCache` single-flight 패턴 — 정리 시점 일관성

- **위치**: `llmDefaultConfigCache` (line ~859), `clearLlmDefaultConfigCache` (호출처)
- **상세**: Promise 자체를 Map 에 저장해 동일 키의 동시 호출을 single-flight 로 처리하는 패턴은 올바르다. 정리는 `runExecution` finally 에서 prefix 기반 일괄 삭제로 이루어진다. `driveResumeDetached` finally 의 `finalizeRehydrationCleanup` 도 `clearLlmDefaultConfigCache(executionId)` 를 호출한다. 두 경로가 모두 삭제를 시도해 중복 삭제가 발생할 수 있으나, Map.delete 는 멱등이므로 문제없다. 다만 `runExecution` 이 still-alive 인 상태에서 `driveResumeDetached` 가 먼저 cleanup 하면 `runExecution` 내부의 후속 LLM config 조회가 cache miss 로 재조회를 유발할 수 있다. 이는 기능 정확성에 영향 없이 성능 상 1회 추가 DB 조회를 발생시킨다.
- **제안**: 현재 구조는 허용 범위 내. `runExecution` 과 `driveResumeDetached` 가 동일 executionId 에 대해 동시에 살아있을 수 없음(전자가 park 후 반환, 후자가 detach)을 주석으로 명시해 이 정리 경쟁이 실질적으로 발생하지 않음을 문서화한다.

---

### **[INFO]** `pendingContinuations` 의 단발(one-shot) 보장 — `resolvePending` 의 delete-before-resolve

- **위치**: `resolvePending` (line ~2350–2355), `rejectPending` (line ~2360–2365)
- **상세**: `resolvePending` 은 `Map.get` → `Map.delete` → `pending.resolve(value)` 순서로 실행한다. delete 후 resolve 이므로, resolve 콜백 내부에서 동일 `executionId` 로 다시 `pendingContinuations.set` 이 일어나도 이전 entry 를 덮어쓰지 않는다. 단발 보장이 올바르다. Node.js 이벤트 루프 특성상 resolve 콜백이 다음 microtask queue 에서 실행되므로 `delete` 와 `resolve` 사이에 같은 키의 `has()` 조회가 false 를 반환하는 것이 보장된다.
- **제안**: 적절하다. 변경 없음.

---

## 요약

PR-B1 의 핵심 변경(form/button top-level park 즉시 해제, `firstSegmentBarriers` 배리어, `cancelParkedExecution` 직접 DB 마감, `driveResumeDetached` 로 resume 구동 detach) 은 Node.js 단일 이벤트 루프 모델 하에서 동시성 설계가 전반적으로 올바르다. `pendingContinuations` Map 의 단발 보장, `firstSegmentBarriers` 의 멱등 settle, `segmentStartMs` 의 직렬화 불변식 모두 주석으로 명시되어 있으며 코드가 이를 준수한다. 주요 주의 사항은 두 가지다: (1) `ai_form_render` 재개 경로에서 `isAiConversation === true` 분기로 `firePayload` 가 skip 돼 `waitForFormSubmission` pending resolver 가 fire 되지 않을 수 있는 잠재적 hang (WARNING), (2) `armFirstSegmentBarrier` 의 덮어쓰기 패턴이 순서 의존적이어서 리팩토링 시 주석 없이는 위험하다는 점 (WARNING). 나머지 발견 사항은 INFO 수준으로 현재 동작에 실질적 결함을 유발하지 않는다. 분산 환경의 TOCTOU(`resolveWaitingNodeExecutionId`)는 worker 멱등 가드로 보호되고 있어 기능 손상 없으나 사용자 UX 관점에서 개선 여지가 있다.

## 위험도

MEDIUM

STATUS=success ISSUES=6 PATH=/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/review/code/2026/06/06/10_26_12/concurrency.md RESET_HINT=
