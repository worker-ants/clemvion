# Cross-Spec 일관성 검토 — EIA/WS 대기 노드 표면 매트릭스 가드 (impl-done)

- scope: `spec/5-system/14-external-interaction-api.md`
- diff-base: `52f46f95f`
- 코드 SoT: `/Volumes/project/private/clemvion/.claude/worktrees/elegant-driscoll-eebdd6` (HEAD 워킹트리)
- 관련 plan: `plan/in-progress/eia-command-waiting-surface-guard.md` (S-1: spec 동기 — project-planner 위임, 체크박스 미완)

## 검토 방법

diff 로 도입된 `waiting-surface-guard.ts`(`resolveWaitingSurface`/`isCommandAllowedOnSurface`/`coalesceInteractionType`) +
`ExecutionEngineService.assertCommandMatchesWaitingSurface` (publisher 사전 검증 3번째 케이스: 표면 불일치 →
`INVALID_EXECUTION_STATE`/EIA `409 STATE_MISMATCH`)가 아래 5개 영역 spec 본문과 충돌하는지 직접 대조했다:

- `spec/5-system/4-execution-engine.md` §7.5.1 (publisher 사전 검증 표)
- `spec/5-system/14-external-interaction-api.md` §5.1(에러 표)·§5.6(동시성)·§6.2(`expectedCommands`)
- `spec/4-nodes/6-presentation/0-common.md` §10.9 (button/form 처리기 dispatch)
- `spec/3-workflow-editor/3-execution.md` §9 (`POST /continue` 422)
- `spec/data-flow/15-external-interaction.md` §1.2 (inbound 시퀀스)
- `spec/5-system/6-websocket-protocol.md` §4.2 (`INVALID_EXECUTION_STATE` 표)
- `spec/7-channel-web-chat/1-widget-app.md` (위젯 소비처)
- `spec/5-system/15-chat-channel.md` CCH-CV-03 / CCH-ERR-04 (chat-channel forwarding·silent-skip 관례)
- `spec/4-nodes/3-ai/1-ai-agent.md` §6.2 step 2.c·§7.4 invariant (ai_conversation 관용 근거)
- `spec/1-data-model.md` §2.14 `NodeExecution.interaction_data` (별개 `interactionType` enum 과의 명명 충돌 여부)

## 발견사항

- **[WARNING]** §7.5.1 publisher 사전 검증 표가 신규 3번째 케이스(표면 불일치)를 아직 반영하지 않음
  - target 위치: `waiting-surface-guard.ts` (`resolveWaitingSurface`/`SURFACE_ALLOWED_COMMANDS`), `execution-engine.service.ts` `assertCommandMatchesWaitingSurface`
  - 충돌 대상: `spec/5-system/4-execution-engine.md` §7.5.1 표 (매칭 row 0건 / 2건 이상 두 행만 존재), `spec/5-system/14-external-interaction-api.md` §5.1 STATE_MISMATCH 행 예시, `spec/3-workflow-editor/3-execution.md` §9 (`대기 상태가 아니면 422` 서술), `spec/5-system/6-websocket-protocol.md` §4.2 `INVALID_EXECUTION_STATE` 설명, `spec/data-flow/15-external-interaction.md` §1.2 시퀀스 다이어그램
  - 상세: 코드는 동일 노드가 `waiting_for_input` 이어도 도착 명령이 그 노드의 인터랙션 표면(form/buttons/ai_conversation)과 맞지 않으면 `INVALID_EXECUTION_STATE`/`STATE_MISMATCH` 로 거부한다. 위 문서들은 이 원인을 "매칭 row 0건(다른 상태·nodeId 불일치)" 또는 "대기 상태가 아님" 으로만 서술해 표면 불일치 케이스가 열거에서 빠져 있다. 다만 (a) `4-execution-engine.md` §7.5.1 자체가 바로 아래 문단에서 "본 코드는 … 다른 commands 에서도 '기대 상태가 아님' 의 범용 표현으로 재사용된다" 라고 명시해 표가 폐쇄적 열거가 아님을 스스로 인정하고, (b) `spec/data-flow/15-external-interaction.md:115` 는 "publisher 측 사전 검증이 throw 하는 `InvalidExecutionStateError` 는 409 `STATE_MISMATCH` 로 매핑" 이라는 별도의 일반 문장으로 이미 신규 케이스를 포괄하며, (c) EIA §5.1 STATE_MISMATCH 행은 "예:" 로 시작하는 비완전 나열이라 값 자체가 틀린 것은 아니다. 즉 **값의 모순이 아니라 열거의 불완전성**이며, 코드가 어긴 "필수" 요구사항은 없다 — 오히려 `EIA-IN-13`("현재 노드 상태와 명령이 맞지 않으면 409 Conflict", 필수)이 이미 이 동작을 약속하고 있었고 이번 구현은 그 약속의 미이행 갭을 메운 것이다.
  - 제안: 이미 plan(`eia-command-waiting-surface-guard.md`)에 project-planner 위임으로 등재된 S-1 그대로 진행 — §7.5.1 3번째 행 + Rationale, EIA §5.1 예시 보강, §10.9 "이제 publisher 단계에서 거부됨" 명시, §9 422 조건 확장, `interaction-type-registry.md` cross-ref. 추가로 `spec/data-flow/15-external-interaction.md` §1.2 시퀀스 다이어그램에 `Eng->>Q` 단계의 실패 분기(표면 불일치 → 409)를 옵션 블록으로 보강하면 완전성이 높아진다 (plan 목록에 없는 항목이라 별도 추가 권장, 차단 사유는 아님).

