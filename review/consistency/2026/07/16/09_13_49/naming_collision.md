# 신규 식별자 충돌 검토 — spec/4-nodes/3-ai/ (--impl-done)

## 검토 방법

`diff-base=origin/main` 기준 실제 변경 범위를 먼저 확정한 뒤, 그 변경이 새로 도입한 식별자만 대상으로 검토했다 (payload 의 "Target 문서" 절에는 `0-common.md`/`1-ai-agent.md` 전문이 포함돼 있었으나, 그 안의 대다수 식별자 — `ND-AG-*` 요구사항 ID, `cond_*`/`kb_*`/`mcp_*`/`render_*` 도구 이름 규칙, `memoryStrategy` 필드 등 — 는 이번 diff 이전에 이미 spec/코드에 존재하던 것이라 "신규 도입" 대상이 아니다).

실측 diff-base 비교:

```
git diff --stat origin/main HEAD
```

→ 21개 파일, `spec/4-nodes/3-ai/1-ai-agent.md` 는 1건(+1/-2 라인)만 변경. 실질 변경은 "AI Agent 도구 정의 payload 예산 — 저장 시점(config-time) graph warning" 을 **Planned → 구현 완료**로 전환하는 후속 PR(plan `ai-agent-tool-payload-budget-followups.md` 항목 A)이다. 이 범위에서 실제로 새로 등장한 식별자를 하나씩 대조했다:

| 신규 식별자 | 종류 | 충돌 검사 결과 |
|---|---|---|
| `AI_AGENT_TOOL_BUDGET_STRICT_SAVE` (env, `.env.example`) | 환경변수 | `git grep -n "AI_AGENT_TOOL"` 로 `.env.example`/spec/backend 전수 대조 — 기존 `AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES`/`_HARD_BYTES`/`AI_AGENT_TOOL_COUNT_MAX` 와 동일 네임스페이스, 중복·오버로드 없음. spec (`1-ai-agent.md §4.2`) 에 이미 "목표 설계"로 예고돼 있던 이름이 그대로 구현됨 — 신규 충돌 아님 |
| `tool-payload-save-warning.ts` (신규 파일) | 파일 경로 | 같은 디렉터리의 런타임 가드 `tool-payload-budget.ts` 와 접미사(`-save-warning` vs `-budget`)로 명확히 구분. **plan 파일 자체에 "naming-collision checker INFO 반영" 으로 이 파일명이 이전 리뷰 라운드에서 이미 조정된 이력**이 남아 있음(`plan/in-progress/ai-agent-tool-payload-budget-followups.md`) — 재확인 결과 여전히 collision 없음 |
| `AI_AGENT_TOOL_PAYLOAD_BUDGET_RULE_ID` (export const, `'ai_agent:tool-payload-budget'`) | rule id / 상수명 | `git grep` 전수 조회 결과 이 rule id 는 이전 PR(#948)에서 이미 "Planned" 설계로 `cross-node-warning-rules.md` §8 표에 등재돼 있었고, 본 diff 는 그 상태를 "구현됨"으로 확정할 뿐 — 신규 rule id 아님. 다른 `ai_agent:*` rule id(`no-llm-provider`, `too-many-conditions`)와도 문자열 불일치로 충돌 없음 |
| `GRAPH_WARNING_KO['ai_agent:tool-payload-budget']` (frontend i18n key) | 설정키 | 위 rule id 와 문자열 정확히 일치 — 의도된 매핑. 기존 키(`parallel:*`, `graph:unescapable-cycle` 등)와 겹치지 않음 |
| `evaluateAiAgentToolPayloadWarnings` / `ToolBudgetGraphNode` / `AiAgentToolBudgetDeps` / `loadIntegrationsForBudget` / `evaluateToolPayloadWarnings`(private) | 함수·타입명 | `git grep` 결과 각각 정의 위치 1곳 + 호출부만 존재. `WorkflowsService.evaluateGraphWarnings`(기존, private, cross-node-warning-rules 전체 평가)와 신규 `evaluateToolPayloadWarnings`(private, AI Agent 전용)는 이름이 유사하지만 **동일 클래스 내부 private 메서드 쌍으로 역할이 명확히 분리**돼 있고 외부 노출도 없어 실사용 혼선 위험은 낮음 |
| `GET /workflows/:id/graph-warnings` | API endpoint | 신규 endpoint 아님 — 기존 endpoint 유지. `WorkflowsService.getGraphWarnings(id, workspaceId)` 로 시그니처에 `workspaceId` 매개변수가 추가됐으나, controller 에서는 이미 인증 컨텍스트의 `@WorkspaceId()` 데코레이터 값을 그대로 전달하는 내부 구현 변경일 뿐 HTTP 계약(path/method/query)은 불변 |

## 발견사항

없음. 이번 diff 범위에서 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수/설정키·파일 경로 6개 관점 모두 기존 사용처와의 충돌을 찾지 못했다.

참고로 target payload 에 포함된 `0-common.md`/`1-ai-agent.md` 전문 중 이번 diff 밖의 식별자(`ND-AG-06/10/21`, `cond_*`/`kb_*`/`mcp_*`/`render_*` 4계열 도구 이름, `memoryStrategy`/`contextScope` 필드군 등)는 모두 origin/main 대비 신규가 아니므로 본 리뷰의 "신규 식별자" 범주에서 제외했다 — 다만 재확인 차원에서 `render_*` 5종(`render_table`/`render_chart`/`render_carousel`/`render_template`/`render_form`)과 `cond_*`/`kb_*`/`mcp_*` 접두사가 서로 disjoint 함을 spec 본문(§4.1, §4 도구 이름 규칙)에서 재확인했고, 코드(`ai-condition-evaluator.ts`)의 provider 등록 순서(kb → mcp → render)와도 정합해 별도 이슈는 없다.

## 요약

이번 --impl-done 검토 대상은 "AI Agent 도구 정의 payload 예산의 저장 시점(config-time) graph warning" 을 Planned 상태에서 구현 완료로 전환한 소규모 후속 PR이다. 새로 도입된 식별자(env var, rule id, 파일 경로, 함수/타입명, i18n key)는 모두 사전에 "목표 설계"로 spec 에 예고돼 있던 이름을 그대로 구현에 반영한 것이거나, 기존 네이밍 컨벤션(`AI_AGENT_TOOL_*`, `<node>:<rule>` rule id, `tool-payload-*.ts` 파일군)을 그대로 따르는 새 요소이며, 코드베이스·spec 전수 grep 대조 결과 기존 사용처와의 의미 충돌이 없었다. 특히 `tool-payload-save-warning.ts` 파일명은 plan 문서에 남은 이력에 따르면 이전 naming-collision 검토 라운드에서 이미 한 차례 조정된 결과로, 이번 재검토에서도 문제 없음을 재확인했다.

## 위험도

NONE
