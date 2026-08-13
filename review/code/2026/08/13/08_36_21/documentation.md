# 문서화(Documentation) 리뷰 — `clemvion.redis.fail_open` 카운터 + EIA §R8 캐시 키 스코프

## 발견사항

- **[WARNING]** 신규 `describe` 블록 삽입으로 기존 JSDoc 이 엉뚱한 블록 위에 얹히고, 원래 대상은 무주석이 됨
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:1033-1057` (실제 파일 줄 번호 기준; 프롬프트 "전체 파일 컨텍스트" 게이트로는 1033~1057 부근)
  - 상세: `describe('IdempotencyInterceptor — 캐시 키 스코프 (Spec EIA §R8)', ...)` 를 설명하는 JSDoc(`[Spec EIA §R8 "캐시 키 스코프"] — 캐시 키가 **execution + route** 로 스코프되는지...`, 1033~1047줄)이 원래 바로 아래 그 `describe` 를 감싸고 있었는데, 이번 diff 가 새 `describe('IdempotencyInterceptor — fail-open 관측 (metrics)', ...)` 블록(및 그 자체 JSDoc, 1048~1056줄)을 **그 사이에** 끼워 넣었다. 결과적으로:
    1. "캐시 키 스코프" JSDoc 이 지금은 `fail-open 관측 (metrics)` describe 블록 바로 위에 붙어, 내용과 무관한 블록을 설명하는 모양이 됐다.
    2. 실제 `캐시 키 스코프 (Spec EIA §R8)` describe 블록(1179줄, `git diff` 컨텍스트에도 등장)은 이제 JSDoc 없이 `fail-open 관측` 블록의 닫는 `});` 바로 다음에 나온다 — 원래 있던 상세 설명(두 축을 따로 고정하는 이유, route 축의 `CancelDto` 특이사항 등)을 잃었다.
  - 제안: `fail-open 관측 (metrics)` JSDoc+describe 를 `캐시 키 스코프` JSDoc **앞**(즉 `Redis 런타임 장애 fail-open` describe 바로 뒤)으로 옮기거나, 반대로 `캐시 키 스코프` JSDoc 을 자신의 describe 바로 위로 재배치해 1:1 대응을 복원할 것.

- **[WARNING]** 파일 헤더 JSDoc 의 "네 번째 describe" 서술이 새 블록 삽입으로 순번이 어긋나고, 신규 스위트가 언급되지 않음
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:1-40` (파일 최상단 모듈 docstring)
  - 상세: 34~39줄이 "네 번째 describe 는 **캐시 키 스코프**(Spec EIA §R8) ..." 라고 서수로 지칭하는데, 이번 diff 로 실제 describe 순서는 1.W-4 provider 경로 → 2.캐시 히트 → 3.Redis 런타임 장애 fail-open → **4.fail-open 관측 (metrics) [신규]** → 5.캐시 키 스코프 가 됐다. "네 번째" 라는 서술은 이제 신규 `fail-open 관측` 블록을 가리키는 것처럼 읽히지만 실제로는 다섯 번째(캐시 키 스코프)를 설명한다. 또한 신규 `fail-open 관측 (metrics)` 스위트 자체는 이 파일 헤더 개요에 전혀 언급되지 않는다.
  - 제안: 헤더에 "네 번째 describe 는 fail-open **관측(metrics)**..." 문단을 추가하고, 기존 "네 번째" → "다섯 번째" 로 순번을 정정.

