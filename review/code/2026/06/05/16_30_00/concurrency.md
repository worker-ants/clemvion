# 동시성 리뷰 — information_extractor persistent memory (memoryStrategy v2)

대상 diff: `git diff 21fa8194..HEAD -- codebase/`
리뷰어: concurrency sub-agent
일시: 2026-06-05

---

## CRITICAL

없음.

---

## WARNING

### W1 — `buildMultiTurnFinalOutput` fire-and-forget 패턴: `.catch(() => undefined)` 는 안전하나 에러 가시성 소실

- **위치**: `information-extractor.handler.ts` L1211-1218
- **상세**:
  ```
  void this.scheduleMemoryExtraction({ ... }).catch(() => undefined);
  ```
  `.catch(() => undefined)` 가 rejection 을 삼키기 때문에 unhandled rejection 은 발생하지 않는다. 안전하다. 그러나 `scheduleMemoryExtraction` 내부는 이미 `agentMemoryService.scheduleExtraction` 의 예외를 서비스 레벨에서 `logger.warn` + `return false` 로 처리하므로 실제 이 `.catch` 까지 도달하는 경로는 `scheduleMemoryExtraction` 자체가 throw 하는 경우뿐이다. 현재 구현상 `scheduleMemoryExtraction` 은 throw 하지 않으므로 `.catch(() => undefined)` 는 이중 방어다.
  - ai_agent 와의 차이: ai_agent 의 `scheduleMemoryExtraction` 호출은 항상 `await` 를 붙인다 (`ai-agent.handler.ts` L1604, L1835, L2737). ai_agent 에서는 반환된 watermark 값을 `_resumeState` 에 즉시 영속할 수 있기 때문이다. IE 의 `buildMultiTurnFinalOutput` 은 동기 메서드(`NodeHandlerOutput` 반환)이므로 `await` 가 구조적으로 불가하다는 점은 인정되는 차이다.
  - 에러 정보가 완전히 소실되어 추출 실패 원인 추적이 어렵다. 최소한 `logger.warn` 수준의 로깅이 권장된다.
- **제안**: `.catch((err) => this.logger.warn('IE multi-turn memory extraction fire-and-forget failed', err))` 로 변경.

### W2 — `processMultiTurnMessage` waiting 경로: watermark 갱신 없음 (증분 추출 미발화)

- **위치**: `information-extractor.handler.ts` L859-957 (`processMultiTurnMessage`, 비종결 경로 L956)
- **상세**:
  IE 의 설계는 "multi-turn 종결 1회 push" 이며, waiting 상태에서는 push 도 extraction 도 하지 않는다 (테스트 L333-352 에서 명시적으로 검증). 이는 ai_agent 와 다른 의도적 설계다. 그러나 이 설계에는 다음 동시성 위험이 내재된다.

  ai_agent 는 **매 turn(waiting 포함)** 에서 `scheduleMemoryExtraction` + watermark 전진을 수행한다. IE 는 종결 시 단 1회만 수행한다. 따라서:
  - 멀티턴 중 timeout/user_ended 로 `endMultiTurnConversation` 이 호출되면, 그 시점의 thread 에는 종결 직전 `pushExtractorTurnTo` 가 append 한 1개 turn 만 있다(waiting turn 은 push 하지 않으므로 thread 가 비어 있을 수 있음).
  - 추출 source 는 오직 최종 스냅샷 1개 turn뿐이며, 멀티턴 대화 과정의 중간 정보(수집 중 partial 정보)는 메모리에 반영되지 않는다.
  - 이것이 spec 의 의도라면 동시성 버그는 아니나, 증분 추출 정확성 측면에서 ai_agent 와 큰 격차가 있음을 명시한다.

  watermark (`lastExtractionTurnSeq`) 가 `stateBase` / `_resumeState` 에 포함되어 있으나, waiting 경로에서 갱신되지 않으므로 항상 `undefined` 다. 종결 시 `scheduleMemoryExtraction` 은 `prevWatermark === undefined` 로 전체 thread 를 snapshot 하는데, thread 에는 push 된 단 1개 turn 만 있어 실질적으로 문제없다. 그러나 이 로직이 향후 waiting turn push 를 추가할 경우 watermark 전진 없이 중복 추출이 발생할 위험이 있다.

- **제안**: 현행 "종결 1회 push + extraction" 설계를 spec 에 명시하거나, 증분 추출이 필요하면 ai_agent 패턴(매 turn watermark 전진)으로 전환.

---

## INFO

### I1 — `buildMultiTurnFinalOutput` 은 동기 메서드이나 fire-and-forget 비동기를 내부에서 발화

