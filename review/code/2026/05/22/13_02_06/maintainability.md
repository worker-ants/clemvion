# 유지보수성(Maintainability) 리뷰

## 발견사항

### [WARNING] 편집 버튼 영역(Cancel/Save) 이 OverviewCard 와 WebhookConfigCard 에 거의 동일하게 중복
- 위치: `trigger-detail-drawer.tsx` — OverviewCard CardHeader 의 editing 분기 (약 2087-2108줄), WebhookConfigCard CardHeader 의 editing 분기 (약 2338-2360줄)
- 상세: 두 카드 모두 `{editing && <div className="flex gap-1.5"><Button variant="outline" onClick={cancel}>{cancel}</Button><Button onClick={save}>{Loader2 + 텍스트}</Button></div>}` 구조를 그대로 반복한다. 아울러 `ExternalInteractionCard` (기존 코드, 이번 PR 외 범위)도 동일한 save/cancel 버튼 패턴을 `saving` state 방식으로 구현하여 파일 내에 세 가지 변종이 공존한다.
- 제안: `CardEditActions` 또는 `SaveCancelButtons` 같은 소형 컴포넌트로 추출. props: `isPending`, `onCancel`, `onSave`, `saveDisabled?`. 세 카드가 이를 공유하면 스타일·동작의 단일 진실 보장.

### [WARNING] `mutationFn` 내부에서 `window.confirm` 사용 — 부수 효과와 비동기 흐름의 혼재
- 위치: `trigger-detail-drawer.tsx` — WebhookConfigCard `updateMutation.mutationFn` 내 `window.confirm` 호출 (약 2249-2253줄)
- 상세: `mutationFn` 은 순수한 API 호출을 담당해야 한다는 React Query 관례를 벗어난다. `window.confirm` 을 `mutationFn` 안에서 던지고 `throw new Error("USER_CANCELLED")` 로 분기하는 패턴은 직관적이지 않으며, `onError` 에서 `USER_CANCELLED` 를 마법 문자열로 거르는 로직이 의존성이 된다. 이 패턴은 사이드이펙트 로직이 어디 있는지 추적하기 어렵게 만든다.
- 제안: 버튼 onClick 핸들러에서 `window.confirm` 을 먼저 호출하고 사용자가 취소하면 `mutate()` 자체를 호출하지 않도록 변경. 예: `onClick={() => { if (endpointPathChanged && !confirm(t(...))) return; updateMutation.mutate(); }}`. 이렇게 하면 `mutationFn` 은 순수 API 호출만 담당하고 `USER_CANCELLED` 매직 스트링도 사라진다.

### [WARNING] `"USER_CANCELLED"` 매직 스트링
- 위치: `trigger-detail-drawer.tsx` — `mutationFn` throw 구문 및 `onError` 조건 (약 2253, 2285줄)
- 상세: 오류 식별에 하드코딩된 문자열 리터럴을 사용한다. 이 문자열이 변경되거나 오타가 나면 onError 의 예외 처리 분기가 조용히 깨진다.
- 제안: 위 WARNING 의 개선으로 이 패턴 자체를 제거하는 것이 가장 깨끗하다. 불가피하다면 `const USER_CANCELLED = "USER_CANCELLED"` 상수 또는 커스텀 Error 서브클래스를 도입.

### [WARNING] `WebhookConfigCard` `updateMutation.mutationFn` 의 책임 과다 및 함수 길이
- 위치: `trigger-detail-drawer.tsx` — `mutationFn` 본문 (약 2247-2276줄, ~30줄)
- 상세: 하나의 `mutationFn` 이 (1) endpointPath 변경 감지, (2) 사용자 확인, (3) 요청 body 조립(authType 분기 2단계), (4) API 호출 네 가지 책임을 수행한다. 단일 책임 원칙 위반이 아니더라도 변경 시 영향 범위가 크다.
- 제안: body 조립 로직을 `buildWebhookPatchBody(state, trigger)` 같은 별도 순수 함수로 추출하면 단위 테스트 가능성도 높아진다.

### [INFO] `OverviewCard` 의 `nameValue` 초기화가 `trigger.name` 에 의존하지만 trigger 갱신 시 stale
- 위치: `trigger-detail-drawer.tsx` — `useState(trigger.name)` (약 2046줄)
- 상세: `useState` 의 초기값은 컴포넌트 마운트 시 한 번만 적용된다. `trigger` props 가 갱신(invalidate 후 re-fetch)되어도 `nameValue` state 는 자동 동기화되지 않는다. `startEdit()` 에서 `setNameValue(trigger.name)` 을 호출해 편집 시작 시점에 동기화하므로 실제 UX 버그는 없지만, 패턴이 미묘하다.
- 제안: 편집 중이지 않을 때 `nameValue` 를 별도 state 로 관리하지 않고, `editing ? nameValue : trigger.name` 구조를 유지하면서 `editing === false` 경로에서는 `trigger.name` 을 직접 읽으면 stale state 우려가 사라진다. 현재 구현도 `startEdit` 에서 리셋하므로 버그는 아니나, 향후 로직 변경 시 함정이 될 수 있다.

