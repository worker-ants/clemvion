---
worktree: triggers-edit-delete-suite-a1548c
started: 2026-05-22
owner: developer
---

# Trigger List — ⋮ 드롭다운 + 삭제 모달 (Plan A)

> 관련 spec: [`spec/2-navigation/2-trigger-list.md`](../../spec/2-navigation/2-trigger-list.md) §2.1 + §4
> 관련 PRD: [`spec/2-navigation/_product-overview.md`](../../spec/2-navigation/_product-overview.md) §3.2 NAV-TR-09
> 의존: [`eia-trigger-edit-ui.md`](./eia-trigger-edit-ui.md) 와 동일 drawer 컴포넌트 접점 — drawer 외부 (`page.tsx`) 만 수정하므로 병행 가능

## 작업 단위

### 1. Backend

- [ ] `DELETE /api/triggers/:id` — 이미 존재. cascade 동작·`trigger_id` SET NULL 정상 동작 e2e 회귀 추가
  - schedule 타입 트리거 삭제 → schedule 도 함께 사라지는지 확인
  - `execution.trigger_id` 가 NULL 로 남는지 확인
- [ ] `DELETE` 권한 가드 (`trigger.delete` permission) 통과 확인
- [ ] audit log `trigger.delete` 기록 확인

### 2. Frontend — `codebase/frontend/src/app/(main)/triggers/page.tsx`

- [ ] 행 끝 셀에 `DropdownMenu` 추가 (기존 컴포넌트 재사용)
- [ ] 항목:
  1. 상세 보기 → `setSelectedTriggerId(id)`
  2. 활성/비활성 토글 (`editor`+) → 기존 `toggleMutation`
  3. 호출 이력 → 드로어 오픈 + Recent Calls anchor 스크롤
  4. 스케줄 관리에서 편집 (schedule 타입만) → `Link href="/schedules?triggerId=…"`
  5. 삭제 (`editor`+) → `TriggerDeleteDialog` 오픈
- [ ] 신규 컴포넌트 `codebase/frontend/src/components/triggers/trigger-delete-dialog.tsx`:
  - type 별 본문 텍스트 분기 (`triggers.delete.confirm.webhook|schedule|manual`)
  - 이름 입력 confirm — input 값이 정확히 일치할 때만 "Delete" 버튼 활성
  - `useDeleteTrigger` React Query mutation — 성공 시 invalidate + toast
  - Schedule 타입은 cascade 경고 강조 (`AlertTriangle` 아이콘 + 분리된 카드)

### 3. i18n

**기존 키 재사용** (`codebase/frontend/src/lib/i18n/dict/ko/triggers.ts` 에 이미 존재):

- `triggers.deleted` (success toast)
- `triggers.deleteFailed`

**기존 `deleteConfirm` 처리**: flat 키를 본 plan 의 type 분기 모달로 일괄 대체. i18n parity test 통과 후 키 삭제.

**신규 키** (KO/EN parity 의무):

- `triggers.rowActions.viewDetails`
- `triggers.rowActions.viewHistory`
- `triggers.rowActions.editInSchedule`
- `triggers.rowActions.delete`
- `triggers.delete.title`
- `triggers.delete.confirm.webhook` — interp `{url}`
- `triggers.delete.confirm.schedule` — interp `{scheduleId}` `{nextRunAt}`
- `triggers.delete.confirm.manual` — interp `{workflowName}`
- `triggers.delete.typeNameToConfirm`
- `triggers.delete.button`
- `triggers.delete.cascadeWarning`

### 4. 검증

- frontend lint + unit (`triggers-page.test.tsx` 확장 — viewer/editor 모두 케이스, 삭제 confirmation 흐름)
- backend e2e — schedule cascade
- 수동: 3 가지 type 각각 삭제 흐름 확인

## 수용 기준

- viewer 역할은 ⋮ 메뉴에 "삭제" 항목이 노출되지 않는다
- schedule 타입 삭제 모달에 "schedule 도 함께 삭제됩니다" 가 시각적으로 강조된다
- 트리거 이름 입력 confirm 이 정확히 일치해야 삭제 진행
- 삭제 성공 시 목록에서 즉시 사라짐 (invalidate)
- 동시 삭제 시 두 번째 클라이언트의 404 가 사용자에게 1회 토스트로 통보됨
- `editor` 이상에서만 ⋮ 메뉴의 삭제·토글·스케줄 편집 항목이 보임 (RoleGate)
