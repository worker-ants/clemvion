# 보안(Security) 리뷰

## 발견사항

### 에러 처리 — 정보 누출 차단 (긍정적 보안 개선)

- **[INFO]** `buildContinuationErrorAck` 리팩터링이 핵심 보안 게이트 역할을 한다
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` `buildContinuationErrorAck`
  - 상세: 기존 구현은 `error instanceof Error ? error.message : fallbackMessage` 로 임의 `Error` 의 내부 message(SQL 원문, 내부 IP, 스택 힌트 등)를 클라이언트에 그대로 전달했다. 변경 후에는 `ExecutionError` 계층만 `message+code` 를 surface 하고, 그 외 모든 throw 는 고정 generic fallback + `EXECUTION_INTERNAL_ERROR` 로 축약하며 원본은 `logger.warn` 으로만 기록한다. 이는 OWASP A05(Security Misconfiguration) / A09(Security Logging and Monitoring) 관점에서 명확한 개선이다.
  - 제안: 없음. 의도적이고 올바른 방향이다.

- **[INFO]** `MessageTooLongError` 의 `serverDetail` 설계가 수치 누출을 방지한다
  - 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` `MessageTooLongError` 생성자
  - 상세: 실제 메시지 길이(`actualLength`)와 한도(`maxLength`)를 `serverDetail` 에만 기록하고 `message` 에는 고정 문자열만 담는다. 공격자가 WS ack 를 파싱해도 내부 제한 수치를 추론할 수 없다.
  - 제안: 없음.

### 에러 처리 — `serverDetail` 서버 로그 경로 검증 필요

- **[WARNING]** `ExecutionError.serverDetail` 이 logger 외 경로로 누출될 수 있는 코드 경로가 현재 변경 범위 밖에 남아 있을 가능성
  - 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` — `ExecutionError` 추상 클래스; `InvalidExecutionStateError.detail` / `RetryLastTurnError.detail` deprecated getter
  - 상세: `serverDetail` 은 `readonly` 공개 속성으로 선언되어 있다. `buildContinuationErrorAck` 는 `serverDetail` 을 로그에만 기록하도록 올바르게 구현되어 있으나, `ExecutionError` 를 catch 하는 다른 핸들러(REST 컨트롤러, 다른 WS 핸들러, 글로벌 필터 등)가 `error.serverDetail` 을 응답 body 에 포함시킬 경우 누출이 발생한다. 또한 deprecated `detail` getter 는 `serverDetail` 과 동일 값을 노출하므로, 기존 코드가 `err.detail` 을 응답에 포함하던 패턴이 있었다면 마이그레이션 기간 중 누출 위험이 유지된다.
  - 제안: (1) 전체 코드베이스에서 `err.detail` / `err.serverDetail` 을 응답 body / ack 에 직접 포함하는 패턴이 없는지 검색·감사한다. (2) deprecated `detail` getter 를 빠르게 제거하여 잠재적 혼용 경로를 닫는다. (3) NestJS 글로벌 예외 필터가 `ExecutionError` 인스턴스를 처리하는 방식에 `serverDetail` 미포함 여부를 명시적으로 테스트로 보증한다.

### 입력 검증 — 메시지 길이 검증 위치

- **[INFO]** 길이 검증이 publisher 측(execution-engine service)에서만 수행되고 gateway 진입점에서는 수행되지 않는다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `continueAiConversation`; `codebase/backend/src/modules/websocket/websocket.gateway.ts` `handleSubmitMessage`
  - 상세: 현재 길이 초과 시 `MessageTooLongError` 를 throw 하고 gateway 의 `buildContinuationErrorAck` 가 이를 catch 해 클라이언트에 안전하게 응답한다. 기능적으로는 올바르다. 다만 gateway 수준에서도 조기에 검증하면 engine service 까지 도달하지 않아도 되어 대용량 페이로드로 인한 불필요한 처리 비용을 줄일 수 있다.
  - 제안: 필수는 아니나, WS 핸들러(`handleSubmitMessage`) 진입부에 message 길이 사전 체크를 추가하는 defense-in-depth 조치를 고려한다.

### 클라이언트 측 에러 코드 처리 — 프로토타입 오염 방어

- **[INFO]** `getExecutionInteractionErrorI18nKey` 에서 `Object.prototype.hasOwnProperty.call` 을 사용하여 프로토타입 오염 공격을 방어한다
  - 위치: `codebase/frontend/src/lib/websocket/execution-error-codes.ts`
  - 상세: 백엔드가 보내는 `errorCode` 에 `"toString"`, `"constructor"` 등 프로토타입 키가 포함될 경우 단순 `obj[key]` 접근은 의도치 않은 값을 반환할 수 있다. 테스트도 이를 명시적으로 검증하고 있다. 올바른 방어 구현이다.
  - 제안: 없음.

### 에러 처리 — 프론트엔드 fallback 경로 잔여 위험

- **[WARNING]** `localizeAckError` 에서 매핑 없는 `errorCode` 는 백엔드의 `error` 문자열을 그대로 toast 로 표시한다
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-interaction-commands.ts` `localizeAckError` 함수
  - 상세: 코드 주석에도 "backend 는 typed error → 고정 client-safe message, plain error → generic fallback 만 보내므로 `error` 문자열 자체에 내부 정보 누출은 없다"고 기재되어 있다. 이 불변식은 `buildContinuationErrorAck` 가 올바르게 구현된 경우에만 성립한다. 만약 다른 코드 경로(미래에 추가되는 새 continuation handler 등)가 `buildContinuationErrorAck` 를 거치지 않고 직접 `error.message` 를 포함한 ack 를 전송한다면, 프론트엔드 fallback 경로가 내부 메시지를 그대로 사용자에게 노출하는 정보 누출 위험이 생긴다.
  - 제안: 모든 continuation ack 생성 경로가 반드시 `buildContinuationErrorAck` 를 통하도록 아키텍처 레벨에서 강제하거나 테스트로 보증하고, 신규 handler 추가 시 체크리스트에 이 게이트를 명시한다.

### 하드코딩된 시크릿 / 인증·인가 / 인젝션 / 암호화

- **[INFO]** 변경 범위 내에 하드코딩된 시크릿, 인증·인가 로직 변경, SQL/커맨드/XSS 인젝션 취약점, 암호화 알고리즘 변경은 없다. 해당 관점에서 위험 없음.

---

## 요약

이번 변경은 execution engine continuation ack 경계에서 내부 에러 메시지가 클라이언트로 누출되던 구조적 결함을 해소하는 보안 개선 리팩터링이다. `ExecutionError` 추상 계층 도입, `buildContinuationErrorAck` 의 typed/non-typed 분기 게이트, `MessageTooLongError` 의 수치 분리 설계, 프론트엔드의 `hasOwnProperty` 기반 화이트리스트 매핑 모두 올바른 방향이다. 주요 잔여 위험은 두 가지다: (1) `serverDetail` 이 `public readonly` 로 노출되어 있어 `buildContinuationErrorAck` 외 다른 catch 경로가 이를 응답에 포함할 수 있는 잠재적 누출 경로, (2) 프론트엔드 fallback 이 백엔드의 "모든 ack 는 client-safe message" 불변식에 의존하므로 이 불변식이 깨질 경우 정보 누출이 발생할 수 있는 구조적 의존성이다. 두 위험 모두 현재 구현 범위에서는 통제되고 있으나, 미래 확장 시 주의가 필요하다.

## 위험도

LOW
