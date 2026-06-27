# 부작용(Side Effect) 리뷰 결과

검토 대상: Channel Web Chat 위젯 리팩터(B2/B3/B5/B6) + 테스트 보강(C)
검토 일시: 2026-06-27

---

## 발견사항

### [INFO] `isTextInputSurface` 신규 공개 export — 기존 코드와 의미 동일, 호출자 영향 없음

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-widget-refactor-ff484f/codebase/channel-web-chat/src/lib/widget-state.ts` 신규 함수 `isTextInputSurface`
- 상세: 기존 `panel.tsx`와 `use-widget.ts`에 인라인으로 중복 기재되어 있던 `pending?.type !== "buttons" && pending?.type !== "form"` 판정을 단일 함수로 추출하고 `export`했다. 의미·동작이 완전히 동일하며, 기존 호출부가 이 함수를 직접 import해 대체하는 방식이라 외부 모듈에 새로운 의존성 진입점이 생기지 않는다. `null` 입력 시 `true`를 반환하는 동작(현행 보존)은 JSDoc에 명시되어 있다.
- 제안: 현행 수용.

### [INFO] `TERMINAL_EVENTS` 상수 모듈 최상위(비함수 스코프)에 도입

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-widget-refactor-ff484f/codebase/channel-web-chat/src/widget/use-widget.ts` 상단 `const TERMINAL_EVENTS`
- 상세: `as const` 튜플로 선언된 모듈-스코프 상수다. 런타임에 변경되지 않으며(`as const` 불변), 기존에 `handleEiaEvent` 내부에서 세 차례 문자열 비교로 분산되어 있던 것을 하나의 불변 배열로 통합했다. 전역 쓰기 가능 변수가 아니라 읽기 전용 상수이므로 부작용 없다.
- 제안: 현행 수용.

### [INFO] `clearRefreshTimer` / `teardownSession` 헬퍼 추출 — 순서 의존 동작 보존 확인

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-widget-refactor-ff484f/codebase/channel-web-chat/src/widget/use-widget.ts` `clearRefreshTimer`(line ~1728), `teardownSession`(line ~1740)
- 상세: 기존 `handleEiaEvent` 종료 분기, `newChat`, mount cleanup 세 곳에 인라인으로 중복된 `closeStream → clearTimeout(refreshTimerRef) → clearSession` 시퀀스를 `teardownSession`으로 단일화했다. 주석에 명시된 순서 의존(W9: SSE 닫기 → 타이머 정리 → 세션 삭제)은 추출 후에도 동일하게 유지된다. `useCallback` 의존 배열(`[closeStream, clearRefreshTimer]`)이 올바르게 선언되어 있다.
- 제안: 현행 수용.

### [INFO] `useEffect` 클린업에서 `clearRefreshTimer()` 직접 호출로 교체

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-widget-refactor-ff484f/codebase/channel-web-chat/src/widget/use-widget.ts` mount effect cleanup 반환 람다
- 상세: 기존 인라인 `if (refreshTimerRef.current) { clearTimeout(...); refreshTimerRef.current = null; }` 패턴을 `clearRefreshTimer()` 호출로 교체했다. 동작은 동일하며 `clearRefreshTimer`는 `useCallback`으로 안정화되어 effect 의존 배열에 영향을 주지 않는다.
- 제안: 현행 수용.

### [INFO] `flush effect`에서 `isTextInputSurface` 사용 — 큐 폐기(else 분기) 동작 명시적 보존

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-widget-refactor-ff484f/codebase/channel-web-chat/src/widget/use-widget.ts` flush effect `isTextInputSurface(state.pending)` 분기
- 상세: 기존 코드는 `state.pending?.type !== "buttons" && state.pending?.type !== "form"` 조건이 참일 때만 큐 flush, 거짓이면 암묵적으로 큐를 폐기했다. 교체된 `isTextInputSurface(state.pending)`은 동일 의미다. `else` 분기(폐기)는 `pendingSendRef.current = null`로 명시적으로 처리되어 있어 동작 변경이 없다.
- 제안: 현행 수용.

### [INFO] `panel.tsx`의 `disabled` 조건 교체 — denylist→allowlist 전환, 동작 동일

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-widget-refactor-ff484f/codebase/channel-web-chat/src/widget/components/panel.tsx` `Composer disabled` prop
- 상세: `phase !== "awaiting_user_message" || pending?.type === "buttons" || pending?.type === "form"` (denylist)를 `phase !== "awaiting_user_message" || !isTextInputSurface(pending)` (allowlist 역)으로 교체했다. `isTextInputSurface(null) === true`이므로 `pending === null` 케이스의 동작도 기존과 동일하다.
- 제안: 현행 수용.

### [INFO] 테스트 파일 내 `vi.stubGlobal("EventSource", ...)` 중복 존재

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-widget-refactor-ff484f/codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` — `installControllableSse` 함수와 기존 C1 인라인 테스트 두 곳 모두 `vi.stubGlobal("EventSource", ...)`를 호출
- 상세: 기존 C1 flush 테스트(인라인)는 그대로 유지된 채 신규 `installControllableSse` 헬퍼가 추가됐다. 두 코드 패스가 모두 `vi.stubGlobal`을 호출하지만, `afterEach`의 `vi.unstubAllGlobals()`가 테스트 간 격리를 보장하므로 실제 누수는 없다. 그러나 같은 목적의 코드가 두 곳에 중복 존재한다. 이는 기능상 부작용은 아니다.
- 제안: 향후 C1 flush 인라인 테스트도 `installControllableSse` 헬퍼를 재사용하도록 리팩터하면 중복이 제거된다. 본 PR 범위 밖이므로 차단 사항 아님.

### [INFO] fake timer 테스트(`vi.useFakeTimers`)의 전역 timer 교체 — `finally` 블록으로 복원 보장

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-widget-refactor-ff484f/codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` `fake timer` 테스트 케이스
- 상세: `vi.useFakeTimers({ shouldAdvanceTime: true })`가 테스트 전체 프로세스의 `setTimeout`/`Date.now` 등을 교체한다. `finally` 블록에서 `vi.useRealTimers()`를 호출해 복원하므로 이후 테스트가 fake timer에 오염되지 않는다. 올바른 패턴이다.
- 제안: 현행 수용.

---

## 요약

이번 변경은 순수하게 behavior-preserving 리팩터(인라인 중복 로직 → 헬퍼 함수 추출)와 테스트 보강으로 구성된다. 신규 공개 export(`isTextInputSurface`)는 기존 인라인 판정과 의미·동작이 완전히 동일하며, `null` 경계값 처리도 변경 없다. `teardownSession` 추출은 세 곳의 중복을 단일화하면서 순서 의존(W9)을 그대로 보존한다. 모듈-스코프 `TERMINAL_EVENTS` 상수는 불변(`as const`)이라 전역 상태 오염 우려가 없다. 테스트의 `vi.stubGlobal` 부작용은 `afterEach(vi.unstubAllGlobals)`로 격리되고, fake timer도 `finally`에서 복원된다. 의도치 않은 전역 상태 변경, 파일시스템 부작용, 의도치 않은 네트워크 호출, 시그니처 파괴 변경, 이벤트 콜백 변경은 발견되지 않았다. 모든 발견 사항이 INFO 수준이며 차단 사유 없음.

## 위험도

NONE

STATUS: SUCCESS
