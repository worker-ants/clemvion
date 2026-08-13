# 아키텍처(Architecture) 리뷰 — CCH-SE-02 update dedup (`ChatChannelDedupService`)

## 발견사항

- **[WARNING]** `HooksService.handleChatChannelWebhook` 가 이미 ~440줄(§257–§698)에 달하는 단일
  메서드인데, 이번 diff 가 dedup 게이트(§328–§345)를 새로 이어붙여 순차 guard 체인(비활성 검사 →
  handshake → `parseUpdate` null 체크 → **dedup(신규)** → rate-limit → `/help` → conversation
  상태 분기 → `/cancel` → form modal/submission → interaction forwarding)이 6단계로 늘었다.
  단일 메서드가 인증·중복억제·쿼터·명령 라우팅·폼 상태 머신까지 서로 독립적인 여러 축의 책임을
  맡고 있어 SRP 관점에서 응집도가 낮다.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:257`(메서드 시작)–`hooks.service.ts:698`(메서드 끝),
    신규 블록은 `hooks.service.ts:328`–`hooks.service.ts:345`
  - 상세: 이번 PR 이 만든 문제는 아니다 — 새 블록은 바로 다음에 오는 기존 rate-limit 블록과
    `if (!(await guard.method(...))) { warn(); return { executionId: 'ignored' }; }` 형태로 완전히
    동형이라 국소적 일관성은 지켰다. 다만 직전 리뷰 라운드(`02_38_41`)가 이 문제를 "다음 게이트가
    추가되는 시점이 트리거" 라는 조건으로 유예했는데, 그 유예를 기록한 라운드 자체가 이미 이
    dedup 게이트를 포함하고 있었다 — 즉 트리거 조건은 아직 이번 diff 로 소진되지 않았지만, guard
    가 5→6단계로 늘어난 이번 변경이 그 카운트다운을 한 칸 더 당긴 사실은 남겨 둘 필요가 있다.
  - 제안: 즉각 조치는 불요. 다음 유사 guard(추가 보안 검사·다른 provider 전용 필터 등)가 붙는
    시점에는 `chatChannelInboundAuthenticator`/`chatChannelDedup`/`chatChannelRateLimiter` 세
    guard(모두 `trigger.id + 입력 → boolean/throw` 로 시그니처가 균일하다)를 별도
    `ChatChannelInboundGuardPipeline` 협력 객체로 추출해 `HooksService` 밖으로 빼내는 것을 확정
    작업으로 승격할 것.

- **[INFO]** `HooksService` 생성자 의존성이 12개(신규 `chatChannelDedup` 포함)로 늘었다. "일반
  webhook 트리거 처리"와 "chat-channel inbound 파이프라인 오케스트레이션(인증 → dedup →
  rate-limit → 명령 라우팅 → form 상태 머신)" 이라는 서로 다른 두 축이 한 클래스에 묶여 있는
  신호다.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:69`–`hooks.service.ts:84`(생성자
    전체, `chatChannelDedup` 은 `:79`)
  - 상세: 이번 diff 는 그 기존 축을 그대로 따라 자연스럽게 붙었을 뿐 새 결합축을 만들지는 않았다.
    다만 chat-channel 관련 guard/서비스가 하나씩 늘 때마다 이 생성자와 `HooksService` 전체의
    파라미터 개수가 함께 늘어나는 구조라, 향후 provider(예: WhatsApp 등)가 추가돼 guard 가 더
    필요해질 때 이 클래스가 계속 facade 로 비대해질 위험이 있다.
  - 제안: 위 guard-pipeline 추출과 함께, chat-channel 전용 의존성(`channelAdapterRegistry`,
    `channelConversationService`, `chatChannelRateLimiter`, `chatChannelDedup`,
    `chatChannelInboundAuthenticator`)을 하나의 `ChatChannelInboundOrchestrator` 로 묶어
    `HooksService` 는 그 오케스트레이터 하나만 주입받는 방향을 다음 확장 시점의 후보로 남긴다.

- **[INFO]** `ChatChannelDedupService` 는 `ChatChannelRateLimiterService` 의 생성자/필드 구조를
  거의 그대로 복제한 형태다 (`@Optional() @Inject('CHAT_CHANNEL_*_REDIS')` 주입 → `RedisConnectionProvider`
  폴백 → `null`, `Logger` 필드, `try/catch` fail-open 래핑). `PublicWebhookQuotaService` 까지
  포함하면 같은 뼈대("Redis 원자 연산 + fail-open + 별도 로깅")를 가진 클래스가 세 개다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:39`–`chat-channel-dedup.service.ts:46`
    vs `codebase/backend/src/modules/chat-channel/chat-channel-rate-limiter.service.ts:34`–`chat-channel-rate-limiter.service.ts:42`
    (직접 대조 확인)
  - 상세: Template Method/공통 베이스로 뽑아낼 여지는 있으나, 이 저장소는 cafe24/makeshop 미러
    등에서 "의도된 반복을 억지로 통합하지 않는다"는 결정을 여러 번 내린 이력이 있고, 각 클래스가
    30~50줄 규모로 작아 추상화 비용이 반복 비용을 아직 넘어서지 않는다. 이번 PR 로 세 번째
    사례가 됐다는 점 자체가 "패턴 확정 신호" 다.
  - 제안: 지금 통합은 불요. 네 번째 유사 서비스가 추가되는 시점을 `RedisFailOpenGuard`(생성자 +
    `runOrFailOpen(fn)` 헬퍼) 공통 베이스 추출의 트리거로 삼을 것.

- **[INFO]** `cc:dedup:<triggerId>:<idempotencyKey>` 키는 실행 엔진 §9.1 의
  `{service}:{workspaceId}:{resource}:{id}:{sub}` Redis 키 레지스트리 규약(workspaceId 세그먼트
  필수)을 따르지 않는다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:6`–`chat-channel-dedup.service.ts:9`
    (`makeChatDedupKey`)
  - 상세: 새 이슈가 아니라 형제 클래스 `ChatChannelRateLimiterService` 의 `cc:rl:<triggerId>:<conversationKey>`
    와 정확히 동일한 기존 편차를 재사용한 것이며, `plan/in-progress/backend-lint-gate-broken-on-main.md`
    가 이미 별도 항목(EIA 계열 Redis 키가 §9.1/§9.2 레지스트리에 없음, 그리고 chat-channel 키
    2계열 누락 항목)으로 추적 중이다. `chat-channel` 모듈 자체가 이미 workspace 필터 없이
    `endpointPath` 로 트리거를 찾는 구조라 trigger 단위 스코핑으로 실질 충분하지만, 규약 문서와
    구현의 괴리는 별도 트랙 정리 대상이다.
  - 제안: 새 조치 불필요(중복 추적 방지). 기존 plan 항목 처분 시 `cc:rl:`/`cc:dedup:` 를 함께
    판단할 것.

