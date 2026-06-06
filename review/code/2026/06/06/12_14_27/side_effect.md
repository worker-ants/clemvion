# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [WARNING] `newChat` — start() 를 startedRef 리셋 직후 동기적으로 호출 (useWidget.ts)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — `newChat` 콜백
- 상세: `newChat` 은 `startedRef.current = false` → `dispatch({ type: "NEW_CHAT" })` → `void start()` 순서로 실행한다. `start()` 내부에서는 `if (startedRef.current || sessionRef.current) return` 을 체크하는데, `newChat` 이 `sessionRef.current = null` 을 먼저 정리하고 `startedRef.current = false` 로 리셋하므로 이 가드는 통과한다. 그러나 `dispatch({ type: "NEW_CHAT" })` 이 리액트 상태 업데이트를 큐에 넣는 비동기 특성으로 인해, `start()` 가 호출되는 시점에 `state.phase` 는 아직 `"panel"` 이 아닐 수 있다. 이는 상태 전이 순서에 대한 암묵적 가정을 만든다. `start()` 자체는 `configRef` / `clientRef` 를 직접 읽으므로 React 상태가 아닌 ref 에만 의존하여 실제 동작은 안전하지만, 상태기계 위반(`booting` 전에 `panel` 단계를 건너뜀) 가능성이 숨어 있다.
- 제안: `newChat` 에서 `dispatch({ type: "NEW_CHAT" })` 을 호출한 뒤 `start()` 를 직접 호출하는 대신, `useEffect` 로 `phase === "panel"` 상태를 감지하여 `start()` 를 호출하는 패턴으로 전환하거나, 혹은 현재처럼 ref 기반 가드만으로 충분하다면 주석에 이 의도를 명시할 것.

### [WARNING] `open()` 에 새로 추가된 `void start()` 호출 — 이벤트 발생 순서 부작용 (useWidget.ts)
- 위치: `use-widget.ts` — `open` 콜백
- 상세: 변경 전 `open` 은 순수하게 `dispatch({ type: "OPEN" })` + `bridgeRef.current?.sendEvent("open")` 만 수행했다. 이제 `void start()` 가 추가되어, `open()` 호출이 **외부 네트워크 요청(POST /api/hooks/:path)을 트리거**하는 부작용을 갖게 되었다. host-bridge 를 통해 `open` 명령을 처리하는 경로(`bridge.onCommand` 의 `"open": apiRef.current.open()`)도 동일하게 영향을 받아, host SDK 가 `open` 명령을 보낼 때마다 webhook POST 가 발생한다. `startedRef` 가드가 중복 호출을 막지만, 이 부작용은 함수 시그니처 상 노출되지 않아 호출자가 예상하지 못할 수 있다.
- 제안: 현재 구현의 `startedRef` 가드 + `sessionRef` 가드로 중복 방지가 되어 있어 실질적 위험은 낮다. 다만 `open` 의 JSDoc/주석에 "네트워크 요청 포함" 을 명시하여 향후 호출자가 사이드이펙트를 인지할 수 있도록 할 것.

### [WARNING] `startedRef.current = false` (실패 시 리셋) — race condition 가능성 (useWidget.ts)
- 위치: `use-widget.ts` — `start` 콜백의 catch 블록
- 상세: `start()` 가 실패하면 `startedRef.current = false` 로 재설정해 재시도를 허용한다. 그러나 에러 dispatch 이후 사용자가 패널을 닫았다가 재open 하면 `start()` 가 다시 실행된다. 이 시점에 `sessionRef.current` 는 여전히 null 이므로 가드를 통과하고 새 POST 가 발생한다. 이는 의도된 동작이지만, `dispatch({ type: "ERROR" })` 로 `phase === "ended"` 가 된 상태에서 재open 시 `phase` 전이(`OPEN` → `"panel"` 유지)와 `START` (`"booting"`) 가 연속으로 발생하게 된다. `OPEN` 액션은 `collapsed` 에서만 `panel` 로 전이하므로(`state.phase === "collapsed" ? "panel" : state.phase`), `ended` 상태에서 open 해도 phase 가 `ended` 그대로이고 그 위에 `booting` 이 덮어씌워진다 — 예상 가능한 전이이지만 UX 흐름이 의도에 맞는지 확인 필요.
- 제안: 에러 후 재시도 경로(ended → reopen)에 대한 테스트 케이스를 추가하거나, `OPEN` 액션이 `ended` 상태도 `panel` 로 초기화할지 명확히 정의할 것.

