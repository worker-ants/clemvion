# 부작용(Side Effect) 코드 리뷰

**리뷰 대상**: Cafe24 `call()` 401 자동 재시도+갱신 구현
**주요 파일**:
- `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts`
- `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts`
- `codebase/backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts`

---

### 발견사항

#### 1. `executeWithRateLimit` 시그니처 변경 — 기본값 있는 선택 파라미터 추가

- **[WARNING]** `executeWithRateLimit` 에 `triedAuthRetry: boolean = false` 파라미터가 추가되어 시그니처가 변경됨
  - 위치: `cafe24-api.client.ts` diff hunk (line +383)
  - 상세: TypeScript 기본값 파라미터이므로 기존 호출자(내부 재귀 포함)가 인자 생략 시 동작을 유지한다. 그러나 `executeWithRateLimit` 가 `private` 메서드가 아니라 `protected` 또는 `public` 접근 제한자를 갖는다면, 서브클래스나 테스트 코드가 직접 호출하는 경우 파라미터 위치에 의존하는 호출이 존재할 수 있다. 기본값이 있으므로 기존 호출자가 파괴적으로 깨지지는 않으나, 이 메서드를 직접 호출하는 테스트·서브클래스는 새 파라미터의 의미를 인지하지 못한 채 `false`(= retry 허용) 상태로 실행된다.
  - 제안: `executeWithRateLimit` 의 접근 제한자를 확인하고, `private` 이면 문제 없음. `protected`/`public` 이라면 JSDoc에 `@param triedAuthRetry` 의미와 "외부에서 `true` 로 직접 호출하지 말 것" 주의사항을 추가한다.

#### 2. 재귀 호출 시 `Integration` 객체 공유 상태 변경 (의도치 않은 상태 변경)

- **[WARNING]** 401 → refresh 성공 → `executeWithRateLimit` 재귀 호출 구간에서 `integration.credentials` 객체가 인메모리에서 직접 변경됨
  - 위치: `cafe24-api.client.ts` diff hunk (`refreshedToken` 추출 부분, line +412–422)
  - 상세: `refreshAccessToken` 또는 `refreshViaQueue` 는 `integration` 객체의 `credentials` 필드를 직접 변경하는 것으로 추정된다(기존 코드 패턴상 `pingConnection` 도 동일 방식). 그 결과 `integration.credentials.access_token` 은 재시도 전에 이미 새 값으로 치환된 상태가 된다. 이는 `call()` 의 호출자가 전달한 `integration` 객체를 side effect로 변경하는 것이다. 대부분의 경우 의도된 동작이지만, 동일 `integration` 참조가 병렬로 다른 경로(`withIntegrationLock` 외부)에서 참조된다면 race 상태가 생긴다. `withIntegrationLock` 내부에서 실행된다고 하더라도, lock이 per-integration Promise-chain 단위이므로 동일 integration에 대해 외부에서 참조 중인 코드는 변경된 credentials를 예기치 않게 읽을 수 있다.
  - 제안: 기존 `pingConnection` 과 동일 패턴이므로 이미 설계상 수용된 trade-off 일 가능성이 높다. 코드 주석에 "refresh 성공 시 `integration.credentials` 인메모리 변경 발생 — 이 객체 참조를 공유하는 다른 경로에서 stale read 가능성이 있으나 `withIntegrationLock` 보호 범위 안에서 안전" 이라는 설명을 추가해 의도를 명확히 한다.

#### 3. 테스트 코드의 `process.env` 직접 조작 — 격리 미흡

- **[WARNING]** `setRefreshClientEnv()` / `clearRefreshClientEnv()` 가 `process.env.CAFE24_CLIENT_ID`, `process.env.CAFE24_CLIENT_SECRET` 를 직접 쓰고 삭제함
  - 위치: `cafe24-api.client.spec.ts` diff hunk (line +62–81, +170, +212, +243, +292, +354)
  - 상세: 테스트 내에서 `process.env` 를 직접 변경하는 방식은 Jest가 테스트를 병렬 실행할 때 동일 Node.js 프로세스 안에서 환경 변수가 공유되므로, 다른 테스트 스위트(또는 동일 파일의 다른 `describe` 블록)가 `CAFE24_CLIENT_ID` / `CAFE24_CLIENT_SECRET` 의 부재를 전제한 채 실행되면 오염(pollution)이 발생한다. `clearRefreshClientEnv()` 가 `finally` 블록이나 `afterEach`/`afterAll` 훅이 아닌 각 테스트 본문 마지막에서만 호출되므로, 테스트가 중간에 예외로 실패하면 환경 변수가 그대로 남는다. 특히 T-1 테스트가 `reject`하지 않고 `await expect(...).resolves`를 통과한 뒤 `clearRefreshClientEnv()`를 호출하는 구조이지만, 테스트 프레임워크가 타임아웃으로 종료되는 경우에도 남을 수 있다.
  - 제안: `afterEach` 훅에서 `clearRefreshClientEnv()` 를 호출하거나 Jest의 `jest.replaceProperty` / `jest.spyOn(process, 'env', ...)` 패턴을 사용해 스코프 격리를 보장한다. 또는 `try { ... } finally { clearRefreshClientEnv(); }` 로 각 테스트를 감싼다.

#### 4. `catalog-sync.spec.ts` — `execSync('git rev-parse --show-toplevel')` 파일시스템/외부 프로세스 부작용

