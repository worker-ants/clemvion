# 아키텍처(Architecture) 리뷰 결과

**대상 파일**:
- `codebase/backend/src/modules/integrations/cafe24-install-rate-limit.service.ts`
- `codebase/backend/src/modules/integrations/cafe24-install-rate-limit.service.spec.ts`
- `codebase/backend/src/modules/integrations/integrations.module.ts`
- `codebase/backend/src/modules/integrations/third-party-oauth.controller.ts` (변경분)
- `codebase/backend/src/modules/integrations/third-party-oauth.controller.spec.ts` (변경분)

---

## 발견사항

### [WARNING] SRP 위반 — `Cafe24InstallRateLimitService` 가 Redis 연결 생명주기와 비즈니스 로직을 동시에 책임진다
- **위치**: `cafe24-install-rate-limit.service.ts` constructor (라인 308-345) + `onModuleDestroy`/`close`
- **상세**: 서비스가 (1) ConfigService 에서 Redis 접속 파라미터를 읽어 직접 `new Redis(...)` 를 생성하고 (2) `isLockedOut`/`recordFailure` 비즈니스 로직을 수행하며 (3) `onModuleDestroy`/`close` 로 Redis 연결 종료까지 담당한다. 이는 세 개의 독립적 책임을 한 클래스에 집중시킨다. 인접 서비스인 `Cafe24InstallNonceCache` 가 이미 같은 모듈에서 Redis 를 사용하는 것으로 보이는데, 두 서비스가 각자 별도의 Redis 인스턴스를 생성하면 연결 낭비가 발생한다.
- **제안**: NestJS 패턴을 따라 Redis 인스턴스를 모듈 레벨 provider 로 분리(`CAFE24_RATE_LIMIT_REDIS` 팩토리 provider)하고 서비스는 주입만 받도록 변경한다. `Cafe24InstallNonceCache` 와 Redis 인스턴스 공유 가능 여부도 검토한다. 단 현재 `@Optional() @Inject('CAFE24_INSTALL_RATE_LIMIT_REDIS')` 로 테스트 주입 경로는 이미 열어두었으므로 프로덕션 경로만 팩토리 provider 로 올리면 된다.

---

### [WARNING] 의존성 역전 원칙(DIP) 미적용 — 컨트롤러가 구현 클래스에 직접 의존
- **위치**: `third-party-oauth.controller.ts` 라인 883-884 (생성자 파라미터 `private readonly installRateLimit: Cafe24InstallRateLimitService`)
- **상세**: `ThirdPartyOAuthController` 가 `Cafe24InstallRateLimitService` 구현 클래스를 직접 타입으로 참조한다. 향후 fail-closed 전략 변경, in-memory 폴백 구현, 또는 테스트에서 다른 구현체 교체 시 컨트롤러 코드를 수정해야 한다. 테스트 파일(`third-party-oauth.controller.spec.ts`)에서 이미 `as never` 로 duck-typing 캐스팅을 사용하는 것이 이 문제를 우회하는 방식임을 보여준다.
- **제안**: `IInstallRateLimitService` 인터페이스(`isLockedOut(ip: string | undefined): Promise<boolean>`, `recordFailure(ip: string | undefined): Promise<void>`)를 추출하고, 컨트롤러는 인터페이스 타입을 의존하도록 변경한다. NestJS 에서는 커스텀 토큰으로 주입하거나, TypeScript 인터페이스를 타입으로만 사용하는 패턴 모두 가능하다.

---

### [WARNING] 생성자 내 분기 로직 과도 — 테스트 주입용 우회 경로가 안티패턴
- **위치**: `cafe24-install-rate-limit.service.ts` 라인 308-345 (constructor)
- **상세**: 생성자가 `injectedRedis` 유무 → `configService` 유무 → `host`/`port` 유무 → Redis 생성 → 예외 처리의 5단계 분기를 처리한다. `if (injectedRedis) { this.redis = injectedRedis; return; }` 패턴은 "테스트가 mock redis를 주입할 수 있게 한다"는 주석과 함께 테스트 우회 경로를 프로덕션 코드에 노출시킨다. 이는 생성자가 DI 컨테이너 역할을 겸하는 형태로, 인프라 생성 책임을 서비스에서 분리했다면 필요 없는 코드다.
- **제안**: 위 SRP/DIP 개선과 연계하여 Redis 인스턴스를 모듈 팩토리 provider 로 분리하면 생성자 분기가 제거되고 테스트는 표준 NestJS `overrideProvider` 패턴으로 단순화된다.

---

