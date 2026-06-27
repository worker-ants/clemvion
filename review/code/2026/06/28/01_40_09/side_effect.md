# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] `useTokenRefresh` 내 `cancelledRef` 는 hook-local이지만 의미론적 전역 상태처럼 동작
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-usewidget-split-5e9d26/codebase/channel-web-chat/src/widget/use-token-refresh.ts` — `cancelledRef`, `useEffect` cleanup (line 769–775)
- 상세: `useTokenRefresh` 의 unmount cleanup 은 `cancelledRef.current = true` 와 `clearRefreshTimer()` 를 수행한다. 분리 전 `useWidget` 의 마운트 effect 에는 `cancelled = true; clearRefreshTimer()` 가 cleanup 에 있었는데 이제 `clearRefreshTimer()` 호출이 제거됐다(`// 이중 호출 제거` 주석). `useTokenRefresh` 내 cleanup 이 단일 소유자가 되므로 이 변경 자체는 올바르다. 다만 `cancelledRef.current = false` 를 마운트 시 `useEffect` 로 설정하기 때문에, 엄격 모드(React StrictMode)에서 double-invoke 시 effect 가 마운트→언마운트→다시 마운트 순서로 실행되면 `cancelledRef.current` 가 `false → true → false` 로 올바르게 복원되는지 주의가 필요하다. 현 구현은 이 순서를 올바르게 따르므로 실제 버그가 아니다.
- 제안: 특이 사항 없음 — 현행 구조 유지.

### [INFO] `scheduleRefresh` 가 `useCallback` 의존성 배열에 `sessionRef`, `clientRef`, `configRef` 를 포함
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-usewidget-split-5e9d26/codebase/channel-web-chat/src/widget/use-token-refresh.ts` — `scheduleRefresh` useCallback deps (line 766)
- 상세: `sessionRef`, `clientRef`, `configRef` 는 `useRef` 반환값으로 렌더 간 동일 참조 객체(`MutableRefObject`)다. 이 ref 객체 자체를 deps 에 포함하는 것은 실질적으로 아무 영향이 없다(`===` 비교에서 항상 동일). 따라서 `scheduleRefresh` 의 identity 는 stable이다. 분리 전 코드에서는 `scheduleRefreshRef.current` 를 통한 간접 호출이었는데, 이제 `scheduleRefresh` 가 stable callback 이므로 `start()`·`applyConfig` 에서 직접 호출할 수 있다. `start()` 의 `useCallback` deps 에 `scheduleRefresh` 가 추가됐다(line 1074 변경).
- 제안: 특이 사항 없음 — 설계 의도대로 동작.

### [INFO] `usePendingMessageQueue` 의 flush effect deps 에 `sendCommand` 포함
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-usewidget-split-5e9d26/codebase/channel-web-chat/src/widget/use-pending-message-queue.ts` — `useEffect` deps (line 296)
- 상세: 주석에 "sendCommand 는 stable identity 전제 (useWidget 에서 `useCallback(…, [])`)라고 명시돼 있다. `use-widget.ts` 에서 `sendCommand` 는 `useCallback(async (...) => {...}, [])` (빈 deps)로 정의되어 있으므로 실제로 stable하다. 만약 호출자가 `sendCommand` 를 stable하지 않게 전달하면 `awaiting_user_message` 가 아닌 다른 상태에서도 effect 가 재실행돼 불필요한 체크가 발생하지만, 큐가 비어있으면(null guard) 부작용은 없다. 현재 호출자(useWidget)의 `sendCommand` 는 stable이므로 문제없음.
- 제안: 현재 주석이 이 의존성을 명시하고 있어 충분하다.

