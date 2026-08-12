# 부작용(Side Effect) 리뷰 결과

## 검증 절차 (재현)

이번 diff 는 (a) `ChatChannelDedupService` 신설 + `HooksService`/`ChatChannelModule` 배선(직전 라운드
`02_38_41` 과 코드 동일) (b) 그 라운드의 리뷰 산출물(`review/code/2026/08/13/02_38_41/**`) 신규 커밋
(c) `CHANGELOG.md` / `spec/5-system/15-chat-channel.md` / `spec/4-nodes/7-trigger/providers/telegram.md`
/ `plan/in-progress/backend-lint-gate-broken-on-main.md` 문서 갱신으로 구성된다. 코드 부분이 이전
라운드와 동일한지 실측으로 재확인했다:

- `grep -rn "new HooksService(" codebase/backend/src` → 0건 (위치 인자 직접 생성 호출자 없음).
- `grep -rln "ChatChannelDedupService" codebase/backend/src` → 5개 파일(신규 서비스·spec, 모듈,
  `hooks.service.ts`/`.spec.ts`)만 참조 — 다른 곳에서 별도로 인스턴스화하지 않음.
- `hooks.module.ts` 가 `ChatChannelModule` 을 이미 `imports` 하고 있음을 재확인(`hooks.module.ts:14,25`).
- `sed -n '70,90p;320,350p' hooks.service.ts` 로 생성자·dedup 게이트 실제 소스를 직접 열어
  diff 의 게이트 번호(`:79`, `:328-345`)와 정확히 일치함을 확인.
- `HooksService` 를 provide 하는 모듈은 `hooks.module.ts` 하나뿐 — 다른 모듈의 동반 갱신 누락 없음.

## 발견사항

- **[INFO]** `ChatChannelDedupService.claim()` 은 모든 chat-channel inbound `parseUpdate` 성공 이후
  마다 Redis `SET NX EX 30` 을 실행하는 **새 쓰기 부작용**이다 — 신규 Redis 키 네임스페이스
  `cc:dedup:<triggerId>:<idempotencyKey>` 도입.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:61` (`claim()` 내부
    `this.redis.set(...)` 호출)
  - 상세: 의도된 신규 기능(Spec CCH-SE-02, `spec/5-system/15-chat-channel.md:88` — 이번 diff 에서 표
    행 자체가 실제 메커니즘으로 갱신됨)이며, Redis 부재/에러 시 `true` 반환(fail-open)+`warn` 으로
    정상 트래픽을 막지 않는다(`chat-channel-dedup.service.ts:55, 73`). `ChatChannelRateLimiterService`
    와 동일한 `@Optional() @Inject(...) → RedisConnectionProvider 폴백 → null` 패턴을 재사용해
    새로운 위험 클래스를 만들지 않는다. `'CHAT_CHANNEL_DEDUP_REDIS'` 토큰을 실제로 provide 하는 곳은
    없어 운영 경로는 항상 `RedisConnectionProvider` 폴백을 탄다 — sibling 서비스와 동일한
    "테스트 전용 override 훅" 형태.
  - 제안: 조치 불요. 참고 기록.

- **[INFO]** `HooksService` 생성자 시그니처 변경(파라미터 삽입) — 호출자 영향 재확인 완료, 안전함.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:79`
    (`private readonly chatChannelDedup: ChatChannelDedupService,` 를 `chatChannelRateLimiter` 와
    `interactionService` 사이에 삽입)
  - 상세: `grep -rn "new HooksService(" codebase/backend/src` 전수 재확인 결과 프로덕션·테스트
    어디서도 위치 인자로 직접 생성하는 곳이 없다(전부 NestJS DI). `hooks.service.spec.ts` 의
    `Test.createTestingModule` provider 배열에 `ChatChannelDedupService` mock
    (`{ claim: jest.fn().mockResolvedValue(true) }`)이 함께 추가돼 타입 기반 DI 해석이 깨지지
    않는다. `HooksModule` 은 이미 `ChatChannelModule` 을 `imports` 하고 있어(`hooks.module.ts:14,25`)
    신규 필수 의존성 주입에 별도 모듈 배선이 필요 없다.
  - 제안: 없음.

