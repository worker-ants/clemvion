# Plan 정합성 검토 결과

검토 모드: `--impl-done`
Target: `spec/2-navigation/4-integration.md`
구현 diff: PR #633 — `getUsages` MCP 합집합 + `usageKind('direct'|'mcp')`, UsageTab MCP 배지, `remove()` MCP 차단, 단위테스트 + e2e
관련 plan: `plan/in-progress/integration-mcp-usage-followups.md` (⑤⑥⑦)

---

## 발견사항

### [WARNING] spec §7.1 사용처 조회 로직 — `usageKind` 및 MCP 합집합 미반영

- **target 위치**: `spec/2-navigation/4-integration.md §7.1` (line 734-736)
- **관련 plan**: `plan/in-progress/integration-mcp-usage-followups.md` — 본 plan 의 선행 PR #633 이 구현한 핵심 계약
- **상세**: spec §7.1 의 현재 본문은 다음과 같이 기술되어 있다:
  > `GET /api/integrations/:id/usages`는 모든 워크플로우의 `Node.config`를 JSONB path 조회 (`config->>'integrationId' = :id`)
  > 결과는 워크플로우 단위로 그룹화 `{ workflowId, workflowName, isActive, nodes: [{ id, label, type }] }[]`

  그러나 PR #633 구현은 다음을 추가했다:
  - 조회 조건을 `config->>'integrationId' = :id` 단독 → `OR n.config -> 'mcpServers' @> :mcpProbe::jsonb`(MCP 합집합) 로 확장
  - 노드 항목에 `usageKind: 'direct' | 'mcp'` 필드 추가 (SQL `CASE WHEN` 분기)
  - `direct` 우선 규칙 (동일 노드가 양쪽 해당 시 `'direct'`)

  spec §7.1 은 여전히 `config->>'integrationId'` 단독 조회와 `nodes: [{ id, label, type }]` (usageKind 없음) 를 기술하고 있어, 구현과 **불일치** 상태다. 이 갭은 이번 PR 이 새로 만든 드리프트다.

- **제안**: `spec/2-navigation/4-integration.md §7.1` 을 다음으로 갱신한다 (project-planner 영역):
  1. 조회 조건에 MCP 합집합 추가 (`config -> 'mcpServers' @> [{integrationId}]`) 와 `direct` 우선 규칙 명시
  2. 응답 shape 를 `nodes: [{ id, label, type, usageKind: 'direct' | 'mcp' }][]` 로 갱신
  3. `§7.1` 에 `usageKind` 의미(직접 참조 vs MCP 참조) 한 문장 추가

---

### [WARNING] spec §7.2 삭제 차단 다이얼로그 — MCP 배지·⑥ 미구현 갭 spec 미반영

- **target 위치**: `spec/2-navigation/4-integration.md §7.2` (line 738-757)
- **관련 plan**: `plan/in-progress/integration-mcp-usage-followups.md §⑥` (삭제 차단 다이얼로그 프론트 미구현)
- **상세**: `integration-mcp-usage-followups.md §⑥` 은 "spec §4.7 / §7.2 는 통합 삭제가 차단될 때 사용처 목록 다이얼로그 + MCP 배지 표시를 요구한다"고 명시한다. 그러나 현재 `spec/2-navigation/4-integration.md §7.2` 의 본문에는 삭제 차단 다이얼로그 UI 에 MCP 배지(`usageKind` 기반 표시)가 명시되어 있지 않다 — 다이얼로그 목업(line 741-754)도 노드 항목에 배지 없이 이름·id 만 열거한다.

  spec §⑥ 계획이 실행되면(후속 PR) 프론트 구현이 MCP 배지를 다이얼로그에 표시하게 되는데, 이를 지탱하는 spec 본문이 현재 없다. plan 이 spec 보다 앞서 정의를 보유한 상태 — spec 에 "MCP 노드 참조는 배지로 구분 표시" 를 지금 반영하지 않으면 ⑥ 착수 시 spec 선행 없이 구현이 되거나, ⑥ 착수 시 다시 spec 개정이 필요하다.

- **제안**: `spec/2-navigation/4-integration.md §7.2` 의 다이얼로그 목업 및 설명에 "MCP 참조 노드는 `MCP` 배지로 구분 표시" 를 추가한다 (project-planner, ⑥ 착수 전 또는 병행). plan `§⑥` 항목에는 "spec §7.2 갱신 선행 또는 동시" 조건을 명시하는 것이 바람직하다.

---

### [INFO] `integration-mcp-usage-followups.md §⑦` — `getUsages()` 이중 findById, spec 비관여

- **target 위치**: 구현 `integrations.service.ts` 내부 (`remove()` → `getUsages()` 이중 조회)
- **관련 plan**: `plan/in-progress/integration-mcp-usage-followups.md §⑦`
- **상세**: plan §⑦ 이 이미 정확히 기술하고 있으며, 정확성 문제 없음(perf 미미). spec 계약(API 인터페이스·행동)에는 영향이 없다. plan 추적으로 충분하고 spec 개정 불필요.
- **제안**: 추적 메모로 유지. 착수 시 spec 개정 없이 `integrations.service.ts` 리팩터만 수행한다.

---

### [INFO] `integration-mcp-usage-followups.md §⑤` — GIN 인덱스, spec 비관여

- **target 위치**: 구현 DB 마이그레이션 (미실행)
- **관련 plan**: `plan/in-progress/integration-mcp-usage-followups.md §⑤`
- **상세**: 성능 인덱스(`CREATE INDEX CONCURRENTLY idx_node_config_gin`) 는 spec 행동 계약과 무관하다. plan §⑤ 가 정확히 설명하고 있으며, 착수 시 `spec/1-data-model.md` 인덱스 표 갱신이 동반될 수 있으나 현재 충돌은 없다.
- **제안**: 추적 메모로 유지.

---

## 요약

Plan 정합성 관점에서 미해결 결정 우회(CRITICAL)는 없다. 그러나 PR #633 이 새로 만든 spec 드리프트가 두 건 존재한다: `spec §7.1` 은 MCP 합집합 조회와 `usageKind` 응답 필드를 아직 반영하지 않았고(WARNING), `spec §7.2` 는 삭제 차단 다이얼로그의 MCP 배지 요건이 plan(integration-mcp-usage-followups §⑥)에는 있으나 spec 본문에 없어 후속 구현 착수 전 선행 조건이 누락된 상태다(WARNING). 두 항목 모두 project-planner 가 `spec/2-navigation/4-integration.md §7.1·§7.2` 를 갱신해야 해소된다. plan §⑤(GIN 인덱스)·§⑦(이중 findById)은 spec 계약 무관 사항으로 INFO 수준이다.

## 위험도

MEDIUM

STATUS: DONE (CRITICAL 0, WARNING 2, INFO 2)
