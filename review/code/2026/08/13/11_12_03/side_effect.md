# 부작용(Side Effect) 리뷰 결과 — CCH-SE-02 update dedup (통합 라운드 `11_12_03`)

## 검증 방법

핵심 실행 코드(`chat-channel-dedup.service.ts` / `chat-channel-dedup.service.spec.ts` /
`chat-channel.module.ts` / `hooks.service.ts` / `hooks.service.spec.ts`)는 프롬프트 diff 만이
아니라 저장소의 현재 파일을 `Read`/`grep` 으로 직접 열어 독립 대조했다. 나머지 다수 파일
(`review/code/**`, `review/consistency/**` 산출물, `plan/**`, `CHANGELOG.md`, `spec/**`)은
이전 두 리뷰 라운드(`02_38_41`, `02_50_38`, `09_09_58`)와 consistency 체크 산출물이 그대로
커밋된 것이거나 문서 갱신이라 실행 부작용 표면이 아니다.

## 발견사항

- **[INFO]** `ChatChannelDedupService.claim()` 은 chat-channel inbound 요청마다 Redis
  `SET NX EX 30` 을 무조건 실행하는 새 쓰기 부작용이다 — 신규 키 네임스페이스
  `cc:dedup:<triggerId>:<idempotencyKey>` 도입.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:61`-`67`
    (`claim()` 내부 `this.redis.set(...)`)
  - 상세: 의도된 신규 기능([Spec CCH-SE-02])이며 fail-open 설계(Redis 부재 시 `:55`, 에러 시
    `:69`-`73` 모두 `true` 반환 + `warn`)로 정상 트래픽을 끊지 않는다. 형제 클래스
    `ChatChannelRateLimiterService` 와 동일한 생성자 패턴(`@Optional() @Inject(...)` →
    `RedisConnectionProvider.getClientOrNull()` → `null`)을 재사용해 새로운 커넥션/자원 관리
    위험을 만들지 않는다. `spec/data-flow/14-chat-channel.md:196` · `spec/conventions/redis-keys.md:61`
    · `spec/4-nodes/7-trigger/providers/telegram.md:235` 모두 동일 키/TTL/메커니즘을 서술해
    SoT 와 구현이 일치함을 확인했다.
  - 제안: 조치 불요.

- **[INFO]** `HooksService` 생성자 시그니처 변경(`chatChannelDedup: ChatChannelDedupService`
  파라미터 삽입) — 호출자 영향 확인 완료, 파손 없음.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:79`
    (`chatChannelRateLimiter` 와 `interactionService` 사이에 삽입)
  - 상세: `grep -rn "new HooksService(" codebase/backend/src` 전수 0건 — 프로덕션·테스트 어디서도
    위치 인자로 직접 생성하지 않고 전부 NestJS DI 로 해석된다. `hooks.service.spec.ts:89`-`93`
    (파일 5 diff)에 `ChatChannelDedupService` mock(`{ claim: jest.fn().mockResolvedValue(true) }`)이
    provider 배열에 함께 추가돼 타입 기반 DI 가 깨지지 않는다. `moduleRef` 는 `beforeEach`
    (`hooks.service.spec.ts:38`)마다 재생성되므로 새 테스트의
    `dedup.claim.mockResolvedValueOnce(false)` 가 다른 테스트로 새어 오염될 여지가 없음을 직접
    확인했다.
  - 제안: 없음.

