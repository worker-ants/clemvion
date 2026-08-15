# 아키텍처 리뷰 — 종결 이벤트 emit 타입 파사드 (`eia-terminal-emit-facade`)

## 발견사항

- **[WARNING]** 기존 ES-module 순환(`websocket.service` ↔ `websocket.gateway` ↔ `execution-engine`/`retry-turn` ↔ `execution-event-emitter`)을 근본 해소가 아니라 "호출 시점 지연 평가"로 한 번 더 우회한다
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:91-108` (`emitTerminalExecution` 내부 주석 + type→{eventType,status} 매핑 객체 리터럴), 순환의 실제 경로는 `websocket.gateway.ts` 가 `ExecutionEngineService`/`RetryTurnService` 를 import 하고(`codebase/backend/src/modules/websocket/websocket.gateway.ts:14-15`), 이 둘이 다시 `ExecutionEventEmitter` 를 주입받으며, `execution-event-emitter.service.ts:1-7` 가 `websocket.service.ts` 에서 `ExecutionEventType` enum 을 정적 import 함으로써 고리가 닫힌다.
  - 상세: 생성자의 `forwardRef(() => WebsocketService)`(같은 파일 53-59줄, 이번 diff 이전부터 존재)와 이번에 추가된 "모듈 스코프에서 파생하지 않는다" 주석은 같은 순환 위상의 증상을 각각 DI 계층과 값(enum) 계층에서 우회하는 두 번째 인스턴스다. 실제로 `ExecutionEventType` 를 모듈 스코프 상수로 옮겼을 때 72 suite 가 `Cannot read properties of undefined` 로 깨졌다는 사실(plan 문서에도 기록)은 이 순환이 `tsc` 로는 안 잡히고 런타임 평가 순서에 의존하는 실질적으로 취약한 구조임을 보여준다. 이번 PR 은 그 취약성을 문서화하고 정확히 회피했지만(진단 자체는 정밀함 — `ExecutionStatus` 는 순환 밖이라 모듈 스코프 import 가 안전하다는 것까지 확인했다), 근본 원인(서비스 구현 파일이 순수 타입/enum 을 함께 export 해 순환의 매개체가 됨)은 그대로 남아 향후 유사 리팩터마다 같은 함정에 걸릴 위험을 다음 작업자에게 넘긴다.
  - 제안: `ExecutionEventType`/`NodeEventType`/`ExecutionRoutingContext` 처럼 런타임 값이 필요한 선언들을 `websocket.service.ts`(구현)와 분리된 의존성-프리 모듈(예: `websocket-events.types.ts`)로 추출해, event-emitter/engine 쪽이 서비스 구현이 아니라 그 types 모듈만 import 하도록 순환을 그래프 차원에서 끊는 후속 작업을 백로그에 등재할 것.

- **[INFO]** `retry-turn.service.spec.ts` 가 동일한 `TYPE_TO_EVENT` 되매핑 상수를 두 `describe` 블록에 중복 정의한다
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:788-792`(`emittedTypesOuter`) 및 `:963-967`(`emittedTypes`) — 두 정의가 완전히 동일한 리터럴.
  - 상세: 파사드 도입으로 각 테스트가 "어떤 종결 타입이 나갔나"를 원래 이벤트 enum 으로 되매핑해야 하는 필요성 자체는 타당하지만(파사드 wire 형태 검증은 emitter 자신의 spec 으로 위임한 것은 좋은 테스트 경계 설계), 매핑 테이블을 파일 스코프 상수 하나로 두지 않고 두 describe 에서 반복 정의해 향후 `TerminalEventPayload.type` 이 바뀌면 두 곳을 동시에 고쳐야 한다.
  - 제안: `TYPE_TO_EVENT` 를 파일 최상단(또는 공용 테스트 헬퍼)으로 한 번만 선언하고 두 `emittedTypes*` 헬퍼가 공유하도록 정리.

