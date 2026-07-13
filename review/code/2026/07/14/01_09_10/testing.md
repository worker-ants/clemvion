# 테스트(Testing) 리뷰 — eia-command-waiting-surface-guard (F-1)

## 발견사항

- **[WARNING]** `hooks.service.ts` 의 placeholder 제거를 잠그는(lock) 회귀 테스트 부재
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` `forwardToInteractionService` (nodeId 미전달로 변경) / `codebase/backend/src/modules/hooks/hooks.service.spec.ts` (이번 diff에 미포함, 미변경)
  - 상세: 이번 변경은 `nodeId: 'chat-channel'` placeholder 를 제거해 dto 에 nodeId 키 자체를 싣지 않도록 바꿨다(코드 주석: "종전엔 존재 검사만 만족시키는 placeholder... 오해를 낳아 제거했다"). 그런데 `hooks.service.spec.ts` 의 기존 assertion(예: L807-816 `expect(interactionService.interact).toHaveBeenCalledWith(expect.objectContaining({...}), expect.objectContaining({ command: 'submit_message', message: 'my answer' }))`)은 `objectContaining` 으로 dto 의 부분 필드만 검사하므로, nodeId 키의 존재/부재와 무관하게 계속 green 이다. 즉 이번 diff 의 핵심 행위 변경(placeholder 제거)을 실제로 감지·고정하는 테스트가 스위트 어디에도 없다 — 누군가 실수로 `nodeId: 'chat-channel'` 을 되돌리거나 다른 잘못된 값을 채워도 현재 테스트는 fail 하지 않는다.
  - 제안: `expect(dto).not.toHaveProperty('nodeId')` 또는 `expect.not.objectContaining({ nodeId: expect.anything() })` 형태로 dto 에 nodeId 가 실리지 않음을 명시적으로 고정하는 테스트를 `hooks.service.spec.ts` 의 `forwardToInteractionService` 관련 테스트에 추가.

- **[WARNING]** `in_process_trusted` nodeId 면제가 커맨드별로 개별 분기되는데, `submit_message` 외 3개 커맨드에 대한 회귀 테스트 부재
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts` L539-561 (`F-1 — in_process_trusted 는 nodeId 없어도 수용...`)
  - 상세: `interaction.service.ts` 의 `interact()` 는 `submit_form`/`click_button`/`submit_message`/`end_conversation` 4개 분기 각각에서 독립적으로 `this.assertNodeId(dto, ctx)` 를 호출하고 각자의 engine 메서드를 호출한다. 이번 F-1 diff 가 추가한 internal-ctx 예외 테스트는 `submit_message` 1건뿐이라, 나머지 3개 분기(특히 `submit_form` — chat-channel form_submission 이 실제로 이 경로를 타는 유일한 커맨드) 는 internal ctx 조합에 대한 직접 커버리지가 없다. switch 문 리팩터링(예: 분기 하나만 `assertNodeId` 호출을 빠뜨리는 실수) 이 있어도 이 3개 분기에서는 감지되지 않는다.
  - 제안: 최소 `submit_form`(chat-channel 이 실제로 쓰는 경로) 에 대해서도 internal ctx + `assertNodeId` skip + `expectedNodeId=undefined` 전달을 검증하는 테스트를 추가.

- **[WARNING]** internal ctx 예외가 커맨드/호출부 무관하게 스코프 단위로 전면 적용되어, 실제로 nodeId 를 알고 있는 chat-channel form 제출 경로(form_submission·handleFormStep)에서도 F-1 guard 가 완전히 무력화되는데 이를 검증/고정하는 테스트가 없음
  - 위치: `interaction.service.ts` L1533 `const expectedNodeId = isInternalCtx(ctx) ? undefined : dto.nodeId;` (스코프 단위 일괄 면제) vs `hooks.service.ts` `form_submission` 핸들러(L539-542: `{ command: 'submit_form', nodeId, data: filteredFields }`) 및 `handleFormStep`(L888-891: `{ command: 'submit_form', nodeId: formState.nodeId, ... }`) — 둘 다 실제 대기 nodeId 를 알고 dto 에 명시적으로 싣는다.
  - 상세: `spec/5-system/4-execution-engine.md` 의 exemption 서술("`HooksService.forwardToInteractionService` 가 대기 노드의 표면·nodeId 를 알지 못한 채... 고정 매핑한다")은 "nodeId 를 모르는" 경로만을 면제 근거로 든다. 그런데 실제 구현의 면제 조건은 `ctx.scope === 'in_process_trusted'` 단위로만 판정하므로, nodeId 를 실제로 알고 있는 `form_submission`/`handleFormStep` 경로도 함께 면제된다 — 이 두 경로가 실어 보내는 실제 `nodeId`(`state.pendingFormModal!.nodeId` / `formState.nodeId`) 는 F-1 guard 에 전혀 반영되지 않고 항상 `undefined` 로 강제된다. 결과적으로, 대화 재개 race 등으로 `pendingFormModal`/`formState` 의 nodeId 가 실제 현재 대기 노드와 어긋난 stale 상태(F-1 이 막고자 하는 정확히 그 시나리오)여도 chat-channel 경로에서는 여전히 무검증으로 수용될 수 있다. 이 케이스를 검증하는 unit/e2e 테스트가 없어 의도된 설계인지 놓친 갭인지조차 테스트로는 판별 불가하다.
  - 제안: (a) 의도된 설계라면 spec §7.5.1 exemption 서술에 "nodeId 를 알고 있는 form_submission/handleFormStep 도 스코프 단위로 함께 면제됨"을 명시하고, 그 상태(stale nodeId 도 수용됨)를 고정하는 회귀 테스트를 추가. (b) 의도치 않은 갭이라면 `HooksService` 레벨에서 dto.nodeId 유무로 판단하거나 `InteractionService` 가 "ctx.scope 대신 dto.nodeId 존재 여부"로 `expectedNodeId` 를 계산하도록 수정한 뒤 mismatch 거부 테스트를 추가.

