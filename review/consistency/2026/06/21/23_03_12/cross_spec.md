# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep`
대상 영역: `spec/4-nodes/3-ai`
구현 컨텍스트: M-1 3단계 — `AiTurnExecutor` 추출 (`ai-agent.handler.ts` god-handler 분할)

---

## 발견사항

### [WARNING] `meta.turnDebug[].toolCalls` shape — spec/4-nodes/3-ai 와 WebSocket spec 사이 필드 불일치
- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §7 각주 (line 530)
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md` §4.4 (lines 586, 605, 646)
- **상세**: `1-ai-agent.md` line 530 은 `meta.turnDebug[].toolCalls` 항목 shape 을 `{ toolCallId, name, providerKey, status: 'success' | 'error', durationMs, error? }` 로 기술하며 `startedAt?`·`finishedAt?` 를 미포함. 반면 WS spec (6-websocket-protocol.md §4.4 lines 605·646·1026) 은 `toolCalls[].startedAt`/`finishedAt` 이 `meta.turnDebug[]` JSON 에도 동일하게 영속된다고 명시("… `meta.turnDebug[].toolCalls[]` 에도 동일하게 영속되어"). 구현 파일 `ai-turn-executor.ts`의 `ToolCallTrace` 인터페이스(lines 59-70)는 WS spec 을 따라 `startedAt?`·`finishedAt?` 를 포함 — WS spec 이 권위적이다. `1-ai-agent.md` §7 각주가 stale 상태.
- **제안**: 이는 M-1 Step 3 자체의 도입이 아니라 선행 구현(WS spec §4.4 이후)에서 발생한 spec 드리프트. 구현은 WS spec 을 따르면 되므로 impl-prep 비차단. Step 3 chain 종료 후 planner 가 `1-ai-agent.md` §7 각주를 `{ toolCallId, name, providerKey, status: 'success' | 'error', durationMs, startedAt?, finishedAt?, error? }` 로 갱신하면 된다.

---

### [INFO] `spec/4-nodes/3-ai/1-ai-agent.md` §6.1.3.a — `classifyToolCalls` 구현 위치 포인터 stale
- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` line 370
- **충돌 대상**: 코드 현황 (`ai-condition-evaluator.ts:98` — M-1 1단계 PR #665)
- **상세**: line 370 에 `"구현: ai-agent.handler.ts classifyToolCalls"` 라고 명시되어 있으나, M-1 1단계에서 `classifyToolCalls` 는 `AiConditionEvaluator` 로 이동했다(`codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts:98`). `ai-agent.handler.ts` 에는 해당 메서드가 없다. 이는 M-1 1단계(PR #665)의 spec 동기화 미반영 사항으로, Step 3 의 책임 범위가 아니다.
- **제안**: planner 가 line 370 을 `"구현: AiConditionEvaluator.classifyToolCalls (ai-condition-evaluator.ts)"` 로 정정. impl-prep 비차단.

---

### [INFO] `spec/4-nodes/3-ai` frontmatter `code:` — M-1 추출 파일들 미등재
- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter (lines 4-13) · `spec/4-nodes/3-ai/0-common.md` frontmatter (lines 4-11)
- **충돌 대상**: 코드 현황 (`ai-condition-evaluator.ts`, `ai-memory-manager.ts` — M-1 1·2단계; `ai-turn-executor.ts` — M-1 3단계 신설)
- **상세**: `1-ai-agent.md` `code:` 목록에 `ai-agent.handler.ts` 는 있으나 M-1 분할로 신설된 `ai-condition-evaluator.ts`(Step 1), `ai-memory-manager.ts`(Step 2), `ai-turn-executor.ts`(Step 3) 가 없다. `0-common.md` `code:` 에도 `ai-agent.handler.ts` 가 있으나 Step 3 이후 이 파일의 실질 코드는 대부분 `ai-turn-executor.ts` 로 이동한다. 선행 단계(#665·#668)의 동기화 미완 사항이 Step 3 이후 더 심화된다.
- **제안**: Step 3 chain 종료 후 planner 가 `1-ai-agent.md` frontmatter `code:` 에 세 파일(`ai-condition-evaluator.ts`·`ai-memory-manager.ts`·`ai-turn-executor.ts`)을 추가하고 `ai-agent.handler.ts` 의 위상을 "thin delegator" 로 명시(§6 본문 내 각주 포인터 포함). impl-prep 비차단.

---

### [INFO] `AiTurnOrchestrator` / `AiTurnExecutor` 명명 — 계층 책임 구분이 spec 에 미반영
- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §6 (실행 로직 절 전반)
- **충돌 대상**: `spec/5-system/4-execution-engine.md` §1.3 (line 193: `AiTurnOrchestrator` 목록)
- **상세**: 엔진 spec §1.3 은 `AiTurnOrchestrator` 를 "AI 멀티턴 lifecycle" 담당 엔진-레이어 서비스로 등재. 노드 spec `1-ai-agent.md` §6 은 실행 로직을 서술하지만 `AiTurnOrchestrator`(엔진 레이어)와 `AiTurnExecutor`(노드 레이어)의 분리를 명시하지 않는다. Step 3 이후 `processMultiTurnMessage`·`endMultiTurnConversation`·`buildMultiTurnFinalOutput`·`executeSingleTurn`·`executeMultiTurn` 은 `AiTurnExecutor` 에 위치하고, `AiTurnOrchestrator` 는 다음 turn 구동(`handleAiMessageTurn`)·park emit(`emitAiWaitingForInput`) 등 엔진-레이어 생명주기를 담당하는 이중 계층 구조다. 두 클래스의 책임 경계가 `spec/4-nodes/3-ai/1-ai-agent.md` 에서 invisible — 계층 혼동 위험은 낮으나(엔진 spec 이 명시) 노드 spec 독자 관점에서 누락.
- **제안**: Step 3 chain 종료 후 planner 가 `1-ai-agent.md` §6 서두에 계층 구조 주석 추가("핸들러 레이어 `AiAgentHandler` → `AiTurnExecutor` 위임 / 엔진 레이어 `AiTurnOrchestrator` 가 multi-turn lifecycle 구동"). 기존 엔진 spec §1.3 과 모순 없음 — 보완.

---

## 요약

`spec/4-nodes/3-ai` 의 기존 문서는 현재 구현 준비 중인 M-1 3단계(`AiTurnExecutor` 추출)와 데이터 모델·API 계약·상태 전이·RBAC 차원에서 **직접 충돌하는 항목이 없다**. 발견된 항목은 모두 M-1 선행 단계(1단계 `AiConditionEvaluator`·2단계 `AiMemoryManager` 추출, PR #665·#668)의 spec 동기화 미반영에서 비롯된 코드 포인터·shape 기술 드리프트이며, Step 3 자체가 새로운 모순을 도입하지는 않는다. WARNING 1건은 `spec/4-nodes/3-ai/1-ai-agent.md` §7 각주의 `ToolCallTrace` shape 기술이 WS spec(`spec/5-system/6-websocket-protocol.md §4.4`)의 `startedAt?/finishedAt?` 영속 명세와 상충하나, 구현은 WS spec 권위를 따르면 되어 impl-prep 을 차단하지 않는다. 나머지 INFO 항목들은 frontmatter `code:` 미등재·포인터 stale 로 chain 종료 후 planner 일괄 갱신 대상이다.

## 위험도

LOW

---

STATUS: OK
