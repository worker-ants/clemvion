# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done`
대상 영역: `spec/4-nodes/3-ai`
구현 컨텍스트: M-1 3단계 — `AiTurnExecutor` 추출 (`ai-agent.handler.ts` god-handler 분할 완료)

---

## 발견사항

### [WARNING] `meta.turnDebug[].toolCalls` shape — `1-ai-agent.md §7` 각주가 WS spec 과 불일치 (선행 단계 드리프트, 미해소)

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` line 530 (§7 각주)
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md` §4.4 (`startedAt`/`finishedAt` 영속 명세)
- **상세**: `1-ai-agent.md` line 530 은 `meta.turnDebug[].toolCalls` 항목 shape 을 `{ toolCallId, name, providerKey, status: 'success' | 'error', durationMs, error? }` 로 기술하며 `startedAt?`·`finishedAt?` 를 포함하지 않는다. WS spec §4.4 는 이 두 필드가 `meta.turnDebug[].toolCalls[]` 에도 영속된다고 명시한다. 구현 `ai-turn-executor.ts` 의 `ToolCallTrace` 인터페이스(lines 59–70)는 WS spec 을 따라 `startedAt?`·`finishedAt?` 를 포함한 shape 을 정의한다. 즉 **구현은 WS spec 과 일치하나, 노드 spec `1-ai-agent.md §7` 각주는 stale 상태**다. 이 드리프트는 impl-prep 리뷰(23_03_12)에서도 지적됐으나 Step 3 구현 완료 후에도 해소되지 않았다.
- **제안**: planner 가 `1-ai-agent.md` line 530 을 `{ toolCallId, name, providerKey, status: 'success' | 'error', durationMs, startedAt?, finishedAt?, error? }` 로 갱신. 구현은 이미 정합이므로 spec 문서만 교정. 비차단이나 조기 정정 권장.

---

### [WARNING] `classifyToolCalls` 구현 포인터 — `1-ai-agent.md §6.1 3a` 가 여전히 `ai-agent.handler.ts` 를 가리킴

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` line 370 (§6.1 step 3a 괄호 주석)
- **충돌 대상**: 실제 구현 위치 (`ai-turn-executor.ts` 내 `AiTurnExecutor`의 내부 분류 로직 — M-1 3단계 완료)
- **상세**: line 370 의 `"(구현: ai-agent.handler.ts classifyToolCalls)"` 는 M-1 1단계(PR #665)에서 로직이 `AiConditionEvaluator` 로 이동한 후 stale 됐고, M-1 3단계에서 tool 분류 루프 전체가 `AiTurnExecutor.executeSingleTurn` / `executeMultiTurn` 안으로 이동하면서 `ai-agent.handler.ts` 에는 해당 메서드가 없다. `processMultiTurnMessage` polymorphic 시그니처와 `buildMultiTurnFinalOutput` · `endMultiTurnConversation` 만 핸들러에 잔류하며, tool 분류는 executor 가 담당한다. spec 포인터가 존재하지 않는 위치를 가리키므로 독자에게 혼동을 준다.
- **제안**: planner 가 line 370 의 괄호 주석을 `"(구현: AiTurnExecutor — executeSingleTurn / executeMultiTurn 내부, ai-turn-executor.ts)"` 로 교정. 비차단이나 조기 정정 권장.

---

### [INFO] `1-ai-agent.md` frontmatter `code:` — `ai-turn-executor.ts` 미등재

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter (lines 4–13)
- **충돌 대상**: 구현 현황 (`ai-turn-executor.ts` — M-1 3단계 신설 2,911 줄)
- **상세**: frontmatter `code:` 목록에 `ai-agent.handler.ts` · `ai-agent.schema.ts` · `ai-agent.component.ts` · `tool-providers/*.ts` · `agent-memory-injection.ts` · `agent-memory-schema.ts` · `execution-engine.service.ts` · `ai-turn-orchestrator.service.ts` · `llm-call-record.ts` 가 등재되어 있으나, M-1 3단계 신설 파일 `ai-turn-executor.ts` 가 없다. 선행 단계(#665·#668)의 `ai-condition-evaluator.ts`·`ai-memory-manager.ts` 도 미등재 상태이며 이 또한 plan/in-progress/refactor/02-architecture.md 에서 "M-1 전체 완료 시 일괄 처리 권장" 으로 후속 예정.
- **제안**: Step 3 chain 완료(본 PR) 후 planner 가 `1-ai-agent.md` frontmatter `code:` 에 `ai-condition-evaluator.ts`·`ai-memory-manager.ts`·`ai-turn-executor.ts` 세 파일을 일괄 추가. 비차단.

---

### [INFO] `execution-engine.md §1.3` — `AiTurnExecutor` 계층 미언급 (보완 필요)

- **target 위치**: `spec/5-system/4-execution-engine.md` §1.3 (line 1461: `AiTurnOrchestrator` 목록)
- **충돌 대상**: M-1 3단계 신설 `AiTurnExecutor` 클래스
- **상세**: 엔진 spec §1.3 은 `AiTurnOrchestrator` 를 "AI 멀티턴 lifecycle" 담당 엔진-레이어 서비스로 등재하고 있다. M-1 3단계에서 `AiTurnExecutor` (노드-레이어, `ai-agent.handler.ts` 내부 위임 대상) 가 신설됐으나 엔진 spec 에 언급이 없다. 두 클래스는 계층이 다르므로 **직접 모순은 아니다** — `AiTurnOrchestrator` (엔진 레이어: multi-turn lifecycle 구동·park emit)와 `AiTurnExecutor` (노드 레이어: single/multi turn 실행·tool loop·output assembly)의 책임 경계가 spec 독자에게 불투명할 수 있다. `1-ai-agent.md §6` 본문도 이 이중 계층을 명시하지 않는다.
- **제안**: Step 3 chain 완료 후 planner 가 `1-ai-agent.md §6` 서두에 계층 주석 추가("핸들러 레이어 `AiAgentHandler` → `AiTurnExecutor` 위임 / 엔진 레이어 `AiTurnOrchestrator` 가 multi-turn lifecycle 구동"). 기존 엔진 spec §1.3 과 모순 없음 — 보완. 비차단.

---

## 요약

M-1 3단계(`AiTurnExecutor` 추출) 구현 완료 후 `spec/4-nodes/3-ai` 와 관련 spec 영역을 점검한 결과, **데이터 모델·API 계약·상태 전이·RBAC 차원에서 새롭게 도입된 직접 모순은 없다**. 발견된 두 WARNING 은 모두 선행 단계(M-1 1·2단계, PR #665·#668)에서 발생한 spec 드리프트가 이번 PR 완료 후에도 해소되지 않고 누적된 것이다: (1) `1-ai-agent.md §7` 각주의 `ToolCallTrace` shape 에 `startedAt?`/`finishedAt?` 미반영(WS spec 과 상충, 구현은 이미 WS spec 따름), (2) `§6.1 3a` 의 `classifyToolCalls` 구현 포인터가 존재하지 않는 위치(`ai-agent.handler.ts`)를 가리킴. 두 INFO 항목은 frontmatter `code:` 미등재 및 계층 구조 누락 기술이다. 구현 자체는 spec 과 충돌하지 않으며 WS spec 을 권위 출처로 올바르게 따른다. 두 WARNING 은 planner 에 의해 spec 문서 갱신으로 해소 가능하다(비차단).

## 위험도

LOW

---

STATUS: OK
