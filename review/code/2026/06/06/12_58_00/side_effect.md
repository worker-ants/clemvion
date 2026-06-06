# 부작용(Side Effect) 리뷰 결과

> 대상: webchat eager start (§R6 — 패널 open 시 execution 시작, firstMessage 폐기)
> 세션: `review/code/2026/06/06/12_58_00`
> 검토일: 2026-06-06

---

## 발견사항

### [WARNING] `open()` — 순수 UI 이벤트에서 네트워크 부작용 함수로 의미 변경
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — `open` 콜백
- 상세: 변경 전 `open()` 은 `dispatch({ type: "OPEN" })` + `bridgeRef.current?.sendEvent("open")` 만 수행하는 순수한 UI 상태 전이 함수였다. 변경 후 `void start()` 가 추가되어 **패널 열기 행위가 즉시 외부 네트워크 요청(`POST /api/hooks/:path`)을 유발**한다. 이 부작용은 함수 시그니처에 드러나지 않는다. host-bridge 를 통해 `open` 명령을 처리하는 경로(`bridge.onCommand` → `apiRef.current.open()`)도 동일하게 영향을 받아, host SDK 가 `wc:command { type: "open" }` 을 보낼 때마다 webhook POST 가 발생하게 된다. `startedRef` + `sessionRef` 이중 가드가 중복 시작을 막지만, 호출자(host SDK 통합 코드, 테스트 더블 등)가 이 부작용을 인지하지 못하면 예상치 못한 서버 호출이 발생할 수 있다.
- 제안: `open` JSDoc/인라인 주석에 "네트워크 부작용 포함 — webhook POST 트리거(W3 참고)" 명시. 현재 diff 에 주석이 일부 추가됐으나(`// W3` 주석, newChat 의 `// 네트워크 부작용 주의(W3)`) `open` 콜백 자체에 충분한 주석이 없으면 후속 개발자가 `open()` 을 "순수 UI" 함수로 오해하고 추가 호출 경로를 만들 수 있다.

### [WARNING] `newChat()` — 상태 리셋과 `start()` 사이 열린 간극에서 공유 ref 경합 가능
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — `newChat` 콜백
- 상세: `newChat` 구현 순서: `closeStream()` → `clearTimeout(refreshTimerRef.current)` → `clearSession()` → `sessionRef.current = null` → `startedRef.current = false` → `dispatch({ type: "NEW_CHAT" })` → `void start()`. `start()` 가 비동기(`async`)이므로, `start()` 내부의 첫 `await`(webhook POST) 이전까지는 동기 실행 보장이 있다. 그러나 `start()` 가 성공적으로 `startedRef.current = true` 를 세팅하기 전, 즉 `newChat` 의 `startedRef.current = false` 리셋 이후 ~ `start()` 본문 3번째 줄 실행 사이의 **단일 tick 창**에서 외부 `open()` 이 동시에 호출되면 두 `start()` 가 중복 실행되어 webhook POST 가 2회 발생할 수 있다. 단, 이 간극은 동기 실행 구간이라 실용적으로는 매우 짧고 재현 확률은 낮다. 현재 `clearTimeout(refreshTimerRef.current)` 추가(W9 조치)로 가장 위험한 타이머 부작용(null 된 sessionRef 에 쓰기)은 해소되었다.
- 제안: 현 구현 수준으로 실용적으로 충분하다. 추가 보호가 필요하다면 `newChat` 에서 `startedRef.current = false` 리셋 후 즉시 `startedRef.current = true` 로 재점유한 뒤 `start()` 에 `force` 플래그를 전달하는 패턴(가드 우회 없이 내부 flag 로 처리)을 고려할 수 있다.

