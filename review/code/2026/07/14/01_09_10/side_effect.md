# 부작용(Side Effect) Review

## 발견사항

- **[INFO]** `expectedNodeId?` 시그니처 확장은 하위 호환 안전 — WS gateway·`/continue` REST 는 미갱신 상태로 계속 동작
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`continueExecution` L4699, `continueButtonClick` L4815, `continueAiConversation` L4839, `endAiConversation` L4867, private `resolveWaitingNodeExecutionId` L5272)
  - 상세: 4개 public 메서드 + 1개 private 메서드 모두 **trailing optional** 파라미터로 `expectedNodeId?: string` 를 추가했다. 실제 codebase 전수 grep 결과 이 diff 는 `interaction.service.ts` 호출부만 갱신했고, 다른 두 caller — `codebase/backend/src/modules/websocket/websocket.gateway.ts` (L538, L604, L671, L735, `execution.submit_form`/`click_button`/`submit_message`/`end_conversation` 핸들러) 와 `codebase/backend/src/modules/executions/executions.controller.ts` (`/api/executions/:id/continue`, L175 `continueExecution(id, body?.formData)`) — 는 이 diff 대상 파일에 포함되지 않아 그대로 2-인자(또는 1-인자) 호출을 유지한다. TS optional trailing param 이므로 컴파일 에러 없음, 런타임에서는 `expectedNodeId === undefined` 로 들어가 새 nodeId 일치 검사(§7.5.1)가 그대로 skip 되어 **diff 이전과 동일하게 동작**한다. `spec/5-system/6-websocket-protocol.md` L1050 정정 문구("WS 핸들러 시그니처 모두 nodeId 를 보내지도 받지도 않는다")와도 정합 — 의도된 설계다.
  - 제안: 없음(확인 목적 기록). 다만 향후 WS 표면에도 동일 nodeId 무결성 가드를 확장할 계획이 있다면 별도 plan 항목으로 추적 권장.

- **[WARNING]** 외부 EIA `/interact` 캐IIer 에 대한 실질적 행동 변경(호환성 영향) — 기존에는 무시되던 `nodeId` 불일치가 이제 409 로 거부됨
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` L119(`expectedNodeId` 계산), L1858-1866(`assertNodeId`); `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L5335-5341(신규 nodeId 매칭 분기)
  - 상세: diff 이전에는 `assertNodeId`(구 시그니처 `(dto)`) 가 `dto.nodeId` **존재 여부**만 검사했고, 그 값이 실제 대기 노드와 일치하는지는 검증하지 않았다 — 즉 caller 가 형식만 맞는 임의/과거 nodeId 를 보내도 서버는 "현재 대기 중인 단 하나의 NodeExecution" 을 그대로 재개시켰다. 이번 변경으로 외부 scope(`iext`/`itk`) 요청은 `dto.nodeId` 가 실제 대기 노드 id 와 정확히 일치해야 하며, 불일치 시 `InvalidExecutionStateError` → EIA 409 `STATE_MISMATCH` 로 거부된다(신규 테스트로 커버됨: `execution-engine.service.spec.ts` F-1). 이는 `plan eia-command-waiting-surface-guard`/spec §7.5.1 이 의도한 보안 강화이자 정상적인 스펙 변경이지만, **기존 외부 EIA 통합 클라이언트가 stale/부정확한 nodeId 를 보내던 호출 패턴에 실제로 의존하고 있었다면** 배포 후 이전에 성공하던 요청이 새로 409 를 받게 되는 **외부에 노출된 행동 변화**다.
  - 제안: 이미 `spec/5-system/14-external-interaction-api.md` §5.1 에러 표가 "다른 nodeId" 사유를 STATE_MISMATCH 로 문서화하고 있어 spec 정합은 확인됨. 다만 이 payload 범위 밖이라 실제로 릴리스 노트/외부 연동 가이드 갱신이 함께 나갔는지는 이 리뷰 대상 파일만으로는 확인 불가 — orchestrator/개발자가 "구현 완료" 판단 시 EIA 외부 문서·체인지로그 반영 여부를 별도 체크리스트로 확인 권장.

