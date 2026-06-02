### 발견사항

- **[INFO]** `ThirdPartyOAuthController` 생성자 시그니처 변경 — 두 번째 인자 `installRateLimit: Cafe24InstallRateLimitService` 추가
  - 위치: `/codebase/backend/src/modules/integrations/third-party-oauth.controller.ts` line 39–44
  - 상세: 기존 `constructor(private readonly oauthService: IntegrationOAuthService)` 에서 두 번째 필수 파라미터가 추가됐다. NestJS DI 컨텍스트에서는 `IntegrationsModule` 의 providers 배열에 `Cafe24InstallRateLimitService` 가 등록되었으므로 런타임 자동 주입은 정상 작동한다. 단, 직접 `new ThirdPartyOAuthController(...)` 로 생성하는 기존 테스트 코드가 있다면 두 번째 인자 미전달 시 `undefined` 가 주입되어 런타임 오류가 발생할 수 있다. spec 파일에 포함된 `third-party-oauth.controller.spec.ts` 의 두 `describe` 블록 모두 이미 `makeRateLimit()` 를 두 번째 인자로 전달하도록 수정되어 있어 테스트 내 호출자 영향은 해소된 상태다.
  - 제안: 모듈 외부에서 컨트롤러를 직접 인스턴스화하는 다른 테스트 파일이 없는지 `grep -r "new ThirdPartyOAuthController"` 로 전수 확인 권장.

- **[INFO]** `Cafe24InstallRateLimitService` 신규 Redis 연결 생성 — 모듈 초기화 시점에 새 `ioredis` 인스턴스 생성
  - 위치: `/codebase/backend/src/modules/integrations/cafe24-install-rate-limit.service.ts` line 331–344
  - 상세: 생성자에서 `new Redis({ ..., lazyConnect: true })` 를 호출한다. `lazyConnect: true` 로 설정되어 있어 생성자 단계에서 실제 TCP 연결은 발생하지 않는다. 연결은 첫 번째 `get` 또는 `eval` 호출 시점까지 지연된다. 기존 `Cafe24InstallNonceCache` 가 별도 Redis 인스턴스를 이미 사용하고 있다면 동일 Redis 서버로의 연결이 하나 더 추가된다. 이는 설계 의도에 부합하지만 연결 풀 소비 관점에서 인지 필요.
  - 제안: 장기적으로 `Cafe24InstallNonceCache` 와 Redis 인스턴스를 공유하는 방식(공통 provider token 주입)을 고려할 수 있다. 단기적으로는 현행 독립 인스턴스 방식도 `lazyConnect` + `onModuleDestroy` quit 처리로 누수 위험이 없어 허용 가능하다.

- **[INFO]** `onModuleDestroy` 훅을 통한 Redis `quit` 호출 — 정상 의도이나 비동기 호출 순서 주의
  - 위치: `/codebase/backend/src/modules/integrations/cafe24-install-rate-limit.service.ts` line 405–408
  - 상세: NestJS 는 `OnModuleDestroy` 훅을 순차 호출하므로 의도된 동작이다. `quit()` 실패를 catch 하고 무시하는 처리도 적절하다. shutdown 중 미완료된 `recordFailure` / `isLockedOut` 요청이 Redis 연결 종료와 경합할 경우 warn 로그가 출력될 수 있으나, 두 메서드 모두 에러를 catch-and-warn 처리하므로 프로세스 종료를 막지 않는다.
  - 제안: 현행 처리가 적절함. 변경 불필요.

- **[INFO]** `IntegrationsModule` providers 배열에 `Cafe24InstallRateLimitService` 추가 — exports 에는 미포함
  - 위치: `/codebase/backend/src/modules/integrations/integrations.module.ts` line 56–60, 68–72
  - 상세: `Cafe24InstallRateLimitService` 는 providers 에만 등록되고 exports 에는 포함되지 않는다. 이 서비스를 다른 모듈에서 주입받을 수 없는 의도적 캡슐화다. `ThirdPartyOAuthController` 는 같은 모듈 내에 있으므로 정상 주입된다. 캡슐화 의도가 맞다면 exports 미포함이 올바른 설계다.
  - 제안: 변경 불필요. 단, 향후 다른 모듈에서 이 서비스가 필요해지는 경우 exports 추가가 필요하다는 점을 plan에 메모 권장.

