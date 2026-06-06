# 테스트(Testing) 리뷰

## 발견사항

### [INFO] 전반적 테스트 커버리지 — 이전 리뷰(12_14_27) 지적 사항 완전 이행
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`, `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/components/panel.test.tsx`, `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/lib/eia-client.test.ts`
- 상세: 이전 리뷰(12_14_27)에서 MEDIUM 위험으로 지적된 W5(eia-client firstMessage 구버전 단언), W6(panel disabled 게이팅 미검증), W7(newChat 재시작 미검증), W8(실패 재시도 미검증)이 이번 커밋(6a4af359)에서 모두 해소됐다. unit 172→181(9건 신규), e2e 174/174 통과. 테스트 추가 방향과 구조 모두 적절하다.

### [INFO] `eia-client.test.ts` — `not.toHaveProperty("firstMessage")` 단언 적절성 확인
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/lib/eia-client.test.ts` (diff 라인 46)
- 상세: 계약 변경(§R6 — firstMessage 폐기)을 `not.toHaveProperty("firstMessage")` 부정 단언 + `toMatchObject({ profile })` 긍정 단언으로 검증하는 방식은 테스트 의도(구버전 단언 제거 + 신규 계약 확인)를 명확히 표현한다. 두 단언이 같은 `JSON.parse(init.body)` 객체를 두 번 파싱하는 것은 미묘한 낭비이지만(큰 객체에서만 문제가 되며, 여기서는 무시 가능), const 로 추출하면 가독성이 개선된다.
- 제안(선택): `const body = JSON.parse(init.body);` 로 추출 후 두 단언에 재사용. 필수 아님.

### [INFO] `widget-state.test.ts` — `START` 액션 무인자 전환 후 회귀 테스트 양호
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/lib/widget-state.test.ts` (diff 라인 97–103, 109–110, 117–118)
- 상세: `START: 첫 입력 → booting + 사용자 메시지` → `START: eager 시작(open 시) → booting, 사용자 메시지 없음(§R6)` 로 개정됐다. `expect(s.messages).toHaveLength(0)` 로 eager 시작 시 메시지 비추가를 명시적으로 검증하는 것은 핵심 계약 변경을 포착하는 좋은 단언이다. 나머지 두 곳(`BOOTED`, `NEW_CHAT` 테스트)도 `START` 무인자로 자연스럽게 업데이트됐다.

### [INFO] `panel.test.tsx` — 신규 파일, 테스트 구조 및 격리 양호
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/components/panel.test.tsx`
- 상세: `BASE_CONFIG`/`BASE_ACTIONS`/`makeState` 헬퍼로 반복 코드를 최소화했다. 각 `it` 블록이 독립적으로 render 하며 전역 상태를 공유하지 않아 격리가 양호하다. `vi.fn()` mock 이 `BASE_ACTIONS`에 한 번 선언되고 각 테스트에서 재사용되는데, 액션 함수들이 호출 횟수를 단언하지 않으므로 테스트 간 mock 상태 누적이 문제되지 않는다. 6종 조합(booting·streaming·buttons·form → disabled; ai_conversation·null → enabled)이 §R6 의 핵심 UX 계약을 충분히 커버한다.

### [WARNING] `panel.test.tsx` — `ended` phase 에서 Composer 렌더 자체가 없는지 미검증
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/components/panel.tsx` (diff 라인 321: `{!isEnded && (<Composer .../>)}`)
- 상세: `phase === "ended"` 에서 `Composer` 가 DOM 에서 제거된다(`!isEnded` 조건). 이번 테스트는 booting/streaming/buttons/form/ai_conversation/null 6종을 커버하지만, `ended` phase 는 Composer 존재 자체를 테스트하지 않는다. `getByLabelText("메시지 입력")` 이 `ended` phase 에서 not.toBeInTheDocument() 임을 확인하는 케이스가 없어, `!isEnded` 조건이 제거되는 회귀를 잡지 못한다.
- 제안: `phase=ended → Composer 미렌더` 케이스 1개 추가. `expect(screen.queryByLabelText("메시지 입력")).not.toBeInTheDocument()` 로 검증.

### [WARNING] `use-widget-eager-start.test.ts` — `setTimeout(r, NO_EXTRA_CALL_WAIT_MS)` 타이밍 의존 패턴 — fake timer 전환 미완료
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` (라인 481–482, 497–498, 575–576)
- 상세: 이전 리뷰(I8)에서 상수 추출(NO_EXTRA_CALL_WAIT_MS=20)은 이행됐으나, 실제 wall-clock `setTimeout` 대기 패턴은 그대로 남아 있다. CI 환경 부하·jsdom 스케줄러 특성에 따라 20ms 가 충분하지 않아 false negative(추가 POST가 실제로는 없는데 assertion 전에 실행되어 통과)가 발생하거나, 반대로 테스트가 느려질 수 있다. `vitest` 의 `vi.useFakeTimers()` + `vi.runAllTimersAsync()` 패턴이나 `waitFor` + polling 으로 대체하면 타이밍 의존성을 없앨 수 있다.
- 제안: `beforeEach` 에 `vi.useFakeTimers()`, `afterEach` 에 `vi.useRealTimers()` 적용. 단, `waitFor` 내부가 fake timer 와 충돌할 수 있으므로 `vi.runAllTimersAsync()` 를 `waitFor` 완료 후 사용하는 패턴 적용. 아니면 "추가 POST 없음" 단언을 `waitFor(() => ..., { timeout: 100 })` + try/catch 형태로 구조화.

