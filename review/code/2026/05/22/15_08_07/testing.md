# Testing Review — trigger-detail-drawer 정리 + i18n 적용

## 발견사항

### [WARNING] TriggerDetailDrawer 컴포넌트에 전용 unit 테스트 없음
- 위치: `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` 전체
- 상세: plan 파일 §4 검증 항목에도 "drawer 직접 unit test 부재"라고 명시되어 있다. `triggers-page.test.tsx`는 `TriggerDetailDrawer`를 `() => null`로 mock 처리하고 있어, drawer 내부 렌더링 로직(i18n 키 호출, 조건부 카드 표시, edit 모드 전환)은 어떤 테스트에도 직접 검증되지 않는다.
- 제안: 최소한 다음 경로를 커버하는 unit 테스트를 추가해야 한다.
  1. `triggerId=null` 또는 `open=false` 시 API 호출이 발생하지 않는다 (`enabled: !!triggerId && open` 조건).
  2. trigger 가 없을 때 `triggers.detail.notFound` 키 번역값이 렌더링된다.
  3. `type="webhook"` 시 WebhookConfigCard + ExternalInteractionCard 가 렌더링되고 ScheduleConfigurationCard 는 렌더링되지 않는다.
  4. `type="schedule"` 시 ScheduleConfigurationCard 만 렌더링된다.
  5. Recent Calls 카드가 렌더링되지 않는다 (제거 회귀 가드).

### [WARNING] Recent Calls 제거 회귀 테스트 미존재
- 위치: `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` (제거된 history useQuery 블록)
- 상세: `GET /api/triggers/:id/history` round-trip 감소가 이번 변경의 핵심 목적 중 하나이나, 이를 검증하는 테스트가 없다. 향후 누군가 history 조회를 다시 추가하면 조용히 회귀한다.
- 제안: drawer unit 테스트에 `apiGetMock` 호출 여부를 확인하는 케이스를 추가한다. `open=true, triggerId="t-1"` 상태에서 `/triggers/t-1/history` 가 호출되지 않음을 assert.

### [WARNING] i18n 키 변경에 대한 컴포넌트 레벨 테스트 없음
- 위치: `codebase/frontend/src/lib/i18n/dict/en/triggers.ts`, `ko/triggers.ts`
- 상세: dict parity 테스트(`i18n.test.ts`)는 KO/EN leaf 키 집합 동일성을 잘 검증하고 있어 신규 15개 키의 parity 는 자동 보장된다. 그러나 drawer 컴포넌트가 실제로 올바른 i18n 키를 사용하고 있는지는 렌더링 테스트 없이 확인 불가다. 예를 들어 `triggers.detail.sectionOverview` 키가 `"Overview"` 값으로 렌더링되는지, `triggers.detail.notFound` 가 trigger 미발견 상태에서 노출되는지 등은 dict parity 테스트 범위 밖이다.
- 제안: drawer unit 테스트에서 EN 로케일 설정 후 컴포넌트 렌더링 시 하드코딩 문자열 대신 번역값이 나타나는지 확인한다(예: `screen.getByText("Trigger Details")`).

### [INFO] spec/2-navigation/2-trigger-list.md §2.3.1 매트릭스에 "Recent Calls" 행이 잔존
- 위치: `spec/2-navigation/2-trigger-list.md` (§2.3.1 필드 권한 매트릭스 표)
- 상세: 변경된 diff 에는 §2.1과 §2.3 표 및 R-6/R-7 Rationale 은 정리되었으나, §2.3.1 필드 권한 매트릭스 표 내 `| Recent Calls | (목록) | read-only | …` 행이 제거되지 않고 남아 있다. 이는 spec ↔ 구현 불일치 상태다. 이 행이 살아있으면 일관성 검토 도구가 "drawer 에서 Recent Calls 를 표시해야 한다"는 근거 자료로 참조할 위험이 있다. 테스트와 직접 연결되지는 않지만, spec 기반 구현 검증 시 오탐을 유발할 수 있다.
- 제안: 해당 행을 spec 에서 제거하거나 취소선·deprecated 주석으로 표시한다.

