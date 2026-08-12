# 요구사항(Requirement) Review

## 배경 — 이 리뷰가 다루는 상태

이 diff(`origin/main...HEAD`, 7 commit)는 `eia-r8-cache-scope` 작업의 **최종 상태**다. 같은
worktree 안에 이미 5회의 `/ai-review` 라운드(`16_29_45`→`18_07_36`)와 1회의 `/consistency-check`
(`18_27_29`)가 순차로 돌며 CRITICAL 1건(dead code — 409/410이 error 채널이라 `tap({next})`
만으로는 도달 불가)과 WARNING 다수(2xx 직렬화 실패 시 500 대체·5xx 가드 우회 테스트·410
replay/e2e 누락·plan 사후기록 누락 등)를 전부 조치했다. 본 라운드는 그 최종 결과물에 대한
독립 재검증이며, `git log -S`/`Read`/실제 `jest` 실행으로 액면가 문서 서술을 재확인했다.

## 검증 절차

- `spec/5-system/14-external-interaction-api.md` §R8 원문(L1053-1059)과
  `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` 의
  `isErrorStatusCacheable`(L255-257)·`cacheTapped`(L163-203)·`intercept`(L88-150) 를 line-level 로
  대조.
- `spec/data-flow/15-external-interaction.md` L258 캐비트 삭제가 §R8 SoT 와 정합하는지 확인.
- `idempotency.interceptor.spec.ts`(25 tests) 를 실제로 실행 — **25/25 pass**.
- `codebase/backend/test/external-interaction.e2e-spec.ts` 의 `IDEM-1/2/3` 이 실제 파이프라인
  (Guard→Controller→Service→Interceptor→GlobalExceptionFilter) 경로로 409/400/410 을 행사하는지
  코드로 확인.
- `CHANGELOG.md` 의 사실 주장(원 결함 도입 시점 `2026-05-21`, `requestId` 비재현) 을
  `git log --follow --diff-filter=A` 및 `common/filters/http-exception.filter.ts` 로 직접 검증.
- `app.module.ts` 의 global `TransformInterceptor`(`{data: ...}` wrapping) 가 method-scoped
  `IdempotencyInterceptor` 보다 바깥쪽에서 도는지 확인 — 캐시 적재 시점(`tap` 내부)의 raw value 와
  캐시 재생 시 emit 하는 값이 같은 wrapping 을 거치므로 재현 정합성에 문제 없음.

## 발견사항

- **[INFO]** §R8 원문과 구현이 line-level 로 정확히 일치한다.
  - 위치: `spec/5-system/14-external-interaction-api.md:1055-1059` ↔
    `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:255-257`
    (`isErrorStatusCacheable`), `:172-178`(성공 채널 `2xx` 판정), `:186-201`(error 채널 `catchError`).
  - 상세: §R8 "캐시 대상은 닫힌 목록이다: `2xx`·`409`·`410`" 이 그대로
    `(statusCode>=200&&<300) || statusCode===409 || statusCode===410` 세 갈래로 옮겨졌고, `400
    VALIDATION_ERROR` 제외·`5xx` 미캐시가 각각 독립 테스트(`throw 된 400…`, `throw 된
    5xx(HttpException)…`)로 고정돼 있다. §R8 Rationale 이 경고한 두 축약 오답(`>= 400`,
    `=== 400`) 은 실제로 재실측한 뮤테이션 표(`RESOLUTION.md` `18_07_36`/`ac8dd03ee` 커밋)에서
    각각 다른 테스트로 RED 가 확인됐다. 재실행 결과 `idempotency.interceptor.spec.ts` **25/25
    pass**.
  - 제안: 없음 — 확인용 기록.

- **[INFO]** CHANGELOG 의 두 사실 주장(원 결함 도입 시점·`requestId` 비재현)이 코드/이력과
  정확히 일치함을 직접 검증했다.
  - 위치: `CHANGELOG.md:8` ("2026-05-21 최초 구현부터 있던 결함"), `CHANGELOG.md:28-29`
    (`requestId` 는 재현 대상 아님).
  - 상세: `git log --follow --diff-filter=A -- .../idempotency.interceptor.ts` 로 최초 추가 커밋
    `35ff9c19b`(2026-05-21) 확인. `common/filters/http-exception.filter.ts:45`
    (`const requestId = uuidv4();`) 가 매 `catch()` 호출마다 새로 발급하고, 캐시는
    `err.getResponse()`(§R8 raw payload) 만 저장하므로 재생 시 `code`/`message` 는
    결정적으로 동일 재현되지만 `requestId` 는 항상 새 값이 된다 — CHANGELOG 서술과 정확히
    일치한다.
  - 제안: 없음.