### [INFO] `use-widget-eager-start.test.ts` — C1 테스트의 `ControllableEventSource` 패턴 우수
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` (라인 373–383, 502–558)
- 상세: SSE 이벤트를 수동으로 주입(`emit`)할 수 있는 `ControllableEventSource` 를 도입해 SSE → 큐 flush → submit_message 전체 흐름을 결정적으로 검증한다. 실제 동작과의 괴리가 최소화된 적절한 수준의 fake 설계다. `latestEs` 클로저 패턴으로 인스턴스 캡처가 명확하다.

### [WARNING] `use-widget-eager-start.test.ts` — W8 테스트에서 `ERROR` → `ended` 전환 가정이 암묵적
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` (라인 615: `expect(result.current.state.phase).toBe("ended")`)
- 상세: W8 테스트가 `dispatch({ type: "ERROR" })` 가 phase 를 `"ended"` 로 전환한다고 가정해 `waitFor(() => expect(result.current.state.phase).toBe("ended"))` 로 검증한다. 그러나 `widget-state.ts` 의 `ERROR` 리듀서가 실제로 `"ended"` 를 반환하는지는 reducer 단위 테스트에서 검증되지 않는다. 주석의 `// ERROR → ended` 가 암묵적 계약으로만 남아 있다. `widget-state.test.ts` 에 `ERROR` action → phase=ended 케이스가 없으면 reducer 변경 시 W8 테스트가 timeout 으로 실패하여 원인 파악이 어렵다.
- 제안: `widget-state.test.ts` 에 `ERROR` 액션 → `phase === "ended"` 단언 케이스 추가. 또는 W8 테스트에 주석으로 "ERROR 액션이 ended 전환함 — widget-state.test.ts 의 ERROR 케이스 참조" 명시.

### [INFO] `use-widget-eager-start.test.ts` — `boot()` 헬퍼의 `origin: "http://host.test"` 고정 — jsdom 환경 의도 명확
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` (라인 422–431)
- 상세: jsdom 에서 `postMessage` 의 `e.origin` 이 빈 문자열(`""`)로 나오는 문제를 `origin: "http://host.test"` 명시로 회피한 패턴은 주석으로 잘 설명되어 있다. Mock 의도가 명확하고 실제 브라우저 동작과의 괴리도 주석으로 문서화됐다.

### [INFO] `panel.test.tsx` — `BASE_ACTIONS` 의 `vi.fn()` mock 이 테스트 간 `clearMock` 없이 재사용
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/components/panel.test.tsx` (라인 14–20)
- 상세: `vi.fn()` 이 모듈 최상위에서 한 번 생성되어 모든 `it` 블록이 같은 인스턴스를 공유한다. 현재 테스트는 mock 함수가 몇 번 호출됐는지 단언하지 않으므로 실제 문제가 없다. 하지만 향후 호출 횟수·인자 검증 케이스가 추가될 경우, `beforeEach(() => vi.clearAllMocks())` 가 없으면 이전 테스트의 호출 이력이 누적되어 잘못된 결과를 유발할 수 있다.
- 제안: `beforeEach(() => vi.clearAllMocks())` 추가. 또는 `BASE_ACTIONS` 를 `makeState` 처럼 각 테스트에서 `vi.fn()` 을 새로 생성하는 헬퍼 함수로 변환.

### [INFO] `use-widget-eager-start.test.ts` — 세션 복원 후 재open 시 `submitMessage` 동작 경로 미검증
- 위치: 테스트 파일 전반
- 상세: 세션 복원(localStorage 세션 존재) 시나리오에서 `open()` 이 새 execution 을 시작하지 않음을 검증하는 케이스(3번째 it)는 있다. 그러나 복원된 세션 상태에서 `submitMessage` 를 직접 호출할 경우 올바르게 interact API 를 호출하는지, 아니면 큐(pendingSendRef)에 들어가는지에 대한 경로가 테스트되지 않는다. 복원 세션은 executionId 가 있고 phase 가 곧바로 `streaming` 등으로 전환되므로 flush effect 경로와 교차할 수 있다.
- 제안(선택): 복원 세션 + `open()` + `submitMessage` 흐름 케이스 추가. 현재 e2e 174/174 통과로 기능 보장은 되어 있으나 unit 수준 커버리지 갭이다. 백로그 수준.

## 요약

이번 변경은 이전 리뷰(12_14_27)에서 MEDIUM 위험으로 분류된 테스트 커버리지 갭(W5·W6·W7·W8) 전체를 해소했다. `eia-client.test.ts` 의 firstMessage 계약 단언 갱신, `widget-state.test.ts` 의 eager START 회귀 검증, `panel.test.tsx` 신규 파일(6종 조합), `use-widget-eager-start.test.ts` 신규 파일(open→POST, 중복 open 단일, 세션 복원, C1 큐-flush, newChat, 실패 재시도)은 모두 적절하고 테스트 격리·가독성·의도 표현이 양호하다. 잔여 우려는 두 가지다: (1) `panel.test.tsx` 에 `ended` phase Composer 미렌더 케이스가 없어 `!isEnded` 조건 회귀를 잡지 못하는 점(WARNING), (2) "추가 POST 없음" 검증에 wall-clock `setTimeout(r, 20ms)` 를 사용해 CI 환경 의존 타이밍 취약점이 남아 있는 점(WARNING). `BASE_ACTIONS` mock clearMock 누락(INFO)과 `ERROR` → `ended` 전환 암묵적 가정(WARNING)도 향후 케이스 추가 시 혼란 원인이 될 수 있다.

## 위험도

LOW

STATUS: SUCCESS
