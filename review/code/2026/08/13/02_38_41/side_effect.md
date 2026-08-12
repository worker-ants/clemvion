# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[INFO]** `ChatChannelDedupService.claim()` 은 모든 chat-channel inbound 요청마다 Redis `SET NX EX 30` 을 무조건 실행하는 **새 쓰기 부작용**이다 — 신규 Redis 키 네임스페이스 `cc:dedup:<triggerId>:<idempotencyKey>` 도입.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:61-67` (`claim()` 내부 `this.redis.set(...)` 호출)
  - 상세: 의도된 신규 기능(Spec CCH-SE-02)이며 fail-open 설계(Redis 부재/에러 시 `true` 반환, warn 로그)로 정상 트래픽을 막지 않는다. `spec/5-system/15-chat-channel.md:88`(파일 7, 게이트 88)에 동일 메커니즘(키 형식·TTL·fail-open)이 문서화되어 SoT 와 코드가 일치한다. rate-limiter(`ChatChannelRateLimiterService`)와 동일한 Redis 주입 패턴(`@Optional() @Inject('CHAT_CHANNEL_DEDUP_REDIS')` → `RedisConnectionProvider.getClientOrNull()` → `null`)을 재사용해 새로운 위험 클래스를 만들지 않는다. `'CHAT_CHANNEL_DEDUP_REDIS'` 토큰을 실제로 바인딩하는 provider 는 없어(운영 경로는 항상 `RedisConnectionProvider` 폴백을 탄다) — 이 역시 sibling 서비스와 동일한 "테스트 전용 override 훅" 패턴이라 결함이 아니다.
  - 제안: 별도 조치 불필요. 참고로만 기록.

- **[INFO]** `HooksService` 생성자 시그니처 변경(파라미터 삽입) — 호출자 영향 확인 완료, 안전함.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:79` (`private readonly chatChannelDedup: ChatChannelDedupService,` 를 `chatChannelRateLimiter` 와 `interactionService` 사이에 삽입)
  - 상세: `grep -rn "new HooksService("` 전수 확인 결과 프로덕션·테스트 어디서도 위치 인자로 직접 생성하는 곳이 없다(전부 NestJS DI 또는 `hooks.controller.spec.ts` 의 mock 객체 캐스팅). `hooks.service.spec.ts` 의 `Test.createTestingModule` provider 배열에 `ChatChannelDedupService` mock(`{ claim: jest.fn().mockResolvedValue(true) }`)이 함께 추가되어 있어(파일 4 diff, 게이트 88-92) 타입 기반 DI 해석이 깨지지 않는다. `moduleRef` 는 `beforeEach` 마다 재생성되므로(`hooks.service.spec.ts:35` 부근) `mockResolvedValueOnce(false)` 가 다른 테스트로 새는 오염도 없음을 직접 확인했다.
  - 제안: 없음.

- **[INFO]** `ChatChannelModule` 의 `providers`/`exports` 양쪽에 `ChatChannelDedupService` 추가 — DI 그래프 확장.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.module.ts:46, 61`
  - 상세: `HooksModule` 이 `ChatChannelModule` 을 `imports` 에 두고 `forwardRef` 를 쓰지 않으므로(파일 없음, `hooks.module.ts` 확인) export 가 없으면 `HooksService` 주입이 런타임에 실패했을 것이다 — export 목록에 정확히 포함되어 있어 문제 없음. sibling `ChatChannelRateLimiterService` 와 동일한 위치에 나란히 추가되어 module 표면 관례를 그대로 따른다.
  - 제안: 없음.

- **[INFO]** 재도착(duplicate) 요청이 `claim()` 에서 억제되면 `sendBestEffortNotice`/`ackInteraction`/`interactionService.interact` 등 하위 부작용(외부 API 호출·알림 발송)이 전부 스킵된다 — 의도된 동작이나 극단적 실패창 하나를 남긴다.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:338-345` (dedup 게이트, `return { executionId: 'ignored' }`)
  - 상세: 최초 요청이 `claim()`(`SET NX`) 성공 직후 프로세스가 죽는 등으로 `ackInteraction`/`sendMessage` 까지 도달하지 못하면, 같은 update 의 provider 재전송은 30초 TTL 동안 계속 억제되어 그 update 에 대한 어떤 응답도 전송되지 않는다(버튼 콜백이면 클라이언트 로딩 상태가 TTL 동안 남을 수 있음). 이는 파일 내 기존 `channelConversationService.acquireLock`/`releaseLock`(form_submission lock, `hooks.service.ts` 495-506·600-606 부근) 과 **동일한 클래스의 기존 트레이드오프**이고, fail-open 설계상 30초 뒤엔 자연 해소되므로 이번 diff 가 새로 만든 위험이 아니라 이미 채택된 패턴의 반복이다.
  - 제안: 조치 불필요 — 인지 목적의 기록. 필요 시 향후 "claim 성공 후 처리 실패" 케이스의 관측(metric/alert)을 별도 항목으로 검토할 수 있으나 이번 PR 범위 밖이다.

## 요약

핵심 변경은 `ChatChannelDedupService` 신설(Redis `SET NX EX 30` 기반 in-process inbound dedup)과 `HooksService.handleChatChannelWebhook` 에서 `parseUpdate` 직후·rate-limit 이전 지점에 그 게이트를 배선한 것이다. 새 Redis 쓰기 부작용(신규 키 네임스페이스)과 `HooksService` 생성자 시그니처 변경이 있지만, 둘 다 기존 `ChatChannelRateLimiterService` 패턴을 그대로 재사용하고 있고, 생성자 변경은 NestJS DI 로만 소비되며(직접 위치 인자 생성 호출자 0건 확인) 테스트 provider 배열도 함께 갱신되어 실제 파손 지점을 찾지 못했다. Module 의 providers/exports 갱신도 짝이 맞고, fail-open·로그 스파이 복원(`finally` 블록)도 올바르게 처리되어 있다. 유일하게 언급할 만한 잠재 위험(재도착 억제로 인한 ack/알림 스킵의 극단적 실패창)은 파일 내 기존 락 패턴과 동일한 성격의 트레이드오프로, 이번 diff 가 새로 도입한 결함이 아니라 정보성으로만 남긴다.

## 위험도

LOW