- **[INFO]** `IDEM-1`/`IDEM-3` e2e 가 상태코드만이 아니라 Redis 엔트리 자체(`statusCode`,
  `responseJson`)를 직접 관측해, "캐시 재현" 과 "우연히 같은 조건으로 재처리" 를 실제로
  가른다.
  - 위치: `codebase/backend/test/external-interaction.e2e-spec.ts:418-434`(IDEM-1),
    `:538-541`(IDEM-3).
  - 상세: 코드 주석 자체가 "재요청 전에 nodeId 를 유효하게 바꿔 202 가 나오게 만드는 fixture
    는 예외 경로 적재를 제거한 뮤턴트에서도 e2e 가 그대로 통과했다(실측)" 고 실패 경험을
    적어 뒀고, 현재 fixture(같은 `nodeId` 로 두 번 요청 → 둘 다 409)는 캐시가 없어도 같은
    결과가 나올 수 있는 형태가 아니라 Redis 엔트리 존재/내용을 직접 단언해 두 구현을 가른다.
    (`isErrorStatusCacheable` catchError 블록을 제거하는 뮤턴트를 넣으면 `redis.set` 자체가
    호출되지 않아 `cached` 가 `null` 이 되므로 즉시 RED.)
  - 제안: 없음.

- **[INFO]** (회색지대, 이번 diff 범위 밖) `spec/data-flow/15-external-interaction.md:98` 의
  mermaid 시퀀스 다이어그램이 캐시 적재 주체를 `Svc->>Q`(InteractionService) 로 표기하지만,
  실제 적재는 `IdempotencyInterceptor`(컨트롤러 레벨 인터셉터) 가 수행한다.
  - 위치: `spec/data-flow/15-external-interaction.md:98`.
  - 상세: 이 줄은 이번 diff 의 변경분(`spec/data-flow/15-external-interaction.md` diff는
    L258 캐비트 삭제 1줄뿐 — `git diff origin/main...HEAD -- spec/data-flow/15-external-interaction.md`
    로 확인)이 아니라 선재 서술이다. §R8 은 컴포넌트를 지정하지 않으므로 CRITICAL 대상은 아니고,
    이번 PR 이 만들거나 악화시킨 drift 도 아니다.
  - 제안: 이번 PR 범위에서 조치 불필요. 추후 시퀀스 다이어그램을 다시 손댈 일이 있으면
    `Idem->>Q` 로 정정 권장.

- **[INFO]** 캐시 키가 `executionId`/인증으로 스코프되지 않는 선재 설계(교차 execution 재생
  가능성)는 이미 `plan/in-progress/backend-lint-gate-broken-on-main.md` 및
  `review/code/2026/08/12/18_07_36/RESOLUTION.md` INFO #7·8 에서 식별·유예·우선순위 상향까지
  마쳤다. 이번 diff 가 409/410 캐싱을 dead code 에서 실제 경로로 바꿔 노출 표면을 넓힌 것은
  맞지만, 그 리스크는 이미 앞선 라운드에서 발견되어 문서화됐고 이번 PR 스코프(§R8 닫힌 목록
  정합화) 를 벗어나는 별도 항목으로 이미 triage 됐다. 재차 WARNING 으로 올릴 새로운 근거는
  찾지 못했다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:95`
    (`const redisKey = \`${REDIS_KEY_PREFIX}${rawKey}\`;`).
  - 제안: 조치 불요 (이미 추적 중, 별도 후속 작업 대상).

## 요약

`idempotency.interceptor.ts`/`.spec.ts`/`external-interaction.e2e-spec.ts` 의 최종 상태는 Spec
EIA §R8("캐시 대상은 `2xx`·`409`·`410` 닫힌 목록, `400 VALIDATION_ERROR`·`5xx` 제외")과
line-level 로 정확히 일치하며, `EIA-RL-02`(동일 키 24h 동일 응답 재현)를 실제로 만족시킨다.
이전 5개 리뷰 라운드가 짚은 CRITICAL(dead code)·WARNING(직렬화 500 대체·5xx 가드 우회·410
replay/e2e 누락·plan 사후기록) 은 모두 코드·테스트·spec·plan 네 층에서 확인 가능한 형태로
조치됐고, 단위 테스트 25건을 직접 재실행해 전부 통과함을 재확인했다. `CHANGELOG.md` 의
사실 주장(도입 시점, `requestId` 비재현)도 `git log`/필터 코드로 직접 검증해 정확함을
확인했다. 이번 독립 재검토에서 새로운 CRITICAL/WARNING 은 발견되지 않았고, 남은 항목(캐시 키
미스코프, 시퀀스 다이어그램의 컴포넌트 오귀속)은 모두 이번 diff 범위 밖의 선재 사항으로
이미 문서에 추적·유예돼 있다.

## 위험도

NONE
