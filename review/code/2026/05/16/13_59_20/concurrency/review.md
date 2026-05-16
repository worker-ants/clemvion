### 발견사항

- **[WARNING]** `entityTesters` Map 에 대한 비원자적 등록 및 경쟁 조건 가능성
  - 위치: `backend/src/modules/integrations/integrations.service.ts` — `entityTesters` 필드 및 `registerEntityTester()` 메서드
  - 상세: `private readonly entityTesters = new Map<string, EntityAwareTester>()` 에 대해 `registerEntityTester()` 는 단순 `Map.set()` 을 호출하고, `testConnection()` 은 `Map.get()` 을 호출한다. NestJS 는 기본적으로 단일 스레드(Node.js 이벤트 루프) 위에서 동작하므로 JavaScript 수준에서는 동시 쓰기 경쟁이 발생하지 않는다. 그러나 `onModuleInit` 호출 타이밍이 보장되지 않은 상태에서 HTTP 요청이 먼저 도달하면 `entityTesters.get('cafe24')` 가 `undefined` 를 반환하여 `dispatchTest` 폴백으로 빠질 수 있다. NestJS 모듈 초기화 순서가 `Cafe24Module` → `IntegrationsModule` 이 아닌 경우 이 창이 존재한다.
  - 제안: NestJS `APP_INITIALIZER` 또는 `onModuleInit` 선행 완료를 보장하는 의존성 체인을 명시적으로 설정한다. 또는 `registerEntityTester()` 에 초기화 완료 여부를 추적하는 플래그나 Promise barrier 를 두어 미등록 상태로 요청이 처리되지 않도록 방어 코드를 추가한다.

- **[WARNING]** `pingConnection` 내부의 `withIntegrationLock` 과 `ensureFreshToken` / `refreshAccessToken` 간 잠금 중첩 위험
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` — `pingConnection()` 메서드 (라인 636 `withIntegrationLock` 호출)
  - 상세: `pingConnection()` 은 `withIntegrationLock(integration.id, ...)` 으로 외부 락을 획득한 상태에서 내부에서 `ensureFreshToken(integration)` 과 `refreshAccessToken(integration)` 을 순차 호출한다. 이 두 메서드가 내부적으로 동일한 `withIntegrationLock` 을 재진입(re-entrant)하려 할 경우, 락 구현이 재진입을 지원하지 않으면 데드락이 발생한다. 또한 노드 실행 경로(`call()` → `executeWithRateLimit()`)가 동일한 `integration.id` 로 락을 보유 중인 상태에서 `pingConnection` 이 호출되면 락 경합이 발생하고, `pingConnection` 은 락 타임아웃까지 블로킹된다.
  - 제안: `withIntegrationLock` 의 재진입 지원 여부를 확인하고, `ensureFreshToken` / `refreshAccessToken` 이 이미 락을 보유한 컨텍스트에서 호출될 때는 락을 건너뛰는 "내부(lock-free) 변형"을 사용하도록 리팩토링한다. 또는 `pingConnection` 전용 별도 락 키(예: `integration.id + ':ping'`)를 사용해 노드 실행 경로 락과 분리한다.

- **[WARNING]** 토큰 갱신 후 `integration.credentials` 읽기의 메모리 가시성 불일치
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` — `pingConnection()` 내 `tokenAfterProactive` 및 `refreshedToken` 참조
  - 상세: `ensureFreshToken(integration)` 과 `refreshAccessToken(integration)` 은 DB 트랜잭션을 통해 새 토큰을 저장하면서 `integration` 객체의 `credentials` 를 인-메모리에서 직접 변경(mutate)한다. 이후 `pingConnection` 은 `(integration.credentials ?? {}) as Cafe24Credentials).access_token` 을 읽어 새 토큰을 사용한다. 이 패턴은 단일 요청 컨텍스트에서는 동작하지만, `integration` 객체를 여러 요청이 공유하는 경우(예: 캐시, 싱글턴 스코프 서비스에서 동일 엔티티 참조) 한 요청의 인-메모리 변이가 다른 요청의 토큰 읽기에 예상치 못한 영향을 준다. TypeORM 은 기본적으로 요청마다 별도 엔티티 인스턴스를 반환하므로 현재 구조에서는 저위험이지만, 캐싱 레이어가 추가되면 즉시 경쟁 조건이 된다.
  - 제안: `refreshAccessToken` 반환값에서 새 토큰을 직접 받아 사용하거나, `integration` 객체를 매번 DB에서 새로 조회하는 방식으로 변경하여 인-메모리 변이 의존성을 제거한다.

- **[INFO]** `rawPing` 의 `AbortController` 타임아웃(30초)이 이벤트 루프를 블로킹하지 않으나 타임아웃 해제(`clearTimeout`)가 `finally` 에 위치
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` — `rawPing()` 메서드 (라인 745–760)
  - 상세: `clearTimeout(timer)` 가 `finally` 블록에 올바르게 배치되어 있어 fetch 성공·실패 모두 타이머를 해제한다. 구현은 적절하다. 다만 30초 타임아웃은 사용자 대면 진단 UX 로는 다소 길 수 있으며, 상위 HTTP 요청 타임아웃(게이트웨이 등)이 더 짧다면 `AbortController` 가 실제로 abort 되기 전에 상위 요청이 끊긴다.
  - 제안: 사용자 진단용임을 감안해 타임아웃을 10초 내외로 단축하거나, 환경 변수로 설정 가능하게 만드는 것을 권장한다.

- **[INFO]** `registerEntityTester` — "Last registration wins" 정책의 멀티-인스턴스 환경 비결정성
  - 위치: `backend/src/modules/integrations/integrations.service.ts` — `registerEntityTester()` 주석 "Last registration wins."
  - 상세: 현재는 단일 프로세스 내에서 `Cafe24Module.onModuleInit` 이 1회만 호출되므로 문제없다. 그러나 향후 동일 서비스 타입에 대해 여러 모듈이 `registerEntityTester` 를 호출하거나, 테스트 환경에서 모듈 재초기화가 일어나면 예상치 못한 tester 덮어쓰기가 발생할 수 있다.
  - 제안: 이미 등록된 키에 덮어쓰기가 발생하면 경고 로그를 출력하도록 방어 코드를 추가한다.

### 요약

변경 코드는 Node.js 싱글 스레드 환경을 전제로 설계되어 있어 명시적인 뮤텍스나 세마포어 없이 `Map` 을 사용하는 점은 언어 런타임 특성상 적절하다. 그러나 `pingConnection` 이 `withIntegrationLock` 을 획득한 상태에서 내부적으로 `ensureFreshToken` / `refreshAccessToken` 을 호출하는 중첩 잠금 구조는 락 구현의 재진입 지원 여부에 따라 데드락 위험이 있으며, 노드 실행 경로와의 동일 키 경합도 주목해야 한다. `entityTesters` 의 등록 타이밍(모듈 초기화 완료 전 요청 도달)과 갱신 후 인-메모리 credentials 의존성도 잠재적 경쟁 조건으로 식별된다. async/await 구조와 `finally` 를 통한 타이머 해제는 올바르게 구현되어 있어 이벤트 루프 블로킹 위험은 낮다.

### 위험도

MEDIUM
