# 요구사항(Requirement) 리뷰 — `clemvion.redis.fail_open` 후속 조치 라운드 (08_36_21 → 09_57_11)

이번 라운드는 직전 리뷰 세션(`08_36_21`)이 낸 WARNING 5건에 대한 조치(`RESOLUTION.md`) + 그중
[SPEC-DRIFT] 1건에 대한 `project-planner` 턴(spec draft → `/consistency-check --spec` → spec 반영)의
최종 결과물이다. 실제 코드(`idempotency.interceptor.ts`/`.spec.ts`,
`business-metrics.service.ts`/`.spec.ts`)와 spec(`spec/5-system/_product-overview.md`,
`spec/data-flow/9-observability.md`)을 직접 `Read` 하고, 테스트·lint 를 실행해 claim 을 검증했다.

## 검증 방법

- `Read` 로 `idempotency.interceptor.ts`, `business-metrics.service.ts`,
  `idempotency.interceptor.spec.ts`, `business-metrics.service.spec.ts` 전체를 열어 diff 가
  주장하는 최종 상태와 대조.
- `spec/5-system/_product-overview.md` §NF-OB-07 카탈로그 표, `spec/data-flow/9-observability.md`
  §4 미러 문장 + `## Rationale` 신설 절을 직접 열어 코드(라벨 값·카운터 이름)와 line-level 대조.
- `npx jest src/modules/external-interaction/idempotency.interceptor.spec.ts
  src/modules/metrics/business-metrics.service.spec.ts src/modules/metrics/metrics.module.spec.ts`
  실행 → **3 suites / 57 passed** (RESOLUTION.md 의 "3 suites / 57 passed" 주장과 정확히 일치).
- `npx eslint` 해당 4개 파일 → 출력 없음(0 warning/0 error, RESOLUTION.md 주장과 일치).
- `MetricsModule`(`@Global`, `providers/exports: BusinessMetricsService`)이 `app.module.ts` 에
  실제로 import 되는지 확인 — 프로덕션 DI 배선 정상.
- 변경분(`336525805..HEAD` 중 대상 5개 코드 파일)에 `TODO|FIXME|HACK|XXX` grep → 0건.

## 발견사항

이전 라운드(`08_36_21`)의 WARNING 5건이 이번 diff 로 전부 해소됐음을 코드 레벨에서 확인했다.
새로운 CRITICAL/WARNING 은 발견하지 못했다.

- **[INFO]** WARNING 1·2 (JSDoc-describe 인접성 붕괴) — 조치 확인됨
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:1040-1049` (신규 `fail-open 관측 (metrics)` JSDoc+describe), `:1171-1187` (`캐시 키 스코프` JSDoc+describe)
  - 상세: 신규 블록이 `Redis 런타임 장애 fail-open` describe(라인 840) 직후, `캐시 키 스코프` describe 앞으로 재배치돼 각 JSDoc 이 자기 describe 바로 위에 인접한다. 파일 헤더 docstring(`:1-47`)도 "네 번째 describe 는 fail-open 관측(metrics)... 다섯 번째 describe 는 캐시 키 스코프..." 로 정정돼 실제 구조(1.W-4 → 2.캐시 히트 → 3.Redis 런타임 장애 → 4.fail-open 관측[신규] → 5.캐시 키 스코프)와 일치한다.
  - 제안: 없음(완료 확인).

- **[INFO]** WARNING 3 ([SPEC-DRIFT] NF-OB-07 카탈로그 미갱신) — planner 턴으로 조치 확인됨
  - 위치: `spec/5-system/_product-overview.md:75`(요약 행), `:88`(카탈로그 표 신규 행), `spec/data-flow/9-observability.md:202-205`(미러 문장), `:261-270`(`## Rationale` 신설 절)
  - 상세: 표 신규 행의 라벨 값 — `component (idempotency)`, `reason (get_failed/set_failed/serialize_failed/entry_corrupt/payload_corrupt)` — 이 코드의 `RedisFailOpenComponent`/`RedisFailOpenReason` 리터럴 유니온(`business-metrics.service.ts:38,41-46`)과 정확히 1:1 대응한다. 카운터 이름(`clemvion.redis.fail_open`)·타입(Counter)도 `meter.createCounter('clemvion.redis.fail_open', ...)`(`:86`)와 일치. `component` 를 `idempotency` 단일값만 열거한 이유(다른 소비자는 아직 미배선)도 observability.md `## Rationale` 절에 근거가 남아 문서가 구현보다 넓어지는 것을 피했다. `/consistency-check --spec` 재검토(`09_48_44`)가 BLOCK: NO 로 확인됨.
  - 제안: 없음(완료 확인). 후속 소비자 배선 시 유니온+카탈로그 표 동시 갱신 필요(spec draft `## 후속` 에 이미 명시돼 있음).

