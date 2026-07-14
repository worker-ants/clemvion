# Plan 정합성 검토 — ai-agent-tool-payload-budget-guardrail.md

## 발견사항

- **[WARNING]** single-turn 경로의 `§7.3/§7.9 error 포트` 라우팅 전제가 미해소된 선행 CRITICAL 항목과 충돌
  - target 위치: `plan/in-progress/ai-agent-tool-payload-budget-guardrail.md` — 확정 정책 "런타임 (안전망)" 절, D1 "런타임 판정 위치" 문단("`AiTurnExecutor.buildTools` 직후 (single-turn·multi-turn resume 공통) ... 초과 시 **LLM 호출 전에** `TOOL_DEFINITION_PAYLOAD_EXCEEDED` throw → §7.3/§7.9 `error` 포트"), Phase 2 항목 2("런타임 fail-fast (buildTools 공통 헬퍼) + ... 분류(`AiTurnOrchestrator.classifyLlmError` passthrough 정합)")
  - 관련 plan: `plan/in-progress/node-output-redesign/ai-agent.md` §"종합 개선안" — `[ ] (impl) **CRITICAL (single-turn 잔여)** executeSingleTurn 의 llmService.chat 호출을 try/catch 로 감싸 output.error.{code,...} + port:'error' ... 환경 반환` (미해결, `[ ]`). 동일 문서 6차 갱신 블록: "**잔여**: single-turn(`executeSingleTurn`) 의 `llmService.chat`(...)은 여전히 try/catch 미적용 → spec §7.3 `error` 포트 라우팅 미발생(single throw → engine FAILED)."
  - 상세: 코드 확인 결과(`codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:1397-1534` `executeSingleTurn`, `ai-agent.handler.ts:130` 가 무try/catch 로 직접 await) single-turn 경로에는 `buildTools`/`llmService.chat` throw 를 `output.error`+`port:'error'` 로 변환하는 메커니즘이 **전혀 없다** — uncaught throw 는 그대로 engine-level `FAILED` 로 전파된다. 반면 multi-turn(resume)은 엔진 `AiTurnOrchestrator`(`handleAiTurnError`→`classifyLlmError`, `ai-turn-orchestrator.service.ts:1084-1118`)가 이미 explicit-code passthrough(`retryable:false`)를 지원해 target 의 신규 코드를 그대로 흡수할 수 있음을 코드로 확인했다(정합, 문제 없음). 그러나 target 의 D1/§4.2 문구는 "single-turn·multi-turn resume 공통" 이라고 명시하면서 **동일한 `§7.3` 에러 포트 결과를 single-turn 에도 약속**하는데, 그 전제(§7.3 라우팅 인프라)가 `node-output-redesign/ai-agent.md` 에 아직 미해결 CRITICAL 로 열려 있다. target 의 Phase 2 항목 2 는 `AiTurnOrchestrator.classifyLlmError`(멀티턴 인프라)만 언급하고 single-turn 쪽 try/catch 신설을 명시하지 않는다 — 이 상태로 구현하면 single-turn 에서 payload 초과 시 "즉각·명확한 실패"(D1 목표) 는 달성되나(예외가 즉시 throw 됨) "명확한 실패"(`output.error.details` 구조화 + `error` 포트)는 달성되지 못하고 대신 원인불명 engine `FAILED` 로 떨어져, 정확히 이번 사고 조사가 겪었던 "정체불명 실패" 패턴을 새 코드에서도 재현할 위험이 있다.
  - 제안: target Phase 2 항목 2 에 "single-turn 경로는 `node-output-redesign/ai-agent.md` 의 CRITICAL 항목(§7.3 error 포트 미구현)에 의존 — 본 PR 범위에서 `TOOL_DEFINITION_PAYLOAD_EXCEEDED` 전용 로컬 try/catch(또는 조건 분기)를 `executeSingleTurn` 에 신설해 `output.error`+`port:'error'` 로 직접 반환" 을 명시하거나, 두 plan 을 명시적으로 링크(target → node-output-redesign 선행 의존 명기, 또는 반대로 node-output-redesign 의 general fix 를 target PR 에 흡수). 어느 쪽이든 "single-turn 도 §7.3 error 포트로 라우팅된다"는 target 의 현재 서술이 실제로 참이 되도록 구현 계획을 보강해야 한다.

