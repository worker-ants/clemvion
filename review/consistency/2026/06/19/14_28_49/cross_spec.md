# Cross-Spec 일관성 검토 결과

검토 모드: --impl-done (구현 완료 후, 재확인)
대상 scope: `spec/2-navigation/4-integration.md`
diff-base: origin/main
검토 일시: 2026-06-19
이전 검토 대비 delta: JSDoc/comment 전용 (`IntegrationUsageNodeDto.id/.label/.type` 한국어 JSDoc 추가 + e2e 주석 spec 경로 정정). 런타임·spec-impl 의미 변화 없음.

---

## 발견사항

### [WARNING] spec/2-navigation/4-integration.md §7.1 — 사용처 조회 로직이 MCP 참조 경로를 미반영 (spec-drift, 코드가 옳음)

- **target 위치**: `spec/2-navigation/4-integration.md` §7.1 (사용처 조회 로직)
- **충돌 대상**: `codebase/backend/src/modules/integrations/integrations.service.ts`
- **상세**:
  - spec §7.1 원문의 조회 조건은 `config->>'integrationId' = :id` 단일 경로만 기술한다. 그러나 구현 코드는 `Brackets(qb => qb.where(...integrationId...).orWhere("n.config -> 'mcpServers' @> :mcpProbe::jsonb"))` 로 직접 참조(config.integrationId) 와 MCP 참조(config.mcpServers[].integrationId) 를 합집합 처리한다.
  - 결과 shape 도 spec 은 `nodes: [{ id, label, type }]` 만 정의하는 반면, 구현은 `nodes: [{ id, label, type, usageKind: 'direct' | 'mcp' }]` 를 반환한다.
  - 다만 spec §7 Rationale 및 §14.2, Cafe24/MakeShop 섹션은 통합이 `mcpServers` 에서도 사용됨을 이미 명시하고 있어 이미 내부 맥락상 합집합이 의도된 동작임이 드러난다. 두 영역 간 직접 모순(작동 불가 수준)은 아니며 spec 표현이 구현보다 낡은 spec-drift 다.
  - 이전 검토(14_18_26) 에서 이미 식별된 항목이며, 금번 delta(주석만)로 상황 변동 없음.
- **제안**: project-planner 후속 작업. `spec/2-navigation/4-integration.md §7.1` 을 다음과 같이 갱신:
  1. 조회 조건: `config->>'integrationId' = :id` OR `config->'mcpServers' @> '[{"integrationId":"<id>"}]'::jsonb`
  2. nodes shape: `{ id, label, type, usageKind: 'direct' | 'mcp' }` 로 확장, `usageKind` 는 CASE 식으로 결정, 동시 매칭 시 `direct` 우선 명시
  3. 삭제 차단: MCP-only 참조에도 동일하게 409 차단됨을 명시

---

### [WARNING] spec/4-nodes/4-integration/_product-overview.md §2.4 INT-US-01 — 요구사항 표현이 직접 참조만 언급 (spec-drift, 코드가 옳음)

- **target 위치**: `spec/4-nodes/4-integration/_product-overview.md` §2.4 INT-US-01
- **충돌 대상**: `codebase/backend/src/modules/integrations/integrations.service.ts` + `codebase/backend/test/integration-usage-mcp.e2e-spec.ts`
- **상세**:
  - INT-US-01: "연동을 사용 중인 워크플로우·노드를 추적 (**노드 `config.integrationId` 참조 기준**, 활성/비활성 무관)"
  - 구현은 `config.integrationId`(직접) 와 `config.mcpServers[].integrationId`(MCP) 합집합을 추적하며, e2e 테스트가 이를 실 PostgreSQL `@>` containment 로 검증한다.
  - "config.integrationId 참조 기준" 문구가 MCP 경로를 의도적으로 배제한 것으로 오인될 수 있다.
  - 이전 검토(14_18_26) 에서 이미 식별된 항목. 금번 delta(주석만)로 변동 없음.
