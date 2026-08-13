# 아키텍처(Architecture) 리뷰 — `clemvion.redis.fail_open` 관측 카운터 (세션 `10_29_50`, 3회차)

## 배경

이번 diff 는 대부분 이전 두 리뷰 세션(`08_36_21` → WARNING 5건 조치, `09_57_11` → 해결 확인)의
산출물과 그 후속 spec 등재(`plan/complete/spec-draft-nf-ob-07-redis-fail-open.md` 경유 —
`spec/5-system/_product-overview.md` §NF-OB-07 표 1행 + `spec/data-flow/9-observability.md`
미러 문장 + Rationale)가 함께 실려 있다. 실질 코드 변경은 5개 파일
(`CHANGELOG.md`, `idempotency.interceptor.ts`/`.spec.ts`,
`business-metrics.service.ts`/`.spec.ts`) 뿐이고, 나머지 60여 개는 `review/**`·`plan/**` 산출물과
spec 카탈로그 미러 갱신이다. 아키텍처 관점에서는 실질 코드 5개 파일만 대상이 된다.

핵심 소스(`business-metrics.service.ts`, `idempotency.interceptor.ts`, `metrics.module.ts`,
`idempotency.interceptor.spec.ts`)를 직접 열어 현재 상태를 재확인했다.

## 발견사항

- **[INFO]** `BusinessMetricsService` 가 서로 다른 도메인(실행/LLM/큐/노드 지연 + Redis
  fail-open)의 계측을 한 클래스에 계속 누적하는 "계측 파사드" 구조
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts` (`class
    BusinessMetricsService`, `recordRedisFailOpen` 추가로 6번째 instrument)
  - 상세: 각 `record*` 메서드는 자기 instrument 만 다뤄 응집도가 높고 서로 독립적이지만,
    클래스 전체는 "NF-OB-07 이 낳는 모든 커스텀 메트릭"이라는 넓은 책임을 계속 흡수한다.
    현재 크기(6 instrument, 200줄)는 문제 수준이 아니고, `@Global` 파사드로 두어 호출부마다
    개별 프로바이더 주입을 피하는 것이 의도된 트레이드오프다(기존에 이미 채택된 패턴).
  - 제안: 조치 불요. instrument 가 10개 이상으로 늘면 도메인별 sub-facade 분리를 검토할
    시점으로 표시해 둔다. (직전 세션 `09_57_11` architecture.md 와 동일한 관찰 — 재확인.)

- **[INFO]** `IdempotencyInterceptor`(인터셉터, presentation 인접 레이어)가
  `BusinessMetricsService`(business 레이어 파사드)를 직접 주입받아 호출
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:106`
    (`@Optional() private readonly metrics?: BusinessMetricsService`)
  - 상세: 레이어 경계만 보면 인터셉터가 business metrics 서비스를 직접 참조하는 모양이지만,
    `execution-engine`·`llm`·`continuation` 등 다른 도메인 모듈도 동일 패턴으로
    `BusinessMetricsService` 를 직접 주입받는다(`MetricsModule` 이 `@Global`). 이 서비스는
    "횡단 관심사 관측 파사드"로 설계된 것이라 레이어 위반이라기보다 인프라 서비스 패턴에
    가깝다. `metrics.module.ts` 를 확인한 결과 `imports: []`(exports 만) — 다른 도메인 모듈을
    import 하지 않는 순수 leaf 모듈이고, `external-interaction` 쪽에서도 `MetricsModule` 을
    별도 import 하지 않는다(전역 등록으로 충분). **순환 의존 없음을 실측 확인**
    (`grep -rn "ExternalInteractionModule\|external-interaction"
    codebase/backend/src/modules/metrics/` → 0건).
  - 제안: 조치 불요.

- **[INFO]** 닫힌 유니온(`RedisFailOpenComponent`)이 신규 소비자마다 `metrics` 모듈(교차
  바운디드 컨텍스트) 수정을 강제 — 개방-폐쇄 원칙 관점의 의도된 마찰
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:38`
    (`export type RedisFailOpenComponent = 'idempotency';`)
  - 상세: 현재 멤버가 하나뿐이다. `plan/complete/spec-draft-nf-ob-07-redis-fail-open.md` 의
    Rationale 이 실측(`grep`)으로 근거를 남겼듯, rate limiter·quota 등 다른 Redis fail-open
    소비자는 아직 이 카운터에 배선되지 않았고 의도적으로 유예됐다("비목표" 절에 명시). 새
    소비자가 이 카운터를 쓰려면 자기 모듈뿐 아니라 `metrics` 모듈의 타입 유니온까지 손대야
    한다는 점은 "확장 시 기존 코드 수정"이지만, Prometheus label cardinality 를 닫힌 집합으로
    강제하기 위한 의도된 마찰이라고 클래스 docstring + spec draft Rationale 양쪽에 근거가
    남아 있다.
  - 제안: 조치 불요. 소비자가 다수(예: 5개 이상)로 늘어 마찰이 실제 확장을 막는 수준이 되면
    등록 테이블 형태(`Record<string, RedisFailOpenReason[]>`)로의 전환을 그때 검토.

- **[INFO]** 테스트 구조(JSDoc-describe 인접성) — 선행 WARNING 해결 재확인
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts`
  - 상세: 직접 grep 확인 결과 `fail-open 관측 (metrics)` describe(1059행)가 `Redis 런타임
    장애 fail-open` describe(850행) 직후, `캐시 키 스코프 (Spec EIA §R8)` describe(1197행)
    이전에 위치한다 — 세션 `08_36_21`이 지적한 "신규 describe 가 남의 JSDoc 을 가로챈" 구조적
    결함이 실제로 해소됐다. 헬퍼명도 `makeInterceptorWithMetrics`(1063행)로 파일 전역
    `make*` 팩토리 관례에 맞춰 통일됐다.
  - 제안: 조치 불요(확인용 기재).

## 요약

이번 diff 의 실질 아키텍처 표면(`recordRedisFailOpen()` 신설 + `IdempotencyInterceptor` 다섯
fail-open 경로 배선)은 SOLID·레이어링·모듈 경계·순환 의존 어느 축에서도 새로운 구조적 결함을
만들지 않는다. `metrics` 모듈은 다른 도메인을 참조하지 않는 leaf/`@Global` 파사드이고,
`IdempotencyInterceptor` 의 DI 확장은 `@Optional()` + 파라미터 순서 고정(하위 호환) 관례를
그대로 지켰다. 라벨 값(`component`/`reason`)을 문자열 대신 닫힌 리터럴 유니온으로 좁힌 것은
`recordExecutionError` 의 런타임 클램핑과 일관된 방어 수준을 갖춘 적절한 추상화이며, 소스를
직접 열어 재확인한 결과 선행 세션(`08_36_21`)이 지적한 JSDoc-describe 인접성 붕괴도 실제로
해소되어 있다. 이 세션은 사실상 직전 두 라운드(`08_36_21`→`09_57_11`)와 동일한 결론에
수렴한다 — 새로 발견된 CRITICAL/WARNING 은 없고, 남은 관찰은 모두 향후 확장성에 대한 INFO
메모(계측 파사드 크기, 닫힌 유니온의 확장 마찰)로 즉시 조치가 필요한 결함이 아니다.

## 위험도

LOW
