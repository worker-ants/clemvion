# 신규 식별자 충돌 검토 — spec/data-flow/7-llm-usage.md (--impl-done)

## 검토 방법 메모

target 은 `spec/data-flow/7-llm-usage.md` §1.3 / Rationale 의 기존 서술을 "현재 코드 상태"에 맞춰
갱신한 것이다 (`git diff origin/main...HEAD -- spec/data-flow/7-llm-usage.md` 확인 완료 — 순수
prose 갱신, 표/섹션 구조·앵커 변경 없음). 구현 diff(`ai-turn-executor.ts`,
`information-extractor.handler.ts` 등)에서 실제로 새로 도입된 코드 심볼을 모두 절대경로
워크트리 기준으로 추출해 기존 사용처와 대조했다.

- `git -C <worktree> grep -n "interface LlmCallContext"` → `codebase/backend/src/modules/llm/llm.service.ts:41` 에 **기존** 정의(변경 전부터 존재, `workflowId?/executionId?/nodeExecutionId?`). 이번 변경은 새 타입을 만들지 않고 이 기존 타입을 사용하지 않던 호출 사이트(`ai-turn-executor.ts` main/tool-loop chat, IE resume chat)에 **추가로 전달**하기 시작한 것.
- `llmContext` (지역 변수명, `ai-turn-executor.ts`) — 새 이름이지만 스코프가 함수 로컬이고 타입은 기존 `LlmCallContext` 그대로. 코드베이스 전역에서 동일 이름의 다른 의미 사용처 없음(grep 결과 전부 이번 diff 관련 파일).
- `MultiTurnState.workflowId` / `MultiTurnState.nodeExecutionId` (`information-extractor.handler.ts` 신규 optional 필드) — 같은 인터페이스에 이미 있던 `executionId?`/`nodeId?` 와 나란히 추가된 것으로, 명명 패턴(`nodeId`=정의 id vs `nodeExecutionId`=NodeExecution row PK)이 `ExecutionContext`/`LlmCallContext`/데이터 모델(`spec/1-data-model.md` NodeExecution)과 이미 통용되는 구분을 그대로 재사용한다. 충돌 없음.
- `buildRetryReentryState` — target 이 처음 언급하는 것처럼 보이지만 `git -C <worktree> grep` 확인 결과 `execution-engine/engine-driver.interface.ts:84` 등에 기존 함수이며 `spec/5-system/4-execution-engine.md` (§1.3 체크포인트, §Rationale "buildRetryReentryState 재구성기 공유" 등 다수)에 이미 문서화돼 있다. target 은 이 기존 함수를 §1.3 로 cross-ref 할 뿐 새로 정의하지 않는다.
- 파일 경로 언급 갱신: target 표가 `AI Agent` 노드의 코드 진입점을 구 `nodes/ai/ai-agent/ai-agent.handler.ts` → `ai-turn-executor.ts` 로 교정했다. `ai-turn-executor.ts` 는 신규 파일이 아니라 M-1 god-handler 분할(이미 `spec/4-nodes/3-ai/1-ai-agent.md:357`, `spec/data-flow/13-agent-memory.md:39` 등에서 `AiTurnExecutor` 로 기존 문서화된) 로 이미 존재하던 파일 — target 의 참조 갱신은 기존 정의와 정합하며 새 파일 경로 충돌이 아니다.

## 발견사항

없음. target 이 새로 도입하는 요구사항 ID, 엔티티/DTO/인터페이스명, API endpoint, 이벤트/메시지명,
환경변수·설정키, spec 파일 경로가 존재하지 않는다 — 모두 기존에 이미 정의·문서화된 식별자
(`LlmCallContext`, `llm_usage_log.workflow_id/execution_id/node_execution_id`, `buildRetryReentryState`,
`ExecutionContext`, `ai-turn-executor.ts`/`AiTurnExecutor`)를 그대로 참조하거나, 기존 인터페이스에
기존 명명 패턴을 따르는 optional 필드를 추가한 것뿐이다.

## 요약

target(`spec/data-flow/7-llm-usage.md`)은 이미 존재하던 §1.3 "Caller 카탈로그"와 Rationale 절의
서술을 "resume 턴 attribution 미구현" → "완료"로 갱신하는 순수 prose 패치이며, 새 요구사항 ID·
엔티티·DTO·endpoint·이벤트·ENV·설정키·spec 파일을 하나도 신설하지 않는다. 구현 diff 에서 등장하는
`llmContext` 지역 변수, `MultiTurnState.workflowId/nodeExecutionId` 신규 필드도 이미 정의된
`LlmCallContext`/`ExecutionContext`/`NodeExecution` 명명 규약을 그대로 계승하며, 코드베이스 전역
grep 상 이름이 다른 의미로 이미 쓰이는 사례는 발견되지 않았다. `ai-turn-executor.ts` 로의 코드
진입점 참조 교정도 이미 다른 spec 문서에서 통용되던 파일명·클래스명(`AiTurnExecutor`)과 일치한다.

## 위험도
NONE
