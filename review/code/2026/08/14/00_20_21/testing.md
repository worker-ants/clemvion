# 테스트(Testing) 리뷰 결과

## 사전 확인

- `codebase/backend/src/common/utils/update-returning-rows.spec.ts`, `assert-row-array.spec.ts`,
  `auth-oauth.service.spec.ts`, `execution-engine.service.spec.ts`,
  `knowledge-base.service.spec.ts` 를 직접 `npx jest` 로 재실행해 모두 GREEN 확인
  (35 / 16 / 505(engine+kb 합) passed).
- `update-returning-rows.spec.ts`·`assert-row-array.spec.ts` 의 구조적 회귀 가드 fixture
  (`EXPECTED = [3,10,0]`, `guards: 1` 등)를 실제 소스에 대해 정규식으로 재계산해 stale 값이
  아님을 확인 — 문서화된 실측치와 일치.
- 8개 `updateReturningRows(...)` 호출부 전수(`auth-oauth` 1·`execution-engine` 2·
  `knowledge-base` 5)가 전부 비어있지 않은 `detail` 컨텍스트 문자열을 넘기는지 grep 으로 확인 — 일치.
- `docker-compose.e2e.yml:153` 에 `OAUTH_STUB_MODE: "true"` 가 설정돼 있어 신규
  `auth-oauth-callback.e2e-spec.ts` 가 외부 OAuth 프로바이더 없이 결정적으로 동작함을 확인.
- `tsc --noEmit` 를 돌려 이 diff 가 새 타입 에러를 유입하지 않았음을 확인(남은 에러는 모두
  diff 밖 pre-existing baseline, `mockExecutionRepo.manager.transaction` 캐스트 에러 포함 — 새
  테스트가 추가되며 줄 번호만 밀렸을 뿐 신규 발생이 아님).

이미 5차례(`20_36_35`~`23_46_00`) ai-review 라운드가 뮤테이션 테스트로 상당 부분을 검증·기록해
두었다. 아래는 그 기록을 재검증하는 과정에서 **직접 뮤테이션을 재현해 확인한 신규 발견**이다.

## 발견사항

