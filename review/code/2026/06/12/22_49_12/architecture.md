# 아키텍처(Architecture) 리뷰

## 발견사항

### [INFO] SRP 관점: ChatChannelRateLimiterService 는 단일 책임을 잘 준수함
- 위치: `codebase/backend/src/modules/chat-channel/chat-channel-rate-limiter.service.ts`
- 상세: `ChatChannelRateLimiterService` 는 "per-chat Redis fixed-window 카운트" 라는 단일 책임을 갖는 독립 서비스로 추출됐다. `consume` 메서드 하나만 공개 API 로 두고 Redis 연동 세부사항을 캡슐화한다. 단일 책임 원칙 준수.
- 제안: 없음.

### [INFO] DIP 관점: Redis 의존성이 생성자 주입 + Optional 로 올바르게 역전됨
- 위치: `chat-channel-rate-limiter.service.ts` 생성자 (라인 321-328)
- 상세: `@Optional() @Inject('CHAT_CHANNEL_RATE_LIMIT_REDIS')` + `RedisConnectionProvider` 폴백 패턴은 의존성 역전이 잘 적용된 예시다. 구체 Redis 클라이언트를 직접 생성하지 않고 외부에서 주입받으며, 테스트 시 모의 객체 교체가 자연스럽다. `injectedRedis ?? redisConn?.getClientOrNull() ?? null` 우선순위 체인도 명확하다.
- 제안: 없음.

