# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[WARNING]** `endConversation()` — SSE terminal 이벤트와 optimistic 종료가 경합해 host 로 `conversationEnded` 콜백이 중복 발사될 수 있음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` `endConversation` (약 367~430행), 특히 `await client.interact(...)` (417행 부근) → `teardownSession()` (427행) 사이 구간
  - 상세: `endConversation`은 `client.interact(session.endpoints, session.token, command)`를 **await 한 뒤에야** `teardownSession()`(SSE 스트림 close)을 호출한다. 그런데 이 command(`cancel`/`end_conversation`)를 서버가 처리하면 같은 열려있는 SSE 스트림으로 `execution.cancelled`/`execution.completed` 등 terminal 이벤트가 도착할 수 있고, 이는 기존 `handleEiaEvent`의 `TERMINAL_EVENTS` 분기(112~176행)를 그대로 트리거해 `teardownSession()` + `dispatch({type:"ENDED", reason: name})` + `bridgeRef.current?.sendEvent("conversationEnded", { reason: name })`를 **먼저** 실행시킨다. 이후 `endConversation`의 awaited 연속 실행이 재개되면 다시 `teardownSession()` + `dispatch({type:"ENDED", reason:"user_ended"})` + `sendEvent("conversationEnded", { reason: "user_ended" })`를 무조건 실행하므로, 호스트 페이지는 서로 다른 `reason`("execution.cancelled" 등 vs "user_ended")을 가진 `conversationEnded` postMessage 를 **두 번** 수신할 수 있다. `handleEiaEvent`(`eia-client.ts` `openStream`에 바인딩된 리스너, 144~146행)에는 스트림이 이미 teardown 됐는지 확인하는 가드가 없어 이 경합을 막지 못한다.
  - 비교: 기존 `newChat()`(361~397행)은 서버로 명령을 보내지 않고 곧바로 동기적으로 `teardownSession()`을 호출하므로 이런 await 갭이 없다. 기존 범용 `sendCommand()`(309~324행)도 성공 시 로컬에서 optimistic 하게 종료 전이를 하지 않고 SSE 를 신뢰한다. 즉 "명령을 await 한 뒤 optimistic 하게 로컬 종료 + host 이벤트 발사"는 이번 diff 로 새로 도입된 패턴이며, 기존 코드베이스에 이 경합을 막는 선례(gen 토큰 등)가 없다.
  - 제안: `endConversation`에서도 `teardownSession()` 을 명령 전송 **이전**(또는 최소한 SSE 리스너가 무시하도록 하는 로컬 "이미 종료됨" 플래그)으로 옮기거나, `handleEiaEvent`의 terminal 분기에 "이미 ended/teardown 됨" 가드를 추가해 중복 `dispatch`/`sendEvent` 를 방지할 것. 최소 완화책으로 `sendEvent("conversationEnded", ...)` 호출 전 `state.phase !== "ended"` 확인 등을 고려.

## 참고(INFO, 문제 없음 확인)

