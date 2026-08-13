# 아키텍처(Architecture) 리뷰 — CCH-SE-02 update dedup

## 발견사항

- **[INFO]** `ChatChannelDedupService` 는 기존 `ChatChannelRateLimiterService` 를 구조적으로
  그대로 복제한 형태다 (constructor 의 `@Optional()@Inject('CHAT_CHANNEL_..._REDIS')` +
  `RedisConnectionProvider` 폴백, `try/catch` fail-open 래핑, `Logger` 필드). `PublicWebhookQuotaService`
  까지 포함하면 같은 뼈대를 가진 "Redis SET/INCR + fail-open" 클래스가 세 개다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:34`–`76`
    (클래스 전체) vs `codebase/backend/src/modules/chat-channel/chat-channel-rate-limiter.service.ts:29`–`78`
  - 상세: 두 클래스가 거의 1:1 대응(생성자 패턴, fail-open 정책, 로깅 문구 스타일)이라
    Template Method 로 뽑아낼 여지가 있다. 다만 이 프로젝트는 이미 cafe24/makeshop 미러
    등에서 "의도된 반복을 억지로 통합하지 않는다"는 결정을 여러 번 내린 이력이 있고, 각
    클래스가 26~30줄 규모로 작아 추상화 비용이 반복 비용을 넘어설 수 있다.
  - 제안: 지금 당장 통합할 필요는 없음. 세 번째(`ChatChannelDedupService`)까지 늘어난 시점을
    "패턴 확정 신호"로 보고, 다음 유사 서비스가 추가될 때 `RedisFailOpenGuard` 류의 공통
    베이스(생성자 + `runOrFailOpen(fn)` 헬퍼)로 추출을 고려할 것.

- **[INFO]** `HooksService` 생성자 의존성이 12개로 늘었고(`chatChannelDedup` 신규 추가),
  `handleChatChannelWebhook` 는 약 435줄(auth guard → 비활성 처리 → provider 핸드셰이크 →
  dedup → rate-limit → enrichInbound → 명령별 분기 → form/modal/interaction 처리)짜리
  단일 메서드로 계속 커지고 있다. 이번 diff 는 새 관심사(재도착 억제)를 그 안에 한 블록
  더 추가하는 방식으로 기여했다.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:79` (생성자 파라미터 추가),
    `codebase/backend/src/modules/hooks/hooks.service.ts:338`–`345` (dedup 체크 블록),
    메서드 전체는 `handleChatChannelWebhook`
  - 상세: SRP 관점에서 `HooksService` 가 "일반 webhook 트리거 처리"와 "chat-channel inbound
    파이프라인 오케스트레이션(인증 → dedup → rate-limit → 명령 라우팅 → form 상태 머신)"
    두 축을 한 클래스에 담고 있다. 이번 변경은 그 기존 축을 그대로 따라 기존 스타일
    (early-return guard 순차 호출)로 자연스럽게 붙였기 때문에 국소적으로는 일관성이 있지만,
    누적되는 방향은 "확장성" 관점에서 향후 provider 나 guard 가 늘수록 이 메서드의 인지
    복잡도가 계속 증가한다는 신호다.
  - 제안: 당장 리팩터링을 요구할 사안은 아니나, `chatChannelInboundAuthenticator` /
    `chatChannelDedup` / `chatChannelRateLimiter` 세 개의 순차 guard 호출을 별도
    `ChatChannelInboundGuardPipeline` 같은 협력 객체로 묶어 `HooksService` 밖으로 빼내는
    것을 다음 chat-channel 관련 작업의 후보로 남겨둘 만하다 — 세 guard 모두 "trigger.id +
    입력 → boolean/throw" 형태로 시그니처가 균일해 파이프라인화 비용이 낮다.

