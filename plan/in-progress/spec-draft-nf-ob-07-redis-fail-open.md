---
status: in-progress
worktree: eia-r8-cache-scope-4ae434
started: 2026-08-13
owner: project-planner
spec_impact:
  - spec/5-system/_product-overview.md
  - spec/data-flow/9-observability.md
---

# spec draft — NF-OB-07 메트릭 카탈로그에 `clemvion.redis.fail_open` 등재

## 왜

`BusinessMetricsService` 클래스 docstring 이 **`spec/5-system/_product-overview.md` §NF-OB-07
을 SoT 로 명시 인용**한다. 그런데 코드는 6번째 instrument(`clemvion.redis.fail_open`)를
추가했고 카탈로그 표는 5행 그대로다 — SoT 를 인용하면서 SoT 를 갱신하지 않으면 그 인용이
거짓이 된다 (`08_36_21` requirement·documentation reviewer 공통 지적, [SPEC-DRIFT]).

이것은 새 제품 결정이 아니라 **이미 구현·리뷰된 사실의 등재**다.

## 무엇을 쓸 것인가

### 1. `spec/5-system/_product-overview.md` §NF-OB-07 표에 1행 추가

| 메트릭 | 종류 | 라벨 | 의미 |
|--------|------|------|------|
| `clemvion.redis.fail_open` | Counter | `component` (idempotency), `reason` (get_failed/set_failed/serialize_failed/entry_corrupt/payload_corrupt) | Redis 의존 기능이 fail-open 으로 강등된 횟수. 알람 예: `rate(clemvion_redis_fail_open[5m]) > 0` |

라벨 값을 **표 셀에 인라인**한다 — 기존 `status`/`state` 행이 그 방식이고, 산문으로 빼면
같은 표 안에서 두 관례가 공존한다 (`09_36_31` convention_compliance INFO 4).

두 라벨 값 집합은 코드가 열거한 닫힌 집합이며 리터럴 유니온
(`RedisFailOpenComponent`/`RedisFailOpenReason`)으로 **타입 강제**된다. §NF-OB-07 서두의
"모든 라벨은 bounded cardinality" 선언과 정합한다.

### 2. `spec/data-flow/9-observability.md` 미러 문장에 항목 추가

L202-204 의 커스텀 메트릭 열거(실행 수·에러·큐 깊이·LLM 토큰·노드 지연)에
Redis fail-open 을 더한다. 이 문장은 SoT 가 아니라 미러이므로 **표와 동시 갱신**해야 한다
(한쪽만 갱신하면 drift 가 반대 방향으로 생긴다).

## 판단이 필요한 지점

**`component` 를 지금 `idempotency` 하나로 둘 것인가 — 그렇다.**

실측: 이 저장소에서 Redis fail-open 을 하는 서비스는 많지만
(`grep -rln "fail-open" --include="*.service.ts" codebase/backend/src` → 17개 파일),
**`recordRedisFailOpen` 을 호출하는 곳은 `IdempotencyInterceptor` 하나뿐이다**
(`grep -rln "recordRedisFailOpen" --include="*.ts" codebase/backend/src` → 인터셉터 +
서비스 정의 2건).

즉 나머지는 전부 **아직 이 카운터에 배선되지 않았다** — `InteractionRateLimiterService`,
`OutboundNotificationRateLimiterService`, `ChatChannelRateLimiterService`,
`PublicWebhookQuotaService`(공개 webhook quota — 앞의 rate limiter 들과는 별 범주다),
`Cafe24InstallRateLimitService` 등.

spec 에 미리 적으면 **문서가 구현보다 넓어진다** — 알람을 거는 사람이 존재하지 않는
시계열을 기다리게 된다. 배선하는 시점에 유니온·표에 함께 추가한다.

> ⚠️ 이 draft 초안은 `ChatChannelDedupService` 를 실존 서비스처럼 인용했는데, 그 클래스는
> **미머지 PR #1161 에만 있고 이 브랜치에는 없다**(`09_36_31` plan_coherence WARNING 2).
> 이 세션에서 "작업 트리 기억 ≠ 브랜치 상태" 를 반복해서 틀렸다. 위 목록은 **이 브랜치에서
> 실제로 grep 한 결과**로 다시 썼다.

## 비목표

- 다른 Redis fail-open 소비자를 이 카운터에 배선하는 것 (별도 작업 — 아래 후속 항목)
- Grafana 알람 룰 정의 (운영 영역, spec 밖)

## 후속

- [ ] **다른 Redis fail-open 소비자 배선** — 현재 관측되는 것은 EIA 멱등 캐시뿐이라, 다른
      기능이 조용히 강등돼도 이 알람은 울리지 않는다. 배선 시 `RedisFailOpenComponent`
      유니온과 §NF-OB-07 표 라벨 값을 **동시** 갱신할 것.

## 체크리스트

- [x] `/consistency-check --spec` — 1차 `09_36_31` **BLOCK: YES** (frontmatter 필수 필드 누락)
      → frontmatter 3필드 보강 + WARNING 3건 반영 후 재검토
- [ ] 재검토 BLOCK:NO 확인
- [ ] `_product-overview.md` §NF-OB-07 표 1행 추가
- [ ] `data-flow/9-observability.md` 미러 문장 갱신
