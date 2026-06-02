# 유지보수성(Maintainability) 리뷰

## 발견사항

### cafe24-install-rate-limit.service.ts

- **[INFO]** constructor 가 3가지 분기를 처리하며 길이가 다소 길다
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-install-ratelimit-2891d1/codebase/backend/src/modules/integrations/cafe24-install-rate-limit.service.ts` L308-L345
  - 상세: constructor 내부가 `injectedRedis` 직접 주입 분기, `configService` 미설정 분기, host/port 누락 분기, Redis 생성 성공/실패 분기 등 4개 early return 으로 구성되어 있다. 논리 자체는 명확하지만 `createRedisFromConfig(configService)` 같은 private 헬퍼로 Redis 생성 책임을 분리하면 constructor 의 의도(DI 우선, 없으면 config 에서 생성)가 더 명확해진다.
  - 제안: Redis 생성 로직을 `private static createFromConfig(configService: ConfigService): Redis | null` 로 추출

- **[INFO]** 에러 메시지 문자열이 반복 패턴으로 중복된다
  - 위치: L341-L343, L363-L366, L385-L388
  - 상세: `Cafe24InstallRateLimitService: <메서드명> 실패 — graceful degradation(fail-open): ${err ...}` 패턴이 3곳에 반복된다. 단순 반복이라 당장 문제는 아니지만 서비스 이름이나 키워드 변경 시 3곳 모두 수정해야 한다.
  - 제안: `private warnDegradation(context: string, err: unknown): void` 헬퍼 하나로 통합

- **[INFO]** `INCR_EXPIRE_LUA` 문자열 연결 방식이 가독성을 낮춘다
  - 위치: L465-L468
  - 상세: Lua 스크립트가 문자열 연결(`+`)로 정의되어 있어 실제 Lua 코드 구조가 한눈에 파악되지 않는다. 주석으로 충분히 설명되어 있지만 템플릿 리터럴(backtick)이나 별도 `.lua` 파일로 분리하면 Lua 코드로서의 가독성이 높아진다.
  - 제안: `` private static readonly INCR_EXPIRE_LUA = `local c = redis.call('INCR', KEYS[1])\nif c == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end\nreturn c` `` (백틱 멀티라인)로 변경

- **[INFO]** `close()`와 `onModuleDestroy()`의 분리가 테스트 목적에는 유용하나 외부 노출 범위가 불명확하다
  - 위치: L396-L408
  - 상세: `close()`가 `public`으로 노출되어 있는데 JSDoc은 "테스트 / shutdown 용도"라고 명시한다. NestJS lifecycle hook(`onModuleDestroy`)이 이미 있으므로 외부에서 직접 호출할 상황이 제한적이다. 실제로 테스트 spec 에서도 `close()`를 직접 호출하지 않고 `quit` mock 으로만 확인한다.
  - 제안: `close()`를 `private`으로 변경하거나, 또는 현재처럼 유지하되 JSDoc에 "외부 강제 종료용 public API" 임을 명시

### cafe24-install-rate-limit.service.spec.ts

- **[INFO]** `makeRedisMock()`에 `quit`이 포함되어 있으나 spec 본문에서 `quit`을 검증하는 테스트가 없다
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-install-ratelimit-2891d1/codebase/backend/src/modules/integrations/cafe24-install-rate-limit.service.spec.ts` L40-L43
  - 상세: `quit: jest.fn().mockResolvedValue(undefined)`가 mock에 있지만 `onModuleDestroy` / `close()` 동작을 검증하는 테스트 케이스가 없다. 미래에 `close()` 동작이 변경될 때 테스트가 회귀를 잡지 못한다.
  - 제안: `describe('close / onModuleDestroy')` 블록 추가 — quit 호출 여부, Redis 없을 때 no-op, quit 실패 시 throw 안 함 등 3케이스

- **[INFO]** `constants` describe 블록에서 숫자 10과 600이 하드코딩되어 있다
  - 위치: L127-L130
  - 상세: 이 테스트는 의도적으로 상수값을 검증(spec §9.8 pin)하는 것이라 하드코딩이 정당하며, 테스트 이름에 "spec §9.8"이 명시되어 있다. 그러나 실제 상수값이 변경되면 테스트도 함께 실패하므로 변경 의도를 인지하게 하는 안전망 역할을 한다. 현 상태로 적절하다. (미조치 필요 없음, 참고용 INFO)

- **[INFO]** `as never` 타입 캐스팅이 test setup에서 2회 사용된다
  - 위치: L51, L93, L120
  - 상세: `new Cafe24InstallRateLimitService(undefined, redis as never)` 패턴이 반복된다. TypeScript strict type 을 우회하는 `as never` 는 불가피하지만, 전용 팩토리 함수로 감싸면 캐스팅 패턴이 1곳으로 집중된다.
  - 제안: `function makeService(r?: unknown) { return new Cafe24InstallRateLimitService(undefined, r as never); }` 헬퍼 추출

### third-party-oauth.controller.ts

