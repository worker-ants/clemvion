# 아키텍처(Architecture) 리뷰

## 발견사항

### [INFO] 상태기계 전환 — lazy → eager 시작 모델 전환의 아키텍처 일관성
- 위치: `widget-state.ts` WidgetAction 타입, `use-widget.ts` start 함수, `panel.tsx` Composer disabled 조건
- 상세: `START` 액션에서 `userText` 필드를 제거하고, `Composer` 비활성 조건을 `phase !== "awaiting_user_message"` 기준으로 변경한 방향은 상태기계와 UI가 일관되게 정렬되어 있다. 상태(`phase`)가 UI 렌더 조건의 단일 진실 역할을 하고 있으며, 레이어 책임 분리 원칙에 부합한다.
- 제안: 현 설계 유지.

### [INFO] `startedRef` 가드 — ref 기반 중복 시작 방지 패턴
- 위치: `use-widget.ts` 라인 1293, 1388, 1389, 1403, 1467, 1545
- 상세: `startedRef`(useRef)로 중복 open 시 execution 1회 시작을 보장하는 패턴은 React 훅 내 비동기 부작용 제어에서 관용적으로 사용되는 방식이다. `sessionRef.current` 이중 가드(`startedRef.current || sessionRef.current`)는 복원 세션과 신규 시작 두 경로를 모두 방어하고 있다. 실패 시 `startedRef.current = false` 로 재시도를 허용하는 rollback 패턴도 올바르다.
- 제안: 현 설계 유지.

### [WARNING] `newChat`에서 `start()` 호출 타이밍 — `startedRef` 리셋과 `start` 호출 사이 경쟁 조건 가능성
- 위치: `use-widget.ts` 라인 1463–1470 (`newChat` 콜백)
- 상세: `newChat` 구현이 `startedRef.current = false` 리셋 후 즉시 `void start()`를 호출한다. `start` 내부에서 `if (startedRef.current || sessionRef.current) return` 체크가 있으나, `sessionRef.current = null`을 명시적으로 먼저 초기화하고 있어 guard 통과는 예상대로다. 그러나 `dispatch({ type: "NEW_CHAT" })` 이후 `void start()` 호출 순서에서, `NEW_CHAT` 디스패치는 동기 상태 전환(`phase: "panel"`)을 유발하지만 `start`는 비동기다. `start` 내부 첫 줄에서 `configRef.current`/`clientRef.current` 체크가 있으므로 안전하지만, `newChat` 함수가 세션 정리·상태 리셋·새 execution 시작을 하나의 콜백에서 모두 처리하여 단일 책임 원칙(SRP)의 경계가 약간 두꺼워진 상태다. 기능 버그 수준은 아니나 유지보수 시 순서 의존성에 주의 필요.
- 제안: `newChat` 내 순서 의존적 로직(세션 정리 → startedRef 리셋 → dispatch → start 호출)을 주석으로 명시하거나, 향후 복잡도 증가 시 별도 헬퍼로 추출을 고려.

### [WARNING] `use-widget.ts` — God Hook 경향: 단일 훅에 너무 많은 책임 집중
- 위치: `use-widget.ts` 전체 (약 330줄)
- 상세: `useWidget` 훅이 (1) iframe bridge 수명관리, (2) 임베드 보안 검증(`isEmbedAllowed`), (3) 세션 영속화·복원, (4) SSE 스트림 관리, (5) 토큰 자동 갱신 타이머, (6) 상태기계 디스패치, (7) 사용자 인터랙션 명령 처리, (8) eager 시작 가드 — 8개의 서로 다른 관심사를 단일 함수에서 관리한다. 이번 변경(`startedRef`, `newChat` 확장, `start` 시그니처 변경)은 이 훅에 새로운 관심사를 추가하지 않고 기존 흐름을 수정하는 방식으로 설계되어 훨씬 낫지만, 훅 자체의 누적 복잡도는 경계 수준이다. 현재로서는 `use-widget.ts`가 channel-web-chat의 단일 진입점이라는 아키텍처 결정(`0-architecture §R5`: facade 계층 미신설)에 부합하지만, 향후 기능 추가 시 분리 압력이 커진다.
- 제안: 즉각 리팩터는 불필요하나, 토큰 갱신 관련 로직(`scheduleRefresh`, `refreshTimerRef`)은 향후 `useTokenRefresh` 같은 별도 훅으로 추출하기 적합한 후보다. 이번 변경 범위와는 무관하므로 backlog에 남길 것.

### [INFO] `panel.tsx` Composer 비활성 조건 — 상태-UI 결합도 적절
- 위치: `panel.tsx` 라인 776–783
- 상세: `phase !== "awaiting_user_message" || pending?.type === "buttons" || pending?.type === "form"` 조건이 프레젠테이션 레이어에서 상태 필드를 직접 참조한다. 이는 레이어 분리 관점에서 `WidgetState`를 통한 thin coupling이며, presentation → state 단방향이므로 허용 가능한 패턴이다. 단, `pending.type` 열거값이 두 곳(`"buttons"`, `"form"`)에 명시되어 있어 `ExternalInteractionType` 타입 확장 시 누락 위험이 있다.
- 제안: 향후 `interactionType` 값이 늘어나면 `disabled` 조건을 `phase !== "awaiting_user_message" || (pending?.type !== "ai_conversation")` 형태로 allowlist 방식으로 전환하는 것이 확장성 측면에서 유리하다. 현재 값이 3개(`ai_conversation`/`buttons`/`form`)로 고정이므로 즉각 변경 의무는 없다.

