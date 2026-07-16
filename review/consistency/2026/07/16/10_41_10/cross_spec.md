# Cross-Spec 일관성 검토 — spec/4-nodes/3-ai/

## 발견사항

- **[CRITICAL]** Multi Turn `out` 포트 "하위 호환" 서술이 실제 기술 spec 과 정반대
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §3.2 (포트) — "Multi Turn 모드에는 **`out` 포트가 존재하지 않는다** — … 조건이 0개인 경우에도 동일" + 같은 절의 **마이그레이션** 항목: "기존 `multi_turn` + 조건 없음 노드의 `out` 포트에 연결된 엣지는 dangling 상태가 됨. `user_ended` 또는 `max_turns` 포트로 수동 재연결 필요"
  - 충돌 대상: `spec/4-nodes/_product-overview.md` ND-AG-24 — "Multi Turn 모드: 조건 포트 + `user_ended` + `max_turns` + `error`. **조건 0개 시 `out` + `error` (하위 호환)**" / 동일 문구가 target scope 내부의 `spec/4-nodes/3-ai/_product-overview.md` ND-AG-24 에도 반복 ("`out` 없음"이라 적어놓고 바로 뒤에 "조건 0개 시 `out` + `error` 제공 (하위 호환)"이라고 자기모순적으로 부연)
  - 상세: 요구사항 문서(양쪽 `_product-overview.md`)는 "조건이 0개인 multi_turn 노드는 `out` 포트를 하위 호환으로 계속 제공한다"고 명시하지만, 기술 spec(`1-ai-agent.md` §3.2)은 정확히 반대로 "`out` 포트는 조건 0개여도 존재하지 않으며, 기존 엣지는 dangling 처리되고 사용자가 수동으로 `user_ended`/`max_turns` 로 재연결해야 한다"고 규정한다. 둘 중 하나가 실제 구현과 다르며, `frontend`/`backend` 어느 쪽을 구현 기준으로 삼아야 하는지가 spec 상 확정되지 않는다. impl-prep 단계에서 이 문구를 그대로 두면 개발자가 "0개 조건이면 `out` 이 살아있다"고 오인해 마이그레이션/포트 계산 로직을 잘못 구현할 위험이 크다.
  - 제안: 실제 코드 동작(`ai-agent.handler.ts` / `ai-turn-executor.ts` 의 포트 계산 로직)을 SoT 로 확정한 뒤 — (a) `1-ai-agent.md` §3.2 가 맞다면 두 `_product-overview.md` 의 ND-AG-24 "조건 0개 시 `out` + `error` 제공 (하위 호환)" 문구를 삭제, (b) 반대로 하위 호환 `out` 이 실제로 살아있다면 `1-ai-agent.md` §3.2 본문·마이그레이션 절을 정정. 두 파일이 항상 동시에 갱신되도록 ND-AG-24 쪽에서 `1-ai-agent.md` §3 를 단일 SoT 로 링크하고 자체 서술은 요약만 남기는 편집도 고려.

