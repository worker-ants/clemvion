# 정식 규약 준수 검토 — convention_compliance

**대상 문서**: `plan/in-progress/cafe24-expired-self-healing.md`
**검토 모드**: spec draft (--spec)
**검토 일시**: 2026-05-18

---

## 발견사항

### 1. **[WARNING]** `skipReason` 값이 `camelCase` — 에러 코드 UPPER_SNAKE_CASE 규약과 불일치

- **target 위치**: `## D. mcpDiagnostics 에 skipReason 노출` 섹션, `skipReason` 값 열거 항목
- **위반 규약**: `spec/conventions/node-output.md` Principle 3.2 — "code 는 UPPER_SNAKE_CASE"
- **상세**: plan D 항목에서 `skipReason` 값으로 `'expired_install_timeout'` / `'expired_refresh_failed'` / `'expired_no_refresh_token'` / `'error'` / `'lookup_failed'` / `'not_cafe24'` 를 정의했다. 이 값들은 `meta.mcpDiagnostics` 의 진단 페이로드 필드이므로 기존 에러 코드 vocabulary (`MCP_AUTH_FAILED`, `MCP_TIMEOUT`, `MCP_CONNECT_FAILED` 등 — `spec/5-system/11-mcp-client.md §8.2`) 와 같은 `UPPER_SNAKE_CASE` 패턴을 따라야 한다. 현재 plan 에 적힌 값은 모두 `lower_snake_case` 이며, 기존 `mcpDiagnostics.errors[].code` 규약과 토큰 스타일이 다르다.
- **제안**: skipReason 값을 `EXPIRED_INSTALL_TIMEOUT` / `EXPIRED_REFRESH_FAILED` / `EXPIRED_NO_REFRESH_TOKEN` / `AUTH_ERROR` / `LOOKUP_FAILED` / `NOT_CAFE24` 등 `UPPER_SNAKE_CASE` 로 변경. 혹은 `skipReason` 이 에러 코드가 아닌 별도 진단 열거형임을 명시해 기존 `mcpDiagnostics.errors[].code` 와 의미상 분리한다면, 규약 문서에 해당 예외를 명시적으로 추가하는 것이 적절.

---

### 2. **[WARNING]** `serverSummaries[]` 필드가 기존 `mcpDiagnostics` 스키마에 정의되지 않은 신규 필드

- **target 위치**: `## D. mcpDiagnostics 에 skipReason 노출` 섹션 — `meta.mcpDiagnostics.serverSummaries[]` 참조
- **위반 규약**: `spec/conventions/node-output.md` Principle 0 (NodeHandlerOutput 5필드 불변), Principle 2 (`meta` 는 실행 메트릭만 담는다), 그리고 `spec/5-system/11-mcp-client.md §6.2` 의 `mcpDiagnostics` 스키마
- **상세**: 현재 `spec/5-system/11-mcp-client.md §6.2` 의 `mcpDiagnostics` 스키마에는 `serverSummaries` 필드가 정의되어 있지 않다. 스키마에는 `attempted` / `serverCount` / `toolCalls` / `resourceReads` / `promptGets` / `errors[]` 만 정의되어 있다. plan 은 `serverSummaries[].skipReason` 와 `serverSummaries[].status: 'connected'` 를 추가하려 하지만, 이를 구현에 반영하기 전에 `spec/5-system/11-mcp-client.md §6.2` 스키마에 `serverSummaries` 필드 정의가 선행되어야 한다. plan C 에서 해당 spec 정정을 요구하고 있으나 C 항목 설명(`spec/5-system/11-mcp-client.md §8.4 또는 §6 에 "Internal Bridge cafe24 의 skipReason 노출" 명시`)이 `§6.2` 의 스키마 확장이 아닌 주석 추가 수준에 그쳐 있어, 실제 필드 정의 갱신이 누락될 위험이 있다.
- **제안**: plan C 항목에 "spec/5-system/11-mcp-client.md §6.2 `mcpDiagnostics` 스키마에 `serverSummaries[]` 필드(필드 목록·타입·skipReason 열거형 포함) 정의 추가"를 명시적으로 포함시킬 것. 또한 `spec/4-nodes/3-ai/0-common.md §7` 에도 동일 필드 링크 추가를 plan C 에서 명시하고 있으나(`serverSummaries[].skipReason` 한 줄), 해당 섹션 현재 내용에 `serverSummaries` 참조가 없으므로 공통 스펙과의 정합을 맞춰야 한다.

---

