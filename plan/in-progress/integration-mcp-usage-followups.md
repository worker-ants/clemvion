---
worktree: (unstarted)
started: 2026-06-19
owner: developer
status: pending
created: 2026-06-19
---

# 통합(Integration) MCP 사용처 추적 — ai-review 후속 항목

> 작성일: 2026-06-19
> 선행 PR: `claude/agent-ae9a373e25190d9f9` (PR #633) — getUsages 직접참조 ∪ MCP참조 합집합 + usageKind('direct'|'mcp'), 프론트 UsageTab MCP 배지, remove() MCP 차단, 단위테스트 + 실 PG e2e.
> 관련 spec: `spec/4-nodes/4-integration` §4.7 / §7.1 / §7.2.
> 리뷰 출처: `review/code/2026/06/19/` SUMMARY/RESOLUTION.

이 문서는 PR #633 의 `/ai-review`(6 reviewer, Critical 0) 에서 발견됐으나 **이번 PR 범위에서 제외(defer)** 하기로 한 3건을 근거와 함께 추적한다. 각 항목은 별도 작업 단위로 진행한다.

## ⑤ `node.config` GIN 인덱스 추가

- **출처**: database-reviewer WARNING (LOW).
- **현황**: `getUsages` 는 `n.config ->> 'integrationId'`(직접) 과 `n.config -> 'mcpServers' @> :mcpProbe::jsonb`(MCP) 로 `node` 를 조회한다. 두 조건 모두 인덱스가 없어 seq scan 이다.
- **판단**: 기존 `->>` 직접참조 조회도 동일하게 seq scan 이었으므로 이번 변경이 **성능 회귀를 일으키지 않는다**. 또한 이 쿼리는 통합 삭제 전 사용처 확인 등 **관리 UI 조회 경로**라 호출 빈도가 낮고 노드 수도 소규모다. 따라서 차단 사유가 아니다.
- **후속 작업**: 노드 수 증가에 대비해 GIN 인덱스 추가를 권장.
  ```sql
  CREATE INDEX CONCURRENTLY idx_node_config_gin ON node USING GIN (config jsonb_path_ops);
  ```
  마이그레이션은 `CONCURRENTLY` 라 트랜잭션 밖에서 실행해야 한다(TypeORM 마이그레이션 작성 시 주의). `jsonb_path_ops` 는 `@>` containment 에 최적이며, 직접참조의 `->>'integrationId' = ...` 등치 조건에는 부분 도움 정도다(필요 시 별도 expression index 검토).

## ⑥ 삭제 차단 다이얼로그 프론트 미구현 ✅ (구현 완료 — PR #635)

- **출처**: requirement-reviewer MEDIUM.
- **현황**: spec §4.7 / §7.2 는 통합 삭제가 차단될 때 **사용처 목록 다이얼로그 + MCP 배지** 표시를 요구한다. 그러나 현재 프론트(`page.tsx` 의 삭제 `onError`)는 **toast 만** 표시한다 — 사용처 목록을 보여주지 않는다. (이번 PR 이 만든 갭이 아니라 **기존부터 존재한 갭**이며, 이번 PR 은 백엔드 usageKind 산출과 UsageTab 배지까지만 다뤘다.)
- **후속 작업**: DangerTab(삭제 영역)에서 `GET /api/integrations/:id/usages` 사전 조회 → 차단 시 사용처 목록 다이얼로그 렌더 + 각 노드의 `usageKind` 배지('direct'/'mcp') 표시. UsageTab 의 기존 배지 컴포넌트·i18n 키 재사용.
- **완료 (PR #635)**: DangerTab 삭제 흐름을 사전 `GET /usages` 조회 → 사용처 ≥ 1건이면 차단 다이얼로그(`delete-blocked-dialog.tsx`), 0건이면 DELETE 진행으로 개선. UsageTab 과 차단 다이얼로그가 공유하는 워크플로우-노드+MCP 배지 렌더를 `usage-node-list.tsx` 공용 컴포넌트로 추출. 409 `INTEGRATION_IN_USE`(usages body 포함) race fallback 으로 동일 다이얼로그 노출, body 없으면 기존 toast 유지. i18n ko/en parity 추가(`usageOpenWorkflow`/`deleteBlocked*`). RTL 테스트 4건(`__tests__/danger-tab.test.tsx`).

## ⑦ `remove()` 이중 `findById`

- **출처**: side-effect-reviewer WARNING (LOW perf).
- **현황**: `remove()` 가 `integrationRepository.findOne` 으로 엔티티를 조회한 뒤, 다시 `getUsages()` 를 호출하는데 `getUsages()` 내부도 `findById()` 로 동일 통합 행을 조회한다 → **통합 행 2회 조회**.
- **판단**: 정확성 문제는 없고 추가 1쿼리의 미미한 perf 이슈다.
- **후속 작업**: `getUsages()` 에 통합 존재검증 skip 옵션을 추가하거나, 사용처 조회 SQL 부분을 private 헬퍼로 인라인 분리해 `remove()` 가 검증을 중복하지 않도록 한다. 외부 API 계약(컨트롤러가 호출하는 `getUsages`)은 유지.