### [INFO] ExternalInteractionCard 의 "Enabled" Badge 값 미번역
- 위치: `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` 라인 881
- 상세: `<Badge variant="success">Enabled</Badge>` 는 이번 i18n 적용 범위에서 누락되었다. `interaction.enabled` 상태를 나타내는 이 문자열은 `triggers.externalInteraction.interactionEnabled` 키(값: "활성화" / "Enabled")가 이미 dict 에 존재함에도 사용되지 않고 있다.
- 제안: `Enabled` 를 `t("triggers.externalInteraction.interactionEnabled")` 로 교체하고, 관련 단위 테스트에서 EN/KO 로케일 각각 올바른 값이 렌더링되는지 검증한다.

### [INFO] WebhookConfigCard authType display 값 미번역
- 위치: `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` 라인 616
- 상세: `authType === "hmac" ? "HMAC Signature" : authType === "bearer" ? "Bearer Token" : "None (Public)"` 이 하드코딩 영문으로 남아 있다. 이번 PR 의 목적이 영문 하드코딩 i18n 교체이므로, 이 표현식도 같은 범위에 포함되어야 자연스럽다. 단, `triggers.authHmac` / `triggers.authBearer` / `triggers.authNone` 키가 이미 dict 에 존재한다.
- 제안: 세 값을 기존 dict 키로 교체한다. 단, 표준 약어("HMAC Signature", "Bearer Token")의 번역값과 현재 하드코딩 표기가 일치하는지 먼저 확인한다. 테스트에서 각 authType 값별 렌더링을 assert 한다.

### [INFO] EIA 카드의 Notification URL 레이블 키 불일치
- 위치: `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` 라인 833 및 plan 파일 §2 EIA 카드 항목
- 상세: plan 파일 §2에서 EIA 카드의 URL dt 는 "기존 `t("triggers.externalInteraction.notificationUrl")` 사용"으로 기술되어 있으나, 실제 구현에서는 `t("triggers.detail.urlLabel")` 을 사용하고 있다. 라인 587 (Webhook 카드)과 라인 833 (EIA 카드 Notification URL) 모두 같은 `triggers.detail.urlLabel` 키를 공유한다. Webhook과 EIA 섹션에서 동일한 "URL" 레이블이므로 기능적 오류는 아니나, 계획 문서와 구현 사이의 의도 불일치는 테스트로 고정할 필요가 있다.
- 제안: drawer unit 테스트에서 두 섹션 모두의 "URL" 레이블 텍스트가 올바르게 렌더링됨을 확인한다.

### [INFO] TriggerHistoryDialog 테스트는 drawer 변경 후에도 유효함
- 위치: `codebase/frontend/src/components/triggers/__tests__/trigger-history-dialog.test.tsx`
- 상세: history 조회 로직이 drawer 에서 `TriggerHistoryDialog` 로 이동된 PR #266 이후이므로, 기존 `trigger-history-dialog.test.tsx` 의 8개 테스트는 이번 변경과 무관하게 회귀 없이 유지된다. `/triggers/:id/history` API mock, limit=10 파라미터, `onOpenFullDetail` prop, error 분기 등 모두 보존된다.

## 요약

이번 PR 은 `TriggerDetailDrawer` 에서 Recent Calls 카드 제거와 영문 하드코딩 i18n 교체라는 두 가지 목적을 수행했으나, 변경된 컴포넌트(`trigger-detail-drawer.tsx`)에 대한 전용 단위 테스트가 전혀 없다. KO/EN dict parity 는 기존 `i18n.test.ts` 가 자동 검증하므로 신규 15개 키의 키 존재 여부는 보장되지만, 컴포넌트가 올바른 키를 사용하는지, 조건부 카드 렌더링이 정확한지, Recent Calls 제거가 회귀하지 않는지를 보증하는 테스트가 없다. "Enabled" Badge와 authType display 값의 미번역은 이번 PR 의 일관성 목표와 불일치한다. spec §2.3.1 매트릭스에 Recent Calls 행이 잔존하는 것은 spec ↔ 구현 간 불일치로 향후 혼선 소지가 있다.

## 위험도

MEDIUM
