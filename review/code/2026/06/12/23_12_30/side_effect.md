# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] Redis 키 네임스페이스 — 공유 Redis 인스턴스 내 새 키 패턴 도입
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-rate-limit-baa15a/codebase/backend/src/modules/chat-channel/chat-channel-rate-limiter.service.ts` 라인 6–9
- 상세: `cc:rl:{triggerId}:{conversationKey}` 키 패턴이 공유 Redis 인스턴스에 신규 도입된다. `triggerId` 는 UUID(콜론 없음)이므로 기존 키(`cc:` prefix 를 사용하는 다른 서비스가 있다면)와 충돌 가능성은 이론적으로 존재하나, `triggerId` UUID 구조상 `cc:rl:` 의 다음 세그먼트가 UUID임이 보장되므로 실질 충돌 불가하다. `EXPIRE 60s NX` 정책으로 키가 자동 만료되어 Redis 메모리에 영구 잔류하지 않는다.
- 제안: 없음. 설계상 안전하다.

### [INFO] `Logger` 인스턴스 — 클래스 수준 고정, 공유 상태 없음
- 위치: `chat-channel-rate-limiter.service.ts` 라인 31
- 상세: `private readonly logger = new Logger(ChatChannelRateLimiterService.name)` 는 각 서비스 인스턴스마다 독립 Logger 를 생성한다. NestJS `Logger` 는 내부적으로 정적(전역) 로깅 파이프라인에 쓰기를 위임하나 이는 의도된 동작이다. `consume` 호출 중 전역 로깅 상태가 변경되는 부작용이 있지만 이는 모든 NestJS 서비스의 정상 동작 범위다.
- 제안: 없음.

### [INFO] `this.redis` 필드 — 생성자에서 한 번만 설정, 런타임 변경 없음
- 위치: `chat-channel-rate-limiter.service.ts` 라인 32, 41
- 상세: `this.redis` 는 `readonly` 로 선언되어 생성자 이후 변경이 불가하다. `injectedRedis ?? redisConn?.getClientOrNull() ?? null` 평가는 생성자 시점 1회만 수행된다. `RedisConnectionProvider.getClientOrNull()` 호출 결과가 나중에 변경되어도(예: Redis 재연결) 이 서비스 인스턴스는 최초 `null`/비-null 결정을 영구히 유지한다. Redis 가 부트스트랩 후 재가용 상태가 되어도 이미 `null` 로 초기화된 인스턴스는 fail-open 상태를 유지한다.
- 제안: 현재 설계(생성자 시점 결정)는 PublicWebhookQuotaService 동형이며 허용 범위다. 단, Redis 재연결 후 rate-limit 가 자동 복원되지 않는다는 점을 JSDoc 에 명시하면 운영자 혼란을 방지할 수 있다.

### [INFO] `pipeline.incr` + `pipeline.expire` — Redis 공유 상태 변경 (의도된 부작용)
- 위치: `chat-channel-rate-limiter.service.ts` 라인 63–66
- 상세: `consume` 는 매 호출마다 Redis 에 `INCR` + `EXPIRE NX` 를 실행한다. 이는 의도된 외부 상태 변경(카운터 증가)이다. `EXPIRE NX` 는 `NX` 플래그로 이미 TTL이 있는 키에는 TTL을 재설정하지 않으므로 슬라이딩 윈도우로 변하는 부작용이 없다(fixed-window 유지). pipeline 단일 실행이므로 중간 상태가 외부에 노출되지 않는다.
- 제안: 없음. 의도된 설계다.

### [INFO] `HooksService` 생성자 시그니처 변경 — 기존 DI 등록 영향
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-rate-limit-baa15a/codebase/backend/src/modules/hooks/hooks.service.ts` 라인 59
- 상세: `HooksService` 생성자에 `ChatChannelRateLimiterService` 의존성이 추가됐다. NestJS DI 컨테이너가 자동으로 주입하므로 런타임 영향은 없다. 그러나 `HooksService` 를 직접 인스턴스화하는 테스트 코드(있다면)는 수동으로 인자를 추가해야 한다. 실제 테스트 파일(`hooks.service.spec.ts`)에서는 `TestingModule` DI를 통해 mock 으로 제공하므로 정상 처리된다.
- 제안: `hooks.service.spec.ts` 의 mock 제공 처리가 올바르게 되어 있으므로 추가 조치 불필요.

### [INFO] `ChatChannelRateLimiterService` — `ChatChannelModule` exports 추가에 따른 모듈 공개 API 변경
- 위치: `chat-channel.module.ts` 라인 69
- 상세: `ChatChannelRateLimiterService` 가 `ChatChannelModule.exports` 배열에 추가되어 이 모듈을 import 하는 모든 모듈(현재 `HooksModule`)에서 주입 가능해진다. 공개 API 확장(추가)이며 기존 소비자의 동작에 영향 없다(non-breaking addition). 단, 이 서비스를 의도치 않게 다른 모듈에서 주입하는 오용 가능성이 열린다.
- 제안: 없음. 의도된 설계이며 breaking change 아님.

