# 아키텍처(Architecture) Review

## 발견사항

- **[CRITICAL]** `expectedNodeId` 가드의 실제 커버리지에 대해 spec·JSDoc·구현이 서로 모순 — WS 진입점은 검사되지 않는데 spec 은 "WS 는 지정한다" 고 서술
  - 위치:
    - `spec/5-system/4-execution-engine.md` §7.5.1 (본 diff 신설 각주): "외부 EIA `/interact`(`InteractDto.nodeId`)**·WS 는 지정**하고, `scope: 'in_process_trusted'`... 는 면제한다" / "이 면제는 in-process trusted 합성 ctx 에만 국한되며(**외부 토큰 경로는 항상 nodeId 지정**)"
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `resolveWaitingNodeExecutionId` JSDoc(본 diff 신설): "**외부 EIA `/interact` 진입점만 전달**하고, `in_process_trusted`... 는 전달하지 않아 본 검사를 건너뛴다"
    - `codebase/backend/src/modules/websocket/websocket.gateway.ts` (본 diff 미포함, 미변경) — `handleClickButton`/`handleSubmitMessage`/`handleEndConversation` 의 `@MessageBody data` 타입에는 이미 `nodeId`/`nodeId?` 필드가 있지만, `continueButtonClick`/`continueAiConversation`/`endAiConversation` 호출 어디에서도 `data.nodeId` 를 읽거나 3번째 인자로 넘기지 않음(`grep -n "data\.nodeId"` 결과 0건). `handleSubmitForm` 도 `continueExecution` 을 2-arg 로만 호출.
    - `codebase/backend/src/modules/executions/executions.controller.ts` `continueExecution` (REST `/continue`) 도 `id, body?.formData` 2-arg 호출 — nodeId 자체를 받지 않음.
  - 상세: 같은 diff 안에서 spec 문서는 "WS 도 nodeId 를 지정해 검사한다" 고 명시하는데, 같은 diff 가 작성한 engine 코드 JSDoc 은 "EIA `/interact` 만 전달한다" 고 반대로 서술하고, 실제 WS gateway 코드(본 diff 밖, grep 으로 확인됨)는 어느 쪽 서술과도 무관하게 `expectedNodeId` 를 전혀 넘기지 않는다. 결과적으로 이번 PR 이 닫으려던 F-1 갭("stale/오지정 nodeId 제출을 현재 대기 노드로 오적용")은 EIA REST `/interact` 경로 1곳만 닫혔고, WS(`execution.click_button`/`execution.submit_message`/`execution.end_conversation`)와 내부 REST `/continue` 는 여전히 `expectedNodeId=undefined` 로 검사를 건너뛴다 — `in_process_trusted` 면제와 정확히 동일한 fail-open 상태이면서도 그렇게 문서화·의도되지 않았다. 보안적으로는 WS/`/continue` 모두 사전에 `verifyExecutionOwnership`/`WorkspaceId` 소유권 검사를 거치므로 cross-tenant 침해로 직결되진 않지만, spec 이 구현되지 않은 불변식을 "이미 보장됨"으로 서술하는 것 자체가 spec-impl SoT 위반이며, 향후 감사·타 개발자가 이 서술을 신뢰해 WS 경로의 실제 갭을 놓칠 위험이 크다.
  - 제안: (a) WS gateway 4개 handler 가 이미 페이로드에 갖고 있는 `data.nodeId` 를 `expectedNodeId` 로 threading하여 실제로 spec 서술과 일치시키거나, (b) 지금 시점에 WS/`\`/continue\`` 를 스코프 밖으로 남긴다면 spec 문구를 "현재는 EIA `/interact` 만 지정하며 WS/`/continue` 는 후속 작업(F-x)" 으로 정정하고 plan 의 "본 PR 범위 밖" 목록에 명시적으로 추가한다. 두 문서(spec md, JSDoc)의 모순도 반드시 하나로 통일해야 한다.

- **[WARNING]** `expectedNodeId` 를 4개 `continue*` public method 에 optional 파라미터로 개별 threading하는 방식은 "옵션 인자 = fail-open" 구조라 새 caller 가 빠뜨려도 컴파일러가 못 잡는다
  - 위치: `execution-engine.service.ts` `continueExecution`/`continueButtonClick`/`continueAiConversation`/`endAiConversation` 시그니처, `resolveWaitingNodeExecutionId(executionId, expectedCommand, expectedNodeId?)`
  - 상세: 검사 로직 자체는 `resolveWaitingNodeExecutionId` 한 곳에 잘 모여 있어 "chokepoint" 는 유지된다(응집도는 양호). 문제는 그 chokepoint 의 *활성화 여부*가 매 caller 가 독립적으로 계산해 넘기는 optional 인자(`undefined` = skip)에 의존한다는 점이다. `interaction.service.ts` 내부에서는 `expectedNodeId` 를 한 번만 계산해 4개 분기에 재사용하므로 파일 내 결합은 낮다. 그러나 파일 경계를 넘어가면(WS gateway, REST `/continue`) 그 계산이 전혀 반복되지 않고, 타입 시스템도 "이 caller 가 의도적으로 스킵했는지 실수로 빠뜨렸는지" 를 구분할 수단이 없다. 위 CRITICAL 항목이 바로 이 설계의 실제 발현 사례다.
  - 제안: 이 저장소에는 이미 더 견고한 선례가 있다 — `interaction.guard.ts` 의 `InteractionRequestContext` discriminated union + `isInternalCtx` narrowing (`ExternalInteractionRequestContext` vs `InternalInteractionRequestContext`, "scope 필드 부재/필수" 로 컴파일러가 강제). `expectedNodeId` 도 그런 식으로 caller 컨텍스트(예: 각 진입점이 만드는 "ContinuationCommand" 값 객체)에 실어 단일 지점에서 파생시키거나, 최소한 optional 대신 명시적 sentinel union(`string | 'SKIP_NODE_CHECK'`)으로 바꿔 "빠뜨림" 과 "의도적 스킵" 을 타입 레벨에서 구분되게 하는 편이 안전하다.

