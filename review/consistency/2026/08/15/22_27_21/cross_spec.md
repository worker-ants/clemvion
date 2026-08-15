# Cross-Spec 일관성 검토 — spec/5-system/ (impl-done)

## 검토 범위 확인

`origin/main...HEAD` 의 `spec/**` diff 는 **단 1줄**이다:

```
spec/5-system/6-websocket-protocol.md
  code:
+   - codebase/backend/src/modules/websocket/websocket-events.types.ts
```

코드 diff(136 files)의 실질은 `#1174` ES-module 순환 해소를 위한 **내부 구조 리팩터** 하나다 —
`websocket.service.ts` 에 있던 값·타입 정의(enum `ExecutionEventType`/`NodeEventType`/
`BackgroundRunEventType`/`NotificationEventType`, interface `ExecutionChannelEvent`/
`ChatChannelRoutingInfo`/`ExecutionRoutingContext`/`ToolCallStartedPayload`/
`UserMessagePayload`/`ToolCallCompletedPayload`/`NotificationNewPayload`, type
`KbEventType`)을 신규 의존성-프리 모듈 `websocket-events.types.ts` 로 그대로 옮기고,
`websocket.service.ts` 는 이를 **re-export** 해 기존 import 경로를 보존한다. 15개 호출부
파일의 변경은 전부 import 경로 전환(`from '../websocket/websocket.service'` →
`from '../websocket/websocket-events.types'`, 필요 시 `type` 키워드 부착)뿐이며, 클래스
`WebsocketService` 의 메서드(`emitExecutionEvent`/`emitNodeEvent`/sanitize 로직/
`executionEvents$` fan-out 등)는 전혀 이동·변경되지 않았다. enum 값·wire 이벤트명·
payload shape·채널 패턴·인가 로직 등 **외부에 노출되는 계약은 문자 그대로 동일**함을
diff 로 확인했다 (`execution-event-emitter.service.ts` 의 `TERMINAL_SHAPE` 파생 로직도
값 불변, 위치만 상수화).

즉 본 변경은 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 어느 축도 건드리지 않는다.
아래는 그럼에도 발견된 **문서 귀속(attribution) drift** 뿐이다.

## 발견사항

- **[INFO]** `spec/data-flow/0-overview.md` §"주요 컴포넌트/데이터 흐름" WebSocket 행의 SoT 포인터가 이동한 파일을 가리킴
  - target 위치: `spec/5-system/6-websocket-protocol.md` front-matter `code:` (이번 diff, `websocket-events.types.ts` 추가)
  - 충돌 대상: `spec/data-flow/0-overview.md:110` — `"단일 sink (WebsocketService) … (websocket.service.ts 헤더 주석, EIA §R10)"`
  - 상세: 인용된 "헤더 주석"은 원래 `ExecutionChannelEvent` interface 의 JSDoc(`[Spec EIA §R10] — ExecutionEngine 단일 sink 정책 유지 …`)이었다. 이번 리팩터로 그 JSDoc 은 `ExecutionChannelEvent` 정의와 함께 통째로 `websocket-events.types.ts` 로 이동했고, `websocket.service.ts` 에 남은 새 파일-상단 주석은 "타입을 분리했다"는 리팩터 배경만 설명할 뿐 §R10 단일 sink 정책 문구를 담고 있지 않다. 정책 자체(단일 sink RxJS fan-out)는 코드 동작상 안 바뀌었지만, 인용된 "어디를 보면 그 근거가 있는가"라는 포인터는 더 이상 정확하지 않다.
  - 제안: `spec/data-flow/0-overview.md:110` 의 괄호 주석을 `websocket-events.types.ts 헤더 주석` 으로 갱신 (project-planner 턴). 코드 자체 수정은 불필요.

- **[INFO]** `NodeEventType`/`KbEventType` 정의 위치 서술이 재-export facade 를 통해서만 참인 상태로 남음
  - target 위치: `spec/5-system/6-websocket-protocol.md` (이번 diff가 자신의 `code:` 목록엔 `websocket-events.types.ts` 를 반영함)
  - 충돌 대상: `spec/3-workflow-editor/3-execution.md:657` (`"NodeEventType 의 execution.node.* prefix — websocket.service.ts"`), `spec/5-system/10-graph-rag.md:552` (`"websocket.service.ts 의 KbEventType union"`)
  - 상세: 두 서술 모두 `websocket.service.ts` 를 정의처로 지목하지만, 정의는 이제 `websocket-events.types.ts` 에 있고 `websocket.service.ts` 는 re-export 만 한다. import 경로가 살아있어 **사실 관계는 여전히 참**(타입을 그 파일에서 가져올 수 있음)이라 CRITICAL/WARNING 은 아니나, target 문서 자신은 이미 이번 diff 에서 `code:` 목록에 새 파일을 추가해 "정의 위치가 바뀌었다"를 인정했는데 그 사실이 다른 두 영역(3-workflow-editor, 5-system/10-graph-rag)에는 미러링되지 않았다.
  - 제안: 두 인용을 `websocket-events.types.ts` 로 갱신하거나(정밀화), 최소한 두 파일의 `code:` front-matter 에도 `websocket-events.types.ts` 를 추가해 동기화. 이번 세션의 필수 항목은 아니며, 다음 spec 동기화 pass 에서 함께 처리 가능.

## 요약

Cross-Spec 관점에서 이번 변경은 `#1174` ES-module 순환을 끊기 위한 순수 내부 구조 리팩터로, 값·타입·wire 계약·이벤트명·채널·인가·상태 전이 어느 것도 이동 전후로 다르지 않음을 diff 로 직접 확인했다(re-export facade 로 기존 import 경로도 보존). target 자신의 spec 변경(`6-websocket-protocol.md` `code:` 1줄 추가)은 정확하고 완결적이다. 발견된 두 건은 모두 "타입 정의 위치를 가리키는 다른 영역 문서의 포인터가 stale 해졌다"는 문서 귀속 수준의 drift이며, 재-export 덕에 여전히 사실상 참이라 기능적 충돌이 아니다. CRITICAL/WARNING 없음.

## 위험도

LOW
