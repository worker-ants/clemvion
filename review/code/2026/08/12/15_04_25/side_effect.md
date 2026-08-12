# 부작용(Side Effect) 리뷰 결과

## 검증 방법

프롬프트에 실린 diff/컨텍스트는 크기 제한으로 일부 파일이 잘려 있어, 실제 소스를
직접 `Read` 로 열어 현재 커밋 상태를 재확인했다:

- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — 전체 열람.
  `catchError` 는 107행, `switchMap` 은 113행으로 **`catchError` 가 `switchMap` 앞**에 정확히
  위치한다 (직전 두 라운드(`14_27_02`/`14_50_36`) documentation 리뷰어가 보고했던 "순서 역전"
  CRITICAL 은 공유 워크트리 뮤테이션 아티팩트였다는 그쪽 판정이 이번 독립 재확인으로도
  다시 확인됨 — 현재 워킹 트리는 이 diff 와 일치).
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` —
  신규 `describe('IdempotencyInterceptor (Redis 런타임 장애 fail-open)', ...)` 블록 전체 열람.
- `git status --porcelain` → `review/code/2026/08/12/15_04_25/`(이번 리뷰 세션 산출물)만
  untracked, `codebase/backend/**` 에 unstaged 변경 없음.

## 발견사항

- **[WARNING]** `catchError` 로 인한 fail-open 이 Redis 장애 구간 동안 **다운스트림 부작용의
  중복 실행 창을 넓힌다** (concurrency 관점과 겹치지만 "부작용의 중복 발생"이라는 side-effect
  본연의 관점에서도 유효한 지적)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:98-112`
    (신설 `catchError` 블록), `:157-186`(`cacheTapped()`, 이 diff 로 미변경 — GET→SET 비원자
    구조는 선재)
  - 상세: `catchError` 가 `redis.get()` reject 를 캐시 미스(`of(null)`)로 강등하면, 그 이후
    파이프라인은 `switchMap` → `next.handle()` 을 그대로 태운다. `next.handle()` 은 이
    인터셉터 바깥의 실제 핸들러(예: execution 생성 등 상태 변경을 수반하는 로직)를 호출하는
    자리이므로, Redis 가 응답하지 않는 동안 **같은 `Idempotency-Key` 로 오는 재요청이 전부**
    `next.handle()` 을 다시 태워 다운스트림 부작용이 여러 번 발생할 수 있다. 이 diff 이전에는
    같은 GET→SET 비원자 구조라도 "동시 도착 시 응답 왕복 시간(수 ms) 이내" 라는 좁은 창에서만
    이 일이 벌어졌는데, 이제는 **Redis 장애가 지속되는 전체 구간**으로 그 창이 넓어진다.
  - 판단: 코드 결함이 아니다 — `spec/data-flow/15-external-interaction.md` 가 "전 경로
    fail-open (warn) — 가용성 우선" 을 명시적으로 요구하고, 이 트레이드오프는 클래스
    docstring(`idempotency.interceptor.ts:67-72`)·`CHANGELOG.md`·
    `plan/in-progress/backend-lint-gate-broken-on-main.md` 세 곳에 이미 명시적으로 기록·
    유예되어 있다(관측 지표 추가는 백로그). 되돌릴 필요는 없으나, side-effect reviewer 관점의
    본질적 지적이라 이번 라운드에도 독립적으로 재확인해 기록한다.
  - 제안: 이미 취해진 문서화·백로그 조치로 충분. 관측(Redis GET 실패율 알람)이 실제 구현되기
    전까지는 운영이 이 구간에서 다운스트림 중복 실행 가능성을 사후에만 인지한다는 점만 참고.

- **[INFO]** GET 실패가 새로운 로그 이벤트(`this.logger.warn`)를 발생시킨다 — 관측 가능성
  변화, 부작용 자체의 위험은 아님
  - 위치: `idempotency.interceptor.ts:107-111` (`catchError` 내부 `this.logger.warn(...)`)
  - 상세: 이 diff 이전에는 `get()` 이 reject 하면 예외가 그대로 스트림을 타고 흘러 요청이
    500 이 됐다(별도 warn 로그 없이 Nest 전역 예외 필터/로그로 노출). 이제는 `catchError` 가
    예외를 흡수하며 `warn` 레벨 로그 한 줄만 남기고 요청은 정상 처리된다. 이는 의도된 신규
    로깅 부작용이며, 스택 트레이스 대신 `err.message` 한 줄만 남기므로 관측 정보가 다소
    줄어든다는 점만 참고.
  - 제안: 조치 불요. 관측 지표(백로그)가 이 갭을 보완할 예정.

- **[INFO]** 신규 테스트가 `Logger.prototype.warn` 을 스텁하지만 `try/finally` 로 안전하게
  복원해 전역 오염이 없다
  - 위치: `idempotency.interceptor.spec.ts:428-450` (`` `set()` 이 reject 해도 응답 정상 +
    warn 로그 `` 테스트)
  - 상세: `jest.spyOn(Logger.prototype, 'warn').mockImplementation()` 은 클래스 프로토타입을
    직접 건드리는 전역성 뮤테이션이지만, `try { ... } finally { warnSpy.mockRestore(); }` 로
    테스트 종료 시(assert 실패 포함) 항상 복원된다. 다른 신규 테스트들도 각자 `makeRedis()` 로
    독립 mock 을 생성해 테스트 간 상태 공유가 없다.
  - 제안: 없음 — 확인 목적으로만 기록. 좋은 패턴.

- **[INFO]** 시그니처·공개 인터페이스·환경 변수·네트워크 호출 표면에는 변화 없음
  - `intercept()` 메서드 시그니처, 생성자 파라미터 순서·개수, export 되는 심볼
    (`IdempotencyInterceptor`, `IDEMPOTENCY_HEADER`) 모두 이 diff 로 변경되지 않았다.
  - 신규 네트워크 호출 없음 — 기존 `this.redis.get()` 호출의 에러 처리 경로만 추가됐다.
  - `process.env`/`ConfigService` 접근 패턴 변경 없음.

- **[INFO]** `review/code/2026/08/12/{14_27_02,14_50_36}/*` 신규 파일 다수(RESOLUTION.md·
  SUMMARY.md·개별 reviewer 산출물·`meta.json`·`_retry_state.json`)가 이 diff 에 포함
  - 상세: 프로젝트 관례상 `review/**` 는 SoT 는 아니지만 커밋 대상이며(`CLAUDE.md` 저장 위치
    표), 이번 fix 의 자체 리뷰·수정 이력을 남기는 정상적인 review-fix 워크플로 산출물이다.
    프로덕션 코드나 설정에 영향을 주는 파일이 아니므로 부작용 관점에서 문제 없음.
  - 제안: 조치 불요.

## 요약

핵심 변경은 `IdempotencyInterceptor.intercept()` 의 RxJS 파이프라인에 `catchError` 연산자
하나를 `from(this.redis.get(...))` 직후·`switchMap` 이전에 삽입해, Redis 캐시 조회 런타임
실패를 캐시 미스로 강등시키는 fail-open 을 완성한 것이다. 직접 소스를 열람해 재확인한 결과
`catchError` 위치는 정확하고(`switchMap` 앞), 함수/클래스 시그니처·공개 인터페이스·환경
변수·신규 네트워크 호출에는 변화가 없다. 전역 변수 도입이나 테스트 간 상태 누수도 없다(신규
`Logger.prototype.warn` 스텁은 `try/finally` 로 안전하게 복원됨). 유일하게 실질적인 부작용은
Redis 장애가 지속되는 동안 같은 `Idempotency-Key` 재요청이 전부 다운스트림(`next.handle()`)을
다시 태워 부작용이 중복 실행될 수 있다는 점인데, 이는 spec 이 명시적으로 요구한 가용성 우선
트레이드오프이고 이미 클래스 docstring·`CHANGELOG.md`·plan 백로그로 문서화·추적되어 있어
WARNING 으로 재확인만 하고 조치를 요구하지 않는다. 새로운 `logger.warn` 로그 이벤트 발생과
신규 review 산출물 다수 추가는 의도된 것으로 위험 없음.

## 위험도

LOW
