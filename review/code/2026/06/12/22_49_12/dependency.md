# 의존성(Dependency) Review

## 발견사항

### [INFO] 새 외부 패키지 없음 — 기존 `ioredis` type-only import 재사용
- 위치: `codebase/backend/src/modules/chat-channel/chat-channel-rate-limiter.service.ts` L2
- 상세: `import type Redis from 'ioredis'` 로 타입만 참조. `ioredis ^5.10.1` 은 이미 `package.json` dependencies 에 등록된 기존 패키지이며, 이번 변경으로 새 외부 패키지가 추가되지 않았다. `package.json` / `package-lock.json` 모두 무변경 확인.
- 제안: 해당 없음.

### [INFO] 내부 의존성 — `RedisConnectionProvider` 글로벌 주입 활용
- 위치: `chat-channel-rate-limiter.service.ts` constructor `@Optional() redisConn?: RedisConnectionProvider`
- 상세: `RedisConnectionProvider` 는 `@Global()` 로 선언된 `RedisModule` 이 export 하며, `AppModule` 이 전역 등록한다. `ChatChannelModule` 이 `RedisModule` 을 직접 import 하지 않아도 주입 가능하다. `@Optional()` 데코레이터를 사용하므로 Redis 미가용 시 DI 실패 없이 fail-open 경로로 폴백한다.
- 제안: 현재 설계 적절. 문서화 보완이 필요하다면 서비스 JSDoc 에 "RedisModule `@Global` 전제" 한 줄 추가 권고 (필수 아님).

### [INFO] 내부 의존성 — `HooksService` 에 `ChatChannelRateLimiterService` 추가
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` L56+, `codebase/backend/src/modules/chat-channel/chat-channel.module.ts` exports 배열
- 상세: `HooksService` 가 `ChatChannelRateLimiterService` 에 단방향 의존한다. `ChatChannelModule` 이 `ChatChannelRateLimiterService` 를 exports 에 추가하여 `HooksModule`(또는 `AppModule`) 이 주입받을 수 있도록 구성됐다. 순환 의존성 없음.
- 제안: 해당 없음.

### [INFO] 버전 고정 — 기존 `ioredis ^5.10.1` caret 범위 사용
- 위치: `codebase/backend/package.json` L64
- 상세: 이번 변경이 신규 추가한 패키지가 아니므로 버전 고정 정책 변경 없음. 기존 caret(`^`) 범위는 프로젝트 전체 패키지와 일관된 방식이다.
- 제안: 해당 없음.

### [INFO] 불필요한 의존성 없음 — `PublicWebhookQuotaService` 재사용 대안 검토
- 위치: `chat-channel-rate-limiter.service.ts` 전체
- 상세: 기존 `PublicWebhookQuotaService` (같은 Redis INCR+EXPIRE 패턴) 를 재사용하지 않고 별도 서비스로 구현했다. per-chat 키(`cc:rl:{triggerId}:{conversationKey}`) 를 사용해 카운팅 범위가 다르고, `ChatChannelModule` 이 `HooksModule` 에 의존하지 않아 순환 의존성 회피를 위해 분리가 타당하다. 코드 복제는 약 30줄이며 중복 의존성 도입은 없다.
- 제안: 공통 Redis fixed-window 유틸리티 함수를 `common/redis/` 에 추출하면 장기적으로 중복 감소. 현재 규모에서는 필수가 아님.

## 요약

이번 변경(CCH-NF-03 per-chat rate-limit)은 새 외부 패키지를 일체 추가하지 않았다. `ioredis` 를 type-only로 참조하고 기존 `RedisConnectionProvider` 글로벌 주입을 재사용하며, `ChatChannelRateLimiterService` 를 새 내부 서비스로 추가한다. `@Optional()` 데코레이터로 Redis 미가용 시 fail-open 처리하고, `ChatChannelModule` exports 등록으로 `HooksService` 주입 경로가 올바르게 구성됐다. 순환 의존성, 라이선스 충돌, 취약점, 버전 충돌 등 의존성 관점의 위험 요소는 발견되지 않았다.

## 위험도

NONE
