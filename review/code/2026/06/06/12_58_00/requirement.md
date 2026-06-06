# 요구사항(Requirement) 리뷰

> 대상: webchat eager start (§R6 — 패널 open 시 execution 시작, firstMessage 폐기)
> 리뷰 파일: eia-client.ts/test, widget-state.ts/test, panel.tsx/test, use-widget-eager-start.test.ts, use-widget.ts, plan, RESOLUTION.md, SUMMARY.md, 이전 리뷰 산출물

---

## 발견사항

### [INFO] 기능 완전성 — 핵심 요구사항 충족 확인

- 위치: 전 파일
- 상세: 이번 변경은 이전 리뷰 세션(12_14_27)에서 식별된 C1(런처 추천질문 텍스트 유실) + W1~W10 + I 시리즈를 resolution-applier 가 commit 6a4af359 로 처리한 결과물이다. 핵심 기능 요구사항인 §R6(패널 open 시 eager 시작)가 다음 4개 계층에서 일관되게 구현되었다:
  1. `eia-client.ts`: `startConversation` payload 에서 `firstMessage` 제거, `profile` 만 전달.
  2. `widget-state.ts`: `START` 액션에서 `userText` 필드 제거, 메시지 추가 로직 삭제.
  3. `use-widget.ts`: `open()` 호출 시 `start()` 자동 발행, `startedRef` 중복 가드, C1 `pendingSendRef` 큐+flush effect.
  4. `panel.tsx`: `Composer` disabled 조건을 `phase !== "awaiting_user_message" || buttons || form` 으로 확장.
- 제안: 없음.

### [INFO] C1 큐-flush 구현 — 요구사항 충족

- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` (submitMessage, C1 flush useEffect)
- 상세: 이전 리뷰 C1(런처/추천질문 탭 시 booting 중 텍스트 유실) 수정 사항이 올바르게 구현되었다. `pendingSendRef.current = text` 큐잉 → `awaiting_user_message` + `ai_conversation` 표면 진입 시 `submit_message` 전송 flush effect 가 동작하며, 테스트(`use-widget-eager-start.test.ts` C1 케이스)에서 `ControllableEventSource` SSE 주입으로 검증된다. buttons/form 첫 표면 도달 시 큐 폐기(텍스트 제출 비대상) 처리도 완료.
- 제안: 없음.

### [INFO] W1 suggestions 비활성 — 큐 경로 위임 주석 추가 확인

- 위치: `codebase/channel-web-chat/src/widget/components/panel.tsx` (L314-315)
- 상세: 이전 리뷰 W1(패널 welcome.suggestions 탭 중 booting 단계 메시지 유실) 처리 방향이 "비활성 처리" 대신 "C1 큐 흡수" 주석 명시 방식으로 결정되었다. 주석이 추가되어 의도가 문서화되었다. 런처 버블 탭 직후 booting 중 패널 suggestions 탭 역시 `submitMessage` → `pendingSendRef` 큐 경로를 타 텍스트가 보존된다.
- 제안: 없음.

### [INFO] [SPEC-DRIFT] `spec/7-channel-web-chat/3-auth-session.md §3` 세션 시퀀스 step 1 — 워크트리 spec 이미 갱신됨

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/spec/7-channel-web-chat/3-auth-session.md` 40행
- 상세: 워크트리 내 3-auth-session.md step 1 이 이미 `POST /api/hooks/:path { profile }` (firstMessage 미동봉) 으로 갱신되어 있다. 코드 구현과 spec 본문이 일치한다. main 브랜치 spec 은 여전히 `{ profile, firstMessage }` 를 기술하고 있으나, 이는 이 PR 의 spec 갱신 대상이며 RESOLUTION.md 에 처리가 위임 기록되었다.
- 제안: 코드 유지. main 브랜치에 머지 시 spec 갱신이 PR 내에서 이루어졌으므로 별도 조치 불필요.

### [INFO] [SPEC-DRIFT] `spec/7-channel-web-chat/1-widget-app.md §3` 상태기계 다이어그램 — 워크트리 spec 이미 갱신됨

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/spec/7-channel-web-chat/1-widget-app.md` 55행
- 상세: 워크트리 spec 다이어그램이 `[panel](transient)──eager start──▶ [booting]` 으로 갱신되어 있고, `awaiting_user_message` 로 phase 명도 수정되었다. 이전 리뷰의 SPEC-DRIFT I1(panel 중간 단계 미표현), I2(awaiting_user_input vs awaiting_user_message 불일치), W2(런처 버블 설명 eager 기준 미반영) 가 모두 spec 본문에 반영된 상태다. §R6 Rationale 도 신규 추가되어 결정 근거가 완전히 기록되었다.
- 제안: 코드 및 spec 유지.

### [INFO] 에러 시나리오 — webhook 실패 시 `startedRef` 복구 경로

- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` start() catch 블록
- 상세: webhook POST 실패 시 `startedRef.current = false` 로 재설정해 재open 시 새 POST 가 발행된다. W8 테스트(webhook 500 실패 → ERROR phase → 재open 시 새 POST)가 이를 검증한다. `dispatch({ type: "ERROR" })` 는 `ended` phase 로 전환되므로 실패 후 상태가 booting 에 영구 머무르는 문제가 없다.
- 제안: 없음.

