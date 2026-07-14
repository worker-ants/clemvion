# API 계약(API Contract) 리뷰

대상: `ai-turn-executor.ts` / `tool-payload-budget.ts` (+ 각 `.spec.ts`), `plan/in-progress/ai-agent-tool-payload-budget-{guardrail,followups}.md`, `spec/4-nodes/3-ai/1-ai-agent.md` · `spec/5-system/11-mcp-client.md` · `spec/conventions/cross-node-warning-rules.md`

본 변경은 REST 엔드포인트를 직접 추가/수정하지 않는다. 핵심은 **AI Agent 노드의 `output.error` 계약**(`spec/conventions/node-output.md` §3.2.1/§3.2.2, §7.3)에 새 에러 코드 `TOOL_DEFINITION_PAYLOAD_EXCEEDED` 를 추가하고, `buildTools` 직후 도구 정의 payload 예산을 pre-flight 로 강제하는 것이다. 이 "노드 출력 계약" 은 본 프로젝트에서 downstream 노드·frontend·orchestrator 가 소비하는 사실상의 내부 API 이므로 API 계약 관점에서 분석했다. `saveCanvas`/`getGraphWarnings` 관련 실제 REST 변경(§4.2 저장 시점 경고)은 이번 diff 에 **코드로 구현되지 않고** spec/plan 문서에서만 "구현 예정(Planned)" 으로 명시돼 있어 범위 밖이다 (`plan/in-progress/ai-agent-tool-payload-budget-followups.md`, `spec/conventions/cross-node-warning-rules.md` §8 해당 행).

## 발견사항

- **[INFO]** single-turn·multi-turn 간 신규 에러 코드의 라우팅 메커니즘이 서로 다름 (return vs throw)
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:228-256` (`executeSingleTurn` 내 로컬 try/catch → `NodeHandlerOutput` **return**) vs `buildTools` 호출부(라인 293-298, multi-turn `processMultiTurnMessage` 경로) — 여기선 `ToolDefinitionPayloadExceededError` 가 **throw** 되어 상위 orchestrator 의 `handleAiMessageTurn` try/catch → `extractAiTurnErrorPayload` 가 code/details 를 passthrough 한다는 전제에 의존
  - 상세: 두 경로 모두 최종적으로 `output.error.code = TOOL_DEFINITION_PAYLOAD_EXCEEDED`, 동일 `details` shape 로 수렴하도록 테스트(`ai-turn-executor.spec.ts` 신규 3개 케이스)로 고정돼 있어 **계약 자체는 대칭**이지만, 이를 만드는 **메커니즘**(return vs throw+상위 catch)은 비대칭이다. 이 비대칭은 이번 PR 이 새로 만든 것이 아니라 기존 아키텍처(멀티턴은 원래 throw 전파, single-turn 은 원래 아예 catch 없음)를 이번 에러코드에 한해서만 대칭화한 것 — 다른 error code 를 single-turn/multi-turn 양쪽에 추가할 때 이 패턴을 놓치면 한쪽만 `error` 포트로 안 떨어지는 회귀가 재발할 수 있다. `plan/in-progress/ai-agent-tool-payload-budget-followups.md` 에도 `node-output-redesign/ai-agent.md` 의 "single-turn error 라우팅 미해결 CRITICAL" 과 선행 의존 관계로 명시돼 있어 인지된 gap 이다.
  - 제안: 이번 PR 범위 내 조치는 불필요(이미 양쪽 다 커버). 다만 후속에서 single-turn 전체를 감싸는 공통 에러 경계(handler-level catch)로 통합해 "새 에러코드마다 개별 try/catch 추가" 패턴을 없애는 것을 권장(이미 후속 plan 에 문제의식 존재).

- **[INFO]** 예산 env override 가 `0` 을 명시적 설정값으로 받아들이지 않음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-payload-budget.ts:585-587` (`readByteBudget`: `Number(process.env[envName]) || fallback`)
  - 상세: `mcp-tool-provider.ts` 의 `MAX_RESPONSE_BYTES` 선례와 동형이라 일관성은 있으나, `||` 사용으로 인해 운영자가 `AI_AGENT_TOOL_PAYLOAD_HARD_BYTES=0`(모든 요청 강제 실패, 예컨대 긴급 킬스위치 용도) 을 설정해도 조용히 기본값(262144)으로 되돌아간다. 요청 파라미터/설정 유효성 검증 관점에서 "0 은 무시된다"는 사실이 문서화돼 있지 않다.
  - 제안: 정말 필요하면 `Number.isFinite(n) && n > 0 ? n : fallback` 형태로 명시적으로 "0/음수/NaN 은 fallback" 규칙을 문서화하거나, 그대로 두려면 스펙/코드 주석에 "0 은 지원하지 않음"을 한 줄 남겨 향후 운영자 혼란을 예방.

