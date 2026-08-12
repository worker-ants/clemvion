# 동시성(Concurrency) 코드 리뷰

## 검증 방법

프롬프트 diff 는 이전 세 리뷰 라운드(`14_27_02`→`14_50_36`→`15_04_25`)의 산출물과 코드 fix 가
누적된 것이라, 텍스트를 그대로 신뢰하지 않고 현재 HEAD(`7072a1ac0`) 기준 작업 트리를 직접 열어
재검증했다.

- `git log --oneline -5 -- .../idempotency.interceptor.ts` → `f933f2cf6`·`5d79dc123` 확인,
  `git status --porcelain` → `review/code/2026/08/12/15_16_16/` 외 변경 없음(clean).
- `Read` 로 `idempotency.interceptor.ts` 전문 확인 — `catchError`(107행)가 `switchMap`(113행)
  **앞**에 정확히 위치. 과거 라운드에서 documentation 리뷰어가 보고했던 "순서 역전" CRITICAL(공유
  워크트리 뮤테이션 아티팩트로 확정됨)은 이번에도 재현되지 않는다.
- `grep`으로 `idempotency.interceptor.spec.ts` 확인 — 세 번째 describe(`Redis 런타임 장애
  fail-open`)에 `get()` reject 테스트가 이제 `warnSpy`로 `cache GET 실패` 문자열까지 단언한다
  (최신 커밋 `7072a1ac0`, 직전 라운드 INFO 6 조치 반영 확인). `set()` reject 테스트와 대칭 확보.

## 발견사항

- **[WARNING]** fail-open 이 `Idempotency-Key` 중복 억제를 Redis 장애 구간 전체로 확대한다 —
  기존 3라운드에서 반복 확인된 항목, 이번 라운드에서도 코드 상태 재확인
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:67-72`
    (클래스 docstring, "fail-open 의 대가"), `:98-112`(신규 `catchError`), `:174-180`
    (`cacheTapped()` 내 `void this.redis.set(...).catch(...)`, 이번 PR 로 미변경된 기존 코드)
  - 상세: `catchError` 가 `get()` 런타임 reject 를 캐시 미스(`of(null)`)로 강등해 spec
    (`spec/data-flow/15-external-interaction.md` "전 경로 fail-open — 가용성 우선")이 요구하는
    가용성을 만족시킨다 — 방향은 타당하고 구현도 정확하다(`catchError`가 `switchMap` 상류에만
    걸려 `ConflictException` 을 삼키지 않음, 캐너리 테스트로 고정). 다만 GET(조회)과 SET(적재)
    사이에는 원자적 CAS/락이 없어(`SET NX` 미사용, 선재 구조), 평시에는 두 요청이 캐시 응답
    왕복시간 이내(수 ms)에 동시 도착해야만 둘 다 캐시 미스를 관측하는 좁은 경쟁 창이었던 것이,
    이번 fix 이후에는 **Redis 장애가 지속되는 동안 도착하는 모든 요청**이 타이밍과 무관하게
    무조건 캐시 미스 분기를 타 다운스트림(execution 생성 등)이 중복 실행될 위험이 실질적으로
    커진다.
  - 제안: 코드 변경 불요 — spec 이 명시적으로 승인한 가용성 우선 트레이드오프이며, 클래스
    docstring·`CHANGELOG.md`·`plan/in-progress/backend-lint-gate-broken-on-main.md` 백로그
    (Redis GET 실패율 관측 지표, `SET NX EX` 선점 또는 in-flight dedup 검토)에 이미 문서화·
    추적 중이다. 이 항목은 3라운드 연속 동일하게 확인됐고 매 라운드 "코드로 되돌릴 필요 없음"
    으로 판정돼 왔다 — 이번 라운드도 그 판정을 유지한다. 실제 관측 인프라 도입 전까지는
    운영이 장애 구간을 인지할 수단이 없다는 점만 잔여 리스크로 남는다(백로그 추적 중, 이
    PR 스코프 아님).

- **[INFO]** GET→SET 비원자 구간은 선재 구조이며 이 diff 의 신규 결함이 아니다
  - 위치: `idempotency.interceptor.ts:98`(`from(this.redis.get(redisKey))`)와
    `:174-180`(`cacheTapped()`의 `void this.redis.set(...)`)
  - 상세: `SET NX`(원자적 "미존재 시 선점")가 아니라 GET 후 별도 SET 이라, 정상 동작 시에도
    두 요청이 캐시 왕복 시간 이내에 동시 도착하면 둘 다 캐시 미스로 판정될 수 있다. 위
    WARNING 은 이 기존 갭이 fail-open 으로 인해 "장애 시" 노출 폭이 넓어진다는 것을 지적하는
    것이고, 이 항목 자체는 신규가 아니다.
  - 제안: 이미 plan 백로그에 등재됨(`SET NX EX` 또는 in-flight dedup 검토). 추가 조치 불요.

- **[없음 — 확인]** `catchError` 위치는 정확하며 회귀 테스트로 고정됨
  - 위치: `idempotency.interceptor.ts:107`(catchError) / `:113`(switchMap) — `Read`로 직접
    재확인, `git status`/`git diff` clean.
  - 상세: RxJS `catchError`는 상류(`from(get())`)의 에러만 잡고, `switchMap` 프로젝션 함수
    내부에서 던지는 `ConflictException`(하류)은 잡지 않으므로 배치가 정확하다.
    `idempotency.interceptor.spec.ts` 의 "fail-open 이 409 충돌까지 삼키지 않는다 — catchError
    위치 캐너리" 테스트가 이를 회귀 고정한다. 과거 라운드에서 다른 리뷰어가 보고한 "순서 역전"
    CRITICAL 은 공유 워크트리 뮤테이션 아티팩트였음이 이미 확정됐고, 이번 재확인으로도 코드에
    그 결함이 없음을 재차 확인했다.

- **[없음 — 확인]** GET/SET 두 fail-open 경로의 warn 로그가 이제 테스트로 대칭적으로 고정됨
  - 위치: `idempotency.interceptor.spec.ts` — `` it('`get()` 이 reject 해도 요청은 통과하고
    warn 을 남긴다 (fail-open)', ...) ``(354행 부근 describe 내 첫 테스트)가 `warnSpy` 로
    `cache GET 실패` 문자열까지 단언한다. 직전 라운드(`15_04_25`)가 INFO 로 지적한 "GET 경로만
    warn 미검증(SET 과 비대칭)" 이 최신 커밋(`7072a1ac0`)에서 실제로 해소됐다.
  - 상세: fail-open 은 "요청을 살린다"와 "장애를 관측 가능하게 한다"가 한 쌍인데, warn 단언이
    빠지면 `catchError` 콜백에서 `logger.warn` 한 줄만 조용히 삭제해도 테스트가 GREEN 을 유지해
    관측 회귀를 못 잡는다. 이제 GET/SET 양쪽 다 그 뮤턴트를 잡는다.

- **[없음 — 확인]** 데드락·스레드 세이프티·이벤트 루프 블로킹·리소스 풀 문제 없음
  - `from(promise)` → RxJS Observable 변환, `void redis.set(...).catch(...)`(fire-and-forget
    이나 `.catch()` 로 unhandled rejection 방지)는 기존 패턴 그대로다. Node.js 단일 이벤트
    루프 + RxJS 파이프라인만 존재해 락/세마포어 조합에 의한 데드락 표면이 없다. 신규 Redis
    커넥션을 생성하지 않고 기존 공유 provider/injected client 를 재사용하므로 커넥션 풀 크기·
    관리에 영향 없음. 신규 테스트(`describe('IdempotencyInterceptor (Redis 런타임 장애
    fail-open)')`)는 각 `it` 마다 독립 `makeRedis()`/`makeInterceptor()` 를 생성하고
    `jest.spyOn(Logger.prototype, 'warn')` 은 `try/finally` 로 매번 복원해 테스트 간 공유
    가변 상태·전역 오염이 없다.

