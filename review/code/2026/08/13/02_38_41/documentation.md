# 문서화(Documentation) 리뷰 — CCH-SE-02 chat-channel update dedup

## 발견사항

- **[WARNING]** `spec/4-nodes/7-trigger/providers/telegram.md` §8 "비기능" 의 미구현(Planned) 서술이 이번 구현으로 stale 해졌다
  - 위치: `spec/4-nodes/7-trigger/providers/telegram.md:235` (Read 로 직접 확인한 실제 소스 라인 — 이 파일은 이번 diff 대상 목록에 없어 게이트가 없음)
  - 상세: 해당 줄은 "**미구현 (Planned)**: update_id 기반 dedup — 같은 update_id 가 30초 안에 두 번 도착하면 두 번째는 무시 (idempotency). parser 가 `idempotencyKey = String(update_id)` 를 채우지만 이를 소비해 중복을 차단하는 consumer 가 없다 (`ChannelUpdate.idempotencyKey` read 처 0건)." 라고 적혀 있다. 이번 PR 이 정확히 이 갭(consumer 부재)을 `ChatChannelDedupService` 로 닫았고, `spec/5-system/15-chat-channel.md` 의 CCH-SE-02 행은 그에 맞게 갱신됐지만(`파일 7` diff), 같은 갭을 서술하는 이 sibling 문서는 리뷰 대상 diff에 포함되지 않아 여전히 "consumer 없음" 이라고 반증된 문구를 유지한다. `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 완료 서술도 `15-chat-channel.md` L88 만 인용하고 이 파일은 언급하지 않아, 놓친 것으로 보인다.
  - 제안: 이 bullet 을 제거하거나 "구현됨(`ChatChannelDedupService`, 2026-08-13)" 으로 갱신하고, `spec/5-system/15-chat-channel.md` CCH-SE-02 행과 동일한 사실(Redis `SET NX EX 30`, 키 `cc:dedup:<triggerId>:<updateId>`, fail-open)을 반영한다.

- **[WARNING]** `CHANGELOG.md` 에 이번 변경(`Unreleased`) 항목이 없다
  - 위치: `CHANGELOG.md` (신규 항목 부재 — 특정 줄 아님)
  - 상세: 이 저장소는 "필수 요구사항이 배선되지 않은 dead field 를 실제로 소비하도록 고쳤다" 류의 변경마다 `## Unreleased — <제목>` 항목을 상세히 남기는 관례가 확립돼 있다(예: 같은 파일 356·402·483행 근방의 chat-channel/EIA 관련 항목들, 그리고 현재 파일 최상단의 "EIA §R8 캐시 키 스코프" 항목). 이번 변경은 정확히 같은 클래스다 — `ChannelUpdate.idempotencyKey` 가 파싱만 되고 읽는 곳이 0곳이던 dead field 를 `ChatChannelDedupService` 로 실제 소비하게 배선했고, `CCH-SE-02` spec 문구 자체도 사실과 다르게 서술돼 있어 함께 고쳤다(동작 변경 + spec 정정 두 축). `git log -S CCH-SE-02 CHANGELOG.md` / grep 결과 관련 항목이 없다.
  - 제안: `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 이미 서술된 "완료 (2026-08-13, `cch-se02-dedup`)" 단락을 근거로 `## Unreleased — chat-channel update dedup 미배선(CCH-SE-02) 을 배선` 항목을 추가한다.