- **[INFO]** 테스트 파일 최상위 레벨에서 `execSync` 로 외부 git 프로세스를 실행하여 `REPO_ROOT` 를 결정함
  - 위치: `catalog-sync.spec.ts` diff hunk (line +8–10)
  - 상세: `execSync` 는 동기 블로킹 호출로 테스트 파일 import 시점(모듈 평가 단계)에 즉시 실행된다. git 바이너리가 없거나 `.git` 디렉토리가 없는 환경(예: Docker CI 이미지, git 없는 빌드 컨테이너)에서는 `execSync`가 throw하여 전체 테스트 스위트가 로드 실패로 처리된다. 또한 `git rev-parse` 결과가 예상치 못한 경로(다른 git 저장소가 부모에 있는 경우)를 반환하면 `CATALOG_DIR`이 잘못된 경로를 가리킬 수 있다.
  - 제안: `try/catch`로 감싸 git 바이너리 부재 시 `__dirname` 기반 fallback 경로를 사용하거나, `NODE_ENV=test` 에서 환경 변수 `REPO_ROOT`를 명시적으로 주입하는 방식을 고려한다. 또는 `beforeAll` 훅 안에서 `execSync`를 실행해 모듈 로드 실패가 아닌 테스트 실패로 격리한다.

#### 5. 401 reactive refresh 경로가 `withIntegrationLock` 내부에서 `refreshViaQueue`(BullMQ)를 호출 — 이벤트/비동기 부작용

- **[INFO]** refresh 경로 선택 로직이 `this.refreshQueue` 유무에 따라 BullMQ 큐(`refreshViaQueue`) 또는 인프로세스(`refreshAccessToken`)로 분기되며, 이 분기는 런타임 인스턴스 상태에 의존함
  - 위치: `cafe24-api.client.ts` diff hunk (line +404–409)
  - 상세: `this.refreshQueue` 가 null이면 `refreshAccessToken` 을 직접 호출하는데, 이는 프로덕션과 테스트 환경 간에 실행 경로가 달라지는 환경 의존적 분기다. 테스트에서는 `refreshQueue`가 바인딩되지 않아 `refreshAccessToken` 경로로 실행되고, 프로덕션에서는 `refreshViaQueue` 경로로 실행된다. 두 경로의 완료 보장(await 방식)과 `integration.credentials` 업데이트 시점이 동일한지 별도 검증이 필요하다. 특히 `refreshViaQueue`가 내부적으로 이벤트 기반(`QueueEvents`)으로 완료를 감지한다면, await 이후 `integration.credentials` 가 항상 갱신 완료 상태임을 보장하는 계약이 문서화되어야 한다.
  - 제안: `refreshViaQueue` 와 `refreshAccessToken` 이 동일한 사후 보장(= `integration.credentials.access_token` 이 갱신됨)을 제공함을 JSDoc 또는 통합 테스트로 명시한다.

#### 6. 테스트 헬퍼 `wireRefreshTransaction` — 공유 mock 상태 변경

- **[INFO]** `wireRefreshTransaction` 이 `dataSource.transaction` 전역 mock 을 각 테스트 호출 시마다 덮어씀
  - 위치: `cafe24-api.client.spec.ts` diff hunk (line +46–56)
  - 상세: `dataSource.transaction.mockImplementation(...)` 은 `dataSource` 공유 mock 객체의 상태를 변경한다. 각 테스트가 `wireRefreshTransaction`을 호출할 때마다 이전 구현이 덮어쓰여 테스트 간 순서 의존성이 생길 수 있다. 특히 다른 `describe` 블록에서 `dataSource.transaction` 의 기본 동작을 전제하는 테스트가 있다면, `wireRefreshTransaction` 호출 이후 상태가 잔류한다. `beforeEach`에서 `dataSource.transaction.mockReset()` 이 이미 호출되는지 확인이 필요하다.
  - 제안: `wireRefreshTransaction` 호출 후 `afterEach` 또는 테스트 종료 시 `dataSource.transaction.mockReset()`을 보장하거나, 각 테스트가 자체 isolated mock scope에서 실행되는지 최상위 `beforeEach`에서 전체 mock 초기화가 이루어지는지 확인한다.

---

### 요약

이번 변경의 핵심인 `executeWithRateLimit` 401 자동 재시도 로직은 기존 `pingConnection` 패턴을 따르며, 재귀 무한루프 방지(`triedAuthRetry` 플래그), 403 분기 불변, BullMQ dedup 활용 등 설계 원칙을 충실히 구현하고 있다. 부작용 관점에서 가장 주목해야 할 지점은 두 가지다. 첫째, 테스트 코드에서 `process.env`를 직접 조작하는 `setRefreshClientEnv`/`clearRefreshClientEnv` 가 `try/finally` 없이 테스트 본문 말미에서만 호출되어, 테스트 실패 시 환경 변수가 오염된 상태로 잔류할 위험이 있다. 둘째, `catalog-sync.spec.ts`에 추가된 `execSync('git rev-parse --show-toplevel')` 가 모듈 평가 단계에서 동기 실행되므로 git이 없는 CI 환경에서 테스트 로드 자체가 실패할 수 있다. `executeWithRateLimit` 시그니처에 기본값 파라미터가 추가된 점은 하위 호환성을 유지하지만, 접근 제한자에 따라 외부 호출자가 의미를 오해할 여지가 있다. 나머지 항목은 기존 설계 패턴과 일관된 공유 상태 변경이며 INFO 수준이다.

### 위험도

MEDIUM
