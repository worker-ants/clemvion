# 성능(Performance) 리뷰 — `clemvion.redis.fail_open` OTel 카운터 배선

## 검토 범위

실질 코드 변경은 4개 파일이다(나머지는 CHANGELOG·plan 문서 및 이전 리뷰 라운드의 산출물 markdown/json 이라 성능 관점 대상이 아님):

- `codebase/backend/src/modules/metrics/business-metrics.service.ts` — `recordRedisFailOpen()` 신설, 6번째 OTel Counter(`clemvion.redis.fail_open`) 추가
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — 다섯 fail-open 경로 중 네 곳(`get_failed`/`serialize_failed`/`entry_corrupt`/`payload_corrupt`/`set_failed`)에 `this.metrics?.recordRedisFailOpen(...)` 호출 배선
- `codebase/backend/src/modules/metrics/business-metrics.service.spec.ts`, `idempotency.interceptor.spec.ts` — 대응 단위 테스트(테스트 코드 자체는 성능 영향 없음)

전체 파일(`idempotency.interceptor.ts`, `business-metrics.service.ts`)을 `Read` 로 직접 열어 diff 문맥만이 아니라 호출 빈도·경로를 확인했다.

## 발견사항

- **[INFO]** Counter instrument 는 생성자에서 1회만 생성되고, `recordRedisFailOpen` 은 **정상 요청 경로(hot path)에서 호출되지 않는다**
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:86` (Counter 생성, 생성자 내부 1회), `:134-139` (`recordRedisFailOpen` 본문)
  - 상세: `this.redisFailOpen = meter.createCounter(...)` 는 `BusinessMetricsService` 생성자(싱글턴, 앱 부팅 시 1회)에서만 실행되고, 호출부인 `idempotency.interceptor.ts` 의 네 지점(`:154` GET 실패, `:250-253` 엔트리/payload 손상, `:337` 직렬화 실패, `:346` SET 실패)은 전부 **Redis 장애·데이터 손상 시에만 도달하는 fail-open 분기**다. 정상 요청(캐시 히트/미스 정상 처리)에서는 이 카운터가 전혀 호출되지 않으므로 추가된 계측이 요청당 오버헤드를 만들지 않는다.
  - 제안: 조치 불요 — 참고용 확인.

- **[INFO]** `Counter.add(1, { component, reason })` 호출마다 라벨 객체 리터럴이 새로 할당되지만, 위 호출 빈도 제약으로 GC 압력은 무시할 수준
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:138`
  - 상세: 같은 클래스의 다른 `record*` 메서드들(`recordExecutionTerminal`, `recordLlmTokens` 등)도 동일 패턴(호출마다 라벨 객체 생성)이라 이번 변경이 새로운 관례를 만든 것은 아니다. 호출 빈도가 Redis 장애/데이터 손상 사건에 bound 되어 있어 정상 트래픽 규모와 무관하게 낮다.
  - 제안: 조치 불요.

- **[INFO]** `storeEntry()` 의 SET 실패 경로에 추가된 metrics 호출은 기존 fire-and-forget `.catch()` 체인 내부라 요청 latency 에 영향 없음
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:340-347` (`void this.redis.set(...).catch((err) => { ...; this.metrics?.recordRedisFailOpen(...); })`)
  - 상세: `storeEntry` 호출부(`cacheTapped` 의 `tap` / `catchError` 내부)는 `void` 로 던지고 응답 스트림을 기다리지 않는다. `.catch()` 콜백 안에 추가된 `recordRedisFailOpen` 호출은 이미 비동기 실패 처리 경로 안이라 요청 응답 시간에 관여하지 않는다.
  - 제안: 조치 불요.

- **[INFO]** `RedisFailOpenComponent`/`RedisFailOpenReason` 을 리터럴 유니온으로 좁힌 것은 런타임 비용이 아니라 컴파일 타임 검증이라 성능 영향 0
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:38-46`
  - 상세: 타입 좁힘은 `tsc` 컴파일 시점에만 작용하고 트랜스파일된 JS 는 이전과 동일한 문자열 비교/객체 리터럴이다. 성능 관점에서 중립.

CRITICAL/WARNING 급 성능 결함은 발견되지 않았다. N+1 호출, 블로킹 I/O, O(n²) 누적, 부적절한 자료구조, 불필요한 선행 로딩 등 점검 관점 1~8 에 해당하는 문제가 이 diff 범위(4개 실질 코드 파일)에서 발견되지 않았다.

## 요약

이번 변경은 `IdempotencyInterceptor` 의 fail-open(Redis 장애·캐시 손상) 경로 넷에 OTel `Counter.add()` 호출을 추가하는 순수 관측성 배선이다. 카운터는 앱 부팅 시 1회 생성되고, 호출은 전부 예외적 실패 경로에만 존재해 정상 요청의 hot path 에는 어떤 오버헤드도 추가되지 않는다. 라벨 객체 리터럴 할당은 호출 빈도가 장애 사건에 bound 되어 GC 압력이 무의미하며, `OTEL_ENABLED` 미설정 시 no-op meter 가 주어져 비활성 환경에서도 비용이 없다. `storeEntry` 의 SET 실패 계측은 기존 fire-and-forget 체인 안에 있어 latency 에 관여하지 않는다. 알고리즘 복잡도·캐싱·메모리·블로킹 I/O·데이터 구조 어느 관점에서도 지적할 결함이 없는, 성능 리스크가 사실상 0에 가까운 변경이다.

## 위험도

NONE
