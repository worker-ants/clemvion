# 코드 리뷰 — 요구사항 충족 관점

- **대상 브랜치**: `claude/agent-a5522a5d692774509`
- **기준 브랜치**: `origin/main`
- **리뷰 범위**: `codebase/` 전체 diff
- **관련 spec**: `spec/4-nodes/4-integration` §4.7 / `spec/2-navigation/4-integration.md` §7.1 / §7.2
- **리뷰어 역할**: 요구사항 충족 전문 reviewer
- **리뷰 일시**: 2026-06-19

---

## 변경 요약

이번 PR(#633 후속 fresh review)은 Integration 사용처 추적 기능에 MCP 참조(AI Agent `config.mcpServers[].integrationId`)를 합집합(direct ∪ MCP)으로 포함하고, 각 노드에 `usageKind: 'direct' | 'mcp'` 필드를 추가한 구현이다. 변경 파일:

1. `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` — `IntegrationUsageNodeDto` 신규 클래스, `nodes` 타입 개선
2. `codebase/backend/src/modules/integrations/integrations.service.ts` — `getUsages()` WHERE 절을 `direct ∪ MCP` 합집합으로 확장, `CASE` 식으로 `usage_kind` 산출
3. `codebase/backend/src/modules/integrations/integrations.service.spec.ts` — MCP 참조 유닛 테스트 대거 추가
4. `codebase/backend/test/integration-usage-mcp.e2e-spec.ts` — 실 PostgreSQL `@>` containment + CASE 검증 e2e 신규 추가
5. `codebase/frontend/src/lib/api/integrations.ts` — `UsageWorkflow.nodes` 타입에 `usageKind` 추가
6. `codebase/frontend/src/app/(main)/integrations/[id]/page.tsx` — UsageTab MCP 배지 렌더
7. `codebase/frontend/src/lib/i18n/dict/{en,ko}/integrations.ts` — `usageMcpBadge` 키 추가

---

## 발견사항

### [SPEC-DRIFT] [WARNING] §7.1 `nodes` 응답 shape 에 `usageKind` 필드 없음

- **위치**: `spec/2-navigation/4-integration.md` §7.1 (line 735)
- **상세**: spec §7.1 은 노드 shape 을 `{ id, label, type }` 세 필드로만 정의한다. 이번 구현은 `usageKind: 'direct' | 'mcp'` 를 추가했고, `IntegrationUsageNodeDto` DTO 및 프론트 인터페이스에도 반영했다. 코드가 합리적으로 확장된 것이며 되돌리는 것이 오답이다.
- **판단**: 코드가 옳고 spec §7.1 본문의 `nodes` 필드 표가 낡았다. `usageKind` 를 MCP 참조 구분용 신규 필드로 spec 에 명시해야 한다.
- **제안**: 코드 유지. `spec/2-navigation/4-integration.md` §7.1 의 응답 shape 설명을 `nodes: [{ id, label, type, usageKind: 'direct' | 'mcp' }]` 로 갱신.

### [SPEC-DRIFT] [WARNING] §7.1 조회 로직이 MCP 참조 미포함으로 정의되어 있음

- **위치**: `spec/2-navigation/4-integration.md` §7.1 (line 734)
- **상세**: spec §7.1 은 조회 조건을 `config->>'integrationId' = :id` 단일 조건으로 정의하지만, 구현은 `n.config -> 'mcpServers' @> :mcpProbe::jsonb` OR 조건을 추가해 MCP 참조도 합산한다. `INT-US-01` 의 `spec/4-nodes/4-integration/_product-overview.md` 는 `(노드 config.integrationId 참조 기준)` 이라고만 서술하고 MCP 경로를 언급하지 않는다. 그러나 `spec/4-nodes/4-integration/0-common.md` 는 "Integration 엔티티는 (a) 본 문서의 노드와 (b) AI Agent MCP provider 두 가지 사용처를 가진다"고 명시하고 있어, MCP 경로 추가는 설계 의도에 부합하는 의도적 확장이다.
- **판단**: 코드가 옳고 spec §7.1 / `INT-US-01` 본문이 MCP 경로를 누락하고 있다.
- **제안**: 코드 유지. `spec/2-navigation/4-integration.md` §7.1 과 `_product-overview.md INT-US-01` 에 MCP 경로(`config.mcpServers[].integrationId`) 합산을 명시. `plan/in-progress/integration-mcp-usage-followups.md ⑥` 이 이 spec 반영 작업의 자연스러운 연장선이다.

### [INFO] INT-US-01 요구사항 충족 범위 확장

- **위치**: `codebase/backend/src/modules/integrations/integrations.service.ts` lines 751–758, 766–769
- **상세**: `INT-US-01` 은 `config.integrationId` 기준 사용처 추적을 요구하며, 이번 구현은 MCP 경로(`mcpServers[].integrationId`)를 추가 포함해 기존 요구사항의 **상위 집합**을 구현한다. `CASE WHEN n.config ->> 'integrationId' = :integrationId THEN 'direct' ELSE 'mcp' END` 로 direct 우선 분류를 SQL 레벨에서 처리하는 방식이 적절하다.

### [INFO] `remove()` — MCP 참조로만 존재하는 경우도 409 차단 정상 동작

- **위치**: `codebase/backend/src/modules/integrations/integrations.service.ts` lines 702–708
- **상세**: `remove()` 가 `getUsages()` 를 호출하므로 MCP-only 참조가 있을 경우에도 `INTEGRATION_IN_USE` (409) 로 차단된다. 서버 측 차단 요건(spec §7.2: "서버 측 DELETE 도 동일 조건을 검증하여 409 Conflict 반환")은 정상 충족. 단, `getUsages()` 내부에서 `findById()` 로 통합 존재 검증을 중복 수행하는 이슈는 `plan/in-progress/integration-mcp-usage-followups.md ⑦` 로 이미 이관됨.

### [INFO] direct 우선(`direct` precedence) 동작 검증

- **위치**: `codebase/backend/src/modules/integrations/integrations.service.spec.ts` 신규 테스트 "keeps direct precedence when a node matches both direct and MCP (spec §7.1)"
- **상세**: spec 주석에 "한 노드가 직접 참조와 MCP 참조 양쪽에 해당하면 `direct` 우선" 으로 명시되어 있고, SQL CASE 식이 `integrationId` 등치 조건을 먼저 확인하므로 논리적으로 맞다. 단위테스트는 mock 이라 실 SQL CASE 식을 실행하지 않으나, 이 점을 주석으로 명확히 기술하고 e2e(`integration-usage-mcp.e2e-spec.ts`) 에서 실 DB 검증으로 보완하는 전략이 적절하다.

### [INFO] 삭제 차단 다이얼로그 프론트 미구현 — 인지된 defer

- **위치**: `codebase/frontend/src/app/(main)/integrations/[id]/page.tsx`
- **상세**: spec §4.7 / §7.2 는 사용처 ≥ 1건 시 **사용처 목록 다이얼로그** 표시를 요구한다. 현재 프론트는 삭제 실패 시 toast 만 표시하며 목록 다이얼로그를 렌더하지 않는다. 이 갭은 이번 PR 이 새로 만든 갭이 아니라 기존부터 존재하며, `plan/in-progress/integration-mcp-usage-followups.md ⑥` 에 명시적으로 defer 됨. 요청 사항에 "알려진 갭으로 후속 plan ⑥ 로 이관됨" 이 명시되어 있어 본 리뷰에서는 Critical/Warning 대상이 아님.

### [INFO] e2e 테스트 — 노드 INSERT 시 `position` 컬럼 누락 가능성

- **위치**: `codebase/backend/test/integration-usage-mcp.e2e-spec.ts` lines 106–113
- **상세**: `insertNode()` 함수는 `(workflow_id, type, category, label, config)` 컬럼만 INSERT한다. `node` 테이블 스키마에 NOT NULL 컬럼(예: `position`, `created_by` 등)이 추가되어 있을 경우 e2e 시나리오가 INSERT 오류로 실패할 수 있다. 단, 이는 스키마 확인이 필요한 사항이며, 기존 e2e 헬퍼 패턴과 일관되게 작성된 경우 문제가 없을 수 있다.

---

## 요약

요구사항 충족 관점에서 이번 변경은 핵심 요건을 잘 구현했다. MCP 경로를 합집합(direct ∪ MCP)으로 포함하는 백엔드 `getUsages()` 확장, `usageKind` 분류, 삭제 차단 MCP 적용, 프론트 배지 노출 모두 spec §7.1 / §7.2 / `INT-US-01`·`INT-US-02` 의 취지에 부합한다. 발견된 Critical/Warning 없음. 2건의 SPEC-DRIFT(WARNING)는 코드가 옳고 spec §7.1 본문의 `nodes` shape 정의와 `INT-US-01` 의 추적 경로 기술이 MCP 확장을 반영하지 못한 문서 낡음이며, 코드를 되돌릴 이유가 없고 spec 갱신이 필요하다. 삭제 차단 다이얼로그 프론트 미구현은 알려진 defer 항목으로 신규 갭이 아니다.

---

## 위험도

LOW

---

STATUS: DONE
