# 부작용(Side Effect) 리뷰 결과

리뷰 대상: Channel Web Chat 위젯 리팩터(B) + 테스트 보강(C)
리뷰 일시: 2026-06-27

---

## 발견사항

### [INFO] `isTextInputSurface` — 순수 함수, 공유 상태 변경 없음
- 위치: `/codebase/channel-web-chat/src/lib/widget-state.ts` (신규 export)
- 상세: `pending?.type !== "buttons" && pending?.type !== "form"` 는 인자만 읽고 외부 상태를 전혀 변경하지 않는 순수 함수다. 기존 3곳의 인라인 비교를 추출한 것이므로 observable 동작 변화는 없다. `null` 입력에 대해 `true`를 반환하는 동작도 기존 인라인 조건과 동일(behavior-preserving).
- 제안: 없음.

### [INFO] `TERMINAL_EVENTS` 모듈 스코프 상수 도입
- 위치: `/codebase/channel-web-chat/src/widget/use-widget.ts` L379-383 (신규 상수)
- 상세: `as const` 리터럴 튜플로 선언된 모듈 스코프 상수다. 변경 불가능(readonly)하며 초기화 이후 쓰기가 불가능하다. 기존 `handleEiaEvent` 안의 3중 문자열 비교를 배열 `.includes()` 로 교체한 것이므로 동일 이벤트 집합을 동일하게 매칭한다. 전역 변수가 아닌 모듈 내부 상수이므로 전역 네임스페이스 오염 없음.
- 제안: 없음.

### [INFO] `teardownSession` — closeStream·clearRefreshTimer·clearSession 순서 의존(W9)
- 위치: `/codebase/channel-web-chat/src/widget/use-widget.ts` L405-409 (teardownSession useCallback)
- 상세: `teardownSession` 은 `handleEiaEvent` 종료 분기와 `newChat` 양쪽에서 동일한 정리 시퀀스(closeStream → clearRefreshTimer → clearSession)를 실행하는 헬퍼다. 두 호출 경로 모두 이전 코드에서 동일 순서를 수동으로 수행했으므로 새로운 부작용은 없다. `useCallback` 의존 배열(`[closeStream, clearRefreshTimer]`)이 정확히 선언되어 있어 stale closure 위험 없음.
- 제안: 없음.

### [INFO] `clearRefreshTimer` — idempotent, 전역 타이머 정리만
- 위치: `/codebase/channel-web-chat/src/widget/use-widget.ts` L393-398 (clearRefreshTimer useCallback)
- 상세: `clearTimeout` + `refreshTimerRef.current = null` 패턴을 추출한 것이다. 중복 호출 시에도 `if (refreshTimerRef.current)` 가드가 있어 이중 clearTimeout 부작용 없음. `useCallback` 의존 배열이 `[]`(빈 배열)로 선언되어 있는데, `refreshTimerRef` 는 ref이므로 의존 배열에 포함하지 않아도 올바르다(ref 동일성은 리렌더 간 보장됨).
- 제안: 없음.

### [INFO] `panel.tsx` — `isTextInputSurface` allowlist 전환이 Composer disabled 조건을 변경하지 않음
- 위치: `/codebase/channel-web-chat/src/widget/components/panel.tsx` L188
- 상세: 이전: `pending?.type === "buttons" || pending?.type === "form"` (denylist). 변경 후: `!isTextInputSurface(pending)` (함수 내부가 동일 denylist). 논리적으로 동일하므로 렌더 부작용 변화 없음. `isEnded` 게이팅(`!isEnded &&` 로 감싸진 Composer 렌더)은 변경이 없어 ended 상태의 Composer 미렌더 동작도 그대로다.
- 제안: 없음.

### [INFO] `installControllableSse` — 테스트 내부 `vi.stubGlobal` 사용
- 위치: `/codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` L215-248 (신규 함수)
- 상세: `vi.stubGlobal("fetch", ...)` 와 `vi.stubGlobal("EventSource", ...)` 를 사용한다. Vitest 의 `vi.stubGlobal` 은 테스트 간 자동 복원(afterEach 정리)을 지원하므로, 이 함수를 호출한 테스트 이후 다른 테스트에 전역 `fetch`/`EventSource` 오염이 잔류하지 않는다. 기존 `installFetch` 도 동일 패턴을 사용하고 있어 일관됨.
- 제안: 없음.

### [INFO] `fake timer` 테스트 — `vi.useFakeTimers` 복원 보장
- 위치: `/codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` L295-345 (fake timer 테스트)
- 상세: `vi.useFakeTimers({ shouldAdvanceTime: true })` 를 `try { ... } finally { vi.useRealTimers(); }` 패턴으로 감싸 예외 발생 시에도 반드시 실제 타이머로 복원함을 보장한다. 이는 후속 테스트에 가짜 타이머가 누출되는 부작용을 방지하는 올바른 패턴이다.
- 제안: 없음.

---

## 요약

이번 변경은 behavior-preserving 리팩터로, 의도하지 않은 부작용이 발견되지 않았다. `isTextInputSurface` 는 외부 상태를 변경하지 않는 순수 함수이고, `TERMINAL_EVENTS` 는 쓰기 불가능한 모듈 스코프 상수이며, `teardownSession`/`clearRefreshTimer` 는 기존 중복 정리 로직을 추출한 것이다. 전역 변수 도입, 파일시스템 부작용, 환경 변수 읽기/쓰기, 의도치 않은 네트워크 호출은 전혀 없다. 공개 API로 추가된 `isTextInputSurface` export 는 신규 추가이므로 기존 호출자에 영향을 주지 않으며, 기존 함수 시그니처는 변경되지 않았다. 테스트 코드의 `vi.stubGlobal`/`vi.useFakeTimers` 모두 올바른 복원 패턴을 따라 테스트 간 전역 상태 오염이 없다.

## 위험도

NONE
