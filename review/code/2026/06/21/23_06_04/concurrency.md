# 동시성(Concurrency) 리뷰 결과

## 발견사항

### [INFO] Promise.all 병렬 tool 실행 — 결과 직렬 순회로 안전하게 처리됨
- 위치: `ai-turn-executor.ts` `executeProviderToolBatch` (라인 ~1279)
- 상세: `Promise.all(toRun.map(...runProviderTool))` 로 같은 turn 내 provider tool 들을 병렬 실행한다. 각 `runProviderTool` 호출은 독립된 지역 변수만 사용하며, 공유 accumulator(`args.toolCallTraces`, `args.messages`, `args.ragGroup`, `args.presentationPayloads` 등)에 대한 실제 push는 `Promise.all` 완료 후 순차적 `for` 루프 안에서 이루어진다. 따라서 병렬 구간에서는 공유 배열에 쓰기가 없고, 수집 후 직렬 누적하는 패턴이므로 경쟁 조건 없음.
- 제안: 현행 패턴 유지. 의도가 명확히 구현되어 있음.

### [INFO] `delete state.pendingFormToolCall` — 외부 객체 직접 변경
- 위치: `ai-turn-executor.ts` `processMultiTurnMessage` (라인 ~2242, ~2267)
- 상세: `state` 는 호출자(엔진)가 넘겨준 `Record<string, unknown>` 이며, 이 객체에 대해 `delete state.pendingFormToolCall` 를 in-place 로 수행한다. Node.js 단일 이벤트 루프 + 단일 실행 흐름 상에서는 `processMultiTurnMessage` 가 한 번에 하나씩 처리되므로 실질적인 경쟁이 없다. 다만 호출자 관점에서 입력 객체가 mutate 된다는 사실을 인지하지 못하면 잠재적 버그 가능성이 있다.
- 제안: 실용적 위험도는 낮으나, immutable spread 사본을 만들어 처리하고 새 state 를 반환하는 형태가 방어적으로 더 명확하다. 다만 이는 API 계약 변경이므로 이번 리팩터링 범위(behavior-preserving)에서는 수용 가능하다.

### [INFO] `messages.length = 0; messages.push(...mem.messages)` 패턴
- 위치: `ai-turn-executor.ts` `processMultiTurnMessage` auto-memory 분기 (라인 ~2387~2388)
- 상세: 지역 배열 `messages` 를 `length = 0` 으로 비운 뒤 다시 채운다. 이 배열은 함수 지역 변수이며 동일 비동기 체인 안에서만 참조되므로 동시성 위험 없음. 다만 `length = 0` 변이 후 이전 참조가 남아있으면 빈 배열로 보이는 문제가 생길 수 있는데, 여기서는 `messages` 외부로 노출된 별도 참조가 없다.
- 제안: 가독성 측면에서 `messages = [...mem.messages]` 로 교체하면 더 명확하나 동작상 차이 없음.

### [INFO] async/await 누락 가능성 없음 — 비동기 흐름 올바름
- 위치: 전체 파일
- 상세: `executeSingleTurn`, `executeMultiTurn`, `processMultiTurnMessage`, `runProviderTool`, `executeProviderToolBatch`, `buildTools` 모두 적절히 `await` 되어 있다. `scheduleMemoryExtraction` 도 `await` 하여 enqueue 완료를 보장한다. `eventEmitter?.emitExecution(...)` 는 optional chaining + await 로 처리되어 emitter 미주입 시에도 안전하다.
- 제안: 해당 없음.

### [INFO] 클래스 레벨 공유 상태 없음 — 무상태 설계 확인
- 위치: `AiTurnExecutor` 클래스 전체
- 상세: 인스턴스 변수는 생성자 주입된 `readonly` 서비스 참조뿐이며, 실행별 가변 상태(`messages`, `ragAcc`, `toolCallTraces` 등)는 모두 메서드 내 지역 변수로 관리된다. 멀티턴 상태는 `_resumeState` 직렬화 객체로 엔진 DB 에 위탁한다. 따라서 동일 인스턴스를 여러 실행이 공유해도 인스턴스 레벨 경쟁 조건은 발생하지 않는다.
- 제안: 해당 없음.

## 요약

`AiTurnExecutor` 는 무상태(stateless) collaborator 설계 원칙을 올바르게 구현하고 있다. 유일한 병렬 실행 구간(`executeProviderToolBatch`의 `Promise.all`)은 실행과 수집을 명확히 분리해 경쟁 조건이 없으며, 비동기 메서드 전반에 걸쳐 `await` 누락이 발견되지 않는다. `delete state.pendingFormToolCall` 와 같은 in-place mutation 은 Node.js 단일 이벤트 루프 상에서 실질적 위험이 없으나 방어적 코딩 관점에서 개선 여지는 있다. 전반적으로 동시성 위험도는 매우 낮다.

## 위험도

LOW

STATUS=success ISSUES=0
