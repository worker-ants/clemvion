# 부작용(Side Effect) Review — `clemvion.redis.fail_open` OTel 카운터 (4차/누적 라운드)

## 배경

이 changeset 의 핵심 코드(`IdempotencyInterceptor` 다섯 fail-open 경로 중 네 곳에
`BusinessMetricsService.recordRedisFailOpen()` 배선, 신규 Counter·리터럴 유니온 타입,
`recordRedisFailOpen()` 메서드 신설)는 이미 세 차례(`08_36_21`→`09_57_11`→`10_29_50`) side_effect
리뷰를 거쳐 CRITICAL/WARNING 0건으로 수렴한 상태다. 이번 라운드에서 실제 소스 4개 파일
(`idempotency.interceptor.ts`, `business-metrics.service.ts`, 각 `.spec.ts`)을 `Read`/`grep` 으로
직접 열어 현재 상태를 재대조했고, 신규 diff 는 이전 라운드 산출물(review/consistency 아티팩트)과
`spec/5-system/_product-overview.md`/`spec/data-flow/9-observability.md` 카탈로그 등재뿐이라
런타임 코드 자체는 이전 라운드에서 변경이 없다.

## 발견사항

- **[정보성 확인 — 문제 없음]** `IdempotencyInterceptor` 생성자 시그니처 확장은 하위 호환이 실측으로 확인된다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — 생성자
    (`@Optional() private readonly metrics?: BusinessMetricsService` 4번째 파라미터 추가)
  - 상세: 기존 3개 파라미터(`_configService`·`injectedRedis`·`redisConn`) 순서를 그대로 두고
    `@Optional()` 로 끝에 추가했다(주석 "DI 파라미터 순서 고정" 정책 준수). 스펙 파일의
    `new IdempotencyInterceptor(...)` 호출부 6곳(191·203·225·237·251·1072행)을 전수 확인 —
    전부 위치 인자 3~4개로 신 시그니처와 호환된다. `MetricsModule` 은 `@Global()`
    (`metrics.module.ts:8`)이고 `AppModule`(`app.module.ts:163`)에 등록돼 있어
    `ExternalInteractionModule` 이 별도 import 없이도 `BusinessMetricsService` 가 DI 로 정상
    주입된다 — 프로덕션 경로에서 `metrics` 가 배선 누락으로 조용히 `undefined` 가 되는 경로는
    없다.
  - 제안: 없음.

- **[정보성 확인 — 문제 없음]** 새 공개 API 표면은 순수 추가이며 기존 시그니처를 바꾸지 않는다
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:38-46`(export 타입
    `RedisFailOpenComponent`/`RedisFailOpenReason`), `:134-139`(`recordRedisFailOpen()` 메서드)
  - 상세: 기존 `record*` 메서드(`recordExecutionTerminal`·`recordExecutionError`·`recordLlmTokens`·
    `recordNodeDuration`·`registerQueueDepthProvider`)의 시그니처·동작은 이번 diff 로 변경되지
    않았다. 신규 `Counter`(`clemvion.redis.fail_open`, `:86-90`)는 생성자에서 독립적으로 등록되며
    기존 5개 instrument 등록 순서·참조에 영향을 주지 않는다. `BusinessMetricsService` 생성자
    자체는 파라미터가 없어(변경 없음) 다른 소비 모듈(execution-engine·llm·continuation 등)의
    주입 방식에도 영향이 없다.
  - 제안: 없음.

- **[정보성 확인 — 문제 없음]** 새 전역 가변 상태 없음
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:32`
    (`const METRICS_COMPONENT: RedisFailOpenComponent = 'idempotency';`)
  - 상세: 모듈 스코프 상수이나 재할당 불가(`const`)이고 export 되지 않아 파일 밖에서 접근·변경할
    수 없다. `BusinessMetricsService.redisFailOpen`(Counter 필드)도 인스턴스 필드이고
    `@Injectable()` 싱글턴 범위 안에서만 `add()` 를 통해 상태가 누적되는 정상적인 계측 상태다 —
    이 변경이 새로 도입한 공유 가변 전역은 없다.
  - 제안: 없음.

