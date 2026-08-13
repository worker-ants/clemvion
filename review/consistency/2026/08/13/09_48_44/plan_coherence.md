# Plan 정합성 검토 — spec-draft-nf-ob-07-redis-fail-open.md

## 발견사항

없음.

검토 근거:

1. **미해결 결정과의 충돌** — `plan/in-progress/**` 전체에서 "결정 필요"로 남겨둔 항목 중
   본 target 이 다루는 `clemvion.redis.fail_open` 메트릭/`component`/`reason` 라벨과
   관련된 것은 없다. target 이 스스로 명시한 판단("`component` 를 `idempotency` 하나로
   둔다")은 다른 어떤 plan 에서도 확장 결정이 진행 중이지 않다 — `InteractionRateLimiterService`
   등 다른 소비자를 언제 배선할지에 대한 별도 plan 자체가 존재하지 않으므로 target 이
   그 결정을 선점하거나 우회하는 것도 아니다.

2. **선행 plan 미해소** — target 이 가정하는 사전 조건(코드가 이미 `clemvion.redis.fail_open`
   카운터를 `BusinessMetricsService`에 추가하고 `IdempotencyInterceptor`의 5개 fail-open
   경로에 배선함)은 `plan/in-progress/backend-lint-gate-broken-on-main.md` §후속의
   "idempotency fail-open 구간의 관측·중복 억제" 항목 아래 "Redis 실패율 지표 — 완료
   (2026-08-13, `eia-redis-failure-metric`)"로 이미 `[x]` 처리되어 있고, 실제 코드
   (`codebase/backend/src/modules/metrics/business-metrics.service.ts:38-41`,
   `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`)도
   `RedisFailOpenComponent = 'idempotency'` 단일 값·`recordRedisFailOpen` 호출 4곳으로
   이를 실측 확인했다. `spec/5-system/_product-overview.md` §NF-OB-07 표는 여전히 5행,
   `spec/data-flow/9-observability.md` 미러 문장도 Redis fail-open 언급이 없어 target 이
   서술하는 갭이 현재도 실재한다. 선행 조건은 해소되어 있고 target 의 전제와 어긋나지 않는다.

3. **후속 항목 누락** — target 의 "후속" 절("다른 Redis fail-open 소비자 배선")은
   `backend-lint-gate-broken-on-main.md`의 상위 항목("GET→SET 비원자 구조 검토")과
   범주가 다르며 중복되지 않는다. 다른 어떤 in-progress plan 도 `spec/5-system/_product-overview.md`
   §NF-OB-07 테이블이나 `spec/data-flow/9-observability.md`의 해당 문단을 동시에
   건드리지 않는다(같은 파일을 참조하는 plan 은 `ai-agent-tool-connection-rewrite.md`,
   `cafe24-backlog-residual.md`, `node-output-redesign/information-extractor.md` 뿐이나
   전부 다른 섹션/다른 목적이며 NF-OB-07 표와 무관). `plan/in-progress/spec-draft-eia-r8-alignment.md`
   (같은 worktree 계열의 선행 spec draft, R8 캐시 대상 정합화)는 이미 체크리스트가 전부
   완료 상태이고 본 target 과 주제·대상 파일이 겹치지 않아(하나는 `data-flow/15`+`5-system/14`,
   다른 하나는 `_product-overview.md`+`data-flow/9`) 충돌이나 후속 무효화가 없다.

## 요약

target 의 전제(코드에 6번째 instrument 가 이미 존재하고 카탈로그 표는 갱신되지 않았다는 것)와
"component 를 idempotency 하나로 좁힌다"는 판단 둘 다 현재 코드베이스·spec 상태와 실측으로
일치한다. `plan/in-progress/**`를 전수 스캔한 결과 이 metric/라벨/카탈로그 구조에 대해
"결정 필요"로 열려 있는 항목이 없고, target 이 가정하는 선행 작업(카운터 배선)은 이미
완료·검증되었으며, target 의 변경으로 무효화되거나 새로 생겨야 하는 다른 plan 의 후속 항목도
없다. 정합성 관점에서 이 spec draft 는 깨끗하다.

## 위험도
NONE
