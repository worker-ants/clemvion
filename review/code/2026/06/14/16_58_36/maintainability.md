# 유지보수성(Maintainability) 리뷰

리뷰 대상: EIA terminal revoke reconciler — RECONCILE_TERMINAL_STATUSES 상수 rename + system-status 큐 등록

---

## 발견사항

### [INFO] RECONCILE_TERMINAL_STATUSES 상수 rename — 네이밍 명확성 개선
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` 상수 블록
- 상세: `TERMINAL_STATUSES` 에서 `RECONCILE_TERMINAL_STATUSES` 로 rename 하면서 JSDoc 에 "SQL `IN` 절용 배열. `interaction.service.ts` 의 동명 `ReadonlySet`(`.has()` 용)과 용도·타입이 달라 파일별 private 로 분리 — 이름 충돌 회피 위해 `RECONCILE_` prefix" 라는 상세 설명이 추가됐다. rename 의 이유와 동명 상수와의 차이가 명문화되어 유지보수자가 두 상수의 공존 의도를 쉽게 파악할 수 있다. 전 회차 naming_collision 리뷰가 지적한 동명 중복 위험이 prefix 로 해소된 올바른 처리다.
- 제안: 없음.

### [INFO] RECONCILE_ prefix 일관성 — 기존 상수 블록과 네이밍 패턴 정합
- 위치: `interaction-token.service.ts` — `RECONCILE_BATCH_LIMIT`, `RECONCILE_BATCH_MAX`, `RECONCILE_CONCURRENCY`, `RECONCILE_TERMINAL_STATUSES` 상수 블록
- 상세: 이번 rename 으로 sweep 관련 모든 상수가 `RECONCILE_` prefix 로 통일됐다. 네이밍 패턴이 일관되어 관련 상수 집합을 한눈에 식별하기 쉬워졌다. `IEXT_*`, `ITK_*`, `RECONCILE_*` 세 그룹이 각각 역할 구분이 명확하다.
- 제안: 없음.

### [INFO] system-status.constants.ts 큐 등록 위치 — 기존 단일행 형식과 멀티행 형식 혼용
- 위치: `codebase/backend/src/modules/system-status/system-status.constants.ts` L71-80
- 상세: 기존 항목들은 `{ name: X, group: 'system', concurrency: 1 }` 를 한 줄로 표기하는 반면, 신규 `TERMINAL_REVOKE_RECONCILE_QUEUE` 항목은 프로퍼티를 각 줄로 나눈 멀티행 형식을 사용한다. 기능 차이는 없으나 스타일 일관성이 약간 깨진다. Prettier 등 포매터가 자동 통일했거나 의도적 선택일 수 있다.
- 제안: 코드베이스가 Prettier 를 사용한다면 포매터 자동 출력이므로 문제없다. 수동 형식이라면 기존 단일행 패턴으로 맞추는 것이 일관성 측면에서 낫다. INFO 수준.

### [INFO] system-status.constants.ts — 서비스 구현 파일에서 큐 상수 import
- 위치: `codebase/backend/src/modules/system-status/system-status.constants.ts` L10 import 문
- 상세: `TERMINAL_REVOKE_RECONCILE_QUEUE` 를 `terminal-revoke-reconciler.service` 파일에서 import 한다. `NOTIFICATION_WEBHOOK_QUEUE` 는 `notification-dispatcher.types.ts` 별도 타입 파일에 위치하는 것과 달리 서비스 구현 파일이 import 원본이라 `system-status.constants.ts` 가 서비스 구현 전체를 간접 참조하게 된다. 전 회차 architecture/documentation 리뷰에서도 지적된 패턴 불일치다. 현 diff 범위에서는 이 구조가 유지되고 있다.
- 제안: 현 규모에서 즉각 리팩토링 필수는 아님. `terminal-revoke-reconciler.types.ts` 를 분리해 큐 상수를 이동하면 `system-status.constants.ts` 의 불필요한 서비스 의존을 제거할 수 있다. INFO 수준.

### [INFO] e2e-spec 큐 이름 하드코딩 — 상수 참조 대신 문자열 리터럴
- 위치: `codebase/backend/test/system-status.e2e-spec.ts` L37
- 상세: `'terminal-revoke-reconcile'` 이 문자열 리터럴로 `EXPECTED_QUEUE_NAMES` 배열에 추가됐다. 큐 이름이 변경될 경우 `TERMINAL_REVOKE_RECONCILE_QUEUE` 상수와 이 리터럴을 별도로 갱신해야 한다. 다만 e2e 파일이 특정 서비스 파일을 직접 import 하지 않는 패턴이 의도적인 격리 설계일 수 있다.
- 제안: 분리된 types 파일(예: `terminal-revoke-reconciler.types.ts`)로 상수를 이동하면 e2e 에서 import 해 단일 진실을 보장하기 용이해진다. 선택 사항, INFO 수준.

---

## 요약

이번 diff 는 세 가지 소규모 변경으로 구성된다: (1) `interaction-token.service.ts` 의 `TERMINAL_STATUSES` → `RECONCILE_TERMINAL_STATUSES` rename(명명 충돌 해소, JSDoc 상세화), (2) `system-status.constants.ts` 에 `TERMINAL_REVOKE_RECONCILE_QUEUE` 큐 모니터링 등록, (3) `system-status.e2e-spec.ts` 에 큐 이름 추가. rename 은 `RECONCILE_` prefix 통일로 상수 블록의 가독성과 일관성을 높였고, 시스템 상태 모니터링 등록은 전 회차 naming_collision 리뷰가 지적한 미등록 갭을 닫는다. 발견된 사항은 모두 INFO 등급이며 즉각 조치가 필요한 유지보수성 문제는 없다.

---

## 위험도

LOW
