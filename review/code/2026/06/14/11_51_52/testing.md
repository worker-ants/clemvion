# 테스트(Testing) 리뷰 결과

## 발견사항

### [INFO] `continueAiConversation` 테스트에서 동일한 `tooLong` 입력으로 서비스를 두 번 호출한다
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 라인 44-54 (변경 후)
- 상세: 하나의 `it` 블록 안에서 `service.continueAiConversation('exec-5', tooLong)` 를 두 번 호출하는데, 두 번째 호출은 첫 번째와 완전히 독립적이다. mock 상태 또는 side-effect 가 누적될 경우 두 번째 `expect` 가 의도치 않게 첫 번째 호출의 side-effect 에 영향을 받을 수 있다. 단, 현재 구현에서는 길이 검증이 stateless 이므로 실질적 문제는 없다. 그러나 미래의 mock 변경 시 잠재 위험이 된다.
- 제안: 두 번째 assertion (`rejects.toThrow(...)`) 을 첫 번째 `.rejects.toBeInstanceOf` 체인에 합치거나, 동일 `Promise` 를 변수에 저장해 재사용한다. 예: `const p = service.continueAiConversation('exec-5', tooLong); await expect(p).rejects.toBeInstanceOf(MessageTooLongError); await expect(p).rejects.toThrow('...');`.

### [INFO] `workflow-errors.spec.ts` — `ExecutionError` 추상 클래스 직접 인스턴스화 불가 경로 미검증
- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.spec.ts` 전체
- 상세: `ExecutionError` 는 `abstract` 클래스이므로 직접 인스턴스화 테스트가 불필요하다. `abstract readonly code: string` 계약은 TypeScript 컴파일 타임에만 강제되고, 런타임 검증 테스트는 없다. 현재 세 서브클래스(InvalidExecutionStateError / RetryLastTurnError / MessageTooLongError) 모두 구체 `code` 를 제공하므로 실질적 갭은 없다.
- 제안: 현재 커버리지 수준은 충분하다. 향후 `ExecutionError` 를 확장하는 서브클래스 추가 시 `workflow-errors.spec.ts` 에 대응 테스트 블록을 함께 추가하도록 JSDoc 또는 기여 가이드에 명시하면 충분하다.

### [INFO] `websocket.gateway.spec.ts` — `handleEndConversation` 에러 경로 미커버
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` (신규 describe 블록)
- 상세: `buildContinuationErrorAck` 는 `handleSubmitForm` / `handleSubmitMessage` / `handleClickButton` / `handleEndConversation` 4종 핸들러 공통이다. 신규 테스트 블록은 `handleSubmitForm` 과 `handleSubmitMessage` 경로를 커버하지만, `handleEndConversation` 에서 plain Error / typed `ExecutionError` 가 throw 됐을 때의 누출 차단 동작 테스트가 없다.
- 제안: `handleEndConversation` 에 대해 plain Error → `EXECUTION_INTERNAL_ERROR` + fallback message 검증 케이스를 최소 1개 추가한다. 보안 게이트는 4종 핸들러 모두에 적용되는 공통 빌더이므로 회귀 보호 차원에서 유용하다.

### [INFO] `use-execution-interaction-commands.test.ts` — `clickContinue` / `endConversation` 의 localization 경로 미커버
- 위치: `codebase/frontend/src/lib/websocket/__tests__/use-execution-interaction-commands.test.ts` 라인 1237-1278 (신규 describe 블록)
- 상세: `localizeAckError` 를 적용한 핸들러가 `submitForm` / `clickButton` / `sendMessage` 3종은 테스트되지만, `clickContinue` 와 `endConversation` 에 대한 localization 경로 테스트가 없다. `clickContinue` 는 `clickButton` 과 동일한 경로를 사용하지만, `endConversation` 은 독립 ack 이벤트(`execution.end_conversation.ack`) 를 사용하므로 별도 테스트로 보호해야 한다.
- 제안: `endConversation` 에 대해 EXECUTION_INTERNAL_ERROR → internalError i18n 키 케이스 1개를 추가한다.

### [INFO] `execution-error-codes.test.ts` — i18n map 값이 실제 dict 에 존재하는지 런타임 교차 검증 없음
- 위치: `codebase/frontend/src/lib/websocket/__tests__/execution-error-codes.test.ts` 라인 1086-1092
- 상세: "map is non-empty and every value is an executions.interactionError.* key" 테스트는 정규식으로 key prefix 만 확인한다. 실제로 i18n dict(`en/ko executions.interactionError.*`) 에 해당 key 가 존재하는지를 런타임에서 검증하지 않는다. 테스트 환경의 mock `useT` 는 `(key) => key` passthrough 이므로 존재하지 않는 key 가 있어도 에러가 발생하지 않는다.
- 제안: TypeScript `TranslationKey` 타입이 컴파일 타임에 강제하므로 현재 수준에서 실질 위험은 낮다. 선택적으로 실 i18n dict 의 키 목록을 import 해 교차 검증하는 테스트를 추가할 수 있다. 현행 유지도 허용 가능하다.

## 요약

이번 변경은 `ExecutionError` 추상 기반 클래스 도입 + `MessageTooLongError` 신설 + `buildContinuationErrorAck` 보안 게이트 재작성 + 프론트엔드 localization 파이프라인 추가로 구성된다. 테스트 커버리지 측면에서 핵심 보안 계약(client message 누출 차단, serverDetail vs message 분리, typed vs non-typed 분기)은 `workflow-errors.spec.ts` 와 `websocket.gateway.spec.ts` 신규 테스트 블록이 충실히 검증한다. 실제 내부 SQL 문자열과 내부 IP 를 포함한 realistic Error 로 누출 차단 게이트를 직접 검증하는 방식은 테스트 의도 표현이 명확하고, `@deprecated` 별칭(`detail`) 하위 호환 검증도 포함돼 있다. 발견된 이슈는 전부 INFO 등급으로, 실질적 버그나 계약 위반이 아니라 커버리지 확장 권장 사항이다. `endConversation` localization 경로와 `handleEndConversation` 보안 게이트 테스트 부재가 주요 개선 포인트이나, 공통 빌더 함수(`buildContinuationErrorAck` / `localizeAckError`)로 집중됐으므로 회귀 위험은 낮다.

## 위험도

LOW