### [INFO] 저장 세션 복원 시 `startedRef` 선제 세팅

- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` applyConfig 내 복원 분기 (L817)
- 상세: `saved` 세션 발견 시 `startedRef.current = true` 를 먼저 세팅해 이후 `open()` 호출이 새 execution 을 시작하지 않도록 한다. W3 테스트(복원 세션 → open() 시 새 webhook POST 없음)가 검증된다.
- 제안: 없음.

### [INFO] `submitMessage` 조건 — `pending?.type` 제외 목록 방식

- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` submitMessage 콜백 (L727-731), `panel.tsx` Composer disabled (L326-331)
- 상세: 두 계층 모두 `buttons`, `form` 을 exclude 목록으로 처리한다. `ExternalInteractionType` 이 확장될 경우 누락 위험이 있으나 이는 이미 이전 리뷰 I6(allowlist 전환 권고)로 backlog 에 기록되었다. 현재 타입 값이 3개(`ai_conversation`/`buttons`/`form`)로 고정이므로 즉각 수정 필요는 없다.
- 제안: 없음(기존 backlog I6 유지).

### [WARNING] `actions.start` 외부 공개 — 하위 호환 목적 노출이나 오용 가능성

- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` L826 반환 객체
- 상세: `start` 가 `actions` 에 공개 노출되어 있어 외부 소비자가 직접 호출 가능하다. eager 시작 후에는 `open()` 이 자동으로 `start()` 를 호출하므로 직접 호출이 불필요하며, 호출하더라도 `startedRef`/`sessionRef` 가드가 막는다. I3 주석("open 이 자동 호출 — 외부 직접 호출 불필요. 하위 호환 목적")이 추가되어 의도는 문서화되었다.
- 그러나 **하위 호환 목적이 구체적으로 명시되지 않았다** — 어떤 기존 소비자가 `start()` 를 직접 호출하고 있는지 코드 내에서 확인이 필요하다. 만약 현재 실제 호출 경로가 없다면 `start` 를 반환 객체에서 제거하는 것이 더 안전하다.
- 제안: 코드베이스 전체에서 `actions.start` 직접 호출 경로를 grep 으로 확인. 사용 경로 없으면 반환 객체에서 제거 검토. 현재 단계에서는 WARNING 수준.

### [INFO] `3-auth-session.md §3` 세션 시퀀스 step 5 — 커맨드 목록 갱신 확인

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/spec/7-channel-web-chat/3-auth-session.md` 46행
- 상세: step 5 가 `submit_message|click_button|submit_form` 으로 갱신되어 있어 첫 표면 다형성(ai_conversation/buttons/form)을 반영하고 있다. 이전 `submit_message` 만 명시되던 버전 대비 개선.
- 제안: 없음.

### [INFO] `newChat()` 에서 `pendingSendRef` 폐기 처리 (I1 회귀 차단)

- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` newChat 콜백 (L800)
- 상세: `newChat()` 내 `pendingSendRef.current = null` 처리로 이전 대화에서 booting 중 큐된 텍스트가 새 대화의 첫 waiting 에서 flush 되는 누수를 차단한다(I1 인라인 주석으로 명시). 올바른 처리.
- 제안: 없음.

### [INFO] `panel.test.tsx` — Composer disabled 게이팅 6케이스 신규 검증

- 위치: `codebase/channel-web-chat/src/widget/components/panel.test.tsx` (신규 파일)
- 상세: booting, streaming, awaiting_user_message+buttons, awaiting_user_message+form → disabled; awaiting_user_message+ai_conversation, awaiting_user_message+null → enabled 총 6케이스를 검증한다. W6 요구사항("eager 시작 핵심 UX 검증") 충족. `aria-label="메시지 입력"` 으로 접근성 기반 쿼리 사용.
- 제안: 없음.

### [INFO] `use-widget-eager-start.test.ts` — 중복 open 가드 테스트

- 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` L470-483
- 상세: 동일 `act()` 내에서 `open()` 두 번 호출 시 webhook POST 1회만 발생함을 검증한다. `startedRef` 동기 가드가 React 배치 내 경쟁 조건을 막는 것을 확인한다.
- 제안: 없음.

---

## 요약

이번 변경은 이전 리뷰 세션(12_14_27) 에서 식별된 Critical(C1) + Warning 10건을 resolution-applier 가 처리한 후속 커밋이다. 핵심 요구사항인 §R6(패널 open 시 eager 시작, firstMessage 폐기) 가 eia-client, widget-state, use-widget, panel 4개 계층에 일관되게 구현되었고, spec(1-widget-app §R6, §3 다이어그램 재작성, 3-auth-session §3 시퀀스)도 워크트리 내에서 갱신이 완료되었다. C1 텍스트 유실(런처 버블/추천질문 booting 중 탭) 이 `pendingSendRef` 큐+flush 패턴으로 해소되었으며, 중복 open 가드(startedRef), 세션 복원 시 미시작, webhook 실패 후 재시도, newChat 큐 폐기 등 엣지케이스가 테스트(181개)로 검증된다. 유일한 Warning 은 `actions.start` 외부 공개인데, 가드가 있어 오동작은 없으나 실제 외부 호출 경로가 없다면 제거가 더 안전하다.

---

## 위험도

LOW

---

STATUS: SUCCESS
