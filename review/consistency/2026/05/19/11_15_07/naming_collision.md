# 신규 식별자 충돌 검토 결과

검토 대상: multi-turn AI Agent turn 실패 (LLM throw — 429 등) 시 NodeExecution.status=FAILED 전이 + finalize 누락 픽스
신규 식별자: `handleAiTurnError`
검토 모드: 구현 착수 전 검토 (--impl-prep)

---

## 발견사항

### [INFO] `handleAiTurnError` — 신규 private 메서드, 충돌 없음
- target 신규 식별자: `handleAiTurnError(executionId, node, resumeState, nodeExec, err)` (`execution-engine.service.ts` 내 신규 private helper)
- 기존 사용처: 없음. `spec/`, `codebase/backend/src/` 전체에서 `handleAiTurnError` 또는 `handleAiError` 라는 이름은 발견되지 않음.
- 상세: 기존 `execution-engine.service.ts` 에는 `handleAiMessageTurn`, `handleAiEndConversation`, `finalizeAiNode`, `emitAiWaitingForInput` 이라는 네 가지 private AI 관련 메서드가 존재한다. `handleAiTurnError` 는 이들과 이름 패턴(`handleAi*`)이 일치하고 의미 범위도 구별되므로 충돌이 없다. plan 문서는 `handleAiEndConversation` 과 같은 패턴을 명시적으로 참조하고 있어 명명 일관성도 양호하다.
- 제안: 변경 불필요.

### [INFO] `endReason = 'error'` — 이미 인터페이스에 선언됨, 재정의 불필요
- target 신규 식별자: `endReason: 'error'` (catch 분기에서 사용 예정)
- 기존 사용처:
  - `codebase/backend/src/nodes/core/node-handler.interface.ts` L240: `endReason: 'user_ended' | 'max_turns' | 'condition' | 'error'`
  - `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` L1808, L1837, L1911-L1919: `endReason: 'error'` 가 이미 union 에 포함되어 있고 `multiTurnPortForEndReason` 에서 `'error'` → `'error'` port 로 라우팅.
  - `spec/4-nodes/3-ai/1-ai-agent.md` §7.9: `port: "error"`, `status: "ended"` shape 명시.
- 상세: 신규 구현이 `endReason = 'error'` 를 사용하는 것은 기존 인터페이스 및 spec 과 완전히 일치하며 새로운 값의 도입이 아님. 충돌 없음.
- 제안: 변경 불필요. plan 대로 기존 `handler.endMultiTurnConversation(resumeState, 'error')` 를 직접 호출하는 경로가 자연스럽다.

### [INFO] `buildMultiTurnErrorOutput` — plan 이 언급하는 잠재적 신규 메서드, 현재 미존재
- target 신규 식별자: `buildMultiTurnErrorOutput` (plan §"2) ai-agent.handler.ts" 에 "신규 메서드가 필요한지 판단" 으로 언급됨)
- 기존 사용처: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` 에 해당 이름은 존재하지 않음. 기존 `buildMultiTurnFinalOutput` 이 `endReason='error'` 를 수용하는 경로가 이미 존재함 (L1833–L1897).
- 상세: plan 은 기존 `buildMultiTurnFinalOutput` 이 spec §7.9 와 일치하는지 확인 후 신규 메서드 도입 여부를 판단하도록 명시함. 현재 코드 확인 결과 `buildMultiTurnFinalOutput` 은 `endReason='error'` 케이스를 지원하고 `port='error'` 로 라우팅하나, `output.error.{code, message, details}` 필드 병존 로직은 포함하지 않음(현재 `output.result.*` 만 반환). spec §7.9 shape 을 완전히 만족하려면 `output.error` 필드 주입이 추가로 필요하다. 이 추가 로직을 `buildMultiTurnFinalOutput` 확장으로 처리하든 신규 메서드로 분리하든 이름 충돌은 발생하지 않음.
- 제안: `buildMultiTurnErrorOutput` 라는 별도 메서드를 도입할 경우 기존 `buildMultiTurnFinalOutput`, `buildConditionOutput`, `buildSingleTurnOutput` 의 명명 패턴과 일관되어 적합하다. 충돌 없음.

### [INFO] `NODE_FAILED` 이벤트 — 이미 존재하는 이벤트 타입, 재정의 아님
- target 신규 식별자: `NODE_FAILED` 이벤트 emit (plan §1 "NODE_FAILED ... 발사")
- 기존 사용처:
  - `codebase/backend/src/modules/websocket/websocket.service.ts` L62: `NODE_FAILED = 'execution.node.failed'`
  - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L3099, L4461: 이미 `NodeEventType.NODE_FAILED` 로 emit 중.
  - `spec/3-workflow-editor/3-execution.md` L379: `NODE_FAILED` WebSocket 이벤트 명시.
- 상세: 신규 구현에서 `NODE_FAILED` 를 emit 하는 것은 이미 정의된 이벤트 타입을 사용하는 것이므로 충돌 없음. 새로운 이벤트 이름을 도입하지 않음.
- 제안: 변경 불필요.

### [INFO] `finalizeAiNode` FAILED 분기 확장 — 메서드 자체 충돌 없음
- target 신규 식별자: `finalizeAiNode` 의 새 파라미터 또는 분기 (`endedWithError: boolean` 또는 `finalStatus` 추가 가능성 언급)
- 기존 사용처: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L2377: `private async finalizeAiNode(savedExecution, executionId, node, context, nodeExec)` — 현재 `nodeExec.status = NodeExecutionStatus.COMPLETED` 만 처리.
- 상세: 기존 메서드의 시그니처를 확장하는 것이므로 이름 충돌이 아닌 시그니처 변경이다. `finalizeAiNode` 와 같거나 유사한 이름의 다른 메서드는 프로젝트 전체에 존재하지 않음.
- 제안: 변경 불필요.

---

## 요약

신규 식별자 `handleAiTurnError` 는 spec, 인터페이스, 기존 코드 어느 영역에서도 이미 사용 중인 이름이 아니며, 기존 `handleAiMessageTurn` / `handleAiEndConversation` 패턴과 일관된 명명을 따른다. `endReason = 'error'` 는 기존 union 타입에 이미 선언된 값이고, `NODE_FAILED` 이벤트도 기존에 정의된 타입을 재활용하는 것이다. 잠재적 신규 메서드 `buildMultiTurnErrorOutput` 도 기존 네이밍 컨벤션과 충돌하지 않는다. 식별자 충돌 관점에서 이번 구현 계획을 차단하는 요소는 없다.

---

## 위험도

NONE
