# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 없음. 실질 결함(회귀) 위험은 없으나, spec-코드 카탈로그 drift(SPEC-DRIFT), 신규 `recordRedisFailOpen()` 서비스 자체의 단위 테스트 부재, 신규 테스트 블록 삽입으로 인한 기존 문서(JSDoc/파일 헤더) 정합성 붕괴가 7개 reviewer 중 6곳에서 중복 지적됐다. 강제 화이트리스트(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 7명 전원이 정상 실행·전문 확보됐다 — 라우터 미이행 사항 없음.

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화 | 신규 `describe('IdempotencyInterceptor — fail-open 관측 (metrics)', ...)` 블록이 기존 `[Spec EIA §R8 "캐시 키 스코프"]` JSDoc 과 그 대상 `describe` 사이에 삽입돼, JSDoc 이 엉뚱한 블록을 설명하는 모양이 되고 원래 대상은 130줄 이상 떨어져 무주석 상태가 됨 (requirement·scope·maintainability·documentation 4개 reviewer 공통 지적, 중복 제거) | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:1033-1179` | 신규 블록을 "Redis 런타임 장애 fail-open" describe 바로 뒤 또는 파일 최하단으로 옮겨 JSDoc-대상 인접성 복원 |
| 2 | 문서화 | 파일 헤더 모듈 docstring(1-40행)의 "네 번째 describe 는 캐시 키 스코프..." 서수 서술이 신규 블록 삽입으로 어긋남(실제로는 다섯 번째), 신규 `fail-open 관측 (metrics)` 스위트 자체도 헤더 개요에 미언급 | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:1-40` | 헤더에 신규 스위트 설명 문단 추가, 서수 정정 |
| 3 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/_product-overview.md` §NF-OB-07 메트릭 카탈로그 표(및 `spec/data-flow/9-observability.md` 미러 문구)가 신규 OTel instrument `clemvion.redis.fail_open` 을 반영하지 않음. `BusinessMetricsService` 클래스 docstring 이 이 spec 표를 SoT 로 명시 인용하는데, 코드는 6번째 instrument 를 추가했고 spec 은 5행 그대로임 (requirement·documentation 2개 reviewer 공통 지적) | `spec/5-system/_product-overview.md:81-87` (+ `spec/data-flow/9-observability.md:202-206` 미러), 구현: `codebase/backend/src/modules/metrics/business-metrics.service.ts:69,113-115` | `project-planner` 경로로 카탈로그 표에 `clemvion.redis.fail_open` (Counter, 라벨 `component`/`reason`, reason ∈ {get_failed, set_failed, serialize_failed, entry_corrupt, payload_corrupt}) 행 추가 + 미러 문구 동시 갱신 |
| 4 | 테스팅 | `BusinessMetricsService.recordRedisFailOpen()` 자체(카운터 이름·라벨 키·값)를 직접 검증하는 단위 테스트가 없음 — 같은 서비스의 다른 모든 record* 메서드는 `business-metrics.service.spec.ts` 에 형제 테스트가 있는데 이 메서드만 빠짐. 인터셉터 쪽 테스트는 `{ recordRedisFailOpen: jest.fn() }` 스텁으로 인터셉터→서비스 호출 인자만 검증할 뿐, 서비스 내부 구현(`this.redisFailOpen.add(1, {...})`)은 어떤 테스트도 실행하지 않음 (requirement·testing 2개 reviewer 공통 지적) | `codebase/backend/src/modules/metrics/business-metrics.service.ts:113-115` (구현), `codebase/backend/src/modules/metrics/business-metrics.service.spec.ts` (테스트 부재) | `business-metrics.service.spec.ts` 에 `service.recordRedisFailOpen('idempotency','get_failed')` → `mock.counters['clemvion.redis.fail_open'].add` 가 `(1, {component:'idempotency', reason:'get_failed'})` 로 호출됐는지 단언하는 테스트 추가 |
| 5 | 유지보수성/부작용 | `recordRedisFailOpen(component: string, reason: string)` 이 docstring 상 "코드가 정하는 닫힌 집합" 이라 주장하면서도 시그니처는 평범한 `string` 이라 타입/런타임 어느 쪽으로도 강제되지 않음. 자매 메서드 `recordExecutionError` 는 `.substring(0,64)` 클램핑으로 동일 위험을 실제로 방어하는 반면 이 메서드는 방어가 전무 — 현재 4개 호출부는 전부 하드코딩 리터럴이라 즉시 악용 경로는 없으나, 향후 재사용 시 Prometheus label cardinality 폭발로 이어질 수 있는 방어 누락 (security·side_effect·maintainability·testing·documentation 5개 reviewer 공통 지적, INFO~WARNING 혼재 중 대표 WARNING 등급으로 통합) | `codebase/backend/src/modules/metrics/business-metrics.service.ts:108-115`, 호출부 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:149,245-248,332,341` | `reason` (필요시 `component`) 을 리터럴 유니온 타입(`'get_failed' \| 'set_failed' \| 'serialize_failed' \| 'entry_corrupt' \| 'payload_corrupt'`) 으로 좁혀 닫힌 집합을 컴파일 타임에 강제 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 부작용 | metrics 호출(`recordRedisFailOpen`)이 fail-open 복구 경로 내부에 별도 try/catch 격리 없이 얹혀 있음. 현재 OTel `Counter.add()` 는 정상적으로 던지지 않도록 설계돼 있고 기존 `logger.warn` 호출도 동일하게 무방비이므로 위험 증가분은 크지 않음 | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:149,245-248,332,341` | 당장 조치 불요. metrics 계층이 fail-open 경로에 계속 추가되면 얇은 try/catch 방어 고려 |
| 2 | 유지보수성 | 신규 테스트 헬퍼 `withMetrics()` 가 파일 전체의 `make*` 팩토리 네이밍 컨벤션(makeRedis·makeContext·makeInterceptor·makeMetrics 등)을 깨고 다른 패턴을 사용 | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:1061-1071` | `makeInterceptorWithMetrics` 등으로 리네임 |
| 3 | 유지보수성 | `'idempotency'` component 라벨 문자열이 4개 호출부에 반복 하드코딩됨 | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:149,245-248,332,341` | 클래스 상수(`METRICS_COMPONENT`)로 추출 검토(선택 사항) |
| 4 | 보안 | 캐시 payload 비노출 원칙이 신규 관측 경로에서도 유지됨 — `reason` 상수만 라벨에 실리고 캐시 값/사용자 body 는 노출되지 않음 | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` (`describeShape`, `discardCorruptEntry`) | 문제 없음, 조치 불요 |
| 5 | 보안 | DI 시그니처 변경(`@Optional() metrics?: BusinessMetricsService`)이 인증/인가·캐시 키 스코프 로직에 영향 없음, `MetricsModule` 이 `@Global` 이라 프로덕션 배선 누락 없음 (side_effect reviewer 도 동일 확인) | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:98` | 문제 없음, 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 순수 observability 추가, 인젝션/인증/시크릿 노출 없음. `recordRedisFailOpen` 클램핑 부재는 INFO |
| requirement | LOW | [SPEC-DRIFT] NF-OB-07 카탈로그 표 누락, `recordRedisFailOpen` 자체 단위 테스트 부재, JSDoc 인접성 |
| scope | LOW | 신규 테스트 블록이 무관한 기존 "캐시 키 스코프" JSDoc-describe 인접성을 깨뜨림. 그 외 diff 는 목적에 정확히 부합 |
| side_effect | LOW | 닫힌 집합 미강제 타입, fail-open 경로 내 metrics 호출 무방비(위험 낮음). DI 배선 안전 확인 |
| maintainability | LOW | JSDoc/색인 인접성 붕괴(WARNING), 닫힌 집합 미강제·네이밍 컨벤션 이탈·문자열 반복(INFO) |
| testing | LOW | `recordRedisFailOpen()` 서비스 자체 단위 테스트 부재(WARNING). 인터셉터 쪽 테스트는 5개 reason·정상경로·optional DI 전량 커버 |
| documentation | MEDIUM | JSDoc 인접성 붕괴 + 헤더 서수 어긋남, [SPEC-DRIFT] 카탈로그 미갱신, "닫힌 집합" 독스트링 과장 — 3개 WARNING |

## 발견 없는 에이전트

(없음 — 7개 에이전트 전원 최소 1건 이상의 WARNING/INFO 발견을 보고함. security 만 NONE 등급이나 INFO 4건 보고)

## 권장 조치사항

1. `spec/5-system/_product-overview.md` §NF-OB-07 메트릭 카탈로그 표(+ `spec/data-flow/9-observability.md` 미러)에 `clemvion.redis.fail_open` 행 추가 — **[SPEC-DRIFT], `project-planner` 인계 대상** (developer 는 `spec/` 쓰기 권한 없음).
2. `business-metrics.service.spec.ts` 에 `recordRedisFailOpen()` 자체를 검증하는 단위 테스트 추가(카운터 이름·라벨 키·값) — 서비스 구현의 회귀(오탈자·라벨 순서·no-op화)를 잡을 유일한 안전망.
3. `recordRedisFailOpen(component, reason)` 의 `reason`(가능하면 `component`)을 리터럴 유니온 타입으로 좁혀 "닫힌 집합" 문서 주장을 타입 레벨로 강제.
4. `idempotency.interceptor.spec.ts` 의 신규 `fail-open 관측 (metrics)` describe 블록을 "캐시 키 스코프" JSDoc 과 그 대상 사이가 아닌 인접한 위치(예: "Redis 런타임 장애 fail-open" describe 직후 또는 파일 최하단)로 이동하고, 파일 헤더 docstring 의 describe 순번 서술을 실제 구조에 맞춰 정정.
5. (선택) `withMetrics()` 헬퍼를 `make*` 네이밍 컨벤션에 맞춰 리네임, `'idempotency'` component 리터럴을 클래스 상수로 추출.

## 라우터 결정

- `routing_status`: `all` (라우터가 명시적으로 "all" 로 판정)
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 없음 (0명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — 전원 정상 실행·전문 확보됨. 강제 화이트리스트 미이행 없음.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (해당 없음) | — |
