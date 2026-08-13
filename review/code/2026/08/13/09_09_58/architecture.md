# 아키텍처(Architecture) 리뷰 — CCH-SE-02 update dedup (통합 라운드 09_09_58)

## 범위 확인

이 diff 의 실질 아키텍처 표면은 `ChatChannelDedupService` 신설 + `ChatChannelModule` 배선 +
`HooksService.handleChatChannelWebhook` 게이트 삽입이다(파일 1~7). 나머지(파일 8~44)는
이전 두 리뷰 라운드(`02_38_41`, `02_50_38`)와 consistency 체크(`02_38_42`, `02_50_39`)의
산출물이 프로젝트 관례(`review/code/**`, `review/consistency/**` 산출물 보관)에 따라 그대로
커밋된 것이며, spec 문서 3건(`telegram.md`, `15-chat-channel.md`, `data-flow/14-chat-channel.md`)
갱신이다. 핵심 코드는 실제 소스(`chat-channel-dedup.service.ts`, `chat-channel-rate-limiter.service.ts`,
`chat-channel.module.ts`, `hooks.service.ts`)를 `Read` 로 직접 열어 독립 대조했다.

## 발견사항

- **[INFO]** `ChatChannelDedupService` 는 `ChatChannelRateLimiterService` 의 생성자·fail-open
  래핑·`Logger` 구조를 그대로 복제해 세 번째 "Redis 원자연산 + fail-open" 클래스가 됐다
  (`PublicWebhookQuotaService` 포함).
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:39`-`46`
    (생성자) vs `codebase/backend/src/modules/chat-channel/chat-channel-rate-limiter.service.ts:34`-`42`
    — 주입 토큰 이름(`CHAT_CHANNEL_DEDUP_REDIS` vs `CHAT_CHANNEL_RATE_LIMIT_REDIS`)만 다르고
    `this.redis = injectedRedis ?? redisConn?.getClientOrNull() ?? null;` 로직까지 동일함을 직접
    확인.
  - 상세: 이 프로젝트는 cafe24/makeshop 미러 등에서 "의도된 반복을 조기 통합하지 않는다"를
    반복적으로 확정한 이력이 있고, 각 클래스가 26~76줄 규모로 작아 추상화(공통 베이스 추출)
    비용이 반복 비용을 아직 넘지 않는다. 이전 두 라운드가 동일하게 지적하고 "4번째 유사
    클래스 등장을 추출 트리거로 고정"으로 처분했으며, 이번 라운드도 그 조건을 바꿀 새 인스턴스가
    없다.
  - 제안: 조치 불요. 다음에 유사한 "Redis SET/INCR + fail-open" 서비스가 하나 더 생기면(4번째)
    `resolveRedisClient(injected, provider)` 헬퍼 또는 `RedisFailOpenGuard` 공통 베이스 추출을
    실제로 검토할 것.

- **[INFO]** `HooksService.handleChatChannelWebhook` (`codebase/backend/src/modules/hooks/hooks.service.ts:257`
  ~ `:699`, 약 440줄)에 dedup 게이트가 삽입되어 순차 early-return guard 가
  인증 → 비활성 처리 → handshake(Slack/Discord) → parseUpdate → **dedup(신규)** → rate-limit →
  enrichInbound → 명령별 분기 순으로 5단계로 늘었고, 생성자 의존성도 12개(`:69`-`:84`)가 됐다.
  - 위치: 생성자 `hooks.service.ts:79`, 게이트 블록 `hooks.service.ts:338`-`345`.
  - 상세: 새 블록은 바로 뒤의 기존 rate-limit 블록(`:347`-)과
    `if (!(await guard.method(...))) { warn(); return { executionId: 'ignored' }; }` 형태로
    구조가 완전히 동일해 국소적 일관성은 유지했고(개방-폐쇄 원칙 관점에서 기존 guard 코드를
    건드리지 않고 삽입만 함), SRP 관점의 부담은 신규가 아니라 기존에 이미 있던 것이 이번
    diff 로 한 단계 더 누적된 것이다. `plan/in-progress/backend-lint-gate-broken-on-main.md` 의
    완료 서술과 두 이전 라운드 모두 "다음 게이트가 추가되는 시점"을 리팩터링 트리거로 명시했고,
    이번 diff 는 그 트리거(신규 게이트)를 포함하는 diff 자체이므로 — 다음 게이트가 또 추가될
    때는 반드시 `ChatChannelInboundAuthenticator`/`ChatChannelDedupService`/
    `ChatChannelRateLimiterService` 세 guard(모두 "trigger.id + 입력 → boolean/throw" 로
    시그니처가 균일)를 파이프라인 협력 객체로 묶는 리팩터링을 실행해야 한다.
  - 제안: 이번 PR 단독으로는 리팩터링을 요구하지 않되, **다음 chat-channel guard 추가 시점에는
    유예를 더 연장하지 말 것**.

- **[INFO]** 레이어 분리는 깔끔하다 — `ChatChannelDedupService.claim()` 은 Redis I/O 만
  캡슐화하고 boolean 만 반환하며(`chat-channel-dedup.service.ts:54`-`75`), "재도착 시 무엇을
  할지"(로그·`{ executionId: 'ignored' }` 생성)는 전부 `HooksService`(오케스트레이션 레이어)
  책임으로 남았다. 모듈 경계도 `HooksModule → ChatChannelModule` 단방향만 늘었고(`chat-channel.module.ts:46,61`
  provider/export 등록), `ChatChannelModule` 의 `imports` 에 `HooksModule` 참조가 없어 순환
  의존이 없음을 확인했다. 새 서비스를 `ChatChannelRateLimiterService`(rate quota)와 분리해
  별도 클래스로 둔 것도 "동일 update 재도착 여부"와 "쿼터 소비 여부"라는 서로 다른 판단 축을
  분리한 정당한 SRP 적용이다. 참고용 긍정 기록이며 별도 조치 불필요.

## 요약

핵심 변경(`ChatChannelDedupService` 신설, `HooksService` 배선, 모듈 등록)은 기존
`ChatChannelRateLimiterService`/`PublicWebhookQuotaService` 가 확립한 "Redis 원자 연산 +
fail-open + 개별 로깅" 패턴을 정확히 재사용했고, 인프라 계층(Redis dedup 판정)과 비즈니스
계층(`HooksService` 의 재도착 처리 결정)의 책임 분리, 모듈 경계·의존 방향(순환 없음), 개방-폐쇄
원칙(guard 삽입만, 기존 guard 미변경) 모두 실제 소스 대조 결과 문제가 없다. 남는 두 구조적
신호 — Redis fail-open 클래스 3중 복제, `HooksService.handleChatChannelWebhook` 의 guard
누적(440줄·생성자 12 의존성) — 은 이번 diff 가 새로 만든 결함이 아니라 기존 패턴을 성실히
따른 결과이며, 두 이전 리뷰 라운드가 이미 각각 명시적 트리거(4번째 유사 클래스 / 다음 게이트
추가)로 유예 처분해 이번에도 유지한다. 다만 이번 diff 자체가 "다음 게이트 추가" 트리거를
충족시키는 변경이므로, 향후 chat-channel inbound 에 guard 가 또 하나 붙는 순간에는 파이프라인
협력 객체로의 추출을 더 미루지 않아야 한다는 점을 명시적으로 남긴다.

## 위험도
LOW