- **[CRITICAL]** `AI_AGENT_TOOL_COUNT_MAX=128` 기본값이 Cafe24/MakeShop 기본(미설정=전체노출) 경로에서 상시 초과 — "구현 완료" 서술과 충돌
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §1 (`enabledTools` — `['*']` 또는 미설정 = 전체 노출, 기본값) + §4.2 (`AI_AGENT_TOOL_COUNT_MAX` 기본 `128`, 초과 시 hard fail 과 동일 취급 → 런타임 `TOOL_DEFINITION_PAYLOAD_EXCEEDED`) + §12.15 Rationale (2026-07-06 회귀 사고 실측: "Cafe24 MCP 서버를 `enabledTools` allowlist 없이 연결한 AI Agent 는 scope 허용 **383개** 오퍼레이션 전량을 도구로 노출")
  - 충돌 대상: `spec/0-overview.md` §6.1 구현 완료 표 — "Cafe24 통합 … AI Agent Internal MCP Bridge 양방향 노출 … 모두 구현 완료" / "MakeShop 통합 … AI Agent Internal MCP Bridge 양방향 노출 … 모두 구현 완료" · `spec/4-nodes/4-integration/4-cafe24.md` ("18 카테고리, 카테고리당 평균 ~10 operation = 총 **~180** endpoint") · `spec/4-nodes/4-integration/5-makeshop.md`/`spec/0-overview.md` ("**161** REST operation")
  - 상세: Cafe24(383개, `1-ai-agent.md` §12.15 자체 실측치) 와 MakeShop(161개, `5-makeshop.md`) 모두 `enabledTools` 를 사용자가 명시적으로 좁히지 않는 **기본 경로**에서 `AI_AGENT_TOOL_COUNT_MAX=128` 를 크게 초과한다. §4.2 규약상 "2차 sanity — 초과 시 hard 와 동일 취급" 이므로, allowlist 를 설정하지 않고 Cafe24/MakeShop Integration 을 AI Agent 의 `mcpServers` 에 연결하는 (spec 이 default 로 서술하는) 사용법은 사실상 **항상** 런타임 `TOOL_DEFINITION_PAYLOAD_EXCEEDED` 로 실패한다. 그런데 `spec/0-overview.md` 는 이 두 Internal MCP Bridge 를 "모두 구현 완료" 로 마킹해 정상 동작하는 완결 기능처럼 서술하고, `1-ai-agent.md` §1/§2 어디에도 "Cafe24/MakeShop 연결 시 allowlist 설정이 사실상 필수" 라는 경고가 없다 (저장 시점 경고도 §10 에 따르면 기본 `warning` 이라 저장·실행을 막지 않는다). 부수적으로 Cafe24 오퍼레이션 총량 표기가 `4-cafe24.md` 의 "~180" 과 `1-ai-agent.md` §12.15 의 실측 "383" 사이에서도 서로 다르다 — 동일 실체에 대한 두 문서의 숫자가 2배 이상 벌어진 상태.
  - 제안: (1) `4-cafe24.md` 의 "~180" 표기를 근거를 재확인해 "383" 으로 정정하거나, 두 숫자가 다른 집합(예: 문서화된 endpoint vs 실제 MCP tool 노출 수)을 가리키는 것이라면 그 차이를 명시. (2) `1-ai-agent.md` §1/§2 에 "Cafe24(383)/MakeShop(161) 은 `AI_AGENT_TOOL_COUNT_MAX`(기본 128) 를 초과하므로 `enabledTools` allowlist 설정이 사실상 필수" 경고를 명문화하거나, §10 저장 경고의 심각도를 Cafe24/MakeShop 한정으로 기본 승격하는 방안 검토. (3) `spec/0-overview.md` §6.1 의 "구현 완료" 서술에 이 제약 각주를 추가해 사용자가 전체 노출 상태로 저장·배포했을 때 겪을 실패를 spec 차원에서 예고.

## 요약

`spec/4-nodes/3-ai/` 는 다른 영역과의 cross-reference 밀도가 매우 높고(MCP Client, RAG, Presentation, Conversation Thread, WebSocket Protocol, Integration, Agent Memory, node-output 등) 대부분의 필드/포트/enum/스키마 정의가 상호 정합했다. 다만 두 건의 실질적 충돌을 확인했다 — (1) Multi Turn `out` 포트의 "0개 조건 시 하위 호환 유지" 여부가 요구사항 문서(ND-AG-24, 두 `_product-overview.md`)와 기술 spec(`1-ai-agent.md` §3.2 및 마이그레이션 절) 사이에서 정반대로 기술되어 있고, (2) 최근 도입된 도구 정의 payload 예산 가드레일(`AI_AGENT_TOOL_COUNT_MAX=128`)이 Cafe24(383)/MakeShop(161) 의 기본(미설정=전체노출) 연결 경로를 사실상 항상 실패시키는데, 이 제약이 `spec/0-overview.md` 의 "구현 완료" 서술이나 `1-ai-agent.md` §1/§2 사용 안내에 반영되어 있지 않으며 부수적으로 Cafe24 오퍼레이션 총량 수치(~180 vs 383)도 문서 간 어긋난다. 두 건 모두 impl-prep 단계에서 개발자가 착수 전에 SoT 를 확정하지 않으면 잘못된 구현·회귀로 이어질 가능성이 높다.

## 위험도
CRITICAL
