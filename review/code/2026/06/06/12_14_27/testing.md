# Testing Review — webchat eager start (§R6)

## 발견사항

### [WARNING] `eia-client.test.ts` — startConversation 테스트가 구버전 payload(`firstMessage`) 검증
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/lib/eia-client.test.ts` L80, L87
- 상세: `startConversation` 호출 시 `firstMessage: "hi"` 를 payload 에 포함해 전송하고, `expect(JSON.parse(init.body)).toMatchObject({ firstMessage: "hi" })` 로 검증한다. 이는 eager 시작(§R6)에서 `firstMessage` 를 폐기한 변경과 직접 충돌한다. 현재 `EiaClient.startConversation` 의 타입 시그니처에서 `firstMessage` 가 제거됐지만(`payload: { profile?: ...; [k: string]: unknown }`), 테스트는 여전히 이를 payload 로 내려보내 "firstMessage 미포함" 계약을 검증하지 않는다.
- 제안: `firstMessage` 관련 단언을 제거하고, payload 에 `firstMessage` 가 포함되지 **않는** 것을 검증하는 단언(`expect(JSON.parse(init.body)).not.toHaveProperty("firstMessage")`)을 추가. 또는 use-widget-eager-start.test.ts 의 동일 검증과 역할을 분리해 eia-client 레벨 테스트는 payload shape 에 무관하게 HTTP 동작만 검증하도록 단순화.

---

### [WARNING] `panel.tsx` Composer disabled 로직 — 전용 단위/통합 테스트 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/components/panel.tsx` L776-L783
- 상세: eager 시작 전환의 핵심 UX 변경 — Composer 가 `phase !== "awaiting_user_message" || pending?.type === "buttons" || pending?.type === "form"` 일 때 disabled 되는 로직이 추가됐다. `widget-app.test.tsx` 는 패널 렌더 여부만 검증하며, `panel.tsx` 의 새 disabled 조건(booting/streaming 중 입력 비활성, buttons/form pending 시 비활성)을 직접 테스트하는 케이스가 없다. 특히 `phase === "awaiting_user_message"` + `pending?.type === "buttons"` 조합처럼 두 조건이 AND 로 작동하는 경계값이 검증되지 않는다.
- 제안: `panel.tsx` 에 대한 별도 unit 테스트 파일(예: `panel.test.tsx`)을 추가하거나 `widget-app.test.tsx` 에 다음 케이스 보강:
  1. `phase=booting` 시 Composer disabled
  2. `phase=streaming` 시 Composer disabled
  3. `phase=awaiting_user_message` + `pending=null` 시 Composer enabled
  4. `phase=awaiting_user_message` + `pending.type=buttons` 시 Composer disabled
  5. `phase=awaiting_user_message` + `pending.type=form` 시 Composer disabled

---

### [WARNING] `use-widget.ts` newChat — eager 재시작 테스트 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` L1463-L1470
- 상세: `newChat` 콜백이 세션·스트림 정리 후 `startedRef=false` 로 초기화하고 `start()` 를 즉시 호출하는 eager 재시작 로직을 포함한다. `use-widget-eager-start.test.ts` 의 3개 케이스는 모두 최초 open 시나리오를 다루며, newChat 후 execution 이 새로 시작되는지, 그리고 newChat 중 세션이 올바르게 정리되는지를 검증하는 테스트가 없다.
- 제안: `use-widget-eager-start.test.ts` 에 다음 케이스 추가:
  - `newChat()` 호출 → 기존 세션 정리 → 새 webhook POST 1회 발생 검증
  - `newChat()` 후 startedRef 가 false 로 리셋됨을 행동으로 확인(두 번째 open 이 새 POST 를 내지 않음)

---

