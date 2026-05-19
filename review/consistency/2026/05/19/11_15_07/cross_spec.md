# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep`
대상 작업: multi-turn AI Agent turn 실패(LLM throw — 429 등) 시 `NodeExecution.status=FAILED` 전이 + finalize 누락 픽스
관련 worktree: `ai-agent-turn-fail-finalize-a22724`
신규 spec 변경: 없음 (기존 `spec/4-nodes/3-ai/1-ai-agent.md §7.9` shape 에 코드를 맞추는 구현 픽스)
검토 기준일: 2026-05-19

---

## 발견사항

### [INFO] §7.9 오류 shape 과 `endReason` 필드 부재 — 명칭 혼동 주의
- target 위치: 구현 대상 `handleAiTurnError` 식별자 및 `endMultiTurnConversation('error' endReason 처리)`
- 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md §7.9`
- 상세: `spec/4-nodes/3-ai/1-ai-agent.md §7.9` 의 multi-turn 오류 출력 shape(`port: "error"`, `status: "ended"`)에는 `endReason` 필드가 존재하지 않는다. `endReason` 은 §7.6~§7.8 의 정상 종결(`"out"`, `"condition"`, `"user_ended"`, `"max_turns"`) 출력에만 등장하는 필드다. `endMultiTurnConversation('error' endReason 처리 검증)` 이라는 task 기술이 `error` 를 `endReason` 의 한 값처럼 읽힐 수 있으나, spec 상으로 `output.error` 와 `endReason` 은 상호 배타적이다 (`output.error` 존재 여부로 에러/정상 판단 — §7.9 주석). 구현 시 `buildMultiTurnFinalOutput` 가 오류 경로에서 `endReason: 'error'` 를 추가로 set 하지 않아야 한다.
- 제안: 구현 착수 시 `endMultiTurnConversation` 의 `'error'` 인자가 `buildMultiTurnFinalOutput` 내에서 `output.endReason` 이 아닌 `port: "error"` + `status: "ended"` 로만 표현되는지 확인한다. spec 수정은 불필요.

### [INFO] `NodeExecution.status=FAILED` 전이와 `Execution.error` 복사 규칙 동기화 필요
- target 위치: `execution-engine.service.ts` 의 `handleAiMessageTurn try/catch` + `finalizeAiNode FAILED 분기`
- 충돌 대상: `spec/1-data-model.md §2.14 NodeExecution` 및 `spec/5-system/4-execution-engine.md §10.3`
- 상세: `spec/1-data-model.md §2.14` 는 "워크플로우 실행이 `failed` 상태로 전이될 때 **최초 failed NodeExecution** 의 에러 정보를 `Execution.error` 에 복사"한다고 명시한다 (`{ nodeId, code, message }` 구조). AI Agent 의 turn 실패 픽스에서 `finalizeAiNode FAILED` 분기가 `NodeExecution.status=FAILED` + `NodeExecution.error` 를 기록한 뒤, 상위 엔진 레이어가 `Execution.error` 복사까지 포함해 처리하는지 반드시 확인해야 한다. 이 흐름이 누락되면 UI 의 실행 목록에서 에러 원인이 표시되지 않는다.
- 제안: `finalizeAiNode FAILED` 분기 구현 시 `Execution.error` 업데이트가 기존 `ExecutionEngineService.updateExecutionStatus(failed)` 경로를 그대로 통과하는지 확인한다. spec 수정은 불필요.

### [INFO] `endAiConversation` / continuation bus 경유 — 오류 경로 예외
- target 위치: `ai-agent.handler.ts` 의 `endMultiTurnConversation 'error' endReason 처리 검증`
- 충돌 대상: `spec/5-system/4-execution-engine.md §7.4 Continuation Bus`
- 상세: `spec/5-system/4-execution-engine.md §7.4` 는 continuation bus 타입을 `continue / cancel / button_click / ai_message / ai_end_conversation` 으로 정의한다. 오류 경로(`handleAiTurnError`)는 **사용자 입력 이벤트가 아니라 엔진 내부 예외**이므로 continuation bus 를 경유하지 않고 직접 resolve/finalize 해야 한다. `endMultiTurnConversation` 의 `'error'` 경로가 `ai_end_conversation` bus 메시지를 발행하지 않아야 하며, 이는 `user_ended` 포트와의 분리를 보장하는 경계이기도 하다.
- 제안: 구현 코드에서 오류 finalize 경로와 `user_ended` / `ai_end_conversation` bus 경로가 명확히 분기되는지 검토한다. spec 수정은 불필요.

### [INFO] `ConversationThreadService.append*` mutation 단일 진입점 — 오류 시 push 여부
- target 위치: `execution-engine.service.ts` / `handleAiTurnError`
- 충돌 대상: `spec/5-system/4-execution-engine.md §6.1` (`conversationThread` 필드 주석), `spec/conventions/conversation-thread.md §2`
- 상세: `spec/5-system/4-execution-engine.md §6.1` 은 "`ConversationThreadService.append*` 가 mutation 단일 진입점, 핸들러는 직접 mutate 하지 않음"을 명시한다. turn 실패 시 `ConversationThread` 에 오류 turn 을 push 하는 로직이 있다면 동일 경로를 통해야 하며, 에러 시에는 push 하지 않는 경우에도 이 규칙을 위반하지 않아야 한다. `spec/4-nodes/3-ai/1-ai-agent.md §7.9` 는 부분 수집된 `output.result.messages` 와 `output.error` 의 병존을 허용하므로, 이미 push 된 `ai_user` / `ai_assistant` turn 은 그대로 보존되고 추가 push 없이 finalize 하는 것이 spec 에 일치한다.
- 제안: `handleAiTurnError` 가 conversation thread 에 어떤 turn 도 직접 append 하지 않는다면 본 규칙과 일치하며 별도 조치 불필요. spec 수정은 불필요.

---

## 요약

이번 구현 작업은 기존 `spec/4-nodes/3-ai/1-ai-agent.md §7.9` 가 이미 정의한 multi-turn 오류 출력 shape 에 코드를 맞추는 것이다. 신규 spec 변경이 없으므로 다른 spec 영역과 직접 모순되는 항목은 없다. 다만 구현 시 주의해야 할 경계가 세 곳 있다: (1) 오류 경로에서 `endReason` 필드를 잘못 추가하지 않을 것, (2) `NodeExecution.status=FAILED` 전이가 `Execution.error` 복사까지 이어지는 기존 엔진 경로를 그대로 통과할 것, (3) `handleAiTurnError` 가 continuation bus 를 경유하지 않고 엔진 내부에서 직접 finalize 할 것. 모두 기존 spec 과의 충돌이 아닌 구현 정합성 점검 사항이며, spec 문서 수정은 필요하지 않다.

---

## 위험도

LOW
