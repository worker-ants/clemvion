# 부작용(Side Effect) 리뷰 결과 — CCH-SE-02 update dedup (라운드 `03_04_02`)

## 검증 절차

프롬프트 diff 를 신뢰하지 않고 실제 소스를 직접 `Read`/`Grep` 으로 재대조했다:
`chat-channel-dedup.service.ts`, `hooks.service.ts`(생성자·CCH-SE-02 게이트 블록 전체),
`chat-channel.module.ts`(전체) 를 열어 게이트 번호와 일치함을 확인했고, `new HooksService(`
positional 호출자 0건(`grep -rn`), `CHAT_CHANNEL_DEDUP_REDIS`/`CHAT_CHANNEL_RATE_LIMIT_REDIS`
토큰이 provider 로 바인딩된 곳 0건, `chat-channel.module.ts` `imports` 에 `HooksModule` 참조
없음(순환 의존 없음)을 각각 실측했다.

## 발견사항

- **[INFO]** `ChatChannelDedupService.claim()` 이 모든 chat-channel inbound 요청마다 Redis
  `SET NX EX 30` 을 실행하는 **새 쓰기 부작용**이다 — 신규 키 네임스페이스
  `cc:dedup:<triggerId>:<idempotencyKey>` 도입.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:61`-`67`
    (`claim()` 내부 `this.redis.set(...)`)
  - 상세: 의도된 신규 기능(Spec CCH-SE-02)이고 `spec/data-flow/14-chat-channel.md`
    (Redis 스키마 매핑 표, `cc:dedup:{triggerId}:{idempotencyKey}` 행)·
    `spec/5-system/15-chat-channel.md` CCH-SE-02 행에 동일 메커니즘(키 형식·TTL 30초·fail-open)이
    문서화돼 SoT 와 코드가 일치한다. sibling `ChatChannelRateLimiterService` 와 동일한 Redis 주입
    패턴(`@Optional() @Inject(...)` → `RedisConnectionProvider.getClientOrNull()` → `null`)을
    재사용해 새 위험 클래스를 만들지 않는다.
  - 제안: 조치 불요. 참고 기록.

- **[INFO]** `HooksService` 생성자 시그니처 변경(필수 파라미터 삽입) — 호출자 영향 직접 확인, 안전함.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:79`
    (`private readonly chatChannelDedup: ChatChannelDedupService,` 를 `chatChannelRateLimiter` 와
    `interactionService` 사이에 삽입)
  - 상세: `grep -rn "new HooksService("` 로 저장소 전체를 재확인한 결과 프로덕션·테스트 어디서도
    positional 인자로 직접 생성하는 곳이 없다(전부 NestJS DI). `hooks.service.spec.ts` 의
    `Test.createTestingModule` provider 배열에 `ChatChannelDedupService` mock
    (`{ claim: jest.fn().mockResolvedValue(true) }`)이 함께 추가돼 타입 기반 DI 해석이 깨지지 않는다.
  - 제안: 없음.

