# 부작용(Side Effect) 리뷰

## 검증 방법
diff 게이트 + `Read`/`Grep`으로 실제 소스(`execution-event-emitter.service.ts`,
`execution-engine.service.ts`, `retry-turn.service.ts`, `websocket.service.ts`,
`terminal-error-payload.ts`, `execution.entity.ts`)를 직접 열어 다음을 독립적으로 재검증했다
(이 changeset 은 직전 라운드 `17_54_32` 의 RESOLUTION 수정분까지 포함된 최종 상태다):
- `emitExecution` 직접 호출 잔존 3곳(`execution-engine.service.ts:3017/4436/6134`)이 전부
  비종결 이벤트(`EXECUTION_STARTED`×2, `EXECUTION_MESSAGE`×1)인지 소스 대조로 확인.
- `retry-turn.service.ts` 에 `emitExecution`/`ExecutionEventType` 잔존 참조가 0건인지 grep 확인.
- `websocket.service.ts` 의 종결 감지(`TERMINAL_EXECUTION_EVENTS.has(eventType)` → `seqAllocator.release`
  + `releaseExecutionRouting`)가 `eventType` 값에만 의존하고 payload 형태와 무관함을 확인.
- 신규 value import `ExecutionStatus` 의 소스인 `execution.entity.ts` import 체인
  (`Workflow`/`Trigger`/`User` 엔티티)이 websocket 쪽을 역참조하지 않음을 확인 — 순환 확대 없음.
- `toTerminalErrorPayload` 가 매 호출마다 새 객체 리터럴을 반환함(공유 mutable 참조 aliasing 없음)을 확인.

## 발견사항

- **[INFO]** `failRetryExecution` 의 cancelled 분기에 `result.cancelledBy: 'user'` 가 신규로 실린다 — 종전엔 이 경로에서 `result` 키 자체가 없었다.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` `failRetryExecution` (`if (isCancelled) { ... cancelledBy: 'user' ... }` 블록)
  - 상세: plan(`plan/in-progress/eia-terminal-emit-facade.md`, `retry-turn-terminal-guard.md` #2 흡수)과 CHANGELOG.md 에 명시적으로 고지된 의도된 변경이다. 판별 union 이 `cancelledBy` 를 필수 필드로 만들면서 종전에 빠져 있던 필드 스레딩을 컴파일러가 드러냈다. 코드 결함은 아니지만, 이 경로로 `execution.cancelled` 를 구독하는 외부 관측자(webhook 미러/프론트엔드/webchat 위젯) 입장에서는 **이전에 없던 필드가 새로 도착하는 관측 가능한 wire 계약 변화**다 — "인터페이스 변경이 기존 소비자에 미치는 영향" 관점에서 기록해 둔다. CHANGELOG 가 "저장소 내 소비자는 `result` 부재를 `{}` 로 방어해 무해" 라고 명시했고, 직접 확인 결과 `chat-channel.dispatcher.ts` 는 `result` 를 옵셔널 체이닝/기본값으로 다뤄 크래시 경로 없음.
  - 제안: 조치 불요(이미 CHANGELOG 로 고지됨). 외부(비-저장소) webhook consumer 가 `result` 부재를 신호로 쓰고 있었다면 영향 가능 — 발표 채널이 있다면 안내 권장.

- **[INFO]** `ExecutionEventEmitter` 에 신규 value import `ExecutionStatus`(`../../executions/entities/execution.entity`)가 추가되어, 이미 `forwardRef` 순환(`websocket.service`↔`websocket.gateway`↔`execution-engine`/`retry-turn`↔`execution-event-emitter`) 위에 있는 이 파일의 모듈 의존 그래프가 한 겹 넓어진다.
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:8` (import), 사용은 `emitTerminalExecution` 함수 본문 내 `type→{eventType,status}` 매핑 리터럴
  - 상세: 코드 자체는 안전하다 — `ExecutionEventType` 과 동일하게 `ExecutionStatus.*` 참조를 **함수 호출 시점**(모듈 스코프 아님)으로 미뤄, 이 PR 이 실제로 겪은 "모듈 평가 시점에 undefined → 72 suites 실패" 를 예방하는 동일 패턴을 재사용한다. `execution.entity.ts` 의 import 체인(`Workflow`/`Trigger`/`User` — 순수 TypeORM 엔티티)이 websocket 쪽을 역참조하지 않음을 직접 확인해 순환이 새로 넓어지지 않았다.
  - 제안: 조치 불요. 향후 이 파일에 값(value) import 를 추가할 때는 동일하게 함수 스코프 지연 평가 원칙을 유지할 것.

