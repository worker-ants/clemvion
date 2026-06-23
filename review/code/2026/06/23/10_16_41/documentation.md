# 문서화(Documentation) Review

## 발견사항

### [INFO] `useTrigger` hook — JSDoc 없음
- **위치**: `/codebase/frontend/src/components/triggers/hooks/use-trigger.ts` (전체, 16줄)
- **상세**: `triggerId: string | null` 과 `open: boolean` 파라미터의 의도가 시그니처만으로 명확하지 않다. `open` 이 `enabled` 조건으로 drawer 가 닫힌 상태에서 쿼리를 비활성화한다는 사실은 비자명(non-obvious)하다. 반환 타입 `{ trigger, isLoading, invalidate }` 에서 `invalidate` 가 `["trigger-detail"]` 과 `["triggers"]` 두 query key 를 함께 무효화한다는 부수 효과도 주석 없이는 추적이 필요하다.
- **제안**: 최소한 함수 상단에 한 줄 JSDoc 추가 — "drawer `open` prop 과 연동해 열렸을 때만 fetch, `invalidate()` 는 detail + list 양쪽 캐시를 무효화한다" 수준으로 충분.

### [INFO] `useCardEditToggle` hook — 함수 레벨 JSDoc 없음
- **위치**: `/codebase/frontend/src/components/triggers/hooks/use-card-edit-toggle.ts` (전체, 15줄)
- **상세**: `cancelEdit` 의 `onReset?: () => void` 콜백 설명은 인라인 JSDoc(`/** onReset 로 ... */`)으로 처리됐으나, 훅 자체에 문서가 없다. 훅이 "4개 카드가 공유하는 편집 토글" 임을 외부 소비자(신규 카드 추가 시)가 알기 어렵다.
- **제안**: 함수 상단에 `/** 트리거 카드 공용 편집 토글 — edit/cancel/startEdit 상태와 onReset 콜백 패턴을 제공한다. */` 한 줄 JSDoc.

### [INFO] `ExternalInteractionCard` — 주석이 export 가 아닌 상수에 붙어있음 (구조적 오해 유발)
- **위치**: `/codebase/frontend/src/components/triggers/cards/external-interaction-card.tsx` 줄 743-755
- **상세**: JSDoc 블록(`/** Spec EIA §4 — External Interaction API ... */`)이 `NOTIFICATION_EVENT_CHOICES` 상수 바로 위에 선언돼 있어, 이 주석이 상수에 대한 설명인지 이어서 오는 `ExternalInteractionCard` 컴포넌트에 대한 설명인지 외형상 모호하다. `ExternalInteractionCard` export 함수 자체에는 JSDoc이 없다.
- **제안**: JSDoc 을 `NOTIFICATION_EVENT_CHOICES` 와 분리하여 `export function ExternalInteractionCard` 바로 위에 배치한다. 상수는 별도 한 줄 주석(`// 알림 이벤트 선택지 — spec EIA §4`) 으로 처리한다.

### [INFO] `WebhookConfigCard` — 공개 export 함수에 JSDoc 없음
- **위치**: `/codebase/frontend/src/components/triggers/cards/webhook-config-card.tsx` 줄 1508
- **상세**: `WebhookConfigCard` 는 5개 카드 중 유일하게 cURL 예시 생성 로직(`getCurlExample`)을 포함하는 카드로 복잡도가 높지만, 컴포넌트 수준 JSDoc이 없다. `getCurlExample` 내부의 인증 타입별 분기 로직에는 "인증 자료 평문은 노출하지 않고 placeholder 만" 인라인 주석이 있어 충분하나, 카드 자체의 책임 경계(endpointPath + authConfigId 편집 전용, hmacSecret rotate 금지 등)를 외부에서 파악하기 어렵다.
- **제안**: `export function WebhookConfigCard` 상단에 `/** Webhook 설정 카드 — endpointPath / authConfigId 편집. hmacSecret rotate 는 R-14 단일경로에 따라 본 카드에서 제공하지 않는다. */` 수준 JSDoc 추가.