- **[INFO]** `ExecutionEventEmitter` 가 순수 이벤트 전달 파사드에서 도메인 상태 파생 책임까지 흡수했다 — 문서화된 의도적 확장이나 레이어 경계는 주의 필요
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:8`(`ExecutionStatus` — TypeORM 엔티티 모듈에서 enum import) 및 `emitTerminalExecution` 본문(95-120줄, `status` 파생 + `result.cancelledBy` 중첩 조립 + `error` 키 유무 결정).
  - 상세: 파일 자신의 옛 JSDoc은 "본 facade 는 현재로선 WebsocketService 로의 thin wrapper"라고 명시했는데, 이번 변경으로 파사드가 `type`→`status`/이벤트명 매핑과 §6.5 필드 집합의 wire 조립(중첩·키 생략)까지 담당하게 됐다. 11곳에 흩어져 있던 조립 로직을 한 곳으로 모은 것은 결함 클래스를 컴파일 타임에 막는 명확한 이득이 있고 JSDoc 도 그 트레이드오프를 정직하게 설명하므로 위반으로 보진 않지만, "이벤트 전송 계층"이 "도메인 상태 파생 로직"을 갖게 된 경계 이동이라는 점은 이후 이 파사드에 또 다른 도메인 지식이 얹히지 않도록 리뷰 시 주의가 필요하다.
  - 제안: 조치 불요(설계 의도가 명확히 문서화됨). 다만 향후 `emitTerminalExecution` 에 도메인 로직이 더 붙는다면, 그 시점엔 "wire 조립"과 "채널 전송"을 분리하는 리팩터(예: 순수 함수 `toTerminalWirePayload(payload): {eventType, wire}` 를 분리해 emitter 는 오직 전송만 담당)를 고려할 것.

## 긍정적으로 평가한 설계 결정 (참고)

- **판별 union + 파사드**: `TerminalEventPayload`(completed/failed/cancelled)가 각 variant 의 필수 필드(`durationMs`/`error`/`cancelledBy`)를 타입 수준에서 강제해, 이 세션에서 반복된 "필드 하나를 호출부마다 손으로 스레딩하다 한 곳 누락" 결함 클래스(#1170/#1171/#1172)를 컴파일 타임 검사로 옮겼다. 11개 직접 호출부(`execution-engine.service.ts` 8곳 + `retry-turn.service.ts` 4곳, `emitCancellationEvent` 경유 5곳 포함)가 전수 마이그레이션됐고, `execution-engine.service.ts` 에 남은 3개의 `emitExecution` 직접 호출(`EXECUTION_STARTED` ×2, `EXECUTION_MESSAGE` ×1 — 비종결 이벤트)은 파사드 범위 밖으로 정확히 남겨져 있어 모듈 경계가 흐려지지 않았다(`execution-engine.service.ts:3017`, `:4436`, `:6134` 확인).
- **테스트 책임 분리**: `execution-event-emitter.service.spec.ts` 가 wire 형태(엔벨로프·중첩·키 부재)를 전담 고정하고, `retry-turn.service.spec.ts` 는 "어떤 종결 타입으로 어떤 필드를 넘겼는가"만 검증하도록 재작성됐다 — 동일 계약을 여러 소비자 테스트가 중복 단언하던 종전 패턴보다 결합도가 낮다.
- **닫힌 순환 재사용 (`emitCancellationEvent`)**: `execution-engine.service.ts` 의 기존 헬퍼가 내부적으로 새 파사드를 호출하도록 자연스럽게 얹혀, cancel 5개 호출부가 이중 계층(도메인 헬퍼 → 타입 파사드 → 전송)으로 잘 조직됐다.

## 요약

핵심 변경은 `ExecutionEventEmitter.emitTerminalExecution` 판별 union 파사드 도입으로, 반복적으로 발생한 "payload 필드 누락" 결함 클래스를 런타임 검증에서 컴파일 타임 검증으로 옮기는 정당한 아키텍처 개선이다. 마이그레이션은 종결 3종에만 정확히 범위를 좁혔고(비종결 이벤트는 여전히 `emitExecution` 직접 호출로 남음), 테스트도 계층별 책임(wire 형태 vs 호출 의도)로 잘 분리됐다. 유일하게 주목할 점은 이 파사드가 올라앉은 기존 ES-module 순환(`websocket.service`↔`gateway`↔`execution-engine`)을 이번에도 근본 해소 대신 지연 평가로 우회했다는 것 — 진단은 정밀했지만 부채는 그대로 다음 리팩터로 이월된다. CRITICAL 급 구조 결함은 없다.

## 위험도

LOW
