# 요구사항(Requirement) 리뷰

> 대상: webchat eager start (§R6 — 패널 open 시 execution 시작, firstMessage 폐기)
> 세션: `review/code/2026/06/06/12_47_01`

---

## 발견사항

### [INFO] C1 큐(pendingSendRef) — newChat() 시 미초기화

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — `newChat` 콜백 (line 310–322)
- 상세: `newChat()` 이 실행될 때 `pendingSendRef.current` 를 초기화(`= null`)하지 않는다. 이전 대화의 booting 중 사용자가 텍스트를 입력해 큐에 남아 있었을 경우, `newChat()` 후 새 대화의 `awaiting_user_message` 진입 시 flush effect 가 이전 대화의 텍스트를 전송해 버릴 수 있다. 실제 발생 경로: `open() → submitMessage("old text") → [booting 중 → 큐에 쌓임] → newChat() → [새 대화 awaiting_user_message 진입] → flush effect 가 "old text" 전송`. `newChat` 후 `start()` 가 호출되고 새 execution 이 `awaiting_user_message` 에 도달하면 이전 큐가 flush 된다.
- 제안: `newChat()` 내 `sessionRef.current = null` 직후에 `pendingSendRef.current = null` 추가.

### [INFO] [SPEC-DRIFT] spec 상태기계 다이어그램의 `awaiting_user_message` — 이미 반영됨 확인

- 위치: `spec/7-channel-web-chat/1-widget-app.md` §3 다이어그램 line 55
- 상세: 이전 리뷰 세션(12_14_27)의 I2 SPEC-DRIFT 지적이었던 `awaiting_user_input` vs `awaiting_user_message` 불일치는, 현재 spec 파일(line 55)에서 이미 `[awaiting_user_message]` 로 올바르게 표기돼 있다. 이전 RESOLUTION.md 에서 SPEC-DRIFT draft 로 분류됐으나 이미 해결된 상태다. 추가 조치 불필요.
- 제안: `plan/in-progress/spec-update-webchat-eager-start.md` 의 I2 항목이 실제로 반영됐는지 확인 후 closed 처리 권장.

### [INFO] 재open(ended 상태) 후 open() 동작 — 테스트 미검증

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — `open()` / `start()`
- 상세: `ended` 상태에서 사용자가 닫기 버튼 없이(패널 열린 채로) 런처 버튼을 다시 탭하면 `open()` 이 재호출된다. 이때 `startedRef.current` 는 true 이므로 `start()` 가 no-op 이 되어 새 execution 이 시작되지 않는다. `ended` 상태 재open 은 `newChat()` 을 통해서만 새 execution 을 시작할 수 있다는 계약인데, 이 경로가 테스트로 검증되어 있지 않다. 사용자가 `ended` 패널에서 런처를 다시 탭하는 실 시나리오에서 아무 반응이 없을 수 있다.
- 제안: `ended + open() → no-op` 또는 `ended + open() → newChat 자동 진입` 중 어느 것이 의도인지 spec §3 상태기계에서 명확히 하고, 해당 경로 테스트 추가. INFO 수준 — 현재 spec §3 다이어그램(`[ended] ──new chat──▶ [booting]`)은 `new chat` 트리거가 명시적 CTA 임을 암시하므로 no-op 이 의도에 부합할 수 있다.

### [INFO] `submitMessage` — booting/streaming 외 `panel` phase 큐 저장

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — `submitMessage` (line 241–259)
- 상세: `submitMessage` 의 else 분기는 `sessionRef.current` 가 없거나, phase 가 `awaiting_user_message` 가 아니거나, pending 이 `buttons`/`form` 인 모든 경우를 큐에 담는다. `panel` phase(open 직후 start() 호출 전 극히 짧은 transient) 에서 호출되면 큐에 담기고, 이후 새 대화가 `awaiting_user_message` + `ai_conversation` 으로 도달 시 flush 된다. 이 경로는 의도된 동작(C1 큐 설계)이다. 단 `ended` phase 에서 호출해도 큐에 담기는데, 이미 `Composer` 가 `!isEnded` 조건으로 렌더 자체를 막으므로 실제 경로는 없다. INFO 수준.
- 제안: 현재 수준 충분. 큐 폐기 조건(buttons/form)은 flush effect 에서 처리되므로 OK.

