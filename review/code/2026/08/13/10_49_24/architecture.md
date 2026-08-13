# 아키텍처(Architecture) 리뷰 — `clemvion.redis.fail_open` 관측 카운터 (세션 `10_49_24`, 4회차)

## 배경

이번 diff 는 이전 세 리뷰 세션(`08_36_21` → WARNING 5건 조치, `09_57_11` → 해결 확인,
`10_29_50` → WARNING 2건 조치: describe 서수 색인 → 이름 기반 전환, `plan/complete/` 완료 문서의
미해결 체크박스를 살아 있는 plan 으로 이관)의 산출물을 포함한다. 실질 코드 변경은 5개 파일
(`CHANGELOG.md`, `idempotency.interceptor.ts`/`.spec.ts`, `business-metrics.service.ts`/`.spec.ts`)
뿐이고, `10_29_50` 리뷰 이후 이번 라운드까지 코드 diff 는 추가되지 않았다(`git diff
814c6c7a9...HEAD` 공백 — 두 WARNING 조치 커밋과 SUMMARY 커밋만 존재하며 전부 문서/plan
파일이다). 따라서 실질 아키텍처 표면은 `10_29_50` 리뷰와 동일하다. 핵심 소스
(`business-metrics.service.ts`, `idempotency.interceptor.ts`, `metrics.module.ts`)를 다시 열어
현재 상태를 직접 재확인했다.

## 발견사항

- **[INFO]** `BusinessMetricsService` 가 서로 다른 도메인(실행/LLM/큐/노드 지연 + Redis
  fail-open)의 계측을 한 클래스에 계속 누적하는 "계측 파사드" 구조
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts` — `class
    BusinessMetricsService`, `recordRedisFailOpen()` 신설로 6번째 instrument(`redisFailOpen`
    필드, 생성자 `createCounter('clemvion.redis.fail_open', ...)`)가 추가됨.
  - 상세: 각 `record*` 메서드는 자기 instrument 만 다뤄 메서드 단위 응집도는 높지만, 클래스
    전체는 "NF-OB-07 이 낳는 모든 커스텀 메트릭"이라는 넓은 책임을 계속 흡수한다. 현재 크기
    (6 instrument, ~200줄)는 문제 수준이 아니고, `@Global` 파사드로 두어 호출부마다 개별
    프로바이더를 주입하지 않아도 되는 것이 의도된 트레이드오프다(기존 세션에서 이미 채택된
    패턴이며 이번 diff 가 새로 만든 문제가 아니다).
  - 제안: 조치 불요. instrument 종류가 10개 이상으로 늘어나면 도메인별 sub-facade(예:
    `RedisFailOpenMetrics`)로 분리해 `BusinessMetricsService` 를 조합 지점으로만 남기는
    리팩터를 검토할 시점으로 표시해 둔다.

- **[INFO]** `IdempotencyInterceptor`(HTTP 인터셉터, presentation 인접 레이어)가
  `BusinessMetricsService`(business 레이어 파사드)를 직접 주입받아 호출
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:106`
    (`@Optional() private readonly metrics?: BusinessMetricsService`)
  - 상세: 레이어 경계만 보면 인터셉터가 business metrics 서비스를 직접 참조하는 모양이지만,
    `execution-engine`·`llm`·`continuation` 등 다른 도메인 모듈도 동일 패턴으로
    `BusinessMetricsService` 를 직접 주입받고(`MetricsModule` 이 `@Global`), 이 서비스는
    "횡단 관심사 관측 파사드"로 설계된 것이라 레이어 위반이라기보다 인프라 서비스 패턴에
    가깝다. `metrics.module.ts` 를 직접 열어 확인 — `providers/exports` 만 있고 `imports` 는
    없다(다른 도메인 모듈을 참조하지 않는 leaf 모듈). `external-interaction` 쪽에서도
    `MetricsModule` 을 별도 import 하지 않는다(전역 등록으로 충분) — **순환 의존 없음**.
  - 제안: 조치 불요.

