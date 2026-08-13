# 테스트(Testing) 리뷰 — `clemvion.redis.fail_open` 카운터 + EIA §R8 (4차 라운드, `10_13_11` 후속)

## 검토 방법

`git diff 322da5695 HEAD -- codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts codebase/backend/src/modules/metrics/business-metrics.service.ts codebase/backend/src/modules/metrics/business-metrics.service.spec.ts` 로 확인한 결과, 직전 테스트 라운드(`10_13_11`, 커밋 `322da5695`)가 검토한 시점 이후 4개 핵심 파일에 **소스 변경이 전혀 없다**. 이번 diff(`10_29_50`)에 새로 나타나는 파일은 `plan/complete/spec-draft-nf-ob-07-redis-fail-open.md`(신규, planner 산출물), `spec/5-system/_product-overview.md`·`spec/data-flow/9-observability.md`(카탈로그 갱신), 그리고 3개 라운드분 `review/**`·`review/consistency/**` 산출물뿐 — 전부 문서이며 테스트 관점의 신규 코드 대상이 아니다.

따라서 실측을 직접 재실행해 회귀 여부를 재확인했다:

```
npx jest business-metrics.service.spec.ts idempotency.interceptor.spec.ts
Test Suites: 2 passed, 2 total
Tests:       72 passed, 72 total
```

(참고: `08_36_21`/`09_57_11`/`10_13_11` 라운드는 "57 passed" 로 기록했다. 차이는 회귀가 아니라 `idempotency.interceptor.spec.ts` 안의 `readKey`/`hashBody` 경계값·`statusCode` 범위 `it.each` 스위트(커밋 `4b1f899b7`, 본 fail-open 기능과 무관·시간상 선행)가 포함/미포함된 실행 스코프 차이다. 두 파일을 직접 열어 `describe`/`it.each` 개수를 세면 72가 맞다.)

`codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:1059-1179` (`describe('IdempotencyInterceptor — fail-open 관측 (metrics)', …)`)와 `codebase/backend/src/modules/metrics/business-metrics.service.spec.ts:62-119` 를 직접 읽어 아래 관점을 재확인했다.

## 발견사항

(신규 CRITICAL/WARNING 없음 — 소스가 `10_13_11` 이후 변하지 않았으므로 이전 라운드가 이미 소진한 WARNING 5건은 그대로 해소 상태. 아래 2건의 INFO 는 `09_57_11`/`10_13_11` 에서 이미 지적된 채 미조치로 남아 있는 항목의 재확인이다.)

- **[INFO]** (carry-forward) `it.each` 4케이스가 균일하게 `await Promise.resolve()` 2틱을 쓰는데, 4케이스 중 실제로 fire-and-forget SET 대기가 필요 없는 경로(`get_failed`/`entry_corrupt`/`payload_corrupt`)에도 같은 틱 수를 적용한다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:1116-1118` (`it.each` 블록의 `// SET 은 fire-and-forget 이라 microtask 몇 틱 뒤에 catch 가 돈다.` 주석 + 2회 `await Promise.resolve()`) — 인터셉터 쪽 `recordRedisFailOpen(METRICS_COMPONENT, 'get_failed')`(`idempotency.interceptor.ts:161`)와 `discardCorruptEntry`(`idempotency.interceptor.ts:257-260`)의 metrics 호출은 `catchError`/동기 분기 안에서 이미 `lastValueFrom` resolve 시점에 끝나 있어 그 뒤의 2틱 대기가 이 단언(`toHaveBeenCalledWith`)에 실질적으로 필요 없다. 반면 같은 파일의 "SET 실패" 케이스(`get_failed` 이전에 위치, 950행대)는 1틱만 쓴다.
  - 상세: 현재는 우연히 양쪽 다 통과한다(2틱이 1틱보다 느슨한 방향이라 실패로 이어지지 않는다). 다만 "왜 2틱인가" 에 대한 근거가 코드에 없어, 다음 사람이 이 값을 줄이거나 늘릴 때 어느 케이스가 진짜로 그 틱을 필요로 하는지 알 수 없다. 세 라운드째 같은 상태로 남아 있다 — 우선순위가 낮다는 판단이 유지되고 있을 뿐 반박된 적은 없다.
  - 제안: 4케이스 중 `set_failed`(실제 fire-and-forget 대상)만 별도로 두거나, 주석에 "왜 2틱이 모든 케이스에 필요한가"(혹은 "사실 GET/corrupt 경로엔 불필요하지만 통일성을 위해 유지" 라는 판단)를 명시.