### [WARNING] HooksService 의 단일 책임(SRP) 부담 증가: `markChatChannelRateLimited` 는 DB 갱신 책임을 직접 수행
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` — `markChatChannelRateLimited` 메서드 (라인 846-724 구간)
- 상세: `HooksService` 는 이미 inbound webhook 오케스트레이션, 인증, conversation 분기, execution 시작/재개, rate-limit 판정까지 다수의 책임을 진다. 이번 변경으로 `trigger.chatChannelHealth` DB 갱신 로직(`markChatChannelRateLimited`)이 추가됐는데, 동일한 `chat_channel_health=degraded` 갱신은 `ChatChannelDispatcher.markDegraded`(outbound 오류 경로)에도 존재한다. 두 경로에 DB 갱신 로직이 분산돼 있어 향후 `chatChannelHealth` 상태 천이 규칙 변경 시(예: 특정 조건에서 degraded → healthy 자동 회복, 또는 새 health 상태 추가) 양쪽을 모두 수정해야 한다. 현재는 중복 자체는 짧고 허용 범위이나, health 갱신 빈도가 늘어나면 관련 로직을 `ChatChannelHealthService` 혹은 `ChatChannelStatusService` 같은 전용 서비스로 추출하는 것이 자연스러운 리팩토링 방향이 된다.
- 제안: 즉각 조치는 불필요하나, 향후 `chat_channel_health` 갱신 경로가 세 번째 이상으로 늘어나면 해당 로직을 별도 서비스(`ChatChannelHealthManager` 등)로 추출해 SRP 와 DRY 를 동시에 확보하는 것을 권장한다.

### [INFO] OCP 관점: rate-limit enforcement 위치(parseUpdate 직후)가 기존 단락(guard) 체인 패턴과 일관됨
- 위치: `hooks.service.ts` — `handleChatChannelWebhook` 내 parseUpdate 직후 블록 (라인 273-287)
- 상세: 기존 `handleChatChannelWebhook` 는 "서명 검증 → 비활성 트리거 단락 → handshake 단락 → parseUpdate null 단락 → ..." 순의 조기 종료 체인으로 구성됐다. rate-limit 단락이 parseUpdate 직후에 추가되면서 이 패턴을 자연스럽게 확장한다. 기존 단락 로직을 수정하지 않고 새 단락을 삽입한 형태이므로 OCP 정신에 부합한다.
- 제안: 없음.

### [INFO] 모듈 경계: ChatChannelRateLimiterService 가 exports 에 포함돼 외부 모듈(HooksService) 이 사용 가능
- 위치: `chat-channel.module.ts` exports 배열 (라인 472-477)
- 상세: `ChatChannelRateLimiterService` 를 `exports` 에 포함해 `ChatChannelModule` 을 import 하는 `HooksModule` 이 DI 로 주입받을 수 있게 했다. 모듈 경계와 공개 API 가 명확하다. 단, rate-limit 서비스를 `ChatChannelModule` 에 귀속시킨 것은 적절한 결정이다 — rate-limit 의 도메인 맥락이 chat-channel 이고, Redis 키 스키마(`cc:rl:*`)도 그 네임스페이스를 따른다.
- 제안: 없음.

### [WARNING] HooksModule 이 ChatChannelModule 에 대한 의존성이 추가 확장됨: 결합도 증가 관찰 필요
- 위치: `hooks.service.ts` import + DI 생성자 (`ChatChannelRateLimiterService`, `CHAT_RATE_LIMIT_DEFAULT_PER_MIN` import)
- 상세: `HooksService` 는 이미 `ChannelAdapterRegistry`, `ChannelConversationService`, `ChatChannelInboundAuthenticator` 등 `chat-channel` 모듈의 여러 서비스에 의존하고 있으며, 이번에 `ChatChannelRateLimiterService` 와 `CHAT_RATE_LIMIT_DEFAULT_PER_MIN` 상수가 추가됐다. `HooksService` 가 `chat-channel` 도메인의 세부 상수(`CHAT_RATE_LIMIT_DEFAULT_PER_MIN`)를 직접 import 해서 사용하는 것은 인터페이스 경계가 약간 노출된 형태다. 현재 규모에서는 문제가 없으나, 이 상수는 `ChatChannelRateLimiterService.consume` 호출 시 인자로 전달되는데, 호출자가 기본값을 알아야 하는 구조보다는 서비스 내부에서 `limitPerMinute` 가 `undefined` 일 때 기본값을 적용하는 것이 캡슐화 측면에서 더 깔끔하다.
- 제안: `ChatChannelRateLimiterService.consume` 시그니처에서 `limitPerMinute` 를 optional(`limitPerMinute?: number`)로 변경하고 기본값(`CHAT_RATE_LIMIT_DEFAULT_PER_MIN`)을 서비스 내부에서 처리하면, 호출자가 상수를 직접 import 하지 않아도 된다. 이는 `CHAT_RATE_LIMIT_DEFAULT_PER_MIN` 의 단일 진실을 서비스 내부로 응집시킨다. 단, 테스트 가시성(명시적 인자)과의 트레이드오프가 있으므로 필수 변경은 아님.

### [INFO] 추상화 수준: `makeChatRateLimitKey` 를 export 해 테스트가 직접 import 하는 패턴은 적절한 수준의 추상화
- 위치: `chat-channel-rate-limiter.service.ts` 라인 212-215, spec.ts 라인 82-84
- 상세: 키 생성 함수를 서비스 외부로 export 해 테스트가 직접 사용할 수 있게 한 설계는 — 키 구조가 테스트 어설션의 핵심이므로 — 올바른 수준의 추상화다. 서비스 내부에만 숨기면 테스트가 문자열 하드코딩 또는 내부 구현 접근에 의존해야 한다. 주석("테스트가 import 해 직접 의존 방지")도 의도를 명확히 설명한다.
- 제안: 없음.

### [INFO] 디자인 패턴: fail-open 패턴이 구조적으로 일관되게 적용됨
- 위치: `chat-channel-rate-limiter.service.ts` — `if (!this.redis) return true`, `if (!results || results.length === 0) return true`, `catch` 블록의 `return true`
- 상세: Redis 미가용, 빈 결과, 예외 등 세 가지 실패 경로 모두 `true`(통과)를 반환하는 fail-open 패턴이 일관되게 구현됐다. `PublicWebhookQuotaService` 의 동형 패턴과 정합하며, 방어적 기능(rate-limit)에서 가용성 우선 정책으로 적절하다.
- 제안: 없음.

### [INFO] 테스트 설계: `makeRedis` 팩토리 함수가 테스트 내 결합도를 낮춤
- 위치: `chat-channel-rate-limiter.service.spec.ts` — `makeRedis` 함수 (라인 48-57)
- 상세: 각 테스트가 독립된 mock Redis 인스턴스를 생성하는 팩토리 패턴은 테스트 간 상태 공유를 방지한다. `_incr`, `_exec` 를 반환 객체에 포함해 호출 여부 검증도 가능하게 한 설계는 테스트 가독성과 격리를 동시에 달성한다.
- 제안: 없음.

### [INFO] 순환 의존성: `chat-channel` 모듈과 `hooks` 모듈 간 단방향 의존성 유지됨
- 위치: `chat-channel.module.ts` imports 배열 — `forwardRef(() => TriggersModule)` 이 유일한 순환 처리
- 상세: `HooksModule` → `ChatChannelModule` 방향의 단방향 의존이다. `ChatChannelModule` 은 `HooksModule` 을 import 하지 않으며, 이번 변경도 이 방향성을 유지한다. 기존 `forwardRef(() => TriggersModule)` 은 `ChatChannelModule` ↔ `TriggersModule` 간 순환을 처리하는 기존 구조이며 이번 변경과 무관하다.
- 제안: 없음.

### [INFO] 확장성: `rateLimitPerMinute` 를 호출자(HooksService)가 config 에서 읽어 전달하는 구조는 적절한 확장 지점
- 위치: `hooks.service.ts` 라인 673-679
- 상세: `config.rateLimitPerMinute ?? CHAT_RATE_LIMIT_DEFAULT_PER_MIN` 로 per-trigger 오버라이드를 허용하는 구조는 향후 trigger별 개별 한도 설정을 지원한다. `ChatChannelRateLimiterService` 는 `limitPerMinute` 를 인자로 받아 상태를 갖지 않으므로 멀티테넌트 환경에서도 안전하게 재사용 가능하다.
- 제안: 없음.

---

## 요약

이번 변경은 `ChatChannelRateLimiterService` 를 독립 서비스로 추출하고 `HooksService` 의 처리 체인에 rate-limit 단락을 삽입하는 구조로, 전반적으로 아키텍처 관점에서 건전하다. SRP(단일 책임), DIP(의존성 역전), OCP(개방-폐쇄) 원칙을 준수하며, 모듈 경계가 명확하고 순환 의존성도 없다. 주목할 약점은 두 가지다: (1) `HooksService` 와 `ChatChannelDispatcher` 양쪽에 `chat_channel_health=degraded` DB 갱신 로직이 분산된 점 — 현재 규모에서는 허용되나 health 갱신 경로가 늘어나면 전용 서비스 추출이 필요하다. (2) `HooksService` 가 `CHAT_RATE_LIMIT_DEFAULT_PER_MIN` 상수를 직접 import 해서 `consume` 호출 시 전달하는 것은 캡슐화 관점에서 서비스 내부에서 기본값을 처리하는 것이 더 응집도가 높다. 두 항목 모두 WARNING 수준이며 기능 정확성에는 영향이 없다.

## 위험도

LOW

STATUS: SUCCESS
