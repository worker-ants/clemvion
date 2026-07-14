# 문서화(Documentation) Review

## 발견사항

- **[WARNING] 신규 env var 3개가 `.env.example` 에 미등재 — 리포지토리 자체 선례를 어김**
  - 위치: `codebase/backend/.env.example` (전체), `codebase/backend/src/nodes/ai/ai-agent/tool-payload-budget.ts:582-599`
  - 상세: 신규 `tool-payload-budget.ts` 는 `AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES`(기본 98304) · `AI_AGENT_TOOL_PAYLOAD_HARD_BYTES`(기본 262144) · `AI_AGENT_TOOL_COUNT_MAX`(기본 128) 세 env var 를 `readByteBudget()` 로 노출하고, `readByteBudget` 의 JSDoc 은 스스로 "mcp-tool-provider.ts 의 `MAX_RESPONSE_BYTES` 선례 동형" 이라 명시한다. 그런데 정작 그 선례인 `MCP_MAX_RESPONSE_BYTES` 는 `codebase/backend/.env.example:293-307` 에 "MCP (Model Context Protocol)" 섹션으로 spec 링크(`spec/5-system/11-mcp-client.md`)와 함께 문서화돼 있는 반면, 신규 3개 var(및 후속 계획된 `AI_AGENT_TOOL_BUDGET_STRICT_SAVE`)는 `.env.example` 전체를 grep 해도 등장하지 않는다. spec 표(`spec/4-nodes/3-ai/1-ai-agent.md` §4.2)에는 잘 정리돼 있으나, 운영자가 실제로 값을 조정하려 참조하는 1차 소스는 `.env.example` 이므로 발견성이 떨어진다.
  - 제안: `.env.example` 에 "AI Agent — 도구 정의 payload 예산" 섹션을 추가해 세 변수(및 §4.2 SoT 링크)를 기본값과 함께 등재. `plan/in-progress/ai-agent-tool-payload-budget-guardrail.md` Phase 2 항목 5("env 기본값 ... 구현됨")에도 이 태스크가 빠져 있어 재발 방지를 위해 plan 에도 명시해두는 편이 좋다.

- **[WARNING] `CHANGELOG.md` 미갱신 — 최근 10개 커밋 전부가 지켜온 "Unreleased" 엔트리 관례에서 이탈**
  - 위치: `CHANGELOG.md` (변경 없음), 관련 커밋 `98e728ba9`/`237f9a68c`/`c0acc6337`
  - 상세: `git log`(edge §4.1/§4/§5/§3.2/§1.3/§1.2 등 직전 6개 PR)를 보면 매 기능 PR 이 `CHANGELOG.md` 에 "## Unreleased — ..." 섹션을 spec SoT 링크와 함께 추가해왔다(예: `32c852670`, `a1295efbc`, `4ea239e67` 등). 본 PR(도구 정의 payload 예산 가드레일, 6분 hang 회귀 수정 — 사용자 체감 영향이 큰 운영 장애 대응)은 이 관례를 따르지 않아 `CHANGELOG.md` 에 항목이 없다. `git diff main...HEAD --stat` 로 확인해도 `CHANGELOG.md` 는 diff 목록에 없다.
  - 제안: `CHANGELOG.md` 에 "AI Agent 도구 정의 payload 예산 가드레일 (ai-agent §4.2)" 항목을 추가 — 배경(6분 hang 회귀)·`TOOL_DEFINITION_PAYLOAD_EXCEEDED` fail-fast·env var 3종·SoT 링크(`spec/4-nodes/3-ai/1-ai-agent.md §4.2`)를 기존 엔트리 형식에 맞춰 기술.

- **[INFO] 신규 파일 JSDoc/인라인 주석 품질은 양호 — 특기할 결함 없음**
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-payload-budget.ts` 전체, `ai-turn-executor.ts` 변경분(§4.2/§7.1/§7.3 참조 주석), `tool-payload-budget.spec.ts` describe 블록 상단 요약
  - 상세: 검증한 결과 모두 정확했다. (1) `tool-payload-budget.ts` 모듈 최상단 JSDoc 이 배경(#828 회귀)·SoT 경로·estimator 단일 진실 원칙을 명시하고, 모든 export 함수에 개별 JSDoc 존재. (2) `ai-turn-executor.ts` 의 `singleTurnEnteredAt` 주석이 "`singleTurnStartedAt`(아래)와 별개" 라 주장하는데, 실제로 `singleTurnStartedAt` 이 그 아래(약 150줄 뒤)에 정의돼 있음을 라인 대조로 확인 — 정확. (3) `processMultiTurnMessage 는 buildTools throw 를 감싸지 않는다 (orchestrator 의 handleAiMessageTurn try/catch → extractAiTurnErrorPayload...)` 주석도 `ai-turn-orchestrator.service.ts:594-615`(`handleAiMessageTurn` 이 `processMultiTurnMessage` 호출을 try/catch 로 감싸 `handleAiTurnError`→`extractAiTurnErrorPayload` 로 라우팅)와 대조해 정확함을 확인. (4) 개명(`AI_TOOL_BUDGET_EXCEEDED` → `TOOL_DEFINITION_PAYLOAD_EXCEEDED`) 잔재를 `spec/`·`codebase/backend/src/nodes/ai/` 전체 grep 으로 확인했으나 잔존 없음 — consistency-check 가 지적한 개명 작업이 spec·코드 전역에 깨끗이 반영됨.
  - 제안: 조치 불필요 (참고용 기록).

## 요약

핵심 구현 파일(`tool-payload-budget.ts`, `ai-turn-executor.ts`)과 spec 문서(`ai-agent.md` §4.2/§10/§12.15, `mcp-client.md` §5.8, `cross-node-warning-rules.md` §5/§8)는 SoT 원칙에 맞게 매우 꼼꼼히 갱신되었고, 인라인 주석은 검증한 범위에서 모두 정확했으며 consistency-check 가 지적한 개명 이슈도 전역에 깔끔히 반영되었다. 다만 이 리포지토리 자체가 확립해 둔 두 관례 — (1) `MCP_MAX_RESPONSE_BYTES` 선례처럼 신규 env var 를 `.env.example` 에 spec 링크와 함께 등재하는 것, (2) 매 기능 PR 이 `CHANGELOG.md` "Unreleased" 섹션에 항목을 남기는 것 — 이 이번 변경에서는 지켜지지 않았다. 둘 다 기능 자체를 막는 결함은 아니지만 운영자 발견성·변경 이력 추적성을 낮추므로 반영을 권장한다.

## 위험도
LOW