- **[INFO]** (carry-forward) `recordRedisFailOpen()` 호출 자체가 예외를 던지는 경우를 검증하는 방어적 테스트가 없다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:161`(GET catchError), `:257-260`(discardCorruptEntry), `:344`(직렬화 실패 catch), `:353`(SET catch) — 4개 `this.metrics?.recordRedisFailOpen(...)` 호출이 어느 것도 try/catch 로 격리돼 있지 않다.
  - 상세: `idempotency.interceptor.spec.ts` 의 신규 metrics 테스트는 전부 `recordRedisFailOpen` 이 `jest.fn()` 으로 정상 동작한다는 전제로만 짜여 있다. "metrics 가 죽어도 요청은 산다" 는 이 클래스의 핵심 불변식(fail-open)을 이 신규 호출부에 대해서까지 회귀 테스트로 잠그지는 않는다. `metrics 미주입이어도 fail-open 경로가 죽지 않는다 (optional DI)` 테스트(`idempotency.interceptor.spec.ts:1162-1178`)는 "주입 안 됨" 만 커버하고 "주입은 됐는데 호출이 던진다" 케이스는 다루지 않는다. 실질 위험은 낮다(OTel `Counter.add()` 는 설계상 던지지 않고, 인접한 기존 `logger.warn` 호출도 같은 수준으로 무방비라 새로 벌어진 표면은 아니다).
  - 제안: 당장 조치 불요. `metrics.recordRedisFailOpen` 을 `jest.fn(() => { throw new Error(...) })` 로 교체한 "metrics 가 죽어도 fail-open 이 fail-closed 로 뒤집히지 않는다" 케이스를 추가하면 이 불변식을 명시적으로 고정할 수 있음(우선순위 낮음).

## 테스트 강점 (재확인)

- 다섯 fail-open reason(`get_failed`/`set_failed`/`serialize_failed`/`entry_corrupt`/`payload_corrupt`) 전량을 인터셉터 레벨에서 커버하고, `entry_corrupt`/`payload_corrupt` 는 한 삼항연산자 분기(`idempotency.interceptor.ts:259`)에서 갈리는데도 **각 reason 값을 개별 단언**해 분기 뭉갬 회귀를 실제로 가른다. `business-metrics.service.spec.ts:106-119`(`toHaveBeenNthCalledWith` 2건)도 서비스 레벨에서 같은 구조로 한 번 더 고정한다 — 이중 방어.
- "정상 경로에서는 카운터가 오르지 않는다"(`idempotency.interceptor.spec.ts:1150-1160`)와 "metrics 미주입이어도 죽지 않는다(optional DI)"(`:1162-1178`) 두 테스트가 계약의 반대 방향(거짓 알람·배선 누락 시 크래시)까지 명시적으로 고정한다.
- `business-metrics.service.spec.ts:67-73`(`recordRedisFailOpen` 직접 호출 단언)이 "인터셉터 쪽은 스텁만 쓰므로 서비스 구현 자체를 실행하는 테스트가 없었다" 는 `08_36_21` WARNING 4를 정확히 메운다 — 스텁으로 대체되지 않는 유일한 지점.
- 타입 캐너리(`business-metrics.service.spec.ts:93-104`, `@ts-expect-error` 2곳 + `toHaveBeenCalledTimes(2)`)는 `ts-jest` 가 타입을 strip 한다는 한계를 스스로 docstring 에 명시하고, 실제 감시자(`scripts/check-backend-typecheck-ratchet.py`)를 정확히 지목한다. 별칭이 아니라 메서드 호출 시그니처를 겨눈 설계(뮤테이션 실측 근거 docstring 포함)로, "타입만 보는 캐너리는 별칭 회귀를 못 잡는다" 는 흔한 함정을 피했다.
- 기존 회귀 테스트(캐시 히트·§R8 키 스코프·`readKey`/`hashBody` 경계·`statusCode` 범위 등)는 생성자 4번째 인자가 `@Optional()` 로만 추가돼 전부 그대로 유효 — 72/72 GREEN 으로 재확인.
- 테스트 격리: `business-metrics.service.spec.ts` 는 `beforeEach` 마다 `mock`/`service` 를 새로 만들고 `afterEach(() => jest.restoreAllMocks())` 로 정리한다(1-44행) — 테스트 간 상태 누수 없음. 인터셉터 쪽도 각 `it`/`it.each` 케이스가 `makeRedis()`/`makeMetrics()` 를 로컬로 새로 만들어 공유 상태가 없다.
- 테스트 용이성: `IdempotencyInterceptor` 생성자가 `@Optional() metrics?: BusinessMetricsService` 로 확장돼 실제 DI 컨테이너 없이도 `{ recordRedisFailOpen: jest.fn() }` 평범한 객체로 대체 가능 — mock 프레임워크 의존 없이 얇은 stub 로 충분하다.

## Mock 적절성

`{ recordRedisFailOpen: jest.fn() }` 형태의 구조적 스텁은 실제 `BusinessMetricsService` 의 공개 표면(이 메서드 하나)만 흉내 내므로 과도한 mock 은 아니다. 다만 이 스텁이 존재하는 한 서비스 구현 본문(`this.redisFailOpen.add(1, {...})`)은 인터셉터 spec 어디서도 실행되지 않는데, 이 갭은 `business-metrics.service.spec.ts` 의 신규 2건이 정확히 메운다(WARNING 4 조치, 위 "테스트 강점" 참고) — mock 과 실제 구현 사이의 괴리가 별도 계층에서 커버된 적절한 분업이다.

## 요약

이번 라운드(`10_29_50`)는 4개 핵심 소스 파일이 직전 테스트 라운드(`10_13_11`, 커밋 `322da5695`) 이후 **한 글자도 바뀌지 않은** 상태의 재검토다(`git diff` 로 실측). 새로 나타난 파일은 spec 카탈로그 갱신·plan 이관·이전 라운드 review 산출물뿐이라 테스트 관점의 신규 대상이 없다. `npx jest` 를 직접 재실행해 2 suites / 72 tests 전부 GREEN 을 재확인했고, 다섯 fail-open reason 각각을 개별 단언하는 이중 방어(인터셉터+서비스 레벨), 계약의 반대 방향(정상 경로 미증가·optional DI 무배선 안전)을 고정하는 테스트, 타입 좁힘을 영구 회귀 가드로 고정하는 타입 캐너리까지 테스트 설계가 견고하다. 신규 CRITICAL/WARNING 은 없다. 이전 두 라운드부터 이어지는 INFO 2건(`it.each` 4케이스의 균일한 2틱 `Promise.resolve()` 근거 부재, `recordRedisFailOpen()` 호출 자체가 던지는 경우에 대한 방어적 테스트 부재)은 여전히 유효하지만 둘 다 즉시 조치가 필요한 수준은 아니며 이번 라운드에서 등급을 올릴 근거도 없다.

## 위험도

NONE
