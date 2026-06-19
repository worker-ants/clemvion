# Rationale 연속성 검토 결과

검토 모드: `--impl-done`
Scope: `spec/2-navigation/4-integration.md`
Diff base: `origin/main`
PR: #633 (delta: 주석 + 구현 보강, spec 문서 변경 없음)

---

## 발견사항

발견된 CRITICAL 건: 0건.

### [INFO] `direct` 우선 규칙의 구현 계층 적용 범위 명세 보완 여지

- **target 위치**: `codebase/backend/src/modules/integrations/integrations.service.ts` — SQL `CASE WHEN n.config ->> 'integrationId' = :integrationId THEN 'direct' ELSE 'mcp' END` + `integrations.service.spec.ts` 테스트 주석 "한 노드가 양쪽 매칭 시 SQL 이 단일 raw row 를 usage_kind='direct' 로 반환"
- **과거 결정 출처**: `spec/2-navigation/4-integration.md § Rationale — 사용처 추적 — AI Agent MCP 참조 포함` ("두 경로는 노드 타입상 실질 배타적이라 한 노드가 양쪽에 잡히는 경우는 없으나, 방어적으로 `direct` 우선 규칙을 둔다")
- **상세**: spec Rationale 는 `direct` 우선을 "방어적(defensive)" 규칙으로 명시하고 있으며, 구현도 SQL CASE 로 동일하게 적용. 다만 spec §7.1 은 `direct` 우선의 주체가 SQL CASE 임을 명시적으로 기재하지 않는다. 테스트 주석(`integrations.service.spec.ts` line 213)은 "CASE 식 자체의 실 DB 검증은 e2e 가 담당"이라고 책임 분리를 잘 기술하고 있고, e2e(`integration-usage-mcp.e2e-spec.ts` test C)가 실 PostgreSQL 에서 중복 미노출과 `direct` 우선을 검증한다. 이는 Rationale 와 완전 정합.
- **제안**: 현 상태로 충분하나, spec §7.1 에 "우선 판정은 SQL CASE 식으로 구현된다" 한 줄 추가하면 구현 근거 추적이 더 명확해진다 (필수 아님).

---

## 종합 평가

PR #633 의 delta 는 세 영역에 걸친다: (1) `IntegrationUsageNodeDto` 에 `usageKind` 필드 추가 및 `IntegrationUsageItemDto` 에 `isActive` 추가, (2) `IntegrationsService` 쿼리를 `Brackets` OR 절 + CASE SELECT 로 확장, (3) 단위 테스트 및 신규 e2e(`integration-usage-mcp.e2e-spec.ts`) 추가. 이 변경들은 `spec/2-navigation/4-integration.md` 의 Rationale 섹션 "사용처 추적 — AI Agent MCP 참조 포함" 이 채택 결정과 근거를 명시하고 있고, 구현은 그 결정을 충실히 따른다. 기각된 대안(단일 `integrationId` 경로만 스캔, per-node task queue, multi-select 칩 등)을 재도입한 흔적이 없으며, 합의된 invariant(`direct` 우선 규칙, JSONB `@>` containment, `usageKind: 'direct'|'mcp'` 이분 분류, `isActive` workflow 활성 여부 포함)를 모두 준수한다. 결정 번복 없이 새 Rationale 를 동반한 기능 확장이므로 연속성 위반 사항은 없다.

---

## 위험도

NONE

STATUS: DONE (CRITICAL 0건)
