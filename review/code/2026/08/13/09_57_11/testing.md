# 테스트(Testing) 리뷰 — `clemvion.redis.fail_open` 카운터 (재검토, 08_36_21 후속)

이 세션은 직전 리뷰(`08_36_21`)의 testing WARNING("`recordRedisFailOpen()` 자체를 검증하는
단위 테스트 부재")에 대한 조치를 재확인하는 라운드다. 실제 조치가 됐는지 코드를 직접 읽고,
jest 를 로컬 실행하고, 뮤테이션 1건을 직접 주입/원복해 변별력을 실측했다.

## 발견사항

- **[INFO]** `it.each` 블록이 4개 케이스(GET 실패·SET 실패·엔트리 손상·payload 손상)에
  `await Promise.resolve()` **두 틱**을 일괄 적용하는데, 같은 파일의 기존 "SET 실패" 단언
  (fire-and-forget `.catch()` 완료 대기)은 **한 틱**만 쓴다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:1107-1108`
    (신규, 두 틱) vs `:944` (기존 "`set()` 이 reject 해도 응답 정상 + warn 로그" 테스트, 한 틱)
  - 상세: 인터셉터의 SET 실패 경로(`idempotency.interceptor.ts` — `.set(...).catch((err) => { warn; recordRedisFailOpen; })`)는 기존 테스트와 구조가 동일해 이론상 한 틱으로 충분하다. GET 실패·엔트리 손상·payload 손상 세 케이스는 애초에 `lastValueFrom` 이 resolve 되는 시점에 이미 `recordRedisFailOpen` 호출이 끝나 있어 추가 틱이 필요 없다. 두 틱을 4개 케이스에 공통 적용한 것은 틀린 것은 아니지만(더 관대한 대기는 실패를 만들지 않는다), 왜 기존 관례(1틱)와 다른 값을 썼는지 근거가 코드에 없다 — 향후 SET 실패 체인에 마이크로태스크 hop 이 하나 더 늘어야만 통과하는 상태가 됐는데도 아무도 알아채지 못할 수 있다.
  - 제안: 주석으로 "2틱이 필요한 이유"를 명시하거나, 기존 1틱 관례에 맞춰 통일. 우선순위는 낮음(현재 통과, 실패를 만들지 않는 방향의 여유).

- **[INFO]** "닫힌 집합" 타입 좁히기(`RedisFailOpenComponent`/`RedisFailOpenReason`)의 **역방향
  회귀**(미래에 다시 `string` 으로 넓어지는 것)를 잡을 자동화된 테스트/게이트가 없다.
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:38-46` (타입 선언),
    `:134-136` (시그니처)
  - 상세: `RESOLUTION.md`(`review/code/2026/08/13/08_36_21/RESOLUTION.md`)는 이 좁힘이 실제로
    컴파일러를 막는지 일회성 `tsc --noEmit` 프로브로 확인했다고 적었고, 그 프로브 파일은 이미
    삭제됐다 — 즉 지금 저장소에는 이 계약을 지키는 **영구** 테스트가 없다. `*.spec.ts` 는
    `nest build`(tsconfig.build.json 이 exclude)와 jest(`ts-jest`가 타입을 strip)
    어느 쪽으로도 타입체크되지 않는다(`scripts/check-backend-typecheck-ratchet.py` 자체
    docstring 이 이 사각지대를 명시). 이 저장소가 그 사각지대를 메우려고 도입한
    `scripts/check-backend-typecheck-ratchet.py`(CI: `.github/workflows/backend-checks.yml`)도
    이 특정 회귀는 못 잡는다 — ratchet 은 **파일별 진단 개수**의 증가/감소만 비교하는데, 두
    유니온 타입을 `string` 으로 되돌려도 현재 호출부 4곳은 전부 유효한 리터럴만 쓰고 있어
    진단이 이전에도 0건·이후에도 0건이라 개수가 변하지 않는다(직접 로직 확인:
    `scripts/check-backend-typecheck-ratchet.py:176-181` 의 `increased`/`decreased` 비교는
    개수 비교이지 "이 타입이 특정 리터럴 유니온인가"를 보지 않는다). WARNING 5 가 원래 잡으려던
    문제("문서화된 보장이 구현보다 넓다")를 코드 계약으로 옮긴 것은 옳은 방향이지만, 그 계약
    자체가 다시 느슨해지는 것을 감지할 안전망은 여전히 없다.
  - 제안: 우선순위 낮음(현재는 개선된 상태이고 당장 위험은 없음). 필요하면
    `RedisFailOpenReason` 에 대한 최소 타입 단언 테스트(예: `// @ts-expect-error` 를 쓰는
    타입 전용 fixture, 단 `*.spec.ts` 는 타입체크되지 않으므로 별도 `.ts`(build 대상) 파일이
    필요) 또는 코드 리뷰 체크리스트에 "이 유니온을 넓힐 때는 `_product-overview.md` §NF-OB-07
    표도 함께" 라는 룰이 이미 `spec/data-flow/9-observability.md`(§`component` rationale)에
    적혀 있으니 그것으로 충분하다고 판단해도 무방.

## 테스트 강점 (검증됨)

- **`recordRedisFailOpen()` 자체 단위 테스트 신설** — 직전 라운드 WARNING("인터셉터 쪽은
  `{ recordRedisFailOpen: jest.fn() }` 스텁만 쓰므로 서비스 구현 자체는 어떤 테스트도 실행하지
  않는다")이 실제로 해소됐다. `business-metrics.service.spec.ts:67-73`(단일 호출 라벨 검증),
  `:75-88`(`entry_corrupt`/`payload_corrupt` 두 손상 갈래가 **호출 순서대로 각기 다른 라벨**을
  내는지 `toHaveBeenNthCalledWith` 로 검증)이 mock meter(`makeMockMeter`, 파일 내
  `createCounter`/`add` 캡처)를 통해 서비스 **본문**을 실제로 실행한다.
  프로젝트 메모(`feedback_mutation_coverage_multiarm_operators.md`)가 지적하는 "삼항/유니온
  분기는 양쪽에 다른 값을 넣어야 뒤바뀜을 잡는다" 패턴을 정확히 따른다.
- **뮤테이션 변별력 직접 재현** — `idempotency.interceptor.ts` 의
  `what === '엔트리' ? 'entry_corrupt' : 'payload_corrupt'` 삼항을 `'entry_corrupt'` 상수로
  뭉개는 뮤턴트를 주입해 실행한 결과, `idempotency.interceptor.spec.ts` 의
  `payload 손상 → reason=payload_corrupt` 케이스가 정확히 RED 로 떨어지는 것을 직접
  확인했다(`Expected: "idempotency","payload_corrupt" / Received: "idempotency","entry_corrupt"`).
  뮤테이션 원복 후 `git status` clean 확인. `RESOLUTION.md` 가 주장한 "뮤턴트 5/5 사살"
  주장 중 핵심 갈래(entry/payload 뭉갬) 하나는 재현으로 뒷받침됨.
- **인터셉터 쪽 신규 describe(`fail-open 관측 (metrics)`, `idempotency.interceptor.spec.ts:1049`)**
  가 5개 reason 전량(`it.each`, `:1065`) + "정상 경로에서는 카운터가 오르지 않는다"(`:1140`,
  거짓 알람 방지) + "metrics 미주입이어도 죽지 않는다"(`:1152`, `@Optional()` DI 안전성)를
  모두 커버한다. 실패 시에만 오른다는 계약의 양방향(오른다/안 오른다)을 다 고정한 점이 좋다.
- **테스트 격리** — 신규 테스트 전부 `try { ... } finally { warnSpy.mockRestore(); }` 로
  `Logger.prototype.warn` 스파이를 복원한다. `business-metrics.service.spec.ts` 는
  `beforeEach`(mock meter 재생성)/`afterEach(jest.restoreAllMocks())` 로 테스트 간 상태 공유가
  없다. 로컬 실행 결과 두 스펙 파일 합계 **56/56 통과**, 순서 무관 재실행 확인.
- **JSDoc-describe 인접성 복원 확인** — 직전 라운드 WARNING 1·2(신규 describe 삽입이 남의
  JSDoc 을 가로챔)가 실제로 해소됐다. 헤더 docstring 이 "네 번째 describe 는 fail-open
  관측(metrics)", "다섯 번째 describe 는 캐시 키 스코프" 로 정정됐고
  (`idempotency.interceptor.spec.ts:34-46`), 신규 블록은 "Redis 런타임 장애 fail-open"
  describe 바로 뒤, "캐시 키 스코프" JSDoc 바로 앞에 위치해 1:1 대응이 복원됐다.
- **회귀 안전성** — `IdempotencyInterceptor` 생성자에 `@Optional() metrics?: BusinessMetricsService`
  4번째 인자가 추가됐지만 기존 5곳의 `new IdempotencyInterceptor(...)` 호출(3-인자)은 전부
  그대로 유효함을 직접 확인(`idempotency.interceptor.spec.ts:176, 188, 210, 222, 236` 등) —
  포지셔널 충돌 없음.
- **Mock 적절성** — `business-metrics.service.spec.ts` 의 `makeMockMeter()` 는 실제 OTel
  `Meter` 인터페이스의 `createCounter`/`createObservableGauge` 만 필요한 만큼 가볍게 흉내 내고
  이름별 instrument 를 딕셔너리로 캡처하는 방식이라 과도한 mock 이 아니다. 인터셉터 쪽
  `{ recordRedisFailOpen: jest.fn() }` 스텁은 "인터셉터가 올바른 인자로 서비스를 호출하는가"만
  보는 것이 목적이라 적절한 경계(서비스 내부 구현은 별도 스펙 파일이 담당) — 두 파일이
  책임을 나눠 가진 형태로 중복 없이 전체 계약을 커버한다.

## 요약

직전 라운드에서 지적된 핵심 테스트 갭("`recordRedisFailOpen()` 서비스 본문 자체가 어떤
테스트로도 실행되지 않는다")은 `business-metrics.service.spec.ts` 에 2건의 신규 테스트로
실제로 해소됐고, 뮤테이션 재현으로 변별력도 확인했다. 인터셉터 쪽 5-reason 전량 커버 +
정상 경로 미증가 + optional DI 안전성 테스트, JSDoc-describe 인접성 복원도 모두 실측
확인됐다. 남은 것은 우선순위 낮은 INFO 2건 — (1) 신규 `it.each` 의 2틱 대기가 기존 1틱
관례와 다른데 근거 주석이 없음, (2) "닫힌 집합" 타입 좁힘이 향후 다시 `string` 으로
느슨해지는 것을 감지할 영구 테스트/게이트가 없음(기존 tsc ratchet 은 진단 개수 변화만
보므로 이 회귀 형태는 구조적으로 놓친다). 둘 다 지금 당장의 결함은 아니다.

## 위험도
LOW
