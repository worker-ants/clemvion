# 보안(Security) 리뷰 결과

대상: EIA `/interact` 명령의 `expectedNodeId` 도입 (F-1, plan `eia-command-waiting-surface-guard`)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/external-interaction/interaction.service.ts`
- `codebase/backend/src/modules/hooks/hooks.service.ts`
- 관련 spec/테스트 (execution-engine.service.spec.ts, interaction.service.spec.ts, external-interaction.e2e-spec.ts, spec/5-system/4-execution-engine.md)

## 발견사항

- **[WARNING]** WebSocket 경로는 신규 nodeId 일치 검사를 전혀 적용받지 않음 (spec 서술과 실제 구현 불일치)
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` (`handleClickButton` L604, `handleSubmitMessage` L671, `handleEndConversation` L735, `handleSubmitForm` L538) — 이 파일은 이번 diff 에 포함되지 않았습니다.
  - 상세: `ExecutionEngineService.continueExecution/continueButtonClick/continueAiConversation/endAiConversation` 은 이번 변경으로 4번째 인자 `expectedNodeId?: string` 을 받아, 지정 시 `resolveWaitingNodeExecutionId` 가 실제 대기 노드와 대조합니다. `InteractionService`(EIA REST)는 이 인자를 `dto.nodeId` 로 채워 넘기지만, `websocket.gateway.ts` 는 같은 엔진 메서드를 **직접** 호출하면서 이 인자를 넘기지 않습니다. 그런데 WS 메시지 바디에는 이미 `nodeId`(click_button: optional, submit_message/end_conversation: required)가 실려 옵니다 — 즉 클라이언트가 대상 nodeId 를 보내고 있음에도 서버가 그 값을 검증에 쓰지 않고 버리는 상태입니다. 결과적으로 `expectedNodeId` 가 `undefined` 로 전달되어 `resolveWaitingNodeExecutionId` 의 nodeId 검사(§7.5.1)가 **자동으로 스킵**됩니다 — `in_process_trusted` 면제 경로와 동일한 "검사 안 함" 상태이지만, WS 클라이언트는 신뢰된 서버 내부 caller 가 아니라 세션 인증 + `verifyExecutionOwnership` 만 거친 **일반 외부(브라우저) caller** 입니다.
    이 diff 가 명시적으로 고치려는 문제("stale/오지정 nodeId 제출을 현재 대기 노드로 오적용" — 재작성된 spec 문구, `execution-engine.service.ts` L3442/L3445 부근, `interaction.service.ts` 상단 docstring "WS gateway 도 같은 chokepoint 를 지나므로 두 표면이 자동으로 정합한다")이 WS 경로에는 실제로 적용되지 않아, 문서(spec §7.5.1 표 — "외부 EIA `/interact`(`InteractDto.nodeId`)·WS 는 지정하고")가 주장하는 내용과 코드 동작이 어긋납니다.
    권한 상승(다른 workspace/실행 탈취)으로 이어지지는 않습니다 — `verifyExecutionOwnership` 은 그대로 유지되어 IDOR 은 막혀 있습니다. 다만 (a) 동일 execution 을 다루는 두 클라이언트 탭/디바이스, 혹은 stale UI 상태를 가진 단일 클라이언트가 "예전에 알고 있던" nodeId 로 명령을 보낼 때, 서버가 그 명령을 (검증 없이) **현재** 대기 노드에 그대로 적용해버릴 수 있는 레이스/오적용 창이 남아 있고, (b) `resolveWaitingNodeExecutionId` 의 e2e 테스트(G-2)로 실증된 방어가 WS 표면에는 존재하지 않아 EIA 대비 보안 수준이 낮은 채로 남습니다.
  - 제안: `websocket.gateway.ts` 의 4개 핸들러가 이미 갖고 있는 `data.nodeId` 를 `expectedNodeId` 로 그대로 전달하도록 후속 변경(같은 plan 의 파생 작업 혹은 신규 F-item)을 추가하고, spec §7.5.1 "WS 는 지정" 서술이 실제로 참이 되도록 정합을 맞추세요. `click_button` 의 `nodeId` 가 optional 인 점도 함께 재검토가 필요합니다(다른 3개 명령은 required).

