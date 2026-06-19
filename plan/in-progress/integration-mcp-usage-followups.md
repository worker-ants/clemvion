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

## ⑤ `node.config` GIN 인덱스 추가 — ✅ 완료 (PR #633 후속 ⑤⑦, branch `claude/agent-ab5333a68e686d2b1`)

- **상태**: V099 마이그레이션 추가 완료. `codebase/backend/migrations/V099__node_config_gin_index.sql` +
  동봉 `V099__node_config_gin_index.conf` (`executeInTransaction=false`). 두 인덱스를 함께 둔다 —
  ai-review database-reviewer WARNING(jsonb_path_ops 는 `@>` 전용이라 `->>` 등치 미가속)을 반영해
  직접참조용 expression B-tree 를 추가했다:
  - `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_node_config_gin ON node USING GIN (config jsonb_path_ops)` — MCP 참조 `@>` containment.
  - `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_node_config_integration_id ON node ((config ->> 'integrationId'))` — 직접참조 등치.
  헤더 주석은 V095 스타일. e2e (`make e2e-test`) 로 2-index 마이그레이션이 Flyway 로 정상 적용됨을 확인.
- **출처**: database-reviewer WARNING (LOW→ai-review 시 MEDIUM 으로 재평가, fix 반영).
- **판단**: 기존 `->>` 직접참조 조회도 동일하게 seq scan 이었으므로 인덱스 추가가 **성능 회귀를 일으키지 않는다**. 관리 UI 조회 경로라 빈도는 낮으나 노드 수 증가에 대비해 두 브랜치 모두 인덱스로 보호한다.

## ⑥ 삭제 차단 다이얼로그 프론트 미구현 ✅ (구현 완료 — PR #635)

- **출처**: requirement-reviewer MEDIUM.
- **현황**: spec §4.7 / §7.2 는 통합 삭제가 차단될 때 **사용처 목록 다이얼로그 + MCP 배지** 표시를 요구한다. 그러나 현재 프론트(`page.tsx` 의 삭제 `onError`)는 **toast 만** 표시한다 — 사용처 목록을 보여주지 않는다. (이번 PR 이 만든 갭이 아니라 **기존부터 존재한 갭**이며, 이번 PR 은 백엔드 usageKind 산출과 UsageTab 배지까지만 다뤘다.)
- **후속 작업**: DangerTab(삭제 영역)에서 `GET /api/integrations/:id/usages` 사전 조회 → 차단 시 사용처 목록 다이얼로그 렌더 + 각 노드의 `usageKind` 배지('direct'/'mcp') 표시. UsageTab 의 기존 배지 컴포넌트·i18n 키 재사용.
- **완료 (PR #635)**: DangerTab 삭제 흐름을 사전 `GET /usages` 조회 → 사용처 ≥ 1건이면 차단 다이얼로그(`delete-blocked-dialog.tsx`), 0건이면 DELETE 진행으로 개선. UsageTab 과 차단 다이얼로그가 공유하는 워크플로우-노드+MCP 배지 렌더를 `usage-node-list.tsx` 공용 컴포넌트로 추출. 409 `INTEGRATION_IN_USE`(usages body 포함) race fallback 으로 동일 다이얼로그 노출, body 없으면 기존 toast 유지. i18n ko/en parity 추가(`usageOpenWorkflow`/`deleteBlocked*`). RTL 테스트 4건(`__tests__/danger-tab.test.tsx`).

## ⑦ `remove()` 이중 `findById` — ✅ 완료 (PR #633 후속 ⑤⑦, branch `claude/agent-ab5333a68e686d2b1`)

- **상태**: 사용처 조회 부분을 존재검증 없는 private `queryUsageNodes(id, workspaceId)` 로 추출. 공개
  `getUsages` 는 `findById` 선검증 + 헬퍼 호출(컨트롤러 계약·NotFound 유지). `remove()` 는 이미 findOne
  으로 검증했으므로 `queryUsageNodes` 를 직접 호출 → 통합 행 중복 조회 제거. 단위테스트에 "remove 가
  integration 행을 1회만 조회" 회귀 가드 추가 (`integrations.service.spec.ts`, 총 121 PASS).
- **출처**: side-effect-reviewer WARNING (LOW perf).
- **현황**: `remove()` 가 `integrationRepository.findOne` 으로 엔티티를 조회한 뒤, 다시 `getUsages()` 를 호출하는데 `getUsages()` 내부도 `findById()` 로 동일 통합 행을 조회한다 → **통합 행 2회 조회**.
- **판단**: 정확성 문제는 없고 추가 1쿼리의 미미한 perf 이슈다.
- **후속 작업**: `getUsages()` 에 통합 존재검증 skip 옵션을 추가하거나, 사용처 조회 SQL 부분을 private 헬퍼로 인라인 분리해 `remove()` 가 검증을 중복하지 않도록 한다. 외부 API 계약(컨트롤러가 호출하는 `getUsages`)은 유지.
