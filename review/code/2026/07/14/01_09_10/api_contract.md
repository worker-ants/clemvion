# API 계약(API Contract) 리뷰

대상: `eia-command-waiting-surface-guard` F-1 — `ExecutionEngineService.resolveWaitingNodeExecutionId` 에
`expectedNodeId` 검사 추가, EIA `/interact` 가 dto.nodeId 를 publisher 로 전달, chat-channel
(`in_process_trusted`) 은 면제. spec `4-execution-engine.md §7.5.1` 동시 갱신.

## 발견사항

- **[WARNING]** EIA `/interact` breaking-behavior 배포와 F-3(공지 결정) 미해결의 시점 불일치
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `resolveWaitingNodeExecutionId` (nodeId 불일치 시 `InvalidExecutionStateError` throw) / `codebase/backend/src/modules/external-interaction/interaction.service.ts` `dispatchContinuation`(409 `STATE_MISMATCH` 매핑) / `plan/in-progress/eia-command-waiting-surface-guard.md` F-3 항목
  - 상세: 이 PR 은 외부 EIA `/interact` 에서 종전 202(대기 노드와 다른 `nodeId` 를 보내도 현재 대기 노드에 그대로 오적용되어 수용)였던 명령 조합을 409 `STATE_MISMATCH` 로 바꾼다. plan 파일의 F-3 항목("본 PR 은 종전 202 를 반환하던 명령 조합을 409 로 바꾼다 … 공지 필요 여부·채널을 planner 가 명시적으로 결정할 것")은 여전히 체크되지 않은 미해결 상태이며, `spec/5-system/14-external-interaction-api.md §12 호환성` 섹션도 이번 변경으로 갱신되지 않았다(§12 는 여전히 "필드 추가만, 하위 호환" 류의 additive 변경만 기술). 이 프로젝트는 EIA URL 이 비버저닝 단일 버전이라, 외부 통합 클라이언트가 (버그에 기댄) 종전 lenient 동작에 의존했다면 이 배포 시점부터 조용히 409 를 받기 시작한다.
  - 완화 요인: `interact.dto.ts` 의 `nodeId` Swagger 설명("waiting_for_input 상태인 NodeExecution 의 graph node id 와 일치해야 한다")과 spec EIA-IN-13 / §5.1 `STATE_MISMATCH` 표가 이미 이 요구를 문서화하고 있었으므로, 문서를 따른 정상 클라이언트는 영향이 없다 — 실질적으로 "버그 수정" 성격이 강하다. 그럼에도 계약(성공하던 호출이 실패로 바뀜) 관점에서는 breaking 이다.
  - 제안: (1) F-3 을 이 PR 과 같은 배포 사이클 내에 project-planner 가 명시적으로 결정·완료 처리(공지 불필요 결론이어도 근거를 F-3 항목에 기록), (2) `§12 호환성` 에 이번 변경을 한 줄 추가(예: "잘못된/오지정 `nodeId` 로 submit 하던 클라이언트는 이제 202 대신 409 `STATE_MISMATCH` 를 받는다 — 종전 동작은 stale 제출을 현재 대기 노드에 오적용하는 버그였다").

- **[WARNING]** spec §7.5.1 신규 표 행이 WS 진입점의 실제 강제 범위를 과장
  - 위치: `spec/5-system/4-execution-engine.md §7.5.1` 신규 "nodeId 불일치" 행("**caller 가 nodeId 를 지정할 때만** 적용 — 외부 EIA `/interact`(`InteractDto.nodeId`)·**WS** 는 지정하고 … 면제한다") vs. `codebase/backend/src/modules/websocket/websocket.gateway.ts` (`continueExecution`/`continueButtonClick`/`continueAiConversation`/`endAiConversation` 호출부, 3번째 인자 `expectedNodeId` 미전달)
  - 상세: 신규 spec 문장은 "외부 EIA `/interact`·WS 는 [nodeId 를] 지정하고" 라고 서술해 WS 채널도 동일하게 nodeId 일치 검사를 받는 것처럼 읽힌다. 그러나 실제로는 `resolveWaitingNodeExecutionId` 의 `expectedNodeId` 를 WS gateway 는 전혀 전달하지 않는다(기본값 `undefined`) — 이번 커밋 메시지 자체도 "WS/`/continue` 무영향" 이라고 명시한다. WS 페이로드에는 `nodeId` 필드가 실려 오지만(`click_button`/`submit_message`/`end_conversation` 이벤트), 이번 검증에는 전혀 사용되지 않는다. 즉 F-1 이 REST 에서 막은 "stale/오지정 nodeId 가 현재 대기 노드에 오적용" 클래스의 문제가 WS 경로에는 그대로 남아 있는데, 방금 갱신한 spec 문장은 반대로 읽힌다.
  - 제안: §7.5.1 문장에서 "WS 는 지정하고" 부분을 삭제하거나 정정("WS 는 현재 미검증 — 후속 트랙")하여 spec 이 실제 강제 범위와 일치하도록 하고, 필요하면 WS 도 동일 검사를 적용할지 여부를 별도 후속 항목(F-6 급)으로 등록할지 판단.

