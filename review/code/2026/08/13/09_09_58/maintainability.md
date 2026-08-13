# 유지보수성(Maintainability) 리뷰 — CCH-SE-02 update dedup (최종 통합 라운드 `09_09_58`)

## 범위 확인

이번 diff 는 실질적으로 세 겹으로 구성된다: (1) `ChatChannelDedupService` 신설 + `HooksService`
배선(핵심 코드, `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts` 외
5개 파일), (2) 그 코드를 검토한 앞선 두 리뷰 라운드(`02_38_41`, `02_50_38`)와 consistency-check
라운드(`02_38_42`, `02_50_39`)의 산출물이 `review/**` 에 신규 파일로 커밋된 것, (3) spec 3개 파일
갱신(`15-chat-channel.md`, `telegram.md`, `data-flow/14-chat-channel.md`). 유지보수성 관점에서
실질 대상은 (1)이며, `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts`,
`hooks.service.ts`, 두 스펙 테스트 파일을 직접 열어 앞선 두 라운드의 판정을 독립적으로 재확인했다
— 코드 상태는 두 라운드 전(round 1)에서 이미 고정된 그대로이고 이번 라운드는 새 코드 라인을
추가하지 않았다.

## 발견사항

- **[INFO]** `handleChatChannelWebhook` 가 여전히 약 440줄 단일 메서드로, dedup 게이트(신규)까지
  더해 auth → 비활성 체크 → handshake → parseUpdate → **dedup** → rate-limit → enrichInbound →
  명령별 분기 → form/modal/interaction 처리까지 10개 이상의 책임을 담당한다.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:257`(함수 시작)~`hooks.service.ts:698`
    직전(다음 private 메서드 `reNoiseFormModal` 시작이 `:699`), 신규 게이트는 `hooks.service.ts:328`-`hooks.service.ts:345`.
  - 상세: 새 블록 자체는 바로 아래 rate-limit 블록(`:347`-)과 동일한 `if (!(await guard(...))) { warn(); return { executionId: 'ignored' }; }` 형태라 패턴 일관성은 지켰다. 이미 라운드 1 RESOLUTION 에서 WARNING #5 로 지적됐고 "**다음 게이트가 추가되는 시점**을 트리거로, 그때 파싱 후 게이트 체인을 private 헬퍼로 추출" 이라는 명시 조건으로 유예됐다. 라운드 2·이번 라운드 모두 이 메서드에 새 게이트를 추가하지 않았으므로(문서·테스트·CHANGELOG 만 추가) 유예 조건이 아직 성립하지 않는다 — 직접 `Read` 로 재확인.
  - 제안: 지금 조치 불요(트리거 미도달). 다음에 이 메서드에 새 inbound 게이트가 붙는 시점에, `chatChannelInboundAuthenticator`/`chatChannelDedup`/`chatChannelRateLimiter` 세 개(모두 "trigger.id + 입력 → boolean/throw" 로 시그니처가 균일)를 파이프라인 협력 객체로 묶는 리팩터링을 반드시 함께 수행할 것.

- **[INFO]** `ChatChannelDedupService` 생성자 보일러플레이트(`@Optional() @Inject('CHAT_CHANNEL_DEDUP_REDIS') injectedRedis?: Redis, @Optional() redisConn?: RedisConnectionProvider` + `this.redis = injectedRedis ?? redisConn?.getClientOrNull() ?? null;`)가 `ChatChannelRateLimiterService` 의 생성자와 주입 토큰 이름만 다르고 완전히 동일 — `PublicWebhookQuotaService` 까지 포함하면 "Redis 원자 연산 + fail-open + 개별 Logger" 골격 클래스가 3개.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:39`-`chat-channel-dedup.service.ts:46`
  - 상세: 같은 패턴이 이 모듈군 전반(`channel-conversation.service.ts` 등)에 이미 반복돼 있어, 이번 PR 이 새로 만든 중복이 아니라 기존에 의도적으로 유지되어 온 관용구를 한 곳 더 따른 것이다. 이 프로젝트는 cafe24/makeshop 미러·reaper/engine DRY 등에서 "axes 가 발산할 수 있는 조기 추출은 보류" 를 반복적으로 선택해 온 이력이 있고, 각 클래스가 30~40줄 규모로 작아 추상화 비용이 반복 비용을 상회할 수 있다.
  - 제안: 지금 추출을 요구하지 않음. 네 번째 "Redis fail-open guard" 클래스가 생기는 시점을 공통 베이스(`resolveRedisClient(injected, provider)` 류) 추출 트리거로 고정.

