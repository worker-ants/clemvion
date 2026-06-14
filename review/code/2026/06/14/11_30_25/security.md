# 보안(Security) 리뷰 결과

**리뷰 대상**: refactor-04-a1-typed-errors — typed error 계층 도입 및 continuation ack 보안 게이트 구현
**파일 수**: 13개 (backend 7, frontend 6)

---

## 발견사항

### [INFO] serverDetail 필드가 readonly이지만 직렬화 방지 메커니즘 없음
- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` — `ExecutionError.serverDetail`
- 상세: `serverDetail` 은 "서버 로그 전용" 으로 명시되어 있고 `buildContinuationErrorAck` 에서 client 응답에 포함하지 않도록 구현되어 있다. 그러나 `serverDetail` 은 public readonly 필드이므로, 미래에 `ExecutionError` 를 JSON 직렬화하거나 다른 응답 빌더로 처리하는 코드가 실수로 전체 객체를 직렬화할 경우 누출 가능성이 존재한다.
- 제안: `serverDetail` 에 `@internal` JSDoc 태그를 추가하거나 `toJSON()` 메서드를 오버라이드해 직렬화 시 `serverDetail` 을 제외하도록 하면 defensive coding 이 강화된다. 현재 구현상 실제 누출 경로는 없으나 예방적 조치가 권장된다.

### [INFO] fallbackMessage 파라미터가 고정 문자열인지 런타임 보장 없음
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` — `buildContinuationErrorAck(event, error, fallbackMessage)` L890
- 상세: `fallbackMessage` 파라미터는 비-typed 에러의 client 응답으로 사용되는 "누출 차단 게이트" 의 일부이다. 호출 측이 올바른 고정 문자열('Form submission failed' 등)을 전달하는 것을 타입 시스템이 강제하지 않는다. 미래 호출부에서 동적 문자열이나 내부 에러 정보가 포함된 문자열을 실수로 전달하면 보안 게이트가 우회된다.
- 제안: `fallbackMessage` 타입을 `string literal union` 이나 branded type 으로 제한하거나, 최소한 JSDoc 주석으로 "항상 고정 client-safe 문자열이어야 한다" 는 계약을 명시한다. 현재 호출부(4종 continuation 핸들러)는 전부 고정 문자열을 사용하므로 실제 위험은 없다.

### [INFO] getExecutionInteractionErrorI18nKey 의 prototype 오염 방어가 충분함 (긍정 평가)
- 위치: `codebase/frontend/src/lib/websocket/execution-error-codes.ts` L1307
- 상세: `Object.prototype.hasOwnProperty.call()` 을 사용해 prototype chain 오염을 방어하고 있다. `toString`, `constructor` 등 prototype 키로 조회 시 `null` 을 반환하는 테스트도 구비되어 있다. 이는 보안상 올바른 패턴이다.
- 제안: 없음. 현재 구현이 적절하다.

### [INFO] 에러 메시지에 실제 길이 수치 노출 제거 — 긍정 평가
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L4283–L4298
- 상세: 기존 `throw new Error('Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters')` 에서 `throw new MessageTooLongError(MAX_MESSAGE_LENGTH, message.length)` 로 교체하면서, 한도(10,000)와 실제 길이 수치가 `serverDetail` 에만 기록되고 client 응답의 `message` 필드에는 노출되지 않는다. 이는 정보 노출(OWASP A05:2021 — Security Misconfiguration) 위험을 명시적으로 차단한다.
- 제안: 없음. 설계가 올바르다.

### [INFO] plain Error 의 내부 message/stack 이 client 에 전달되지 않음 — 긍정 평가
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` L588–L601
- 상세: 비-typed(`non-ExecutionError`) 예외의 `error.message` 와 `error.stack` 을 server-side 로그에만 기록하고 client ack 에는 고정 generic fallback 문자열 + `EXECUTION_INTERNAL_ERROR` 코드만 전달한다. 테스트에서 SQL 원문(`secret_internal_table`), 내부 IP(`10.0.0.5`), 드라이버 에러 클래스(`QueryFailedError`) 가 client ack 에 포함되지 않음을 직접 단언한다.
- 제안: 없음. OWASP A09:2021 (Security Logging and Monitoring Failures) 관점에서도 서버 로그에 원본 스택이 남아 운영 가시성도 확보된다.

### [INFO] 프론트엔드 fallback 경로에서 backend 의 영문 error 문자열이 toast 에 노출될 수 있음
- 위치: `codebase/frontend/src/lib/websocket/use-execution-interaction-commands.ts` — `localizeAckError()` L1410
- 상세: `getExecutionInteractionErrorI18nKey` 가 `null` 을 반환하는 경우(매핑 없는 errorCode 또는 errorCode 없음) backend 의 `error` 문자열을 그대로 `toast.error()` 로 노출한다. backend 의 `buildContinuationErrorAck` 가 typed Error 는 `error.message`(고정 문자열), 비-typed Error 는 `fallbackMessage`(고정 문자열)를 보내므로, 현재 구현상 실제로 내부 정보가 toast 에 노출되는 경로는 없다. 그러나 미래에 backend 의 ack 포맷이 변경되거나 새로운 continuation 핸들러가 `buildContinuationErrorAck` 를 거치지 않고 직접 ack 를 구성한다면, 내부 에러 메시지가 frontend toast 에 노출될 수 있다.
- 제안: `localizeAckError` 의 fallback 경로에서 반환하는 `error` 문자열이 "고정 client-safe 문자열"이어야 함을 JSDoc 또는 테스트로 명시한다. 또는 backend 가 항상 errorCode 를 포함하도록 강제해 fallback 경로 자체를 줄인다.

---

## 요약

이번 변경은 기존에 내부 상세(최대 길이 수치, 드라이버 에러 원문, 내부 IP 등)를 client 응답에 그대로 노출하던 문제를 해결하기 위해 typed error 계층(`ExecutionError` 추상 기반 + `MessageTooLongError` 신설)과 `buildContinuationErrorAck` 보안 게이트를 도입한 것이다. 하드코딩된 시크릿, 인젝션 취약점, 인증/인가 우회, 안전하지 않은 암호화 알고리즘, 알려진 취약점이 있는 의존성 사용 등의 보안 이슈는 발견되지 않았다. 보안 관점에서 이 변경은 OWASP A05(Security Misconfiguration) 및 A09(Security Logging) 위험을 적극적으로 줄이는 방향이며, prototype 오염 방어(`hasOwnProperty.call`) 및 `serverDetail` 분리 패턴도 적절하다. 발견된 INFO 항목들은 모두 미래 확장 시 계약 위반 가능성에 대한 예방적 권고 사항으로, 현재 코드에서 실제 취약점으로 이어지는 경로는 없다.

---

## 위험도

NONE