- **[INFO]** 닫힌 유니온(`RedisFailOpenComponent`)이 신규 소비자마다 `metrics` 모듈(교차
  바운디드 컨텍스트) 수정을 강제 — 개방-폐쇄 원칙 관점의 의도된 마찰
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:38`
    (`export type RedisFailOpenComponent = 'idempotency';`)
  - 상세: 현재 멤버가 하나뿐이다. `plan/complete/spec-draft-nf-ob-07-redis-fail-open.md` 의
    Rationale 이 실측(`grep -rln "recordRedisFailOpen"` → 호출부는 인터셉터 1곳뿐, `fail-open`
    을 하는 서비스는 17개 파일)으로 근거를 남겼듯, rate limiter·quota 등 다른 Redis fail-open
    소비자는 아직 배선되지 않았고 의도적으로 유예됐다(`plan/in-progress/
    backend-lint-gate-broken-on-main.md` 의 "다른 Redis fail-open 소비자를 이 카운터에 배선"
    항목으로 이관, 배선 시 유니온·표 동시 갱신 조건 명시). 새 소비자가 이 카운터를 쓰려면
    자기 모듈뿐 아니라 `metrics` 모듈의 타입 유니온까지 손대야 한다는 점은 "확장 시 기존 코드
    수정"이지만, Prometheus label cardinality 를 닫힌 집합으로 강제하기 위한 의도된 마찰이라고
    클래스 docstring + spec draft Rationale 양쪽에 근거가 남아 있다.
  - 제안: 조치 불요. 소비자가 다수(예: 5개 이상)로 늘어 마찰이 실제 확장을 막는 수준이 되면
    등록 테이블 형태(`Record<string, RedisFailOpenReason[]>`)로의 전환을 그때 검토.

- **[정보성 확인 — 문제 없음]** 직전 라운드(`10_29_50`) WARNING 2건의 아키텍처 영향 재확인
  - 상세: `10_29_50` 이 지적한 두 WARNING(테스트 파일 헤더 색인의 서수 중복, `plan/complete/`
    문서의 미해결 체크박스 잔존)은 둘 다 문서/색인 표기 문제이며 이번 조치(서수 → describe
    이름 기반 색인 전환, 후속 항목을 `plan/in-progress/backend-lint-gate-broken-on-main.md` 로
    이관)로 해소됐다. 두 조치 모두 코드 구조·모듈 경계·타입 계약을 건드리지 않는 순수 문서
    변경이라 아키텍처 관점에서 새로 검토할 표면이 없다.

## 요약

이번 diff 의 실질 아키텍처 표면(`recordRedisFailOpen()` 신설 + `IdempotencyInterceptor` 다섯
fail-open 경로 배선)은 `10_29_50` 라운드 이후 코드 변경이 없어 SOLID·레이어링·모듈 경계·순환
의존 어느 축에서도 새로운 구조적 결함이 없다. `metrics` 모듈은 다른 도메인을 참조하지 않는
leaf/`@Global` 파사드이고, `IdempotencyInterceptor` 의 DI 확장은 `@Optional()` + 파라미터 순서
고정(하위 호환) 관례를 그대로 지켰다. 라벨 값(`component`/`reason`)을 문자열 대신 닫힌 리터럴
유니온으로 좁힌 것은 `recordExecutionError` 의 런타임 클램핑과 일관된 방어 수준을 갖춘 적절한
추상화다. 이번 라운드에 새로 반영된 두 문서 수정(describe 이름 기반 색인, plan 체크리스트
이관)도 아키텍처 표면에 영향이 없음을 확인했다. 새로 발견된 CRITICAL/WARNING 은 없고, 남은
관찰은 전부 향후 확장성에 대한 INFO 메모(계측 파사드 크기, 닫힌 유니온의 확장 마찰)이며 즉시
조치가 필요한 결함이 아니다.

## 위험도

LOW