- **[INFO]** EIA §6.2 `expectedCommands` 예시값이 `ai_conversation` 표면의 실제 허용 명령보다 좁음
  - target 위치: `waiting-surface-guard.ts` `SURFACE_ALLOWED_COMMANDS.ai_conversation` (`form_submitted`/`button_click`/`ai_message`/`ai_end_conversation` 4종 모두 허용)
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` §6.2 outbound notification payload 예시 — `ai_conversation` 노드의 `expectedCommands` 를 `["submit_message", "end_conversation"]` 2종으로만 예시
  - 상세: 코드(및 그 근거인 `AI Agent §6.2 step 2.c` render_form 응답·`Presentation §10.9` stale button_click graceful re-park)는 ai_conversation 대기 표면에서 `form_submitted`/`button_click` 도 의도적으로 수용한다. plan 이 이미 "`expectedCommands` 는 미구현 문서 필드"(서버가 실제로 검증에 쓰지 않는 안내용 예시)라고 명시하고 있어 이번 PR 이 새로 만든 모순이 아니라 기존부터 있던 문서-코드 간극이다. 실제 서버 동작을 오도할 위험은 있으나 (client 가 이 예시만 보고 `submit_message`/`end_conversation` 외 명령을 안 보낼 수 있음) 계약 위반은 아니다(서버가 더 관대할 뿐).
  - 제안: plan S-1 목록에 이미 각주 보강 항목으로 등재됨 — 그대로 반영.

- **[INFO]** chat-channel `forwardToInteractionService` 의 표면 불일치 삼킴이 사용자 안내 없이 서버 로그만 남김
  - target 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` `forwardToInteractionService` catch 분기 (STATE_MISMATCH → `logger.warn` 후 삼킴, throw 안 함)
  - 충돌 대상: `spec/5-system/15-chat-channel.md` CCH-CV-03(a) "waiting_for_input → 인터랙션 명령으로 forwarding" (표면 불일치 실패 경로 미서술), CCH-ERR-04 silent-swallow 금지 관례
  - 상세: CCH-ERR-04 의 "silently swallow 금지" 는 `execution.failed` 이벤트 분류(§3.5) 범위로 한정되며, 코드가 실제로 참조한 선례는 `Presentation §10.9` 의 "그 외(!type/미매칭) → warn log + no-op park, silent skip 금지"(서버 로그만으로 '비-silent' 를 충족하는 선례)다. 따라서 이 코드는 기존 관례를 정확히 재현했고 위반은 아니다. 다만 채널 사용자 입장에서는 form/buttons 대기 중 자유 텍스트를 보내도 아무 피드백이 없다는 UX 갭이 남는데, 이는 plan F-2 에 `languageHints.surfaceMismatch` 신규 키로 이미 후속 항목 등재돼 있다.
  - 제안: F-2 그대로 후속 진행. cross-spec 관점에서는 차단 사유 아님.

