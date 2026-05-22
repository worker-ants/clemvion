# 유지보수성(Maintainability) 리뷰

## 발견사항

### [WARNING] `ExternalInteractionCard` 내 수동 `saving` state — `useMutation` 미활용
- 위치: `trigger-detail-drawer.tsx`, `ExternalInteractionCard` 함수 (라인 약 1171–1215)
- 상세: `OverviewCard`·`WebhookConfigCard`는 `useMutation`의 `isPending`을 사용해 로딩 상태를 관리하지만, `ExternalInteractionCard`의 `handleSave`는 `async/await` + 수동 `setSaving(true/false)`로 구현되어 있어 동일 컴포넌트 파일 안에서 두 가지 비동기 패턴이 혼재한다. 향후 오류 처리·상태 관리 로직 수정 시 두 패턴을 동시에 파악해야 해서 인지 부하가 높아진다.
- 제안: `handleSave`를 `useMutation`으로 통일하거나, 최소한 코드 주석으로 의도적 차이임을 명시한다.

### [WARNING] `copyText` 함수가 두 컴포넌트에 중복 정의
- 위치: `WebhookConfigCard` (라인 약 889–894), `ExternalInteractionCard` (라인 약 1248–1255)
- 상세: 두 함수 모두 `navigator.clipboard.writeText` + `toast.success/error` 패턴이지만 구현 방식이 서로 다르다. `WebhookConfigCard`는 `.then(onFulfilled, onRejected)` 콜백 형태, `ExternalInteractionCard`는 `try/catch` 형태로 작성되어 있다. 기능은 동일하나 스타일 불일치로 코드베이스 독자가 차이점을 파악하는 비용이 발생하고, 클립보드 API 동작이 바뀔 경우 두 곳을 각각 수정해야 한다.
- 제안: 파일 최상단 또는 별도 유틸 모듈에 `useCopyToClipboard`와 같은 훅 혹은 `copyToClipboard(text, t)` 헬퍼 함수를 추출해 단일 구현으로 통합한다.

### [WARNING] `getWebhookUrl` 함수의 하드코딩된 포트 번호 `3011`
- 위치: `trigger-detail-drawer.tsx`, `getWebhookUrl` 함수 (라인 약 603–608)
- 상세: `window.location.origin.replace(/:\d+$/, ":3011")` — 포트 `3011`이 상수나 환경 변수 없이 인라인 하드코딩되어 있다. 개발 환경 포트가 변경되거나 스테이징·프로덕션 환경에서 해당 경로가 실행될 경우 조용히 잘못된 URL을 생성한다. 또한 이 로직이 컴포넌트 파일 내부에 위치해 있어 테스트하기 어렵다.
- 제안: `NEXT_PUBLIC_API_PORT` 같은 환경 변수 상수로 추출하거나, URL 조합 로직을 `lib/utils/` 레이어로 이동한다.

### [WARNING] `ExternalInteractionCard` i18n 키 일관성 — `detail.urlLabel` 재사용
- 위치: `trigger-detail-drawer.tsx`, `ExternalInteractionCard` read view (라인 약 1301–1304)
- 상세: EIA 카드의 Notification URL 표시 dt에 `t("triggers.detail.urlLabel")`을 사용한다. 이 키는 `detail` 네임스페이스에 속하며 원래 Webhook Configuration 카드를 위해 추가된 키다. EIA 카드는 `externalInteraction.*` 네임스페이스를 사용하는데 URL 레이블만 다른 네임스페이스 키를 참조해서 키의 소속 기준이 모호하다. 계획 파일(plan)에서도 이 항목을 "기존 `triggers.externalInteraction.notificationUrl` 사용"으로 명시하고 있어 실제 코드와 계획이 불일치한다.
- 제안: `triggers.externalInteraction.urlLabel` 키를 별도로 추가하거나, 기존 `triggers.externalInteraction.notificationUrl` 키를 그대로 사용해서 `detail` 네임스페이스 의존을 제거한다.