- **[INFO]** 확인됨 — nodeId 불일치 상세 메시지는 client 로 leak 되지 않음 (기존 client-safe 패턴 준수)
  - 위치: `execution-engine.service.ts` L5335-5341 (`throw new InvalidExecutionStateError(...)`), `workflow-errors.ts` L113-125(`InvalidExecutionStateError`), `interaction.service.ts` L451(`dispatchContinuation`), `websocket.gateway.ts` L940-971(`buildContinuationErrorAck`)
  - 상세: 처음에는 `command nodeId=... does not match waiting node=... for execution=...` 문자열이 그대로 client 응답에 실리는지 의심했으나, `InvalidExecutionStateError` 생성자가 `super('Execution is not waiting for input.', detail)` 형태로 **고정 client-safe `message`** 와 **`serverDetail`(로그 전용)** 를 분리하는 `ExecutionError` 기반 클래스라, 실제 상세 문자열(두 nodeId 포함)은 `serverDetail` 에만 담긴다. `interaction.service.dispatchContinuation` 은 `err.message`(고정 문자열)만 409 응답에 실으며, `websocket.gateway.buildContinuationErrorAck` 도 동일하게 `error.message` 만 client 로 보내고 `error.serverDetail` 은 서버 로그(`logger.warn`)에만 남긴다. `MessageTooLongError` 등 형제 에러가 이미 따르는 "고정 client-safe message + 서버 전용 detail" 관례와 일치 — 신규 코드가 이 불변식을 깨지 않았다.
  - 제안: 없음(정상 확인).

- **[INFO]** `hooks.service.ts` 의 `nodeId: 'chat-channel'` placeholder 제거는 무해
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` (`text_message`/`button_callback` → `InteractDto` 합성부)
  - 상세: 신규 `assertNodeId(dto, ctx)` 는 `isInternalCtx(ctx)` 이면 `dto.nodeId` 값을 아예 읽지 않고 조기 반환하고, `interaction.service.ts` L119 의 `expectedNodeId = isInternalCtx(ctx) ? undefined : dto.nodeId` 도 internal ctx 에서는 `dto.nodeId` 값과 무관하게 항상 `undefined` 로 강제한다. 따라서 placeholder 제거는 순수 정리(cleanup)이며 동작 변화가 없다. `hooks.service.spec.ts` 의 관련 assertion 은 모두 `expect.objectContaining({ command, message/data })` 형태로 `nodeId` 를 단언하지 않아 회귀 없음을 확인.
  - 제안: 없음.

- **[INFO]** publish 되는 continuation bus 메시지 payload(worker 가 소비하는 wire shape)는 변경 없음
  - 위치: `execution-engine.service.spec.ts` L38-45(F-1 테스트의 `mockBus.publish` 기대값)
  - 상세: `expectedNodeId` 는 순수 pre-publish guard 파라미터로만 쓰이고 `{ type, executionId, nodeExecutionId, payload }` 발행 메시지 자체에는 포함되지 않는다. worker 측 소비자·큐 스키마에는 영향 없음.
  - 제안: 없음.

- 그 외 관점(전역 변수·파일시스템·환경 변수·네트워크 호출) 은 해당 diff 범위에서 발견되지 않음 — 순수 in-memory 파라미터 threading + 기존에 이미 fetch 된 `rows[0]` 에 대한 조건 분기 추가.

## 요약

이번 변경은 `continueExecution`/`continueButtonClick`/`continueAiConversation`/`endAiConversation`/`resolveWaitingNodeExecutionId` 에 optional trailing 파라미터 `expectedNodeId` 를 추가하는 additive 시그니처 확장이라 WS gateway·대시보드 REST `/continue` 등 diff 에 포함되지 않은 caller 는 컴파일·런타임 모두 영향받지 않고 이전 동작(nodeId 미검증)을 그대로 유지한다(spec 상 의도된 설계). 유일하게 실질적 caller 인 `interaction.service.ts`(외부 EIA `/interact`) 는 `in_process_trusted` scope 를 명시적으로 면제하며 새 nodeId 일치 검사를 도입했는데, 이는 spec §7.5.1 이 의도한 보안 강화이지만 기존에 nodeId 값 불일치를 조용히 허용하던 외부 API 소비자 입장에서는 새로운 409 거부를 겪을 수 있는 관찰 가능한 행동 변화다. 에러 메시지는 `InvalidExecutionStateError` 의 client-safe message/serverDetail 분리 패턴을 그대로 따라 실제 nodeId 값이 client 로 유출되지 않음을 코드 추적으로 확인했다. 전역 상태·파일시스템·환경변수·네트워크·이벤트 배선 관점의 부작용은 발견되지 않았다.

## 위험도

LOW