- **[WARNING]** `spec/5-system/_product-overview.md` §NF-OB-07 "메트릭 카탈로그"(SoT 명시 테이블)가 신규 `clemvion.redis.fail_open` 을 반영하지 않음
  - 위치: `spec/5-system/_product-overview.md:77-87` (`### NF-OB-07 메트릭 카탈로그` 표, 5행: `clemvion.execution.total`·`clemvion.execution.errors`·`clemvion.queue.depth`·`clemvion.llm.tokens`·`clemvion.node.duration`). 동일 누락이 `spec/data-flow/9-observability.md:202-206` 의 미러 문구("...노드 지연(`clemvion.node.duration`) — 을 `BusinessMetricsService` 가 함께 노출한다")에도 있음.
  - 상세: 이번 diff 로 `BusinessMetricsService` 에 6번째 instrument `clemvion.redis.fail_open` (Counter, 라벨 `component`·`reason`)이 추가됐고, 코드 쪽 클래스 docstring(`business-metrics.service.ts:31-34`)은 스스로 "NF-OB-07 도메인/비즈니스 커스텀 메트릭 (spec/5-system/_product-overview.md §5)" 을 SoT 로 명시 인용한다. 그런데 그 인용 대상인 spec 표는 갱신되지 않아 코드와 spec 카탈로그가 **1개 instrument 만큼 어긋난다.** 프로젝트 규약상 `spec/` 은 developer 권한 밖이라, 이 gap 은 `project-planner` 인계 대상이다(같은 plan 파일이 이미 유사 사례를 "planner 인계" 항목으로 남긴 전례가 있다 — `plan/in-progress/backend-lint-gate-broken-on-main.md:524-531`).
  - 제안: `spec/5-system/_product-overview.md` §NF-OB-07 카탈로그 표에 `clemvion.redis.fail_open` 행 추가(Counter / `component`,`reason` / 의미), `spec/data-flow/9-observability.md` §4 미러 문구도 동시 갱신. developer 권한 밖이므로 plan 에 planner 인계 항목으로 명시할 것.

- **[INFO]** `recordRedisFailOpen` 독스트링이 주장하는 "코드가 정하는 닫힌 집합" 보장이 타입 시그니처로 강제되지 않음
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:108-111` (독스트링), `:113` (`recordRedisFailOpen(component: string, reason: string): void`)
  - 상세: 독스트링은 "`component`·`reason` 둘 다 **코드가 정하는 닫힌 집합**이라 라벨 cardinality 가 늘지 않는다 — 외부 문자열을 그대로 라벨에 넣으면 Prometheus 가 터진다(`recordExecutionError` 가 클램핑하는 이유와 같다)" 라고 적는다. 그런데 바로 위 `recordExecutionError`(:92-99)는 실제로 `errorCode.substring(0, 64)` 런타임 클램핑을 두어 그 보장을 코드로 강제하는 반면, `recordRedisFailOpen` 은 파라미터 타입이 리터럴 유니온이 아닌 plain `string` 이고 런타임 가드도 없다 — "닫힌 집합" 은 현재 두 호출부(`idempotency.interceptor.ts`)가 리터럴 문자열만 쓰는 **호출 관례**에만 의존한다. 향후 다른 모듈이 이 메서드를 동적 문자열로 호출해도 컴파일러도 런타임도 막지 못한다. "`recordExecutionError` 와 같은 이유" 라는 비유는 방어 강도가 다르다는 점에서 다소 과장이다.
  - 제안: 시그니처를 `reason: 'get_failed' | 'set_failed' | 'serialize_failed' | 'entry_corrupt' | 'payload_corrupt'` 같은 리터럴 유니온으로 좁히거나(가장 안전), 최소한 독스트링에서 "타입으로 강제되지 않고 호출부 관례로 유지된다" 는 점을 명시해 보장 범위를 실제 구현과 맞출 것.

## 요약

CHANGELOG·클래스/메서드 JSDoc·신규 테스트 docstring 은 대체로 충실하고(경로별 `reason` 근거, `OTEL_ENABLED` no-op 동작, 트레이드오프 설명 등) 코드와 정합한다. 다만 (1) `idempotency.interceptor.spec.ts` 에 새 `describe` 블록을 끼워 넣으며 인접 JSDoc 이 원래 대상을 잃고 엉뚱한 블록을 설명하게 됐고 파일 헤더의 서수 서술도 어긋났다, (2) `BusinessMetricsService` 에 새 OTel instrument 를 추가했음에도 그 자신이 SoT 로 인용하는 `spec/5-system/_product-overview.md` §NF-OB-07 메트릭 카탈로그(및 미러 문구)가 갱신되지 않아 spec-코드 카탈로그가 어긋났다, (3) `recordRedisFailOpen` 독스트링이 주장하는 "닫힌 집합" 보장이 타입/런타임으로 강제되지 않아 자매 메서드(`recordExecutionError`)와 비교해 과장된 표현이다. 셋 다 기능·보안 영향은 없는 문서 정합성 결함이다.

## 위험도

MEDIUM