- **[INFO]** 409 응답 메시지가 실제 대기 중인 nodeId 를 노출
  - 위치: `execution-engine.service.ts` `` `command nodeId=${expectedNodeId} does not match waiting node=${rows[0].nodeId} for execution=${executionId}` `` → `interaction.service.ts` `dispatchContinuation` 이 `err.message` 를 그대로 `error.message` 에 실어 409 응답으로 반환
  - 상세: 잘못된 `nodeId` 로 제출한 외부 호출자에게 실제 대기 중인 올바른 `nodeId` 값을 알려주는 셈이다. 호출자는 이미 해당 execution 에 스코프된 유효 `iext_*`/`itk_*` 토큰을 보유하고 있고 `GET /api/external/executions/:id` (`getStatus`) 로도 `currentNode.id`/`context.waitingNodeId` 를 조회할 수 있으므로 새로운 정보 노출은 아니다. 기존 `assertWaiting` 의 `current=${execution.status}` 노출과도 같은 패턴이라 프로젝트 관례에 부합한다.
  - 제안: 현재 관례상 문제 삼을 수준은 아니나, 향후 에러 메시지 표준화 시 "client-safe fixed message + serverDetail" 패턴(`MessageTooLongError` 처리와 동일)으로 통일을 고려.

- **[INFO]** 에러 코드·HTTP 상태 매핑은 기존 계약과 정합
  - 상세: 신규 실패 사유(nodeId 불일치)가 기존 `InvalidExecutionStateError` → EIA 409 `STATE_MISMATCH` / WS ack `INVALID_EXECUTION_STATE` / REST `/continue` 422 `INVALID_STATE` 매핑을 그대로 재사용해 신규 에러 코드를 도입하지 않았다. `error-codes-catalog` SoT 동기가 불필요하다는 plan 의 판단이 맞다. 응답 envelope(`{error:{code,message}}`)도 기존 형식을 그대로 따른다.

- **[INFO]** 신뢰 경계(`in_process_trusted`) 위조 불가 확인
  - 상세: `InteractionGuard` 가 반환하는 타입은 항상 `ExternalInteractionRequestContext`(scope 필드 자체가 타입에 없음)이고, `scope: 'in_process_trusted'` 는 `HooksService` 가 in-process 로 직접 구성하는 `InternalInteractionRequestContext` 리터럴에만 존재한다. HTTP body/header 로 들어온 `scope` 값이 도달할 타입 슬롯이 없어 외부 요청이 nodeId 검사 면제를 스푸핑할 수 없다 — 인가 경계가 컴파일 타임으로 강제된다. 견고한 설계.

- **[INFO]** 요청 검증 계층 일관성
  - 상세: `InteractDto.nodeId` 는 `@IsUUID()` + `@IsOptional()` (command 별 필수 여부가 다르므로 DTO 레벨에서는 항상 optional로 두고 `assertNodeId` 가 command/ctx 조합별로 런타임 강제)로, 기존 패턴(`buttonId`/`data`/`message` 등도 동일 방식)과 일관된다. `in_process_trusted` 면제 시 `assertNodeId` 조기 return 으로 nodeId 존재 요구 자체를 skip 하는 것도 명확히 문서화되어 있다.

## 요약

핵심 변경은 EIA `/interact` (그리고 4종 continuation publisher)에 `nodeId` 실제 대기 노드 일치 검사를 추가해, 종전엔 stale/오지정 `nodeId` 제출이 현재 대기 노드에 조용히 오적용되던 결함을 409 `STATE_MISMATCH` 로 동기 거부하도록 고친 것이다. 에러 코드·HTTP 상태 매핑은 기존 계약(`InvalidExecutionStateError` → REST 409 / WS ack / `/continue` 422)을 재사용해 스키마·응답 형식 일관성은 잘 유지됐고, `in_process_trusted` 신뢰 경계도 타입 레벨로 안전하게 강제된다. 다만 이는 명백히 이전에 202 를 반환하던 (문서상으로는 이미 금지됐던) 명령 조합을 409 로 바꾸는 하위 호환성 영향이 있는 변경인데, 이를 외부 클라이언트에 공지할지 결정하는 F-3 항목이 plan 상 여전히 미해결이고 `spec §12 호환성` 섹션도 이번 변경을 반영하지 않았다. 아울러 이번에 갱신된 spec §7.5.1 문구가 WS 채널도 nodeId 를 검증받는 것처럼 서술하지만 실제 WS gateway 코드는 `expectedNodeId` 를 전달하지 않아 spec-구현 간 서술 불일치가 새로 생겼다. 두 사항 모두 병합을 막을 결함은 아니나 API 계약 문서·공지 프로세스의 완결성 관점에서 후속 조치가 필요하다.

## 위험도
MEDIUM
