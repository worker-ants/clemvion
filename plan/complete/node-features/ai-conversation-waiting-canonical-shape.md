# AI 대화 노드 `waiting_for_input` 반환 shape 의 정식화

## 배경

production 에서 AI 에이전트(multi-turn) 실행 시 `Node handler return violates the NodeHandlerOutput contract. Expected { config, output, ... }; got {"type":"ai_conversation",...}` 오류가 발생했다. `ai_agent` / `information_extractor` 의 `waiting_for_input` 반환부가 `output` 필드 없는 bare 객체를 반환하여 `adaptHandlerReturn` 의 production strict 검증(`backend/src/modules/execution-engine/handler-output.adapter.ts`)을 위반한 것이 원인.

## 변경 요약

핸들러는 CONVENTIONS §4.3 의 정식 `NodeHandlerOutput` shape `{ config, output, meta, status, _resumeState }` 으로 마이그레이션했고, engine 의 emit / persist 경로도 이 shape 를 source-of-truth 로 삼도록 정합화했다.

## 변경된 파일

### Backend

- `backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`
  - `executeMultiTurn` 초기 진입(line 513-) / `processMultiTurnMessage` 진행 중(line 782-) 두 waiting 반환을 정식 shape 으로 변경.
  - `output: { messages, message, turnCount, maxTurns }`, `meta: { interactionType: 'ai_conversation' }` 부여.
  - 반환 변수에 `ResumableNodeHandlerOutput` 타입 명시.
- `backend/src/nodes/ai/information-extractor/information-extractor.handler.ts`
  - `buildWaitingResponse` 반환을 정식 shape 으로 변경.
  - `output: { messages, message, turnCount, maxTurns, partial: { extracted, missingFields, collectionRetryCount } }`.
- `backend/src/modules/execution-engine/execution-engine.service.ts`
  - 새 헬퍼 `buildConversationConfigFromOutput(output, legacy?)` 추가 (top-of-file).
  - `waitForAiConversation` 초기 emit (1487-1546) 을 `structuredOutputCache` 기반으로 재작성. legacy `nodeOutput.conversationConfig` 는 in-flight fallback 으로만 사용.
  - 진행 중 waiting emit 분기 (1605-1673) 에서 `adaptHandlerReturn(result)` 을 분기 시작 시 1회 호출하여 strict 통과 + structured/flat cache 즉시 갱신.
  - persist 경로(1479, 1880-1894) 도 structured cache 를 우선 사용.

### Frontend

- `frontend/src/components/editor/run-results/output-shape.ts`
  - `isConversationOutput` 에 (a) `meta.interactionType === 'ai_conversation'` 와 (b) `status === 'waiting_for_input' && output.messages` 분기 추가.

### Tests

- `backend/src/nodes/ai/ai-agent/ai-agent.handler.spec.ts` — waiting assertions 를 새 shape 으로 변경 + production strict 시뮬레이션 케이스 추가.
- `backend/src/nodes/ai/information-extractor/information-extractor.handler.spec.ts` — 동일.
- `backend/src/modules/execution-engine/handler-output.adapter.spec.ts` — 새 conversation waiting fixture 가 production strict 통과하는지 검증.
- `frontend/src/components/editor/run-results/__tests__/output-shape.test.ts` — 새 persisted waiting shape fixture, status-only fallback fixture 추가.

## 검증 결과 (2026-05-03)

- `backend npm run build` — 성공
- `backend jest` — 150 test suites / 2388 tests **all pass**
- `frontend vitest run` — 98 test files / 1078 tests **all pass**
- `frontend tsc --noEmit` — 에러 없음

## 후속 cleanup (별도 PR)

- legacy `_multiTurnState` alias 제거 (execution-engine.service.ts:1462, 1608, 1813).
- `processMultiTurnMessage` maxTurns legacy `_turnDebug` 분기 (execution-engine.service.ts:1843-1875) 제거 — 신규 shape 에서 도달 불가.
- `buildConversationConfigFromOutput` 의 `legacy` fallback 파라미터 제거 (in-flight legacy 행 모두 종료된 후).

## 참조 plan

`/Users/gehrig/.claude/plans/ai-shiny-bee.md`