- **[INFO]** `HooksService.handleChatChannelWebhook` 의 메서드 docstring 파이프라인 목록이 새 dedup 단계(및 기존 rate-limit 단계)를 반영하지 않는다
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:243-256` (diff 밖 기존 컨텍스트 — 실제 소스 게이트 번호로 확인)
  - 상세: 이 JSDoc 은 "1. adapter 조회 → 2. 헤더 검증 → 3. parseUpdate → 4. ChannelConversation 조회/분기 → 5. ackInteraction" 5단계로 파이프라인을 요약하는데, 실제로는 `parseUpdate` 직후에 **CCH-SE-02 dedup**(신규, 328~345행)과 **CCH-NF-03 rate-limit**(기존, 347행~)이 순서대로 개입한다. 이번 diff 가 추가한 인라인 주석(328~337행)은 정확하지만, 메서드 상단의 "공식 요약"에는 반영되지 않아 이 docstring 만 보고 흐름을 파악하는 독자는 두 게이팅 단계(특히 "dedup 이 rate-limit 보다 앞" 이라는, 코드 본문에서 강조하는 순서 불변식)를 놓칠 수 있다.
  - 제안: docstring 목록에 "3.5 CCH-SE-02 dedup(재도착 억제, rate-limit 보다 먼저)" · "3.6 CCH-NF-03 rate-limit" 을 추가해 실제 순서와 동기화한다.

- **[INFO]** `ChatChannelDedupService` 생성자가 형제 클래스(`ChatChannelRateLimiterService`)와 동일한 DI 패턴을 쓰면서 그 설명 주석은 옮기지 않았다
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:39-46`
  - 상세: `ChatChannelRateLimiterService` 의 동형 생성자(`chat-channel-rate-limiter.service.ts:34-42`)는 `this.redis = injectedRedis ?? redisConn?.getClientOrNull() ?? null;` 위에 "// 테스트 주입 우선, 아니면 공유 command connection, 미가용 시 null (fail-open)." 주석을 달아 `@Inject('CHAT_CHANNEL_RATE_LIMIT_REDIS')` 토큰이 **테스트 전용이고 프로덕션 모듈에서 provide 되지 않는다**는 사실을 명시한다. 신규 `ChatChannelDedupService` 는 같은 구조(`@Inject('CHAT_CHANNEL_DEDUP_REDIS')`)를 그대로 복제했지만 이 설명 주석이 없다. 실제로 `chat-channel.module.ts` 의 `providers`/`imports` 어디에도 `'CHAT_CHANNEL_DEDUP_REDIS'` 를 provide 하는 곳이 없음을 grep 으로 확인했다 — 즉 프로덕션에서는 항상 `redisConn?.getClientOrNull()` 경로만 타고, 이 토큰은 단위 테스트가 `new ChatChannelDedupService(redis as never, undefined)` 로 직접 생성자를 호출할 때만 의미가 있다. 이 점이 클래스에 문서화돼 있지 않으면, 이후 누군가 "이 토큰을 provide 하면 오버라이드된다" 고 오해하고 죽은 provider 등록을 추가하거나, 반대로 실제로 provide 가 필요한 상황(예: 별도 Redis 인스턴스 분리)에서 왜 안 먹히는지 헤맬 수 있다.
  - 제안: 형제 클래스와 동일한 한 줄 주석("테스트 주입 우선, 아니면 공유 command connection, 미가용 시 null (fail-open).")을 추가한다.

- **[INFO]** `ChatChannelModule` 상단 docstring 의 "모듈 구조" 열거가 기존부터 stale 했고 이번 추가도 반영되지 않았다
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.module.ts:22-32` (diff 밖 기존 컨텍스트)
  - 상세: 모듈 docstring 은 "Spec §7 의 모듈 구조" 로 `ChannelAdapterRegistry` / `ChannelConversationService` / `ChatChannelDispatcher` / `providers/telegram` 만 나열한다. 이미 존재하던 `ChatChannelRateLimiterService` 도 이 목록에 없었고, 이번에 추가된 `ChatChannelDedupService` 도 마찬가지로 빠졌다 — 이번 diff 로 새로 생긴 문제는 아니지만, 새 서비스를 추가하면서 이 목록을 갱신할 기회였다.
  - 제안: 우선순위 낮음. 다음에 이 파일을 만질 때 `ChatChannelRateLimiterService`·`ChatChannelDedupService` 를 목록에 추가하거나, 목록 자체를 제거하고 "Spec §7 참조" 로 단순화하는 편을 고려.

## 요약

핵심 신규 코드(`ChatChannelDedupService`, 그 스펙 파일, `HooksService` 배선)의 독스트링·인라인 주석 품질은 높다 — 클래스/함수 JSDoc 이 "왜"(HTTP 인터셉터 미경유, rate-limit 과의 순서, fail-open 정책 근거)까지 구체적으로 설명하고, 테스트 파일 헤더가 이 서비스의 존재 이유(dead field → 실제 억제)를 재확인하며, `spec/5-system/15-chat-channel.md` 의 CCH-SE-02 요구사항 문구도 실제 구현(Redis `SET NX EX 30`, 키 포맷, fail-open)에 맞게 정확히 정정됐다. 다만 같은 갭을 서술하던 sibling spec(`providers/telegram.md §8`)이 "consumer 없음" 이라는 이제는 틀린 문구를 그대로 남겨 spec 간 정합이 깨졌고(WARNING), 이 저장소의 확립된 관례인 `CHANGELOG.md` `Unreleased` 항목이 이번처럼 의미 있는 동작 변경+spec 정정 조합에 대해 빠져 있다(WARNING). 나머지는 기존 파일들의 사전 존재하던 문서 drift 를 이번 diff 가 갱신할 기회를 놓친 수준의 경미한(INFO) 사안이다.

## 위험도

MEDIUM
