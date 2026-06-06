# 동시성(Concurrency) 리뷰 결과

## 발견사항

### [WARNING] `start()` — check-then-set 비원자 가드 (이전 W10 후속 확인)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — `start()` 함수
- 상세: 이전 리뷰(12_14_27 W10)에서 지적한 `startedRef.current` check-then-set 구조가 이번 변경에서 JSDoc 주석으로 문서화되었다. 현재 구현은 다음과 같이 되어 있다:
  ```ts
  if (startedRef.current || sessionRef.current) return;
  startedRef.current = true;          // 첫 await 이전에 세팅됨
  dispatch({ type: "START" });
  try {
    const res = await client.startConversation(...);
  ```
  JavaScript 단일 스레드 이벤트 루프에서 두 줄이 연속 동기 실행되므로, 동일 이벤트 루프 tick 내 두 번의 `start()` 호출(예: `open()` 두 번 연속) 시 두 번째 호출이 플래그 체크를 통과하기 전에 첫 번째가 플래그를 세팅하므로 실용적으로 안전하다. 그러나 `newChat()` 이 `startedRef.current = false` 리셋 직후 `void start()` 를 호출하는 패턴에서, 같은 React 렌더 사이클 안에 외부 `open()` 이 함께 실행될 경우 두 `start()` 가 모두 체크를 통과할 수 있는 이론적 간극은 여전히 존재한다. 주석은 추가됐으나 구조적 보호 장치는 변경 없음.
  - 현재 변경 후 상태: 주석 명시로 인식 수준 개선됨. 구조는 동일.
- 제안: 현재 단일 스레드 실행 모델에서는 실용적으로 충분하다. 향후 `start()` 내부에 첫 `await` 이전에 추가 비동기 분기가 생기면 즉시 경쟁 조건이 발생하므로, 코드 리뷰 시 이 위치를 주의해야 한다는 경고를 유지한다.

### [INFO] `newChat()` — `refreshTimerRef` 정리 추가 확인 (이전 W9 해결 확인)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — `newChat()` 콜백
- 상세: 이전 리뷰(12_14_27 W9)에서 지적한 `newChat()` 내 `refreshTimerRef` 미정리 문제가 이번 변경에서 수정되었다. `closeStream()` 직후 다음 코드가 추가됨:
  ```ts
  if (refreshTimerRef.current) {
    clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = null;
  }
  ```
  이로써 `sessionRef.current = null` 이후에도 예약된 타이머가 null 된 sessionRef 에 쓰기를 시도하는 경쟁 조건이 해소되었다. 조치 적절함.
- 제안: 이상 없음.

### [INFO] C1 `pendingSendRef` 큐 — 단일 스레드 내 ref 읽기/쓰기 안전성 확인
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — `submitMessage()` + C1 flush `useEffect`
- 상세: `pendingSendRef` 는 `useRef<string | null>(null)` 로 선언되어 `submitMessage()` 에서 쓰기, `useEffect` 에서 읽기/초기화를 수행한다. JavaScript 단일 스레드 모델에서 두 경로가 동시 실행될 수 없으므로 ref 자체의 읽기/쓰기 동시성 문제는 없다. `useEffect` 내에서 `pendingSendRef.current = null` 로 먼저 클리어한 뒤 `sendCommand` 를 호출하는 순서는 재진입 방지 관점에서 올바르다. 최신 1건만 보관(덮어쓰기)하는 정책도 명확히 의도된 설계로 확인된다.
- 제안: 이상 없음.

### [INFO] `open()` 내 `void start()` — 비동기 실행 결과 미처리
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — `open()` 콜백
- 상세: `open()` 과 `newChat()` 모두 `void start()` 형태로 Promise 를 버린다. `start()` 내부에서 실패 시 `dispatch({ type: "ERROR" })` 가 호출되어 상태기계가 `ended` 로 전환되므로 에러가 조용히 삼켜지지 않는다. 단, `void` 로 버려진 Promise 에서 발생하는 uncaught rejection 은 없으며 catch 블록이 명시적으로 상태를 처리한다. 동시성 관점에서 문제 없음.
- 제안: 이상 없음.

### [INFO] `useEffect` C1 flush — 의존 배열 완전성 확인
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — C1 flush `useEffect`
- 상세: 의존 배열이 `[state.phase, state.pending, sendCommand]` 로 설정되어 있다. `pendingSendRef` 는 ref 이므로 의존 배열에 포함되지 않아도 되며 이는 올바른 React 패턴이다. `sendCommand` 는 `useCallback` 으로 메모이제이션되어 있으므로 불필요한 effect 재실행이 발생하지 않는다. Effect 내에서 `pendingSendRef.current = null` 초기화 후 `sendCommand` 호출은 동기 흐름으로 안전하다.
- 제안: 이상 없음.

---

## 요약

이번 변경(12_47_01 세션)에서 검토된 동시성 관련 코드는 이전 리뷰(12_14_27)에서 식별된 W9(`newChat()` refreshTimerRef 미정리)와 W10(`start()` check-then-set 구조 주의) 에 대한 후속 조치가 포함되어 있다. W9 는 `clearTimeout(refreshTimerRef.current)` 추가로 완전히 해소되었다. W10 은 JSDoc 주석 명시로 인식 수준은 개선됐으나 구조적 패턴은 동일하게 유지된다 — 이는 의도된 결정으로, JavaScript 단일 스레드 모델에서 실용적으로 안전하다. C1 `pendingSendRef` 큐 도입은 ref 기반 최신-1건 큐로 단순하고 스레드 안전하게 구현되었으며, flush effect 의 의존 배열과 초기화 순서도 적절하다. 전반적으로 동시성 위험이 이전 리뷰 대비 개선되었으며, 잔존 경고는 향후 `start()` 수정 시 첫 `await` 이전에 플래그 세팅 위치를 유지해야 한다는 구조적 주의사항으로, 현 코드에서는 이를 충족하고 있다.

## 위험도

LOW

STATUS=success ISSUES=1
