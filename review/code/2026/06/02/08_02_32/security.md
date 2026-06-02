# 보안(Security) 리뷰 결과

## 발견사항

- **[WARNING]** IP 기반 Rate Limiting — `req.ip` 신뢰 전제 미검증
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-install-ratelimit-2891d1/codebase/backend/src/modules/integrations/third-party-oauth.controller.ts` L107 (`const clientIp = req.ip;`)
  - 상세: `req.ip`는 Express의 `trust proxy` 설정에 따라 `X-Forwarded-For` 헤더 값을 그대로 사용할 수 있다. proxy/LB 환경에서 `trust proxy`가 올바르게 설정되지 않으면 공격자가 `X-Forwarded-For: 1.2.3.4` 헤더를 위조해 임의 IP로 카운터를 우회(lockout 회피)하거나, 반대로 정상 사용자의 IP를 조작해 DoS를 유발할 수 있다. 현재 코드에는 `trust proxy` 설정 여부나 IP 정규화 로직이 없다.
  - 제안: NestJS/Express 앱 초기화 시 `app.set('trust proxy', ...)` 설정을 명시하고, 실제 클라이언트 IP 추출 로직을 전용 미들웨어/유틸리티로 중앙화할 것. 또한 `req.ip`가 `undefined`인 경우 fail-open이 되는데(서비스 내부에서 처리), IPv6 mapped IPv4(`::ffff:1.2.3.4`) 형식의 정규화도 고려해야 한다.

- **[WARNING]** `buildKey`의 IP 입력값 새니타이징 부재 — Redis 키 인젝션 가능성
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-install-ratelimit-2891d1/codebase/backend/src/modules/integrations/cafe24-install-rate-limit.service.ts` L139-141 (`buildKey` 메서드)
  - 상세: `buildKey`는 `cafe24:install:fail:${ip}` 형식으로 키를 조립하는데, IP 값에 대한 형식 검증이 없다. `req.ip`가 잘못 구성된 proxy 환경에서 비정상 값(예: `::1`, `::ffff:127.0.0.1`, 또는 헤더 위조 시 개행 문자 포함 문자열)을 받을 경우 Redis 키 공간 오염이 발생할 수 있다. Lua 스크립트(`INCR_EXPIRE_LUA`)는 `KEYS[1]`을 직접 사용하므로 Redis 인젝션 위험은 낮지만, 키 충돌/오염으로 인한 Rate Limit 우회 가능성은 존재한다.
  - 제안: `buildKey` 내부 또는 `isLockedOut`/`recordFailure` 진입 시점에 IP 형식 검증(IPv4/IPv6 정규식 또는 `net` 모듈 활용)을 추가하고, 검증 실패 시 no-op/fail-open 처리할 것.

- **[WARNING]** Fail-open 정책의 보안 트레이드오프 — 의도적이나 문서화 필요
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-install-ratelimit-2891d1/codebase/backend/src/modules/integrations/cafe24-install-rate-limit.service.ts` L82-92, L111-116, L132-136
  - 상세: Redis 장애 시 `isLockedOut`은 항상 `false`를 반환하고 `recordFailure`는 no-op이 된다. 이는 설계상 의도된 가용성 우선 결정(Layer 1 throttle로 회귀)이며 코드 주석과 plan에도 명시되어 있다. 그러나 Redis 장애를 악용한 의도적 공격(Redis DoS로 Layer 2 무력화 후 token enumeration 시도) 시나리오에 대한 모니터링/알림이 없다면 공격이 탐지 불가능하다.
  - 제안: Redis 장애 시 `warn` 레벨 로깅은 적절하나, 운영 환경에서 Redis 연결 실패 빈도를 메트릭으로 수집하고 임계치 초과 시 알림이 트리거되도록 관찰성(observability)을 보강할 것. 현재 warn 로그 문자열에 에러 메시지가 포함되는 것(`${err.message}`)은 적절하나, 운영 로그 집계 시스템에서 이를 모니터링해야 한다.

- **[WARNING]** 에러 응답에서 내부 에러 메시지 노출
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-install-ratelimit-2891d1/codebase/backend/src/modules/integrations/third-party-oauth.controller.ts` L173 (`const message = e.response?.message ?? e.message ?? 'Install failed';`)
  - 상세: catch 블록에서 예외 객체의 `e.message`를 직접 클라이언트 응답에 포함시킨다. 서비스 계층에서 던지는 예외 메시지에 내부 구현 세부사항(DB 쿼리 오류, 스택 경로 등)이 포함될 경우 클라이언트(브라우저 포함)에 노출된다. 이는 새로 추가된 코드의 문제가 아닌 기존 패턴이지만, 이번 변경이 해당 코드 경로를 유지하므로 지적한다.
  - 제안: 클라이언트 응답 메시지는 `e.response?.message`(서비스가 명시적으로 노출을 의도한 메시지)만 사용하고, `e.message`(내부 예외 메시지)는 서버 로그에만 기록하며 클라이언트에는 generic fallback 메시지를 반환할 것.