## 요약

이번 diff 의 핵심 프로덕션 변경(`IdempotencyInterceptor`의 Redis `get()` 런타임 실패를
`catchError` 로 캐시 미스로 강등)은 3라운드째 동일하게 검증돼 왔고, 이번 라운드에서 HEAD
(`7072a1ac0`) 기준 코드를 직접 열어 재확인한 결과 상태가 정확하다 — `catchError` 는 `switchMap`
상류에 정확히 위치해 `ConflictException` 검출을 삼키지 않고, GET/SET 양쪽 fail-open 경로의 warn
로그가 이제 테스트로 대칭 고정돼 있다. 데드락·스레드 세이프티·이벤트 루프 블로킹·리소스 풀 관점의
결함은 없다. 유일한 실질 동시성 함의는 fail-open 이 GET→SET 비원자 구조(선재)와 결합해 Redis
장애 지속 구간 동안 같은 `Idempotency-Key` 재요청의 중복 억제를 사실상 무력화하고 다운스트림
중복 실행 위험을 좁은 타이밍 창에서 장애 전체 구간으로 넓힌다는 점인데, 이는 spec 이 명시적으로
승인한 가용성 우선 트레이드오프이고 docstring·`CHANGELOG.md`·plan 백로그(관측 지표,
`SET NX EX`/in-flight dedup 검토)로 이미 문서화·추적 중이다. 3라운드 연속 같은 판정(코드 변경
불요)이 유지되며, 이번 라운드가 새로 만든 동시성 결함은 없다.

## 위험도

MEDIUM
