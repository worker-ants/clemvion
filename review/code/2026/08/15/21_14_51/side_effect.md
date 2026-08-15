# 부작용(Side Effect) 리뷰

## 검토 방법

`origin/main...HEAD` 실제 diff(27개 backend 소스/spec 파일, `git diff --stat` 로 실측)를 대상으로
직접 소스(`Read`)를 열어 대조했다. 이 브랜치는 이미 4라운드의 `/ai-review`
(`19_27_37`→`20_05_17`→`20_27_08`→`20_50_49`, 각 라운드 side_effect 관점 포함)를 거쳤고, 매 라운드
지적 사항이 실제로 반영됐는지를 코드 레벨에서 재확인하는 데 집중했다. 프롬프트에 실린 나머지 파일들
(`plan/**`, `review/**` 다수)은 프로세스 산출물(마크다운/JSON)이라 런타임 부작용 표면이 아니다.

## 발견사항

- **[INFO]** `TERMINAL_SHAPE` 가 함수-지역 리터럴에서 모듈 스코프 공유 상수로 승격됨 — 쓰기 경로 없음, 이미 3라운드 전 지적·확인된 항목
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts` (`TERMINAL_SHAPE` 선언부, `emitTerminalExecution` 메서드)
  - 상세: `{eventType, status}` 매핑이 호출마다 새로 만들던 지역 리터럴에서 모듈 로드 시 1회 생성되는 `as const` 객체로 바뀌어, 이제 모든 execution·모든 request 가 같은 참조를 공유해서 읽는다. 직접 열람 결과 이 diff 안에서 이 객체에 대한 쓰기 접근은 없다 — 유일한 사용은 `const { eventType, status } = TERMINAL_SHAPE[payload.type]` (구조 분해, read-only). `Object.freeze` 는 적용돼 있지 않아 런타임 레벨 봉인은 아니지만, 타입 우회(`as any`) 없이는 접근할 수 없는 표면이라 실질 위험은 낮다. 이 변경이 안전한 이유는 참조하는 `ExecutionEventType`/`ExecutionStatus` 의 출처가 import 0줄인 `websocket-events.types.ts` 로 옮겨져 더 이상 ES-module 순환(`websocket.service ↔ gateway ↔ execution-engine/retry-turn ↔ event-emitter`) 위에 있지 않기 때문이며, 이 사실은 신설 가드(`websocket-events.types.spec.ts`)가 정적으로 고정한다.
  - 제안: 조치 불요. 이미 20_27_08 라운드에서 같은 항목이 INFO 로 지적·처분됐고 이번 라운드에서도 재확인 결과 동일하게 안전.

- **[INFO]** 하위호환 re-export facade — 12개 값/타입 export 표면이 정확히 보존됨 (인터페이스 파괴 없음, 직접 대조 확인)
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:14-46`
  - 상세: `websocket.service.ts` 는 `websocket-events.types.ts` 에서 값 4종(`ExecutionEventType`/`NodeEventType`/`BackgroundRunEventType`/`NotificationEventType`)·타입 8종(`ExecutionChannelEvent`/`ChatChannelRoutingInfo`/`ExecutionRoutingContext`/`ToolCallStartedPayload`/`UserMessagePayload`/`ToolCallCompletedPayload`/`NotificationNewPayload`/`KbEventType`)을 그대로 `export {...}`/`export type {...}` 로 재노출한다. `websocket-events.types.spec.ts` 의 `EXPECTED_EXPORTS`(12개) 목록과 소스를 직접 대조해 1:1 일치를 확인했다. `WebsocketService` 클래스 본문(메서드 시그니처·`MAX_SANITIZE_DEPTH`·`sanitizePayloadForWs` 등 구현 세부)은 이 diff 에서 전혀 변경되지 않았다. `grep` 으로 확인한 결과, `websocket.service` 경로에서 값으로 남아 있는 import 는 전부 `WebsocketService`(DI 클래스) 하나뿐이며 — 이는 신규 가드가 "서비스 주입에는 클래스 import 가 불가피하다"는 근거로 명시적으로 허용한 유일한 예외다. enum/타입 값이 옛 경로로 새는 잔여 소비처는 없음을 직접 재현으로 확인했다.
  - 제안: 없음 — 하위호환 유지가 의도대로 동작.