### [WARNING] `start()` 실패 후 재시도 경로 — 테스트 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` L1402-L1404
- 상세: `start()` 에서 webhook POST 가 실패하면 `startedRef.current = false` 로 복구해 재open/새 대화 시 재시도를 허용한다. 이 실패-복구-재시도 흐름을 검증하는 테스트가 없다. 특히 첫 open 에서 webhook 실패 후 사용자가 다시 open 했을 때 새 POST 가 발생하는지 검증되지 않는다.
- 제안: `use-widget-eager-start.test.ts` 에 추가:
  - webhook POST 가 500 으로 실패 → `ERROR` 디스패치 → 재open 시 새 POST 발생 검증

---

### [INFO] `use-widget-eager-start.test.ts` — `setTimeout` 기반 폴링으로 "추가 POST 없음" 검증
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` L907-L908, L923-L924
- 상세: "추가 POST 없음"을 검증하기 위해 `await new Promise((r) => setTimeout(r, 20))` 를 사용하는데, 이는 타이밍에 의존하는 취약한 패턴이다. 환경 부하에 따라 false positive 또는 flake 가 발생할 수 있다. 특히 비동기 체인이 길어질 경우 20ms 가 부족할 수 있다.
- 제안: `vitest` 의 fake timer(`vi.useFakeTimers`) 또는 `waitFor` + 카운터 단언으로 대체하는 것이 더 견고하다. 단, 현재 `waitFor` 로 1회 POST 를 대기한 이후에 추가 POST 가 없음을 검증하는 방식은 실용적으로 수용 가능한 범위.

---

### [INFO] `widget-state.test.ts` — `panel` phase 에서 START 동작 테스트 미갱신
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/lib/widget-state.test.ts` L299-L305
- 상세: 변경된 테스트("START: eager 시작(open 시) → booting, 사용자 메시지 없음")는 `OPEN` 후 `START` 를 하는 정상 경로를 잘 검증한다. 그러나 `panel` phase 없이 초기 상태에서 `START` 를 직접 디스패치했을 때의 동작(state machine 상 허용 여부)은 테스트되지 않는다. state machine 다이어그램(코드 상단 주석)에서 `panel` phase 자체가 eager 전환 후 사실상 제거됐으므로, `initialState → START` 케이스의 명시적 검증이 있으면 회귀 방지에 유용하다.
- 제안: `collapsed` 상태에서 직접 `START` 를 보내도 `booting` + `open=true` 로 전환됨을 검증하는 케이스 추가(현재 reducer 는 허용하지만 테스트에 명시 안 됨).

---

### [INFO] `eia-client.test.ts` — `startConversation` 에 `profile` 전용 payload 테스트 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/lib/eia-client.test.ts` L67-L108
- 상세: 클라이언트 레벨에서 `{ profile: {...} }` 만 담긴 payload 가 올바르게 직렬화되는지를 검증하는 케이스가 없다. 기존 테스트(`startConversation` L80)는 `firstMessage` 를 포함한 payload 를 사용 중이어서, 변경된 계약("profile 만")을 직접 단언하지 않는다.
- 제안: `{ profile: { plan: "free" } }` payload 로 POST 후 body 에 `firstMessage` 없음 + `profile` 있음을 검증하는 케이스 추가(단, WARNING #1 과 병합 처리 가능).

---

## 요약

전체적으로 eager 시작(§R6) 전환에 대한 핵심 행동 테스트(`use-widget-eager-start.test.ts`)가 신설됐고, `widget-state.test.ts` 도 새 동작에 맞게 일관성 있게 갱신됐다. 그러나 두 가지 WARNING 수준 문제가 있다: (1) `eia-client.test.ts` 의 `startConversation` 테스트가 폐기된 `firstMessage` payload 를 여전히 전송·검증하고 있어 구버전 계약을 암묵적으로 테스트하며, (2) `panel.tsx` 의 새 Composer disabled 조건(eager 시작 핵심 UX)을 검증하는 케이스가 전혀 없다. `newChat` eager 재시작과 webhook 실패-재시도 경로도 커버되지 않는다.

## 위험도

MEDIUM