- **제안**: INT-US-01 표현을 "노드 `config.integrationId` 직접 참조 **또는** AI Agent 노드의 `config.mcpServers[].integrationId` MCP 참조 기준, 활성/비활성 무관" 으로 갱신. `usageKind` 필드 도입을 INT-US-01a 하위 요구사항으로 명시.

---

### [INFO] spec/2-navigation/4-integration.md §7.2 삭제 차단 다이얼로그 — MCP 뱃지 UI 렌더링 미정의

- **target 위치**: `spec/2-navigation/4-integration.md` §7.2 삭제 차단 다이얼로그 목업
- **충돌 대상**: `codebase/frontend/src/app/(main)/integrations/[id]/page.tsx`
- **상세**:
  - §7.2 목업은 노드 목록을 단순 이름으로만 표시한다.
  - 구현은 `usageKind === "mcp"` 인 노드에 `MCP` 뱃지를 렌더링하며, i18n 키 `usageMcpBadge` 가 `en`/`ko` 양쪽에 추가됐다.
  - 사용처 탭과 삭제 다이얼로그가 동일 API 응답(`/api/integrations/:id/usages`)을 소비하므로 MCP 뱃지는 두 곳 모두에서 노출된다.
  - 심각도 INFO: 구현 누락이 아니라 spec 기술 누락이며 동작에 영향 없음.
- **제안**: §7.2 다이얼로그 목업에 "MCP 참조 노드는 라벨 옆에 `MCP` 배지 표시" 규칙 추가. §4.3 사용처 탭과 공통 규칙으로 통합 정리 가능.

---

### [INFO] spec/4-nodes/4-integration/_product-overview.md INT-US-02 — 삭제 차단 범위가 INT-US-01 에 종속되어 MCP 암묵적 누락

- **target 위치**: `spec/4-nodes/4-integration/_product-overview.md` §2.4 INT-US-02
- **충돌 대상**: `codebase/backend/src/modules/integrations/integrations.service.ts` remove() 메서드
- **상세**:
  - INT-US-02: "사용처가 존재하는 연동은 삭제 차단" — 사용처 정의가 INT-US-01 에서 파생되므로 INT-US-01 이 직접 참조만 명시하면 INT-US-02 도 MCP 참조 차단을 묵시적으로 누락하는 것처럼 읽힌다.
  - 구현 `remove()` 는 getUsages() 전체(직접 + MCP) 결과를 기준으로 409 를 반환하므로 MCP-only 시에도 삭제 차단이 올바르게 동작한다.
  - e2e 테스트(test B)가 MCP-only 참조 → 409 INTEGRATION_IN_USE 를 실 PG 로 검증한다.
  - 심각도 INFO: INT-US-01 갱신 시 자동으로 해소될 연쇄 표현 이슈.
- **제안**: INT-US-01 갱신 시 INT-US-02 도 "직접 또는 MCP 참조 기준" 으로 연동 갱신.

---

## 요약

PR #633 의 금번 재확인(delta: JSDoc/comment only) 은 이전 검토(14_18_26) 의 결론을 그대로 확인한다. 런타임 동작·spec-impl 의미 변화가 없으므로 새 충돌은 발생하지 않았다. 기존 WARNING 2건(§7.1 사용처 조회 조건 + nodes shape, INT-US-01 요구사항 표현)과 INFO 2건(§7.2 MCP 뱃지 UI 미기술, INT-US-02 연쇄 표현)은 모두 **구현이 앞서 나간 spec-drift** 로 코드가 올바르고 spec 이 낡아 있다. 두 영역이 직접 모순(작동 불가)인 CRITICAL 은 없으며, 데이터 모델 충돌·API endpoint/method 충돌·요구사항 ID 충돌·상태 전이 충돌·RBAC 충돌·계층 책임 충돌도 발견되지 않았다. WARNING 항목의 spec 갱신은 project-planner 후속 과제로 추적 중이다.

## 위험도

LOW

STATUS: DONE