- **[INFO]** `in_process_trusted` 면제는 외부에서 트리거 불가능함을 확인 (설계 검증 통과)
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.guard.ts` (L41-L75), `dto/interact.dto.ts`, `interaction.controller.ts` L98-99
  - 상세: `InteractionRequestContext` 는 `ExternalInteractionRequestContext | InternalInteractionRequestContext` 유니온이며, `InteractionGuard.canActivate` 는 항상 `scope` 필드가 없는 `ExternalInteractionRequestContext` 만 `req.interaction` 에 세팅합니다. `InteractDto` 에도 `scope` 필드가 없어 HTTP body 로 주입할 방법이 없습니다. `scope: 'in_process_trusted'` 리터럴을 합성하는 코드는 저장소 전체에서 `hooks.service.ts` 세 곳(L534, L751, L883)뿐이며, 모두 provider 서명/시크릿 검증(`chatChannelInboundAuthenticator.verify`)을 통과한 뒤 `HooksService` 내부에서만 만들어집니다. 즉 HTTP 요청 바디/헤더로는 이 union 슬롯에 도달할 수 없어(컴파일 타임 강제 + 런타임 경로 모두 확인), 질문하신 "nodeId 일치 검사가 in_process_trusted 면제로 우회 가능한가"는 **불가능**으로 판단됩니다.
  - 추가로 확인: 이 내부 경로가 `dto.nodeId` 를 실을 때(form_submission L541, handleFormStep L890)도 그 값은 채팅 인바운드 원문이 아니라 서버가 자체적으로 추적하는 `state.pendingFormModal.nodeId` / `formState.nodeId` 에서 옵니다 — 사용자 입력이 아니므로 조작 여지가 없습니다. 또한 `isInternalCtx(ctx)` 가 true 인 한 `expectedNodeId` 는 항상 `undefined` 로 강제되므로(설령 dto.nodeId 가 실려도 무시), nodeId 검사 스킵은 오직 컴파일타임으로 봉쇄된 "서버 내부 신뢰 caller" 로만 한정됩니다.

- **[INFO]** 외부 caller(EIA REST) 인가 경계는 약화가 아니라 강화됨
  - 위치: `interaction.service.ts` `assertNodeId`(L1858-1866), `execution-engine.service.ts` `resolveWaitingNodeExecutionId`(L5338-5349)
  - 상세: 종전에는 `assertNodeId` 가 "nodeId 가 존재하는지"만 검사했고(e2e 주석 "I-16: nodeId body 는 assertNodeId 유무 검사만 수행"), 실제 대기 노드와의 일치 여부는 검증되지 않았습니다. 이번 변경으로 외부(`iext`/`itk`) caller 는 지정한 `nodeId` 가 실제 `WAITING_FOR_INPUT` NodeExecution 의 nodeId 와 정확히 일치해야만 통과합니다(불일치 시 409 `STATE_MISMATCH`, e2e G-2 로 실증). 즉 순수 "존재 검사" → "실제 대기 노드와의 동일성 검사"로 **엄격화**된 것으로, 외부 caller 가 더 쉽게 통과하게 되는 방향의 변화는 없습니다.

- **[INFO]** nodeId 불일치 에러가 클라이언트에 내부 노드 식별자를 흘리지 않음
  - 위치: `execution-engine.service.ts` L5346-5348, `workflow-errors.ts` L33-43/L113-119, `interaction.service.ts` `dispatchContinuation` L1888-1892
  - 상세: `InvalidExecutionStateError(detail)` 는 `ExecutionError` 베이스가 `Error.message` 를 항상 고정 문자열(`'Execution is not waiting for input.'`)로 세팅하고, 실제 진단 상세(`command nodeId=... does not match waiting node=...`)는 `serverDetail`(서버 로그 전용, "client 응답에 절대 포함하지 않는다"로 명시)로만 저장합니다. `dispatchContinuation` 이 `err.message` 를 그대로 `STATE_MISMATCH` 응답에 실어도 고정 메시지만 나가므로, 실제 대기 노드 UUID 는 노출되지 않습니다. (참고로 동일 execution 에 대해 이미 인증된 caller 는 `getStatus()` 로 `waitingNodeId` 를 정상적으로 조회할 수 있어, 설령 노출되더라도 신규 권한 상승은 아니었을 것입니다.)

- **[INFO]** 하드코딩된 시크릿 / 인젝션 / 암호화 관련 신규 이슈 없음
  - 상세: 이번 diff 범위(nodeId 매개변수 배선, 테스트, hooks placeholder 제거, spec 표 갱신)에는 SQL/커맨드/XSS 인젝션 벡터, 하드코딩 자격증명, 안전하지 않은 해시/암호화, 평문 전송 관련 변경이 없습니다. `nodeId` 는 `class-validator` `@IsUUID()` 로 형식 검증되고 TypeORM QueryBuilder 파라미터 바인딩으로 비교되어 인젝션 경로가 없습니다.

## 요약

이번 변경은 EIA 외부 진입점(`InteractionService.interact`)에 "명령이 지정한 nodeId 가 실제 대기 노드와 일치해야 한다"는 새 동기 검증을 추가해 stale/오지정 nodeId 제출이 현재 대기 노드로 조용히 오적용되던 취약점 클래스를 닫았고, 이는 e2e(G-2)로 실증됩니다. 질문하신 두 핵심 우려—`in_process_trusted` 면제를 통한 우회 가능성, 외부 caller 인가 경계 약화—는 모두 코드·타입 시스템 수준에서 반증되어 문제가 없습니다(면제는 컴파일타임으로 봉쇄된 서버 내부 caller 전용이고, 외부 caller 는 오히려 더 엄격해졌습니다). 다만 같은 엔진 메서드를 직접 호출하는 WebSocket 경로(`websocket.gateway.ts`)는 이번 diff 에 포함되지 않아 신규 nodeId 검사를 전혀 적용받지 못하며, WS 메시지에는 이미 nodeId 가 실려 오는데도 버려지고 있어, 이 PR 이 닫으려는 정확히 같은 문제(오적용 레이스)가 WS 표면에는 그대로 남아 있습니다. 이는 권한 상승으로 이어지지는 않지만(소유권 검증은 유지), spec §7.5.1 이 "WS 도 지정한다"고 서술한 내용과 실제 구현이 불일치하는 문서-코드 괴리이자 보안 하드닝의 커버리지 공백이므로 후속 조치를 권고합니다.

## 위험도

LOW — 리뷰 대상 diff 자체는 순수 보안 강화이며 신규 취약점을 도입하지 않음. WS 갭은 기존 동작의 연장(회귀 아님)이나 문서 정합성과 커버리지 완결성을 위해 추적 필요.
