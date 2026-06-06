# 동시성(Concurrency) 리뷰

## 발견사항

### [WARNING] `start()` check-then-set 패턴 — 첫 await 이전 플래그 세팅 의존
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — `start` 함수, `startedRef.current = true` (라인 692 기준 diff)
- 상세: `start()` 는 `if (startedRef.current || sessionRef.current) return` 체크 후 즉시 `startedRef.current = true` 를 세팅하고 그 다음 첫 `await client.startConversation(...)` 를 호출한다. JavaScript/React 환경은 싱글 스레드 이벤트 루프이므로 동기 코드 내에서는 실제 경쟁 조건이 발생하지 않는다. 그러나 향후 `start()` 내부에서 첫 `await` 이전에 다른 비동기 코드가 삽입되거나, `startedRef.current = true` 세팅이 첫 `await` 이후로 이동하면 즉각 경쟁 조건이 발생한다. 코드에 W10 주석으로 명시해 두었으나, 구조적 취약성은 남아 있다.
- 제안: 현 구조에서는 기능적으로 안전하다. 향후 `start()` 수정 시 `startedRef.current = true` 가 반드시 첫 `await` 이전에 위치해야 한다는 점을 문서화한 JSDoc 주석(W10)이 이미 반영되어 있으므로 현재 수준에서 충분하다. 장기적으로는 `startedRef.current = true` 세팅을 가드 조건 직후의 첫 번째 문으로 고정(주석 테스트 포함)하는 것을 권장한다.

### [WARNING] `pendingSendRef` 큐 단일 보관 — 복수 이벤트 도착 시 유실
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — `submitMessage` 콜백 및 `pendingSendRef` (라인 650, 736)
- 상세: `pendingSendRef` 는 최신 1건만 보관한다(`pendingSendRef.current = text`). booting/streaming 중 사용자가 추천질문을 빠르게 두 번 탭하면 첫 번째 텍스트가 두 번째에 의해 덮어써진다. 현재 UX 설계상 Composer 는 `booting`/`streaming` 에서 비활성이고, suggestions 버튼은 C1 큐 경로를 탄다는 주석이 있다(W1 fix). 그러나 패널 suggestions 버튼 자체는 `disabled` 처리가 아니라 큐에 위임하는 방식이므로 연속 클릭 시 마지막 1건만 전송된다. 설계 의도(최신 의도 우선)라면 수용 가능하지만, 명시적으로 문서화되어 있지 않다.
- 제안: 의도된 "최신 1건 우선" 정책이라면 `pendingSendRef` 에 주석을 추가해 "복수 클릭 시 마지막 텍스트만 전송됨(의도적 덮어쓰기)" 을 명시한다. 다건 보장이 필요하다면 큐 배열(`string[]`)로 전환해야 하나, 현재 사용 시나리오(open 직후 첫 메시지 한 건)에서는 단일 보관이 적절하다.

### [INFO] `newChat()` 내 `closeStream` → `startedRef = false` → `void start()` 순서 의존
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — `newChat` 콜백 (diff 라인 791–805)
- 상세: `newChat` 은 `closeStream()` → `clearTimeout(refreshTimerRef)` → `clearSession()` → `sessionRef.current = null` → `startedRef.current = false` → `pendingSendRef.current = null` → `dispatch(NEW_CHAT)` → `void start()` 의 8단계 순서를 단일 동기 콜백에서 실행한다. 이 순서는 모두 이벤트 루프의 동기 마이크로태스크 내에서 완료되므로 중간에 외부 이벤트가 끼어들 여지가 없다. W9(refreshTimerRef 정리)가 이미 반영되어 있어 null 된 sessionRef 에 대한 타이머 쓰기 위험은 해소됐다. 순서 의존성 주석(W3)도 반영됨. 기능적으로 안전하나 단계가 많아 유지보수 시 주의가 필요하다.
- 제안: 현 구현 충분. 복잡도 증가 시 `resetSession()` 헬퍼로 1~6단계를 추출하는 것을 중장기 backlog 으로 고려.

### [INFO] C1 flush effect — `useEffect` 의존성 배열과 `pendingSendRef` 상호작용
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — C1 flush useEffect (diff 라인 747–763)
- 상세: flush effect 는 `[state.phase, state.pending, sendCommand]` 를 의존성으로 가진다. `pendingSendRef` 는 ref 이므로 의존성에 포함되지 않는다(React 관용 패턴). effect 내에서 `pendingSendRef.current` 를 읽고 즉시 `null` 로 초기화한 뒤 `sendCommand` 를 호출한다. `sendCommand` 가 비동기이므로 effect 재실행 전에 두 번 호출될 가능성이 이론상 존재하나, `pendingSendRef.current = null` 이 동기적으로 먼저 실행되어 이중 전송은 방지된다. React StrictMode 에서 effect 가 두 번 실행될 수 있으나, `pendingSendRef.current` 가 첫 실행 후 `null` 이므로 두 번째 실행에서 조기 반환된다. 안전하다.
- 제안: 이상 없음. React StrictMode 호환성이 설계상 보장된다.

### [INFO] `open()` 내 `void start()` — 에러 무시
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — `open` 콜백 (diff 라인 780–781)
- 상세: `open` 콜백에서 `void start()` 로 Promise 를 명시적으로 무시한다. `start()` 내부 catch 블록에서 `dispatch({ type: "ERROR", ... })` 를 호출하므로 에러가 상태기계에 의해 처리된다. `void` 는 의도적 무시이며 unhandled rejection 없음. async/await 관점에서 올바른 패턴이다.
- 제안: 이상 없음.

## 요약

이번 변경의 동시성 위험은 전반적으로 낮다. JavaScript 싱글 스레드 이벤트 루프 환경에서 `startedRef`/`pendingSendRef` 가 `useRef` 로 관리되어 동기 섹션 내에서 경쟁 조건이 실제 발생하지 않는다. 핵심 경계는 두 가지다: (1) `start()` 의 check-then-set 패턴은 `startedRef.current = true` 가 첫 `await` 이전에 있어야만 안전하며, 코드가 현재 그 조건을 만족하고 있고 W10 JSDoc 주석으로 제약이 명시되어 있다. (2) `pendingSendRef` 단일 큐는 booting/streaming 중 연속 suggestions 탭 시 마지막 입력만 전달하는 덮어쓰기 동작을 가지는데, 이것이 의도된 정책임을 명시적으로 주석화하는 것이 바람직하다. `newChat` 의 8단계 순서 의존 패턴은 동기 콜백 내에서 안전하게 실행되며, W9 refreshTimerRef 정리가 이미 반영돼 타이머 누수 위험도 해소됐다. C1 flush effect 는 React StrictMode 에서도 이중 전송 없이 안전하다. 이전 리뷰 사이클(12_14_27)에서 식별된 동시성 이슈(W9, W10)가 이번 변경에서 모두 반영됐으며 잔여 위험은 낮다.

## 위험도

LOW
