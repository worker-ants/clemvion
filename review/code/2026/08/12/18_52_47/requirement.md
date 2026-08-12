# 요구사항(Requirement) Review

## 배경 — 이 리뷰가 다루는 상태

`origin/main...HEAD` diff(72 파일, `eia-r8-cache-scope` 작업 전체)를 대상으로 했다. 같은
worktree 에서 이미 5회의 `/ai-review` 라운드(`16_29_45`→`18_37_45`)와 1회의
`/consistency-check`(`18_27_29`)가 순차로 돌며 CRITICAL 1건(409/410 캐싱이 RxJS error 채널을
못 보는 dead code)과 WARNING 다수(vacuous mock 테스트 · `400` 만 옛 mock 잔존 · 5xx 가 가드
우회로 통과 · 410 replay/e2e 누락 · 캐시 적재 실패 시 원 예외가 500 으로 대체될 수 있던 결함 ·
plan 사후기록 불이행)를 전부 조치했다. 마지막 커밋(`567c1919d`)은 직전 라운드(`18_37_45`)가
지적한 "plan 에 기록하겠다고 처분해 놓고 실제로 안 적음" + "직렬화-실패 테스트 2건만 warn
단언 누락" 을 조치했다. 본 라운드는 그 최종 상태에 대한 독립 재검증이다.

## 검증 절차