### [WARNING] `start()` 실패 시 `startedRef.current = false` 리셋 — `ended` 상태에서 재open 시 phase 전이 미정의
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — `start` catch 블록
- 상세: `start()` webhook 실패 시 `dispatch({ type: "ERROR" })` → `phase === "ended"` 전환. 이 상태에서 사용자가 재open 하면 `OPEN` 액션이 `collapsed` 상태가 아닌 `ended` 에서 발생하므로 `WidgetPhase` 전이 조건(`state.phase === "collapsed" ? "panel" : state.phase`)에 따라 phase 가 `ended` 그대로 유지된 채 `OPEN` 이벤트가 처리된다. 이후 `start()` 가 호출되어 `dispatch({ type: "START" })` 가 발행되면 phase 가 `ended` → `booting` 으로 직접 전환된다. 이 전이는 `widget-state.ts` 상단 주석의 정상 흐름도(`panel → booting`)를 건너뛴다. 기능적 오류는 아니지만, reducer 가 `ended` 에서 `START` 를 직접 처리하는 경우가 명시적으로 정의/테스트되어 있지 않아 예상치 못한 상태 부작용 가능성이 있다.
- 제안: `widgetReducer` 의 `START` 케이스가 현재 phase 무관하게 `booting` 으로 전환하므로 기능상 동작은 하나, `ended` → 재open 경로에 대한 테스트 케이스를 추가해 의도된 동작임을 명시한다. W8 테스트(webhook 500 실패 → ERROR → 재open)가 부분적으로 이를 커버하나, `ended` 상태의 `OPEN` 처리가 명시적으로 검증되는지 확인 필요.

### [INFO] `WidgetAction.START` 시그니처 변경 — `userText` 필드 제거로 인한 기존 호출자 영향
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/lib/widget-state.ts` — `WidgetAction` 타입 (line 49–51)
- 상세: `{ type: "START"; userText: string }` → `{ type: "START" }` 로 변경됐다. TypeScript 구조적 타이핑에서 기존 코드가 `userText` 필드를 포함해 `START` 를 dispatch 하더라도 **컴파일 에러 없이 허용**된다(초과 프로퍼티 체크는 리터럴 객체에만 적용되고, 타입이 부분 구조를 허용하는 경우 제외). 현재 코드베이스 내 유일한 dispatch 경로(`use-widget.ts`)는 이미 `userText` 없이 dispatch 하도록 업데이트됐고, 테스트도 갱신됐으므로 내부 영향은 없다. 외부에서 `WidgetAction` 타입을 직접 import 해 사용하는 코드(BYO-UI, 외부 통합)가 있다면 `userText` 를 보내도 런타임에서 무시된다.
- 제안: 코드베이스 내 다른 `dispatch({ type: "START", userText: ... })` 호출이 없음을 확인 완료. 외부 공개 타입으로 사용되는 경우 변경 이력 문서화 권장.

### [INFO] `EiaClient.startConversation` payload 타입에서 `firstMessage` 제거 — 인덱스 시그니처로 인한 불완전한 타입 가드
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/lib/eia-client.ts` — `startConversation` 매개변수 타입 (line 70–72)
- 상세: `payload: { profile?: Record<string, unknown>; firstMessage?: string; [k: string]: unknown }` → `payload: { profile?: Record<string, unknown>; [k: string]: unknown }` 로 변경됐다. `[k: string]: unknown` 인덱스 시그니처가 남아 있어 호출자가 `firstMessage` 를 payload 에 포함해 넘겨도 TypeScript 가 **에러를 내지 않고 그대로 서버에 전송**된다. 실제 호출 경로(`use-widget.ts`)에서 `firstMessage` 를 넘기지 않으므로 런타임 위험은 없지만, 타입 제거의 의도(계약 명시)가 인덱스 시그니처로 인해 약화된다.
- 제안: 현 구현에서 실질적 위험 없음. 더 강한 타입 보장이 필요하면 인덱스 시그니처를 제거하거나 `Omit` 을 사용하는 방법을 고려할 수 있으나, 현재 인덱스 시그니처는 확장성(미래 필드 추가) 목적으로 의도적으로 유지된 것으로 보인다.