- **[INFO]** dedup 키(`cc:dedup:<triggerId>:<idempotencyKey>`)는 실행 엔진 §9.1 의
  `{service}:{workspaceId}:{resource}:{id}:{sub}` Redis 키 레지스트리 규약을 따르지 않는다
  (workspaceId 세그먼트 없음). 다만 이는 새로 만든 문제가 아니라 형제 클래스
  `ChatChannelRateLimiterService` 의 `cc:rl:<triggerId>:<conversationKey>` 와 동일하게
  기존에 이미 있던 편차이며, `plan/in-progress/backend-lint-gate-broken-on-main.md` 가 이미
  별도 항목(`convention_compliance INFO 4`, EIA 계열 Redis 키가 §9.1/§9.2 레지스트리에 없음)으로
  추적 중이다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:6`–`9`
    (`makeChatDedupKey`)
  - 상세: 새 이슈가 아니라 기존 형제 패턴을 정확히 따른 것 — 이 리뷰에서는 확산을 확인만
    한다. `chat-channel` 모듈은 이미 workspace 필터 없이 `endpointPath` 로 트리거를 찾는
    구조(§ handleWebhook step 1)라 트리거 단위 스코핑이 실질적으로 충분하지만, 규약 문서와
    구현이 갈라져 있다는 사실 자체는 별도 트랙에서 정리 대상.
  - 제안: 새 조치 불필요(중복 추적 방지). 기존 plan 항목이 처분될 때 `cc:rl:`/`cc:dedup:`
    둘 다 함께 판단하면 된다.

## 레이어/결합도 평가 (문제 없음, 참고용)

- `ChatChannelDedupService` 는 Redis I/O 를 캡슐화하는 순수 인프라 계층 클래스로, 비즈니스
  판단(재도착 시 무엇을 할지)은 전혀 갖지 않고 boolean 만 반환한다 — `HooksService` 가 그
  결과로 `{ executionId: 'ignored' }` 를 만들지 결정. 레이어 책임 분리가 명확하다
  (`codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:54`).
- 모듈 경계: `HooksModule` → `ChatChannelModule` 단방향 의존만 추가됐다(`ChatChannelDedupService`
  가 `ChatChannelModule` 의 `providers`/`exports` 양쪽에 등록, `codebase/backend/src/modules/chat-channel/chat-channel.module.ts:46,61`).
  `ChatChannelModule` 이 `HooksModule` 을 참조하지 않으므로 순환 의존 없음.
- 배치 순서(`parseUpdate` 직후, rate-limit 이전)는 코드 주석에 근거가 명시돼 있고
  (`codebase/backend/src/modules/hooks/hooks.service.ts:328`–`337`), "재도착은 새 트래픽이
  아니므로 쿼터를 소비하면 안 된다"는 설계 의도와 실제 배치가 일치한다 — 개방/폐쇄
  관점에서도 기존 guard 체인에 새 guard 를 삽입만 했을 뿐 기존 guard 들의 코드를 변경하지
  않았다.
- 테스트(`chat-channel-dedup.service.spec.ts`)는 서비스 단위 테스트와 `hooks.service.spec.ts`
  의 호출부 테스트로 나뉘어 있어, "서비스가 옳다"와 "호출부가 그 결과를 실제로 쓴다"를
  각각 별도로 고정한다 — 테스트 아키텍처 관점에서도 적절한 경계.

## 요약

새 `ChatChannelDedupService` 는 기존 `ChatChannelRateLimiterService`/`PublicWebhookQuotaService`
가 확립한 "Redis 원자 연산 + fail-open + 별도 로깅" 패턴을 정확히 재사용해 도입됐고, 인프라
계층(Redis dedup) ↔ 비즈니스 계층(`HooksService` 의 재도착 판단)의 책임 분리도 명확하며,
모듈 경계·의존 방향에 순환이나 위반이 없다. 유일하게 누적되는 구조적 부담은
`HooksService.handleChatChannelWebhook` 이 guard 를 하나씩 이어붙이는 방식으로 계속
길어지고 있다는 점과, 동일 골격의 Redis fail-open 클래스가 세 개로 늘어났다는 점인데
둘 다 이번 diff 자체의 결함이라기보다 기존 패턴을 성실히 따른 결과이며 즉각적인 조치가
필요한 수준은 아니다.

## 위험도
LOW