- **[INFO]** `execution-engine.service.spec.ts` 의 F-1 단위 테스트는 `continueExecution` 경로로만 nodeId 매칭/불일치를 검증
  - 위치: `execution-engine.service.spec.ts` L1994-2012
  - 상세: `continueButtonClick`/`continueAiConversation`/`endAiConversation` 도 동일하게 `expectedNodeId` 를 받아 공유 private 메서드 `resolveWaitingNodeExecutionId` 에 전달하지만, 이 파일에서는 `continueExecution` 한 건만 직접 매칭/불일치를 검증한다. 공유 로직이라 위험도는 낮지만, 4개 public 메서드 중 3개는 이 브랜치 로직을 직접 실행하는 단위 테스트가 없고 `interaction.service.spec.ts` 쪽은 파라미터 전달(mock)만 검증할 뿐 실제 매칭 로직을 실행하지 않는다.
  - 제안: 필수는 아니나, 최소 1개(예: `continueButtonClick`)를 추가해 위임 경로 자체가 올바르게 연결됐는지 직접 검증하면 리팩터링 안전망이 강화된다.

- **[INFO]** e2e(G-2)는 `submit_form` nodeId 불일치만 커버
  - 위치: `codebase/backend/test/external-interaction.e2e-spec.ts` L3175-3216
  - 상세: 외부 EIA `/interact` 진입점에서 nodeId 불일치 시 409 STATE_MISMATCH 로 응답되는 cross-stack 흐름은 `submit_form` 1건만 실 DB round-trip 으로 검증한다. `click_button`/`submit_message`/`end_conversation` 은 동일 publisher chokepoint(`resolveWaitingNodeExecutionId`)를 공유하므로 unit 레벨 커버리지로 충분히 갈음 가능하나, 계층 전반(HTTP → guard → service → engine → DB) 정합은 명시적으로 미확인이다.
  - 제안: 현 상태로도 수용 가능(unit 이 로직을, e2e 가 1개 대표 경로의 배선을 검증하는 계층 전략과 부합). 다만 회귀 발생 시 최우선 의심 지점으로 남겨둘 것.

## 요약

핵심 nodeId 매칭/불일치 로직(`resolveWaitingNodeExecutionId`)은 `execution-engine.service.spec.ts` 의 match/mismatch 두 unit 테스트와 `external-interaction.e2e-spec.ts` 의 G-2 cross-stack 테스트로 정직하게 커버되어 있고, `interaction.service.spec.ts` 도 4개 커맨드 전부에서 nodeId 가 engine 으로 올바르게 전달됨을 확인하는 등 주요 happy-path 는 준수하게 갱신됐다. 다만 (1) `hooks.service.ts` 의 placeholder 제거라는 실제 행위 변경을 감지하는 테스트가 전혀 없고(느슨한 `objectContaining` 단언만 존재), (2) `in_process_trusted` 예외가 스코프 단위로 전면 적용되어 실제로 nodeId 를 알고 있는 chat-channel form 제출 경로까지 F-1 guard 를 무력화하는데 이 설계 선택 자체를 검증/고정하는 테스트가 없다는 점이 이번 보안 강화(stale/오지정 nodeId 거부)의 실효성에 대한 신뢰를 낮춘다. 후자는 F-1 이 막으려는 시나리오와 정확히 겹치는 미검증 영역이라 우선 확인이 필요하다.

## 위험도
MEDIUM
