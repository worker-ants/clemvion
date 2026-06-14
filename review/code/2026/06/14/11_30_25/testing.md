# 테스트(Testing) 리뷰

## 발견사항

### [INFO] `ExecutionTimeLimitError` 가 `ExecutionError` 를 상속하지 않아 테스트 격리가 불완전
- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` L178
- 상세: `ExecutionTimeLimitError` 는 이 리팩토링과 정책적으로 동일한 "수치는 serverDetail, message 는 고정 문자열" 패턴을 따르지만 `ExecutionError` 를 상속하지 않고 여전히 plain `Error` 를 상속한다. 따라서 `buildContinuationErrorAck` 의 `instanceof ExecutionError` 분기에 해당하지 않고, `ExecutionTimeLimitError` 가 continuation 핸들러 경로에서 발생하면 plain Error 와 동일하게 generic fallback + `EXECUTION_INTERNAL_ERROR` 로 처리된다. 현재 `workflow-errors.spec.ts` 에는 `ExecutionTimeLimitError` 에 대한 테스트가 전혀 없으므로 이 차이(의도된 설계라면 문서화 부재, 아니라면 누락)가 검증되지 않는다.
- 제안: `ExecutionTimeLimitError` 가 continuation 경계에 도달할 수 없는 경우라면 spec §7.5.2 에 해당 범위 제한을 명시하고 `workflow-errors.spec.ts` 에 "ExecutionTimeLimitError 는 ExecutionError 외부 — continuation ack 에 도달하지 않음" 을 설명하는 주석 또는 테스트를 추가한다. 만약 continuation 경계에 도달할 수 있다면 `ExecutionError` 상속을 검토한다.

---

### [INFO] `RetryLastTurnError` 의 `notRetryable` / `tooEarly` factory 메서드 테스트 미포함
- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.spec.ts` L36–44
- 상세: `workflow-errors.spec.ts` 의 `RetryLastTurnError` describe 블록은 `notFound` factory 만 검증한다. `notRetryable` (code=`NODE_NOT_RETRYABLE`) 과 `tooEarly` (code=`RETRY_TOO_EARLY`) factory 의 message·serverDetail·ExecutionError 상속 계약은 커버되지 않는다. 이번 리팩토링에서 `detail` → `serverDetail` 마이그레이션이 세 factory 모두에 영향을 주므로 회귀 위험이 있다.
- 제안: `notRetryable` 과 `tooEarly` 에 대해 각각 message, code, serverDetail 을 검증하는 케이스를 추가한다.

---

### [INFO] `handleSubmitMessage` 에 대한 plain Error 누출 차단 테스트 없음
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` L692–743
- 상세: `handleSubmitForm` 에 대해서는 plain Error(SQL leak 시뮬레이션) 누출 차단 케이스와 `InvalidExecutionStateError` 케이스가 모두 추가됐다. 그러나 `handleSubmitMessage` 에는 `MessageTooLongError` typed 케이스만 추가됐고, plain Error 를 throw 했을 때 generic fallback + `EXECUTION_INTERNAL_ERROR` 로 처리되는지 검증하는 케이스가 없다. `buildContinuationErrorAck` 는 4종 핸들러 공용이지만 테스트는 `handleSubmitForm` 에만 집중되어 있다.
- 제안: `handleSubmitMessage` 에도 plain Error 누출 차단 케이스를 추가하거나, `buildContinuationErrorAck` private 메서드를 별도 describe 로 격리해 단일 테스트로 4종 핸들러 전체 커버를 확보한다.

---

### [INFO] `clickButton` / `clickContinue` / `endConversation` continuation 명령의 errorCode localization 테스트 미포함
- 위치: `codebase/frontend/src/lib/websocket/__tests__/use-execution-interaction-commands.test.ts` L1188–1252
- 상세: 새 `localizeAckError` 로직과 `errorCode` 전달은 `submitForm` 과 `sendMessage` 에 대해서만 테스트됐다. `clickButton`, `clickContinue`, `endConversation` 도 동일하게 변경됐으나(`t` 의존성 추가, `errorCode` 파라미터 추가) 해당 명령의 localization 경로는 테스트 커버가 없다. 4종 모두 동일한 `emitWithAck` → `localizeAckError` 경로를 공유하므로 `clickButton` 하나라도 커버하면 신뢰도가 높아진다.
- 제안: `clickButton` 또는 `endConversation` 에 대해 `errorCode=EXECUTION_INTERNAL_ERROR` → i18n 키 매핑 케이스를 최소 1개 추가한다.

---

### [INFO] `getExecutionInteractionErrorI18nKey` 의 `__proto__` prototype pollution 엣지 케이스 미포함
- 위치: `codebase/frontend/src/lib/websocket/__tests__/execution-error-codes.test.ts` L27–30
- 상세: 현재 테스트는 `toString`, `constructor` 를 hasOwnProperty 가드 대상으로 검증하는데, `__proto__` 도 prototype pollution 공격 벡터다. `hasOwnProperty` 를 `Object.prototype.hasOwnProperty.call` 방식으로 호출하므로 실제로는 안전하지만 `__proto__` 케이스를 명시적으로 검증하면 보안 계약이 더 명확해진다.
- 제안: 테스트 케이스에 `expect(getExecutionInteractionErrorI18nKey("__proto__")).toBeNull()` 을 추가한다.

---

### [INFO] `execution-engine.service.spec.ts` 의 동일 테스트 내 두 번의 `continueAiConversation` 호출 사이에 mock 상태 리셋 없음
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` L44–54 (diff 기준)
- 상세: 동일 테스트에서 `service.continueAiConversation('exec-5', tooLong)` 를 두 번 호출한다. 첫 번째는 `rejects.toBeInstanceOf`, 두 번째는 `rejects.toThrow('Message exceeds...')`. 각 호출 사이에 `expect(mockBus.publish).not.toHaveBeenCalled()` 가 있다. 현재 순수 동기 throw 라 실제 문제는 없지만, 미래에 비동기 부수효과가 추가되면 취약해질 수 있고, 두 assertions 의 논리적 분리가 흐려진다.
- 제안: 두 assertion 을 별도 it 블록으로 분리하거나, 두 번째 호출 전 명시적으로 mock 리셋을 수행한다.

---

## 요약

이번 변경은 테스트 우선 설계를 충실히 따랐다. 핵심 계약(typed `ExecutionError` 계층, `MessageTooLongError` code/message/serverDetail 불변식, `buildContinuationErrorAck` 누출 차단 보안 게이트, 프론트엔드 errorCode-to-i18n 매핑)에 대해 전용 테스트 파일(`workflow-errors.spec.ts`, `execution-error-codes.test.ts`)이 신규 작성됐고, 기존 통합 테스트(`execution-engine.service.spec.ts`, `websocket.gateway.spec.ts`)는 typed assertion 으로 강화됐다. `use-execution-interaction-commands.test.ts` 의 i18n mock 처리도 locale 독립성을 확보해 적절하다. 발견된 갭은 모두 INFO 등급으로, `ExecutionTimeLimitError` 상속 경계 명확화, `RetryLastTurnError` factory 3종 중 2종 미커버, `handleSubmitMessage` plain Error 누출 차단 케이스 부재, `clickButton`/`endConversation` localization 미검증 등이다. 어느 것도 현 기능 계약을 깨지 않지만 향후 회귀 방어를 위해 보완이 권장된다.

## 위험도

LOW
