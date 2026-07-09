# 신규 식별자 충돌 검토 — webchat 세션 컨트롤 + 새로고침 히스토리 복원 (impl-done)

검토 모드: --impl-done, scope=`spec/7-channel-web-chat/`, diff-base=`origin/main`, SoT=HEAD 워킹트리
(`/Volumes/project/private/clemvion/.claude/worktrees/webchat-session-history-0e9639`).

diff 범위: `spec/5-system/14-external-interaction-api.md`(§5.3·R17) · `spec/7-channel-web-chat/{1-widget-app,2-sdk,3-auth-session}.md`
· `codebase/channel-web-chat/**`(use-widget.ts·widget-state.ts·conversation.ts·eia-types.ts·panel.tsx·styles.ts 등)
· `codebase/backend/src/modules/external-interaction/interaction.service.ts` · `execution.entity.ts`.

## 발견사항

- **[WARNING]** 신규 CSS 클래스 `.wc-panel-action` 이 기존 `.wc-action` 과 시각적으로 거의 동일한 스타일을 이름만 바꿔 재정의
  - target 신규 식별자: `.wc-panel-action`/`.wc-panel-actions` (`codebase/channel-web-chat/src/widget/styles.ts:14-16`, 헤더 "새 대화"/"대화 종료" 버튼)
  - 기존 사용처: `.wc-action` (`codebase/channel-web-chat/src/widget/styles.ts:29`, 기존 퀵 액션 버튼 — `waiting_for_input.buttonConfig` 탭 시 `click_button`, [1-widget-app §2](../../../../../../spec/7-channel-web-chat/1-widget-app.md) "퀵 액션 버튼" 행)
  - 상세: 두 클래스 모두 흰 배경·회색 테두리·pill radius·작은 폰트·`cursor:pointer` 로 속성이 사실상 동일하고 이름도 `wc-action` vs `wc-panel-action` 로 접두어만 다르다. 하나는 헤더의 세션 컨트롤(새 대화/대화 종료, 로컬 UI 동작)이고 다른 하나는 메시지 바디의 워크플로우 버튼 응답(`click_button`, 서버로 커맨드 발사)으로 의미가 다른데도 명명이 유사해, 향후 유지보수자가 두 클래스를 혼동하거나 통합을 시도하다 "왜 재사용 안 했는지" 파악에 시간을 쓸 위험이 있다. 실질적 런타임 충돌(같은 DOM 요소에 두 클래스가 동시 적용되는 경우)은 diff 상 없다.
  - 제안: 코드 변경이 필수는 아니나, `.wc-panel-action` 정의부에 "퀵 액션(`wc-action`)과 별개 — 헤더 세션 컨트롤 전용" 주석을 한 줄 추가하거나, 공통 pill 베이스 클래스로 스타일 프로퍼티를 통합(`wc-btn-pill` + modifier)해 중복·혼동 여지를 함께 줄이는 방향을 권장.

- **[INFO]** `endConversation` 식별자가 서로 다른 두 기능(내부 WS 프로토콜 vs 외부 채널 위젯)에서 각자 독립적으로 재사용됨
  - target 신규 식별자: `endConversation` (`codebase/channel-web-chat/src/widget/use-widget.ts` 신규 hook 액션, `panel.tsx` `PanelActions.endConversation` prop — 헤더 "대화 종료" 클릭 시 EIA `interact { command: "end_conversation" | "cancel" }` 발사)
  - 기존 사용처: `endConversation` / `execution.end_conversation` (`codebase/backend/src/modules/websocket/websocket.gateway.ts:78,454,927` — 메인 제품 내부 실행 화면의 WS continuation 핸들러 5종 중 하나; [`spec/5-system/6-websocket-protocol.md` §"대화 종료 요청"](../../../../../../spec/5-system/6-websocket-protocol.md) `execution.end_conversation`)
  - 상세: 두 구현은 전송 계층(WS vs REST EIA)·코드베이스(backend vs `codebase/channel-web-chat` 별도 패키지)·소비 주체(내부 관리자 UI vs 외부 임베드 위젯)가 완전히 분리돼 있어 실제 import/네임스페이스 충돌은 없다. 개념적으로도 "AI Multi-turn 대화를 종료한다"는 동일 도메인 행위를 가리키는 의도된 명명 정합(오히려 바람직한 일관성)이라 판단된다. 다만 리포지토리 전역에서 `endConversation` 을 grep 하면 서로 무관한 두 스택의 결과가 섞여 나오므로, 코드 리딩 시 잠깐의 혼동 소지가 있다.
  - 제안: 실제 충돌이 아니므로 코드 변경 불필요. 다만 `use-widget.ts` 의 `endConversation` JSDoc 또는 [1-widget-app §3.1](../../../../../../spec/7-channel-web-chat/1-widget-app.md) 대화 종료 행에 "내부 WS `execution.end_conversation`(6-websocket-protocol) 과는 별개 구현 — 외부 채널은 REST EIA `interact{command:end_conversation|cancel}` 경유" 한 줄을 남기면 향후 grep 혼동을 예방할 수 있다(선택적 개선).

