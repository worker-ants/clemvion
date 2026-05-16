# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `sanitizePayloadForWs` 변경 — 논리 복잡도 증가 (websocket.service.ts)
  - 위치: `backend/src/modules/websocket/websocket.service.ts` (배열/객체 처리 블록)
  - 상세: 원본 참조 반환 최적화(W-25) 적용 후 함수 내 분기가 눈에 띄게 복잡해졌다. 배열 경로에서 `mutated` 플래그를 관리하고, 객체 경로에서 `result = null`로 lazy 초기화하는 패턴이 한 함수에 혼재한다. 기능 자체는 올바르나, 배열·객체 두 분기 각각이 "변경 감지 → 조건부 새 객체 생성" 로직을 독립적으로 구현해 패턴 불일치가 생긴다. 향후 수정 시 두 분기를 따로 이해해야 하는 부담이 있다.
  - 제안: 배열과 객체 최적화 로직을 각각 `sanitizeArray` / `sanitizeObject` 헬퍼로 분리하면 각 경로가 단일 책임을 갖고 메인 함수 가독성이 회복된다.

- **[INFO]** `moduleLogger` 네이밍 — 모듈 수준 Logger 인스턴스 이름 불일치 (integration-oauth.service.ts)
  - 위치: `backend/src/modules/integrations/integration-oauth.service.ts:279`
  - 상세: `const moduleLogger = new Logger('IntegrationOAuthService')` 로 선언됐는데 변수명 `moduleLogger` 는 다른 파일의 `logger` (credentials-transformer.ts, table.handler.ts)와 컨벤션이 맞지 않는다. 같은 패턴을 적용한 세 파일이 각각 `logger`, `moduleLogger`, `logger` 로 선언해 일관성이 없다.
  - 제안: 모든 모듈 수준 Logger 변수를 `logger` 로 통일한다. `integration-oauth.service.ts` 의 `moduleLogger` → `logger` 로 변경.

- **[INFO]** `10_000` 매직 넘버 — 상수 정의 위치와 사용 위치의 불일치 (executions.service.spec.ts)
  - 위치: `backend/src/modules/executions/executions.service.spec.ts:354`
  - 상세: `take: 10_000` 이 테스트 파일에 리터럴로 하드코딩되어 있다. 실제 값은 `executions.service.ts` 상단의 `MAX_EXECUTION_PATH_ROWS = 10_000` 상수에서 왔지만, 테스트는 해당 상수를 import하지 않고 숫자를 직접 사용한다. 상한값이 바뀔 때 테스트가 자동으로 따라가지 않아 불일치가 발생할 수 있다.
  - 제안: 테스트에서 `MAX_EXECUTION_PATH_ROWS` 를 export하거나, 별도 constants 파일로 분리해 테스트와 구현이 동일 상수를 참조하도록 한다.

- **[INFO]** `V052` 마이그레이션 파일 — `notification_type_check` 명칭이 기존 V001 제약 이름과 다를 경우 무결성 위험 (V052 SQL)
  - 위치: `backend/migrations/V052__notification_type_integration_action_required.sql:5`
  - 상세: `DROP CONSTRAINT IF EXISTS notification_type_check` 와 `ADD CONSTRAINT notification_type_check` 가 사용되는데, 기존 V001에서 실제로 생성된 제약 이름이 다를 경우 DROP이 무음 실패(`IF EXISTS`)하고 ADD가 충돌 없이 통과해 두 개의 CHECK 제약이 공존할 수 있다. 마이그레이션 파일에 기존 제약 이름을 확인하는 주석이나 fallback 처리가 없다.
  - 제안: V001 원본 제약 이름을 주석으로 명시하거나, `pg_constraint` 조회로 이름을 확인하는 주석을 추가해 독자가 검증할 수 있도록 한다. 또는 DROP 구문에 기존 이름 후보를 모두 나열한다.

- **[INFO]** `HMAC_ALLOWED_ALGORITHMS` 상수 위치 — 모듈 최상위 const와 관련 로직 간 거리 (hooks.service.ts)
  - 위치: `backend/src/modules/hooks/hooks.service.ts:18`
  - 상세: `HMAC_ALLOWED_ALGORITHMS` 가 파일 최상위에 선언되어 있고 실제 사용 위치(`verifyAuth` 내부)와 물리적으로 멀다. 이 자체는 일반적인 패턴이나, `WebhookConfig` 인터페이스나 관련 타입 바로 옆에 두는 것이 응집도 면에서 더 낫다.
  - 제안: `HMAC_ALLOWED_ALGORITHMS` 을 `WebhookConfig` 인터페이스 선언 바로 위로 이동해 설정 관련 상수가 한 구역에 모이도록 한다.

