# 테스트(Testing) 리뷰 — `clemvion.redis.fail_open` 카운터 + EIA §R8 (3차 라운드, `09_57_11` 후속)

## 검토 방법

이번 diff(`10_13_11`)는 `git diff origin/main...HEAD` 기준 `codebase/**` 변경분이 직전 라운드
(`09_57_11`, 커밋 `56fac52c3` 시점 스냅샷)와 **완전히 동일**함을 커밋 로그로 확인했다 — 직전 라운드
이후 `codebase/` 를 건드린 커밋은 `409e7ff6c`(타입 캐너리 테스트 추가, `09_57_11` 리뷰 실행 **전**
10:12:19 에 커밋되어 이미 그 라운드가 리뷰한 상태에 포함됨) 하나뿐이고, 그 뒤로는
`0705e19b5`(리뷰 산출물 커밋)만 있어 소스 변경이 없다. 이번 diff 에 새로 나타나는 파일은 전부
`review/**` 산출물(이전 두 라운드의 SUMMARY/개별 리뷰/consistency 산출물)이며 테스트 관점의
신규 검토 대상이 아니다.

따라서 실제 검증 대상은 4개 핵심 파일 — `idempotency.interceptor.ts`/`.spec.ts`,
`business-metrics.service.ts`/`.spec.ts` — 이며, 이들을 `Read` 로 직접 열어 현재 상태를
확인하고 `npx jest business-metrics.service.spec.ts idempotency.interceptor.spec.ts` 를 직접
실행해 실측했다: **2 suites / 57 passed** (RESOLUTION.md·직전 라운드 주장과 일치).

## 발견사항

(신규 CRITICAL/WARNING 없음 — 직전 두 라운드가 지적한 WARNING 5건 + INFO 3(타입 좁힘 영구
회귀 가드 부재)까지 전부 코드에서 해소돼 있음을 직접 재확인)

- **[INFO]** (직전 라운드 `09_57_11` testing #2 의 재확인·carry-forward) 신규 `it.each` 4케이스는
  `await Promise.resolve()` 를 2틱 쓰는데, 같은 파일의 기존 "SET 실패" 테스트는 1틱만 쓴다 —
  근거 주석 없이 값이 다르다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts`
    (신규 `it.each` 블록의 `// SET 은 fire-and-forget 이라 microtask 몇 틱 뒤에 catch 가 돈다.`
    주석 바로 아래 두 줄) vs 기존 "SET 실패" 테스트의 1틱 `await Promise.resolve()`
  - 상세: 둘 다 같은 `.set(...).catch(...)` fire-and-forget 체인을 기다리는 목적인데 틱 수가
    다르다. 현재는 우연히 양쪽 다 통과하지만(2틱이 1틱보다 느슨한 쪽이라 실패 방향은 아니다),
    "몇 틱이 정확히 필요한가" 에 대한 근거가 코드에 없어 다음 사람이 왜 여기만 2틱인지 알 수
    없다. 직전 라운드에서 이미 INFO 로 지적됐고 우선순위가 낮다고 판단돼 이번 라운드까지
    미조치 상태로 남아 있다 — 재지적하되 등급을 올릴 근거는 없다(테스트는 GREEN, 실패
    방향 아님).
  - 제안: 주석으로 "왜 2틱인가"(예: `it.each` 4케이스 중 SET 실패 케이스만 실제로 필요하고
    나머지 3케이스는 0틱으로도 충분하다는 식)를 명시하거나, 기존 1틱 관례로 통일.