### [INFO] `EiaClient.startConversation` 타입 시그니처 — `firstMessage` 필드 제거는 인터페이스 분리 원칙에 부합
- 위치: `eia-client.ts` 라인 100–103
- 상세: `payload` 타입에서 `firstMessage?: string` 필드를 제거한 것은 클라이언트 계약에서 더 이상 지원되지 않는 개념을 노출하지 않는 올바른 인터페이스 분리다. `[k: string]: unknown` 인덱스 시그니처가 남아 있어 호출자가 임의 필드를 추가할 수 있는 escape hatch는 유지된다. 의도적 설계로 보인다.
- 제안: 현 설계 유지.

### [INFO] `widget-state.ts` — `panel` phase 잔존: 다이어그램과 코드의 미묘한 불일치
- 위치: `widget-state.ts` `WidgetPhase` 타입 및 `OPEN` 케이스 (라인 554–560), spec `1-widget-app.md` 상태기계 다이어그램
- 상세: spec 다이어그램은 `[collapsed] → open → [booting]`으로 표현하지만, 코드의 `OPEN` 핸들러는 `state.phase === "collapsed" ? "panel" : state.phase`로 여전히 `"panel"` 중간 상태를 거친다. eager 시작 이후 `START` 액션이 즉시 `booting`으로 전환하므로 `panel` phase는 `open() → start()` 사이의 극히 짧은 중간 상태로만 존재한다. 이 중간 상태는 spec 다이어그램에 표현되지 않아 코드와 spec 사이에 미묘한 drift가 있다. 기능 버그는 아니나 신규 개발자 혼란 소지가 있다.
- 제안: `WidgetPhase`에서 `panel`을 유지하되, spec 다이어그램에 `(panel — transient)` 주석을 추가하거나, `OPEN` 핸들러가 config 준비 여부에 따라 직접 `booting`으로 전환할 수 있는지 검토. 단, 현재 `OPEN` 핸들러는 config 유무를 모르고 `start()`는 비동기이므로 중간 `panel` 상태 존재는 불가피한 아키텍처 결과다.

### [INFO] `newChat` — 새 대화 시작 시 `dispatch(NEW_CHAT)` 이후 `start()` 호출이 panel phase를 거치지 않음
- 위치: `use-widget.ts` 라인 1463–1470, `widget-state.ts` `NEW_CHAT` 케이스
- 상세: `NEW_CHAT` 리듀서는 `phase: "panel"`을 반환하고, 이후 `void start()`가 `dispatch({ type: "START" })`를 실행해 즉시 `booting`으로 전환한다. `open()` 경로도 동일 패턴이므로 아키텍처적 일관성은 있다. 단, spec의 `new chat → [booting]` 표현과 코드의 `panel → booting` 전환 사이의 gap은 위 INFO와 동일한 맥락이다.
- 제안: 위 INFO와 통합 처리.

### [INFO] 순환 의존성 — 없음 확인
- 위치: 변경된 모든 파일
- 상세: `eia-client.ts` → (외부 fetch/EventSource만), `widget-state.ts` → `conversation`, `eia-types`, `use-widget.ts` → `eia-client`, `eia-types`, `eia-events`, `conversation`, `session-store`, `widget-state`, `host-bridge`. 단방향 의존성 그래프이며 순환 참조 없음.
- 제안: 현 구조 유지.

### [INFO] 확장성 — eager 시작 모델이 `interactionType` 다형성을 올바르게 수용
- 위치: `panel.tsx` buttons/form/DynamicForm 렌더, `use-widget.ts` handleEiaEvent
- 상세: `waiting_for_input` SSE 이벤트의 `interactionType`별 첫 표면 분기(`ai_conversation`/`buttons`/`form`)가 `panel.tsx`의 조건부 렌더링으로 구현되어 있으며, 신규 `interactionType` 추가 시 `panel.tsx`와 `Composer` disabled 조건 두 곳을 수정하면 된다. Open-Closed 원칙 관점에서 신규 타입 추가마다 수정이 필요하나, 이는 프레젠테이션 레이어의 불가피한 switch 포인트이고 현재 규모에서는 과도한 추상화(전략 패턴 등) 없이 이 방식이 적절하다.
- 제안: `interactionType` 값이 5개 이상으로 늘어나면 렌더러 맵 패턴(`{ [type]: Component }`) 도입을 고려.

---

## 요약

이번 변경은 "lazy(첫 텍스트 입력 시 시작)" → "eager(패널 open 시 시작)" 모델 전환을 구현한 것으로, 아키텍처 관점에서 전반적으로 건전하다. `WidgetAction`에서 `userText` 필드 제거, `EiaClient` 타입 시그니처 정리, `Composer` UI 비활성 조건의 state-driven 전환은 모두 올바른 방향이며 레이어 책임이 적절히 유지된다. 핵심 경계 우려는 두 가지다: (1) `useWidget` 훅의 누적 복잡도가 이번 변경으로 더 심화되진 않았으나 경계 수준에 도달해 있어 토큰 갱신 로직 분리를 backlog에 남기는 것이 권장되며, (2) `panel` 중간 phase가 spec 다이어그램에 드러나지 않아 코드-spec 미묘 drift가 존재한다 — 기능 결함은 아니나 문서화 개선이 필요하다. 전체 구조는 단방향 의존성, 상태기계 단일 진실, 프레젠테이션-비즈니스-인프라 레이어 분리를 잘 유지하고 있다.

## 위험도

LOW

STATUS: SUCCESS
