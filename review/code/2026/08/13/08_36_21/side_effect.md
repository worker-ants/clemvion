# 부작용(Side Effect) Review

## 발견사항

- **[WARNING]** `recordRedisFailOpen` 이 "닫힌 집합" 이라는 문서 주장을 타입으로 강제하지 않는다
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:113` (`recordRedisFailOpen(component: string, reason: string): void`)
  - 상세: JSDoc(같은 파일 108~111줄)과 CHANGELOG 모두 "`reason`/`component` 는 코드가 정하는 **닫힌 집합**이라 Prometheus label cardinality 가 늘지 않는다" 고 명시한다. 그런데 시그니처는 `component: string, reason: string` 으로 임의 문자열을 받는다 — 현재 4개 호출부(`idempotency.interceptor.ts` 149·245-248·332·341행)는 전부 리터럴 상수(`'idempotency'`, `'get_failed'` 등)만 넘겨 지금 당장은 안전하지만, 이는 **호출 규율에 의한 안전**이지 컴파일러가 보장하는 것이 아니다. 자매 메서드 `recordExecutionError`(같은 파일 95~99행)는 외부 유래 문자열을 받을 수 있다는 전제로 `.substring(0, 64)` 클램핑을 두는데, 이 메서드는 그런 방어가 전혀 없다 — "닫힌 집합" 전제가 미래의 새 호출부(다른 component 도입 시)에서 조용히 깨지면 Prometheus label cardinality 폭발로 이어질 수 있는 표면이다.
  - 제안: `reason`(및 필요하면 `component`) 을 문자열 유니온 타입(예: `'get_failed' | 'set_failed' | 'serialize_failed' | 'entry_corrupt' | 'payload_corrupt'`)으로 좁혀 "닫힌 집합" 을 타입 레벨에서 강제하거나, 최소한 `recordExecutionError` 와 동일한 방식의 방어적 클램핑을 검토.

- **[INFO]** metrics 호출이 fail-open 복구 경로 내부에 있고 자체적으로 격리돼 있지 않다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:149`(GET catchError), `:245-248`(discardCorruptEntry), `:332`(직렬화 실패 catch), `:341`(SET catch)
  - 상세: 이 클래스의 존재 이유는 "Redis 가 죽어도 요청은 반드시 산다" 는 fail-open 보장(파일 상단 클래스 docstring, 63~86행)이다. 이번 변경은 그 보장을 지키는 4개 복구 지점 각각에 `this.metrics?.recordRedisFailOpen(...)` 호출을 추가로 끼워 넣었는데, 이 호출은 별도 try/catch 로 격리돼 있지 않다. `BusinessMetricsService.recordRedisFailOpen` 은 OTel `Counter.add()` 호출뿐이라 정상적으로는 던지지 않게 설계돼 있지만(`OTEL_ENABLED` 미설정 시 no-op meter), 만약 향후 OTel SDK 쪽에서 예외를 내는 회귀가 생기면 그 예외가 `catchError`/`discardCorruptEntry` 안에서 그대로 전파돼 **fail-open 자체가 fail-closed 로 뒤집히는** 결과가 된다. 다만 기존에도 같은 자리의 `this.logger.warn(...)` 호출 역시 방어되어 있지 않으므로(이 클래스의 기존 관례), 새로 추가된 위험은 "표면적이 두 배로 늘었다" 는 정도이며 CRITICAL 로 볼 근거는 없다.
  - 제안: 당장 조치가 필요하다고 보진 않으나, metrics 계층이 fail-open 경로에 계속 추가될 경우 `recordRedisFailOpen` 자체(또는 호출부)에 얇은 try/catch 방어를 두는 것을 고려.

- **[정보성 확인 — 문제 없음]** `IdempotencyInterceptor` 생성자 시그니처 변경(4번째 파라미터 `metrics?: BusinessMetricsService` 추가, `idempotency.interceptor.ts:98`)은 안전하다고 확인했다. `@Optional()` 이고 기존 파라미터 순서를 그대로 유지한 채 끝에 추가됐다(파라미터 순서 고정 정책은 94행 주석에 명시). `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` 내 `new IdempotencyInterceptor(...)` 6개 호출부를 전수 확인 — 전부 이 파일 안에만 있고 위치 인자 개수가 3개 또는 4개로 시그니처와 호환된다. `MetricsModule` 은 `@Global()`(`codebase/backend/src/modules/metrics/metrics.module.ts:8`) 이고 `AppModule` 에 등록돼 있어(`app.module.ts:163`) `ExternalInteractionModule` 이 별도 import 하지 않아도 `BusinessMetricsService` 가 DI 로 정상 주입된다 — 프로덕션 경로에서 `metrics` 가 항상 `undefined` 로 조용히 죽는 배선 누락은 없다.

## 요약

이번 변경은 `IdempotencyInterceptor` 의 다섯 fail-open 경로 중 네 곳에 OTel 카운터(`clemvion.redis.fail_open`) 계측을 추가하는 순수 관측성 확장이며, 새 전역 변수·파일시스템 접근·직접적인 네트워크 호출(OTel export 는 SDK 가 비동기로 처리하며 이 코드 경로가 직접 트리거하지 않음)은 없다. 생성자 시그니처 변경은 `@Optional()` + 파라미터 끝에 추가 + `Global` 모듈 배선으로 기존 호출자·DI 양쪽에서 하위 호환이 실측으로 확인됐다. 유일하게 눈에 띄는 것은 새 메서드 `recordRedisFailOpen` 이 스스로 문서화한 "닫힌 라벨 집합" 전제를 타입으로 강제하지 않는다는 점(현재는 호출부 규율로만 지켜짐)과, 새 계측 호출이 fail-open 복구 경로 내부에 무방비로 얹혔다는 점인데 둘 다 현재 코드 기준으로는 관측 가능한 결함이 아니라 향후 확장 시의 잠재 리스크에 가깝다.

## 위험도

LOW