- **[INFO]** `InteractionService.getStatus()` 응답에 `context.conversationThread` 필드 추가 — 공개 REST 표면(EIA 외부 소비자 전체)의 additive 변경
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` 246~296행 부근, `ExecutionStatusDto.context`(`codebase/backend/src/modules/external-interaction/dto/responses.dto.ts:102`)는 `Record<string, unknown> | null` 로 이미 제네릭 타입이라 컴파일상 시그니처 변경은 없음. 신규 필드는 값이 있을 때만 스프레드로 동봉(`...(conversationThread ? { conversationThread } : {})`)돼 하위 호환(기존 클라이언트는 무시 가능).
  - 다만 이 엔드포인트는 웹챗 위젯 전용이 아니라 EIA 전체 외부 소비자에 공개된 REST 표면이므로, 이번 필드 추가는 웹챗 위젯뿐 아니라 **모든 EIA 클라이언트**의 응답 shape 를 바꾼다는 점만 기록. 코드상 실질적 부작용은 없음(additive, 문서화됨).
- **[INFO]** `execution.conversationThread` 를 clone 없이 응답 객체에 참조로 직접 embed
  - 위치: `interaction.service.ts` 246행 `const conversationThread = execution.conversationThread ?? undefined;` 및 269/280행의 `...(conversationThread ? { conversationThread } : {})`
  - 상세: 같은 함수의 주석은 "durable park 스냅샷 = SSE `waiting_for_input` 이 싣는 `cloneThread(context.conversationThread)` 와 동일 wire shape"라고 서술하지만, SSE 경로는 명시적으로 `cloneThread()`를 거치는 반면 이 REST 경로는 TypeORM 엔티티의 `conversationThread` 프로퍼티를 그대로(참조로) 응답 객체에 넣는다. 현재 함수 내에서 `execution` 을 이후 변경하지 않고, 응답은 JSON 직렬화(읽기 전용)로만 소비되므로 실질적 위험은 낮음 — 다만 향후 응답 후처리(마스킹/직렬화 변환 등)가 이 객체를 in-place mutate 하면 TypeORM 이 들고 있는 엔티티 데이터를 오염시킬 수 있어 SSE 경로와의 방어적 일관성(clone) 부재만 기록.
- **[INFO]** `conversation.ts` `roleOf()` 의미 변경(신규 `USER_TURN_SOURCES` 매핑) — 영향 범위 확인 완료
  - 위치: `codebase/channel-web-chat/src/lib/conversation.ts` 493~497행
  - 상세: `turn.role` 이 없을 때 기존엔 항상 `"assistant"` 를 반환했으나, 이제 `source ∈ {presentation_user, ai_user, user}` 면 `"user"` 를 반환하도록 바뀜. 이 함수는 `threadToMessages()`(wire `ConversationThread.turns` 변환)에서만 쓰이고, 위젯의 로컬 라이브 dispatch(`widget-state.ts` 81/88행)는 `DisplayMessage.role` 을 직접 명시적으로 설정해 `roleOf()`를 거치지 않으므로 회귀 영향 없음을 확인. `"injected"`/`"live"`/`"system"`/`"ai_tool"` 등 미매핑 source 는 여전히 기존과 동일하게 `"assistant"` 로 떨어져 하위 호환.
- **[INFO]** `PanelActions` 인터페이스에 신규 필수 필드 `endConversation` 추가 — 콜사이트 반영 확인
  - 위치: `codebase/channel-web-chat/src/widget/components/panel.tsx` 16행(인터페이스), `src/widget/widget-app.tsx:52`(`<Panel actions={actions} />`)
  - 상세: `Panel` 을 사용하는 유일한 프로덕션 콜사이트(`widget-app.tsx`)는 `useWidget()` 이 반환하는 `actions` 객체를 그대로 전달하며, `use-widget.ts` 의 반환 `actions` 에 `endConversation` 이 이미 포함되도록 diff 에서 함께 갱신됨(524행 근방 `actions: { ..., endConversation, ... }`). 테스트 fixture(`panel.test.tsx` `BASE_ACTIONS`)도 갱신됨. 시그니처 확장에 따른 미반영 콜사이트 없음.
- **[INFO]** `bridgeRef.current?.sendEvent("conversationEnded", ...)` — 신규 이벤트 타입 아님
  - 위치: `use-widget.ts:430`
  - 상세: `"conversationEnded"` 는 기존 SSE terminal 이벤트 처리 경로(176행)에서 이미 host 로 발사되던 기존 이벤트명을 재사용한 것이라, 호스트 SDK 계약(`2-sdk.md`) 관점에서 신규 이벤트 타입 도입은 아님. (다만 위 WARNING 항목처럼 두 경로에서 각각 발사될 경우 중복 수신 가능성은 있음.)
- **[INFO]** `plan/in-progress/webchat-session-controls-history-restore.md`, `review/consistency/2026/07/09/18_27_06/**` 신규 파일 생성
  - 상세: 프로젝트 관례(`CLAUDE.md` 정보 저장 위치 표)상 `plan/in-progress/*.md`·`review/consistency/**` 는 각각 developer/consistency-checker 워크플로우가 정상적으로 산출하는 위치이며, 코드 변경이 유발한 의도치 않은 파일시스템 부작용이 아님.

## 요약

핵심 기능 변경(백엔드 `getStatus` 의 durable `conversationThread` 노출, 프런트 `roleOf` source 매핑, 헤더 세션 컨트롤 UI, `endConversation` 액션) 자체는 스코프가 잘 통제돼 있고 대부분 additive 하며 기존 호출부·시그니처 영향도 검증됨(콜사이트 전수 확인, 로컬 라이브 dispatch 경로 비영향 확인). 다만 신규 `endConversation()` 이 "명령 전송을 await 한 뒤에야 optimistic 로컬 종료를 수행"하는 패턴을 처음 도입하면서, 그 await 구간에 열려 있는 SSE 스트림이 동일 명령이 유발한 terminal 이벤트를 수신·처리할 수 있어 host 로 `conversationEnded` 콜백이 서로 다른 `reason` 으로 중복 발사될 수 있는 레이스가 실질적으로 존재한다 — 상태(`phase`)는 idempotent 하게 수렴하므로 내부 상태 오염은 없으나, 외부(host) 로 노출되는 콜백 계약 관점에서는 주의가 필요하다.

## 위험도
LOW