### [INFO] `WidgetAction` 타입 변경 — `START` 액션의 `userText` 필드 제거 (widget-state.ts)
- 위치: `codebase/channel-web-chat/src/lib/widget-state.ts`
- 상세: `{ type: "START"; userText: string }` 에서 `{ type: "START" }` 로 변경되었다. 이는 공개 타입(`export type WidgetAction`)의 breaking change 다. 외부에서 `START` 액션을 직접 dispatch 하는 코드가 있다면(테스트 더블, 외부 consumer) 컴파일 에러 없이 여분의 `userText` 필드를 포함해도 TypeScript 구조적 타이핑상 허용될 수 있어 런타임 오류 없이 무시되거나 혼란을 줄 수 있다. 현재 코드베이스 내에서는 `use-widget.ts` 의 `dispatch({ type: "START" })` 만이 유일한 사용처이며, 테스트 파일도 업데이트되어 있으므로 내부적으로는 완전하게 반영되어 있다.
- 제안: 영향 없음. 외부 SDK 나 테스트 더블에서 `userText` 를 전달하는 경우가 없다면 무시 가능.

### [INFO] `EiaClient.startConversation` 시그니처 변경 — `firstMessage` 필드 제거 (eia-client.ts)
- 위치: `codebase/channel-web-chat/src/lib/eia-client.ts`
- 상세: `payload` 타입에서 `firstMessage?: string` 이 제거되었다. 그러나 `[k: string]: unknown` 인덱스 시그니처가 여전히 존재하므로 호출자가 `firstMessage` 를 넘겨도 런타임에서는 그대로 직렬화되어 서버로 전송될 것이다(타입 레벨에서는 차단되지 않음 — 인덱스 시그니처 허용). 이는 의도된 제거이지만 타입 가드 효과가 완전하지 않다.
- 제안: 실질적 영향 없음. `use-widget.ts` 에서 `firstMessage` 를 전달하는 코드가 완전히 제거되어 있어 실제 전송 위험은 없다. 타입 강제가 필요하다면 `Omit<..., 'firstMessage'>` 를 명시하거나 인덱스 시그니처를 제거하는 방법을 고려할 수 있다.

### [INFO] `newChat` — `closeStream()` 이후 `start()` 를 즉시 호출 시 SSE 재연결 timing (useWidget.ts)
- 위치: `use-widget.ts` — `newChat` 콜백
- 상세: `closeStream()` → `clearSession()` → `sessionRef.current = null` → `startedRef.current = false` → `dispatch({ type: "NEW_CHAT" })` → `void start()`. `start()` 가 성공하면 `persist()` 가 `sessionRef.current` 를 설정하고 `openStream()` 을 호출한다. `openStream()` 내부에서 `closeStream()` 을 한 번 더 호출하는데(`const openStream = useCallback((session, lastEventId?) => { closeStream(); ... })`), 이때 `streamRef.current` 는 이미 null 이므로 no-op 이다. 의도치 않은 이중 closeStream 이나 상태 오염은 없다.
- 제안: 영향 없음.

### [INFO] `panel.tsx` Composer `disabled` 조건 확장 — `ai_conversation` 이 아닌 `phase` 기반으로 변경
- 위치: `codebase/channel-web-chat/src/widget/components/panel.tsx`
- 상세: 변경 전에는 `disabled={pending?.type === "form"}` 이었으나, 변경 후 `phase !== "awaiting_user_message" || pending?.type === "buttons" || pending?.type === "form"` 으로 확장되었다. 이는 `booting`/`streaming` 상태에서도 입력창을 비활성화하므로, 이전에는 입력 가능했던 `streaming` 상태(AI 응답 스트리밍 중)에서 사용자가 메시지를 입력할 수 없게 된다. 이 동작은 eager 시작 설계상 의도된 것이지만(`submitMessage` 도 `!sessionRef.current` 시 no-op 처리), 기존 동작 대비 UX 제약이 추가된 부작용이다.
- 제안: 의도된 변경. 다만 `streaming` 중 입력 금지에 대한 UX 피드백(spinner/로딩 인디케이터)이 없으면 사용자가 입력창이 비활성화된 이유를 알 수 없으므로, UI 상태 표시 개선을 고려할 것.

---

## 요약

이번 변경은 lazy 시작(첫 입력 시 execution 시작)에서 eager 시작(패널 open 시 즉시 execution 시작)으로의 의도된 동작 전환이다. 전역 변수 도입이나 파일시스템 부작용은 없다. 가장 주목할 부작용은 `open()` 함수가 기존에는 순수한 UI 상태 전이 + 이벤트 발생이었으나, 이제 **네트워크 요청(POST webhook)을 트리거**하는 함수가 된 점이다. `startedRef` + `sessionRef` 이중 가드로 중복 시작은 방지되어 있다. `newChat` 에서 `startedRef` 리셋 후 동기적 `start()` 호출이 React 상태 업데이트 비동기성과 교차하는 지점이 있으나, `start()` 가 ref 기반으로만 동작하여 실제 오류는 발생하지 않는다. 에러 후 재open 시 `ended` 상태에서의 phase 전이 경로가 명시적으로 정의되어 있지 않아 테스트 보강이 권장된다. 전반적으로 설계 의도에 부합하며 의도치 않은 전역 상태 오염이나 외부 서비스 남호출은 없다.

## 위험도

LOW
