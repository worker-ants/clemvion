# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [WARNING] HooksService 생성자 시그니처에 새 의존성 삽입 — 기존 수동 인스턴스화 코드에 영향
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-rate-limit-baa15a/codebase/backend/src/modules/hooks/hooks.service.ts` — `constructor` 7번째 파라미터로 `chatChannelRateLimiter: ChatChannelRateLimiterService` 추가
- 상세: NestJS DI 컨텍스트 외부에서(예: 단위 테스트 `new HooksService(...)` 직접 호출, 또는 다른 모듈에서 수동 팩토리 Provider 사용) `HooksService`를 인스턴스화하는 코드가 있다면 인수 개수 불일치로 런타임 오류 발생. 현재 `hooks.service.spec.ts`는 `Test.createTestingModule`을 사용하므로 영향 없음. 다른 테스트/팩토리가 없는지 확인 필요.
- 제안: `grep -r "new HooksService"` 로 다른 직접 인스턴스화 위치 확인. 없다면 무시.

### [INFO] `CHAT_CHANNEL_RATE_LIMIT_REDIS` 토큰 미등록 — 의도된 fallback 이지만 DI 경고 가능
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-rate-limit-baa15a/codebase/backend/src/modules/chat-channel/chat-channel-rate-limiter.service.ts` lines 35-37
- 상세: `@Optional() @Inject('CHAT_CHANNEL_RATE_LIMIT_REDIS')` 파라미터는 어떤 모듈에서도 해당 토큰을 provide하지 않는다(전체 소스 기준 해당 토큰을 제공하는 Provider 없음). `@Optional()`이므로 DI는 `undefined`를 주입하고 생성자는 `redisConn?.getClientOrNull() ?? null` fallback으로 진행된다. 이는 의도된 동작(fail-open)이나, 미래에 전용 Redis 인스턴스를 사용하려 할 때 토큰 등록을 잊으면 silent fallback이 된다. `RedisConnectionProvider`가 `@Global()` RedisModule을 통해 전역 주입되므로 실제 Redis 연결은 그쪽 경로로 성립한다.
- 제안: 현 시점은 문제 없으나 코드 주석에 "이 토큰은 현재 등록 없음 — fallback은 RedisConnectionProvider" 를 명시하면 추후 혼란 방지.

### [INFO] `markChatChannelRateLimited` 의 DB UPDATE — `trigger` 메모리 객체 상태는 변경되지 않음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-rate-limit-baa15a/codebase/backend/src/modules/hooks/hooks.service.ts` lines 854-874
- 상세: `triggerRepository.update(...)` 는 DB를 `degraded`로 갱신하지만, 동일 요청 내 메모리의 `trigger` 객체는 여전히 이전 `chatChannelHealth` 값을 유지한다. `markChatChannelRateLimited` 내에서 `trigger.chatChannelHealth === 'degraded'` 검사가 중복 write 방지를 목적으로 쓰이는데, 이 값은 DB에서 새로 조회된 것이 아니라 이전 요청 시 로드된 값이다. 결과적으로 폭주 상황에서 동시 요청이 몰리면 여러 요청이 동시에 `chatChannelHealth !== 'degraded'`인 로컬 trigger 객체를 들고 있어 DB UPDATE가 중복 발생할 수 있다. 이는 idempotent UPDATE라 데이터 손상은 없고, 주석에도 "best-effort" 라고 명시되어 있으므로 의도된 허용 동작이다.
- 제안: 중복 write가 의도된 허용 사항임을 주석에서 "best-effort — 동시 요청 중복 write 가능하나 idempotent" 로 명확화.

### [INFO] Redis `pipeline().incr()` 후 `expire()` 는 pipeline 밖에서 별도 호출 — race condition 가능
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-rate-limit-baa15a/codebase/backend/src/modules/chat-channel/chat-channel-rate-limiter.service.ts` lines 57-66
- 상세: `INCR`은 pipeline에, `EXPIRE`는 그 밖에서 독립 실행한다. `INCR` 직후 `EXPIRE` 사이에 프로세스가 종료되면 키에 TTL이 설정되지 않아 영구 키 누적이 발생한다. 이는 `PublicWebhookQuotaService`와 동일한 패턴으로 프로젝트에서 기존 허용된 trade-off이다. 메모리 누수 위험은 낮으나(키당 수십 바이트 수준) 운영 중 장애가 겹치면 오래된 키가 잔류할 수 있다.
- 제안: 현 설계는 기존 패턴과 일치하므로 변경 불필요. 필요 시 Lua 스크립트나 `SET ... EX ... NX` 패턴으로 atomic 처리 가능하나 v1 범위 초과.

### [INFO] `ChatChannelRateLimiterService`가 `ChatChannelModule`에서 export됨 — 모듈 경계 상태 공유
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-rate-limit-baa15a/codebase/backend/src/modules/chat-channel/chat-channel.module.ts` lines 69-71 (exports 배열)
- 상세: `ChatChannelRateLimiterService`가 export됨으로써 `ChatChannelModule`을 import하는 모든 모듈(현재 `HooksModule`)에서 동일 싱글톤 인스턴스를 주입받는다. 이 서비스는 Redis 클라이언트 참조를 `readonly`로만 보유하고 외부에서 변경 가능한 공유 상태를 노출하지 않으므로, 현재 다중 소비자 간 의도치 않은 상태 공유 문제는 없다.
- 제안: 이상 없음.

### [INFO] 테스트에서 `triggerRepo.update` mock 추가 — 기존 테스트 케이스에 영향 없음 확인
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-rate-limit-baa15a/codebase/backend/src/modules/hooks/hooks.service.spec.ts` lines 551-556
- 상세: `update: jest.fn().mockResolvedValue({ affected: 1 })` 가 추가되어 기존 테스트가 `update`를 호출하지 않는 경로에서는 단순히 `expect` 없이 무시된다. 기존 케이스에서 `update`가 호출되지 않으면 spy 상태가 후속 테스트로 누수될 가능성이 있으나, 각 `it` 블록마다 `moduleRef`를 재생성하거나 `beforeEach`에서 초기화하는 패턴이라면 문제 없다. 이미 `findOne`, `save`가 같은 방식으로 mock되어 있어 동일 패턴이다.
- 제안: 이상 없음.

---

## 요약

이번 변경은 신규 서비스(`ChatChannelRateLimiterService`) 도입과 `HooksService` 생성자 확장으로 구성된다. 전역 변수 도입 없음, 파일시스템 부작용 없음, 환경 변수 예상치 못한 읽기/쓰기 없음, 의도치 않은 외부 네트워크 호출 없음이 확인되었다. 핵심 부작용 위험은 세 가지로 집약된다. (1) `HooksService` 생성자 시그니처에 의존성이 추가되었으나 NestJS DI 외 수동 인스턴스화 코드가 없으므로 실질 영향은 없다. (2) `CHAT_CHANNEL_RATE_LIMIT_REDIS` 토큰은 아무 모듈에서도 provide되지 않으나 `@Optional()` + `@Global()` RedisModule fallback으로 안전하게 처리된다. (3) `markChatChannelRateLimited`의 중복 DB UPDATE는 idempotent이고 best-effort로 명시되어 있어 데이터 무결성 위협이 없다. 전반적으로 부작용 위험이 낮다.

---

## 위험도

LOW