### [INFO] `markChatChannelRateLimited` — `trigger` 인자의 메모리 내 객체 비변경
- 위치: `hooks.service.ts` 라인 852–872
- 상세: `markChatChannelRateLimited` 는 `trigger` 파라미터의 `chatChannelHealth` 를 DB 에 갱신하지만, 메모리 내 `trigger` 객체의 상태를 변경하지 않는다(`trigger.chatChannelHealth = 'degraded'` 할당 없음). 이로 인해 동일 요청 처리 흐름 내에서 `trigger.chatChannelHealth` 는 여전히 갱신 이전 값을 가진다. 현재 코드 흐름상 이 메서드 호출 직후 `return { executionId: 'ignored' }` 를 반환하므로 같은 요청 내 `trigger.chatChannelHealth` 를 다시 읽는 경로가 없어 실질 문제는 없다.
- 제안: 없음. 현재 흐름상 안전하다. 단, 향후 rate-limit 이후 추가 분기가 생긴다면 메모리 객체 미갱신이 버그 원인이 될 수 있다는 주석을 남기는 것이 유지보수에 유리하다.

### [INFO] `Logger.warn` — 외부 입력(`trigger.id`)이 로그에 포함됨
- 위치: `hooks.service.ts` 라인 869
- 상세: `chat-channel rate-limit degraded 갱신 실패 (triggerId=${trigger.id})` 로그에 `trigger.id` 가 포함된다. `trigger.id` 는 내부 UUID 이며 외부 사용자 입력이 아니므로 log injection 위험 없음. 반면 `conversationKey` 는 로그에 포함되지 않아 XSS 표면 축소 의도(코드 주석 참고)가 일관되게 적용되고 있다.
- 제안: 없음. 올바른 설계다.

### [INFO] `consume` 테스트 — `makeRedis` 팩토리의 독립 상태
- 위치: `chat-channel-rate-limiter.service.spec.ts` 라인 50–56
- 상세: 각 테스트마다 `makeRedis` 로 독립된 mock Redis 를 생성한다. `describe` 블록 최상위의 `const KEY = makeChatRateLimitKey(TRIGGER_ID, CHAT)` 는 테스트 간 공유 상수지만 불변 문자열이라 공유 상태 오염이 없다. `ChatChannelRateLimiterService` 인스턴스도 각 `it` 블록에서 `new` 로 독립 생성한다.
- 제안: 없음. 테스트 격리가 올바르게 설계되었다.

### [INFO] `hooks.service.spec.ts` mock 추가 — `triggerRepo.update` 신규 mock
- 위치: `hooks.service.spec.ts` 라인 286–290
- 상세: 기존 `triggerRepo` mock에 `update: jest.fn().mockResolvedValue({ affected: 1 })` 가 추가됐다. 이로 인해 이전에 `update` 를 테스트하지 않았던 기존 테스트들도 `update` mock 을 갖게 된다. 기존 테스트가 `triggerRepo.update` 를 `not.toHaveBeenCalled()` 로 어설션 하는 경우 영향을 받을 수 있지만, 소스 파일의 실제 코드가 그 경로에서 `update` 를 호출하지 않는다면 문제 없다. mock 추가가 기존 테스트의 동작을 변경하지 않는다.
- 제안: 없음. mock 추가는 비파괴적이다.

## 요약

이번 변경은 새로운 `ChatChannelRateLimiterService` 를 도입하고 `HooksService` 의 webhook 처리 체인에 rate-limit 단락을 삽입한다. 부작용 관점에서 가장 중요한 변경은 두 가지다: (1) Redis 에 `cc:rl:{triggerId}:{conversationKey}` 패턴의 키를 INCR/EXPIRE 로 조작하는 의도된 외부 상태 변경 — `EXPIRE NX` 덕분에 fixed-window 가 보장되고 키는 60s 후 자동 만료된다. (2) DB `trigger.chatChannelHealth` 를 `degraded` 로 best-effort 갱신하는 부작용 — 메모리 내 `trigger` 객체를 변경하지 않으나, 호출 직후 `return` 이므로 현재 흐름에서는 무해하다. 전역 변수 도입 없음, 예상치 못한 파일시스템 조작 없음, 환경 변수 읽기/쓰기 없음, 의도치 않은 외부 네트워크 호출 없음, 이벤트/콜백 동작 변경 없음. `HooksService` 생성자 시그니처 변경은 NestJS DI 에 의해 자동 처리되며 테스트는 올바르게 mock 을 제공한다. 모듈 exports 에 `ChatChannelRateLimiterService` 추가는 non-breaking addition 이다.

## 위험도

LOW

STATUS: SUCCESS