- **[INFO]** WARNING 4 (`recordRedisFailOpen()` 자체 단위 테스트 부재) — 조치 확인됨
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.spec.ts:67-88`
  - 상세: 두 신규 테스트가 mock meter 의 `counters['clemvion.redis.fail_open'].add` 호출 인자(카운터 이름·라벨 키·값)를 직접 단언한다. 실행 결과 GREEN 확인(위 jest 실행 로그). 두 번째 테스트("reason 이 호출마다 그대로 갈린다")는 `toHaveBeenNthCalledWith` 로 `entry_corrupt`/`payload_corrupt` 두 갈래가 서로 다른 라벨로 기록되는지 확인해, RESOLUTION.md 가 주장하는 "손상 두 갈래를 하나로 뭉개는 회귀" 변별력이 실제로 구현돼 있다.
  - 제안: 없음(완료 확인).

- **[INFO]** WARNING 5 (닫힌 집합 주장 vs `string` 시그니처 괴리) — 조치 확인됨
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:38,41-46,134-139`
  - 상세: `recordRedisFailOpen(component: RedisFailOpenComponent, reason: RedisFailOpenReason)` 로 시그니처가 리터럴 유니온으로 좁혀졌고, 호출부 4곳(`idempotency.interceptor.ts:154,250-253,337,346`) 모두 `METRICS_COMPONENT` 상수(`:29`, 타입 `RedisFailOpenComponent`) + 리터럴 `reason` 을 사용해 타입이 요구하는 값만 전달한다. `ts-jest` 가 타입 진단을 하지 않는다는 한계까지 인지하고 별도 `tsc --noEmit` 프로브로 강제력을 실측 확인한 방법론도 타당하다(RESOLUTION.md 기록, 프로브 자체는 제거돼 현재 코드베이스에 잔존하지 않음 — `src/__union-probe.ts` grep 0건 확인 가능).
  - 제안: 없음(완료 확인).

- **[INFO]** fail-open 다섯 경로 전량이 정확한 `reason` 라벨로 배선됐는지 소스 레벨 대조
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:154`(`get_failed`), `:250-253`(`entry_corrupt`/`payload_corrupt` 삼항), `:337`(`serialize_failed`), `:346`(`set_failed`)
  - 상세: 클래스 docstring 표(`:69-77`)가 선언한 "다섯 경로, 경로 1(미주입)만 warn 없음" 과 실제 배선이 정확히 일치한다. 경로 1(생성자 시점 `redis === null`)은 장애가 아니라 설정 상태라는 문서 설명대로 `recordRedisFailOpen` 미호출이며, 이는 의도된 설계로 판단된다(정상/설정 상태에서 카운터가 조용히 오르지 않아야 한다는 "정상 경로에서는 카운터가 오르지 않는다" 테스트(`idempotency.interceptor.spec.ts:1140-1150`)의 취지와도 일치).
  - 제안: 없음.

## 요약

직전 세션(`08_36_21`)의 WARNING 5건 — (1)(2) 신규 테스트 블록 삽입으로 인한 JSDoc-대상 인접성 붕괴,
(3) [SPEC-DRIFT] NF-OB-07 카탈로그 미갱신, (4) `recordRedisFailOpen()` 자체 단위 테스트 부재,
(5) "닫힌 집합" 문서 주장과 `string` 시그니처의 괴리 — 를 이번 diff 가 전부 해소했음을 코드·spec
직접 열람과 테스트/lint 실행으로 확인했다. spec 카탈로그 표(`_product-overview.md`)와 미러 문장·
Rationale(`9-observability.md`)이 코드의 리터럴 유니온·카운터 정의와 line-level 로 정합하며,
`/consistency-check --spec` 재검토도 BLOCK: NO 로 닫혔다. jest 57/57 통과·eslint 0 건을 직접
재현해 RESOLUTION.md 의 검증 claim 이 정확함을 확인했다. 신규 CRITICAL/WARNING 은 발견하지 못했다.

## 위험도
NONE
