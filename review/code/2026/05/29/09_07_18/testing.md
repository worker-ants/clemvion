# Testing Review — workflow-resumable Phase 3.1

## 발견사항

### [WARNING] `onModuleInit` 타이머 등록 테스트에서 `timer.unref()` 호출 미검증
- 위치: `continuation-dlq-monitor.service.spec.ts` — `lifecycle` describe, `onModuleInit 가 interval 타이머 등록, onModuleDestroy 가 해제` 테스트
- 상세: 구현 코드(`continuation-dlq-monitor.service.ts` L443)는 `this.timer.unref?.()` 를 호출해 Node.js 프로세스가 이 타이머로 인해 종료 지연되지 않도록 한다. 이 동작은 graceful shutdown 에 중요하지만 테스트에서 검증하지 않는다. `setInterval` 반환 객체에 `unref` mock 을 달아 호출 여부를 확인하는 assertion 이 없다.
- 제안: `setInterval` spy 가 반환하는 mock timer 객체에 `unref: jest.fn()` 을 포함시키고, `service.onModuleInit()` 후 `unref` 가 호출됐는지 assertion 추가.

### [WARNING] WS gateway — `handleClickButton`, `handleSubmitMessage`, `handleEndConversation` 에 대한 `InvalidExecutionStateError` ack 테스트 누락
- 위치: `websocket.gateway.spec.ts` — 신규 추가 2개 테스트 (`handleSubmitForm` 전용)
- 상세: `handleSubmitForm` 의 `InvalidExecutionStateError` → `errorCode=INVALID_EXECUTION_STATE` 경로는 테스트로 커버됐다. 그러나 같은 패턴이 `handleClickButton`(L495), `handleSubmitMessage`(L571), `handleEndConversation`(L644)에도 동일하게 추가됐음에도 해당 핸들러들의 `errorCode` 분기는 테스트되지 않는다. 구현 코드의 동일 패턴이므로 커버리지 갭이 동일하다.
- 제안: `handleClickButton`, `handleSubmitMessage`, `handleEndConversation` 각각에 대해 `InvalidExecutionStateError` 를 throw 했을 때 `errorCode=INVALID_EXECUTION_STATE` 가 ack 에 포함되는지 검증하는 테스트 추가. `handleSubmitForm` 의 2개 테스트를 템플릿 삼아 it.each 로 통합하거나 개별 추가.

### [WARNING] `interaction.service.spec.ts` — `click_button`, `submit_message`, `end_conversation` 명령의 `InvalidExecutionStateError` → 409 매핑 미검증
- 위치: `interaction.service.spec.ts` — 신규 추가 1개 테스트 (`submit_form` 전용)
- 상세: `submit_form` 에 대한 `InvalidExecutionStateError` → `STATE_MISMATCH(409)` 매핑 테스트 1건이 추가됐다. 그러나 `dispatchContinuation` 헬퍼는 `click_button`, `submit_message`, `end_conversation` 명령에도 동일하게 적용되며(`interaction.service.ts` L90, L110, L121), 각 명령 경로에서도 동일한 에러 매핑이 일어난다. 해당 분기들은 테스트되지 않는다.
- 제안: `click_button`(`continueButtonClick` mock rejection), `submit_message`(`continueAiConversation`), `end_conversation`(`endAiConversation`) 명령에 대해서도 각각 `InvalidExecutionStateError` → `STATE_MISMATCH` 매핑 테스트 추가. 또는 `dispatchContinuation` 단위 테스트를 service private 메서드 테스트로 분리하여 1개로 공통 검증.

### [INFO] `execution-engine.service.spec.ts` — `continueAiConversation`, `endAiConversation` 의 WAITING 0건 throw 테스트 누락
- 위치: `execution-engine.service.spec.ts` — Phase 2.3 신규 테스트 블록
- 상세: `continueExecution`, `continueButtonClick` 의 `WAITING row 0건 → InvalidExecutionStateError throw` 경로는 각각 별도 테스트로 커버됐다. 하지만 동일한 `resolveWaitingNodeExecutionId` 호출이 `continueAiConversation`(내부적으로 `continueAiMessage` 경유)과 `endAiConversation` 에도 있다. 해당 메서드들의 0건 throw 경로 테스트가 없다. `resolveWaitingNodeExecutionId` 가 공유 private 메서드이므로 이미 충분히 검증됐다고 볼 수도 있으나 public contract 상 완전성 차원의 누락이다.
- 제안: `continueAiConversation` / `endAiConversation` 에서도 `mockNodeExecutionRepo.find.mockResolvedValueOnce([])` 후 `InvalidExecutionStateError` throw 를 검증하는 테스트 추가 (낮은 우선순위).

