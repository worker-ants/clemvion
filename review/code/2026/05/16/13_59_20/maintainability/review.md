# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

### cafe24-api.client.ts — pingConnection

- **[WARNING]** 함수 길이 및 복잡도: `pingConnection` 메서드가 약 95줄에 달하며, proactive refresh, rawPing, 401 분기 retry, transport/auth 오류 변환까지 4개의 책임을 하나의 함수에서 처리한다.
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts`, `pingConnection` 메서드 전체 (약 271~726 라인 범위의 추가 코드)
  - 상세: 오류 변환 패턴(`catch` → `Cafe24AuthFailedError` / `Cafe24TransportFailedError` → `{ success: false, code, message }`)이 proactive refresh 블록과 401 retry 블록 양쪽에 동일하게 반복된다. 순환 복잡도가 높으며(if/catch가 10개 이상 중첩), 테스트 케이스마다 다른 흐름을 유발하는 경로가 많아 변경 시 부작용 파악이 어렵다.
  - 제안: 오류 변환 로직을 `private toTestResult(err: unknown): { success: false; code: string; message: string }` 같은 헬퍼로 추출해 두 catch 블록에서 공유한다. proactive refresh 시도 로직과 retry 시도 로직을 각각 `private attemptProactiveRefresh` / `private attemptRetryAfter401`로 분리하면 `pingConnection` 본체를 15~20줄 수준으로 줄일 수 있다.

- **[WARNING]** 중복 오류 변환 코드: proactive refresh catch 블록(라인 643~658)과 401 retry catch 블록(라인 686~702)이 동일한 오류 타입 판별·반환 구조를 복사·붙여넣기 형태로 반복한다.
  - 위치: `pingConnection` 내 두 개의 `try/catch` 블록
  - 상세: `Cafe24AuthFailedError` → `CAFE24_AUTH_FAILED`, `Cafe24TransportFailedError` → `CAFE24_TRANSPORT_FAILED` 변환이 두 곳에 동일하게 존재한다. 새로운 오류 타입이 추가될 경우 두 곳을 모두 수정해야 하므로 누락 위험이 있다.
  - 제안: `private mapPingError(err: unknown): { success: false; code: string; message: string } | never` 헬퍼를 추출하고 두 catch 블록을 `return this.mapPingError(err)` 한 줄로 대체한다.

- **[INFO]** 매직 넘버: `rawPing`에서 timeout이 `30_000`(ms)으로 하드코딩되어 있다.
  - 위치: `rawPing` 메서드, `setTimeout(() => controller.abort(), 30_000)` 라인
  - 상세: `30_000`이 어디서 유래한 값인지(스펙, 인프라 공통 timeout 정책 등) 코드만으로는 파악할 수 없다. 다른 fetch 경로의 timeout 값과 일치하는지도 확인이 필요하다.
  - 제안: `private static readonly PING_TIMEOUT_MS = 30_000;` 상수로 선언하거나, 모듈 레벨 상수(`CAFE24_PING_TIMEOUT_MS`)로 분리해 의도를 명시한다.

- **[INFO]** credentials 재참조 패턴의 가독성: `tokenAfterProactive` 변수 할당 시 `((integration.credentials ?? {}) as Cafe24Credentials).access_token ?? creds.access_token!` 형태로 동일한 cast 표현이 세 곳(`creds` 초기화, `tokenAfterProactive`, `refreshedToken`)에 걸쳐 등장한다.
  - 위치: `pingConnection` 메서드 내 `creds`, `tokenAfterProactive`, `refreshedToken` 변수 할당부
  - 상세: `integration.credentials` 가 `pingConnection` 수행 중 side-effect로 갱신될 수 있음(refresh 후 credential mutation)을 표현하려는 의도인데, `creds`를 재참조하는 방식이 읽는 사람에게 혼란을 준다. `tokenAfterProactive`와 `refreshedToken`의 명명도 유사해서 각 단계의 차이를 바로 파악하기 어렵다.
  - 제안: credentials를 읽는 헬퍼 `private currentAccessToken(integration: Integration): string`를 만들어 매번 `(integration.credentials as Cafe24Credentials).access_token!`을 반복하지 않도록 하고, 변수명을 `tokenBeforeRetry` / `tokenAfterRefresh` 처럼 단계를 명시하는 이름으로 정리한다.

---

### integrations.service.ts — registerEntityTester / entityTesters

- **[INFO]** `registerEntityTester`는 "Last registration wins" 정책을 JSDoc에 명시했으나, 동일 `serviceType`에 대해 중복 등록이 발생해도 경고 없이 덮어쓴다. 개발 환경에서 실수로 두 모듈이 같은 타입을 등록했을 때 원인 파악이 어려울 수 있다.
  - 위치: `integrations.service.ts`, `registerEntityTester` 메서드
  - 상세: 현재 cafe24 외 entity-aware tester는 없지만, 패턴이 재사용될 경우 silent overwrite가 버그의 원인이 될 수 있다.
  - 제안: `if (this.entityTesters.has(serviceType))` 체크 후 `this.logger.warn(...)` 또는 `Logger.warn`으로 중복 등록 경고를 남기는 방어 로직을 추가한다.

---

### integrations.service.spec.ts — 테스트 중복

- **[INFO]** 두 신규 테스트 케이스(`uses registered entity-aware tester`, `falls through to dispatchTest`)에서 `cafe24Integration` 픽스처(credentials 포함)가 동일한 형태로 두 번 반복 선언된다.
  - 위치: `integrations.service.spec.ts` 라인 60~72, 93~105 (두 `it` 블록 내 `makeIntegration` 호출)
  - 상세: credentials 객체가 완전히 동일한 리터럴로 복제되어 있어, 필드 변경 시 두 곳을 모두 수정해야 한다.
  - 제안: 해당 `describe('testConnection')` 블록 상단에 `const cafe24Credentials = { mall_id: 'myshop', ... }` 공용 픽스처를 선언하거나, `makeCafe24Integration()` 팩토리 함수를 추출한다.

---

### cafe24-api.client.spec.ts — 테스트 구조

- **[WARNING]** dataSource.transaction mock 설정이 세 개의 테스트 케이스(`401→refresh→200`, `401→refresh→401`, `proactive refresh`)에서 동일한 형태로 반복된다.
  - 위치: `cafe24-api.client.spec.ts` 라인 316~323, 385~392, 530~537 (각 `it` 블록 내 `dataSource.transaction.mockImplementation`)
  - 상세: 동일한 transaction mock 팩토리(txRepo with findOne + save)가 3회 복사·붙여넣기 되어 있다. refresh 흐름이 변경되면 3곳을 동기화해야 한다.
  - 제안: `describe('pingConnection')` 블록 또는 `beforeEach` 안에 `function setupTransactionMock(integration: Integration)` 헬퍼를 선언해 재사용한다.

- **[INFO]** 환경 변수(`CAFE24_CLIENT_ID`, `CAFE24_CLIENT_SECRET`) 설정·정리가 각 `it` 블록 안에 직접 삽입되어 있다. 오류로 테스트가 조기 종료되면 `delete process.env.*`가 실행되지 않아 환경 변수가 오염된다.
  - 위치: `cafe24-api.client.spec.ts` 라인 312~313, 376~377, 383~384, 433~434, 527~528, 565~566
  - 상세: refresh가 필요한 모든 케이스에서 동일한 env 설정·정리 패턴이 반복된다.
  - 제안: `beforeEach`/`afterEach` 또는 `beforeAll`/`afterAll`로 환경 변수를 격리 관리하거나, 최소한 `try/finally`로 `delete` 보장한다.

- **[INFO]** `freshIntegration()` 내부의 `24 * 60 * 60 * 1000` 계산은 "24시간 후"라는 의미인데, 상수나 주석 없이 인라인으로만 존재한다.
  - 위치: `cafe24-api.client.spec.ts`, `freshIntegration` 함수 내 `farFuture` 계산
  - 상세: 숫자 리터럴의 의미는 파악 가능하지만, `ONE_DAY_MS` 같은 상수나 `addDays(Date.now(), 1)` 형태의 표현이 더 명시적이다.
  - 제안: `const ONE_DAY_MS = 24 * 60 * 60 * 1000;` 상수로 선언하거나, 기존 테스트 유틸리티에서 사용 중인 패턴을 따른다.

---

### cafe24.module.ts — onModuleInit 익명 함수

- **[INFO]** `onModuleInit` 내부에서 `registerEntityTester`에 인라인 async 화살표 함수를 등록한다. 함수 내용이 짧고 명확하지만, `pingConnection` 결과를 `IntegrationTestResult` 형태로 변환하는 로직이 모듈 파일 안에 위치해 향후 변환 규칙 변경 시 모듈 파일을 수정해야 한다.
  - 위치: `cafe24.module.ts`, `onModuleInit` 메서드 내 익명 함수
  - 상세: 현재는 `message ?? (success ? '...' : '...')` 수준이라 허용 가능하나, 확장 시 `Cafe24ApiClient.pingConnection`이 직접 `IntegrationTestResult`를 반환하도록 시그니처를 맞추면 모듈 파일의 변환 코드를 제거할 수 있다.
  - 제안: `Cafe24ApiClient.pingConnection`의 반환 타입을 `IntegrationTestResult` (또는 호환 타입)로 직접 정렬하거나, 변환 로직을 `Cafe24ApiClient` 내부에 흡수해 `onModuleInit`을 `this.integrations.registerEntityTester('cafe24', this.cafe24Api.pingConnection.bind(this.cafe24Api))` 한 줄로 단순화한다.

---

## 요약

전체적으로 코드 구조는 명확하고 JSDoc과 인라인 주석이 의도를 잘 설명하고 있다. `EntityAwareTester` 패턴과 `registerEntityTester` out-of-band 등록 방식은 의존성 방향을 보존하는 좋은 설계 결정이다. 주된 유지보수성 우려는 `pingConnection` 메서드의 길이와 두 개의 동일한 오류 변환 catch 블록 중복이다. 테스트 파일에서는 `dataSource.transaction` mock 설정과 `cafe24Integration` 픽스처 선언이 여러 `it` 블록에 걸쳐 반복되며, 환경 변수 정리가 `finally` 없이 인라인에 위치해 있어 테스트 격리가 깨질 위험이 있다. 이러한 중복들을 헬퍼 함수와 `beforeEach`/`afterEach`로 정리하면 향후 변경 비용이 크게 줄어들 것이다.

## 위험도

LOW