### [INFO] C1 flush effect — `useEffect` 로 추가된 큐 flush 부작용
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — C1 flush useEffect (line 744–760)
- 상세: `state.phase` 와 `state.pending` 가 변할 때마다 실행되는 effect 가 추가됐다. 이 effect 는 `pendingSendRef.current` 가 있을 때 `sendCommand` 를 호출한다. React 의 `useEffect` 는 렌더 이후 비동기로 실행되므로, `state.phase === "awaiting_user_message"` 로 전환된 직후 다음 렌더 사이클에서 실행된다. effect 가 실행될 때 `state.pending` 이 여전히 유효한지(race 로 변경되지 않았는지)는 클로저가 stale 해질 가능성이 있다. 다만 `sendCommand` 는 `sessionRef.current` 를 ref 로 직접 읽으므로 실제로는 최신 세션을 사용한다. `state.pending?.nodeId` 는 effect 클로저에서 캡처된 값을 사용하므로, effect 실행 시점과 실제 pending 이 변경된 경우 stale nodeId 가 전송될 수 있다.
- 제안: 현재 구조에서 실용적으로 안전하다. `state.pending` 이 effect 실행 사이에 변경되는 경우(buttons pending → ai_conversation pending 같은 빠른 연속 SSE 이벤트)가 발생하면 nodeId 불일치 가능성이 있으므로, effect deps 에 `state.pending?.nodeId` 를 포함하는 것이 더 명시적이다.

### [INFO] `newChat()` — 이전 대화 `pendingSendRef` 큐 폐기 (의도된 부작용)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — `newChat` 콜백 (line 798–799)
- 상세: `newChat()` 에서 `pendingSendRef.current = null` 로 큐를 명시적으로 비운다(I1 조치). 이는 이전 대화의 booting 중 큐된 텍스트가 새 대화의 첫 waiting 에서 flush 되는 누수를 방지하는 의도된 부작용이다. 올바른 처리.
- 제안: 이상 없음.

### [INFO] `start` 가 `actions` 에 공개 노출 — 의도치 않은 공개 API 부작용
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — `actions` 반환 객체 (line 825)
- 상세: `actions: { open, close, start, submitMessage, clickButton, submitForm, newChat, show, hide, updateProfile }` — `start` 가 공개 노출된다. eager 시작 이후 `start` 는 `open()` 내부에서 자동 호출되므로 외부 직접 호출이 불필요하다. 외부에서 `start()` 를 직접 호출하면 `startedRef` + `sessionRef` 가드가 있어 중복 시작은 막히지만, 만약 `startedRef.current = false` 상태(실패 후 복구 상태)에서 외부가 `start()` 를 직접 호출하면 `open()` 없이 execution 이 시작되어 phase 가 `panel` 이 아닌 다른 상태(`collapsed`, `ended`)에서 `booting` 으로 전환된다. I3 조치로 주석이 추가됐다.
- 제안: 하위 호환 목적 유지는 수용 가능. 주석 명시로 충분. 장기적으로 `start` 를 `actions` 에서 제거하고 `open` 내부 전용으로 두는 방향이 API 표면 최소화에 유리하다.

---

## 요약

이번 변경의 핵심 부작용은 `open()` 함수가 순수 UI 상태 전이에서 **네트워크 요청을 트리거하는 함수**로 의미가 바뀐 것이다. 이는 eager 시작(§R6) 설계의 의도된 결과이며, `startedRef` + `sessionRef` 이중 가드로 중복 시작이 방지되고 테스트로 검증되어 있다. 전역 변수 도입, 파일시스템 부작용, 환경 변수 읽기/쓰기는 없다. `WidgetAction.START` 에서 `userText` 필드 제거는 TypeScript 인터페이스 breaking change 이지만 코드베이스 내 유일한 호출 경로가 업데이트됐다. `EiaClient.startConversation` payload 의 `firstMessage` 제거는 인덱스 시그니처(`[k: string]: unknown`)로 인해 타입 레벨 강제가 완전하지 않으나 실제 전송 코드에서 해당 필드를 완전히 제거했으므로 런타임 위험은 없다. `newChat()` 내 상태 리셋과 `start()` 비동기 호출 사이의 단일 tick 창에서 외부 `open()` 과 경합할 가능성이 이론적으로 존재하나, W9(refreshTimerRef clearTimeout) 조치로 가장 위험한 경로는 해소됐다. C1 flush effect 는 stale `nodeId` 전송 가능성이 있으나 실용적으로 낮은 위험이다. 전체적으로 의도치 않은 전역 상태 오염이나 예상 외 외부 서비스 남호출 패턴은 없다.

---

## 위험도

LOW

STATUS: SUCCESS