- **[INFO]** `req.ip` 를 통한 클라이언트 IP 추출 — 프록시 환경에서 예상과 다른 IP가 추출될 수 있음
  - 위치: `/codebase/backend/src/modules/integrations/third-party-oauth.controller.ts` line 920 (`const clientIp = req.ip;`)
  - 상세: `req.ip` 는 Express 의 `trust proxy` 설정에 따라 동작이 달라진다. `trust proxy` 가 올바르게 설정된 경우 `X-Forwarded-For` 헤더의 첫 번째 IP가 반환되지만, 설정이 없거나 잘못된 경우 로드밸런서/리버스 프록시의 IP가 반환되어 모든 요청이 같은 IP로 카운트될 수 있다. 이는 rate limiting 의 효과를 무력화하거나 정상 사용자 전체를 lockout 시키는 부작용을 낳을 수 있다. 그러나 이는 이 변경이 도입한 신규 문제가 아니라 기존 `@Throttle` Layer 1도 동일한 전제 하에 동작하는 인프라 구성 문제이므로 이 PR 범위에서 새로 발생하는 부작용은 아니다.
  - 제안: 인프라 수준에서 `trust proxy` 설정이 올바르게 되어 있는지 확인. PR 범위 내 코드 변경 사항은 없음.

- **[INFO]** `Cafe24InstallRateLimitService` 가 `'CAFE24_INSTALL_RATE_LIMIT_REDIS'` 토큰으로 주입 가능한 구조이나, `IntegrationsModule` 에 해당 토큰의 provider 미등록
  - 위치: `/codebase/backend/src/modules/integrations/cafe24-install-rate-limit.service.ts` line 311–312; `/codebase/backend/src/modules/integrations/integrations.module.ts`
  - 상세: 생성자의 `@Inject('CAFE24_INSTALL_RATE_LIMIT_REDIS')` 는 `@Optional()` 데코레이터와 함께 사용되므로 해당 토큰의 provider 가 없어도 `undefined` 가 주입되어 configService 경로로 분기된다. 테스트에서는 `new Cafe24InstallRateLimitService(undefined, redis as never)` 로 직접 mock을 전달하는 방식으로 사용된다. 런타임에서는 `'CAFE24_INSTALL_RATE_LIMIT_REDIS'` provider 없이도 정상 동작하도록 설계되어 있어 부작용 없음.
  - 제안: 변경 불필요. 설계 의도(테스트 주입 편의성)가 명확히 문서화되어 있음.

---

### 요약

이번 변경은 `Cafe24InstallRateLimitService` 를 신규 도입하고 `ThirdPartyOAuthController` 에 의존성으로 주입하는 구조다. 부작용 관점에서 가장 유의할 점은 `ThirdPartyOAuthController` 의 생성자 시그니처 변경인데, DI 런타임 경로는 모듈 등록으로 보호되고 테스트 직접 인스턴스화 경로도 spec 파일 내에서 이미 수정되어 있어 명시적인 호출자 파손은 없다. Redis 연결은 `lazyConnect: true` 와 `onModuleDestroy` quit 처리로 누수가 방지되어 있고, 모든 Redis 오류는 fail-open 으로 처리되어 기존 install 플로우를 중단시키지 않는다. 전역 변수 도입, 파일시스템 부작용, 환경 변수 직접 읽기/쓰기, 이벤트/콜백 구조 변경은 없다. 전체적으로 의도하지 않은 부작용 위험은 낮은 수준이다.

### 위험도

LOW
