# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[WARNING]** `Cafe24RefreshJobData.source` 유니온 타입 확장 — 기존 직렬화된 BullMQ 잡과의 런타임 호환성
  - 위치: `cafe24-token-refresh.constants.ts` — `source: 'proactive' | 'background' | 'reactive_401'`
  - 상세: BullMQ 잡 데이터는 Redis 에 JSON 직렬화 상태로 저장된다. 롤백 시나리오에서 이전 버전 코드가 `'reactive_401'` 값을 가진 잡 데이터를 처리하게 되면, TypeScript 타입은 유니온이지만 런타임 분기가 `'reactive_401'` 을 알지 못하는 구버전 워커에서 `source === 'reactive_401'` 조건이 never 로 평가되어 short-circuit 로직이 구버전 기본 동작(`proactive` 경로)으로 fallback 된다. 신규 배포 → 구버전 rollback 의 짧은 윈도우에 영향. 이는 additive 변경이고 forward-only 배포라면 문제없으나, zero-downtime rollback 환경에서는 유의가 필요하다.
  - 제안: 배포 순서를 (1) 워커(프로세서) 먼저 배포 후 (2) API 서버 배포로 직렬화하거나, 또는 배포 runbook 에 롤백 시 Redis 잡 큐 내 `reactive_401` 소스 잡이 완전히 소진됨을 확인하는 절차를 추가한다.

- **[WARNING]** `performAuthRefresh` 내부에서 `refreshViaQueue` 호출 시 source 가 `'proactive'` 에서 `'reactive_401'` 로 변경 — 기존 호출자 시맨틱 변경
  - 위치: `cafe24-api.client.ts` — `performAuthRefresh` 메서드, line ~1329
  - 상세: 기존 `performAuthRefresh` 는 `refreshViaQueue(integration, 'proactive')` 를 호출했다. 이번 변경으로 `refreshViaQueue(integration, 'reactive_401')` 을 호출하는데, `reactive_401` source 는 워커에서 short-circuit 을 skip 하고 항상 refresh 를 강제하며 BullMQ 잡의 `removeOnComplete: { age: 0 }` 으로 즉시 완료 잡 제거라는 두 가지 부작용이 있다. 의도된 변경이지만, `performAuthRefresh` 의 **다른 호출자**가 있다면 해당 호출자는 암묵적으로 `reactive_401` 시맨틱을 얻게 된다. 현재 코드베이스 내 `performAuthRefresh` 의 유일한 호출자가 401 자가 회복 경로임이 테스트로 검증되고 있어 직접적 위험은 낮으나, 시그니처 없이 내부 동작이 바뀐 케이스다.
  - 제안: `performAuthRefresh` 의 JSDoc 또는 인라인 주석을 갱신해 "이 메서드는 401 자가 회복 전용이며 항상 `reactive_401` source 로 enqueue 한다"는 사실을 명시해 향후 호출자가 오용하지 않도록 한다.

- **[WARNING]** 테스트 코드에서 `process.env.OAUTH_STUB_MODE` 및 `global.fetch` 의 뮤테이션 — 테스트 간 부작용
  - 위치: `integration-oauth.service.cafe24.spec.ts` — 새로 추가된 세 테스트 케이스 (JWT exp 우선, opaque fallback, TZ-less ISO 정규화)
  - 상세: 세 테스트 모두 `finally` 블록에서 `global.fetch = originalFetch` 및 `process.env.OAUTH_STUB_MODE = 'true'` 로 복원하고 있어 정상 복원 경로는 존재한다. 그러나 `try` 블록 내 `expect` assertion 실패(throw)가 발생하면 `finally` 가 항상 실행되어 복원이 보장되는 설계다. 단, `integrationRepo.save.mock.calls[0][0]` 에 접근할 때 save 가 실제로 호출되지 않으면(핵심 assert 전에 다른 throw) index 접근 오류로 인한 예외가 `finally` 를 건너뛰지 않으므로 복원은 안전하다. 이 패턴은 현재 코드에서 올바르게 구현되어 있지만, `try` 시작 직전에 `delete process.env.OAUTH_STUB_MODE` 가 `originalFetch` 저장 다음에 위치하는데, fetch mock 설정보다 env 변경이 먼저 일어나는 구조라 만약 fetch mock 설정 중 throw 가 일어나면 OAUTH_STUB_MODE 가 복원되지 않는 짧은 윈도우가 있다.
  - 제안: `delete process.env.OAUTH_STUB_MODE` 와 fetch mock 할당을 `try` 블록 안으로 완전히 이동하거나, `beforeEach`/`afterEach` 를 활용해 환경 상태를 관리한다. 또는 Jest 의 `jest.replaceProperty` / `jest.spyOn` 패턴으로 자동 복원되도록 리팩토링한다.

