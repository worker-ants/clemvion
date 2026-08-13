# 아키텍처(Architecture) 리뷰 — `clemvion.redis.fail_open` 카운터 + EIA §R8 캐시 키 스코프

## 발견사항

- **[INFO]** `BusinessMetricsService` 가 서로 무관한 도메인(실행/LLM/큐/노드 지연 + 이제 Redis fail-open)의 계측을 계속 한 클래스에 누적하는 "계측 파사드" 구조
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:60` (`class BusinessMetricsService`)
  - 상세: 이번 diff 로 6번째 instrument(`redisFailOpen`)와 `recordRedisFailOpen()` 메서드가 추가됐다. 각 `record*` 메서드 자체는 응집도가 높고(자기 instrument 만 다룸) 서로 독립적이지만, 클래스 전체는 "NF-OB-07 이 낳는 모든 커스텀 메트릭" 이라는 넓은 책임을 계속 흡수하는 구조라 instrument 가 늘수록 단일 클래스의 표면적이 커진다. 지금 크기(6개 instrument, ~200줄)는 문제 수준이 아니고, `@Global` 파사드로 두어 호출부마다 개별 프로바이더를 주입하지 않아도 되는 이점이 이 구조의 의도된 트레이드오프다(기존 세션에서 이미 채택된 패턴이며 이번 변경이 새로 만든 문제가 아니다).
  - 제안: 당장 조치 불요. instrument 종류가 계속 늘어난다면(예: 10개 이상) 도메인별 sub-facade(예: `RedisFailOpenMetrics`, `ExecutionMetrics`)로 분리해 `BusinessMetricsService` 를 조합 지점으로만 남기는 리팩터를 검토할 시점을 미리 표시해 둔다.

- **[INFO]** 닫힌 유니온(`RedisFailOpenComponent`)이 신규 소비자마다 `metrics` 모듈(교차 바운디드 컨텍스트) 수정을 강제
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:38` (`export type RedisFailOpenComponent = 'idempotency';`)
  - 상세: `RedisFailOpenComponent` 는 현재 멤버가 하나뿐이다. `plan/in-progress/spec-draft-nf-ob-07-redis-fail-open.md` 의 Rationale 이 이미 실측(`grep`)으로 근거를 남겼듯, rate limiter·quota 등 다른 Redis fail-open 소비자들은 아직 이 카운터에 배선되지 않았고 의도적으로 유예됐다. 구조적으로는, 새 소비자가 이 카운터를 쓰려면 자기 모듈뿐 아니라 `metrics` 모듈의 타입 유니온까지 손대야 한다 — 개방-폐쇄 원칙 관점에서는 "확장 시 기존 코드 수정" 이지만, 이건 Prometheus label cardinality 를 닫힌 집합으로 강제하기 위한 **의도된 마찰**이라고 문서(클래스 docstring + spec draft Rationale)에 명시적으로 근거가 남아 있다. 결함이 아니라 설계 트레이드오프.
  - 제안: 조치 불요. 이 마찰이 실제로 확장을 막는 수준이 되면(예: 소비자가 5개 이상으로 늘면) 유니온을 `Record<string, RedisFailOpenReason[]>` 형태의 등록 테이블로 바꿔 각 모듈이 자기 컴포넌트 이름을 로컬에서 등록하게 하는 대안을 그때 검토.

- **[INFO]** `IdempotencyInterceptor`(HTTP 인터셉터, presentation 인접 레이어)가 `BusinessMetricsService`(business 레이어 파사드)를 직접 주입받아 호출
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:103` (`@Optional() private readonly metrics?: BusinessMetricsService`)
  - 상세: 레이어 경계만 보면 인터셉터가 "business metrics" 서비스를 직접 참조하는 모양이지만, 실제로는 이미 `execution-engine`·`llm`·`continuation` 모듈이 동일하게 `BusinessMetricsService` 를 직접 주입받아 쓰고 있고(`MetricsModule` 이 `@Global`), 이 서비스 자체가 "어디서든 옵저버빌리티를 계측하는 횡단 관심사 파사드"로 설계돼 있어 순환 의존 위험도 없다(`metrics` 모듈은 다른 도메인 모듈을 import 하지 않는 leaf 모듈로 확인). 기존 확립된 패턴을 그대로 따른 것이라 이번 diff 가 새로 만든 문제가 아니다. `@Optional()` 로 주입해 미배선 환경에서도 인터셉터 생성이 깨지지 않게 한 점, 기존 생성자 파라미터 순서(하위 호환)를 지키며 새 파라미터를 맨 끝에 추가한 점도 이 클래스가 이미 지켜온 계약(주석에 "DI 파라미터 순서 고정(하위 호환)"으로 명시)을 정확히 따랐다.
  - 제안: 조치 불요. 참고로 남겨 둔다.

## 요약

이번 변경은 `IdempotencyInterceptor` 의 다섯 fail-open 경로를 `BusinessMetricsService.recordRedisFailOpen(component, reason)` 신설 메서드에 배선한 순수 관측(observability) 추가로, SOLID·레이어링·모듈 경계 관점에서 새로운 구조적 결함을 만들지 않았다. `metrics` 모듈은 다른 도메인 모듈을 참조하지 않는 leaf/`@Global` 파사드이며 순환 의존이 없고, `IdempotencyInterceptor` 의 DI 확장은 기존 "파라미터 순서 고정" 관례를 그대로 지켰다. 라벨 값(`component`/`reason`)을 문자열 대신 리터럴 유니온으로 좁혀 "닫힌 집합" 문서 주장을 타입 레벨로 강제한 것(선행 리뷰 WARNING 5 조치)은 `recordExecutionError` 의 런타임 클램핑과 일관된 방어 수준을 갖춘 적절한 추상화이며, `tsc --noEmit` 프로브로 실제 강제력까지 확인됐다는 근거가 RESOLUTION.md 에 남아 있다. 선행 세션(`08_36_21`)이 지적한 JSDoc-describe 인접성 붕괴·`recordRedisFailOpen()` 단위 테스트 부재도 현재 소스에서 해소가 확인된다(describe 순서 정상화, `makeInterceptorWithMetrics` 리네임, 형제 테스트 추가). 남은 관찰 사항은 전부 INFO 수준의 향후 확장성 메모이며, 즉시 조치가 필요한 결함은 없다.

## 위험도
LOW
