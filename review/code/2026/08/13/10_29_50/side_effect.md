# 부작용(Side Effect) Review — `clemvion.redis.fail_open` 관측 메트릭 (최종 라운드)

## 배경

이 diff 는 앞선 세 라운드(`08_36_21`→`09_57_11`→`10_13_11`)의 WARNING/제안 반영을 거친 최종
상태다. 실제 코드(`idempotency.interceptor.ts`, `business-metrics.service.ts`)를 직접 열어
diff 게이트 번호와 대조해 확인했다.

## 발견사항

- **[INFO]** `recordRedisFailOpen()` 4개 호출부가 try/catch 로 격리돼 있지 않고, 그중 SET 실패
  경로는 나머지 셋과 실패 시 파급 범위(blast radius)가 다르다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:161`
    (`catchError` 셀렉터 내부, GET 실패), `:257-260`(`discardCorruptEntry`, 엔트리/payload 손상),
    `:344`(`storeEntry` 의 직렬화 실패 `catch`), `:349-354`(`void this.redis.set(...).catch((err) => { ...; this.metrics?.recordRedisFailOpen(...); })`)
  - 상세: 네 곳 모두 `this.metrics?.recordRedisFailOpen(...)` 호출이 그 자체로 예외를 던지지
    않는다는 전제(OTel JS API 계약상 `Counter.add()` 는 던지지 않도록 설계됨, `OTEL_ENABLED`
    미설정 시엔 no-op meter)에 의존한다. 앞의 세 곳(161·257-260·344)은 RxJS 파이프라인
    (`catchError`/`switchMap`) 안에서 실행되므로, 만약 실제로 던진다면 그 예외는 Observable 의
    에러 채널로 흘러 `GlobalExceptionFilter` 가 그 한 요청만 500 으로 처리한다 — "fail-open 이
    fail-closed 로 뒤집히는" 정도의 파급이다. 반면 `349-354` 는 **fire-and-forget Promise 체인**
    (`void this.redis.set(...).catch(...)`, 상위에 추가 `.catch` 없음) 내부라, 만약 그 `.catch`
    콜백 자체가 던지면 반환된 Promise 가 거부되고 그 거부를 받는 곳이 없어 **unhandled promise
    rejection** 이 된다 — Node.js 기본 설정(`--unhandled-rejections=throw`, Node 15+)에서는
    프로세스 종료로 이어질 수 있어, 한 요청의 500 과는 파급 범위가 다르다. 다만 이 자리는
    이번 diff 이전부터 `this.logger.warn(...)` 만으로도 이미 동일한 이론적 위험(동일 Promise
    체인 안, 동일 격리 부재)을 갖고 있었다 — 이번 변경은 그 자리에 예외를 던질 수 있는 호출을
    하나 더 추가했을 뿐, **새로운 파급 범위를 만든 것은 아니고 기존 위험 표면을 소폭 넓힌
    것**이다. 세 라운드 전(`08_36_21`)부터 side_effect 리뷰가 이 네 호출부를 "격리 안 됨" 으로
    한데 묶어 지적해 왔지만, SET 경로만 fire-and-forget Promise 라는 구조적 차이는 명시적으로
    짚히지 않았다.
  - 제안: 조치 불요(OTel 계약상 위험이 낮고 기존에도 같은 자리에 동일 성격의 위험이 있었다).
    다만 metrics 계층이 fail-open 경로에 더 배선될 경우, 최소한 `349-354` 의 `.catch` 콜백
    내부 호출만이라도 `try { ... } catch { /* 무시 */ }` 로 감싸 "관측 실패가 프로세스를
    죽이는" 경로를 원천 차단하는 것을 고려할 만하다.

- **[정보성 확인 — 문제 없음]** `IdempotencyInterceptor` 생성자 시그니처 변경
  (`@Optional() private readonly metrics?: BusinessMetricsService` 4번째 파라미터 추가)은
  하위 호환이 실제로 확인된다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:106`
  - 상세: `@Optional()`, 기존 3개 파라미터 순서를 그대로 두고 끝에 추가(102행 주석 "DI
    파라미터 순서 고정" 정책 준수). `idempotency.interceptor.spec.ts` 의
    `new IdempotencyInterceptor(...)` 호출부 5곳(186·198·220·232·246·1067행)을 전수
    확인 — 전부 위치 인자 3~4개로 신 시그니처와 호환된다. `MetricsModule` 은
    `@Global()`(`metrics.module.ts:8`)이라 `ExternalInteractionModule` 이 별도 import
    없이도 DI 로 정상 주입된다. 프로덕션 경로에서 `metrics` 가 배선 누락으로 조용히
    `undefined` 가 되는 경로는 없다.

- **[정보성 확인 — 문제 없음]** 새 공개 API 표면(`BusinessMetricsService.recordRedisFailOpen()`,
  export 된 `RedisFailOpenComponent`/`RedisFailOpenReason`)은 **추가**일 뿐 기존 시그니처를
  바꾸지 않는다
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:38-46`(타입),
    `:134-139`(메서드)
  - 상세: 기존 `record*` 메서드(`recordExecutionTerminal`·`recordExecutionError` 등)의
    시그니처·동작은 이번 diff 로 변경되지 않았다. 신규 `Counter` 인스턴스
    (`clemvion.redis.fail_open`, `:86-90`)는 생성자에서 새로 등록되는 것으로, 기존 5개
    instrument 등록에 영향을 주지 않는다(순서상 삽입됐지만 각 필드는 독립 변수라 서로
    참조하지 않음).

- **[정보성 확인 — 문제 없음]** 환경 변수·네트워크 호출·전역 변수 관점에서 새로 도입된 것 없음
  - 상세: `OTEL_ENABLED` 읽기는 `@opentelemetry/api` 의 기존 `metrics.getMeter()` 경로를
    그대로 재사용하며 이번 diff 가 새로 추가한 env 접근이 아니다. OTel export 는 SDK 가
    비동기로 처리하는 기존 인프라이고 이 코드 경로가 직접 트리거하지 않는다. 모듈 레벨
    `const METRICS_COMPONENT`(`idempotency.interceptor.ts:32`)는 재할당 불가능한 상수이고
    export 되지 않아 공유 가변 전역이 아니다.

- **[정보성 확인 — 문제 없음]** `plan/`·`review/`·`spec/` 아래 신규 파일 생성은 이 저장소의
  표준 산출물 규약을 따른 의도된 변경이며, 코드 실행 중 발생하는 예상치 못한 파일시스템
  부작용이 아니다(리뷰/plan 워크플로의 정상 산출물).

## 요약

핵심 런타임 변경은 `IdempotencyInterceptor` 의 네 fail-open 경로에 `BusinessMetricsService.recordRedisFailOpen()` 호출을 얹은 순수 관측 추가이며, 생성자 시그니처 확장은 `@Optional()` + 파라미터 말미 추가 + `@Global()` 모듈 배선으로 기존 호출자·DI 양쪽에서 하위 호환이 코드 대조로 확인됐다. 새 전역 가변 상태·의도치 않은 파일시스템/네트워크/환경변수 접근은 없다. 유일하게 주목할 점은 네 곳의 메트릭 호출이 try/catch 로 격리되지 않았다는 것인데, 그중 SET 실패 경로(`349-354`)만 fire-and-forget Promise 체인이라 이론상 unhandled rejection 으로 인한 프로세스 종료라는, 나머지 세 곳(500 응답으로 그침)과 다른 파급 범위를 가진다 — 다만 이 자리는 이번 diff 이전부터 `logger.warn` 만으로도 동일한 구조적 위험을 이미 안고 있었으므로 이번 변경이 새로 만든 위험이 아니라 기존 표면을 한 줄만큼 넓힌 것이다. OTel API 의 no-throw 계약을 감안하면 실제 발생 가능성은 낮다.

## 위험도

LOW
