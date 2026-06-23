# 신규 식별자 충돌 검토 — M-8 2단계 (trigger card 파일 분리)

검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/2-navigation)
대상: M-8 2단계 — `trigger-detail-drawer.tsx` 카드 컴포넌트 파일 분리 + hooks 추출

---

## 발견사항

### [WARNING] `OverviewCard` 이중 정의 — 기존 파일과 신규 파일 충돌

- **target 신규 식별자**: `export function OverviewCard` — `/codebase/frontend/src/components/triggers/cards/trigger-overview-card.tsx:22`
- **기존 사용처**: `function OverviewCard` — `/codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx:117` (module-private 함수)
- **상세**: 새로 작성된 `cards/trigger-overview-card.tsx` 는 `OverviewCard` 를 named export 로 정의한다. 기존 `trigger-detail-drawer.tsx` 도 동일 이름 `OverviewCard` 를 module-private 함수로 정의하고 있으며, drawer 는 아직 cards/ 파일을 import 하지 않는다. 두 파일이 공존하는 현 상태에서 drawer 를 cards/ 로 교체할 때 import 누락이나 이름 shadowing 으로 인한 빌드 오류 또는 silent regression 이 발생할 수 있다. plan(`02-architecture.md:383`)은 `TriggerOverviewCard` 라는 이름을 제안했으나, 실제 구현체는 `OverviewCard` 를 사용하고 있어 plan 명칭과도 불일치한다.
- **제안**: `cards/trigger-overview-card.tsx` 의 export 를 `TriggerOverviewCard`(또는 동등한 trigger-scoped 이름)로 변경하거나, drawer 리팩토링 완료 시 기존 drawer 내 `OverviewCard` 정의를 즉시 제거한다. 두 정의가 동시에 존재하는 기간이 짧더라도 이름이 동일하면 코드 탐색·테스트 grep 시 혼선을 유발한다.

---

### [INFO] `TYPE_BADGE_STYLES` 상수 중복 정의

- **target 신규 식별자**: `const TYPE_BADGE_STYLES` — `/codebase/frontend/src/components/triggers/cards/trigger-overview-card.tsx:16`
- **기존 사용처**: `const TYPE_BADGE_STYLES` — `/codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx:45`
- **상세**: 두 파일이 동일 이름·동일 값의 module-level 상수를 각자 정의하고 있다. 현재는 module scope 이라 런타임 충돌은 없으나, 카드 분리가 완료된 뒤에도 drawer 에 이 상수가 잔존하면 불필요한 중복이 유지된다. 또한 다른 카드 파일에서 동일 상수를 필요로 할 경우 세 번째 중복이 생긴다.
- **제안**: 카드 분리 완료 시 `TYPE_BADGE_STYLES` 를 `cards/_shared.ts` 등 공용 모듈로 올리고 각 카드가 import 하도록 통합한다.

---

### [INFO] `useTrigger` hook 의 query key 중복 — `trigger-detail-drawer.tsx` 와 `hooks/use-trigger.ts` 공존

- **target 신규 식별자**: `queryKey: ["trigger-detail", triggerId]` — `/codebase/frontend/src/components/triggers/hooks/use-trigger.ts:7`
- **기존 사용처**: `queryKey: ["trigger-detail", triggerId]` — `/codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx:61`
- **상세**: `useTrigger` hook 을 신설해 query/invalidation 로직을 추출했으나 drawer 는 아직 이를 사용하지 않고 동일 query key 로 inline `useQuery` 를 직접 호출한다. 두 경로가 공존하는 과도기에 동일 캐시 키를 두 컴포넌트가 독립적으로 subscribe 하는 것 자체는 React Query 상 무해하지만, invalidation 을 drawer 에서 호출하면 hook 쪽과 책임이 분산된다.
- **제안**: 카드 파일 추출 시 drawer 도 `useTrigger` hook 을 사용하도록 교체해 query 관리 단일 진실 확립. 과도기 동안 두 경로 중 어느 쪽을 사용하는지를 주석으로 명시한다.

---

### [INFO] plan 제안 이름(`EiaNotificationCard`, `ScheduleCard`) vs 현행 코드 이름(`ExternalInteractionCard`, `ScheduleConfigurationCard`) 불일치

- **target 신규 식별자**: plan(`02-architecture.md:383`)이 제안한 `EiaNotificationCard` / `ScheduleCard`
- **기존 사용처**: `/codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` 내 `function ExternalInteractionCard`(line 595), `function ScheduleConfigurationCard`(line 264)
- **상세**: plan 은 `EiaNotificationCard` / `ScheduleCard` 를 카드 파일 이름으로 제안했으나 현행 drawer 의 내부 이름은 `ExternalInteractionCard` / `ScheduleConfigurationCard` 다. spec §2.3.1 매트릭스는 "External Interaction", "Schedule Configuration" 이라는 카드 라벨을 사용한다. 새 파일을 어느 이름으로 만들지 결정이 필요하다. `EiaNotificationCard` 는 "EIA" 약어로 Notification 측면만 부각하는 반면, 실제 카드는 Notification + Interaction 두 섹션을 포함한다.
- **제안**: spec §2.3.1 의 카드 라벨("External Interaction")을 따라 `ExternalInteractionCard` (또는 `TriggerExternalInteractionCard`)로 통일한다. `EiaNotificationCard` 는 의미가 좁아 혼선 유발 가능. `ScheduleConfigurationCard` 유지가 spec 카드 라벨("Schedule Configuration")과 일치한다.

---

## 요약

M-8 2단계 구현 착수 시점에 `/codebase/frontend/src/components/triggers/cards/` 와 `hooks/` 디렉토리가 이미 부분 생성된 상태다. 가장 주목해야 할 충돌은 `OverviewCard` 이름 중복으로, 신규 파일(`cards/trigger-overview-card.tsx`)과 기존 파일(`trigger-detail-drawer.tsx`) 양쪽에 동일 이름 함수가 존재한다. plan 이 제안한 `TriggerOverviewCard` 대신 `OverviewCard` 가 사용되어 plan 명칭과도 불일치한다. 나머지 항목(`TYPE_BADGE_STYLES` 중복, query key 이중 관리, plan-vs-code 카드 이름 불일치)은 카드 분리 완료 후 정리 대상이다. 새 API endpoint, 요구사항 ID, 환경변수, spec 파일 경로 충돌은 발견되지 않았다.

## 위험도

LOW
