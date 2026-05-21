---
worktree: eia-trigger-edit-ui-<slug>
started: 2026-05-21
owner: developer
---

# EIA — Trigger 상세 드로어 수정 UI

> 작성일: 2026-05-21
> 상위: [`plan/complete/external-interaction-api.md`](../complete/external-interaction-api.md) §"완료 후 잔여"
> 관련 spec: [`spec/5-system/14-external-interaction-api.md`](../../spec/5-system/14-external-interaction-api.md) §4 + §10.1

## 배경

PR2 (#230) 의 P7 frontend 는 read-only 표시 카드까지만 구현. 사용자 수정 UI (URL 입력 / events multi-select / strategy radio / rotate / revoke 버튼) 는 follow-up 으로 분리.

## 작업 단위

### 1. UI 컴포넌트

- [ ] Notification 섹션 — read-only → edit 모드 토글
  - URL 입력 (SSRF 검증은 backend 가 — frontend 는 URL format 만 client-side)
  - events multi-select (5 이벤트 — checkbox 또는 multi-select)
  - signing algorithm enum (hmac-sha256 / hmac-sha512)
  - retry maxAttempts number (0~10)
  - "Save" 버튼 → `PATCH /api/triggers/:id` 호출 → 응답으로 카드 갱신
  - secret rotation 버튼 (PR-E 의 `eia-secret-rotation-revoke-api` 와 dependency)

- [ ] Interaction 섹션 — read-only → edit 모드 토글
  - enabled toggle
  - tokenStrategy radio (per_execution / per_trigger)
  - "Save" 버튼
  - per_trigger 일 때 "Rotate per-trigger token" 버튼 (의존 plan)

### 2. State management

- [ ] React Query mutation hooks — `useUpdateTrigger` / `useRotateNotificationSecret` / `useRevokePerTriggerToken`
- [ ] form validation — Notification URL 형식 client-side (https 강제)

### 3. i18n KO/EN parity

- 신규 키 — `triggers.externalInteraction.edit.*` (URL placeholder / save / rotate confirm 등)

### 4. 검증

- frontend lint + unit + i18n parity
- 수동: 트리거 상세 → notification url 입력 → save → 백엔드 반영 → 카드 갱신

## 수용 기준

- 사용자가 URL / events / strategy 를 GUI 로 수정해 저장 가능
- 백엔드 SSRF 거부 시 사용자 가시 에러 메시지 (i18n)
- secret rotation / token revoke 가 의존 plan 머지 후 활성화
