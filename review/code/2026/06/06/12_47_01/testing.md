# 테스트(Testing) 리뷰

## 발견사항

### [INFO] `setTimeout(r, 20)` 기반 반-단언(negative assertion) — 상수화는 완료됐으나 근본 패턴 취약성 잔존
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` — 중복 open 단일 시작 테스트 및 W7 newChat 테스트
- 상세: `NO_EXTRA_CALL_WAIT_MS = 20` 상수 추출로 매직 넘버는 해결됐다(I8 반영). 그러나 "추가 POST 가 없음"을 시간 지연으로 검증하는 패턴 자체는 CI 부하에 따라 flaky 해질 수 있다. 두 곳에서 사용된다: 중복 open 단일 시작 테스트(20ms 대기 후 count==1 재확인)와 W7 newChat 테스트(20ms 대기 후 count==2 재확인). vitest 의 fake timer 나 `waitFor` + retry 역-assertion 패턴이 더 결정론적이다.
- 제안: `vi.useFakeTimers()` + `vi.runAllTimersAsync()` 로 실시간 대기를 제거하거나, `waitFor(() => expect(...).toBe(n), { timeout: 50 })` 후 동일 체크를 한 번 더 실행하는 패턴으로 전환. 현재 20ms 는 실용적으로 충분하나 백로그로 기록 권장.

### [INFO] `widget-app.test.tsx` 에 open 시 webhook POST 검증 없음 — eager start 의 최상위 통합 커버리지 갭
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/widget-app.test.tsx`
- 상세: `widget-app.test.tsx` 는 런처 클릭 → 패널 렌더를 검증하지만, 런처 클릭 시 `POST /api/hooks/t1` 이 발생하는지, 그리고 firstMessage 가 포함되지 않는지를 검증하지 않는다. `use-widget-eager-start.test.ts` 가 hook 수준에서 이를 커버하지만, widget-app 수준에서의 통합 시나리오(클릭 → 네트워크 요청)는 검증 범위 밖이다. spec §R6 의 핵심 계약이므로 최상위 통합 테스트에서도 최소 1건의 확인이 있는 것이 바람직하다.
- 제안: `widget-app.test.tsx` 에 "런처 클릭 → POST hooks 1회(firstMessage 미포함)" 케이스 추가를 고려. 단, `use-widget-eager-start.test.ts` 가 훅 수준에서 충분히 검증하고 있으므로 필수는 아님.

### [INFO] `panel.test.tsx` — BASE_ACTIONS mock 이 테스트 간 공유되어 호출 횟수 누적 위험
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/components/panel.test.tsx` — `BASE_ACTIONS` 정의
- 상세: `BASE_ACTIONS` 의 `vi.fn()` 들이 모듈 최상위에서 한 번 생성되어 모든 테스트가 공유한다. 각 테스트에서 `vi.clearAllMocks()` 나 `beforeEach` 가 없으므로, 이전 테스트에서 `submitMessage` 등이 호출됐다면 다음 테스트에서 호출 횟수가 누적된다. 현재 테스트들은 `mock.calls` 를 검증하지 않으므로 실제 문제는 없으나, 향후 행동 단언(예: `expect(BASE_ACTIONS.submitMessage).toHaveBeenCalledTimes(0)`)을 추가할 경우 false positive 가 발생한다.
- 제안: `beforeEach(() => vi.clearAllMocks())` 추가 또는 `BASE_ACTIONS` 를 `beforeEach` 내부에서 재생성. 현재는 상태 단언(disabled/enabled)만 하므로 INFO 수준.

### [INFO] `ControllableEventSource` — `removeEventListener` 미구현으로 실제 동작과 괴리
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` — `ControllableEventSource` class
- 상세: `ControllableEventSource` 는 `addEventListener` 와 `close` 만 구현했고 `removeEventListener` 가 없다. `eia-client.ts` 의 `openStream` 이 `removeEventListener` 를 호출하는 경우 리스너 누수가 발생하거나 호출 자체가 무시된다. 또한 리스너 맵(`listeners`)이 이벤트 타입당 단일 함수만 저장해, 동일 타입에 여러 리스너가 등록되면 마지막 것만 남는다. 현재 `eia-client.ts` 의 `openStream` 구현이 타입별 단일 리스너를 등록하므로 실제로는 문제없으나, 구현 변경 시 조용히 실패할 수 있다.
- 제안: `removeEventListener(type: string) { delete this.listeners[type]; }` 추가 및 리스너 저장을 배열로 확장하는 것을 고려. 현재 테스트 통과 수준에서는 INFO.

### [INFO] ended 상태에서 재-open 경로 테스트 미존재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`
- 상세: W8 테스트(webhook 500 실패 → ERROR → 재open)는 실패 후 재시작을 검증한다. 그러나 정상적으로 `ended` 상태(워크플로우 완료)에 도달한 후 재-open 시 동작은 테스트되지 않는다. `ended` 상태에서 open() 호출 시 `startedRef.current` 가 여전히 true 이면 새 execution 이 시작되지 않는다. 이것이 의도된 동작인지(`ended` 후 새 대화는 `newChat` 으로만 가능) 명시된 테스트가 없다.
- 제안: "phase=ended → open() no-op (새 POST 없음)" 또는 "phase=ended → open() → 새 POST(startedRef 복구)" 중 의도된 동작을 케이스로 추가. 후속 backlog 수준.

### [INFO] C1 flush effect — `buttons`/`form` 첫 표면 시 큐 폐기 경로 미검증
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` — C1 테스트
- 상세: C1 테스트는 `ai_conversation` 표면 도착 시 큐에 있던 텍스트가 `submit_message` 로 flush 되는 경로를 검증한다. 그러나 `use-widget.ts` flush effect 내에는 첫 표면이 `buttons`/`form` 인 경우 큐를 폐기하는 분기(`pendingSendRef.current = null`)도 있다. 이 분기(booting 중 submitMessage → buttons 표면 도착 → 큐 폐기, interact 미호출)는 테스트되지 않는다.
- 제안: "open 직후 submitMessage → 첫 표면이 buttons → interact 미호출(큐 폐기)" 케이스 추가. 현재 flush effect 코드가 이 경로를 처리하지만, 명시적 테스트 없이는 회귀 위험이 있다. 백로그 수준.

## 요약

이번 변경은 lazy → eager 시작 전환(§R6)에 대한 테스트를 체계적으로 추가했다. `use-widget-eager-start.test.ts` 신규 생성(open→POST, 중복 open 단일 시작, 세션 복원 미시작, C1 queue-flush, W7 newChat 재시작, W8 실패 재시도 6개 케이스), `panel.test.tsx` 신규 생성(Composer disabled 게이팅 6개 케이스), `widget-state.test.ts`/`eia-client.test.ts` 기존 테스트 업데이트가 모두 수행되어 핵심 계약 변경(firstMessage 제거, START 무인자, Composer 게이팅)이 테스트로 고착됐다. 이전 리뷰(12_14_27)에서 지적된 W5/W6/W7/W8 테스트 미존재 이슈도 모두 해결됐다. 잔존 갭은 주로 INFO 수준으로: (1) negative assertion 의 시간 대기 패턴이 결정론적이지 않고, (2) panel.test.tsx 공유 mock의 잠재적 누적 위험, (3) C1 flush effect의 buttons/form 폐기 경로 미검증, (4) ended 상태 재-open 동작 미명시가 있다. 전체적으로 테스트 커버리지는 양호하며 주요 시나리오가 모두 검증되고 있다.

## 위험도

LOW

STATUS: SUCCESS
