# Rationale 연속성 검토 — `clemvion.redis.fail_open` 메트릭 (impl-done, scope=spec/5-system/)

## 검토 범위

diff-base `origin/main`...`HEAD`(`814c6c7a9`) 기준 실제 변경:
- `spec/5-system/_product-overview.md` (NF-OB-07 행 + 메트릭 카탈로그 6번째 instrument 추가)
- `spec/data-flow/9-observability.md` (미러 문장 + `## Rationale` 신규 소절 "`clemvion.redis.fail_open` 의 `component` 를 실제 배선된 값만 열거하는 이유")
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`,
  `codebase/backend/src/modules/metrics/business-metrics.service.ts` (다섯 fail-open 경로에 카운터 배선)
- `plan/complete/spec-draft-nf-ob-07-redis-fail-open.md` (신규, complete), `plan/in-progress/backend-lint-gate-broken-on-main.md`(후속 항목 갱신), `CHANGELOG.md`

target 은 `spec/5-system/` 자체에는 `_product-overview.md` 한 파일만 걸려 있고, 그 결정의 상세 Rationale 은 `spec/data-flow/9-observability.md`(§Rationale, 표의 실제 SoT 는 `_product-overview.md`지만 근거 서술은 이쪽)에 놓였다. 아래는 이 changeset 이 교차하는 기존 Rationale 전부를 대조한 결과다.

교차 확인한 기존 Rationale:
- `spec/5-system/4-execution-engine.md` — "왜 fail-closed(판정 불가도 거부)인가" (line ~1355): *"프로젝트의 fail-open 선례는 인프라 가용성(Redis/DB) 시나리오 한정이고, 데이터 정합성 게이트는 fail-closed 가 원칙이다."*
- `spec/5-system/14-external-interaction-api.md` §R8 "Idempotency-Key 와 `submit_form` 검증 실패의 관계" — "이 인터셉터의 다른 실패 경로(Redis 미주입·GET/SET 실패·직렬화 실패)가 모두 '멱등성을 포기하고 요청은 통과'인 것과 일관된다."
- `spec/5-system/12-webhook.md` "공개 webhook throttle Guard — 조회 실패 시 fail-open + `error` 로깅" — 별개 서비스(`PublicWebhookThrottleGuard`)의 fail-open 관측 선례.
- `spec/5-system/_product-overview.md` "관측 대상의 이원화 정책 (vs Statistics API)" — OTel=실시간 운영 알람, Statistics API=제품 분석 SoT.
- 직전 세션 산출물(`review/consistency/2026/08/13/09_48_44/rationale_continuity.md`)의 선행 대조 결과(동일 changeset 의 plan 단계 검토) — 이번 세션은 그 이후 실제 spec 반영분(`_product-overview.md`/`9-observability.md` 갱신, `10_29_50` 코드 리뷰 WARNING 2건 조치)까지 포함해 재확인.

## 발견사항

없음.

세부 대조:

1. **기각된 대안의 재도입 여부** — 없음. `component: 'idempotency'` 단일값 스코프는 코드 도입 시점부터의 최초 스코프이며, 과거에 더 넓은 범위였다가 좁혀진 이력이 없다. "라벨을 넓게 열어두지 않는다"는 판단은 오히려 기존 `recordExecutionError` 의 클램핑 관례(cardinality 방어)를 그대로 계승한다 — 별도로 기각됐던 "string 오픈 라벨" 대안을 되살리는 것이 아니라 처음부터 그 대안을 피한 설계다.
2. **합의된 원칙 위반 여부** — 없음. Redis 의존 idempotency 캐시의 fail-open 자체는 `4-execution-engine.md` 의 "인프라 가용성(Redis/DB) 시나리오 한정 fail-open" 원칙, `14-external-interaction-api.md` §R8 의 "이 인터셉터의 다른 실패 경로가 모두 fail-open" 서술과 정확히 부합한다. 이번 변경은 그 fail-open 의 **제어 흐름을 바꾸지 않고**(`of(null)`/`processFresh()`/swallow 그대로) 관측만 추가했다 — §R8 이 규정한 동작을 우회하거나 되돌리는 지점이 없다.
3. **결정의 무근거 번복 여부** — 없음. `component` 를 `idempotency` 하나로 한정한 판단은 `spec/data-flow/9-observability.md` `## Rationale` 에 신규 소절로 명시적으로 기록됐고("문서가 구현보다 넓어진다" — 직전 세션 INFO 로 지적된 갭을 이번 spec 반영에서 그대로 메움), `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 "다른 fail-open 소비자 배선"을 살아있는 후속 항목으로 명시해 두어 향후 확장 시 동시 갱신 조건(유니온 + 카탈로그 표)까지 남겼다. `12-webhook.md` 의 `PublicWebhookThrottleGuard` 등 다른 서비스의 fail-open 을 이번에 메트릭화하지 않은 것도 "누락"이 아니라 실측(`recordRedisFailOpen` 호출부 1곳 vs fail-open 서비스 17개 파일)에 근거해 범위를 의도적으로 좁힌 것이며 근거가 문서화되어 있다.
4. **암묵적 가정 충돌 여부** — 없음. `_product-overview.md` 의 "관측 대상의 이원화 정책"과 정합 — Redis fail-open 은 실시간 운영 알람 대상이라 OTel 카탈로그가 맞는 위치다. `RedisFailOpenComponent`/`RedisFailOpenReason` 리터럴 유니온으로 라벨을 코드 레벨에서 닫힌 집합으로 강제한 것도 §NF-OB-07 서두의 "모든 라벨은 bounded cardinality" 선언을 그대로 실장한 것이다.

## 참고 (결함 아님)

직전 세션(`09_48_44`)이 지적한 유일한 INFO — "component 스코프 판단이 plan 문서에만 있고 spec `## Rationale` 에는 없다" — 는 이번 반영에서 `spec/data-flow/9-observability.md` `## Rationale` 신규 소절로 해소됐다. plan 쪽 미완 체크박스(`plan-lifecycle.md §1` 위반 우려, `10_29_50` 코드리뷰 WARNING 2)도 살아있는 백로그(`backend-lint-gate-broken-on-main.md`)로 이관되어 `plan/complete/` 문서에는 체크박스가 남지 않았다 — Rationale 추적성 관점에서 두 라운드에 걸쳐 제기된 연속성 갭이 순차적으로 닫힌 사례다.

## 요약

이번 changeset 은 `IdempotencyInterceptor` 의 기존 fail-open 제어 흐름(§R8 이 규정한 "멱등성 포기·요청 통과")을 전혀 바꾸지 않고 관측(metric)만 추가했으며, 그 라벨 스코프 축소 판단은 관련 spec `## Rationale` 에 명시적으로 근거와 함께 기록되고 확장 조건은 살아있는 plan 백로그에 남아 있다. `4-execution-engine.md`(fail-open 은 인프라 가용성 시나리오 한정)·`14-external-interaction-api.md` §R8(인터셉터 실패 경로는 모두 fail-open 일관)·`_product-overview.md`(관측 이원화 정책) 등 교차 확인한 모든 기존 Rationale 과 충돌 없이 정합하며, 기각된 대안의 재도입·합의 원칙 위반·무근거 번복·암묵적 invariant 우회 어느 것도 발견되지 않았다.

## 위험도

NONE