- **[INFO]** Lua 스크립트의 INCR + EXPIRE 원자성 — 올바르게 구현됨
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-install-ratelimit-2891d1/codebase/backend/src/modules/integrations/cafe24-install-rate-limit.service.ts` L51-54
  - 상세: `INCR_EXPIRE_LUA`는 첫 INCR 시에만 EXPIRE를 설정하는 fixed-window 패턴을 Lua로 원자적으로 구현한다. 이는 INCR 후 크래시로 인한 TTL 누락(영구 키) race condition을 올바르게 차단한다. 보안 관점에서 적절한 구현이다.

- **[INFO]** 하드코딩된 시크릿 없음
  - 상세: Redis 접속 정보(host, port, password, tls)는 모두 `ConfigService`를 통해 주입받으며, 코드에 직접 시크릿이 포함되지 않았다. 테스트 파일에도 실제 자격증명이 없다.

- **[INFO]** THRESHOLD 값(10회/10분)의 적절성 검토
  - 위치: L43-45 (서비스 상수)
  - 상세: `FAIL_THRESHOLD=10`, `FAIL_WINDOW_SEC=600`은 보수적인 값이다. 정상 사용자가 단순 실수로 10회 실패할 가능성은 낮으나, 분산 공격(botnet, 다수 IP 사용)에는 Layer 2가 무력하다는 점이 plan에도 Layer 3(전역 cap) deferred로 명시되어 있다. 현재 구현 범위 내에서는 허용 가능한 수준이다.

- **[INFO]** 테스트에서 실제 IP 사용 (`1.2.3.4`, `9.9.9.9`)
  - 위치: spec 파일들
  - 상세: 테스트에 사용된 IP는 실제 외부 IP이나 테스트 환경 내 mock에서만 사용되므로 보안 위험 없음.

## 요약

이번 변경은 Cafe24 install endpoint에 IP 기반 실패 페널티 rate limiting(Layer 2)을 추가하는 것으로, 전반적인 보안 설계는 올바르다. Lua 스크립트를 통한 원자적 Redis 연산, 시크릿 미하드코딩, fail-open graceful degradation 설계 등은 적절히 구현되었다. 주요 보안 우려사항은 두 가지다: 첫째, `req.ip` 신뢰 전제가 Express `trust proxy` 설정에 의존하나 이에 대한 검증이나 명시적 설정이 코드베이스에서 확인되지 않아, proxy 환경에서 헤더 위조로 lockout을 우회하거나 DoS를 유발할 수 있다. 둘째, `buildKey`에서 IP 형식 검증 없이 Redis 키를 조립해 비정상 IP 값이 키 공간을 오염시킬 수 있다. 에러 응답에 내부 메시지(`e.message`)가 포함되는 패턴도 개선이 필요하다.

## 위험도

MEDIUM
