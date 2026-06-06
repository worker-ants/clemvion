# 신규 식별자 충돌 검토 결과

검토 범위: `spec/7-channel-web-chat` (구현 완료 후, diff-base=origin/main)

---

## 발견사항

### 발견사항 1

- **[WARNING]** `firstMessage` — spec 에서는 폐기됐으나 `@workflow/sdk` 예제·README 에서 여전히 사용
  - target 신규 식별자: `firstMessage` 는 이번 변경에서 **폐기(삭제)** 된 식별자다. 새 spec(`1-widget-app §R6`, `3-auth-session §3`)은 "firstMessage 미동봉"을 명시하고, `eia-client.ts` 도 해당 파라미터를 payload에서 제거했다.
  - 기존 사용처:
    - `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/packages/web-chat-sdk/README.md` 64번 줄 — `client.triggerWebhook(endpointPath, { firstMessage })` 예제 코드
    - `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/packages/web-chat-sdk/examples/byo-ui-headless.ts` 34·44번 줄 — `startHeadlessChat` 함수 시그니처 `firstMessage: string` 파라미터, `triggerWebhook(endpointPath, { firstMessage })` 호출
  - 상세: 이번 변경은 `channel-web-chat`(M1 위젯)에서 `firstMessage`를 제거했지만, BYO-UI(M2) 경로인 `@workflow/sdk` 예제와 README는 여전히 `firstMessage`를 webhook body에 넣는 패턴을 보여준다. `@workflow/sdk`의 `triggerWebhook`은 `body: unknown`을 받아 그대로 전달하므로 기술적으로 `firstMessage`를 보낼 수 있다. 그러나 spec `1-widget-app §R6`은 "firstMessage 메커니즘은 폐기"라고 명시하며, AI Agent multi_turn이 trigger/webhook 입력을 첫 턴으로 소비하지 않기 때문에 이 필드가 실제로는 무효임을 설명한다. 따라서 M2 예제가 `firstMessage`를 사용하는 것은 폐기된 개념을 문서화하는 충돌이다. 실제 runtime 에러는 발생하지 않으나(서버는 무시), 개발자 혼선과 "왜 첫 메시지가 처리 안 되나" 디버깅 낭비를 유발한다.
  - 제안: `codebase/packages/web-chat-sdk/README.md` M2 BYO-UI 예제와 `examples/byo-ui-headless.ts`의 `firstMessage` 사용을 제거하고, 첫 메시지는 SSE `waiting_for_input(ai_conversation)` 도착 후 `client.interact(executionId, token, { command: "submit_message", message: "..." })`로 전송하는 패턴으로 교체. `startHeadlessChat`의 `firstMessage` 파라미터 삭제 또는 주석으로 폐기 명시.

---

### 발견사항 2

- **[INFO]** `R6` Rationale ID — 같은 레이블이 3개의 독립 spec 파일에 존재
  - target 신규 식별자: `spec/7-channel-web-chat/1-widget-app.md §R6` ("워크플로우 시작 — 패널 open 시(eager)") 는 이번 변경으로 신규 추가된 Rationale 섹션이다. `spec/7-channel-web-chat/0-architecture.md`에도 `§R6`("신규 spec 영역 `7-`")가 존재한다.
  - 기존 사용처:
    - `/Volumes/project/private/clemvion/spec/5-system/14-external-interaction-api.md` `### R6. Notification 실패 시 자동 비활성화 금지`
    - `/Volumes/project/private/clemvion/spec/5-system/15-chat-channel.md` `### R6. chat-channel-adapter.md 를 spec/conventions/ 에 두는 정당화`
    - `/Volumes/project/private/clemvion/spec/7-channel-web-chat/0-architecture.md` `### R6. 신규 spec 영역 7-`
  - 상세: Rationale ID는 각 문서 내부 참조 로컬 식별자로, 문서 간 충돌이 의미 혼선을 유발하지는 않는다. 그러나 `spec/7-channel-web-chat/0-architecture.md §R6`와 신규 `spec/7-channel-web-chat/1-widget-app.md §R6`는 같은 영역 폴더 내에 있어서 교차 참조 시 모호할 수 있다. 실제로 구현 코드와 test 주석에 `§R6`가 다수 등장하며(예: `use-widget.ts`, `widget-state.ts`), 이들은 1-widget-app의 R6를 가리킨다.
  - 제안: 동일 spec 영역(`7-channel-web-chat/`) 내부에서 R6가 중복 사용되므로, `0-architecture.md`의 `§R6`를 다른 번호(예: §R9, 현재 §R8 다음)로 재번호화하거나, 코드 주석에서 `1-widget-app §R6`으로 풀네임을 명시(현재도 대부분 그렇게 되어 있음). 낮은 영향도라 즉시 수정보다는 차후 spec 정리 시 정비 권장.

---

### 발견사항 3

- **[INFO]** `panel` phase 상태명 — `widget-state.ts`에서 `"panel"` phase가 여전히 잔류
  - target 신규 식별자: 이번 변경은 `widget-state.ts`의 상태기계를 `collapsed → panel(transient) → booting → streaming → awaiting_user_message → ended`로 문서화했다.
  - 기존 사용처: `use-widget.ts` 변경 전 코드(origin/main)에서 `state.phase === "panel"` 또는 `state.phase === "collapsed"` 분기가 `submitMessage`에 있었으나, 이번 변경 diff에서 해당 분기가 제거되었다. 워크트리 현재 `use-widget.ts`를 확인하면 `panel` phase 참조가 남아있지 않을 가능성이 높음.
  - 상세: spec `1-widget-app §3`의 상태기계 다이어그램에는 `[panel](transient)`이 명시되어 있어 `panel`이 유효한 phase 이름이다. 충돌이 아니라 기존 정의와 동일한 이름을 사용하는 것이므로 INFO.
  - 제안: 해당 없음 (기존 정의와 일치, 충돌 아님).

---

## 요약

이번 `webchat-eager-start` 변경이 도입하거나 폐기하는 주요 식별자들은 대부분 `spec/7-channel-web-chat` 영역 내부에서 일관성 있게 처리되었다. `web-chat-architecture`·`web-chat-widget-app`·`web-chat-sdk`·`web-chat-auth-session`·`web-chat-security` 등 spec ID 는 기존과 충돌 없다. `wc:boot`·`wc:command`·`wc:resize`·`wc:event` 등 postMessage 네임스페이스, `ClemvionChat` 전역명, `BootConfig`·`ChatInstance`·`WidgetEvent`·`Unsubscribe` 타입명, `WEB_CHAT_WIDGET_ORIGINS` env 키는 기존 spec·코드와 일치한다. 유일하게 실질적 혼선 위험이 있는 것은 **`firstMessage` 식별자 잔류** 문제로, spec과 M1 구현에서는 폐기됐으나 `@workflow/sdk`(M2 BYO-UI) 예제·README에는 여전히 사용 중이어서 M2 개발자에게 오해를 유발할 수 있다. Rationale ID `R6` 중복은 동일 영역 내에 한정되며 치명적 혼선 수준은 아니다.

## 위험도

LOW
