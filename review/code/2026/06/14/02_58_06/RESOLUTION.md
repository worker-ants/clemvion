# RESOLUTION — impl-workflow-list-gaps ai-review 후속

대상 SUMMARY: `review/code/2026/06/14/02_58_06/SUMMARY.md` (RISK MEDIUM, Critical 0, Warning 6)

## 조치 내역

### W4 (requirement/testing) — `hasActiveFilters` 에 `sortKey` 비기본값 반영 [FIXED]
- 파일: `codebase/frontend/src/app/(main)/workflows/page.tsx`
- `hasActiveFilters` 에 `sortKey !== "created"` 조건 추가 + 의도 주석. 비기본 정렬만으로 결과가 0건일 때 EmptyState 가 "Create Workflow" 대신 "Reset Filters" CTA 를 노출하고, `handleResetFilters()` 의 `setSortKey("created")` 복귀와 일관.

### W5/W6 (testing) — frontend 정렬 단위 테스트 추가 [FIXED]
- 파일: `codebase/frontend/src/app/(main)/workflows/__tests__/workflows-page.test.tsx`
- 신규 `describe("WorkflowsPage — sort (NAV §2.4)")` 5케이스:
  1. 기본(created) 정렬 시 `sort`/`order` 파라미터 미송신
  2. "Last run" 선택 → `sort=last_run&order=desc` 송신
  3. "Recently updated" 선택 → `sort=updated_at&order=desc` 송신
  4. 정렬 변경 시 `page` 1 리셋
  5. 비기본 정렬 0건 → Reset CTA 표시 + reset 클릭 시 정렬 created 복귀 (W6 버그 회귀 가드)
- 결과: 13/13 통과 (기존 8 + 신규 5).

### W1 (performance/database) — `execution(workflow_id, started_at)` 인덱스 [ALREADY SATISFIED]
- `codebase/backend/migrations/V002__indexes.sql:18` 에
  `CREATE INDEX idx_execution_workflow_started ON execution (workflow_id, started_at DESC);` 가 **이미 존재**.
  리뷰어는 `origin/main..HEAD` diff 만 검토해 기존 마이그레이션을 보지 못함. correlated subquery 는
  이미 인덱스 백업됨 → 신규 마이그레이션 불필요.

### I9/I12 (requirement/maintainability) — `getSortColumn` 다층 방어 주석 [FIXED]
- 파일: `codebase/backend/src/modules/workflows/workflows.service.ts`
- 화이트리스트 폴백의 injection 방어 의도 + DTO `@Matches` 1차 차단 + `last_run` 별도 분기 사실을 JSDoc 으로 명시.

## 범위 외 (본 PR 미변경 기존 코드 — 별도 추적)
- **W2**: `findAll` 의 `getCount()`/`getMany()` 순차 2회 왕복 → `Promise.all`+`clone()` 병렬화 가능. 본 PR 무관.
- **W3**: `exportWorkflow` 의 `nodes.findIndex` O(N×E) → `Map` 역인덱스 최적화 가능. 본 PR 무관.
- 두 항목은 정렬 갭 구현과 무관한 선재(pre-existing) 코드로, 범위 노이즈를 피하기 위해 본 PR 에서 손대지 않음.

## 검증
- frontend: `vitest run workflows-page.test.tsx` → 13/13 통과. eslint 0.
- backend: `jest workflows.service.spec.ts` → 40/40 통과. eslint 0.

## ESCALATE
- 없음 (no). Critical 0, 모든 actionable warning 해소, 결정 필요 사항 없음.
