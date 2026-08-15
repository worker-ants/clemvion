# 성능(Performance) 리뷰

## 검토 방법

전체 27개 코드 파일(38개 변경 파일 중 `codebase/**`) 중 25개는 `websocket.service.ts` 가
export 하던 enum/type 선언을 신설 의존성-프리 모듈 `websocket-events.types.ts` 로 옮기고
import 경로만 갱신한 **기계적 1:1 치환**이다. 실제 런타임 동작이 바뀌는지 여부를 판별하기
위해 `git diff origin/main...HEAD --stat -- codebase/` 로 전체 목록을 실측하고,
`execution-event-emitter.service.ts`(유일하게 순수 import 치환을 넘어서는 diff)와 신설
`websocket-events.types.ts` 전문을 `Read` 로 직접 열어 대조했다.

## 발견사항

- **[INFO]** `TERMINAL_SHAPE` 를 함수-스코프 리터럴에서 모듈-스코프 `const` 로 승격 — 미세하지만 실질적인 할당 감소, 회귀 아님
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:71` (선언), `:143` (사용부, `emitTerminalExecution`)
  - 상세: 변경 전에는 `emitTerminalExecution` 호출마다 `{completed: {...}, failed: {...}, cancelled: {...}}[payload.type]` 형태의 3-키 객체 리터럴(각 키마다 2필드 하위 객체 포함, 총 9개 프로퍼티)을 새로 할당한 뒤 즉시 인덱싱해 버렸다. 이번 diff 는 이를 모듈 로드 시 1회만 생성되는 `TERMINAL_SHAPE` 상수로 옮기고, 호출부는 `TERMINAL_SHAPE[payload.type]` 로 참조만 한다. 종결 이벤트(`completed`/`failed`/`cancelled`) 는 execution 당 정확히 1회만 발행되므로 이 경로 자체가 hot loop 는 아니지만, 불필요한 매 호출 객체 생성을 제거했다는 점에서 방향은 개선이다.
  - 이 승격이 안전한 이유(성능과 무관하지만 왜 회귀가 아닌지의 근거): 이 상수가 참조하는 `ExecutionEventType`/`ExecutionStatus` 가 이제 순환에 참여하지 않는 `websocket-events.types.ts`(import 0줄)에서 오므로, 모듈 평가 시점에 안전하게 읽힌다 — #1174 가 겪은 "모듈 스코프 파생이 `undefined` 로 평가"되는 문제의 재발 조건(ES-module 순환 위에서 값을 모듈 스코프로 끌어올림)이 이번엔 성립하지 않는다.
  - 제안: 조치 불필요. 참고용 기록.

- **[INFO]** 나머지 24개 코드 파일은 순수 import 경로 치환으로, 런타임 성능에 영향이 없다
  - 위치: `chat-channel.dispatcher.ts`, `ai-turn-orchestrator.service.ts`, `button-interaction.service.ts`, `execution-engine.service.ts`, `form-interaction.service.ts`, `background-execution.processor.ts`, `retry-turn.service.ts`, `interaction-stream.controller.ts`, `notification-fanout.service.ts`, `sse-adapter.service.ts`, `embedding.service.ts`, `graph-extraction.service.ts`, `websocket.gateway.ts`, `ai-turn-executor.ts` 등 (전부 `import { X } from '../websocket/websocket.service'` → `import { X } from '../websocket/websocket-events.types'` 형태, `git diff --stat` 상 `+2/-2`~`+6/-6` 라인 규모)
  - 상세: TypeScript/Node 모듈 시스템에서 import 경로 변경은 컴파일·번들 타임에만 영향을 주며, `websocket.service.ts` 가 해당 심볼을 그대로 re-export 하므로(예: `export { ExecutionEventType, NodeEventType, BackgroundRunEventType, NotificationEventType }`) 신·구 경로 모두 **같은 런타임 객체 참조**를 반환한다. enum/interface/type alias 는 값 복제가 아니라 참조이므로 이중 정의·이중 메모리 점유가 발생하지 않는다. N+1, 블로킹 I/O, 캐싱, 자료구조 선택, 지연 로딩 등 다른 관점에서 검토할 신규 로직도 이 파일들엔 없다.
  - 제안: 조치 불필요.

- **[INFO]** 신설 `websocket-events.types.ts` 는 값/타입 선언만 담은 leaf 모듈로, 성능 표면이 없다
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts` (전체 265줄)
  - 상세: `export interface`/`export enum`/`export type` 선언만 존재하고 함수·계산·I/O·루프가 전혀 없다. import 가 0줄이라 모듈 초기화 비용도 enum 객체 리터럴 생성(상수 개수 고정, O(1)) 수준으로 미미하다.
  - 제안: 조치 불필요.

- **[INFO]** `websocket.service.ts` 자체는 이번 diff 로 ~300줄이 빠졌지만(enum/interface 선언 이동), 클래스 구현 로직(캐시·payload 새니타이징·fan-out 등)은 그대로 남아 성능 특성 불변
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` (diff stat: `287 +----`, 순수 삭제+re-export 위주)
  - 상세: `git diff --stat` 상 이 파일만 유일하게 대규모 라인 삭제(-287)를 보이지만, 이는 enum/interface 선언 블록이 신규 모듈로 이동한 것이지 `emitExecutionEvent`/`sanitizePayloadForWs`/`attachRoutingContext` 등 실제 실행 로직 삭제가 아니다(다른 리뷰어들의 security/dependency 리포트가 이미 실측 확인). 성능 프로파일에 영향 없음.
  - 제안: 조치 불필요.

## 요약

이번 변경은 `websocket.service.ts` 가 겸하던 enum/type 선언을 의존성-프리 모듈로 추출하고 25개 소비 지점의 import 경로를 재배선한 **순수 컴파일타임 리팩터**로, 알고리즘 복잡도·N+1·메모리 할당·캐싱·블로킹 I/O·자료구조·지연 로딩 등 8개 관점 중 어느 하나도 런타임 동작을 바꾸지 않는다. 유일한 예외인 `execution-event-emitter.service.ts` 의 `TERMINAL_SHAPE` 모듈-스코프 상수화는 종결 이벤트 발행 시 매 호출마다 만들던 소규모 객체 리터럴 할당을 모듈 로드 1회로 줄인 것으로, 방향상 성능 개선(hot path 도 아니라 체감 영향은 미미)이며 회귀 요소가 아니다. re-export 를 통해 신·구 import 경로 모두 동일 런타임 참조를 공유하므로 이중 메모리·초기화 비용도 없다.

## 위험도
NONE
