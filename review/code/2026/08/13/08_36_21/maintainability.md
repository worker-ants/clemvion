# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 신규 테스트 블록이 기존 JSDoc 과 그 대상 `describe` 사이에 끼워 넣어져, 문서 블록이 130줄 넘게 자기 대상과 분리됐다 + 파일 상단 describe 지도(index)가 갱신되지 않았다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:1033-1179` (특히 1046-1057 경계)
  - 상세: `/** [Spec EIA §R8 "캐시 키 스코프"] ... */` JSDoc(1033-1047)은 바로 아래의 `describe('IdempotencyInterceptor — 캐시 키 스코프 (Spec EIA §R8)', ...)` 를 설명하려는 의도인데, 실제로는 그 `describe` 가 1179줄까지 밀려나 있다. 그 사이(1048-1177)에 이번 diff 가 신규로 삽입한 `/** fail-open 관측 ... */` JSDoc + `describe('IdempotencyInterceptor — fail-open 관측 (metrics)', ...)` 블록(빈 줄 없이 두 JSDoc 이 바로 연달아 붙는다, 1047→1048)이 통째로 들어가 있다. 위에서 아래로 읽는 독자는 "캐시 키 스코프" 설명 직후 전혀 다른 주제("fail-open 관측")의 코드를 만나 흐름이 끊기고, 그 설명이 실제로 무엇을 가리키는지 130줄을 더 읽어야 알 수 있다.
    같은 문제의 연장으로, 이 spec 파일 최상단의 파일-레벨 docstring(1-40행, "아래 두 번째 describe 는 …", "세 번째 describe 는 …", "네 번째 describe 는 **캐시 키 스코프**…")은 파일의 describe 블록을 순서대로 요약하는 색인 역할을 하는데, 이번에 세 번째와 네 번째 사이에 새로 삽입된 다섯 번째 describe("fail-open 관측 (metrics)")는 이 색인에 전혀 언급되지 않는다. 색인이 실제 파일 구조와 어긋난 채로 남는다.
  - 제안: 신규 `describe('... fail-open 관측 (metrics)', ...)` 블록을 "캐시 키 스코프" JSDoc+describe 앞(또는 "Redis 런타임 장애 fail-open" describe 바로 뒤, 다른 관측 대상과 인접한 위치)으로 옮겨 JSDoc-대상 인접성을 복원하고, 파일 상단 docstring 의 describe 순서 요약에 새 블록 한 줄을 추가해 색인을 실제 구조와 맞춘다.

- **[INFO]** `recordRedisFailOpen(component, reason)` 의 두 라벨 인자가 "코드가 정하는 닫힌 집합"이라고 문서화됐지만 타입은 `string` 이라 오타를 컴파일러가 잡지 못한다
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:113` (`recordRedisFailOpen(component: string, reason: string): void`), 호출부는 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:149, 245-248, 332, 341`
  - 상세: 메서드 docstring 이 "`component`/`reason` 둘 다 **코드가 정하는 닫힌 집합**"이라고 명시적으로 강조하는데(`business-metrics.service.ts:108-111`), 실제 시그니처는 평범한 `string`이다. 현재는 `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 적힌 대로 뮤테이션 테스트로 오타·누락을 잡고 있지만, 타입으로 닫힌 집합을 표현하면 오타(`'gett_failed'` 등)를 정적으로 막고 그 자체가 "닫힌 집합" 주장의 실행 가능한 문서가 된다. (다만 같은 서비스의 다른 메서드 — `recordExecutionTerminal(status: string)` 등 — 도 동일하게 느슨한 `string` 을 쓰므로 기존 스타일과 완전히 어긋나는 것은 아니다.)
  - 제안: `type RedisFailOpenReason = 'get_failed' | 'set_failed' | 'serialize_failed' | 'entry_corrupt' | 'payload_corrupt'` 같은 리터럴 유니온을 정의해 `reason` 파라미터에 적용 검토.

- **[INFO]** 신규 테스트 헬퍼 `withMetrics()` 가 파일 전체에서 일관된 `make*` 팩토리 네이밍 컨벤션을 깬다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:1061-1071` (`function withMetrics(redis, m) { return new IdempotencyInterceptor(...); }`)
  - 상세: 이 파일의 기존 팩토리 헬퍼는 전부 `make*` 접두사다 — `makeRedis`·`makeRedisConn`·`makeContext`·`makeCallHandler`·`makeThrowingHandler`·`makeInterceptor`, 그리고 같은 블록에서 새로 추가된 `makeMetrics()` 도 이 컨벤션을 따른다. 그런데 바로 옆의 `withMetrics()`(인터셉터 생성자를 호출해 인스턴스를 만드는, `makeInterceptor` 와 동형인 함수)만 다른 이름 패턴을 쓴다.
  - 제안: `makeInterceptorWithMetrics` 등 `make*` 패턴에 맞는 이름으로 통일.

- **[INFO]** `'idempotency'` component 라벨 문자열이 4개 호출부에 그대로 반복된다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:149, 245-248, 332, 341`
  - 상세: `this.metrics?.recordRedisFailOpen('idempotency', ...)` 형태가 파일 안에서 4번 나온다. 하나의 클래스 안에서만 쓰이므로 위험은 낮지만, 이름이 정해진 값을 매 호출부에서 손으로 다시 타이핑하는 형태라 컴포넌트 이름을 바꿀 때(혹은 오타 시) 4곳을 전부 맞춰야 한다.
  - 제안: `private static readonly METRICS_COMPONENT = 'idempotency';` 같은 클래스 상수로 추출(선택 사항, 위 리터럴 유니온 제안과 함께 처리하면 비용이 낮다).

## 요약

이번 변경(멱등 캐시 fail-open OTel 카운터 배선)의 핵심 코드 — `BusinessMetricsService.recordRedisFailOpen()` 신설과 `IdempotencyInterceptor` 의 4개 fail-open 경로 배선 — 은 짧고 각 지점이 기존 패턴(`@Optional()` DI, `record*` 네이밍, 클래스 docstring 표와의 대응)을 그대로 따라 가독성·일관성 문제가 없다. 가장 실질적인 문제는 테스트 파일(`idempotency.interceptor.spec.ts`)에서 신규 `describe` 블록이 기존 JSDoc 과 그 대상 선언 사이에 삽입되면서 문서-코드 인접성이 깨지고, 파일 상단의 describe 색인이 stale 해진 것이다 — 기능에는 영향 없지만 다음 사람이 파일 구조를 파악하는 비용을 높인다. 그 외에는 닫힌 라벨 집합의 타입 미표현, 헬퍼 네이밍 컨벤션 이탈, 반복 문자열 리터럴 등 경미한 개선 여지만 있다.

## 위험도

LOW