- **[INFO]** 신규 회귀 가드(`websocket-events.types.spec.ts`)가 `src/` 전체를 재귀 순회하며 매 파일을 TS 파서로 파싱 — 프로덕션 런타임과 무관한 test-only 읽기 전용 I/O
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts:207-228`(`allTsFiles`/`collectOffenders`)
  - 상세: `fs.readdirSync`/`fs.readFileSync` 로 `SRC_ROOT`(`codebase/backend/src`) 하위 `.ts` 전부를 열어 module specifier 를 추출한다. 쓰기·삭제·네트워크 호출은 코드 전체에 없음을 직접 확인했다(`fs.existsSync` 1건은 allowlist 파일 존재 확인용). Jest 테스트 프로세스 안에서만 실행되므로 프로덕션 부작용 표면이 아니다.
  - 제안: 없음.

- **[NONE]** 24개 backend 소스/spec 파일의 import 경로 전환(`websocket.service` → `websocket-events.types`)은 함수/메서드 시그니처·이벤트 emit 호출부·전역 변수·파일시스템·네트워크·환경변수 어디에도 영향 없음
  - 상세: `git diff origin/main...HEAD --stat -- codebase/` 로 실측한 27개 파일 중, `websocket-events.types.ts`(신규)·`websocket-events.types.spec.ts`(신규)·`websocket.service.ts`(re-export 재구성)·`execution-event-emitter.service.ts`(`TERMINAL_SHAPE`, 위 항목) 4개를 제외한 나머지 23개(`chat-channel.dispatcher.ts`, `ai-turn-orchestrator.service.ts`, `button-interaction.service.ts`, `execution-engine.service.ts`, `form-interaction.service.ts`, `background-execution.processor.ts`, `retry-turn.service.ts`, `interaction-stream.controller.ts`, `notification-fanout.service.ts`, `sse-adapter.service.ts`, `embedding.service.ts`, `graph-extraction.service.ts`, `websocket.gateway.ts`, `ai-turn-executor.ts` 및 이들의 대응 `*.spec.ts`)는 전부 1~6줄짜리 import 문 교체뿐이다. `emitExecutionEvent`/`emitNodeEvent`/`emitTerminalExecution` 등 emit 호출부의 인자·순서·타이밍은 이번 diff 에서 변경되지 않았다. `websocket.gateway.ts:23` 은 3라운드 전(19_27_37 W1) 리뷰가 지적한 잔여 순환 노드였으나, 직접 열람 결과 이미 `./websocket-events.types` 로 전환되어 있음을 확인했다(`:400` 사용부도 함수 본문 내부 그대로).

## 요약

이번 diff 는 `websocket.service.ts` 가 짊어졌던 값(enum)/타입 선언을 의존성-프리 모듈로 분리하는 ES-module 순환 해소 리팩터(#1174 재발 방지)이며, 이미 4라운드의 `/ai-review` 를 거쳐 순환 잔여 노드(`websocket.gateway.ts`)·가드 자체의 판별 결함(별칭 오판정·`export…from`/`require()` 미검출)이 모두 반영·재검증됐다. 직접 소스를 열어 재확인한 결과 인터페이스(re-export 12종)는 완전히 보존되고, 함수 시그니처·이벤트 emit 경로·전역 상태·파일시스템(프로덕션)·네트워크·환경변수 부작용은 발견되지 않았다. 유일하게 실행 순서에 의존하는 변경은 `TERMINAL_SHAPE` 를 모듈 스코프 상수로 승격한 것인데, 참조 대상이 이제 순환 밖에 있다는 사실을 신규 정적 가드가 고정하고 있고 이 diff 안에서 쓰기 경로는 없다. 신규 가드 테스트의 파일시스템 순회도 test-only 읽기 전용이라 무해하다. Critical/Warning 급 부작용은 없다.

## 위험도

NONE
