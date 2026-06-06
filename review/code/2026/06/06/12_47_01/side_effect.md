# 부작용(Side Effect) 리뷰

## 발견사항

### [WARNING] `open()` 호출 시 네트워크 부작용 명시 없음 — 호출자가 알 수 없는 side effect
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — `open` useCallback
- 상세: 변경 전 `open()`은 `dispatch({ type: "OPEN" })` + bridge event 송신만 수행했으나, 변경 후에는 `void start()`를 추가 호출하면서 **외부 네트워크 요청(`POST /api/hooks/:endpointPath`)** 이 암묵적으로 발생한다. `open`이라는 이름은 UI 패널을 여는 동작을 표현하며, 외부 서비스 호출을 연상시키지 않는다. 이 네트워크 부작용은 호출자(위젯 앱, 테스트, 외부 SDK 소비자)에게 명시적으로 드러나지 않는다. `actions.open`이 외부로 노출되는 공개 API이므로 소비자가 열람 가능한 JSDoc 또는 인라인 주석 없이 네트워크 호출이 숨어 있는 상태다.
- 제안: `open` 콜백 정의부에 "패널 open 시 execution 시작(POST /api/hooks) — eager §R6" 수준의 주석을 추가한다. `start` 함수의 JSDoc은 있지만 `open` 함수 자체에는 없다.

### [WARNING] `newChat()` — 복수 부작용이 단일 콜백에서 순서 의존적으로 발생
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — `newChat` useCallback
- 상세: `newChat()`이 (1) SSE 스트림 종료(`closeStream`), (2) 갱신 타이머 정리(`clearTimeout`), (3) localStorage 세션 항목 삭제(`clearSession`), (4) `sessionRef.current = null`, (5) `startedRef.current = false`, (6) React 상태 dispatch, (7) 외부 네트워크 호출(`void start()`) 순서로 7가지 서로 다른 부작용을 단일 콜백에서 실행한다. 각 부작용의 대상이 다르고(DOM 이벤트 연결, 타이머, 파일시스템 유사 스토리지, React ref, 상태, 네트워크) 순서가 바뀌면 null된 sessionRef에 타이머가 쓰기를 시도하는 등 부작용 간 간섭이 발생한다. 이 주의사항은 부분적으로 주석으로 기록되어 있으나, 각 부작용의 대상 범위가 함수 시그니처에 노출되지 않는다.
- 제안: 현행 동작은 올바르나(W9 fix로 타이머 정리 추가됨), 이 함수의 부작용 범위(스트림/스토리지/네트워크)를 JSDoc으로 명시한다.

### [INFO] `START` 액션 시그니처 변경 — `userText` 필드 제거의 호출자 영향
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/lib/widget-state.ts` — `WidgetAction` union `START` 변형
- 상세: `{ type: "START"; userText: string }` → `{ type: "START" }` 로 시그니처가 변경되었다. TypeScript 타입 변경이므로 컴파일 타임에 기존 `dispatch({ type: "START", userText: "..." })` 호출자는 타입 오류로 검출된다. 테스트 파일(`widget-state.test.ts`)에서 기존 `userText: "x"` 호출이 `userText` 없는 형태로 모두 갱신되어 있어 코드베이스 내 알려진 호출자는 정리되었다. 단, 외부 소비자가 `WidgetAction` 타입을 직접 import하여 사용하는 경우 breaking change가 된다.
- 제안: 이 위젯은 내부 SPA이므로 외부 소비자 영향은 없는 것으로 판단된다. 확인 완료.

### [INFO] `startConversation` 파라미터 타입에서 `firstMessage` 제거 — 기존 호출자 타입 호환성
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/lib/eia-client.ts` — `startConversation` 메서드 파라미터 타입
- 상세: `payload: { profile?: ...; firstMessage?: string; [k: string]: unknown }` 에서 `firstMessage?: string`이 제거됐다. `[k: string]: unknown` 인덱스 시그니처가 남아 있어 기존 호출자가 `firstMessage`를 동봉해도 런타임에서 통과(서버도 선택적 필드로 처리)된다. TypeScript 컴파일 수준에서는 `firstMessage`를 명시적으로 전달하면 인덱스 시그니처를 통해 여전히 허용되므로 hard break는 아니다. 다만 타입 문서상 `firstMessage`가 더 이상 지원 필드가 아님을 나타낸다는 의도적 설계다.
- 제안: 이상 없음. `[k: string]: unknown` 인덱스 시그니처가 하위 호환 escape hatch를 제공한다.