- **[INFO]** `handleChatChannelWebhook` 상단 JSDoc 의 "파이프라인 요약"(1~5단계 목록)이 이번에 삽입된 CCH-SE-02 dedup 단계와 그 바로 다음의 CCH-NF-03 rate-limit 단계를 반영하지 않는다.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:243`-`hooks.service.ts:256`(요약 목록) vs 실제 게이트 `hooks.service.ts:328`-`hooks.service.ts:362` 부근.
  - 상세: 게이트 삽입부의 인라인 주석(`:328`-`:337`)은 "왜 dedup 이 rate-limit 보다 앞이어야 하는가" 를 정확히 설명하지만, 메서드 상단의 "공식 요약"은 여전히 "1. adapter 조회 → 2. 헤더 검증 → 3. parseUpdate → 4. ChannelConversation 분기 → 5. ackInteraction" 5단계만 나열한다. 이 요약만 훑고 본문을 안 읽는 유지보수자는 "dedup 이 rate-limit 보다 먼저 실행돼야 한다" 는 순서 불변식을 놓칠 수 있다 — 순서를 바꾸는 리팩터링이 나중에 일어날 때 이 요약이 그 위험을 경고해 주지 못한다.
  - 제안: 요약 목록에 "3.5 CCH-SE-02 dedup(재도착 억제, rate-limit 보다 먼저)" · "3.6 CCH-NF-03 rate-limit" 을 추가해 실제 게이트 순서와 동기화.

- **[INFO]** `ChatChannelDedupService` 생성자의 `@Inject('CHAT_CHANNEL_DEDUP_REDIS')` 토큰에 형제 클래스가 갖고 있는 설명 주석이 없다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:39`-`chat-channel-dedup.service.ts:46` (형제: `chat-channel-rate-limiter.service.ts` 의 동형 생성자 — "테스트 주입 우선, 아니면 공유 command connection, 미가용 시 null (fail-open)." 주석 보유)
  - 상세: `'CHAT_CHANNEL_DEDUP_REDIS'` 토큰은 어떤 모듈의 `providers` 에도 provide 되지 않아(grep 확인) 프로덕션 경로는 항상 `redisConn?.getClientOrNull()` 만 탄다 — 즉 이 파라미터는 단위 테스트가 생성자를 직접 호출할 때만 의미가 있는 "테스트 전용 훅"이다. 이 사실이 클래스에 문서화돼 있지 않으면, 이후 누군가 이 토큰을 실제로 provide 하면 오버라이드된다고 오해해 죽은 provider 등록을 추가하거나, 반대로 별도 Redis 인스턴스 분리가 필요한 상황에서 왜 안 먹히는지 헤맬 수 있다.
  - 제안: 형제 클래스와 동일한 한 줄 주석을 추가.