- **[정보성 확인 — 문제 없음]** 환경 변수·네트워크 호출 관점에서 새로 도입된 것 없음
  - 상세: `OTEL_ENABLED` 읽기는 `@opentelemetry/api` 의 기존 `metrics.getMeter()` 경로를 그대로
    재사용하며 이번 diff 가 새로 추가한 env 접근이 아니다(`business-metrics.service.ts:73`,
    변경 없는 라인). `OTEL_ENABLED` 미설정 시 no-op meter 가 반환되어 `Counter.add()` 호출이
    무동작이 된다. OTel export(네트워크 전송)는 SDK 가 비동기 배치로 처리하는 기존 인프라이고,
    이 코드 경로(`recordRedisFailOpen` 호출)가 직접 네트워크 요청을 트리거하지 않는다.
  - 제안: 없음.

- **[INFO — 이전 라운드 반복 확인, 조치 불요]** `recordRedisFailOpen()` 4개 호출부가 try/catch 로
  격리돼 있지 않다 (SET 실패 경로는 fire-and-forget Promise 체인이라 나머지 셋과 파급 범위가 다름)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:161`
    (GET 실패, `catchError` 내부), `:257-260`(`discardCorruptEntry`, 엔트리/payload 손상),
    `:344`(`storeEntry` 직렬화 실패), `:349-354`(`void this.redis.set(...).catch(...)` 내부 SET 실패)
  - 상세: 네 곳 모두 `this.metrics?.recordRedisFailOpen(...)` 이 예외를 던지지 않는다는 전제
    (OTel `Counter.add()` 의 no-throw 계약)에 의존한다. 앞 세 곳은 RxJS 파이프라인 안이라 만약
    실제로 던지면 그 요청만 500 이 되는 정도지만, `349-354` 는 상위 `.catch` 가 없는
    fire-and-forget Promise 체인 내부라 이론상 unhandled promise rejection 으로 이어질 수 있다.
    다만 이 자리는 이번 diff 이전부터 인접한 `this.logger.warn(...)` 도 동일하게 무방비였던
    기존 위험 표면이며, 이번 변경은 그 표면을 한 줄만큼 넓혔을 뿐 새로운 위험 클래스를 만들지
    않았다. `10_29_50` RESOLUTION.md 가 같은 항목(INFO 1)을 "무조치 — 하나만 감싸면 방어 수준이
    불균일해지고, 묶으려면 fail-open 경로 부수 호출 전체를 다뤄야 해 PR 범위 밖" 으로 명시
    처분했다.
  - 제안: 당장 조치 불요. metrics 계층이 fail-open 경로에 계속 추가되면 그때 `349-354` 의
    `.catch` 콜백 내부만이라도 얇은 `try/catch` 방어를 고려.

- **[정보성 확인 — 문제 없음]** `plan/`·`review/`·`spec/` 아래 신규 파일 생성은 코드 실행이 만드는
  예상치 못한 파일시스템 부작용이 아니라, 이 저장소가 강제하는 표준 산출물 규약(구현 완료 후
  `/ai-review` 강제, SPEC-DRIFT 시 planner 턴 분리, consistency-check 아티팩트)에 따른 의도된
  변경이다. `spec/5-system/_product-overview.md`·`spec/data-flow/9-observability.md` 갱신도
  기존 5행/서술에 1행/1문구만 추가하고 다른 섹션은 건드리지 않는다(직접 diff 대조 확인).
  - 제안: 없음.

## 요약

핵심 런타임 변경(`IdempotencyInterceptor` 4개 fail-open 지점에 `BusinessMetricsService.recordRedisFailOpen()` 배선, 신규 Counter·리터럴 유니온 타입 도입)은 순수 관측성 추가이며, 이번 라운드에서 소스를 직접 재대조한 결과 이전 세 라운드(`08_36_21`/`09_57_11`/`10_29_50`)가 이미 확인한 결론과 달라진 점이 없다. 생성자 시그니처 확장은 `@Optional()` + 파라미터 말미 추가 + `@Global()` 모듈 배선으로 기존 호출자(6곳 전수 확인) 및 DI 양쪽에서 하위 호환이 유지된다. 새 공개 메서드/타입은 순수 추가로 기존 `record*` 시그니처를 바꾸지 않는다. 새 전역 가변 상태, 의도치 않은 파일시스템·네트워크·환경변수 접근은 발견되지 않았다. 유일한 잔여 관찰은 metrics 호출 4곳이 try/catch로 격리되지 않았다는 INFO 하나로, SET 경로(fire-and-forget Promise)만 이론상 unhandled rejection 파급이 나머지와 다르지만 이는 diff 이전부터 있던 위험 표면의 소폭 확장일 뿐이고 이미 이전 라운드에서 검토·처분됐다(무조치 결정, 근거 명시). 새로 발견된 CRITICAL/WARNING 급 부작용은 없다.

## 위험도

LOW
