---
worktree: triggers-edit-delete-suite-a1548c
started: 2026-05-22
owner: developer
---

# Trigger Detail Drawer — Overview / WebhookConfig edit 모드 (Plan B)

> 관련 spec: [`spec/2-navigation/2-trigger-list.md`](../../spec/2-navigation/2-trigger-list.md) §2.3.1
> 관련 PRD: [`spec/2-navigation/_product-overview.md`](../../spec/2-navigation/_product-overview.md) §3.2 NAV-TR-10
> 의존 (직렬화 순서):
>   1. [`eia-trigger-edit-ui.md`](./eia-trigger-edit-ui.md) 가 먼저 머지 — 동일 drawer 의 EIA 카드 edit 패턴 확정 후
>   2. [`trigger-list-row-actions.md`](./trigger-list-row-actions.md) (Plan A) 와는 병행 가능 — Plan A 는 page.tsx 만, 본 plan 은 drawer 카드만 수정
>   3. 본 plan (Plan B) 가 마지막 — EIA 카드의 edit UX 패턴을 OverviewCard / WebhookConfigCard 에 재사용
> 의존 plan: [`eia-secret-rotation-revoke-api.md`](./eia-secret-rotation-revoke-api.md) (rotate 응답 shape·grace 기간 미결 — 본 plan 의 v1.1 webhook secret rotate 항목은 그 합의 후 별 plan 으로 분리)

## 작업 단위

### 1. Backend — `PATCH /api/triggers/:id` 확장

- [x] body 키 검증: `name`, `isActive`, `endpointPath`, `config.authType`, `config.hmacHeader`, `config.hmacSecret`, `config.bearerToken` (deep-merge) — 기존 UpdateTriggerDto + service.update 가 이미 처리
- [x] Schedule 타입은 `name`, `isActive` 외 키 거부 (400 `VALIDATION_ERROR`, `details.field='type'`) — service.update 첫 가드 추가, service.spec 2건 신설
- [ ] `(workspace_id, endpoint_path)` UNIQUE 충돌 → 409 `RESOURCE_CONFLICT` (세부 `TRIGGER_ENDPOINT_PATH_CONFLICT`) — **별 plan (data-model §2.8 의 UNIQUE 제약 추가가 선행 필요. spec PR 체크리스트 참조)**
- [ ] write-only 필드 (`hmacSecret`, `bearerToken`) 응답 마스킹 — **별 plan (현재 응답 DTO 가 config 전체를 그대로 반환, 마스킹 로직 신설 필요)**
- [x] audit log `trigger.update` — 기존 서비스가 emit (변경 없음)

### 2. Frontend — `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx`

- [x] inline `<Card> Overview` 블록을 `OverviewCard` 함수로 추출 — read ↔ edit 토글 + `name` 인풋 + Save (Pencil 아이콘 토글)
- [x] `WebhookConfigCard` (기존 함수) **확장** — read ↔ edit 토글 + `endpointPath` / `authType` / `hmacHeader` / `hmacSecret` / `bearerToken`
- [x] `endpointPath` 변경 시 `window.confirm` 으로 사전 confirmation
- [x] `ScheduleConfigurationCard` 함수 추출 — "스케줄 관리에서 편집" 링크 (`/schedules?triggerId=<encodeURIComponent(id)>`) + ExternalLink 아이콘 + help 텍스트
- [x] EIA 카드와 동일 save / cancel 토글 UX (`size="sm"`, disabled, `Loader2`)
- [x] React Query `useMutation` PATCH — `onSaved` 콜백으로 부모(drawer) 에서 `["trigger-detail", id]` + `["triggers"]` invalidate (window.reload 금지)

### 3. i18n

- `triggers.detail.editName`, `triggers.detail.cancel`, `triggers.detail.save`, `triggers.detail.saving`
- `triggers.webhook.editAuth.{none,hmac,bearer}`
- `triggers.webhook.endpointPathChangeWarning`
- `triggers.webhook.regenerateUrl`
- `triggers.webhook.hmacSecretHelp` ("저장 후 1회만 표시됩니다" 안내)
- `triggers.webhook.bearerTokenHelp`
- `triggers.schedule.editInSchedule`

### 4. 검증

- frontend lint + drawer unit (`trigger-detail-drawer.test.tsx` 신규 또는 확장)
- backend e2e — Schedule 타입 PATCH 가 `endpointPath` / `config` 거부하는지
- 수동: 3 가지 type 각각 메타 수정 흐름

## 수용 기준

- viewer 역할은 카드별 "편집" 토글이 보이지 않는다
- `name` 수정 후 저장하면 목록 행에도 즉시 반영된다 (invalidate)
- `endpointPath` 수정 시 cascading 경고 다이얼로그를 거친다
- HMAC secret / Bearer token 은 마스킹된 값으로 표시되고, 신규 입력만 plain 으로 받는다
- Schedule 카드에서 "스케줄 관리에서 편집" 클릭 시 `/schedules?triggerId=…` 로 이동
- EIA 카드의 기존 edit 흐름과 충돌 없음 (동시 편집 가능, 저장은 카드 단위 독립 PATCH)