---

## Spec Fidelity 점검

대상 spec: `spec/7-channel-web-chat/1-widget-app.md` §3, §R6 / `spec/7-channel-web-chat/3-auth-session.md` §3

| spec 요구사항 | 코드 구현 | 판정 |
|---|---|---|
| 패널 open 시 `POST /api/hooks/:path { profile }` — firstMessage 미동봉 (§R6, 3-auth-session §3 step1) | `eia-client.ts` payload 타입 `{ profile?: ... }`, `firstMessage` 필드 제거. `use-widget.ts` `start()` 에서 `{ profile: cfg.profile }` 만 전송 | 일치 |
| `startedRef` 가드 — 재open·중복 open 시 1회만 시작 (§R6 재open 복원) | `startedRef` + `sessionRef.current` 이중 가드 구현. 세션 복원 시 `startedRef.current = true` 설정 | 일치 |
| `firstMessage` 폐기 — 첫 사용자 텍스트는 일반 `submit_message` (§R6) | `submitMessage` 가 `awaiting_user_message` + `ai_conversation` 에서 즉시 전송 또는 C1 큐 | 일치 |
| `NEW_CHAT` → 새 `POST /api/hooks/:path` (3-auth-session §3 "새 대화(restart)" 행) | `newChat()` 에서 `startedRef.current = false` 후 `void start()` | 일치 |
| phase 전이: `collapsed → panel(transient) → booting → streaming → awaiting_user_message` (§3 다이어그램) | `widget-state.ts` 상태기계 전이 순서 일치. `panel` 은 transient 로 명시 | 일치 |
| Composer disabled: booting/streaming/buttons/form (§3 §R6 "첫 표면 렌더") | `panel.tsx` Composer disabled = `phase !== "awaiting_user_message" \|\| pending?.type === "buttons" \|\| pending?.type === "form"` | 일치 |
| 세션 복원 시 신규 execution 미시작 (§3.1 재로드 복원) | `applyConfig` 에서 `startedRef.current = true` 설정 후 `open()` 호출 시 `start()` no-op | 일치 |
| `updateProfile` — 다음 워크플로우 시작(패널 open/새 대화)에만 반영 (§3.2) | `use-widget.ts` 주석 "다음 시작(패널 open/새 대화)"으로 수정됨 | 일치 |

---

## 요약

이번 변경은 §R6 eager start-on-open 요구사항을 코드 레벨에서 충실히 구현했다. `firstMessage` 폐기·`startedRef` 중복 가드·`pendingSendRef` 큐(C1)·`newChat` 타이머 정리(W9)·Composer disabled 게이팅(W6)·`eia-client` payload 타입 수정(W5)·테스트 커버리지(W7/W8)가 모두 완료됐다. spec `1-widget-app.md` §3 다이어그램의 `awaiting_user_message` 표기도 이미 반영된 상태다. 하나의 INFO 수준 기능 결함이 발견됐다: `newChat()` 시 `pendingSendRef` 를 초기화하지 않아 이전 대화의 큐 텍스트가 새 대화에 유출될 수 있다. 이는 사용자가 booting 중 입력 후 즉시 새 대화를 시작하는 드문 경로에서만 발생하며, Composer 비활성 게이팅이 booting 중 입력 자체를 막으므로 실제 발생 가능성은 런처 버블·suggestions 탭 경로로 제한된다. CRITICAL/WARNING 수준의 새로운 요구사항 누락은 없다.

## 위험도

LOW