- **위치**: `information-extractor.handler.ts` L1177
- **상세**:
  메서드 시그니처가 `buildMultiTurnFinalOutput(...): NodeHandlerOutput` (동기)인데 내부에서 `void ... .catch(...)` 로 Promise 를 발화한다. 이는 JavaScript event loop 관점에서는 정상이며, 엔진이 동기 호출 후 즉시 결과를 사용하는 구조에서 `await` 불가라는 제약을 우회하는 표준 패턴이다. 단, 이 비동기 작업이 process shutdown 중에 실행되면 Node.js 가 프로세스를 종료해 mid-flight enqueue 가 소실될 수 있다. BullMQ 레벨의 graceful shutdown 이 보장되어 있다면 문제없다.
- **제안**: 별도 조치 불요. 설계 의도가 코드 주석에 이미 충분히 설명되어 있다.

### I2 — recall 실패 graceful 처리 확인

- **위치**: `information-extractor.handler.ts` L310-328 (`injectRecallPrefix`)
- **상세**:
  `try/catch` 로 `agentMemoryService.recall` 예외를 잡아 `recalled = []` 로 폴백한다. recall 실패가 추출 흐름을 막지 않는다. multi-turn 첫 진입 경로(`executeMultiTurn` L774)와 single-turn 경로(`executeSingleTurn` L503) 모두 동일 패턴 사용. 정상.

### I3 — snapshot 격리: turns shallow-copy 충분성

- **위치**: `information-extractor.handler.ts` L380-384 (`scheduleMemoryExtraction`)
- **상세**:
  ```ts
  const snapshot = fresh.map((t) => ({ source: t.source, text: t.text, nodeLabel: t.nodeLabel }));
  ```
  turn 은 push 후 frozen 이라는 주석(L379)이 전제되어 있다. `ConversationThreadService.appendAiAssistantMessage` 가 실제로 turn 객체를 freeze 하는지 확인 필요. freeze 하지 않는 경우 `t.text` 같은 string primitive 는 복사되지만 nested object 가 있다면 공유 참조 문제가 생긴다. 현재 snapshot 은 `source/text/nodeLabel` 만 추출하므로 사실상 `pick` 이라 후속 mutation 으로부터 보호된다.
- **제안**: 별도 조치 불요. `fresh.map(...)` 의 pick 패턴이 이미 격리를 보장한다.

### I4 — multi-turn push 와 extraction 순서 보장

- **위치**: `information-extractor.handler.ts` L1202-1218 (`buildMultiTurnFinalOutput`)
- **상세**:
  `pushExtractorTurnTo` (동기) → `scheduleMemoryExtraction` (비동기 fire-and-forget) 순서가 명확하다. push 가 동기적으로 완료된 뒤 `scheduleMemoryExtraction` 내에서 `getThread` 를 호출하므로, push 된 turn 이 snapshot 에 포함된다. 순서 역전 없음. 정상.

### I5 — `lastExtractionTurnSeq` 미전진이 multi-turn watermark race 를 유발하는가?

- **위치**: `information-extractor.handler.ts` L924-938 (`processMultiTurnMessage` nextState 구성)
- **상세**:
  `nextState` 에 `lastExtractionTurnSeq` 갱신이 없다(W2 와 연관). 단일 세션 내 동시 turn 실행은 엔진이 직렬 보장한다고 가정한다. 이 가정 하에 watermark race 는 없다. 다만 설계상 watermark 자체가 항상 `undefined` 이므로 종결 시 항상 전체 thread 가 snapshot 된다. 동시성 race 자체는 발생하지 않는다.

---

## 요약

이번 변경은 `information_extractor` 에 persistent 메모리(recall + fire-and-forget extraction) 를 추가했다. 동시성 관점에서 가장 주목할 사항은 두 가지다. 첫째, `buildMultiTurnFinalOutput` 이 동기 메서드이기 때문에 extraction enqueue 를 `void ... .catch(() => undefined)` 형태의 fire-and-forget 으로 처리하는 것은 구조적 불가피성이며 unhandled rejection 은 발생하지 않는다. 그러나 `.catch` 에서 에러를 완전히 소실하므로 로깅 추가가 권장된다(W1). 둘째, IE 는 ai_agent 와 달리 waiting turn 에서 watermark 를 전진시키지 않고 오직 종결 시 1회 extraction 을 수행하는 설계인데, 이 설계는 증분 추출 정보 손실 위험을 가지며 향후 waiting push 를 추가할 경우 중복 추출 버그로 이어질 수 있다(W2). recall graceful 처리, snapshot 격리, push-then-extract 순서 보장은 모두 올바르게 구현되어 있다.

## 위험도

LOW

## BLOCK: NO
