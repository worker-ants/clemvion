# Cross-Spec 일관성 검토 결과

검토 모드: --impl-done (구현 완료 후)
대상 scope: `spec/2-navigation/4-integration.md`
diff-base: origin/main
검토 일시: 2026-06-19

---

## 발견사항

### [WARNING] spec/2-navigation/4-integration.md §7.1 — 사용처 조회 로직이 MCP 참조 경로를 반영하지 않음

- **target 위치**: `spec/2-navigation/4-integration.md` §7.1 (사용처 조회 로직)
- **충돌 대상**: `codebase/backend/src/modules/integrations/integrations.service.ts` (구현 완료 코드)
- **상세**:
  - spec §7.1 은 사용처 조회 조건을 `config->>'integrationId' = :id` 단일 JSONB path 조회로만 기술한다.
  - 구현 코드는 `new Brackets(qb => qb.where("n.config ->> 'integrationId' = :id").orWhere("n.config -> 'mcpServers' @> :mcpProbe::jsonb"))` — 즉 직접 참조(config.integrationId) 와 MCP 참조(config.mcpServers[].integrationId) 합집합으로 확장됐다.
  - 결과 shape 도 spec 은 `nodes: [{ id, label, type }][]` 로만 정의하지만, 구현은 `nodes: [{ id, label, type, usageKind: 'direct' | 'mcp' }][]` 를 반환한다.
  - 이는 사전 공지된 spec-drift (맥락 메모에서 "코드가 옳고 spec 이 낡음"으로 분류됨).
- **제안**: project-planner 가 `spec/2-navigation/4-integration.md §7.1` 을 다음 내용으로 갱신:
  1. 조회 조건: `config->>'integrationId' = :id` OR `config->'mcpServers' @> '[{"integrationId":":id"}]'::jsonb` (PostgreSQL `@>` containment)
  2. 결과 shape: `nodes: [{ id, label, type, usageKind: 'direct' | 'mcp' }][]` — `usageKind` 는 CASE 식으로 결정되며 한 노드가 양쪽에 해당하면 `'direct'` 우선
  3. 삭제 차단 로직: MCP 참조만 있는 경우에도 동일하게 차단됨을 명시

---

### [WARNING] spec/4-nodes/4-integration/_product-overview.md §2.4 INT-US-01 — 요구사항이 직접 참조만 명시하고 MCP 참조를 배제함

- **target 위치**: `spec/4-nodes/4-integration/_product-overview.md` §2.4 INT-US-01
- **충돌 대상**: `codebase/backend/src/modules/integrations/integrations.service.ts` (구현 완료 코드) + e2e `integration-usage-mcp.e2e-spec.ts`
- **상세**:
  - INT-US-01: "연동을 사용 중인 워크플로우·노드를 추적 (**노드 `config.integrationId` 참조 기준**, 활성/비활성 무관)"
  - 구현은 `config.integrationId` (직접 참조) AND `config.mcpServers[].integrationId` (MCP 참조) 양쪽을 합집합 처리한다.
  - INT-US-01 의 "config.integrationId 참조 기준" 표현은 MCP 경로를 의도적으로 배제한 것으로 오인될 수 있어, 사용처 정의가 직접 참조에만 한정된다고 오해할 소지가 있다.
- **제안**: INT-US-01 을 "노드 `config.integrationId` 직접 참조 **또는 AI Agent 노드의 `config.mcpServers[].integrationId` MCP 참조** 기준, 활성/비활성 무관" 으로 갱신. `usageKind` 필드 도입도 INT-US-01a 등 하위 요구사항으로 명시.

---

### [INFO] spec/2-navigation/4-integration.md §7.2 삭제 차단 다이얼로그 — MCP 참조 노드의 UI 표시 방식 미정의

- **target 위치**: `spec/2-navigation/4-integration.md` §7.2 삭제 차단 다이얼로그 (목업 텍스트)
- **충돌 대상**: `codebase/frontend/src/app/(main)/integrations/[id]/page.tsx` (구현 완료)
- **상세**:
  - §7.2 의 목업 다이얼로그는 "This integration is still referenced by the following nodes:" 목록을 단순 노드 이름으로만 표시한다.
  - 구현 프론트엔드는 `n.usageKind === "mcp"` 인 경우 노드 label 옆에 "MCP" 뱃지를 함께 렌더링한다 (`usageMcpBadge` i18n 키).
  - 삭제 차단 다이얼로그 자체와 사용처 탭 노드 목록 모두 동일 API 응답(`/api/integrations/:id/usages`)을 소비하므로 MCP 뱃지는 양쪽에 모두 노출된다.
  - spec 이 MCP 뱃지 렌더링을 명시하지 않아 §7.2 UI 다이얼로그와 구현 사이 사소한 gap 이 있다.
- **제안**: spec §7.2 다이얼로그 목업에 MCP 참조 노드의 표시 방식("MCP 뱃지") 을 추가. 또는 `§4.3 사용처 탭` 과 함께 "MCP 뱃지 렌더링 공통 규칙" 항목 신설.

---

### [INFO] spec/4-nodes/4-integration/_product-overview.md INT-US-02 — 삭제 차단 트리거 조건이 직접 참조에만 언급됨

- **target 위치**: `spec/4-nodes/4-integration/_product-overview.md` §2.4 INT-US-02
- **충돌 대상**: `codebase/backend/src/modules/integrations/integrations.service.ts` remove() 메서드 (구현 완료)
- **상세**:
  - INT-US-02: "사용처가 존재하는 연동은 삭제 차단 — 사용 중 노드 목록을 표시하고 …" — 사용처의 정의가 INT-US-01 과 연동되므로 INT-US-01 이 직접 참조만 명시한 상태에서 INT-US-02 도 MCP 참조 차단을 묵시적으로 누락하게 된다.
  - 구현 `remove()` 는 getUsages() 가 반환하는 전체(직접 + MCP) 사용처를 기반으로 409 를 반환하므로 MCP-only 참조 시에도 삭제를 차단한다.
- **제안**: INT-US-01 수정과 연동하여 INT-US-02 도 "직접 또는 MCP 참조" 를 포함하도록 갱신.

---

## 요약

PR #633 구현(직접 참조 ∪ MCP 참조 합집합 + `usageKind` 필드 도입)은 내부적으로 일관성이 있고 테스트 커버리지도 갖춰져 있다. Cross-Spec 관점에서 실질적 모순은 없으며, 발견된 사항은 모두 **구현이 앞서 나간 spec-drift** — 코드가 옳고 spec 이 낡아 있다. 주요 갱신 대상은 `spec/2-navigation/4-integration.md §7.1` (사용처 조회 조건 + nodes shape + MCP 차단 명시)과 `spec/4-nodes/4-integration/_product-overview.md §2.4 INT-US-01·INT-US-02` (요구사항 표현 확장)이며, 이는 project-planner 후속 작업으로 추적 중이다. 데이터 모델, API endpoint/method, 요구사항 ID 충돌, 상태 전이 충돌, RBAC/권한 충돌, 계층 책임 충돌은 발견되지 않았다.

## 위험도

LOW

STATUS: DONE
