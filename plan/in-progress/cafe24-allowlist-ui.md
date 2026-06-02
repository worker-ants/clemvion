---
worktree: cafe24-allowlist-ui
started: 2026-06-02
owner: developer
type: implementation
parent: plan/in-progress/cafe24-restricted-scopes-followups.md (§1)
---

# §1 — AI Agent allowlist UI advanced surface (operation grouping + ⚠ 별도 승인)

## 출처

`cafe24-restricted-scopes-followups.md §1` + spec/4-nodes/4-integration/4-cafe24.md §8.3.
사용자 결정 (2026-06-02): 지금 도입.

현재 `mcp-server-selector.tsx` 는 server(Integration) 단위 picker 만 제공 — cafe24 server 의
operation 단위 enabledTools 편집 UI 가 없음. 본 작업이 그 advanced surface 를 신설.

## spec §8.3 요구

- AI Agent config `mcpServers[i].enabledTools` = bare operation id 배열 (`['product_list', ...]`).
  undefined/absent = 전부 허용(default_true, mcp-client §5.6).
- 카테고리(resource) 단위 grouping UI.
- **별도 승인 ⚠**: scope 전체 restricted 카테고리(mileage/notification/privacy → `restrictedApproval.level==='scope'`)
  는 **그룹 헤더 ⚠**; operation 단위 restricted(store 안 paymentgateway_*/menus_get/activitylogs_* 등
  `level==='operation'`(+`program`)) 는 **operation 행 ⚠**. 차단 없음 — 안내만.
- backend 메타데이터(`operationsByResource[r][].restrictedApproval`)는 이미 노출 (getNodeDefinition).

## 이미 준비된 것 (재사용)

- backend `restrictedApproval` (level: scope|operation|program) — `getNodeDefinition("cafe24").extras.operationsByResource`.
- `ApprovalRequiredBadge` 컴포넌트 + i18n (`integrations.approvalRequiredBadge` 등).
- 라벨: `cafe24Catalog` ko/en dict (`resolveCafe24OperationLabel` 패턴, 3줄 — 복제).
- 기존 ⚠ 렌더 패턴: cafe24 노드 Operation 드롭다운(integration-configs.tsx), scope-tab.

## 구현 — 완료

- [x] `lib/node-definitions/cafe24-extras.ts` 공유 헬퍼 추출 (`readCafe24Extras`·`resolveCafe24OperationLabel`), integration-configs 가 import 로 전환 (INFO #6/#7).
- [x] `components/integrations/cafe24-allowlist-editor.tsx` 신설 (resource grouping + scope→헤더 ⚠ / operation·program→행 ⚠ + default_true materialize).
- [x] `mcp-server-selector.tsx`: cafe24 server expandable "Operations allowlist" 섹션 연동.
- [x] i18n 신규 3키 (cafe24AllowlistTitle/Hint/Loading) ko/en.
- [x] 테스트 6 케이스 (default_true·⚠ 렌더·op 토글·카테고리 토글·명시 enabledTools·loading). cafe24-config·catalog-sync 회귀 통과.

### (원 계획 메모)

- [ ] `components/integrations/cafe24-allowlist-editor.tsx` 신설:
  - props: `enabledTools?: string[]`, `onChange(enabledTools: string[])`, `locale`, `t`.
  - `readCafe24Extras()` 로 operationsByResource 획득 (없으면 loading placeholder).
  - resource 카테고리 그룹: 헤더 체크박스(카테고리 전체 토글) + 라벨 + 카테고리 scope-restricted 면 ⚠.
  - operation 행: 체크박스(enabledTools 토글) + 라벨 + op 가 operation/program-restricted 면 ⚠.
  - default_true: `enabledTools ? includes(id) : true`. 첫 편집 시 전체 id 로 materialize 후 토글.
- [ ] `mcp-server-selector.tsx`: cafe24 server(`serviceType==='cafe24'`) 에 expandable "Operations allowlist"
  섹션 추가 — 펼치면 Cafe24AllowlistEditor 렌더, enabledTools patch 연동.
- [ ] i18n: 신규 키 최소화 (섹션 제목 등 ko/en parity). 가능하면 기존 키 재사용.
- [ ] 테스트: cafe24-allowlist-editor 단위 테스트 (default_true 토글·카테고리 토글·scope vs operation ⚠ 렌더).

## consistency-check 확정 (review/consistency/2026/06/02/10_09_21)

- **Critical #1 (4-cafe24.md 동시 편집 경합 vs PR #415) → 해소**: §1 은 **spec 을 편집하지 않는다.**
  §8.3 은 이미 완전히 명세돼 있고 §1 은 그 **순수 frontend 구현**이다 (cafe24-allowlist-editor + mcp-server-selector
  + i18n). 4-cafe24.md 를 건드리지 않으므로 PR #415(§9.8) 와 merge conflict 가 발생하지 않는다 → Critical 전제 제거.
- **INFO #4 materialize 정책 (결정)**: `enabledTools === undefined` = **전부 허용(향후 추가 operation 포함)**.
  사용자가 처음 토글하면 전체 id 로 materialize 후 해당 id 제거 → 이후로는 **명시 allowlist**(신규 operation 자동
  미포함, "내가 고른 것만" 의미). default_true(mcp-client §5.6)와 일관. 코드 주석에 명시.
- **INFO #5 level='program' (결정)**: operation-level 과 동일하게 **행 ⚠** 적용 (`level !== 'scope'` → 행 ⚠).
- **INFO #6·#7 (헬퍼)**: `readCafe24Extras()` · `resolveCafe24OperationLabel()` 를 비공개에서
  `src/lib/node-definitions/cafe24-extras.ts` 공유 헬퍼로 추출, integration-configs 도 그걸 import (drift 방지).
- **WARNING (무관)**: Integration "3종" 카운트·send_email/database_query 포트 수·§4 spread·meta.callLimit 은
  모두 §1 무관 기존 spec 이슈 → 별도 project-planner 정리 (SUMMARY 기재).

## 단계 체크리스트

- [x] 3. consistency-check --impl-prep (BLOCK:YES → spec 미편집으로 Critical 해소, 위 확정)
- [x] 4. DOCUMENTATION (spec §8.3 이미 명세 — spec 미편집. i18n ko/en parity. partial surface 없음)
- [x] 5-7. TDD + 구현 (위 구현 — 완료)
- [x] 8. TEST WORKFLOW — lint·unit·build·e2e(140) PASS
- [x] 9. REVIEW WORKFLOW — /ai-review(MEDIUM, Critical 0) → 수동 fix(W1 onChange 타입·W2 '*'·W3/4/5/6 테스트·INFO 3/9/10/12/19/20) + RESOLUTION.md. W8(기존 하드코딩 i18n)·OCP 등 보류. 재테스트 PASS.
- [x] 10. plan complete — git mv to plan/complete/. restricted-scopes-followups.md §1 갱신.

## 비목표

- enabledTools 외 advanced(toolOverrides/per-tool description) 편집 — 별 surface.
- 차단 로직 — 안내만 (spec §8.3).