### [INFO] 레이어 책임 — 컨트롤러에 오류 분류 로직 포함
- **위치**: `third-party-oauth.controller.ts` 추가 라인 947-953 (catch 블록 내 `code === 'CAFE24_INSTALL_INVALID_TOKEN' || code === 'CAFE24_INSTALL_INVALID_HMAC'` 분기)
- **상세**: 어떤 에러 코드가 enumeration 신호인지 판단하는 로직이 컨트롤러 catch 블록에 인라인으로 존재한다. 이 분류 기준(enumeration 신호 에러 코드 집합)은 비즈니스 규칙으로, 향후 새 에러 코드가 추가되면 컨트롤러를 직접 수정해야 한다. 컨트롤러는 프레젠테이션 레이어 책임(HTTP 변환)에 집중해야 한다.
- **제안**: `Cafe24InstallRateLimitService.isEnumerationSignal(code: string): boolean` 스태틱 메서드를 추가하거나, 에러 코드 상수를 별도 상수 파일에 집합으로 정의해 컨트롤러는 위임만 하도록 한다. 에러 코드 분류 기준의 단일 진실 지점을 서비스/상수 레이어에 위치시킨다.

---

### [INFO] 추상화 수준 적절 — Redis key 빌더 메서드
- **위치**: `cafe24-install-rate-limit.service.ts` 라인 391-393 (`buildKey` private 메서드)
- **상세**: `buildKey` 를 private 메서드로 분리한 것은 적절하다. 다만 `recordFailure`/`isLockedOut` 두 메서드만 호출하는 단순한 키 구성이라 인라인 템플릿 리터럴과 대비한 추상화 이득이 미미하다. 확장성(IP 외 다른 식별자 추가 등) 측면에서는 현재 방식이 유지보수에 유리하다.
- **제안**: 현행 유지 적절. 향후 key 스키마 변경(prefix 변경, 세그먼트 추가)이 한 곳에서 이루어질 수 있어 올바른 설계다.

---

### [INFO] 모듈 경계 — `Cafe24InstallRateLimitService` exports 미등록
- **위치**: `integrations.module.ts` 라인 668-672 (exports 배열)
- **상세**: `Cafe24InstallRateLimitService` 가 providers 에는 등록되어 있으나 exports 에는 포함되지 않는다. 이는 해당 서비스가 `IntegrationsModule` 내부에서만 사용되는 의도를 명확히 표현한다. 현재 사용처(`ThirdPartyOAuthController`)가 같은 모듈 내에 있으므로 모듈 경계가 적절하다.
- **제안**: 현행 유지. 만약 향후 다른 모듈(예: `Cafe24Module`)에서 rate limit 서비스를 참조해야 할 경우, exports 추가 또는 별도 공유 모듈로 분리를 검토한다.

---

### [INFO] 확장성 — Layer 3(global cap) 및 sliding window 미구현
- **위치**: `plan/in-progress/cafe24-install-ratelimit.md` §설계 Layer 3 deferred 항목
- **상세**: 현재 설계는 IP별 fixed window 카운터만 구현한다. plan 에 botnet 분산 enumeration 대응을 위한 전역 endpoint cap(Layer 3)을 deferred 로 명시했다. 현재 `buildKey` 가 항상 IP를 포함하는 형태라 전역 키(`cafe24:install:global`) 를 지원하려면 메서드 시그니처 변경이 필요하다. sliding window 전환 시에도 Lua 스크립트 교체 외 서비스 인터페이스 변경은 없어 확장성은 양호하다.
- **제안**: Layer 3 구현 시 `recordGlobalAttempt()` / `isGlobalCapExceeded()` 메서드를 추가하거나 `buildKey` 를 오버로드 가능한 형태로 미리 준비해두면 확장 비용을 줄일 수 있다.

---

## 요약

`Cafe24InstallRateLimitService` 는 단일 책임 원칙을 부분적으로 위반하는 구조다. 서비스가 Redis 인스턴스 생성·관리·비즈니스 로직을 모두 담당하고, 생성자가 테스트 우회 경로를 내포한다. 이는 NestJS 의 모듈 팩토리 provider 패턴으로 분리하면 해소할 수 있다. 컨트롤러가 구현 클래스에 직접 의존하는 DIP 미적용 및 enumeration 신호 분류 로직의 컨트롤러 인라인은 중기 유지보수성 리스크다. 전체적으로 fail-open 전략, Lua 원자 연산, graceful degradation 설계는 아키텍처적으로 올바른 결정이며, 모듈 내 응집도와 경계 설정은 적절하다. 핵심 개선 영역은 Redis 생명주기 관리의 서비스 외부화와 컨트롤러 의존성 추상화다.

---

## 위험도

**LOW**

(SRP/DIP 미흡이 현재 기능 동작에는 영향 없으나 향후 전략 변경·테스트 격리 시 마찰 요인. CRITICAL/HIGH 수준의 구조적 결함 없음)