- **[INFO]** 새 코드의 가독성·네이밍·구조는 전반적으로 양호하며 기존 컨벤션과 일관된다 (긍정 기록).
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts` 전체, `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.spec.ts` 전체.
  - 상세: `makeChatDedupKey`/`CHAT_DEDUP_WINDOW_SEC` 네이밍이 자매 파일의 `makeChatRateLimitKey`/`CHAT_RATE_LIMIT_WINDOW_SEC` 와 대칭을 이루고, 매직 넘버(30초 TTL)가 이름 있는 상수로 노출돼 있다. `claim()` 은 약 20줄, 조기 return 2개 + `try/catch` 1개로 중첩 깊이가 얕고 순환 복잡도가 낮다. `redis as never` 캐스팅은 이 모듈의 다른 테스트 파일(`chat-channel-rate-limiter.service.spec.ts`, `channel-conversation.service.spec.ts`, `chat-channel.dispatcher.spec.ts` 등)에서도 동일하게 쓰이는 확립된 관례라 새 패턴 도입이 아니다. `hooks.service.spec.ts` 신규 테스트도 기존 `moduleRef.get(...)` 오버라이드·`Logger.prototype.warn` spy + `try/finally` 복원 패턴을 그대로 따른다.
  - 제안: 조치 불요.

- **[INFO]** `chat-channel.module.ts` 상단 docstring 의 "모듈 구조" 열거가 `ChatChannelRateLimiterService`(기존)·`ChatChannelDedupService`(신규) 둘 다 빠뜨린 채 stale 하다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.module.ts:22`-`chat-channel.module.ts:32`
  - 상세: 이번 diff 가 새로 만든 문제가 아니다(`ChatChannelRateLimiterService` 는 이전부터 이미 빠져 있었음, 직접 `Read` 로 확인) — 다만 새 서비스를 추가하며 이 목록을 갱신할 기회였다.
  - 제안: 우선순위 낮음. 다음에 이 파일을 만질 때 목록을 갱신하거나 "Spec §7 참조" 로 단순화.

- **[INFO]** `review/**`, `plan/**`, `spec/**` 문서 변경분(체크박스 갱신·CHANGELOG 항목·spec 문면 정정·리뷰 산출물 신규 파일)은 코드가 아니므로 함수 길이/중첩/매직넘버 등 이번 관점의 정량 기준이 적용되지 않는다. 서술 스타일은 이 저장소의 기존 관례(현재형 서술, "완료" 블록에 근거·뮤테이션 결과 기록, WARNING/INFO 표 형식)를 일관되게 따른다.
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md`, `CHANGELOG.md`, `review/code/2026/08/13/02_38_41/**`, `review/code/2026/08/13/02_50_38/**`, `review/consistency/2026/08/13/02_38_42/**`, `review/consistency/2026/08/13/02_50_39/**`
  - 상세/제안: 조치 불요.

## 요약

핵심 신규 코드(`ChatChannelDedupService` + 스펙 + `HooksService` 배선)는 네이밍·상수화·문서화·테스트
구조·기존 컨벤션 준수 면에서 품질이 높고, `claim()` 자체는 짧고 얕은 순수 함수형 게이트라 복잡도
우려가 없다. 유지보수성 관점에서 실질적으로 남는 신호는 두 가지뿐이며 둘 다 이번 PR 이 새로 만든
결함이 아니라 이미 두 차례 리뷰 라운드를 거치며 명시적으로 유예된 기존 부담이 그대로 이어진
것이다: (1) `handleChatChannelWebhook` 가 계속 커지는 다중 책임 함수라는 점(다음 게이트 추가 시점을
추출 트리거로 명시적으로 고정해 둠), (2) `ChatChannelRateLimiterService`/`PublicWebhookQuotaService`
와 구조가 동일한 "Redis fail-open guard" 클래스가 세 번째로 늘었다는 점(네 번째 등장을 추출
트리거로 명시적으로 고정해 둠). 추가로 상단 JSDoc 파이프라인 요약이 새 게이트 순서를 반영하지
않는 점과 신규 DI 토큰에 형제 클래스가 가진 설명 주석이 없는 점은 낮은 우선순위의 INFO 로 남긴다.
CRITICAL/WARNING 급 유지보수성 결함은 발견되지 않았다.

## 위험도

LOW