- **[WARNING]** `cafe24Install` 메서드에 rate limit 체크, 파라미터 검증, 서비스 호출, 에러 분류, HTML/JSON 렌더링 등 5개 책임이 혼재한다
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-install-ratelimit-2891d1/codebase/backend/src/modules/integrations/third-party-oauth.controller.ts` L104~
  - 상세: 이번 변경으로 rate limit 체크(`isLockedOut`)와 실패 기록(`recordFailure`) 로직이 controller 본문에 직접 추가되었다. controller 가 이미 파라미터 검증, OAuth 흐름, 에러 분류(enumeration 신호 여부), HTML 렌더링까지 담당하고 있어 순환복잡도가 높다. 특히 catch 블록 내 `code === 'CAFE24_INSTALL_INVALID_TOKEN' || code === 'CAFE24_INSTALL_INVALID_HMAC'` 조건이 추가되어 에러 분류 로직이 controller 에 두 곳(format 검사 후 즉시 + catch 내부)에 분산되었다.
  - 제안: enumeration 신호 판별(`isEnumerationError(code)`)을 순수 함수로 추출하여 catch 블록 가독성 개선. 더 근본적으로는 `handleCafe24Install()` private 메서드로 핵심 흐름을 위임하고 controller 는 요청/응답 직렬화만 담당하는 방향을 장기적으로 검토

- **[INFO]** `clientIp`가 `req.ip` 에서 추출되는데 타입이 `string | undefined`임에도 변수명이 이를 반영하지 않는다
  - 위치: L1069
  - 상세: Express 의 `req.ip`는 reverse proxy 설정에 따라 `undefined`일 수 있다. 서비스 메서드(`isLockedOut`, `recordFailure`)는 `undefined` 를 안전하게 처리하므로 실제 버그는 없지만, `clientIp`라는 이름이 "항상 string" 으로 오해될 여지가 있다.
  - 제안: 변수명 그대로 유지하되 인라인 주석으로 "undefined 시 서비스 내부에서 no-op" 명시 (또는 타입 명시: `const clientIp: string | undefined = req.ip`)

### third-party-oauth.controller.spec.ts

- **[INFO]** `call` 헬퍼 함수가 12개의 positional `undefined` 인자를 전달한다
  - 위치: L757~775 내 `controller.cafe24Install(...)` 호출
  - 상세: 컨트롤러 메서드 시그니처에 선택적 query 파라미터가 많아 test helper 에서 `undefined`를 12번 나열해야 한다. 리팩토링 여지가 없는 기존 메서드 시그니처 제약이라 직접 해결하기 어렵지만, 향후 파라미터가 추가될 때 positional 인자 목록이 길어져 유지보수 부담이 된다.
  - 제안: 테스트 목적의 partial 타입 헬퍼로 감싸거나, 실제 `Request` mock 에 query string 을 넣어 파라미터 바인딩을 통합하는 방식 고려

- **[INFO]** rate limit describe 블록의 `req` 상수가 블록 외부에서는 접근 불가하지만 `validToken` 상수와 스코프가 혼재한다
  - 위치: L745-L748
  - 상세: `const req`가 `describe('rate limiting...')` 내부 최상단에 선언되어 있어 스코프는 적절하다. 그러나 `validToken`은 상위 describe 스코프에서 공유되는데, rate limit 테스트에서는 `validToken`과 의도적으로 다른 invalid token(`'a'.repeat(64)`)도 사용된다. 혼용이 의도된 것임을 명확히 하는 주석이 없어 첫 독자에게 혼란을 줄 수 있다.
  - 제안: `'a'.repeat(64)` 사용하는 테스트에 `// invalid format: legacy hex, fails base64url pattern` 주석 추가

### integrations.module.ts

- **[INFO]** `Cafe24InstallRateLimitService`가 `providers`에만 등록되고 `exports`에 없다
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-install-ratelimit-2891d1/codebase/backend/src/modules/integrations/integrations.module.ts` L667
  - 상세: 의도적으로 모듈 내부에서만 사용하고 외부 노출을 막는 설계라면 올바르다. `Cafe24InstallNonceCache`도 export 되어 있는데, rate limit service 는 install controller 전용이라 외부 노출이 불필요한 게 맞다. 명시적 주석은 없지만 패턴 자체가 기존 다른 internal-only 서비스와 일관된다.
  - 제안: 모듈 내 주석으로 "install endpoint 전용, 외부 미노출" 한 줄 추가 권장 (선택)

## 요약

이번 변경은 `Cafe24InstallRateLimitService` 신규 서비스와 controller 통합이 핵심이다. 서비스 자체는 단일 책임(Redis fail-penalty 카운터)을 잘 유지하고 있으며, 상수명(`FAIL_THRESHOLD`, `FAIL_WINDOW_SEC`)과 메서드명(`isLockedOut`, `recordFailure`)이 의도를 명확히 드러낸다. JSDoc과 클래스 레벨 주석이 설계 의도를 충분히 설명하고 있어 가독성이 높다. 다만 constructor 의 복수 분기가 다소 길어 `createFromConfig` 헬퍼 추출로 개선 여지가 있고, 반복되는 warn 로그 패턴도 작은 헬퍼로 통합할 수 있다. 더 큰 관심사는 controller(`cafe24Install` 메서드)로, 이번 변경으로 책임이 추가되어 메서드 복잡도가 높아졌다. enumeration 신호 판별 로직이 두 곳(format 검사 직후, catch 블록)에 분산되어 있어, 이를 순수 함수로 추출하면 중복과 복잡도를 동시에 낮출 수 있다. 테스트 파일은 케이스가 잘 설계되어 있으나 `onModuleDestroy`/`close` 동작 검증이 빠져 있고, test helper 에서 `as never` 캐스팅이 산재한다.

## 위험도

LOW