- **[INFO]** 신규 에러 코드는 순수 additive — 하위 호환성 문제 없음 (확인됨, 발견사항 아님 참고용)
  - 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §10 에러 코드 표 신규 행, frontend 소비부 확인
  - 상세: frontend 에서 AI Agent 에러 코드를 소비하는 부분(`use-execution-events`, `conversation-utils` 등)은 코드값을 exhaustive switch 로 강제하지 않고 message/generic 렌더링 위주라, 새 코드 추가가 기존 클라이언트를 깨뜨리지 않는다. 다만 사용자 대상 문서(`content/docs/05-run-and-debug/run-results*.mdx` 등)에 기존 에러 코드들이 나열돼 있어, 신규 코드도 필요 시 해당 문서에 추가하는 편이 문서 완결성 측면에서 좋다(코드 계약과는 무관, docs 완결성 참고사항).

- **[INFO]** 선행 consistency-check(BLOCK) 에서 지적된 API 계약 위반 3건은 본 diff 시점에 모두 정정 반영됨 (확인됨)
  - 위치: `plan/in-progress/ai-agent-tool-payload-budget-guardrail.md` "2026-07-14 revised" 절, `spec/4-nodes/3-ai/1-ai-agent.md` §10 note, `spec/conventions/cross-node-warning-rules.md` §5·§8
  - 상세: (a) 저장 지점을 존재하지 않는 `PATCH /workflows/:id` 대신 실제 `POST /workflows/:id/save`(`saveCanvas`) + 조회용 `GET /workflows/:id/graph-warnings` 로 정정, (b) 별도 `warnings[]` 필드 신설 대신 기존 `GraphWarningRuleResult`/`GRAPH_VALIDATION_FAILED` 재사용으로 계약 중복 회피, (c) 에러 코드가 기존 `MAX_TOOL_CALLS_EXCEEDED`/`tool_call_budget_exceeded`(도구 **호출 횟수** 축)와 헷갈리던 `AI_TOOL_BUDGET_EXCEEDED` 대신 `TOOL_DEFINITION_PAYLOAD_EXCEEDED` 로 명명 충돌 해소, (d) `output.error.details.retryable`(§3.2.1 LLM 계열 필수 필드) 이 실제 구현·테스트 모두에 포함(`retryable: false`, `ai-turn-executor.spec.ts:97`, `tool-payload-budget.spec.ts:485`). 재확인 목적으로 기록.

## 요약

이번 변경은 신규 REST 엔드포인트나 기존 엔드포인트의 요청/응답 스키마를 건드리지 않고, AI Agent 노드의 `output.error` 내부 계약에 새 에러 코드(`TOOL_DEFINITION_PAYLOAD_EXCEEDED`)를 순수 additive 하게 추가한다. `details.retryable`(필수 필드) 포함, 구조화된 `details`(totalBytes/budgetBytes/toolCount/culpritProvider), 정상 종결(`out`)과 동일한 `config` echo shape 공유 등 `node-output.md` 컨벤션을 충실히 준수하며, 선행 consistency-check 가 BLOCK 했던 API 스코프 오류(`PATCH :id` 존재하지 않는 필드)·계약 중복 신설·에러코드 명명 충돌은 이번 diff 시점에 모두 정정돼 있음을 확인했다. 실제 구현 범위는 런타임 pre-flight 가드에 한정되고, "저장 시점 경고"(graph warning) 는 코드가 아닌 spec 상 "구현 예정" 으로만 명시돼 과잉 주장이 없다. 유일하게 눈여겨볼 점은 single-turn(return)과 multi-turn(throw+상위 catch)의 에러 라우팅 메커니즘 비대칭인데, 이번 에러 코드에 한해서는 양쪽 다 테스트로 고정되어 실질적 계약 위반은 아니며 향후 신규 에러코드 확장 시 재발 방지용 인지 포인트로만 남긴다.

## 위험도
LOW
