# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[INFO]** `catchError` 가 Redis `get()` 발생 예외 전부를 "캐시 미스"로 강등해 다운스트림 재실행 가능성을 연다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:107` (신규 `catchError` 블록)
  - 상세: `from(this.redis.get(redisKey)).pipe(catchError(...), switchMap(...))` 구조로, GET 이 reject 하면 `of(null)` 을 반환해 캐시 미스로 처리하고 `next.handle()` 을 그대로 실행한다. 그 결과 (1) 연결 장애뿐 아니라 `redisKey` 조립 등 프로그래밍 버그로 인한 예외까지 동일하게 삼켜지고, (2) Redis 장애가 지속되는 동안 같은 `Idempotency-Key` 재요청이 매번 다운스트림(예: execution 생성)을 다시 실행할 수 있다 — 종전에는 이 경로가 500 으로 즉시 실패해 최소한 재실행되지 않았다. 이는 클래스 docstring(`:66-72`) 과 `CHANGELOG.md` 양쪽에 "멱등성은 장애 구간에서 best-effort" 로 명시돼 있고, `spec/data-flow/15-external-interaction.md` 의 "전 경로 fail-open — 가용성 우선" 요구와 정합한다. 직전 리뷰 라운드(`review/code/2026/08/12/14_27_02`)에서 concurrency WARNING #1 로 이미 지적됐고 RESOLUTION 상 "되돌리지 않음(spec 트레이드오프) + 문서화 + 관측 지표는 plan 백로그" 로 처분됐다 — 이번 라운드 diff(docstring 확장, CHANGELOG 신규 섹션, plan 체크박스)가 그 처분을 정확히 반영한다. 새 결함이 아니라 이미 검토·수용된 의도된 부작용이므로 등급을 상향하지 않는다.
  - 제안: 조치 불요(이미 문서화·plan 등재 완료). 후속은 `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 "idempotency fail-open 구간의 관측·중복 억제" 항목이 추적.

- **[INFO]** `catchError` 삽입 위치(`switchMap` 앞)가 `ConflictException` 이벤트 전파를 보존하는지 재확인 — 정상
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:107`(catchError), `:113`(switchMap)
  - 상세: 이 위치가 뒤바뀌면 캐시 히트 시 `switchMap` 내부에서 던지는 `ConflictException`(정상 409 이벤트)까지 `catchError` 가 캐치해 `of(null)` 로 눌러버려 멱등성 충돌 검출이 조용히 죽는다. 현재 커밋 상태(`git diff HEAD` 빈 출력, `catchError` 가 `switchMap` 보다 앞줄)로 직접 재확인했고, 전용 캐너리 테스트(`idempotency.interceptor.spec.ts` "fail-open 이 409 충돌까지 삼키지 않는다")와 뮤테이션 실측(위치를 뒤로 옮기면 신규 3건 + 기존 409 테스트까지 RED)으로 회귀가 고정돼 있다. 직전 라운드에서 documentation 리뷰어가 이 순서가 역전됐다고 CRITICAL 보고했던 사례가 있었으나, 그 원인은 병렬 리뷰 세션이 공유 워크트리를 일시 뮤테이션한 아티팩트였고(`RESOLUTION.md` 상 확정), 현재 커밋 기준으로는 재현되지 않는다.
  - 제안: 조치 불요. 다만 이 저장소가 공유 worktree 뮤테이션으로 인한 리뷰 오탐을 이미 두 차례(직전 라운드 + 그 이전) 겪은 만큼, push 직전 `git diff HEAD` 로 재확인하는 절차(SUMMARY 권장사항 #5)를 유지할 것.

- **[INFO]** 신규 테스트 4건이 `Logger.prototype.warn` 을 스파이하지만 `try/finally` 로 복원해 테스트 간 전역 오염이 없다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:424`("`set()` 이 reject 해도 응답 정상 + warn 로그" 테스트, `warnSpy` 선언·`finally` 블록)
  - 상세: `jest.spyOn(Logger.prototype, 'warn').mockImplementation()` 은 NestJS `Logger` 클래스 prototype 전역을 뮤테이션하는 호출이라 복원을 빠뜨리면 이후 다른 테스트/스위트의 로그 출력·단언에 영향을 줄 수 있다. 여기서는 `try { ... } finally { warnSpy.mockRestore(); }` 로 성공/실패 양쪽 경로 모두 복원을 보장해 안전하다.
  - 제안: 조치 불요. 좋은 패턴이므로 유지.

- **[INFO]** 신규 테스트 5건은 각자 독립 `makeRedis()`/`makeInterceptor()` 인스턴스를 생성해 테스트 간 공유 가변 상태가 없다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` — `describe('IdempotencyInterceptor (Redis 런타임 장애 fail-open)')` 블록 전체(신규 5개 `it`)
  - 상세: `beforeEach` 없이 각 `it` 이 자체 `RedisStub` 을 만들고, 새로 모듈 최상단으로 옮겨진 `bodyHashOf` 는 순수 함수(전역 상태 미참조)라 `describe` 간 이동에도 부작용이 없다.
  - 제안: 조치 불요.

- **[INFO]** `review/code/2026/08/12/14_27_02/**` 12개 파일이 신규 커밋으로 저장소에 편입됨 — 파일시스템 부작용이 아니라 규약상 정상 위치
  - 위치: 파일 5~16 (`RESOLUTION.md`, `SUMMARY.md`, `_retry_state.json`, `meta.json`, 개별 reviewer `*.md` 8건)
  - 상세: CLAUDE.md 규약상 "코드 리뷰 산출물"의 SoT 는 `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 이고 이 디렉터리는 gitignore 대상이 아니다(메모: `feedback_plan_checkbox_actual_state` "review/ 는 gitignored 아님"). `_retry_state.json`/`meta.json` 에 워크트리 절대경로(`/Volumes/project/private/clemvion/...`)가 박혀 있어 이식성은 낮지만 이 프로젝트의 기존 산출물 관례와 동일한 패턴이라 이번 diff 고유의 새로운 부작용은 아니다.
  - 제안: 조치 불요.

## 요약

핵심 프로덕션 변경은 `IdempotencyInterceptor.intercept()` 의 RxJS 파이프라인에 `catchError` 오퍼레이터 하나를 `from(this.redis.get(...))` 직후·`switchMap` 앞에 삽입해 캐시 조회 런타임 실패를 캐시 미스로 강등시키는 것이다(직전 라운드에서 이미 LOW 로 평가된 동일 코드 변경). 이번 diff 는 그 코드 자체를 재변경하지 않고, 직전 리뷰의 WARNING 3건에 대한 처분 — docstring 확장(fail-open 대가 명시), `CHANGELOG.md` 신규 섹션, 테스트 헬퍼 `bodyHashOf` 중복 제거, `set()` 실패·non-Error reject 분기에 대한 신규 테스트 4건 추가, plan 체크박스 갱신 — 만 반영한다. 함수/클래스 시그니처, 공개 인터페이스, 환경 변수 접근, 신규 네트워크 호출은 없다. `catchError`→`switchMap` 순서(캐시 충돌 `ConflictException` 이벤트 보존)를 현재 커밋 기준으로 직접 재확인했으며 정상이다. 신규 테스트는 `Logger.prototype.warn` 스파이를 `try/finally` 로 안전하게 복원하고 인스턴스 격리도 유지한다. Redis 장애 지속 구간에서 다운스트림이 중복 실행될 수 있다는 부작용은 실재하지만 spec 이 승인한 트레이드오프로 이미 문서화·plan 백로그 등재가 완료된 상태이며 이번 diff 가 그 처분을 정확히 반영한다. 새로 발견된 미승인 부작용은 없다.

## 위험도

LOW