### [INFO] `pendingSendRef` — 컴포넌트 생명주기를 가로지르는 새 공유 ref 상태 도입
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — `pendingSendRef = useRef<string | null>(null)`
- 상세: `pendingSendRef`는 React 렌더 사이클 밖에 존재하는 mutable ref로, `submitMessage` 콜백과 C1 flush useEffect 두 코드 경로에서 읽기/쓰기가 발생한다. `newChat()` 호출 시 `pendingSendRef`를 명시적으로 null로 초기화하지 않는다. 사용자가 booting 중 텍스트를 입력(`pendingSendRef.current = "텍스트"`)한 뒤 `newChat()`을 호출하면, 새 대화 시작 후 첫 `awaiting_user_message` 진입 시 C1 flush effect가 **이전 대화의 텍스트**를 새 세션에 전송할 수 있다. `newChat()` → `dispatch({ type: "NEW_CHAT" })` → phase가 `panel`로 리셋되므로 flush effect의 조건(`state.phase !== "awaiting_user_message"`)이 일시 불만족되지만, 직후 `void start()` → `dispatch({ type: "START" })` → booting → 다시 awaiting_user_message 진입 시 이전 큐 텍스트가 flush될 수 있다.
- 위치 구체화: `newChat` 내부에 `pendingSendRef.current = null` 누락.
- 제안: `newChat()` 콜백에서 `startedRef.current = false` 이후 `pendingSendRef.current = null`을 추가하여 이전 대화의 큐 텍스트가 새 대화에 유입되지 않도록 방어한다.

### [INFO] C1 flush useEffect — `sessionRef.current` 직접 참조로 React 상태 외부 의존
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — C1 flush useEffect (라인 ~766–782)
- 상세: flush effect는 `state.phase`, `state.pending`을 의존성 배열에 포함하지만, `sessionRef.current`를 ref 직접 참조로 읽는다(`!sessionRef.current`). ref 변경은 React의 의존성 추적 밖에 있어 effect가 `sessionRef.current`가 null인 상태에서 실행되더라도 effect 자체가 재실행을 트리거받지 않는다. 다만 현재 흐름에서는 `BOOTED` 디스패치가 `sessionRef.current` 설정과 동기적으로 연결되어 있어 실제 오류 경로는 극히 좁다. 이 패턴 자체는 React에서 관용적으로 사용되지만, 향후 비동기 경로가 추가될 경우 ref와 effect 의존성 간 불일치가 silent bug로 이어질 수 있다.
- 제안: INFO 수준. 현재 동작에는 문제없으나, `sessionRef` 참조에 주석("ref 직접 참조 — 변경은 effect 재실행을 트리거하지 않음, 의존성은 phase/pending")을 추가하면 유지보수 명확성이 높아진다.

### [INFO] `startedRef` — `applyConfig`에서 세션 복원 시 전역 ref 상태 변경
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — `applyConfig` 내 `startedRef.current = true`
- 상세: 세션 복원 경로(`loadSession` 성공)에서 `startedRef.current = true`가 설정된다. 이는 의도된 동작(복원 세션 → 새 execution 시작 금지)이나, `applyConfig`가 `start()` 외부에서 `startedRef`를 변경하는 부작용을 가진다. `startedRef`의 진실이 두 곳(`start()` 성공 경로, `applyConfig` 복원 경로)에 분산되어 있어 새 경로가 추가될 때 일관성 유지가 필요하다.
- 제안: INFO 수준. 현재 설계는 올바르며, 주석으로 "세션 복원 시 startedRef를 true로 설정 — 이 변경은 여기와 start() 두 곳에서만 발생함"을 명시하면 향후 실수를 방지할 수 있다.

---

## 요약

이번 변경의 핵심 부작용 리스크는 두 가지다. 첫째, `open()` 함수가 네트워크 호출(`POST /api/hooks`)을 암묵적으로 수행하게 되었으나 함수 시그니처·JSDoc에 이 사실이 반영되어 있지 않아 외부 소비자가 예상치 못한 네트워크 부작용을 경험할 수 있다(WARNING). 둘째, `pendingSendRef`가 `newChat()` 시 초기화되지 않아 이전 대화의 큐 텍스트가 새 대화에 전송될 수 있는 상태 오염 경로가 있다(INFO). `WidgetAction.START`의 `userText` 제거는 타입 시그니처 breaking change이나 코드베이스 내 모든 호출자가 갱신되었고 내부 전용 타입이므로 실질적 영향은 없다. `startConversation` payload에서 `firstMessage` 제거는 서버가 선택적 필드로 처리하므로 서버-클라이언트 계약에 영향을 주지 않는다. 전반적으로 의도된 부작용(네트워크 호출, 상태 변경)은 §R6 설계에 부합하나, `newChat` 시 `pendingSendRef` 미초기화가 보완되어야 한다.

## 위험도

LOW

STATUS: SUCCESS
