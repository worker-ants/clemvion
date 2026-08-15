# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 종결 emit 파사드 도입으로 `failRetryExecution` cancelled 경로의 wire payload 에 `result.cancelledBy: 'user'` 필드가 신규로 실린다 — 종전엔 이 경로에서 `result` 자체가 없었다(원 코드 삼항 `...(!isCancelled ? {error:...} : {})` 만 있고 `cancelledBy` 스레딩 없음).
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` — `failRetryExecution` (게이트 981~995, `if (isCancelled) { ... cancelledBy: 'user' ... }`)
  - 상세: 의도된 수정(plan `eia-terminal-emit-facade.md`, `retry-turn-terminal-guard.md` #2 흡수)이며 spec §6 `result.cancelledBy` 표와도 정합한다. 다만 이 경로를 통해 WS 로 종결 이벤트를 수신하는 **외부 관측자(webhook 페이로드 미러·프론트엔드·webchat 위젯)** 입장에서는 이 특정 취소 경로에 한해 이전엔 없던 필드가 새로 도착하는 **관측 가능한 wire 계약 변화**다. 코드 자체는 정상이나, 리뷰 관점상 "인터페이스 변경이 기존 소비자에 미치는 영향"으로 기록해 둔다 — 소비자가 `result.cancelledBy` 존재를 조건부로 다루고 있었다면(예: `in` 체크로 분기) 이번 변경으로 그 분기가 새로 진입한다.
  - 제안: 별도 조치 불요(의도된 결함 흡수). 다만 웹훅/프론트 소비 코드 중 이 필드의 "부재"를 신호로 쓰는 곳이 있는지 한 번 grep 확인 권장.

- **[INFO]** `ExecutionEventEmitter` 에 신규 value import `ExecutionStatus`(`../../executions/entities/execution.entity`)가 추가되어, 이미 `forwardRef` 순환(ws.service↔gateway↔event-emitter) 위에 있는 이 파일의 모듈 의존 그래프가 한 겹 더 넓어진다.
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:8` (import), 사용처는 `emitTerminalExecution` 함수 본문(게이트 95~108)
  - 상세: 코드 자체는 안전하다 — `ExecutionEventType`와 마찬가지로 `ExecutionStatus.COMPLETED/FAILED/CANCELLED` 참조를 **함수 호출 시점**(모듈 스코프 아님)으로 미뤄뒀고, 이는 이 PR 이 이미 겪은 "모듈 평가 시점에 undefined → 72 suites 실패"를 예방하는 동일 패턴이다. 실측으로 `execution.entity.ts` 의 import 체인(`Workflow`/`Trigger`/`User` entity, 순수 TypeORM 엔티티)도 websocket 쪽으로 역참조하지 않음을 확인했다. Critical 은 아니지만, 향후 이 파일에 값(value) import 를 추가할 때는 반드시 함수 스코프 지연 평가 원칙을 유지해야 한다는 점을 남겨 둔다.
  - 제안: 조치 불요. 향후 유지보수 시 동일 원칙(모듈 스코프에서 파생 금지) 유지.

- **[INFO]** `review/consistency/2026/08/15/17_20_28/**` (SUMMARY.md, meta.json, _retry_state.json, 5개 checker 산출물) 신규 파일 생성은 이 PR 착수 전 의무 `--impl-prep` consistency-check 실행의 정상 산출물이며, CLAUDE.md 정보 저장 규약과 일치한다. 예상치 못한 파일시스템 부작용이 아니다.
  - 위치: `review/consistency/2026/08/15/17_20_28/*`
  - 상세/제안: 조치 불요.

## 검증한 항목 (부작용 없음 확인)

- **시그니처 변경 없음**: `emitExecution(executionId, eventType, payload: unknown)` 은 그대로다. `emitTerminalExecution(executionId, payload: TerminalEventPayload)` 은 **신규 추가 메서드**라 기존 호출자(`emitExecution` 직접 호출부 3곳 — `EXECUTION_STARTED` 2곳, `EXECUTION_MESSAGE` 1곳, `execution-engine.service.ts:3017/4436/6134`)는 전혀 건드리지 않았다. "직접 호출 11곳 → 0곳"이 종결 이벤트(COMPLETED/FAILED/CANCELLED) 한정으로 정확함을 grep 으로 확인.
- **이벤트/콜백 의미 불변**: `emitTerminalExecution` 은 내부적으로 동일한 `this.emitExecution(executionId, eventType, wire)` → `websocketService.emitExecutionEvent` 를 정확히 1회 호출한다. `websocket.service.ts` 의 종결 이벤트 감지·`releaseExecutionRouting`/`seqAllocator.release` 자동 트리거는 `eventType` 값(`TERMINAL_EXECUTION_EVENTS.has(eventType)`)에만 의존하며, 파사드가 넘기는 `eventType` 은 종전과 동일한 enum 값이라 이 로직에 영향 없음.
- **전역 상태/전역 변수**: `emitTerminalExecution` 내부의 `type → {eventType, status}` 매핑 객체는 함수 본문 지역 변수이며 모듈 스코프에 존재하지 않는다. 새 전역 변수 도입 없음.
- **환경 변수/네트워크 호출**: 변경 없음. 기존 WS emit 경로만 재사용.
- **wire 형태 계약 유지**: `emitTerminalExecution` 이 조립하는 `wire` 객체가 각 호출부의 원래 조립(예: `execution-engine.service.ts` FAILED/CANCELLED/COMPLETED 6개 지점, `retry-turn.service.ts` 2개 지점)과 필드 단위로 동일함을 diff 대조로 확인 — `cancelledBy` 신규 추가(위 INFO 항목, 의도된 결함 흡수) 외에는 payload shape 변화 없음. `error` 키 조건부 부재(`if (payload.error) wire.error = ...`)도 종전 스프레드 조건(`...(opts.error ? {error} : {})`)과 동치.
- **테스트 변경(파일 1, 4)**: 신규 회귀 테스트 4건 + 기존 테스트의 mock 재배선(`emitExecution` → `emitTerminalExecution`)뿐이며, 공유 fixture/전역 mock 오염 없음(각 `beforeEach` 에서 새 `jest.fn()` 재생성).

## 요약

핵심 변경은 `ExecutionEventEmitter.emitTerminalExecution` 이라는 신규 판별 union 파사드를 추가하고 8개 호출부(`execution-engine.service.ts` 6곳, `retry-turn.service.ts` 2곳)를 그쪽으로 옮긴 순수 리팩터다. 기존 `emitExecution` 시그니처·비-종결 이벤트 호출부(STARTED/MESSAGE)는 무변경이며, WS 이벤트 감지·라우팅 자동 해제 로직도 동일 `eventType` 값에 의존하므로 영향 없다. 유일하게 관측 가능한 동작 변화는 `retry-turn.service.ts` 의 `failRetryExecution` cancelled 경로에 `result.cancelledBy: 'user'` 가 새로 실리는 것인데, 이는 plan/spec 이 명시적으로 추적·문서화한 의도된 결함 흡수(§6 표와 정합)이며 우연한 부작용이 아니다. 모듈 결합도(신규 `ExecutionStatus` value import)는 순환 import 취약 지점 위에 있어 주의가 필요하지만, 이미 같은 세션에서 겪은 "모듈 스코프 undefined" 결함과 동일한 예방 패턴(호출 시점 지연 평가)이 적용돼 있어 실질 위험은 낮다. `review/consistency/**` 신규 파일들은 프로젝트 규약상 정상 산출물이다.

## 위험도

LOW