- `spec/5-system/14-external-interaction-api.md` §R8 원문(Rationale, "캐시 대상은 닫힌
  목록이다: `2xx`·`409`·`410`")을 `Read`/`Grep` 으로 직접 열람.
- `idempotency.interceptor.ts` 전체(272줄)를 line-level 로 spec 과 대조.
- `idempotency.interceptor.spec.ts`(25 tests)를 실제 `jest` 로 재실행 — **25/25 pass**.
- `codebase/backend/test/external-interaction.e2e-spec.ts` 의 `IDEM-1/2/3` 을 읽고 실 파이프라인
  (Guard→Controller(`@HttpCode(202)`)→Service(`ConflictException`/`GoneException` throw)→
  Interceptor→GlobalExceptionFilter) 경로와 실제 배선이 일치하는지 확인.
- `interaction.controller.ts`/`interaction.service.ts` 에서 `@HttpCode(HttpStatus.ACCEPTED)`,
  `@UseInterceptors(IdempotencyInterceptor)`, `ConflictException`/`GoneException` throw 지점을
  grep 으로 직접 확인 — 인터셉터 docstring/CHANGELOG 의 주장과 실제 코드가 일치.
- `npx eslint idempotency.interceptor.ts idempotency.interceptor.spec.ts` — 0 errors/warnings.
- `npx tsc --noEmit` 전체 실행 — idempotency 파일 자체는 에러 없음. 남은 tsc 에러(carousel
  handler spec 등)는 `git diff origin/main --stat` 로 확인한 결과 이번 diff 가 건드리지 않은
  무관 파일이라 이 PR 의 회귀가 아니다.
- 최종 backlog 상태(`plan/in-progress/backend-lint-gate-broken-on-main.md:561-568`)에서
  "캐시 엔트리 내부 `responseJson` 손상 무방비" 항목이 실제로 기록돼 있는지 확인 — 있음(직전
  라운드가 "기록하겠다" 처분만 하고 빠뜨렸던 것이 이번 커밋에서 실제로 채워짐).

## 발견사항

- **[INFO]** §R8 원문과 구현이 line-level 로 정확히 일치한다.
  - 위치: `spec/5-system/14-external-interaction-api.md:1055-1059` (R8 Rationale) ↔
    `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:255-257`
    (`isErrorStatusCacheable`, `409`·`410` 판정), `:172-178`(성공 채널 `2xx` 판정, `tap`
    콜백), `:186-201`(`catchError` — error 채널의 409/410 적재).
  - 상세: §R8 "닫힌 목록: `2xx`·`409`·`410`, `400 VALIDATION_ERROR` 만 4xx 중 제외, `5xx` 는
    재시도가 의미 있어 제외" 가 그대로 `(statusCode>=200&&<300) || statusCode===409 ||
    statusCode===410` 세 갈래로 옮겨졌다. spec Rationale 이 경고한 두 축약 오답(`>= 400`,
    `=== 400`)은 각각 독립 뮤테이션으로 재실측돼 있다: `>= 400` 뮤턴트 → `409`·`410` 테스트
    RED, `=== 400` 뮤턴트 → `5xx`·`404` 테스트 RED. `idempotency.interceptor.spec.ts` 를 직접
    재실행해 **25/25 pass** 확인.
  - 제안: 없음 — 확인용 기록.

- **[INFO]** 컨트롤러/서비스 배선이 인터셉터 docstring·CHANGELOG 의 전제와 실제로 일치함을
  코드로 직접 확인.
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.controller.ts:65-66`
    (`@HttpCode(HttpStatus.ACCEPTED)` + `@UseInterceptors(IdempotencyInterceptor)`),
    `codebase/backend/src/modules/external-interaction/interaction.service.ts:253,431`
    (`GoneException({ code: 'EXECUTION_TERMINATED' })`), `:478,505`
    (`ConflictException({ code: 'STATE_MISMATCH' })`).
  - 상세: 인터셉터 JSDoc 이 "성공 경로의 `res.statusCode` 는 `@HttpCode(202)` 로 선고정돼
    `=== 409` 가 성립할 수 없다" 고 주장하는데 실제로 `@HttpCode(HttpStatus.ACCEPTED)` 가
    붙어 있고, "409/410 은 서비스가 throw 한다" 는 주장도 `ConflictException`/`GoneException`
    throw 지점과 정확히 일치한다 — 재설계(성공 채널 `tap` + error 채널 `catchError` 이원화)의
    전제가 실제 배선과 어긋나지 않는다.
  - 제안: 없음.

- **[INFO]** `IDEM-1`/`IDEM-3` e2e 가 상태코드만이 아니라 Redis 캐시 엔트리(`statusCode`,
  `responseJson`) 자체를 직접 관측해, "캐시 재현" 과 "우연히 같은 조건으로 재처리" 를 실제로
  가른다 — 판별력 없는 fixture 였던 1차 시도의 실패 경험이 주석으로 남아 있고, 현재 형태는
  뮤테이션(예외 경로 적재 제거 → `redis.get` 결과 `null` → `expect(cached).not.toBeNull()`
  즉시 RED)으로 실측 확인됐다.
  - 위치: `codebase/backend/test/external-interaction.e2e-spec.ts:418-434`(IDEM-1),
    `:538-541`(IDEM-3), `:492-496`(IDEM-2, 400 미적재).
  - 제안: 없음.

- **[INFO]** 최종 backlog(`responseJson` 손상 무방비)가 실제로 plan 에 반영됨을 확인 — 직전
  라운드가 "기록하겠다" 고 처분만 하고 빠뜨렸던 항목.
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:561-568`.
  - 상세: `intercept()` 의 캐시 히트 경로에서 바깥 JSON(`cachedJson`)은 `try/catch` 로
    손상을 방어하지만, 엔트리 안쪽 `responseJson`(line 137, 143 각각의 `JSON.parse`)이
    손상된 경우는 무방비 — `SyntaxError` 가 그대로 throw 돼 `GlobalExceptionFilter` 가 500 으로
    마스킹한다. 코드로 직접 확인한 결과 이 서술은 정확하다. fail-closed 방향(정보 노출 없이
    500)이고 캐시 SET 이 직접 만든 값만 GET 되므로 손상 경로가 좁아 실질 위험은 낮다 — 백로그
    유예가 합리적이다.
  - 제안: 조치 불요(이미 backlog 로 정확히 추적됨). 향후 착수 시 두 자리의 `JSON.parse` 를
    한 번만 파싱하도록 끌어올리고 그 자리에 방어를 두는 편(plan 서술)이 낫다.

- **[INFO]** (회색지대, 이번 diff 범위 밖) `spec/data-flow/15-external-interaction.md` 의
  mermaid 시퀀스 다이어그램이 idempotency 캐시 적재 주체를 `Svc`(InteractionService)로
  표기하는 것으로 보이나, 실제 적재는 `IdempotencyInterceptor`(컨트롤러 레벨)가 수행한다.
  - 위치: `spec/data-flow/15-external-interaction.md` (이번 diff 는 이 파일에서 §2.2 표
    캐비트 삭제 1줄뿐 — 시퀀스 다이어그램은 diff 밖의 선재 서술).
  - 상세: §R8 은 캐싱을 수행하는 컴포넌트를 지정하지 않으므로 이 misattribution 은 이번 PR 이
    만들거나 악화시킨 drift 가 아니다. `[SPEC-DRIFT]` 로 태깅하지 않는다 — 이번 diff 의 변경
    범위가 아니고, 코드가 spec 을 앞서간 것도 아니라 단지 선재 문서 서술 오류일 가능성이 있는
    정도.
  - 제안: 이번 PR 범위에서 조치 불필요. 추후 이 다이어그램을 다시 손댈 일이 있으면 적재 주체를
    인터셉터로 정정 권장(별도 planner 턴 대상).

- **[INFO]** 캐시 키가 `executionId`/인증 컨텍스트로 스코프되지 않는 선재 설계(교차 execution
  재생 가능성)는 이미 `plan/in-progress/backend-lint-gate-broken-on-main.md` 및 이전 라운드
  RESOLUTION 들(`16_29_45`/`16_53_26`/`17_07_45`)에서 식별·유예·우선순위 상향까지 마쳤다.
  이번 diff 가 409/410 캐싱을 dead code 에서 실제 경로로 바꿔 노출 표면을 넓힌 것은 맞지만
  이미 triage 된 별도 항목이라 재차 WARNING 으로 올릴 새 근거는 없다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:95`.
  - 제안: 조치 불요 — 이미 추적 중.

## 요약

`idempotency.interceptor.ts`/`.spec.ts`/`external-interaction.e2e-spec.ts` 의 최종 상태는
Spec EIA §R8("캐시 대상은 `2xx`·`409`·`410` 닫힌 목록, `400 VALIDATION_ERROR`·`5xx`·그 외
`4xx` 제외")과 line-level 로 정확히 일치하며, 컨트롤러(`@HttpCode(202)`)·서비스
(`ConflictException`/`GoneException`)의 실제 배선도 그 전제를 뒷받침한다. `EIA-RL-02`(동일 키
24h 동일 응답 재현)를 단위 테스트(25/25 pass)와 e2e(Redis 엔트리 직접 관측)로 이중 검증한다.
이전 5개 리뷰 라운드가 짚은 CRITICAL(dead code)·WARNING(vacuous mock·직렬화-500 대체·5xx
가드 우회·410 replay/e2e 누락·plan 사후기록 불이행)은 모두 코드·테스트·spec·plan 네 층에서
확인 가능한 형태로 조치됐다. 남은 항목(캐시 엔트리 내부 손상 무방비, 캐시 키 미스코프)은 모두
plan 백로그에 정확히 기록된 선재 갭으로, 이번 PR 스코프(§R8 닫힌 목록 정합화) 밖의 정당한
유예다. 이번 독립 재검토에서 새로운 CRITICAL/WARNING 은 발견되지 않았다.

## 위험도

NONE