### [INFO] `getWebhookUrl` 에서 포트를 `3011` 로 하드코딩
- 위치: `trigger-detail-drawer.tsx` — `getWebhookUrl` 함수 (약 2031줄)
- 상세: `window.location.origin.replace(/:\d+$/, ":3011")` — 개발 편의 코드로 보이나, 프로덕션 빌드에도 남아 있다면 포트 매핑이 하드코딩된다.
- 제안: 환경 변수(`NEXT_PUBLIC_WEBHOOK_BASE_URL` 등)나 API 응답에서 base URL 을 주입받아 사용하거나, 최소한 fallback 이 아닌 설정 방식으로 관리해야 한다.

### [INFO] `triggers.service.ts` — schedule 거부 필드 목록이 코드에 하드코딩
- 위치: `triggers.service.ts` — `update` 메서드의 schedule guard 블록 (약 900-914줄)
- 상세: `endpointPath`, `authConfigId`, `config`, `notification`, `interaction`, `chatChannel` 등 허용/거부 키가 서비스 코드에 직접 나열되어 있다. `UpdateTriggerDto` 에 새 필드가 추가될 때 이 guard 를 함께 업데이트해야 한다는 연결이 코드 레벨로 강제되지 않는다.
- 제안: `SCHEDULE_DISALLOWED_KEYS = ['endpointPath', 'authConfigId', ...] as const` 상수로 추출하거나, DTO 필드에 `@ScheduleDisallowed()` 커스텀 데코레이터를 사용해 선언적 방식으로 관리하면 누락 가능성을 줄인다. 단, 현재 규모에서는 상수 추출 정도로 충분하다.

### [INFO] `promoteRotatedNotificationSecrets` 의 `24 * 60 * 60 * 1000` 매직 넘버
- 위치: `triggers.service.ts` — `promoteRotatedNotificationSecrets` (약 1142줄)
- 상세: grace period 가 인라인 계산식으로 표현된다. 스펙 주석(24h grace)과 코드가 일치하지만, 이 값이 변경될 때 주석과 코드를 함께 찾아야 한다.
- 제안: `private readonly NOTIFICATION_SECRET_GRACE_MS = 24 * 60 * 60 * 1000;` 또는 config 값으로 외부화.

### [INFO] `ScheduleConfigurationCard` 에서 `t` (i18n hook) 를 선언하지만 두 군데에서만 사용
- 위치: `trigger-detail-drawer.tsx` — `ScheduleConfigurationCard` 함수 (약 2169-2218줄)
- 상세: 카드 내 정적 레이블("Cron Expression", "Timezone", "Next Run")은 여전히 하드코딩된 영문 문자열로 남아 있고, `t()` 는 `editInSchedule` / `editInScheduleHelp` 두 키에만 사용된다. i18n 적용이 불일치한다.
- 제안: 나머지 레이블도 i18n 키로 추출하거나, 향후 계획을 주석으로 명시.

### [INFO] `ExternalInteractionCard` 의 `handleSave` 가 `window.location.reload()` 사용 (기존 코드이나 이번 PR 에서 공존)
- 위치: `trigger-detail-drawer.tsx` — `ExternalInteractionCard.handleSave` (약 2591줄)
- 상세: 이번 PR 에서 `OverviewCard` / `WebhookConfigCard` 는 `queryClient.invalidateQueries` 로 올바르게 처리하지만, 기존 `ExternalInteractionCard` 는 아직 `window.location.reload()` 를 사용한다. 주석으로 "본 PR 은 단순 reload" 라고 명시되어 있으나, 동일 파일에 두 가지 상이한 데이터 갱신 전략이 공존한다.
- 제안: 이번 PR 범위 밖이더라도 후속 이슈로 추적하여 일관성 확보 권장.

### [INFO] 테스트 fixture 의 `workspaceId: 'ws'`, `id: 't-sch'` 등 짧은 임의 문자열 반복
- 위치: `triggers.service.spec.ts` — 새로 추가된 두 테스트 케이스 (약 87-120줄)
- 상세: 기존 파일 전체에서 같은 패턴을 사용하므로 일관성은 있다. 다만 `makeTrigger` 헬퍼 패턴(같은 describe 블록의 Secret rotation 섹션에서 사용)이 신규 테스트에는 적용되지 않아 fixture 생성 방식이 두 가지로 분산된다.
- 제안: 이번 변경 범위의 두 케이스가 속한 describe block 에도 fixture 헬퍼(`makeScheduleTrigger` 등)를 두면 향후 케이스 추가 시 일관성이 높아진다. 현재로서는 경미한 수준.

---

## 요약

이번 변경의 전체적인 구조 분리(OverviewCard, WebhookConfigCard, ScheduleConfigurationCard 추출)와 query invalidation 기반 갱신 전략은 유지보수성을 실질적으로 높인다. 주된 유지보수 위험은 두 카드의 save/cancel 버튼 UI 패턴이 거의 동일하게 중복되어 있다는 점과, `mutationFn` 내부에 `window.confirm` + 매직 스트링 예외를 삽입한 패턴이다. 후자는 직관적이지 않아 수정 시 실수를 유도할 수 있다. 백엔드는 schedule guard 로직이 명확하고 주석도 충실하나, 거부 필드 목록의 상수화 및 grace period 값의 상수화가 미흡하다. 전체적으로는 기능 요구사항에 맞게 잘 작성되어 있으며, 위 사항들은 확장성 보강 차원이다.

## 위험도

MEDIUM

STATUS: SUCCESS