### [INFO] `continuation-dlq-monitor.service.spec.ts` — `makeService` 의 env restore 가 생성자 이후 즉시 복원되는 구조의 잠재적 취약점
- 위치: `continuation-dlq-monitor.service.spec.ts` L56-60, `makeService` 함수
- 상세: 현재 구현의 env 참조가 생성자에서만 이뤄지므로 이 패턴은 안전하다. 그러나 미래에 `onModuleInit` 이나 다른 메서드에서 `process.env` 를 재참조하는 코드가 추가될 경우 테스트가 실제와 다른 env 환경을 보게 된다.
- 제안: 주석에 "env 참조가 생성자 전용임을 전제" 라는 명시를 추가하여 향후 변경자에게 경고를 남길 것.

### [INFO] `executions.controller.spec.ts` — `InvalidExecutionStateError` 테스트가 단일 `it` 에 2개 mock setup 과 2개 assertion 을 포함하는 가독성 문제
- 위치: `executions.controller.spec.ts` L71-93, 신규 테스트
- 상세: 단일 `it` 블록 안에서 `mockRejectedValueOnce` 를 두 번 호출해 두 가지 assertion (예외 타입 검증 + response body 검증)을 순차로 수행한다. 첫 번째 assert 가 실패해도 두 번째가 실행되지 않아 디버깅 정보가 줄어들 수 있으며, 두 번의 mock setup 이 필요해 가독성이 떨어진다.
- 제안: 두 assertion 을 별도 `it` 블록으로 분리하거나, 하나의 `expect` 체인에서 `UnprocessableEntityException` 인스턴스를 받은 후 `toBeInstanceOf` 와 `getResponse()` 를 모두 검증하도록 리팩터링.

### [INFO] `continuation-execution.processor.spec.ts` — `onFailed` describe 블록에 `afterEach(jest.restoreAllMocks)` 부재
- 위치: `continuation-execution.processor.spec.ts` — `describe('onFailed', ...)` 블록
- 상세: `warnSpy()` 헬퍼가 각 테스트마다 새 spy 를 생성하고 `.mockImplementation(() => undefined)` 를 적용한다. 상위 suite 전체에 명시적 `afterEach(() => jest.restoreAllMocks())` 가 없고 `beforeEach` 로 module 을 재생성하므로 실질적 격리 위험은 낮다. 그러나 명시적 `afterEach` 를 추가하면 spy 누출 가능성을 원천 차단한다.
- 제안: `describe('ContinuationExecutionProcessor', ...)` 또는 `describe('onFailed', ...)` 블록에 `afterEach(() => jest.restoreAllMocks())` 추가.

---

## 요약

이번 변경은 Phase 3.1 DLQ 모니터(신규), Phase 2.3 publisher 사전 검증 에러(`InvalidExecutionStateError`) 전파, 그리고 `onFailed` retry 로깅을 다루며 대체로 테스트 커버리지가 잘 갖춰져 있다. `ContinuationDlqMonitorService` 의 config 파싱·알람·cooldown·lifecycle 단위 테스트는 설계가 우수하고 `makeService` 헬퍼를 통한 env 격리도 적절하다. 그러나 WS gateway 의 4개 핸들러 중 `handleSubmitForm` 만 `InvalidExecutionStateError` ack 테스트를 갖고 나머지 3개(`handleClickButton`, `handleSubmitMessage`, `handleEndConversation`)는 동일 로직 추가에도 불구하고 테스트가 없으며, `interaction.service` 의 `click_button` / `submit_message` / `end_conversation` 명령도 `dispatchContinuation` 매핑 테스트가 누락돼 있다. 이 두 가지가 주요 커버리지 갭이며, 구현 로직이 동일한 패턴을 반복하는 만큼 실제 동작 차이가 생겼을 때 테스트로 발견되지 않을 위험이 있다.

## 위험도

MEDIUM