- **[WARNING]** `cafe24-api.client.spec.ts` 에서 `process.env.CAFE24_CLIENT_ID` / `CAFE24_CLIENT_SECRET` 뮤테이션 — teardown 경로 누락
  - 위치: `cafe24-api.client.spec.ts` — 새로 추가된 세 테스트 블록
  - 상세: 세 테스트 모두 `process.env.CAFE24_CLIENT_ID = 'env-id'` / `CAFE24_CLIENT_SECRET = 'env-secret'` 설정 후 테스트 끝에 `delete process.env.CAFE24_CLIENT_ID; delete process.env.CAFE24_CLIENT_SECRET;` 로 삭제한다. `try-finally` 없이 단순 순차 코드로 처리되어, 테스트 중간에 assertion 이 throw 되면 env 변수가 삭제되지 않은 채 다음 테스트로 이어진다. 기존의 같은 파일 내 다른 테스트도 이 패턴을 사용하므로 신규 테스트만의 문제는 아니지만, 이번 추가분도 동일한 취약 패턴을 답습하고 있다.
  - 제안: `afterEach(() => { delete process.env.CAFE24_CLIENT_ID; delete process.env.CAFE24_CLIENT_SECRET; })` 를 해당 `describe` 블록에 추가하거나, `try-finally` 로 감싸서 assertion 실패 시에도 복원을 보장한다.

- **[INFO]** `parseTokenExpiresAt` 에서 비-cafe24 provider 의 `expires_in` 읽기 순서 변경
  - 위치: `integration-oauth.service.ts` — `parseTokenExpiresAt` 함수
  - 상세: 기존 코드는 함수 진입 시 가장 먼저 `expires_in` 을 읽고 있었다. 변경 후에는 `if (provider === 'cafe24')` 분기 밖으로 `expires_in` 읽기가 이동하여 cafe24 이 아닌 다른 provider 에서도 동일하게 `expires_in` → null 순서로 읽는다. 로직 자체는 동일하지만, 코드 구조상 이 사실을 인지하지 못한 미래 기여자가 다른 provider 분기를 추가할 때 혼동할 수 있다.
  - 제안: 비-cafe24 provider 의 `expires_in` 처리가 함수 맨 아래 있다는 사실에 주석으로 명시한다 (이미 JSDoc 에 "다른 provider 는 표준 expires_in 만 사용" 가 있어 충분하다 — 현 상태 INFO).

- **[INFO]** `normalizeCafe24IsoTimezone` 함수 중복 — `hasTimezoneDesignator` 와 사실상 동일 구현
  - 위치: `integration-oauth.service.ts` 의 `hasTimezoneDesignator`, `cafe24-api.client.ts` 의 `normalizeCafe24IsoTimezone`
  - 상세: 두 함수 모두 `/Z$|[+-]\d{2}:?\d{2}$/` 정규식으로 TZ designator 유무를 검사하고, 없으면 `+09:00` 을 붙이는 동일한 로직을 수행한다. 파일이 달라 코드가 분리되어 있지만 내부 구현이 중복되어, 향후 정규식 수정이 한 곳에만 적용되는 드리프트 위험이 있다.
  - 제안: `jwt-exp.ts` 또는 `cafe24-token-refresh.constants.ts` 에 공통 유틸리티(`normalizeCafe24IsoTimezone` 또는 `appendKstIfTzLess`)를 두고 두 곳에서 참조하도록 리팩토링한다.

- **[INFO]** `refreshViaQueue` 시그니처 변경 — `source` 타입이 리터럴 유니온에서 인터페이스 참조로 변경
  - 위치: `cafe24-api.client.ts` — `refreshViaQueue(integration: Integration, source: 'proactive' | 'background')` → `source: Cafe24RefreshJobData['source']`
  - 상세: private 메서드이므로 외부 API 변경은 아니다. 타입이 `Cafe24RefreshJobData['source']` 인덱스 접근으로 변경되어 상수 파일의 인터페이스에 의존하게 됐다. 타입 정확성은 높아졌으나, `Cafe24RefreshJobData['source']` 가 변경되면 자동으로 영향을 받는 의존 관계가 생긴다. 의도된 tight coupling 이고 긍정적 변화이므로 INFO 수준.
  - 제안: 현재 설계가 적합하다 — 별도 조치 불필요.

## 요약

이번 변경의 핵심은 Cafe24 JWT `exp` claim 을 만료 시각의 단일 진실 출처로 격상하고, 401 자가 회복 경로에 `'reactive_401'` source 를 도입해 워커 short-circuit 을 선택적으로 bypass 하는 것이다. 부작용 관점에서 가장 주목할 점은 두 가지다. 첫째, `performAuthRefresh` 의 내부 호출 source 가 `'proactive'` 에서 `'reactive_401'` 로 변경되면서 BullMQ 잡의 `removeOnComplete` 옵션과 워커 short-circuit 동작이 암묵적으로 달라지는 시맨틱 부작용이 있으나 이는 의도된 수정이다. 둘째, 새 `source` 값이 Redis 에 직렬화되는 잡 데이터에 포함되므로 롤백 배포 시 이전 버전 워커와의 호환성을 고려해야 한다. 테스트 파일에서 `process.env` 와 `global.fetch` 를 뮤테이션한 후 `try-finally` 없이 복원하는 패턴이 일부 케이스에서 발견되어, assertion 실패 시 환경 오염이 후속 테스트에 전파될 수 있는 경미한 부작용 위험이 존재한다. 전체적으로 핵심 로직 변경은 잘 캡슐화되어 있고 의도치 않은 전역 상태 변경이나 외부 네트워크 호출 추가는 없다.

## 위험도

LOW