- **[INFO]** `recordRedisFailOpen()` 자체가 예외를 던지는 경우를 검증하는 방어적 테스트가 없다
  (엣지 케이스 관점 — side_effect.md 가 같은 지점을 다른 각도에서 이미 INFO 로 다뤘음)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:154,
    250-253, 337, 346` (`this.metrics?.recordRedisFailOpen(...)` 4개 호출부) — 이 호출들이
    try/catch 로 격리돼 있지 않으므로, 만약 `metrics` 가 예외를 던지면 그 예외가
    `catchError`/`discardCorruptEntry` 안에서 전파되어 fail-open 자체가 fail-closed 로
    뒤집힌다.
  - 상세: `idempotency.interceptor.spec.ts` 의 신규 metrics 테스트들은 전부 `recordRedisFailOpen`
    이 정상 동작(`jest.fn()`)한다는 전제로만 짜여 있고, "metrics 서비스가 죽어도 요청은 산다"
    는 이 클래스의 핵심 불변식(파일 헤더 docstring 86~91행)을 이 새 호출부에 대해서까지
    회귀 테스트로 고정하지는 않는다. 현재 OTel `Counter.add()` 는 설계상 던지지 않으므로
    실질 위험은 낮고, 인접한 기존 `logger.warn(...)` 호출도 같은 수준(무방비)이라 새로
    벌어진 표면은 아니다 — 그래서 이 항목은 INFO 로 유지한다.
  - 제안: 당장 조치 불요. `metrics` 를 throw 하는 스텁으로 교체한 "metrics 가 죽어도 fail-open
    이 fail-closed 로 뒤집히지 않는다" 테스트를 추가하면 이 불변식을 명시적으로 잠글 수 있다
    (우선순위 낮음 — `MetricsModule` 부재/`@Optional()` 미주입 케이스는 이미 별도 테스트로
    고정돼 있고, 이건 "주입은 됐는데 호출이 던지는" 더 드문 경로다).

## 테스트 강점 (재확인, 참고)

- 다섯 fail-open reason(`get_failed`/`set_failed`/`serialize_failed`/`entry_corrupt`/
  `payload_corrupt`) 전량을 커버하고, `entry_corrupt`/`payload_corrupt` 는 하나의 삼항연산자
  분기(`idempotency.interceptor.ts:250-253`)에서 나오는데도 **각 reason 값을 개별 단언**해
  분기 뒤집힘/뭉갬 회귀를 실제로 가른다(`business-metrics.service.spec.ts` 의
  `toHaveBeenNthCalledWith` 2건도 같은 구조로 서비스 쪽에서 한 번 더 고정).
- "정상 경로에서는 카운터가 오르지 않는다"·"metrics 미주입이어도 죽지 않는다(optional DI)"
  두 테스트가 "실패 시에만 오른다"는 계약의 반대 방향(거짓 알람·배선 누락 시 크래시)까지
  명시적으로 고정한다.
- `business-metrics.service.spec.ts` 신규 2건(`recordRedisFailOpen` 직접 호출 단언 + 타입
  캐너리)이 이전 라운드(`08_36_21`)가 지적한 "서비스 구현 자체를 실행하는 테스트가 없다"
  WARNING 을 정확히 메운다 — 인터셉터 쪽은 `{ recordRedisFailOpen: jest.fn() }` 스텁만
  쓰므로 이 신규 테스트가 없었다면 `add()` 인자 실수·no-op화가 어느 테스트에도 안 잡혔을
  것이다.
  - 타입 캐너리(`@ts-expect-error` 2곳 + `toHaveBeenCalledTimes(2)`)는 `ts-jest` 가 타입을
    strip 한다는 사실을 스스로 docstring 에 명시하고, 실제 감시자가
    `scripts/check-backend-typecheck-ratchet.py`(파일별 진단 수를 baseline 과 **양방향** 대조)
    임을 정확히 지목한다 — 직접 확인한 결과 이 스크립트는 `tsconfig.json`(spec 포함)을 쓰고
    `.github/workflows/backend-checks.yml`/`harness-checks.yml` 양쪽에 실제로 배선돼 있어,
    "라벨이 다시 `string` 으로 넓어지는" 역행 회귀를 CI 가 잡을 실제 경로가 있음을 확인했다.
- 기존 회귀 테스트(캐시 히트/§R8 키 스코프 등)는 생성자 4번째 인자가 `@Optional()` 로만
  추가돼 전부 그대로 유효하다 — `npx jest` 실측 57/57 통과로 재확인.

## 요약

이번 라운드(`10_13_11`)는 소스 코드 자체가 직전 라운드(`09_57_11`) 이후 변경되지 않은 상태의
재검토다. 직전 두 라운드가 낸 WARNING 5건(JSDoc 위치, SPEC-DRIFT, 서비스 단위 테스트 부재,
타입 미강제, 헬퍼 네이밍/리터럴 반복)과 이후 라운드가 낸 INFO 3(타입 좁힘의 영구 회귀 가드
부재)까지 전부 코드·테스트에서 실제로 해소됐음을 직접 파일을 열어 재확인했고, 관련 스펙
2개 파일을 `npx jest` 로 직접 실행해 57/57 GREEN 을 재실측했다. 새로 발견한 CRITICAL/WARNING
은 없다. 남는 것은 두 건의 INFO — (1) 직전 라운드에서 이미 지적된 채 미조치로 남은 1틱 대
2틱 `Promise.resolve()` 근거 부재, (2) `recordRedisFailOpen()` 호출 자체가 던지는 경우를
검증하는 방어적 테스트가 없다는 것 — 인데 둘 다 즉시 조치가 필요한 수준은 아니다.

## 위험도

NONE
