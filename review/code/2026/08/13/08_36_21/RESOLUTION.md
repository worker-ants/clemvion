# RESOLUTION — 세션 `08_36_21` (Redis fail-open 관측 메트릭)

CRITICAL 0 / WARNING 5. **5건 전부 조치**했다(1건은 planner 턴으로 분리 진행 중).

## WARNING 1·2 — 신규 describe 삽입이 남의 JSDoc 을 가로챘다

**조치 완료.** 신규 `fail-open 관측 (metrics)` 블록을 `[Spec EIA §R8 "캐시 키 스코프"]` JSDoc 과
그 대상 describe **사이**에 끼워 넣어, 그 JSDoc 이 엉뚱한 블록을 설명하고 원래 대상은 130줄
아래에서 무주석이 됐다. reviewer 4명이 같은 것을 지적했다.

블록을 `Redis 런타임 장애 fail-open` describe **직후**로 옮겼다 — 파일 끝이 아니라 거기인 이유는
그 블록이 "warn 을 남기는가" 를 보고 이 블록이 "비율·추세로 알람을 걸 수 있는가" 를 보므로
같은 관심사의 연속이기 때문이다. 이동 후 5개 JSDoc 이 각자 자기 describe 에 인접한다.

파일 헤더 docstring 도 함께 고쳤다 — "네 번째 describe 는 캐시 키 스코프" 가 삽입으로 어긋나
있었다(실제 다섯 번째). 신규 스위트 설명 문단을 네 번째 자리에 넣고 서수를 정정했다.

> 원인은 삽입 스크립트가 앵커를 `describe(` 한 줄로만 잡은 것이다. **describe 앞의 JSDoc 은
> 그 describe 의 일부**인데 앵커가 그것을 모르면 문서와 대상 사이를 정확히 갈라 놓는다.

## WARNING 3 — [SPEC-DRIFT] NF-OB-07 카탈로그 미갱신

**planner 턴으로 분리, 진행 중.** `BusinessMetricsService` docstring 이 §NF-OB-07 표를 SoT 로
인용하는데 코드는 6번째 instrument 를 추가하고 표는 5행 그대로였다 — SoT 를 인용하면서 SoT 를
갱신하지 않으면 그 인용이 거짓이 된다.

`spec/` 은 developer 권한 밖이라(CLAUDE.md) draft
(`plan/in-progress/spec-draft-nf-ob-07-redis-fail-open.md`)를 쓰고 `/consistency-check --spec`
을 거치는 planner 절차로 분리했다. 이 세션에서 같은 규약을 developer 턴에 어긴 전례가 있어
여기서는 합치지 않았다.

1차 검토 `09_36_31` 이 **BLOCK: YES** — draft frontmatter 필수 필드 누락(build guard 실측
FAIL) + 내가 미머지 #1161 의 클래스를 실존인 양 인용한 것 등 4건. 전부 반영 후 재검토 중.

## WARNING 4 — `recordRedisFailOpen()` 자체를 실행하는 테스트가 없었다

**조치 완료.** 인터셉터 쪽 테스트는 이 메서드를 `{ recordRedisFailOpen: jest.fn() }` 스텁으로
대체하므로 **구현 본문은 어느 테스트도 실행하지 않았다** — 카운터 이름 오탈자·라벨 키 뒤바뀜·
`add` 누락이 전부 조용히 통과한다. 형제 `record*` 메서드가 모두 자기 테스트를 갖는 이유다.

`business-metrics.service.spec.ts` 에 2건 추가하고 뮤테이션으로 변별력을 확인했다 — **4/4 사살**:

| 뮤턴트 | 결과 |
|---|---|
| 카운터 이름 오탈자(`fail_open`→`failopen`) | RED |
| 라벨 키 뒤바뀜(`component`↔`reason`) | RED |
| 증가량 `1`→`2` | RED |
| `reason` 상수화(두 손상 갈래를 뭉갬) | RED |

두 번째 테스트("reason 이 호출마다 그대로 갈린다")가 마지막 뮤턴트를 잡는다. 총량만 보는
단언으로는 갈래를 뭉개는 회귀가 안 잡힌다.

## WARNING 5 — "닫힌 집합" 이라 적어 놓고 시그니처는 `string`

**조치 완료.** docstring 이 `component`/`reason` 을 "코드가 정하는 닫힌 집합" 이라 주장하면서
시그니처는 평범한 `string` 이라 타입·런타임 어느 쪽으로도 강제되지 않았다. 자매
`recordExecutionError` 는 같은 위험(Prometheus label cardinality)을 `.substring(0, 64)` 로
실제 방어하는데 이쪽만 주석뿐이었다 — **문서한 보장이 구현보다 넓은** 전형이다.

리터럴 유니온 `RedisFailOpenComponent`/`RedisFailOpenReason` 을 export 하고 시그니처를 좁혔다.

**이것이 실제로 막는지는 별도로 확인해야 했다** — 이 저장소의 jest(ts-jest)는 타입 진단을 하지
않아 테스트 GREEN 이 증거가 못 된다(spec 파일 기존 tsc 에러 199건이 그대로 통과하는 것이 그
증거다). 일회성 프로브를 `tsc --noEmit` 에 태워 확인했다:

```
src/__union-probe.ts(7,38): error TS2345: Argument of type 'string' is not assignable
                            to parameter of type 'RedisFailOpenReason'.
src/__union-probe.ts(8,38): error TS2345: Argument of type '"not_a_real_reason"' is not
                            assignable to parameter of type 'RedisFailOpenReason'.
```

프로브는 제거했다(`git status codebase/` clean 확인).

## INFO 2·3 — 함께 조치

- `withMetrics()` → `makeInterceptorWithMetrics()` (파일 전역 `make*` 팩토리 관례)
- `'idempotency'` 리터럴 4곳 → `METRICS_COMPONENT` 상수(타입은 `RedisFailOpenComponent`)

## 조치하지 않은 INFO

| INFO | 처분 |
|---|---|
| 1 metrics 호출에 try/catch 격리 없음 | 무조치 — OTel `Counter.add()` 는 던지지 않도록 설계됐고 인접 `logger.warn` 도 동일하게 무방비다. 이것만 감싸면 방어 수준이 불균일해진다 |
| 4·5 보안 확인(payload 비노출·DI 배선) | 조치 불요 — 문제 없음 확인 |

## 검증

- eslint(external-interaction + metrics): **0 warning / 0 error**
- jest 동 범위: **3 suites / 57 passed**
- `tsc` ratchet: **199건** — 내가 만진 4개 파일 신규 에러 **0건**
- `plan-frontmatter.test.ts`(frontend build guard): **141 passed**
