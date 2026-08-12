# 부작용(Side Effect) 리뷰 결과 — `15_16_16`

## 검토 범위

`origin/main...HEAD` 기준 실제 프로덕션/테스트 코드 diff는 다음 3개 커밋으로 구성된다(그 외
`review/code/2026/08/12/{14_27_02,14_50_36,15_04_25}/**` 는 과거 라운드 산출물의 스냅샷이며
이번 라운드가 새로 만든 부작용이 아니므로 검토 대상에서 제외):

- `5d79dc123` — `idempotency.interceptor.ts` 에 `catchError` 삽입 (fail-open 본체)
- `f933f2cf6` — 클래스 docstring 확장(대가 명시) + `CHANGELOG.md` + spec.ts 테스트 보강
- `1fb233eca`, `7072a1ac0` — `idempotency.interceptor.spec.ts` 단언만 추가, 프로덕션 코드 미변경

## 발견사항

- **[INFO]** `catchError` 가 `redis.get()` 에서 발생하는 **모든** 예외를 원인 구분 없이 캐시 미스로 강등한다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:107-112` (`catchError` 콜백, `intercept()` 내부)
  - 상세: `catchError((err: unknown) => { this.logger.warn(...); return of(null); })` 는 Redis 연결 장애·타임아웃뿐 아니라 `redisKey` 조립이나 클라이언트 설정 등 프로그래밍 버그로 인한 예외까지 동일하게 삼켜 조용히 "캐시 미스"로 처리한다. 종전에는 이런 예외가 그대로 500 으로 드러났다. `spec/data-flow/15-external-interaction.md` 의 "전 경로 fail-open" 요구를 그대로 구현한 것이라 의도된 설계이지만, 원인 종류를 구분하지 않는다는 점은 부작용 관점에서 인지해 둘 필요가 있다.
  - 제안: 조치 불요(spec 의도). 향후 Redis 이외의 원인으로 이 경로가 자주 타면 로그를 모니터링해 구분할 수 있어야 한다.

- **[INFO]** fail-open 이 활성화되는 동안 외부 API 소비자에게 보이는 인터페이스 동작이 500 → 200(정상 처리)으로 바뀐다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:90-141` (`intercept()`)
  - 상세: 이 인터셉터가 감싸는 것은 External Interaction API 라우트다. Redis 장애 중에는 종전에 클라이언트가 받던 명확한 실패 신호(500)가 사라지고 요청이 정상 처리되며, 같은 `Idempotency-Key` 로 온 재요청도 전부 통과해 다운스트림(예: execution 생성)이 중복 실행될 수 있다. 이는 `intercept()` 시그니처나 공개 API 계약(요청/응답 스키마) 자체의 변경은 아니고 **장애 시 관측 가능한 동작**의 변화다. 이미 클래스 docstring(62-72행)과 `CHANGELOG.md`, `plan/in-progress/backend-lint-gate-broken-on-main.md` §후속에 대가로 명시·추적되어 있고, concurrency 리뷰어가 3라운드에 걸쳐 반복 확인한 뒤 "코드 되돌릴 필요 없음(spec 승인 트레이드오프)"로 이미 닫은 사안이다. 신규 지적 아님 — 정합성만 재확인.
  - 제안: 조치 불요. 관측 지표(Redis GET 실패율 알람) 백로그는 이미 plan 에 등재됨.

- **[INFO]** 테스트의 `jest.spyOn(Logger.prototype, 'warn')` — 전역 prototype 패치이나 격리됨
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:360`, `:440` (각 `it` 블록)
  - 상세: NestJS `Logger` 클래스의 prototype 메서드를 직접 mock 하는 것은 해당 프로세스 내 모든 `Logger` 인스턴스에 영향을 주는 전역 부작용이지만, 두 자리 모두 `try { … } finally { warnSpy.mockRestore(); }` 로 감싸 테스트 종료(성공/실패 무관) 즉시 원복한다. Jest 는 파일 단위로 모듈을 격리하므로 다른 spec 파일로의 누출도 없다. 문제 없음, 참고로만 기록.
  - 제안: 조치 불요.

- **[없음 — 확인]** 시그니처·공개 인터페이스·환경 변수·신규 네트워크 호출·전역 변수 도입 없음
  - `intercept()` 의 파라미터/반환 타입(`Observable<unknown>`), 생성자 시그니처, export 목록(`IdempotencyInterceptor`, `IDEMPOTENCY_HEADER`) 모두 이번 diff 로 변경되지 않았다. `catchError` 는 기존에 이미 호출되던 `this.redis.get(redisKey)` 의 에러 처리 방식만 바꿀 뿐 새로운 Redis 호출이나 외부 서비스 호출을 추가하지 않는다. `process.env` 접근이나 모듈 스코프 `let`/전역 mutable 상태 신설도 없다. `CHANGELOG.md`·`plan/in-progress/backend-lint-gate-broken-on-main.md` 변경은 순수 문서 서술(체크박스 갱신·서술 추가)이며 파일시스템 부작용이라 부를 만한 것은 이 두 파일 자체(리뷰 대상으로 의도된 편집)뿐이다.

## 요약

이번 라운드(`15_16_16`)가 검토하는 실질 코드 변경은 `IdempotencyInterceptor.intercept()` 의 RxJS 파이프라인에 `catchError` 오퍼레이터 하나를 `switchMap` 앞에 삽입해 Redis `get()` 런타임 reject 를 캐시 미스로 강등하는 것이 전부이며, 이후 두 커밋은 테스트 단언 보강만 하고 프로덕션 코드는 건드리지 않았다. 시그니처·공개 인터페이스·환경 변수·신규 전역 상태·신규 네트워크 호출은 없다. 유일한 실질적 부작용은 설계 의도 그 자체 — Redis 장애 중 요청이 500 대신 정상 처리되며 그 대가로 `Idempotency-Key` 중복 억제가 장애 구간 동안 무력화된다는 것 — 인데, 이는 `spec/data-flow/15-external-interaction.md` 가 명시적으로 요구한 가용성 우선 트레이드오프이고 클래스 docstring·`CHANGELOG.md`·plan 백로그에 이미 명시·추적되어 있으며 3차례의 선행 리뷰 라운드가 반복 검증 후 "코드 조치 불요"로 확정했다. 테스트 파일의 `Logger.prototype` 패치는 `try/finally` 로 안전하게 격리된다. 신규 CRITICAL/WARNING 없음.

## 위험도

LOW