- **[WARNING]** REST `/continue` 진입점(`executions.controller.ts`)도 이번 가드 대상에서 빠짐 — plan 에 명시적 스코프 배제 없음
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts:165-175`
  - 상세: `plan/in-progress/eia-command-waiting-surface-guard.md` 의 "후속 항목(본 PR 범위 밖)" 목록(F-2~F-5)에 REST `/continue` 미커버는 언급되지 않는다. WS 항목과 마찬가지로 회귀는 아니지만(이전에도 nodeId 검사가 없었음), F-1 이 "전체 명령 매트릭스를 publisher chokepoint 에서 강제한다" 는 결정을 표방한 PR 이므로 스코프 경계가 암묵적으로만 존재하는 상태다.
  - 제안: plan 문서에 "REST `/continue` 는 nodeId 파라미터 자체가 없어 F-1 스코프 밖(별도 후속 필요 시 F-6)" 같은 형태로 명시하거나, 같이 닫는다.

- **[INFO]** `continueButtonClick(executionId, buttonId, expectedNodeId?)` / `continueAiConversation(executionId, message, expectedNodeId?)` 처럼 인접한 동일 타입(`string`) positional 파라미터가 계속 늘어나는 추세 — 향후 리팩터 시 순서 뒤바뀜(transposition) 위험
  - 위치: `execution-engine.service.ts` 4개 `continue*` 메서드 시그니처
  - 상세: `buttonId`/`message` 와 `expectedNodeId` 는 타입이 같은 `string` 이라 컴파일러가 순서 실수를 잡아주지 못한다. 이미 `expectedCommand`(enum, private 레벨) 에 이어 `expectedNodeId` 가 두 번째로 추가된 optional 플래그이므로, 다음 확장에서 옵션 객체 파라미터화(`{ expectedNodeId, ... }`)로 전환하는 편이 확장성 측면에서 안전하다.
  - 제안: 필수 인자는 유지하되, optional 플래그류는 하나의 options 객체로 묶는 리팩터를 다음 확장(F-x) 시점에 고려.

## 긍정적으로 평가할 부분

- `isInternalCtx` narrowing helper 재사용: `assertNodeId(dto, ctx)` 존재 검사와 `expectedNodeId` 계산(`interaction.service.ts:1533`) 이 동일한 discriminated-union 판별을 공유해 두 판정이 어긋날 여지가 없다. `interaction.service.ts` 내부 응집도는 좋다.
- `hooks.service.ts` 에서 `nodeId: 'chat-channel'` 매직 스트링 placeholder 를 완전히 제거하고 필드 자체를 생략하는 방식으로 바꾼 것은 "가짜 도메인 값으로 존재 검사만 통과시키는" 안티패턴을 제거한 개선이다.
- `resolveWaitingNodeExecutionId` 내부의 검증 파이프라인(rows lookup → 0건/다건 invariant → nodeId 일치 → 표면(interactionType) 일치) 은 순서·책임이 명확해 한 곳에서 읽고 추론 가능하다 — publisher chokepoint 자체의 응집도는 훼손되지 않았다.
- `InvalidExecutionStateError` 하나를 두고 진입점별로 다른 HTTP/WS 표현(EIA 409 `STATE_MISMATCH`, REST `/continue` 422 `INVALID_STATE`, WS ack `INVALID_EXECUTION_STATE`)으로 번역하는 어댑터 패턴은 이번 diff 에서도 일관되게 유지된다(비즈니스 예외와 전송 계층 코드의 분리).
- 테스트가 unit(engine 레벨 nodeId 일치/불일치, interaction.service 레벨 threading·면제)과 e2e(HTTP 경계에서 409 실증)로 계층에 맞게 나뉘어 있다.

## 요약

`resolveWaitingNodeExecutionId` 를 단일 chokepoint 로 두고 nodeId 일치 검사를 그 안에 추가한 결정 자체는 아키텍처적으로 타당하다(검증 로직의 응집도는 유지됨). 그러나 이 chokepoint 의 활성화를 담당하는 `expectedNodeId` 는 optional positional 파라미터로 각 caller 가 개별 계산해 넘기는 구조라, 파일 경계를 넘는 순간 결합이 끊긴다 — 실제로 이번 diff 는 EIA REST `/interact` 경로만 이 값을 채워 넣었고, WS gateway 와 REST `/continue` 는 여전히 검사를 건너뛴다. 더 심각한 것은 이 diff 가 함께 수정한 spec 문서가 "WS 도 nodeId 를 지정한다" 고 서술하는데, 같은 diff 의 엔진 코드 JSDoc 은 정반대("EIA `/interact` 만 전달")로 서술하고, 실제 WS 코드는 둘 중 어느 서술과도 일치하지 않는다는 점이다. 이는 이 프로젝트가 중시하는 spec-impl SoT 원칙에 정면으로 어긋나며, 같은 저장소에 이미 존재하는 더 견고한 패턴(`InteractionRequestContext` discriminated union + `isInternalCtx`)을 이번 가드에는 적용하지 않아 나온 결과로 보인다. 나머지 부분 — validation 파이프라인 응집도, 에러 어댑터 계층, 테스트 계층화 — 는 양호하다.

## 위험도

HIGH