### [INFO] `§2.3.1 필드 권한 매트릭스`에 `Recent Calls` 행이 잔존
- 위치: `spec/2-navigation/2-trigger-list.md`, 라인 약 2570 (`| Recent Calls | (목록) | read-only | …`)
- 상세: R-7에서 drawer의 Recent Calls 카드가 제거되었고, §2.3 표와 R-6 카드 목록도 갱신되었으나 §2.3.1 필드 권한 매트릭스 표에는 `Recent Calls` 행이 그대로 남아 있다. spec과 구현 간 불일치로 향후 독자가 오해할 수 있다.
- 제안: §2.3.1 매트릭스에서 `Recent Calls` 행을 제거하거나 "⋮ 메뉴 → 호출 이력 Dialog 참조" 주석으로 대체한다.

### [INFO] `interaction?.enabled && !editing` 조건부 렌더링에서 `Badge variant="success">Enabled</Badge>` 영문 하드코딩 잔존
- 위치: `trigger-detail-drawer.tsx`, `ExternalInteractionCard` (라인 약 1351)
- 상세: 이번 PR에서 EIA 카드의 dt 레이블들을 모두 i18n으로 교체했으나, `<Badge variant="success">Enabled</Badge>` 텍스트는 영문 하드코딩으로 남아 있다. 다른 상태 배지(`healthLabel`, `statusActive/Inactive`)는 모두 i18n 키를 사용하도록 교체된 것과 대비된다.
- 제안: 기존 `triggers.interactionEnabled` 키(KO: `활성화`)를 재사용하거나, 별도 키를 추가한다. 본 PR 범위 외라면 TODO 주석을 달아 후속 처리 의도를 명확히 한다.

### [INFO] `plan/in-progress/trigger-drawer-cleanup.md` — 체크박스가 모두 미완료 상태
- 위치: `plan/in-progress/trigger-drawer-cleanup.md`
- 상세: 모든 작업 단위 체크박스가 `- [ ]`(미완료) 상태다. 커밋이 이미 완료된 상태이므로 plan 파일의 상태가 실제 완료 상태를 반영하지 않는다. PLAN 라이프사이클 규약상 완료된 plan은 `plan/complete/`로 이동해야 한다.
- 제안: 체크박스를 `[x]`로 표시 후 `plan/complete/`로 `git mv`하거나, 리뷰 완료 후 개발자가 처리하도록 명시한다.

### [INFO] `ScheduleConfigurationCard` props 타입 인라인 정의
- 위치: `trigger-detail-drawer.tsx`, `ScheduleConfigurationCard` (라인 약 757)
- 상세: `ScheduleConfigurationCard`는 `{ trigger: TriggerDetail }`를 인라인으로 정의하고, 다른 카드 컴포넌트들(`OverviewCard`, `WebhookConfigCard`, `ExternalInteractionCard`)은 별도 `interface` 정의 없이 `{ trigger, onSaved }` 형태를 사용한다. 스타일이 혼재되어 있으나 TypeScript 관점에서는 기능상 차이 없음. 단순 비일관성 수준.
- 제안: 일관성을 위해 모두 인라인 또는 모두 named interface로 통일한다.

---

## 요약

이번 변경은 drawer에서 Recent Calls 카드를 제거하고 영문 하드코딩 레이블을 i18n으로 일괄 교체한 명확한 범위의 정리 작업이다. 전체적으로 변경의 의도가 코드와 spec에서 모두 잘 설명되어 있고, i18n 키 네이밍도 컨벤션을 준수하며 KO/EN parity도 충족한다. 주요 유지보수성 우려는 두 가지다. 첫째, 비동기 패턴의 혼재(`useMutation` vs 수동 `saving` state)로 인해 `ExternalInteractionCard`가 나머지 카드들과 다른 방식으로 동작하는 점, 둘째, `copyText` 함수가 두 곳에 서로 다른 스타일로 중복 구현된 점이다. `getWebhookUrl`의 하드코딩 포트 `3011`은 기존 코드의 문제이나 이번 변경으로 제거 기회를 놓친 부분이다. spec 문서의 `§2.3.1` 매트릭스에 Recent Calls 행이 잔존하는 점은 소규모 누락으로 향후 문서 독자에게 혼란을 줄 수 있다.

## 위험도

LOW