## 레이어/결합도/확장성 평가 (문제 없음, 참고용)

- **레이어 분리**: `ChatChannelDedupService` 는 Redis I/O 만 캡슐화하는 순수 인프라 계층
  클래스로, "재도착이면 무엇을 할지"라는 비즈니스 판단은 전혀 갖지 않고 `boolean` 만 반환한다
  (`codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:54`). 그 결과로
  `{ executionId: 'ignored' }` 를 구성하는 것은 `HooksService` 의 책임으로 남아 있어 인프라/비즈니스
  레이어 경계가 명확하다.
- **의존성 역전**: `HooksService` 는 `Redis` 클라이언트를 직접 주입받지 않고
  `ChatChannelDedupService` 라는 서비스 추상을 생성자 주입받는다(`hooks.service.ts:79`) — DIP
  준수.
- **모듈 경계·순환 의존성**: `HooksModule` 이 `ChatChannelModule` 을 `imports` 에 두고
  (`codebase/backend/src/modules/hooks/hooks.module.ts:25`), `ChatChannelModule` 은
  `ChatChannelDedupService` 를 `providers`/`exports` 양쪽에 등록했다
  (`codebase/backend/src/modules/chat-channel/chat-channel.module.ts:46,61`). `ChatChannelModule`
  이 `HooksModule` 을 참조하지 않아(직접 확인) 단방향 의존만 추가됐고 `forwardRef` 도 불필요하다 —
  순환 의존 없음.
- **개방/폐쇄**: 배치 순서(`parseUpdate` 직후, rate-limit 이전)는 코드 주석에 근거가 명시돼 있고
  (`hooks.service.ts:328`–`337`), 기존 guard(인증·`parseUpdate`·rate-limit)의 코드는 전혀 변경하지
  않은 채 새 guard 를 사이에 삽입만 했다 — 확장이 기존 요소 수정 없이 이뤄졌다.
  단, 이 "삽입" 자체가 위 WARNING 이 지적하는 함수 비대화의 누적 방식이다.
- **테스트 아키텍처**: `chat-channel-dedup.service.spec.ts`(서비스 단위)와
  `hooks.service.spec.ts`(호출부 통합)로 분리돼 "서비스 판정이 옳다"와 "호출부가 그 결과를
  실제로 소비한다"를 독립적으로 고정한다 — 계층 경계에 맞는 테스트 경계 설계.
- **역할/문서 경계(참고)**: `spec/5-system/15-chat-channel.md` · `spec/4-nodes/7-trigger/providers/telegram.md`
  · `spec/data-flow/14-chat-channel.md` 가 이번 diff 에 함께 포함돼 있다. 코드 아키텍처 자체와는
  무관하지만, CLAUDE.md 가 규정하는 "developer 는 `spec/` read-only, 변경은 project-planner
  위임" 이라는 **레이어(역할) 경계**를 developer 턴에서 넘었다는 사실은 `scope.md`/`RESOLUTION.md`
  에 이미 WARNING #1 로 기록·인정돼 있어 여기서 중복 지적하지 않는다.

## 요약

새 `ChatChannelDedupService` 는 기존 `ChatChannelRateLimiterService`/`PublicWebhookQuotaService`
가 확립한 "Redis 원자 연산 + fail-open + 별도 로깅" 패턴을 정확히 재사용해 도입됐고, 인프라 계층
(Redis dedup 판정) ↔ 비즈니스 계층(`HooksService` 의 재도착 처리 결정)의 책임 분리·DIP·모듈
경계(단방향, 순환 없음)가 모두 깔끔하다. 구조적으로 누적되고 있는 부담 두 가지 — (1)
`HooksService.handleChatChannelWebhook` 이 이미 ~440줄짜리 다축 책임 메서드인데 이번 diff 로
guard 체인이 6단계까지 늘었고, (2) `HooksService` 생성자가 12개 의존성을 갖는 facade 로 계속
비대해지고 있다는 점 — 은 이번 PR 자체의 결함이라기보다 기존 패턴을 성실히 따른 결과지만, 다음
확장 시점에는 guard-pipeline/오케스트레이터 추출을 실제로 실행할 필요가 있다. 동일 골격의 Redis
fail-open 클래스가 세 개로 늘어난 점과 Redis 키가 §9.1 레지스트리 규약을 따르지 않는 점은 이미
plan 백로그에 추적되는 기존 편차의 재사용이라 새 위험이 아니다. Critical 급 구조 결함은 없다.

## 위험도

LOW