### [INFO] `OverviewCard` — 공개 export 함수에 JSDoc 없음
- **위치**: `/codebase/frontend/src/components/triggers/cards/overview-card.tsx` 줄 1180
- **상세**: `ChatChannelCard`(spec §, Rationale R-8 참조), `ExternalInteractionCard`(Spec EIA §4 참조) 등 다른 카드는 spec 참조 주석을 보유하나, `OverviewCard` 에는 없다.
- **제안**: `/** Trigger Overview 카드 — name 편집 + type/status/workflow 표시. spec 2-trigger-list §2.3.1 */` 한 줄 추가.

### [INFO] `ScheduleConfigurationCard` — JSDoc 없음
- **위치**: `/codebase/frontend/src/components/triggers/cards/schedule-config-card.tsx` 줄 1376
- **상세**: 5개 카드 중 가장 단순(65줄)하지만, "schedule 트리거 전용, 직접 편집 불가 — `/schedules` 링크로 위임" 정책이 주석 없이 코드에만 암묵적으로 표현된다.
- **제안**: 함수 상단에 한 줄 주석으로 "cronExpression/timezone/nextRunAt 표시 전용. 편집은 /schedules 페이지로 위임" 명시.

### [INFO] `ChatChannelCard` 내부 헬퍼 함수 3개 — 문서 없음
- **위치**: `/codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx` 줄 385–401 (`providerLabel`, `visualNodeLabel`, `formModeLabel`)
- **상세**: 세 함수는 컴포넌트 본체 안에 선언된 module-private 헬퍼이며 복잡도는 낮다. `ChatChannelCard` 의 JSDoc 에는 `spec §5.4.1`, `CCH-SE-03`, `spec §5.4.2` 참조가 있어 전체적으로 문서화 수준이 다른 카드보다 높다. 헬퍼에 대한 추가 주석은 필수는 아니다.
- **제안**: 현 수준 유지 가능(INFO). 필요 시 헬퍼를 컴포넌트 바깥으로 이동할 때 JSDoc 추가.

### [INFO] README/CHANGELOG 업데이트 불필요
- **위치**: 해당 없음
- **상세**: 이번 변경은 behavior-preserving 내부 리팩토링(god-component 파일 분리)이며, 공개 API 변경·신규 기능·환경변수 추가가 없다. README 또는 CHANGELOG 업데이트가 필요한 표면 변경은 없다.

### [INFO] 설정/환경변수 문서화 — 해당 없음
- **상세**: 신규 환경변수나 설정 옵션이 추가되지 않았으므로 별도 설정 문서가 필요하지 않다.

---

## 요약

이번 변경은 `trigger-detail-drawer.tsx` god-component 를 5개 카드 파일(`cards/`) + 2개 훅(`hooks/`)으로 동작 보존 추출한 순수 리팩토링이다. `ChatChannelCard` 는 spec 참조(`§5.4.1`, `CCH-SE-03`, `R-8`) 및 보안 주석(`onError` 에서 서버 메시지 미노출 근거)이 잘 갖춰져 있어 문서화 기준이 높다. 반면 `WebhookConfigCard`, `OverviewCard`, `ScheduleConfigurationCard`, `ExternalInteractionCard` 는 공개 export 함수에 JSDoc이 없거나, 주석 위치가 구조적으로 모호하다. 두 훅(`useTrigger`, `useCardEditToggle`)도 함수 레벨 JSDoc이 부재하다. 모두 동작에는 영향이 없는 INFO 수준이며, 신규 카드 추가나 팀 온보딩 시 추적 비용을 높이는 잠재 문제로 분류된다. README/CHANGELOG/환경변수 문서화는 이번 변경 범위 밖이다.

## 위험도

LOW

---

STATUS: SUCCESS
