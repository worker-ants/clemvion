# 신규 식별자 충돌 검토 — AI Agent 도구 정의 payload 예산 가드레일 (impl-done)

대상: `spec/4-nodes/3-ai/` (실질 변경분은 `git diff origin/main` 기준 `spec/4-nodes/3-ai/1-ai-agent.md` §4.2·§10·§12.15, `spec/5-system/11-mcp-client.md` §5.8, `spec/conventions/cross-node-warning-rules.md` §5·§8, `codebase/backend/.env.example`, `codebase/backend/src/nodes/ai/ai-agent/tool-payload-budget.ts` 신규 파일).

## 검토 방법

HEAD 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/ai-agent-message-issue-89863c`)를 SoT 로 `git diff origin/main`으로 실제 신규분을 먼저 특정한 뒤, 그 신규 식별자 전부를 `spec/`·`plan/`·`codebase/` 전체에서 grep 대조했다. 본 feature 는 동일 세션 내에서 이미 2회(`review/consistency/2026/07/14/08_49_37`, `09_04_19`) naming-collision 검토를 거쳤고 그 결과(예: `AI_AGENT_TOOL_PAYLOAD_MAX_BYTES`→`_SOFT_BYTES`, `AI_TOOL_BUDGET_EXCEEDED`→`TOOL_DEFINITION_PAYLOAD_EXCEEDED` 개명)가 현재 최종본에 반영돼 있음을 확인했다. 이번 라운드는 그 최종본(구현 완료 후) 기준 재검증이다.

- 에러코드: `TOOL_DEFINITION_PAYLOAD_EXCEEDED`
- ENV var: `AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES` / `AI_AGENT_TOOL_PAYLOAD_HARD_BYTES` / `AI_AGENT_TOOL_COUNT_MAX` / `AI_AGENT_TOOL_BUDGET_STRICT_SAVE`
- 함수/클래스: `estimateAgentToolPayload`, `enforceToolPayloadBudget`, `ToolDefinitionPayloadExceededError`, `readEnvNumber`(module-private)
- rule id: `ai_agent:tool-payload-budget`
- spec 절 번호: `1-ai-agent.md` §4.2·§12.15, `11-mcp-client.md` §5.8
- 신규 파일: `codebase/backend/src/nodes/ai/ai-agent/tool-payload-budget.ts` (+ `.spec.ts`)

## 발견사항

없음 — 이번 diff 가 도입하는 식별자 중 CRITICAL/WARNING 급 충돌은 발견되지 않았다.

## 확인 완료 (충돌 없음 — 근거만 기록)

- **에러코드** `TOOL_DEFINITION_PAYLOAD_EXCEEDED`: `spec/4-nodes/3-ai/1-ai-agent.md:1126`(§10 표 신규 행)·`codebase/backend/src/nodes/ai/ai-agent/tool-payload-budget.ts:153`(`ToolDefinitionPayloadExceededError.code`)·`ai-turn-executor.ts:1500` 세 곳 문자열 완전 일치. 동일 노드의 기존 "호출 횟수" 축 에러(`MAX_TOOL_CALLS_EXCEEDED`, `tool_call_budget_exceeded` — `ai-turn-executor.ts:567`)와 문자열·의미 모두 구분되어 축 혼동 없음.
- **ENV var 4종**: `codebase/backend/.env.example:329-336`에 `AI_AGENT_` prefix 신규 네임스페이스로 최초 등재, 기존 `MCP_MAX_RESPONSE_BYTES`(도구 **호출 결과** payload cap, 다른 축)와 의미·이름 모두 충돌 없음. `AI_AGENT_TOOL_BUDGET_STRICT_SAVE`만 `.env.example`에 아직 없으나(§4.2 후속 plan 스코프) 이는 **미등재 상태이지 충돌이 아니다** — 다른 기존 env 와 이름이 겹치지 않는다.
- **함수/클래스명**: `estimateAgentToolPayload`(`tool-payload-budget.ts:99`), `enforceToolPayloadBudget`, `ToolDefinitionPayloadExceededError` — 모두 backend 전체에서 이 파일에만 정의된 최초 선언이며 동명 심볼 없음(grep 전수 확인).
- **rule id** `ai_agent:tool-payload-budget`: `cross-node-warning-rules.md` §8 레지스트리에 정확히 1행만 존재. 기존 mini-DSL rule(`ai_agent:no-llm-provider`, `ai_agent:too-many-conditions` — `ai-agent.schema.ts`)과는 접두사(`ai_agent:`)만 공유하고 suffix 가 달라 리터럴 충돌 없음 — 동일 접두사를 mini-DSL·cross-node rule 이 함께 쓰는 것은 `parallel:` 에도 있는 기존 패턴(`09_04_19` 라운드 확인사항 재검증, 변동 없음). 이전 라운드가 WARNING 으로 지적한 "shared-package 미소속이라 P3-C-1 i18n 가드 사각지대" 구조적 이슈는 이번 최종본에서 `cross-node-warning-rules.md` §5 에 "예외 — backend-only async rule" 명문 조항이 추가돼 문서화됐고(`codebase/frontend/.../backend-labels.test.ts` 수동 등록은 `plan/in-progress/ai-agent-tool-payload-budget-followups.md`로 명시 이월) — **naming collision 은 아니며** 이월 처리가 spec/plan 양쪽에 일관되게 반영되어 있다.
- **spec 절 번호**: `1-ai-agent.md`는 §4 아래 §4.1까지, §12 아래 §12.14까지만 있었으므로 신규 §4.2/§12.15가 자연스러운 다음 번호. `11-mcp-client.md`는 §5.7까지 있었으므로 신규 §5.8 역시 충돌 없음.
- **API endpoint**: 본문이 인용하는 `GET /workflows/:id/graph-warnings`(`getGraphWarnings`, `workflows.controller.ts:118`)와 `POST /workflows/:id/save`(`saveCanvas`)는 모두 기존 구현을 참조만 할 뿐 신규 endpoint 를 만들지 않는다(§4.2 텍스트에도 "별도 응답 필드 신설 없음" 명시).
- **파일 경로**: `codebase/backend/src/nodes/ai/ai-agent/tool-payload-budget.ts`/`.spec.ts` — 같은 디렉토리의 기존 파일(`ai-agent.handler.ts`, `ai-condition-evaluator.ts`, `ai-memory-manager.ts`, `ai-turn-executor.ts` 등)과 겹치지 않는 kebab-case 신규 이름이며, 명명 컨벤션(모듈명-역할.ts)도 동일하게 따른다.
- **CHANGELOG 섹션 제목**: `## Unreleased — AI Agent 도구 정의 payload 예산 가드레일 (...)` — 같은 파일에 병존하는 다른 PR 의 `## Unreleased — 워크플로 편집기 엣지 분할(...)` 섹션과 제목이 명확히 구분되어 충돌 없음(같은 "Unreleased" 헤더를 여러 PR 이 각자 부제로 병기하는 기존 관례 그대로).
- **요구사항 ID**: 이번 diff 는 `ND-AG-*` 신규 ID 를 도입하지 않는다(참조만, 변경 없음) — 충돌 대상 자체가 없음.

## 요약

`spec/4-nodes/3-ai/1-ai-agent.md` §4.2/§10/§12.15, `spec/5-system/11-mcp-client.md` §5.8, `spec/conventions/cross-node-warning-rules.md` §5/§8, `.env.example`, 신규 `tool-payload-budget.ts` 가 도입하는 에러코드·ENV var·함수/클래스명·rule id·spec 절 번호·파일 경로를 전수 대조한 결과 리터럴 충돌은 없다. 이 feature 는 동일 세션 내 이전 두 라운드(08:49, 09:04)의 naming-collision 지적(ENV var 명명 모호성, 에러코드 축 혼동, 백로그 i18n 가드 사각지대)이 이미 개명·문서화 조치로 반영된 최종본이며, 이번 impl-done 재검증에서 새로 발견된 식별자 충돌은 없다.

## 위험도
NONE
