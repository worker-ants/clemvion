# Plan 정합성 검토 — `plan/in-progress/ai-node-failed-conversation-preview.md`

## 발견사항

- **[WARNING]** `node-output-redesign/ai-agent.md` 의 미해소 P0 CRITICAL(single-turn error 라우팅)과 target 의 `node.failed` 귀속 로직이 상호작용해 대화 오염(cross-node leak) 리스크가 생기는데 어느 문서도 교차 참조하지 않음
  - target 위치: `plan/in-progress/ai-node-failed-conversation-preview.md` Phase 2 항목 1·2 ("`isFailedConversation` 도출 — 귀속 판정은 `conversationMessages` 중 `systemError.nodeId === result.nodeId` 인 item 존재 여부", "`effectiveConversationMessages` 에 failed 분기 반영 — store 사본 사용")
  - 관련 plan: `plan/in-progress/node-output-redesign/ai-agent.md` §"종합 개선안 (2026-05-16)" 첫 항목(CRITICAL, single-turn 잔여) 및 `plan/in-progress/node-output-redesign/README.md` "우선순위 항목 net 변화 — P0" ("잔여: single-turn(`executeSingleTurn`) 경로만" — `llmService.chat` 호출이 여전히 try/catch 미적용, throw 가 그대로 engine FAILED 로 전파)
  - 상세: 실측 확인 결과, `executeSingleTurn`(`codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:1525-` 이하) 은 `buildTools` pre-flight 의 `ToolDefinitionPayloadExceededError` 만 로컬 catch 하고(`buildSingleTurnToolsOrError`, :1472-1523) `llmService.chat` 자체 호출(:1807-1821)은 여전히 uncaught — 이 throw 는 엔진의 범용 FAILED 처리 경로로 흘러 `execution.node.failed` WS 이벤트(`nodeType: 'ai_agent'`)를 발생시킨다. 이는 target 의 배경 섹션이 기술하는 "node.failed 경로"와 **동일한 이벤트**다.
    프론트 `isMultiTurnAiContext(nodeType)`(`use-execution-events.ts:143-146`)는 **turn mode 가 아니라 nodeType** 만으로 게이트하고(`nodeType === 'ai_agent'` + `conversationMessages.length > 0`), `conversationMessages` 는 execution 단일 배열(`execution-store.ts:254` — 노드별로 분리되지 않음)이다. 즉 한 워크플로우에 (a) 이미 정상 종료한 멀티턴 AI Agent 노드와 (b) 나중에 실패하는 단일턴(single_turn) AI Agent 노드가 함께 있으면:
    1. (b) 의 `llmService.chat` throw → 엔진 FAILED → `node.failed`(nodeType `ai_agent`) 발사
    2. `isMultiTurnAiContext` 가 (a) 가 남긴 `conversationMessages.length > 0` 때문에 true 로 게이트 → (b) 의 `nodeId` 를 단 `system_error` item 이 APPEND 됨(기존 구현, 정상 동작)
    3. target Phase 2 의 `isFailedConversation` 판정은 "`systemError.nodeId === result.nodeId` 존재 여부"만 확인 — 참이면 `effectiveConversationMessages` 로 **store 전체 사본**(=(a) 의 무관한 대화 turn 전부 + (b) 의 system_error)을 노출
    → (b)(단일턴, 대화 없음) 의 미리보기 탭에 (a)(전혀 다른 노드) 의 대화 내역이 자기 것처럼 표시될 수 있다. 프론트는 실패 노드의 `config.mode`(single_turn/multi_turn)를 전혀 받지 않는다(`handleNodeFailed` payload 타입에 `config` 필드 자체가 없음, `use-execution-events.ts:823-840`) — 따라서 target 의 "정확히 스코프" 의도(Phase 2 항목 1 주석)가 코드 상으로는 노드 간 완전한 스코프 분리를 보장하지 못한다.
  - 제안: (a) target plan 에 `node-output-redesign/ai-agent.md` 의 single-turn CRITICAL 을 선행/병행 의존으로 명시 교차 참조(반대로 그쪽 plan 에도 본 plan 역참조), (b) Phase 2 구현 시 `effectiveConversationMessages` 를 `systemError.nodeId` 매칭 기준으로 **필터링**하거나 최소한 매칭 turn 이후 구간으로 한정해 타 노드 대화 누출을 차단, 또는 (c) single-turn CRITICAL 을 함께/우선 해소해 애초에 `node.failed` 표면이 multi-turn 에만 남도록 축소.

