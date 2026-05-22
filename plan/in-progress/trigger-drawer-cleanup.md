---
worktree: trigger-drawer-cleanup-f6a707
started: 2026-05-22
owner: developer
---

# Trigger Detail Drawer — Recent Calls 제거 + i18n 적용

> 관련 spec: [`spec/2-navigation/2-trigger-list.md`](../../spec/2-navigation/2-trigger-list.md) §2.1, §2.3, Rationale R-6 + 신규 R-7
> 발생 배경: PR #266 머지 후 사용자가 (1) drawer 안 Recent Calls 카드가 별 Dialog 와 중복이라 제거 권유, (2) drawer 의 타이틀·라벨이 영문이라 i18n 적용 필요.

## 작업 단위

### 1. drawer 정리 — Recent Calls 카드 제거

- [ ] `trigger-detail-drawer.tsx` 의 `<Card> Recent Calls</Card>` 블록 제거
- [ ] `useQuery<TriggerHistoryEntry[]>` (history 조회) 제거 — drawer 가 더 이상 사용 안 함
- [ ] `TriggerHistoryEntry` 인터페이스 / `isLoadingHistory` / `history` import 정리

### 2. drawer i18n 적용

영문 하드코딩 라벨 → i18n 키 교체. KO/EN dict 양쪽 동시 추가.

- [ ] `SlideDrawer title="Trigger Details"` → `t("triggers.detail.drawerTitle")`
- [ ] CardTitle:
  - "Overview" → `t("triggers.detail.sectionOverview")`
  - "Webhook Configuration" → `t("triggers.detail.sectionWebhook")`
  - "Schedule Configuration" → `t("triggers.detail.sectionSchedule")`
  - "External Interaction" → 기존 `t("triggers.externalInteraction.section")` 사용
- [ ] Overview 카드:
  - "Type" / "Status" / "Workflow" → 기존 `t("triggers.type")` / `t("triggers.status")` / `t("triggers.workflow")` 사용
  - "Active" / "Inactive" → 기존 `t("triggers.statusActive")` / `t("triggers.statusInactive")` 사용
- [ ] Schedule 카드:
  - "Cron Expression" → `t("triggers.detail.cronExpressionLabel")`
  - "Timezone" → `t("triggers.detail.timezoneLabel")`
  - "Next Run" → `t("triggers.detail.nextRunLabel")`
- [ ] Webhook 카드:
  - "URL" → `t("triggers.detail.urlLabel")`
  - "HTTP Method" → `t("triggers.detail.httpMethodLabel")`
  - "Authentication" → 기존 `t("triggers.authenticationLabel")` 사용
  - "Signature Header" → 기존 `t("triggers.signatureHeader")` 사용
  - "Usage Example (curl)" → `t("triggers.detail.usageExampleCurl")`
- [ ] "Trigger not found." → `t("triggers.detail.notFound")`
- [ ] EIA 카드 (`ExternalInteractionCard`):
  - "Notification (Outbound)" → `t("triggers.externalInteraction.notification")` (기존, 한국어 "Notification Webhook (Outbound)")
  - "Interaction (Inbound REST + SSE)" → `t("triggers.externalInteraction.interaction")` (기존)
  - "URL" → 기존 `t("triggers.externalInteraction.notificationUrl")` 사용
  - "Events" → `t("triggers.externalInteraction.eventsLabel")` (신규 — 기존 `notificationEvents`/`eventChoices` 와 의미 분리)
  - "Algorithm" → `t("triggers.externalInteraction.algorithmLabel")` (신규)
  - "Retry attempts" → `t("triggers.externalInteraction.retryAttemptsLabel")` (신규)
  - "Token strategy" → 기존 `t("triggers.externalInteraction.interactionTokenStrategy")` 사용
  - "Endpoints" → `t("triggers.externalInteraction.endpointsLabel")` (신규)
- [ ] Webhook PATCH "POST" 메서드 Badge — 값 그대로 유지 (HTTP 메서드 표준 표기, 번역 안 함)

### 3. i18n dict (KO/EN parity 의무)

- 신규 `triggers.detail.drawerTitle`, `sectionOverview`, `sectionWebhook`, `sectionSchedule`, `cronExpressionLabel`, `timezoneLabel`, `nextRunLabel`, `urlLabel`, `httpMethodLabel`, `usageExampleCurl`, `notFound`
- 신규 `triggers.externalInteraction.eventsLabel`, `algorithmLabel`, `retryAttemptsLabel`, `endpointsLabel`

### 4. 검증

- frontend lint + unit (drawer 영향 받는 test 무영향 — drawer 직접 unit test 부재)
- backend 무변경. cross-stack 빌드 의무
- e2e — drawer 의 history endpoint 호출이 사라지지만 endpoint 자체는 ⋮ 메뉴 → 호출 이력 Dialog 에서 계속 사용. 회귀 없음 예상

## 수용 기준

- drawer 에 "Recent Calls" 카드가 더 이상 표시되지 않는다
- drawer 오픈 시 `GET /api/triggers/:id/history` 가 호출되지 않는다
- drawer 타이틀 + 4개 카드 타이틀이 한국어로 노출된다 (KO 로케일)
- Schedule / Webhook / Overview / EIA 카드의 dt 라벨도 한국어로 노출된다
- KO/EN parity 통과

## 관련 PR

- 선행: #265 (Plan A + B), #266 (호출 이력 Dialog 분리). 본 PR 은 #266 의 정리 follow-up.