- **[INFO]** target 문서 내부에 개명 전 에러코드명 잔존 (C3 결정과 자기모순 소지)
  - target 위치: D1 초안 "예산" 표 (`plan/in-progress/ai-agent-tool-payload-budget-guardrail.md` 의 "> | `AI_AGENT_TOOL_PAYLOAD_HARD_BYTES` (hard) | ... | 초과 시 런타임 fail-fast (§10 `AI_TOOL_BUDGET_EXCEEDED`) |" 행)
  - 관련 plan: 없음(target 자체 정합성) — 단 target 상단 "확정 정책" 문단의 C3("`AI_TOOL_BUDGET_EXCEEDED` → `TOOL_DEFINITION_PAYLOAD_EXCEEDED` 로 개명")과 D2/D3/D4/Rationale 은 전부 새 이름을 쓰는데 D1 표만 옛 이름을 남겨 문서 내부 불일치.
  - 상세: C3 결정의 취지 자체가 "호출 횟수 축과 정의 payload 축의 이름 혼동을 없앤다"였는데, spec 본문에 그대로 옮겨 적을 draft(D1)에 옛 이름이 잔존한 채로 project-planner 가 그대로 반영하면 정확히 그 혼동을 재생산한다.
  - 제안: D1 표의 `AI_TOOL_BUDGET_EXCEEDED` → `TOOL_DEFINITION_PAYLOAD_EXCEEDED` 로 target 문서 자체를 정정(plan-coherence 범위 밖의 사소한 수정이지만 spec 반영 전에 반드시 잡아야 함).

- **[INFO]** config 측 payload 추정기의 향후 도구 소스 확장 누락 가능성 (후속 항목, 낮은 긴급도)
  - target 위치: 확정 정책 "노드 설정 변경 API" 절 — `evaluateAiAgentToolPayloadWarnings(nodes, workspaceId)` 가 "ai_agent 노드의 `mcpServers`·`presentationTools` 로부터 payload 추정"
  - 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §"작업 단위 1" (미착수, worktree `(unstarted)`, 모든 결정 TBD) — 결정되면 `toolNodeIds`/일반 `tool_*` 도구가 `buildTools()` 결과에 새 소스로 추가된다.
  - 상세: 런타임 estimator(`estimateAgentToolPayload(tools)`)는 `buildTools()` 최종 결과 위에서 동작하므로 향후 `tool_*` 소스가 추가돼도 자동으로 포함돼 안전망은 유지된다. 반면 저장 시점 config 추정 함수는 소스를 `mcpServers`/`presentationTools` 로 하드코딩 나열하므로, tool-connection-rewrite 가 착수·확정되는 시점에 이 함수도 신규 소스를 반영하도록 갱신해야 하는데 두 plan 어디에도 이 상호의존이 기록돼 있지 않다. 다만 tool-connection-rewrite 는 아직 전면 TBD(착수 전) 상태라 즉시 조치는 불필요.
  - 제안: target 의 "백로그(비포함)" 또는 Rationale 에 "저장 시점 추정기는 현재 `mcpServers`/`presentationTools` 소스만 열거 — 신규 도구 소스(예: `ai-agent-tool-connection-rewrite.md` 확정 시 `toolNodeIds`) 추가 시 `evaluateAiAgentToolPayloadWarnings` 도 동기 갱신 필요" 한 줄만 남겨 향후 두 plan 이 충돌 없이 이어지도록 추적.

## 요약

핵심 리스크는 target 이 "런타임 판정 위치는 single-turn·multi-turn resume 공통이며 두 경로 모두 `§7.3/§7.9 error` 포트로 귀결된다"고 서술하지만, single-turn 쪽의 그 라우팅 인프라 자체가 `node-output-redesign/ai-agent.md` 에 CRITICAL 미해결로 남아 있다는 점이다(코드 확인: `executeSingleTurn` 은 `buildTools`/`llmService.chat` 을 try/catch 없이 직접 호출하며 handler 도 감싸지 않는다). multi-turn(resume) 쪽은 `AiTurnOrchestrator.classifyLlmError` 의 explicit-code passthrough 덕에 target 설계와 코드가 이미 정합한다는 것도 확인했다. 나머지 두 건(개명 전 에러코드명 잔존, config 추정기의 향후 도구 소스 확장 의존)은 경미한 추적 메모 수준이다. cross-node-warning-rules.md 재사용·mcp-client.md §5.8 신설·estimator SoT 등 target 의 다른 결정들은 현재 `plan/in-progress/**` 의 미해결 결정과 충돌하지 않았고, spec 섹션 번호(§4/§10/§12, §5.7 뒤 §5.8)도 실제 spec 구조와 정합했다.

## 위험도

MEDIUM
