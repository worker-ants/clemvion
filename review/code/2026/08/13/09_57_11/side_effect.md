# Side Effect Review — `clemvion.redis.fail_open` 관측 메트릭 배선

## 발견사항

- **[INFO]** `IdempotencyInterceptor` 생성자 시그니처 변경 — 새 `@Optional()` 파라미터 추가
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:103` (`constructor` 4번째 인자 `metrics?: BusinessMetricsService`)
  - 상세: 기존 3-인자(`_configService`, `injectedRedis`, `redisConn`) 뒤에 `metrics` 를 추가했다. 전부 `@Optional()`이고 새 인자가 맨 뒤(trailing)라 위치 인자로 수동 호출하는 기존 코드(`makeInterceptor` 헬퍼, `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:175-177`)는 그대로 컴파일·동작한다. `BusinessMetricsService` 는 `@Global()` `MetricsModule`(`codebase/backend/src/modules/metrics/metrics.module.ts`)이 앱 전역에 제공하므로, `ExternalInteractionModule` 이 `MetricsModule` 을 명시 `imports` 하지 않아도 DI 는 정상 해석되고(app 부트에서 `MetricsModule` 이 로드되지 않는 예외적 구성이면 `@Optional()` 이 `undefined` 로 fail-open — 기존 인터셉터 자체의 fail-open 철학과 일치) 런타임 실패 경로가 없다. 소스 트리 전수 grep(`new IdempotencyInterceptor(`) 결과 DI 컨테이너 외 수동 인스턴스화 지점은 스펙 파일뿐임을 확인.
  - 제안: 없음(하위 호환 유지, 조치 불필요). 참고용으로 기록.

- **[INFO]** `BusinessMetricsService` 공개 API 확장 — 신규 `export type`/메서드 추가
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:38-46` (`RedisFailOpenComponent`/`RedisFailOpenReason` export), `:134-139` (`recordRedisFailOpen`)
  - 상세: 기존 시그니처·필드는 전혀 변경되지 않았고 전부 additive(신규 export type 2개, 신규 public 메서드 1개, 신규 private `Counter` 필드 1개). 기존 호출자 영향 없음. 생성자(`constructor()`, `:72`)에서 `meter.createCounter('clemvion.redis.fail_open', …)` 를 새로 등록하지만 이름이 기존 5개 instrument(`clemvion.execution.total` 등)와 겹치지 않아 OTel 계측기 이름 충돌 없음.
  - 제안: 없음.

- **[INFO]** 새 메트릭 기록 호출 4곳이 인터셉터의 기존 제어 흐름(리턴값·예외 전파)에 개입하지 않는지 확인
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:154`(GET 실패), `:250-253`(엔트리/payload 손상), `:337`(직렬화 실패), `:346`(SET 실패)
  - 상세: 네 호출 모두 `this.metrics?.recordRedisFailOpen(...)` 형태로 `void` 반환이며, 각 위치의 원래 `logger.warn(...)` 직후에만 추가됐다. `discardCorruptEntry`의 반환값(`processFresh()`)·`catchError`의 `of(null)` 반환·`storeEntry`의 `.set().catch()` 콜백 구조는 메트릭 호출 삽입 전후로 동일하다(`.catch((err) => logger.warn(...))` 단일 표현식이 `.catch((err) => { logger.warn(...); this.metrics?.recordRedisFailOpen(...); })` 블록으로 바뀐 것은 구문상 재구성일 뿐 반환값을 아무도 소비하지 않으므로 동작 차이 없음 — 바깥에서 `void this.redis.set(...).catch(...)` 로 이미 버려짐). OTel `Counter.add()`는 설계상 던지지 않는 API 라 이 삽입이 새 예외 경로를 열지 않는다(팀이 RESOLUTION.md 에서 이미 검토·기록한 항목과 동일 결론).
  - 제안: 없음.

- **[INFO]** 신규 테스트의 전역 상태(spy) 격리 확인
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` 신규 `describe('IdempotencyInterceptor — fail-open 관측 (metrics)', …)` 블록의 `jest.spyOn(Logger.prototype, 'warn')` 사용 4곳, `codebase/backend/src/modules/metrics/business-metrics.service.spec.ts` 의 `jest.spyOn(metrics, 'getMeter')`
  - 상세: 인터셉터 스펙은 각 `it` 내부에서 `try { … } finally { warnSpy.mockRestore(); }` 로 개별 복원한다. 메트릭 서비스 스펙은 기존 스위트 레벨 `afterEach(() => jest.restoreAllMocks())` 에 신규 테스트 2건이 자연 편입된다. 두 경로 모두 테스트 간 전역 spy 누수 없음.
  - 제안: 없음.

- **[INFO]** 문서/plan 변경은 순수 미러 갱신
  - 위치: `spec/5-system/_product-overview.md`(§NF-OB-07 표 1행 추가), `spec/data-flow/9-observability.md`(카탈로그 산문 미러 + Rationale 절 추가), `CHANGELOG.md`, `plan/in-progress/backend-lint-gate-broken-on-main.md`, `plan/in-progress/spec-draft-nf-ob-07-redis-fail-open.md`(신규)
  - 상세: 코드 동작에 영향 없는 문서 변경. `spec/` 은 developer 권한 밖이라 draft(`plan/in-progress/spec-draft-nf-ob-07-redis-fail-open.md`)를 통해 별도 planner 턴으로 처리한 것으로 보이며 절차상 문제 없음.
  - 제안: 없음.

## 요약

이번 변경은 `IdempotencyInterceptor` 의 다섯 fail-open 경로에 OTel 카운터 기록을 배선하는 순수 관측 추가다. 생성자 시그니처 확장은 `@Optional()` trailing 파라미터라 기존 수동/DI 호출부 모두 하위 호환이며, `BusinessMetricsService` 쪽 변경은 전부 additive(신규 export type·신규 public 메서드·신규 private 필드)로 기존 계약을 건드리지 않는다. 메트릭 기록 호출은 각 실패 경로의 기존 `logger.warn` 직후에 부작용 없는(`void`, non-throwing) 형태로만 삽입돼 제어 흐름·반환값·예외 전파를 바꾸지 않는다. 신규 테스트의 `jest.spyOn` 은 개별/스위트 레벨로 적절히 복원되어 테스트 간 전역 상태 누수가 없고, `tsc`/`git status` 로 확인된 프로브 파일 잔존도 없다. 문서(spec/CHANGELOG/plan) 변경은 코드와 분리된 순수 미러 갱신이다. 부작용 관점에서 위험 요소를 발견하지 못했다.

## 위험도

NONE