- **[INFO]** `emitTerminalExecution` 이 시그니처를 바꾸지 않고 **신규 메서드로만** 추가됐다 — 기존 `emitExecution(executionId, eventType, payload: unknown)` 호출자(비종결 이벤트 3곳)는 무변경.
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:83-93`(`emitExecution`, 무변경) vs `:104-139`(`emitTerminalExecution`, 신규)
  - 상세: 기존 공개 메서드의 시그니처·동작이 그대로 남아 있어 하위 호환 파괴 없음. 신규 메서드가 내부적으로 `this.emitExecution(...)` 를 정확히 1회 위임 호출하므로 emit 횟수·에러 전파(try/catch 위치) 의미도 리팩터 전후 동일 — `emitCancellationEvent` 의 `try{emit}catch{warn}` 흡수 구조, `failFirstSegmentSetup`/`finalizeStalledExhausted` 등의 `persisted` 가드-후-emit 순서 모두 diff 전후로 변하지 않았다(소스 대조 확인).
  - 제안: 없음.

- **[INFO]** `review/code/2026/08/15/17_54_32/**`, `review/consistency/2026/08/15/17_20_28/**` 신규 파일 생성은 이 PR 착수 전/후 의무 `--impl-prep` consistency-check 및 `/ai-review` 실행의 정상 산출물이며, CLAUDE.md 정보 저장 규약(`review/code/**`, `review/consistency/**`)과 일치한다. 예상치 못한 파일시스템 부작용이 아니다.
  - 위치: `review/code/2026/08/15/17_54_32/*`, `review/consistency/2026/08/15/17_20_28/*`
  - 상세/제안: 조치 불요.

## 검증한 항목 (부작용 없음 확인)

- **전역 변수**: `emitTerminalExecution` 내부의 `type→{eventType,status}` 매핑 객체는 함수 본문 지역 변수로 매 호출마다 새로 생성되며, 모듈 스코프에 상태를 남기지 않는다. 신규 전역 변수 도입 없음.
- **환경 변수**: 읽기/쓰기 변경 없음.
- **네트워크 호출**: 신규 외부 호출 없음. 기존 WS emit(`websocketService.emitExecutionEvent`) 경로만 재사용.
- **이벤트/콜백**: `emitTerminalExecution` → `emitExecution` → `websocketService.emitExecutionEvent` 호출 체인이 그대로이며, 종결 감지·라우팅 해제(`TERMINAL_EXECUTION_EVENTS.has(eventType)`)는 `eventType` enum 값에만 의존해 payload 조립 위치 변경의 영향을 받지 않는다(`websocket.service.ts:335,477-479` 확인).
- **객체 aliasing**: `wire.error = payload.error`(및 `toTerminalErrorPayload` 반환값)가 참조를 그대로 대입하지만, `toTerminalErrorPayload` 는 매 호출마다 새 객체 리터럴을 반환하므로 emit 이후 호출부가 그 객체를 재사용/변형해 emit 된 데이터가 사후 오염될 공유 mutable 상태 경로는 없다.
- **호출부 이관 완전성**: 종결 3종(`EXECUTION_COMPLETED`/`FAILED`/`CANCELLED`) `emitExecution` 직접 호출이 저장소 전체에서 0곳임을 grep 으로 재확인. 남은 3곳(`EXECUTION_STARTED`×2, `EXECUTION_MESSAGE`×1)은 비종결 이벤트로 파사드 범위 밖 서술과 일치.
- **plan/review 문서 diff(파일 7~31)**: 코드 실행 경로에 영향 없는 문서·추적 자료이며, 위에서 다룬 신규 파일 생성 항목 외에 별도 부작용 없음.

## 요약

핵심 변경은 `ExecutionEventEmitter.emitTerminalExecution` 판별 union 파사드를 **신규 메서드로 추가**하고 종결 3종(`EXECUTION_COMPLETED`/`FAILED`/`CANCELLED`) 직접 호출 11곳을 그쪽으로 이관한 것이다. 기존 `emitExecution` 시그니처와 비종결 이벤트 호출부(STARTED/MESSAGE)는 무변경이며, WS 종결 감지·라우팅 자동 해제 로직도 `eventType` 값에만 의존해 영향이 없다. 유일하게 관측 가능한 실제 동작 변화는 `retry-turn.service.ts` `failRetryExecution` 의 cancelled 경로에 `result.cancelledBy: 'user'` 가 새로 실리는 것인데, plan·CHANGELOG 가 이를 결함 흡수로 명시 고지했고 저장소 내 소비자(`chat-channel.dispatcher.ts`)는 `result` 부재를 방어적으로 처리해 무해함을 직접 확인했다. 신규 value import(`ExecutionStatus`)는 기존 ES-module 순환 위상 위에 있지만 함수 스코프 지연 평가로 안전하게 처리됐고 import 체인 상 역참조도 없다. CRITICAL/WARNING 급 의도치 않은 부작용은 발견되지 않았다.

## 위험도

LOW
