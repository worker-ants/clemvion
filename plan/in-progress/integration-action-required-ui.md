---
worktree: integration-action-required-ui
started: 2026-05-21
owner: developer
parent_plan: plan/in-progress/cafe24-backlog-residual.md (A-1 항목)
---

# `integration_action_required` 알림 표시 UI

`cafe24-backlog-residual.md` A-1 의 frontend 구현. PR #247 의 사용자 결정으로 별 plan/worktree 로 분리 진행.

## 출처

- spec/2-navigation/4-integration.md §11.2 `integration_action_required` (active — 사용자 즉시 액션 필요) — 2026-05-16 A-1 신설
- spec/data-flow/8-notifications.md §1.1 Type 별 source · 트리거
- spec/conventions/cafe24-restricted-scopes.md §4.3 `requiresCafe24Approval` 동행 hint
- backend: `codebase/backend/src/modules/integrations/integration-action-required-notifier.service.ts` (PR #116)
- frontend 현재: `codebase/frontend/src/components/layout/sidebar.tsx` — type-agnostic 렌더링

## 현 상태 분석

backend 가 보내는 알림 shape (sidebar.tsx 의 query 결과):
```ts
{
  id, title, message, isRead, createdAt,
  resourceType?: string | null,
  resourceId?: string | null,
  type?: string,  // 'integration_action_required' 포함
}
```

backend 의 `composeMessage` (notifier.service.ts) 가 영어 hardcoded title/message 를 emit. `notificationHref` (sidebar.tsx:245) 는 `integration_expired` / `integration_action_required` 둘 다 **`/integration` (singular)** 로 라우팅 — frontend 실 라우트는 `/integrations` (plural) 이라 **bug**. 그리고 `resourceId` (integration id) 가 있음에도 detail 페이지 직접 deep-link 안 함.

## 본 batch 의 변경 범위

1. **deep-link bug fix**: `integration_expired` / `integration_action_required` 의 `notificationHref` 가
   - `resourceId` 가 있고 `resourceType === 'integration'` 이면 → `/integrations/<id>`
   - 없으면 → `/integrations` (목록)
2. **inline CTA 버튼**: `type === 'integration_action_required'` 알림 카드에 우측 inline "Reconnect / 재인증" 버튼. 클릭 시 dismiss popover + deep-link.
3. **type 필터 칩**: notification popover 상단에 3-옵션 toggle 그룹:
   - "전체" / "일반" / "통합 액션 필요"
   - 클라이언트 사이드 필터링 (목록 10개 limit, type 기반).
4. **i18n 키 신규** (`sidebar` namespace 에 추가):
   - `notificationCta.reconnect`
   - `notificationFilter.all` / `general` / `integrationActionRequired`

## 본 batch 의 scope 외 (별 plan)

- **backend message i18n 화**: 현재 `composeMessage` (notifier.service.ts) 가 영어 hardcoded. frontend `backend-labels.ts` 매핑 레이어 패턴으로 `type + statusReason → i18n key` 매핑 신설이 필요해 작업량이 크다 (CT/PR 비용 > 본 cycle 가치). 별 plan 으로 분리.
- **`requiresCafe24Approval` 동행 hint UI**: `last_error.details.requiresCafe24Approval` 의 scope 배열이 frontend 까지 닿는지 backend 응답 shape 확인 후 별 plan 진행 (현재 sidebar query 가 fetch 하는 필드에 없음).
- **`/api/notifications?type=...` server-side 필터**: 본 batch 는 client-side. 알림 수가 늘어나면 server filter 도입 고려 (별 plan).

## 작업 항목

- [ ] **consistency-check**: `/consistency-check --impl-prep spec/2-navigation/4-integration.md` + `spec/data-flow/8-notifications.md` — Critical 발견 시 차단.
- [ ] **TDD**: `sidebar.test.tsx` 신설 또는 기존에 추가. 다음 케이스 lock-in:
  - `notificationHref('integration_action_required', resourceId='abc')` → `/integrations/abc`
  - `notificationHref('integration_expired', resourceId=null)` → `/integrations`
  - `notificationHref('execution_failed', resourceId='wf-1')` → `/workflows/wf-1` (회귀 방지)
  - `<NotificationItem type='integration_action_required'>` 가 Reconnect 버튼 렌더링
  - `<NotificationItem type='execution_failed'>` 는 Reconnect 버튼 미렌더링
  - 필터 칩 클릭 시 type 별로 목록 필터링
- [ ] **구현**: 
  - `sidebar.tsx`: `notificationHref` bug fix, CTA 버튼 추가, type 필터 칩 추가
  - `lib/i18n/dict/ko/sidebar.ts` + `en/sidebar.ts`: 신규 키 추가
- [ ] **TEST WORKFLOW**: lint / unit / build / e2e 모두 통과
- [ ] **REVIEW WORKFLOW**: `/ai-review` + Critical/Warning fix
- [ ] **parent plan A-1 체크박스 닫기**: `plan/in-progress/cafe24-backlog-residual.md` A-1 항목을 `[x]` 처리 + "i18n 키는 `sidebar` namespace 로 결정 (parent 의 `notifications.types.*` 제안 대신)" 메모 추가. consistency-check `2026/05/21/19_58_40` INFO #4, #5 반영. 본 PR 의 마지막 commit 으로 포함.
- [ ] **spec 드리프트 follow-up 명시**: 본 PR 의 PR description 또는 별 plan 으로 다음 spec 갱신 위임 — (a) `spec/data-flow/8-notifications.md §1.1` 표에 `integration_action_required` 행 추가 + `integration_expired` 행 "향후 신설 검토" 각주 제거, (b) `spec/2-navigation/_layout.md §3.1` 팝오버 구조에 타입 필터 칩 + deep-link 라우팅 테이블 추가. consistency-check INFO #1, #2, #3 출처.
- [ ] **plan/complete 이동**: 모든 체크박스 완료 시

## Rationale

### 스코프 축소 결정

i18n `reason.{auth_failed,insufficient_scope,network}` 별 메시지 매핑은 backend message 가 이미 영어로 user-friendly 하나, ko 로컬 환경에서는 영어 그대로 노출됨. 정식 해결은 `backend-labels.ts` 패턴 신설 (backend type+reason → frontend i18n key) 인데 본 batch 의 핵심 결정 (CTA 버튼 + 필터 + deep-link) 과 직교한 cross-cutting 작업이라 별 plan 으로 분리.

본 batch 는 **사용자가 즉시 안내받고 해결할 수 있는 핵심 동선**:
1. 알림 카드를 본다 (현재도 가능)
2. 어떤 통합인지·왜인지 안다 (메시지에 통합 이름·이유 포함)
3. 클릭 한 번에 해당 통합 상세로 이동 (CTA 버튼 + deep-link bug fix → 본 batch 추가)
4. 자질구레한 알림이 묻혀도 통합 액션 알림만 골라본다 (필터 칩 → 본 batch 추가)

→ 4단계 모두 본 batch 에서 해결. 메시지 자체의 ko 번역은 시각적 polish 차원.

### deep-link bug fix 를 본 batch 에 포함한 이유

A-1 의 CTA 버튼이 의미를 가지려면 deep-link 가 정확해야 한다 (`/integrations/<id>` 로 직접 이동). 기존 `/integration` (singular) bug 는 본 결정의 전제 조건이라 분리할 수 없다.
