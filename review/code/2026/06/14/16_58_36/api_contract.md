# API 계약(API Contract) Review

## 발견사항

### [INFO] GET /system-status/overview — queues[] 배열에 신규 항목 추가 (additive change)
- 위치: `codebase/backend/src/modules/system-status/system-status.constants.ts` — `MONITORED_QUEUES` 배열에 `TERMINAL_REVOKE_RECONCILE_QUEUE` 항목 추가
- 상세: `MONITORED_QUEUES` 에 항목을 추가하면 `GET /system-status/overview` 응답의 `queues[]` 배열에 `{ name: "terminal-revoke-reconcile", group: "system", ... }` 항목이 신규로 포함된다. 응답 스키마 구조(`SystemStatusOverviewDto` / `QueueStatusDto`)는 변경되지 않고 기존 필드 형식을 그대로 사용하므로 이는 additive change 이다. 배열 항목 수가 늘어나는 것에 대해 엄격한 항목 수 검증을 수행하는 클라이언트가 있다면 영향을 받을 수 있으나, REST 관례상 배열에 항목이 추가되는 것은 non-breaking 변경으로 분류된다. e2e 테스트(`system-status.e2e-spec.ts`)의 `EXPECTED_QUEUE_NAMES` 에도 동일하게 `'terminal-revoke-reconcile'` 을 추가하여 일관성이 유지되어 있음.
- 제안: 현 변경은 non-breaking additive change 로 판단한다. API 버전 범프 불필요. 다만 클라이언트 팀이 `queues[]` 항목 수를 하드코딩하거나 알려진 이름 목록을 exhaustive 검증하는 경우 사전 고지가 권장된다.

### [INFO] interaction-token.service.ts — 상수 이름 변경은 내부 전용, API 표면 영향 없음
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` — `TERMINAL_STATUSES` → `RECONCILE_TERMINAL_STATUSES` 이름 변경
- 상세: 해당 상수는 파일 내 `const` (비 export) 로 선언되어 있으며 TypeORM QueryBuilder 의 SQL `IN` 절 파라미터로만 사용된다. HTTP 요청/응답 DTO, URL 경로, 인증/인가 계층, 페이지네이션 파라미터 등 어떤 API 표면에도 노출되지 않는다. 클라이언트 계약에 영향 없음.
- 제안: 없음.

## 요약

본 변경 세트에서 API 계약 관점의 실질적 변경은 `GET /system-status/overview` 응답의 `queues[]` 배열에 `terminal-revoke-reconcile` 큐 항목이 추가되는 것 하나다. 응답 스키마 구조(`SystemStatusOverviewDto` / `QueueStatusDto`) 는 변경되지 않았으며 기존 필드 형식을 그대로 준수하므로 이는 additive(비파괴적) 변경이다. `interaction-token.service.ts` 의 내부 상수 이름 변경은 비 export 파일 내부 리팩토링이므로 API 표면에 전혀 영향이 없다. 나머지 파일들(review 산출물)은 API 계약과 무관하다. 기존 API 클라이언트에 대한 breaking change 위험은 없다.

## 위험도

NONE