- **[WARNING]** `auth-oauth.service.spec.ts` 의 신규 "0행(만료·재사용)" 유닛 테스트가 이 PR 이
  고친 버그를 판별하지 못한다 — 실제로 뮤테이션을 재현해 확인했다.
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.spec.ts:247`
    (`it('실측 shape 에서 0행(만료·재사용)은 여전히 거절돼야 한다', …)`) / 근본 원인은
    `codebase/backend/src/modules/auth/auth-oauth.service.ts:153-165`
    (`handleCallback` 의 두 개 `if` 분기가 **둘 다 동일한 `BadRequestException({code:'OAUTH_STATE_MISMATCH'})`
    를 던진다** — 메시지 문자열만 다르다)
  - 상세: `updateReturningRows(...)` 호출을 되돌려(`const consumed = await this.dataSource.query<AuthOAuthState[]>(...)`,
    이 PR 이전 코드로 복원) 스위트를 재실행하면, "실측 shape([rows,count])로도 정상 콜백이
    성공해야 한다"(`:234`)는 예상대로 RED 로 떨어지지만, **"0행은 여전히 거절돼야 한다"(`:247`)는
    GREEN 을 유지한다** — `[[], 0]` 을 튜플 그대로 다루면 `consumed.length===0`(`2===0`)이
    거짓이라 첫 분기는 안 타지만, 이어서 `record = consumed[0]`(빈 배열)의 `.provider` 가
    `undefined` 가 되어 두 번째 분기(provider mismatch)가 대신 던진다 — 결과적으로 같은
    `BadRequestException` 클래스가 나와 `rejects.toThrow(BadRequestException)` 단언을 통과시킨다.
    즉 이 테스트는 "0행이면 거절한다"는 요구사항을 **우연히 통과시킬 뿐, `updateReturningRows`
    도입 여부를 가르지 못한다** — 판별력은 전적으로 "성공" 테스트 한 건에 의존한다. 이 세션이
    반복해 강조해 온 "생존이 곧 결함의 증거일 수 있다"(뮤턴트 판별력) 원칙이 신규 테스트
    자신에게는 적용되지 않은 사례다.
  - 제안: `rejects.toThrow(BadRequestException)` 대신 예외의 `code`/`message` 를 구체적으로
    단언한다 — 예: `.rejects.toMatchObject({ response: { message: expect.stringContaining('Invalid, expired') } })`.
    이렇게 하면 두 분기가 서로 다른 메시지를 던지므로 어느 분기를 탔는지까지 판별 가능해진다.

- **[WARNING]** `execution-engine.service.spec.ts` 의 신규 "0행 매칭(cap 초과)" admission 유닛
  테스트가 마찬가지로 이 PR 의 버그를 판별하지 못한다 — 뮤테이션으로 재현 확인.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4426`
    (`it('실측 shape 로 0행 매칭(cap 초과)이면 admitted 가 아니어야 한다', …)`) / 근본 원인은
    `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 의
    `admitExecutionOrDefer` 반환식 `updateReturningRows<{id:string}>(rows, …).length === 1`
    (튜플 도입 전 코드로 되돌리면 `(rows as {id:string}[]).length === 1`)
  - 상세: 이 식을 PR 이전 형태(튜플을 그대로 `.length` 비교)로 되돌려 재실행하면, "실측
    shape([rows,count])로도 admitted 여야 한다"(`:4420` 부근, 1행 케이스)는 예상대로
    `Expected: "admitted", Received: "deferred"` 로 RED 가 되지만, **"0행 매칭이면 admitted 가
    아니어야 한다"(0행 케이스)는 계속 GREEN 이다** — 튜플 `[[],0]`.length(=2)나 정상 unwrap 결과
    `[].length`(=0) 둘 다 `=== 1` 이 거짓이라 `admitted=false → 'deferred'` 로 **양쪽 경로가 같은
    결과를 낸다.** 즉 이 함수의 반환값이 3-way 이지만 실제로 `===1` 이라는 단일 등가 비교라서,
    "1행일 때 참" 만 버그의 유일한 판별 지점이고 "0행일 때 거짓" 은 우연히 항상 성립한다.
  - 제안: 유닛 테스트 자체는 (양성 대조군으로서) 유지하되, 이 쌍이 판별력을 가진다는 인상을
    주는 주석/문서(있다면)를 "0행 케이스는 판별자가 아니다 — 1행 케이스만 이 버그를 잡는다"로
    정정한다. 필요하면 `queryMock` 을 spy 로 감싸 인자를 검증하는 등 다른 축으로 보강할 수
    있으나, 필수는 아니다 — 현재도 "admitted" 테스트 하나가 이 회귀를 잡는다.

- **[INFO]** 신규 e2e `auth-oauth-callback.e2e-spec.ts` 의 5개 케이스 중 3개(만료·부재·provider
  불일치)가 위 auth-oauth 유닛 테스트와 동일한 이유로 이 PR 이 고친 버그를 판별하지 못한다.
  - 위치: `codebase/backend/test/auth-oauth-callback.e2e-spec.ts:92`(만료된 state),
    `:101`(DB 에 없는 state), `:108`(provider 불일치) — 세 테스트 모두
    `expect(location).toContain('error=')` 만 단언하고 어떤 사유의 에러인지는 구분하지 않는다.
  - 상세: `handleCallback` 의 두 `if` 분기가 위와 같이 같은 예외 클래스로 수렴하므로, 리다이렉트
    쿼리의 `error=` 파라미터 값(코드)까지 서로 다르지 않다면(컨트롤러가 `code` 를 그대로 실어
    보내지 않는 한) 이 세 케이스는 PR 되돌리기 뮤테이션에도 그대로 GREEN 일 가능성이 높다 —
    위 유닛 레벨에서 이미 그렇게 확인됐다. 특히 `:108` 의 테스트명 주석("행이 아니라 배열을
    읽으면 이 검사가 항상 참이 된다")은 실제로는 그 상황에서 **이미 다른 이유로도 항상 참**이라
    이 케이스만으로는 그 메커니즘을 특정해 증명하지 못한다. 파일 헤더 docstring(`:25-28`)의
    "성공/거절 양방향을 관측한다 — 한쪽만 보면 절반은 초록" 이라는 주장도, 실제로는 "거절" 쪽
    5개 준-케이스 중 유효한 판별자가 사실상 "성공" 테스트 1건(및 재사용 테스트의 `first` 서브
    단언)뿐이라는 점에서 스스로 서술한 것보다 판별력이 좁다. (기능적으로 이 세 케이스가 여전히
    올바른 동작을 확인하는 유효한 회귀 테스트라는 점은 변함없다 — 판별력이 이 특정 PR 의 버그에
    한정해서만 약하다는 것이다.)
  - 제안: 필수는 아님(e2e 에서 응답 body/코드까지 파고들 경우 인프라 비용 대비 가치가 낮을 수
    있음) — 다만 세 파일의 주석에서 "이 테스트가 이 버그를 잡는다"는 인상을 주는 문구는
    "성공 케이스가 이 버그의 유일한 판별자다"로 정정해 두면 다음 사람이 오판하지 않는다.

- **[INFO]** 위 두 WARNING 과 대조적으로, `execution-engine.service.spec.ts` 의
  `updateExecutionStatus persisted=false`(`:` 근처, "실측 shape: 0행 튜플([[],0])이면
  persisted=false") 와 KB 의 CAS 락/재큐 0행 테스트들은 단일 부등식(`.length > 0`,
  `.length === 0`)만으로 판정하는 구조라 **0행 쪽이 실제 판별자**이고, RESOLUTION 문서가 주장한
  대로 뮤테이션에 정상적으로 반응함을 별도로 확인했다(analytical cross-check, 직접 재현은 위
  두 항목에 집중). 이 PR 의 테스트 보강 대다수는 견고하다 — 위 2건은 "결과가 3-way 이거나 예외
  분기가 중첩된 지점" 에서만 발생하는 국소적 문제다.

## 요약

핵심 결함(TypeORM UPDATE/DELETE RETURNING 튜플 shape 오독)과 그 수정 자체는 신규 헬퍼
`updateReturningRows`·구조적 회귀 가드(소비 지점 카운트 fixture, 실측으로 재확인해 정확함)·8개
호출부의 필수 `detail` 인자·실 드라이버 e2e 신설까지 이미 5라운드 리뷰를 거치며 매우 꼼꼼하게
다져져 있다. 이번 라운드에서 직접 뮤테이션을 재현해 새로 확인한 것은, "성공/거절 양쪽을 판별한다"
고 명시적으로 의도된 신규 테스트 쌍 중 **일부(auth-oauth 의 0행 유닛 테스트, execution-engine
admission 의 0행 유닛 테스트, 그리고 e2e 의 거절 계열 3케이스)가 실제로는 판별력이 없다** —
근본 원인이 "여러 분기가 같은 예외/결과 값으로 수렴하는" 구조라서, 해당 분기의 성공 케이스
테스트 1건에 회귀 탐지 책임이 전부 쏠려 있다. 프로덕션 동작은 정확하고 다른 지점(updateExecutionStatus,
KB CAS 락)의 0행 테스트는 실제로 판별력을 가진다는 점도 함께 확인했으므로, 이는 국소적인
테스트-설계 갭이며 CRITICAL 로 볼 사안은 아니다.

## 위험도

LOW
