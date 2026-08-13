# Plan 정합성 검토 — `spec-draft-nf-ob-07-redis-fail-open.md`

## 발견사항

- **[WARNING]** "판단이 필요한 지점" 이 아직 미해결인 `CCH-SE-02` planner 결정을 "이미 구현된 서비스" 로 전제한다
  - target 위치: `plan/in-progress/spec-draft-nf-ob-07-redis-fail-open.md` L45-49 (## 판단이 필요한 지점)
    — "현재 fail-open 을 이 카운터로 보고하는 곳은 `IdempotencyInterceptor` 뿐이다. chat-channel
    계열 (`ChatChannelDedupService`·`ChatChannelRateLimiterService`·`PublicWebhookQuotaService`)도
    같은 fail-open 정책을 쓰지만 **아직 이 카운터에 배선돼 있지 않다**"
  - 관련 plan: `plan/in-progress/backend-lint-gate-broken-on-main.md` L697-707 —
    "`CCH-SE-02` 의 update dedup 이 미배선 — `ChannelUpdate.idempotencyKey` 는 dead field"
    (체크박스 `[ ]`, 미해결). 본문이 명시: "착수 시: dedup 을 구현할지, `CCH-SE-02` 를 현실에 맞게
    고칠지가 **planner 결정**이다." 즉 dedup 을 **구현할지 자체가 아직 결정되지 않았다**
    (spec 을 현실에 맞게 고치는 쪽으로 결정 날 수도 있다).
  - 상세: 이 worktree(현재 브랜치 `claude/eia-redis-failure-metric`)의 실제 소스 트리에는
    `ChatChannelDedupService` 클래스가 **존재하지 않는다** — `codebase/backend/src/modules/chat-channel/`
    에 `*dedup*` 파일 0건, `grep -rn ChatChannelDedupService codebase/backend/src` 0건,
    `CHANGELOG.md` 에도 `CCH-SE-02` 항목 없음. 그런데도 target 은 "판단이 필요한 지점" 에서 이
    클래스명을 실존 서비스처럼 인용하며 "같은 fail-open 정책을 쓰지만 배선만 안 됐다" 고 서술한다.
    dedup 이 아예 구현되지 않았다면 "fail-open 정책을 쓴다" 는 서술 자체가 성립하지 않는다 —
    target 이 CCH-SE-02 의 미해결 결정(구현 vs spec 정정)을 "구현" 쪽으로 이미 결론 낸 것처럼 쓰고
    있다. (참고: `review/code/2026/08/13/02_50_38/_prompts/scope.md` 에 `ChatChannelDedupService`
    구현 diff 가 리뷰된 흔적이 로컬에 남아 있으나, `git log`·`git branch --contains` 로 확인한 결과
    그 커밋은 현재 브랜치의 조상이 아니다 — 이 worktree/브랜치 관점에서는 미구현·미결정 상태다.)
  - 제안: target 의 해당 문장에서 `ChatChannelDedupService` 를 실존 서비스처럼 인용하지 말고
    "(CCH-SE-02, 구현 여부 미정 — `backend-lint-gate-broken-on-main.md` planner 결정 대기)" 로
    바꾸거나, 그 문장에서 아예 빼고 실존하는 두 서비스(`ChatChannelRateLimiterService`·
    `PublicWebhookQuotaService`)만 "배선 안 됨" 사례로 든다.

- **[WARNING]** "배선 안 된 Redis fail-open 소비자" 목록이 EIA 자체 rate-limiter 둘을 빠뜨리고, `PublicWebhookQuotaService` 를 잘못된 카테고리("chat-channel 계열")로 묶는다
  - target 위치: `plan/in-progress/spec-draft-nf-ob-07-redis-fail-open.md` L45-49 (## 판단이 필요한 지점)
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` L15-16 — 이미 완료
    (`[x]`)로 기록된 두 항목: `InteractionRateLimiterService`(Redis fixed-window, **fail-open**,
    §5.1/§8.4) · `OutboundNotificationRateLimiterService`(Redis fixed-window INCR+EXPIRE NX,
    **fail-open**, §8.4 row4). 둘 다 `codebase/backend/src/modules/external-interaction/` —
    이번 target 이 이미 계측한 `IdempotencyInterceptor` 와 **같은 모듈**이다.
  - 상세: 실측(`grep -n "fail.open\|metrics" interaction-rate-limiter.service.ts`)으로 확인한
    결과 이 두 서비스는 Redis 장애 시 `this.logger.warn(...)` 만 남기고 `recordRedisFailOpen` 을
    호출하지 않는다(`recordRedisFailOpen` 호출부는 전체 backend 소스 중 `idempotency.interceptor.ts`
    한 곳뿐). 즉 이 두 서비스는 target 이 "아직 배선 안 됨" 목록에서 언급한 chat-channel 계열보다
    **더 가까운(같은 모듈, 이미 완료된 기능) 미계측 사례**인데 목록에서 빠졌다. 또한
    `PublicWebhookQuotaService` 는 실제로는 `codebase/backend/src/modules/hooks/` 소속(공개
    webhook IP quota, [Spec 7-channel-web-chat/4-security.md §4] 인용)이라 "chat-channel 계열"
    로 묶은 카테고리 자체가 부정확하다.
  - 제안: "판단이 필요한 지점" 목록에 `InteractionRateLimiterService`·
    `OutboundNotificationRateLimiterService` 를 추가하고 `PublicWebhookQuotaService` 는
    별도 카테고리(공개 webhook quota)로 분리한다. 아울러 이 미계측 목록이 어느 plan 에도
    추적되지 않고 있으므로(신규 grep 결과 0건), `backend-lint-gate-broken-on-main.md` 의
    "Redis 실패율 지표" 항목(L536) 옆 또는 신규 backlog 항목으로 "다른 Redis fail-open 소비자
    배선" 을 명시적으로 남겨야 한다 — 이 저장소가 반복 학습한 "미룬 항목은 그 턴에 plan 에
    적어라" 패턴과 같다.

## 요약

target 이 등재하려는 핵심 결정(`clemvion.redis.fail_open` 카운터의 `component` 를 지금은
`idempotency` 하나로 좁힌다) 자체는 실제 코드(`RedisFailOpenComponent = 'idempotency'`,
`recordRedisFailOpen` 호출부가 `idempotency.interceptor.ts` 한 곳)와 정확히 일치하고, 해당
구현은 `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 완료로 기록돼 있어 spec 등재의
전제("이미 구현·리뷰된 사실의 등재")는 참이다. 다만 그 결정을 뒷받침하는 "판단이 필요한 지점"
서술이 두 군데서 plan 기록과 어긋난다: (1) 아직 구현 여부 자체가 미해결 planner 결정인
`CCH-SE-02`(`ChatChannelDedupService`)를 이미 존재하는 fail-open 서비스처럼 인용하고, (2) 같은
모듈에서 이미 완료된 것으로 기록된 `InteractionRateLimiterService`/
`OutboundNotificationRateLimiterService` 의 미계측 상태를 목록에서 빠뜨린 채 `PublicWebhookQuotaService`
를 잘못된 카테고리로 묶는다. 두 문제 모두 target 이 쓰려는 spec 표/미러 문장 자체(실제 diff)에는
영향이 없고 plan 문서 내 rationale 텍스트의 정확도 문제이므로, spec 쓰기를 막을 필요는 없지만
반영 전에 문구를 정정하고 미추적 backlog 를 plan 에 명시적으로 남기는 편이 안전하다.

## 위험도

MEDIUM