- **[WARNING]** target 의 자체 진단표가 근거로 든 "CT-S9/S10 이 `node.completed`+`port:'error'` 를 커버" 서술이 실제 테스트 코드와 불일치 — Phase 1 이 작성할 "충족 테스트 매핑 표"에 오류가 전파될 위험
  - target 위치: `ai-node-failed-conversation-preview.md` "두 오류 경로의 UI 분기" 표 — `node.completed + port:'error'` 행에 "✅ 노출 (CT-S9/S10 이 커버)"
  - 관련 plan: 없음(target 문서 자체의 내적 일관성 문제) — 다만 target Phase 1 항목 4 "CT-S15/CT-S16 시나리오 추가 + **충족 테스트 매핑 표 갱신**" 이 이 진단을 근거로 spec 표를 작성하므로 plan 산출물 정확성에 직결
  - 상세: 실측(`codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts:1909-1992`) 확인 결과 CT-S9("node.failed (retryable=true)")·CT-S10("node.failed (retryable=false)") 두 테스트는 **모두 `execution.node.failed` 핸들러**를 호출한다(`failed?.({...})`). `node.completed`+`output.error` 시나리오는 별도의 (CT-ID 미부여) 테스트("node.completed with output.error APPENDs system_error (multi-turn AI port=error)")가 커버한다. 즉 target 표의 "CT-S9/S10 이 `node.completed` 경로를 커버"라는 서술은 실제로는 `node.failed` 경로(=target 이 "소멸"이라 부르는 바로 그 이벤트)를 커버한 것이다 — 다만 CT-S9/S10 은 **store 레벨(conversationMessages APPEND)** 만 검증하고 target 이 고치려는 **렌더 게이트(result-detail.tsx 의 tab 가시성)** 는 검증하지 않으므로 target 의 최종 결론("렌더 층 도달 불가 gap") 자체는 유효하다. 다만 진단표의 "동일 사용자 경험이어야 하는데 갈림" 프레이밍(마치 `node.completed+port:'error'` 가 production 에서 실제로 자주 발생하는 대칭 경로처럼 서술)도 재검토 필요 — 실측(`ai-turn-orchestrator.service.ts` `handleAiTurnError`(:966-1035)→`finalizeAiNode`(:1212-1325))상 multi-turn 대화 turn 에러는 **예외 없이** `finalStatus:'FAILED'` 로 귀결되어 `NODE_FAILED` 만 발사되고, `NODE_COMPLETED`+`port:'error'` 로 끝나는 실제 backend 경로는 발견되지 않았다(해당 핸들러 output shape 자체는 `port:'error'`/`status:'ended'` 이지만 엔진이 이를 NodeExecutionStatus.FAILED 로 최종 저장·발사).
  - 제안: Phase 1 착수 전 "충족 테스트 매핑 표" 작성 시 CT-S9/S10 을 `node.failed` 커버로 정정하고, `node.completed`+`port:'error'` 가 실제 도달 가능한 backend 경로인지(혹은 방어적/이론적 케이스인지) 재확인 후 진단표 문구를 조정.

- **[INFO]** `status: 'cancelled'` 멀티턴 대화 노드의 동일 렌더 갭이 target 스코프·Inv-8 일반화 문구와 어긋날 수 있음
  - target 위치: `ai-node-failed-conversation-preview.md` Phase 1 항목 2 "Inv-8 신설 — ... conversation 은 `result.status` 와 **무관하게** 미리보기 탭으로 도달 가능해야 한다" vs Phase 2 항목 1 "`isFailedConversation` 도출"(failed 만 명시)
  - 관련 plan: `plan/in-progress/node-cancellation-inflight-followups.md` (best-effort in-flight cancel 후속) — 취소된 노드도 `status: 'cancelled'` 로 종결되며, 현재 `result-detail.tsx` 의 `showTabs`/`isConversationNode` 게이트는 `'completed'|'failed'|'waiting_for_input'` 만 열거하고 `'cancelled'` 는 포함하지 않는다(코드 확인).
  - 상세: Inv-8 문구는 "status 와 무관"이라고 일반화했지만 Phase 2 구현 항목은 `failed` 분기만 명시한다. 사용자가 진행 중인 멀티턴 대화를 Stop 으로 취소하면 동일한 "대화 소실처럼 보임" 증상이 재현될 가능성이 있으나 target 은 이를 스코프에도, 제외 목록에도 명시하지 않았다.
  - 제안: Inv-8 의 일반화된 문구를 유지할 것이면 Phase 2/3 에 `cancelled` 케이스를 최소 스모크 테스트로 포함하거나, 범위를 "failed 한정"으로 좁혀 문구를 정정하고 cancelled 케이스는 별도 후속으로 명시.

## 요약

target plan 은 "결정 필요"로 남겨진 항목을 우회하거나 다른 in-progress plan 의 완료된 결정을 뒤집지는 않는다 — `ai-agent-tool-connection-rewrite.md`(도구 연결 재설계 미결정)·`spec-drift-ai-agent-outport-countmax.md`(spec 자기모순) 등은 target 이 건드리는 파일·범위와 겹치지 않아 직접 충돌은 없다. 다만 동일 "AI Agent + `node.failed`" 문제 표면을 다루는 `node-output-redesign/ai-agent.md` 의 미해소 P0(single-turn error 라우팅 미구현)와 target 의 신규 귀속 로직이 실제로 상호작용하며, 그 상호작용이 execution-scope 단일 `conversationMessages` 배열·노드 모드 정보 부재라는 기존 프론트 구조와 맞물려 잠재적 cross-node 대화 오염을 낳을 수 있는데도 두 plan 어느 쪽도 서로를 참조하지 않는다. 또한 target 자신의 진단표가 인용한 CT-S9/S10 테스트 커버리지 서술이 실측과 달라, Phase 1 이 작성할 spec 테스트 매핑 표에 오류가 전파될 위험이 있다. 이 두 WARNING 은 target 의 핵심 결론(렌더 층 갭 존재)을 무효화하지는 않지만, Phase 1 spec 문구·Phase 2 구현 설계를 확정하기 전에 반영할 가치가 있다.

## 위험도

MEDIUM