- **[INFO]** `ChatChannelModule` 의 `providers`/`exports` 양쪽에 `ChatChannelDedupService` 추가
  — DI 그래프 확장, 양쪽 쌍이 맞음.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.module.ts:46`, `:61`
  - 상세: `HooksModule` 은 `ChatChannelModule` 을 `imports` 에 두되(`hooks.module.ts:25`)
    `forwardRef` 없이 직접 참조한다 — `ChatChannelModule` 이 `HooksModule` 을 참조하지 않아
    순환 의존이 생기지 않음을 두 모듈 파일 모두 직접 열어 확인했다. `exports` 누락이었다면
    `HooksService` DI 해석이 런타임에 실패했을 것인데, 정확히 포함돼 있다.
  - 제안: 없음.

- **[INFO]** 재도착(duplicate) 요청이 `claim()` 에서 억제되면 그 시점 이후의 모든 하위 부작용
  (`enrichInbound` 외부 API 호출, `interactionService.interact`, `ackInteraction`, 알림 발송)이
  전부 스킵된다 — 의도된 동작이나 "claim 성공 직후 프로세스 종료" 시 응답 없는 30초 창을
  남긴다.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:338`-`345` (dedup 게이트,
    `return { executionId: 'ignored' }`)
  - 상세: `SET NX` 자체가 원자적 "선점"이라 두 인스턴스가 동시에 같은 update 를 받아도 하나만
    통과하는 것은 보장되지만, 통과한 그 하나가 이후 처리(ack/알림) 도중 죽으면 재전송은 TTL
    30초 동안 계속 억제돼 그 update 에 대한 응답이 전혀 나가지 않는다. 이는 같은 파일의
    `channelConversationService.acquireLock`/`releaseLock`(form_submission lock) 이 이미 채택한
    것과 동일 클래스의 트레이드오프이고, TTL 만료 후 자연 해소되며 스펙(`data-flow/14-chat-channel.md:196`)에도
    "TTL 30초"로 명시돼 있다 — 새로 도입된 미문서화 위험이 아니다.
  - 제안: 조치 불요 — 인지 목적 기록. 필요 시 "claim 성공 후 처리 실패" 케이스의 관측(metric/alert)을
    별도 항목으로 검토할 수 있으나 이번 PR 범위 밖이다.

- **[INFO]** dedup 게이트는 `handleChatChannelWebhook` (private, chat-channel 트리거 전용
  분기) 안에만 삽입돼 있어 일반 webhook 트리거 경로(`handleWebhook` 의 non-chat-channel 분기)
  에는 영향이 없다 — 스코프 확산 없음.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:257`(`handleChatChannelWebhook`
    시작)~`:345`(dedup 게이트)
  - 상세: 직접 소스를 읽어 새 게이트가 이 private 메서드 내부에만 존재함을 확인했다. 일반
    webhook(`WebhookInput` 기반, chat-channel 이 아닌 트리거)은 이 코드 경로를 타지 않는다.
  - 제안: 없음.

- **[INFO]** 환경 변수·네트워크 호출: 이번 diff 는 새 환경 변수를 읽거나 쓰지 않으며
  (`process.env` 참조 없음), Redis 외 외부 서비스 호출도 추가하지 않는다 — `ioredis` 는 기존
  `RedisConnectionProvider` 커넥션을 재사용할 뿐 새 커넥션을 열지 않는다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts` 전체
  - 제안: 없음.

CRITICAL/WARNING 없음. 나머지 diff(`CHANGELOG.md`, `plan/in-progress/backend-lint-gate-broken-on-main.md`,
`spec/**` 3건, `review/code/**`·`review/consistency/**` 이전 라운드 산출물)는 실행 코드가
아니며 부작용 관점 검토 대상이 아니다(spec/redis-keys.md 인벤토리 갱신은 실제 키 도입을 문서에
반영한 것으로, 코드-문서 정합을 개선하는 방향이라 부작용이 아니라 정정임).

## 요약

핵심 변경은 `ChatChannelDedupService` 신설(Redis `SET NX EX 30` 기반 in-process inbound
dedup)과 `HooksService.handleChatChannelWebhook` 에서 `parseUpdate` 직후·rate-limit 이전
지점에 그 게이트를 배선한 것이다. 새 Redis 쓰기 부작용(신규 키 네임스페이스)과 `HooksService`
생성자 시그니처 변경이 있으나, 둘 다 기존 `ChatChannelRateLimiterService` 패턴을 그대로
재사용하고, 생성자 변경은 NestJS DI 로만 소비되며(직접 위치 인자 생성 호출자 0건, 소스
직접 확인) 테스트 provider 배열도 함께 갱신돼 실제 파손 지점이 없다. Module 의
providers/exports 갱신도 짝이 맞고 순환 의존이 없으며, dedup 게이트는 chat-channel 전용
private 메서드 안에만 있어 일반 webhook 경로로 확산되지 않는다. 유일하게 언급할 만한 잠재
위험(재도착 억제로 인한 ack/알림 스킵의 극단적 실패창)은 파일 내 기존 락 패턴과 동일한
성격의 트레이드오프이며 TTL 로 자연 해소되고 spec 에도 명시돼 있어 정보성으로만 남긴다.
이전 두 라운드(`02_38_41`, `09_09_58`)의 side_effect 결론(LOW, INFO only)을 소스 재대조로
독립 재검증했으며 새로운 Critical/Warning 급 부작용은 발견되지 않았다.

## 위험도

LOW