- **[INFO]** `sanitizePayloadForWs` — 내부 변수 `result`의 두 가지 역할 혼재 (websocket.service.ts)
  - 위치: `backend/src/modules/websocket/websocket.service.ts` (객체 분기)
  - 상세: 객체 경로에서 `result`가 `null | Record<string, unknown>` 두 타입을 오가며, 마지막에 `result ?? value`로 반환하는 패턴은 의도를 즉시 파악하기 어렵다. `null`은 "변경 없음"을 의미하는 sentinel로 쓰이는데, 이 의미가 변수 이름 `result`에서 드러나지 않는다.
  - 제안: `let mutatedObj: Record<string, unknown> | null = null` 처럼 이름으로 의미를 명확히 하고, 배열 분기의 `mutated` 플래그와 대칭 구조를 맞춘다.

- **[WARNING]** `statistics.service.ts` 리팩토링 — `workflowId` 없을 때도 `qb.andWhere` 체인이 아닌 early-assign 패턴 혼재 (statistics.service.ts)
  - 위치: `backend/src/modules/statistics/statistics.service.ts:83–1544`
  - 상세: 변경 후 `qb`를 먼저 빌드하고 조건부로 `qb.andWhere(...)` 를 추가한 뒤 `getRawOne()` 을 호출하는 패턴 자체는 깔끔해졌다. 그러나 `qb.andWhere(...)` 의 반환값(같은 `qb` 인스턴스)을 무시하고 `qb` 를 직접 변이시키는 방식은 TypeORM QueryBuilder 의 immutable chaining 관용구와 다르다. 일부 버전에서는 `.andWhere()` 가 새 인스턴스를 반환하므로 호출 이후 원본 `qb` 가 변경되지 않을 수 있다.
  - 제안: `if (query.workflowId) { qb = qb.andWhere(...); }` 처럼 반환값을 재할당하거나, TypeORM QueryBuilder 가 실제로 mutable 임을 주석으로 명시해 다음 독자의 혼란을 방지한다.

- **[WARNING]** `hooks.service.spec.ts` — 테스트 fixture 인라인 객체 반복 (hooks.service.spec.ts)
  - 위치: `backend/src/modules/hooks/hooks.service.spec.ts:1012–1134`
  - 상세: 새로 추가된 `auth — bearer / HMAC` describe 블록 내에서 `bearerTrigger`, `hmacTrigger`, `noTriggerParamsNode` 세 fixture가 describe scope 최상단에 한 번 선언되어 있고 모든 it 블록이 공유하는 구조는 좋다. 그러나 여러 it에서 `triggerRepo.findOne.mockResolvedValue(bearerTrigger)` / `nodeRepo.findOne.mockResolvedValue(noTriggerParamsNode)` 가 거의 매번 반복된다. 각 테스트가 독립적이어야 하는 원칙상 mock 재설정이 필요하지만, 공통 부분을 `beforeEach`로 끌어올리면 중복을 줄일 수 있다.
  - 제안: bearer/HMAC 공통 mock 설정(`triggerRepo.findOne`, `nodeRepo.findOne`)을 `beforeEach`로 이동하고, 예외 케이스(잘못된 trigger config 등)만 개별 it에서 override한다.

## 요약

이번 변경은 Critical 7건 + Warning 15건을 일괄 처리한 bugfix 커밋으로, 유지보수성 관점에서 전반적으로 긍정적인 방향이다. `MAX_EXECUTION_PATH_ROWS` 상수 도입, `console.*` → NestJS Logger 일괄 교체, 중복 쿼리 통합, `nodeMap` 재사용 등은 모두 코드의 명확성과 일관성을 높였다. 다만 `sanitizePayloadForWs` 최적화 과정에서 함수 내 분기 복잡도가 소폭 증가해 변수명이 의미를 충분히 전달하지 못하는 부분이 생겼고, 모듈 수준 Logger 변수 이름이 파일마다 달라 컨벤션 불일치가 발생했다. 또한 `MAX_EXECUTION_PATH_ROWS` 상수가 테스트 파일에 리터럴로 중복 기재되어 단일 진실 원칙에서 벗어나 있다. 이 항목들은 기능적 결함은 아니지만 향후 수정 시 혼란을 줄 수 있어 개선을 권장한다.

## 위험도

LOW
