# 테스트(Testing) 리뷰 — clemvion.redis.fail_open 카운터 + EIA §R8 캐시 키 스코프

## 발견사항

- **[WARNING]** `BusinessMetricsService.recordRedisFailOpen()` 자체를 검증하는 직접 단위 테스트가 없다 — 같은 파일의 다른 모든 counter/histogram 메서드는 짝이 있는데 이 메서드만 빠졌다.
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:113` (`recordRedisFailOpen` 구현) / `codebase/backend/src/modules/metrics/business-metrics.service.spec.ts` (해당 테스트 부재 — 이 스펙 파일은 이번 diff 에 포함되지 않았으나 직접 열어 확인함, 46~87행에 `recordExecutionTerminal`·`recordExecutionError`·`recordLlmTokens`·`recordNodeDuration` 각각의 `mock.counters[...].add` 단언 패턴이 이미 존재)
  - 상세: 이번 변경은 `idempotency.interceptor.spec.ts`에 `IdempotencyInterceptor — fail-open 관측 (metrics)` describe 블록(테스트 파일 gate 1057~1177)을 추가해 인터셉터가 `metrics.recordRedisFailOpen('idempotency', reason)`을 올바른 인자로 호출하는지는 촘촘히 검증한다. 그런데 이 블록이 주입하는 `metrics`는 `{ recordRedisFailOpen: jest.fn() }`라는 손으로 만든 스텁(gate 1058~1060)이고, `BusinessMetricsService`의 실제 구현(`this.redisFailOpen.add(1, { component, reason })`)은 어느 테스트에서도 실행되지 않는다. `business-metrics.service.spec.ts`는 `metrics` 서비스의 실제 동작(라벨 키 이름·값 매핑·OTel `add()` 호출)을 mock meter로 검증하는 전용 파일인데, 이 파일에는 `redisFailOpen`/`recordRedisFailOpen` 관련 테스트가 하나도 없다(grep 확인). 따라서 `recordRedisFailOpen` 본문에 다음과 같은 회귀가 들어와도 이번 diff 의 어떤 테스트도 잡지 못한다: 라벨 키 오탈자(`{ component, reasons: reason }`), `add(1, ...)` 대신 `add(0, ...)`, 혹은 메서드 본문 자체가 빈 no-op으로 바뀌는 경우. 관측/알람 목적의 기능이라 "카운터가 실제로 오르는지"가 이 기능의 존재 이유인데, 그 마지막 연결고리(서비스 구현 자체)가 미검증 상태로 남는다.
  - 제안: `business-metrics.service.spec.ts`에 형제 패턴 그대로 `it('recordRedisFailOpen → redis.fail_open{component,reason} += 1', () => { service.recordRedisFailOpen('idempotency', 'get_failed'); expect(mock.counters['clemvion.redis.fail_open'].add).toHaveBeenCalledWith(1, { component: 'idempotency', reason: 'get_failed' }); });` 형태의 테스트를 추가.

- **[INFO]** `recordRedisFailOpen(component: string, reason: string)`의 시그니처가 평범한 `string`이라, docstring이 주장하는 "코드가 정하는 닫힌 집합"이 타입 레벨에서는 강제되지 않는다.
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:113`
  - 상세: `idempotency.interceptor.ts`의 4개 호출부(gate 149·245~248·332·341)가 `'idempotency'`와 각 `reason` 문자열 리터럴을 중복해서 손으로 적는다. 현재는 `idempotency.interceptor.spec.ts`의 각 `reason` 값별 단언이 오탈자를 사실상 대신 잡아주고 있어 실질 위험은 낮지만, `reason`을 `'get_failed' | 'set_failed' | 'serialize_failed' | 'entry_corrupt' | 'payload_corrupt'` 같은 union literal 로 좁히면 테스트 없이도 컴파일 타임에 오탈자를 잡을 수 있다(다만 `component`·`reason`이 향후 다른 컴포넌트에서도 재사용될 범용 메서드라 완전히 닫긴 어려울 수 있음 — 우선순위 낮은 개선 제안).

## 테스트 강점 (참고)

- `idempotency.interceptor.spec.ts`의 신규 `fail-open 관측 (metrics)` describe 는 다섯 fail-open 경로 중 관측 대상 넷(`get_failed`·`set_failed`·`entry_corrupt`·`payload_corrupt`·`serialize_failed`, 총 5개 reason)을 `it.each` + 개별 `it`으로 모두 커버하고, `entry_corrupt`/`payload_corrupt` 두 갈래를 하나의 삼항연산자(`what === '엔트리' ? ... : ...`)가 만들어 내는데도 **양쪽 reason 값을 각각 단언**해 삼항 분기 뒤집힘을 잡을 수 있게 짜여 있다.
- "정상 경로에서는 카운터가 오르지 않는다" 테스트(gate 1148~1158)로 "실패 시에만 오른다"는 계약의 반대쪽(항상 증가하는 회귀)도 명시적으로 고정했다.
- "metrics 미주입이어도 fail-open 경로가 죽지 않는다" 테스트(gate 1160~1177)로 `@Optional()` DI 부재 시의 안전성을 검증 — `MetricsModule` 미구성 배포에서도 인터셉터가 죽지 않는다는 보장을 실측했다.
- SET 이 fire-and-forget 이라는 비동기 특성을 인지하고 `await Promise.resolve()`를 두 틱 넣어 microtask 완료를 기다리는 처리가 기존 `SET 실패` 테스트(gate 909~944)와 일관된 패턴을 따른다.
- `try/finally`로 `Logger.prototype.warn` 스파이를 복원하는 기존 관례(이 파일에 `restoreMocks` 세이프넷이 없다는 점을 스스로 지적)를 신규 테스트 전부가 그대로 따라 테스트 격리가 유지된다.
- 기존 회귀 테스트(캐시 히트/키 스코프/§R8 닫힌 목록 등)는 생성자 4번째 인자가 `@Optional()`로 추가됐을 뿐이라 전부 그대로 유효하다 — 실제로 기존 `makeInterceptor()` 헬퍼(3-인자 생성자 호출)를 건드리지 않고 신규 `withMetrics()` 헬퍼를 별도로 추가해 하위호환을 유지했다.

## 요약

`idempotency.interceptor.ts`의 다섯 fail-open 경로에 OTel 카운터를 배선하는 변경으로, 호출부(인터셉터) 쪽 테스트는 매우 꼼꼼하다 — 5개 reason 전량, 정상 경로 미증가, optional DI 안전성까지 고정했다. 다만 그 카운터를 실제로 구현하는 `BusinessMetricsService.recordRedisFailOpen()` 자신은 같은 파일의 다른 모든 형제 메서드와 달리 전용 단위 테스트가 없어, 서비스 구현 내부의 회귀(라벨 오탈자·`add()` 인자 실수·no-op화)를 잡을 안전망이 비어 있다. 관측/알람용 기능이라는 성격상 이 연결고리가 조용히 깨지면 "알람이 안 울리는데 아무도 모른다"는, 이 기능이 애초에 해결하려던 문제와 같은 형태의 결함이 재발할 수 있다. 그 외 격리·가독성·회귀 안전성은 양호하다.

## 위험도

LOW