### 확인했으나 충돌 아님으로 판단한 항목 (참고)

- `context.conversationThread` (EIA `GET /api/external/executions/:id` 응답 신규 필드, `interaction.service.ts:224-297`) — SSE `waiting_for_input` wire 의 기존 `conversationThread` 필드명·shape 을 REST 응답에 **그대로 재사용**한 것으로, WS 내부 store(`use-execution-events.ts`)·`Execution.conversation_thread`(`execution.entity.ts`)와도 동일 개념·동일 shape 이라 신규 의미 충돌 없음. 내부 관리자용 `ExecutionDto`/`ExecutionDetailDto`(`execution-response.dto.ts`)는 이 필드를 여전히 미노출이라 shape 이원화도 없음.
- `TurnSource` 신규 union 값 5종(`presentation_user`/`ai_user`/`ai_assistant`/`ai_tool`/`system`, `eia-types.ts`) — [`conversation-thread.md §1.1`](../../../../../../spec/conventions/conversation-thread.md) 이 정의한 backend `ConversationTurnSource` 캐노니컬 5값을 그대로 미러한 것으로, 기존 `live`/`injected` 2값(WS §4.4.6 별도 마커)과 병기되며 의미 정의 충돌 없음.
- `isActiveConversationPhase` (`widget-state.ts` 신규 export) — 같은 모듈의 기존 `isTextInputSurface` 와 명명 패턴이 일관되고, 다른 모듈에 동명 함수 없음.
- `resetSessionRefs`/`startGenRef`(`use-widget.ts` 내부 전용) — 모듈 스코프 지역 식별자, 외부 노출 없음.
- 헤더 "새 대화"/"대화 종료" 버튼 라벨과 [5-admin-console.md §198](../../../../../../spec/7-channel-web-chat/5-admin-console.md) 라이브 미리보기의 "새 세션" 버튼 — 둘 다 같은 `resetSession` 메커니즘으로 수렴하지만 서로 다른 UI 컨텍스트(운영 콘솔 미리보기 컨트롤 바 vs 위젯 자체 헤더)에 노출되는 별개 라벨이라 혼선 위험 낮음(의도적 분리).
- `plan/complete/webchat-session-controls-history-restore.md` 파일 경로 — `plan/complete/webchat-*` 기존 8개 파일과 동일 접두 컨벤션을 따르며 이름 중복 없음.
- 이전 spec-only 검토(`review/consistency/2026/07/09/18_27_06/SUMMARY.md`)가 이미 "pre-existing·범위 밖"으로 처리한 `interactionType` registry cross-link 미비·`notification` 어휘 중의성은 본 diff 가 새로 도입한 인스턴스가 아니므로 재보고하지 않음.

## 요약

이번 구현(`webchat-session-controls-history-restore`)이 새로 도입한 식별자 — 위젯 헤더 세션 컨트롤 액션(`endConversation`)·CSS 클래스(`wc-panel-action` 등)·EIA `getStatus` 응답 신규 필드(`context.conversationThread`)·`TurnSource` union 확장·`isActiveConversationPhase` — 는 대부분 기존 SSE/backend 캐노니컬 명명을 의도적으로 재사용하거나 기존 모듈 명명 패턴을 그대로 따라 실질적 CRITICAL 충돌은 발견되지 않았다. 유일한 주의점은 신규 CSS 클래스 `.wc-panel-action` 이 기존 `.wc-action` 과 이름·스타일이 매우 유사해 향후 혼동 소지가 있다는 점(WARNING)과, `endConversation` 이라는 이름이 완전히 무관한 두 스택(내부 WS 프로토콜·외부 채널 위젯)에서 각자 독립적으로 쓰인다는 점(INFO, 의도된 정합이라 문제라기보다 참고 사항)뿐이다. 둘 다 기능적 충돌이 아니라 명명 명확화 권장 수준이라 이 PR 을 차단할 사유는 없다.

## 위험도

LOW