### 3. **[INFO]** 에러 응답 `'auth_failed'` / `'connection_failed'` 값이 외부 MCP 용 skipReason 후보로 혼재 — 기존 vocabulary 와 토큰 스타일 불일치

- **target 위치**: `## D.` 3번째 항목 — "외부 `McpToolProvider`(`service_type='mcp'`) 도 동일 필드 사용 가능 — `'auth_failed'` / `'connection_failed'` 등"
- **위반 규약**: `spec/5-system/11-mcp-client.md §8.2` — 기존 vocabulary 는 `MCP_AUTH_FAILED` / `MCP_CONNECT_FAILED` 등 `UPPER_SNAKE_CASE`
- **상세**: plan 에서 외부 MCP 에 적용 가능한 skipReason 예시로 `'auth_failed'` / `'connection_failed'` 를 제시하는데, 이는 현재 `mcpDiagnostics.errors[].code` 에서 사용하는 `MCP_AUTH_FAILED` / `MCP_CONNECT_FAILED` 와 같은 개념을 다른 케이스 스타일로 표현하고 있다. 동일 개념의 중복 토큰을 도입하면 혼란이 생긴다.
- **제안**: 외부 MCP `skipReason` 후보 값도 `§8.2` vocabulary 를 그대로 재사용하거나, 별도 열거형으로 분리할 경우 기존 vocabulary 와의 관계를 명확히 규약에 기술할 것.

---

### 4. **[INFO]** plan 구조에 `## Rationale` 섹션 없음

- **target 위치**: 문서 전체 — `## 배경`, `## 작업 항목`, `## 워크플로우`, `## 비고` 섹션만 존재
- **위반 규약**: `CLAUDE.md` 명명 컨벤션 — "spec 문서 끝에 `## Rationale` 섹션을 권장". `plan/` 문서에도 CLAUDE.md §프로젝트 스펙 문서 의 "권장 3섹션" 정책이 준용된다고 볼 수 있음
- **상세**: `plan/` 문서는 spec 문서와 달리 Rationale 섹션이 필수는 아니다. CLAUDE.md 의 권장 3섹션(Overview / 본문 / Rationale)은 `spec/<영역>/N-name.md` 에 명시적으로 적용되며 plan 문서에 대한 강제 규정은 없다. 다만 plan 에 포함된 설계 결정(예: "B 의 `Cafe24AuthFailedError` 사용", "install_timeout skipReason 분리" 등)의 근거가 현재 `## 배경` 과 본문에 산재해 있어 추적이 어렵다.
- **제안**: plan 문서이므로 Rationale 섹션 부재는 규약 위반이 아니다. 다만 향후 해당 결정들이 spec 에 반영될 때 근거가 보존되도록, 최종 spec 갱신(C 항목) 시 관련 Rationale 을 spec 문서 끝에 추가할 것을 권장.

---

## 요약

`plan/in-progress/cafe24-expired-self-healing.md` 는 plan 문서로서 frontmatter, 작업 항목, 워크플로우 구성 등 CLAUDE.md 의 plan 라이프사이클 규약을 적절히 따르고 있다. 정식 규약(`spec/conventions/`) 관점에서 가장 주목할 점은 **D 항목의 `skipReason` 값 케이스 스타일**이다. 기존 `mcpDiagnostics.errors[].code` vocabulary 가 `UPPER_SNAKE_CASE` 를 사용하는데 (`spec/5-system/11-mcp-client.md §8.2`, `spec/conventions/node-output.md §3.2`), plan 에서 정의한 `skipReason` 값은 모두 `lower_snake_case` 로 명시되어 있어 기존 에러 코드 규약과 불일치한다. 또한 `serverSummaries[]` 는 현재 `mcpDiagnostics` 스키마에 존재하지 않는 신규 필드이므로, spec C 항목에서 `§6.2` 스키마 확장을 명시적으로 포함해야 구현·spec 간 정합이 보장된다. 두 항목 모두 spec 갱신(C) 시에 함께 해결 가능하며, 구현 착수 전 spec 확정 단계에서 정리해야 할 사항이다.

---

## 위험도

**MEDIUM**

> `skipReason` 케이싱 불일치는 진단 필드의 소비자(프론트엔드, 로그 파서 등)가 잘못된 토큰 스타일로 구현될 경우 디버깅 혼란을 야기할 수 있다. `serverSummaries[]` 미정의 스키마는 spec-impl drift 를 일으킬 수 있으나, plan 워크플로우 상 구현 전 spec 정정(C) 이 선행되므로 현 시점의 실제 위험은 낮다.