- **[INFO]** `ChatChannelModule` 의 `providers`/`exports` 양쪽에 `ChatChannelDedupService` 추가 —
  DI 그래프 확장, 순환 의존 없음.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.module.ts:46`, `:61`
  - 상세: `HooksModule` 이 `ChatChannelModule` 을 `imports` 에 두므로(`forwardRef` 미사용) exports
    누락 시 런타임 DI 실패로 즉시 드러났을 것 — 직접 파일을 열어 두 배열 모두에 정확히 포함됨을
    확인했다. `chat-channel.module.ts` 의 `imports` 에는 `HooksModule` 참조가 없어(직접 확인)
    양방향 순환이 없다.
  - 제안: 없음.

- **[INFO]** dedup `claim()` 성공(Redis `SET NX` 성공) 직후 하위 단계(rate-limit consume·
  execution 시작 등)에서 처리 실패가 나면, 같은 update 의 provider 재전송이 **TTL 30초 동안
  계속 억제**돼 그 update 에 대한 어떤 응답도 나가지 않는 실패창이 생긴다 — "중복 방지" 를 위해
  만든 게이트가 그 30초 구간에서는 "정당한 재시도 억제(사실상 일시적 메시지 유실)" 로 뒤집힐 수
  있다.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:338`-`345` (dedup 게이트) 이후의
    `:347`(rate-limit)~ 나머지 파이프라인 전체가 이 실패창의 대상.
  - 상세: fail-open 은 "Redis 자체가 죽었을 때" 만 다루고, "Redis 는 살아서 claim 에는 성공했는데
    그 다음 로직이 죽는" 경우는 다루지 않는다 — 설계상 당연한 트레이드오프이고 같은 파일의
    `channelConversationService.acquireLock`/`releaseLock`(form_submission lock) 도 동일 클래스의
    선재 트레이드오프라 이번 diff 가 새로 만든 위험 유형은 아니다. TTL 이 30초로 짧아 영향 범위도
    제한적이다.
  - 제안: 조치 불요(이미 인지·수용된 트레이드오프, 기존 락 패턴과 동일 성격). 필요 시 "claim 성공
    후 처리 실패" 케이스에 대한 관측(metric/alert)을 별도 항목으로 검토할 수 있으나 이번 PR
    범위 밖.

- **[INFO]** `spec/5-system/15-chat-channel.md` · `spec/4-nodes/7-trigger/providers/telegram.md` ·
  `spec/data-flow/14-chat-channel.md` 변경은 문서 전용이라 런타임 부작용이 없다. 다만 이 세 파일이
  `developer` 턴에서 직접 수정된 것(CLAUDE.md 는 `developer` 를 `spec/` read-only 로 규정)은
  이미 `RESOLUTION.md`(WARNING #1)·`scope.md`(WARNING)가 별도로 다루고 있는 절차 이슈이며, 부작용
  관점(전역 상태·파일시스템·네트워크·시그니처)에는 해당하지 않는다 — 참고만 하고 중복 지적하지
  않는다.
  - 위치: `spec/5-system/15-chat-channel.md`(§3.4 CCH-SE-02 행), `spec/4-nodes/7-trigger/providers/telegram.md:235`-`236`
  - 제안: 없음(scope/documentation 트랙에서 이미 처리).

- **[INFO]** `codebase/backend/src/modules/hooks/hooks.service.spec.ts` 에 `Logger` import 가
  이미 존재하는 `@nestjs/common` import 구문과 별도 줄로 중복 선언됐다(`:11` 부근). 컴파일·테스트에
  영향은 없음(eslint 0/0, 419 suites 전부 통과 확인됨) — 스타일 사안이라 side-effect 등급 아님,
  참고만.

## 요약

핵심 변경은 `ChatChannelDedupService` 신설(Redis `SET NX EX 30` 기반 in-process inbound dedup)과
`HooksService.handleChatChannelWebhook` 에서 `parseUpdate` 직후·rate-limit 이전 지점에 그 게이트를
배선한 것이다. 실제 소스를 직접 열어 재확인한 결과 새 Redis 쓰기 부작용(신규 키 네임스페이스)과
`HooksService` 생성자 시그니처 변경 모두 기존 `ChatChannelRateLimiterService` 패턴을 그대로
재사용하며, 생성자 변경은 NestJS DI 로만 소비돼(positional 호출자 0건 재확인) 실제 파손 지점이
없다. Module 의 providers/exports 갱신도 양쪽 다 정확하고 순환 의존이 없음을 직접 확인했다.
유일하게 남기는 잠재 위험(claim 성공 후 다운스트림 실패 시 TTL 30초 동안 재시도가 억제되는 좁은
실패창)은 파일 내 기존 락 패턴과 동일한 성격의, 이미 인지된 트레이드오프로 이번 diff 가 새로
도입한 결함이 아니며 즉각 조치를 요하지 않는다. spec/plan/review 문서 변경은 전부 런타임에
영향이 없는 문서 전용 diff 다. Critical·Warning 급 부작용은 발견되지 않았다.

## 위험도

LOW