- **[INFO]** `ChatChannelModule` 의 `providers`/`exports` 양쪽에 `ChatChannelDedupService` 추가 — DI
  그래프 확장이지만 export 누락 없음을 실측 확인.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.module.ts:46, 61`
  - 상세: `HooksModule` 이 `forwardRef` 없이 `ChatChannelModule` 을 참조하므로, `exports` 에서
    빠졌다면 `HooksService` DI 가 부팅 시점에 실패했을 것이다 — 실제로는 `providers`(:46)와
    `exports`(:61) 양쪽 모두 정확히 포함돼 있어 문제 없음. sibling
    `ChatChannelRateLimiterService` 와 같은 위치에 나란히 추가되어 module 표면 관례를 그대로 따른다.
  - 제안: 없음.

- **[INFO]** 재도착(duplicate) 요청이 `claim()` 에서 억제되면 ack/알림/신규 execution 시작 등 하위
  부작용이 전부 스킵된다 — 의도된 동작이나 극단적 실패창 하나를 남긴다.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:338-345`
    (dedup 게이트, `if (!(await this.chatChannelDedup.claim(...))) { ...; return { executionId:
    'ignored' }; }`)
  - 상세: 최초 요청이 `claim()`(`SET NX`) 으로 선점에 성공한 직후 프로세스가 죽는 등으로 이후 단계
    (ack/알림/execution 시작)까지 도달하지 못하면, 같은 update 의 provider 재전송은 30초 TTL 동안
    계속 억제되어 그 update 에 대한 어떤 응답도 전송되지 않는다. 같은 파일의 기존
    `channelConversationService.acquireLock`/`releaseLock`(form_submission lock) 과 동일 클래스의
    기존 트레이드오프이며, TTL 이 짧아 자연 해소된다 — 이번 diff 가 새로 만든 위험이 아니라 이미
    채택된 fail-safe 패턴의 반복이다.
  - 제안: 조치 불요 — 인지 목적의 기록.

- **[INFO]** 이번 diff 에는 직전 리뷰 라운드(`02_38_41`)의 리뷰 산출물 전체
  (`SUMMARY.md`/`RESOLUTION.md`/각 리뷰어 `*.md`/`meta.json`/`_retry_state.json`)가 신규 파일로
  함께 커밋된다 — 런타임 부작용은 아니고 프로젝트 컨벤션(`review/code/**` 커밋)에 따른 저장소 상태
  변경이다.
  - 위치: `review/code/2026/08/13/02_38_41/**` (전부 신규 파일)
  - 상세: 이 파일들은 코드 실행 경로에 영향을 주지 않으며, `codebase/**` 변경분(`hooks.service.ts`,
    `chat-channel-dedup.service.ts` 등)이 직전 라운드 리뷰가 본 코드와 동일함을 직접 소스를 열어
    실측 확인했다 — 즉 이번 side_effect 리뷰가 관찰한 결론이 이전 라운드와 달라질 이유가 없다.
  - 제안: 조치 불요.

## 요약

핵심 변경(`ChatChannelDedupService` 신설 + `HooksService.handleChatChannelWebhook` 에서
`parseUpdate` 직후·rate-limit 이전 지점에 재도착 억제 게이트 배선)은 새 Redis 쓰기 부작용(신규 키
네임스페이스)과 `HooksService` 생성자 시그니처 변경을 수반하지만, 둘 다 기존
`ChatChannelRateLimiterService` 패턴을 그대로 재사용하고 실제 파손 지점이 없음을 `grep`/직접 소스
열람으로 재확인했다. `ChatChannelModule` 의 `providers`/`exports` 갱신도 짝이 맞고, 재도착 억제로
인한 ack/알림 스킵의 극단적 실패창은 파일 내 기존 락 패턴과 동일한 성격의 트레이드오프로 새로운
위험이 아니다. 이번 diff 에 추가로 포함된 직전 리뷰 라운드 산출물 커밋은 애플리케이션 부작용과
무관한 저장소 상태 변경이며, 문서(`CHANGELOG.md`/spec 2건/plan)만 갱신된 부분은 런타임 부작용을
전혀 만들지 않는다. CRITICAL/WARNING 급 부작용은 발견되지 않았다.

## 위험도

LOW