### [INFO] `useWidget` 마운트 effect cleanup 에서 `clearRefreshTimer()` 제거
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-usewidget-split-5e9d26/codebase/channel-web-chat/src/widget/use-widget.ts` — 마운트 effect cleanup (line 1655–1659)
- 상세: 분리 전에는 마운트 effect cleanup 에서 `cancelled = true; clearRefreshTimer(); closeStream(); bridge.destroy()` 를 호출했다. 분리 후에는 `clearRefreshTimer()` 호출이 제거되고 `useTokenRefresh` 자체의 unmount cleanup 이 이를 담당한다. `useTokenRefresh` 의 cleanup 은 `clearRefreshTimer` deps 를 통해 `useEffect(() => { ...; return () => { cancelledRef.current = true; clearRefreshTimer(); } }, [clearRefreshTimer])` 구조다. `clearRefreshTimer` 가 `useCallback(()=>{...}, [])` 이므로 이 effect 는 마운트 1회만 실행되고 cleanup 도 1회(언마운트 시)만 호출된다. 의도와 구현이 일치한다.
- 제안: 특이 사항 없음.

### [INFO] `re-export` 를 통한 하위호환 — 공개 API 변경 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-usewidget-split-5e9d26/codebase/channel-web-chat/src/widget/use-widget.ts` — 상단 re-export 구문 (line 997)
- 상세: `refreshDelayMs`, `TOKEN_REFRESH_LEAD_MS`, `TOKEN_REFRESH_MIN_DELAY_MS` 가 `use-token-refresh` 에서 이동했지만 `use-widget.ts` 에서 re-export 되므로 기존 `./use-widget` 경로 import 사용처는 변경 없이 동작한다. `use-widget.test.ts` 의 smoke-check 가 이 re-export 가 유효함을 검증한다. `SessionRef` 타입이 로컬 인터페이스에서 `PersistedSession` 타입 별칭으로 변경됐지만 이는 내부 타입으로 외부에 export 되지 않으므로 인터페이스 변경에 해당하지 않는다.
- 제안: 특이 사항 없음.

### [INFO] `useTokenRefresh` 테스트에서 `window.sessionStorage` 직접 접근
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-usewidget-split-5e9d26/codebase/channel-web-chat/src/widget/use-token-refresh.test.ts` — `beforeEach` (line 449), 검증 assert (line 484)
- 상세: `beforeEach` 에서 `window.sessionStorage.clear()` 를 호출해 테스트 간 저장소 상태를 격리한다. 이는 올바른 패턴이다. 단, `saveSession` 이 실제로 `window.sessionStorage` 를 사용하는지는 `session-store.ts` 구현에 의존하므로, 해당 구현이 변경되면 테스트 격리 가정이 깨질 수 있다. 현 코드 범위에서는 문제없음.
- 제안: 특이 사항 없음.

### [INFO] `scheduleRefresh` 의 재귀 setTimeout — 타이머 누수 가능성 검토
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-usewidget-split-5e9d26/codebase/channel-web-chat/src/widget/use-token-refresh.ts` — `scheduleRefresh` 내부 setTimeout 콜백 (line 754–765)
- 상세: `scheduleRefresh()` 는 자신을 setTimeout 콜백 내에서 재귀 호출한다. 재귀 전에 `if (cancelledRef.current) return` 가드가 있으며, `.then()` 내에도 동일 가드가 있다. 언마운트 시 `cancelledRef.current = true` 로 설정되므로 발화 중인 타이머가 완료돼도 재예약이 발생하지 않는다. 분리 전과 동일한 시맨틱이다.
- 제안: 특이 사항 없음.

---

## 요약

이번 변경은 `useWidget` God hook 에서 `useTokenRefresh` 와 `usePendingMessageQueue` 를 추출하는 behavior-preserving 리팩터다. 부작용 관점에서 의도치 않은 전역 상태 변경, 시그니처 파괴적 변경, 예상 외 네트워크 호출, 파일시스템 부작용, 환경 변수 조작은 전혀 발견되지 않는다. 기존 `use-widget.ts` 에서 외부로 export 되던 `refreshDelayMs` / `TOKEN_REFRESH_LEAD_MS` / `TOKEN_REFRESH_MIN_DELAY_MS` 는 re-export 를 통해 하위호환이 유지되며, `use-widget.test.ts` 의 smoke-check 가 이를 검증한다. 타이머 정리(`clearRefreshTimer`) 소유권이 `useTokenRefresh` 의 unmount cleanup 으로 단일화됐고, 이전 마운트 effect cleanup 에서의 이중 호출이 올바르게 제거됐다. `pendingSendRef`, `refreshTimerRef`, `scheduleRefreshRef` 등 hook-local ref 들이 각 분리된 hook 내로 적절히 캡슐화됐으며 외부에 노출되지 않는다. 이벤트·콜백 전달 체계(`sendCommand`, `dispatch`)는 분리 전과 동일한 호출 계약을 유지한다.

## 위험도

NONE