- **[INFO]** `interaction_data.interactionType` (사용자 action 기록 enum) vs `output_data.interactionType`/`meta.interactionType` (대기 표면 분류 enum, 이번 diff 가 읽는 값) — 이름 동일·의미 별개
  - target 위치: `execution-engine.service.ts` `assertCommandMatchesWaitingSurface`/`coalesceInteractionType` 이 읽는 `NodeExecution.output_data.meta.interactionType` / `output_data.interactionType`
  - 충돌 대상: `spec/1-data-model.md` §2.14 `NodeExecution.interaction_data` 필드 설명 — "여기의 `interactionType` 은 수행된 user action 의 기록 enum 으로, 노드 대기 상태를 분류하는 `WaitingInteractionType`(`form`/`buttons`/`ai_conversation`/`ai_form_render`, [interaction-type-registry]) 과 이름만 같고 별개 enum" 이라고 이미 명시적으로 구분해 둠
  - 상세: 실제 확인 결과 이번 diff 는 `output_data`(`WaitingInteractionType`) 경로만 읽고 `interaction_data`(user-action 기록) 는 건드리지 않는다 — 데이터 모델 충돌 없음. data-model 문서가 이미 두 enum 의 명명 충돌을 선제적으로 문서화해 둔 점은 오히려 긍정적 정합 신호.
  - 제안: 조치 불요 (기록용).

## 요약

이번 diff(`waiting-surface-guard.ts` 신설 + `resolveWaitingNodeExecutionId`/`assertCommandMatchesWaitingSurface` 3번째 케이스)는 새 에러 코드나 요구사항 ID를 도입하지 않고 기존 `InvalidExecutionStateError`→`INVALID_EXECUTION_STATE`/`STATE_MISMATCH`/`INVALID_STATE` 매핑을 그대로 재사용하며, 이미 "필수"로 약속된 `EIA-IN-13`("노드 상태와 명령 불일치 시 409")의 미이행 갭을 메우는 **추가적·제한 강화(strictly more restrictive) 검증**이다. 어떤 기존 spec 문장도 "표면 불일치는 거부하지 않는다"거나 "이 두 케이스가 유일한 원인이다" 라고 완결적으로 선언한 적이 없고, 관련 5개 spec(§7.5.1 표·EIA §5.1/§6.2·§10.9·workflow-editor §9·data-flow §1.2)의 서술은 모두 **비완전 열거/예시(narrower-than-code)** 수준의 문서 지연이지 값의 모순이 아니다. 이 갭은 `plan/in-progress/eia-command-waiting-surface-guard.md` 에 S-1 로 project-planner 위임이 이미 등재돼 있고 구체적 체크리스트(어느 파일 어느 절을 어떻게 고칠지)까지 명시돼 있어 추적 상태가 명확하다. RBAC·상태 머신·계층 책임·요구사항 ID 어느 축에서도 실제 모순은 발견되지 않았고, 위젯(`7-channel-web-chat/1-widget-app.md`)·chat-channel(`15-chat-channel.md`) 등 소비처 spec 은 이미 `STATE_MISMATCH` 를 세부 사유 무관하게 graceful 처리하도록 설계돼 있어 이번 변경으로 깨지는 계약이 없다. 따라서 CRITICAL 로 격상할 근거는 없고, 다중 문서에 걸친 열거 완결성 갱신이 필요하다는 점에서 WARNING 으로 유지한다.

## 위험도

LOW
