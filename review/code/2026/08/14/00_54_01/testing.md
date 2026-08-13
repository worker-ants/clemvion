# 테스트(Testing) 리뷰 결과

## 사전 확인

이 PR 은 이미 5차례(`20_36_35`~`23_46_00`) ai-review 라운드 + 1차(`00_20_21`) 재검토 라운드를 거쳤고,
그 라운드들이 CRITICAL 4건(소셜 로그인 상시 실패·모순 주석·거짓 커버리지 주장 2건)을 실제로 잡아
고쳤다. 이번 라운드는 그 마지막 재검토(`00_20_21`)가 낸 WARNING 2건이 이후 커밋(`e34a85b44`)에서
어떻게 처리됐는지, 그리고 `e34a85b44`(rememberMe 컬럼명 결함 수정)가 새로 도입한 테스트 자체에
결함이 없는지를 직접 diff·소스를 열어 재검증했다.

- `codebase/backend/src/modules/auth/auth-oauth.service.ts`·`.spec.ts`·
  `codebase/backend/test/auth-oauth-callback.e2e-spec.ts`·
  `codebase/backend/src/common/utils/update-returning-rows.{ts,spec.ts}` 를 현재 워크트리에서
  직접 `Read` 로 열어 diff 와 대조.
- `00_20_21/testing.md` WARNING 1(auth-oauth 0행 테스트가 판별력 없음)이 `e34a85b44` 에서
  `rejects.toThrow(BadRequestException)` → `rejects.toMatchObject({response:{code,message}})` 로
  강화됐음을 확인. `auth-oauth.service.ts:177-189` 의 두 분기가 서로 다른 `message`
  (`'Invalid, expired, or already consumed OAuth state'` vs `'Provider mismatch for OAuth state'`)를
  던지므로 이제 실제로 어느 분기를 탔는지 판별한다 — 지적이 정확히 반영됨.
- `assert-row-array.spec.ts`·`update-returning-rows.spec.ts` 의 "소비 지점 전수" 구조적 가드를
  실제 소스(execution-engine 2/knowledge-base 5/auth-oauth 1, `assertRowArray` executions 1·
  engine 1)에 대해 정규식을 손으로 재적용해 fixture 값과 일치함을 확인.

## 발견사항

- **[WARNING]** 구조적 회귀 가드 `assertRowArray(...)` 호출 수 카운터가, 같은 PR 의 같은 라운드가
  **바로 옆 자매 카운터에 적용한 것과 동일한 하드닝을 받지 못했다** — "주석 속 언급이 개수를
  부풀려 가드를 약화시킨다"는, 이 PR 자신이 실측으로 증명한 결함 클래스가 이 파일에는 아직
  열려 있다.
  - 위치: `codebase/backend/src/common/utils/assert-row-array.spec.ts:72`
    (`guards: (src.match(/assertRowArray\(/g) ?? []).length,`)
  - 상세: 같은 커밋(`e34a85b44`)이 정확히 이 문제를 자매 카운터(`updateReturningRows` 호출 수)에서
    발견해 고쳤다 — `update-returning-rows.spec.ts:76-80` 의 `stripComments`/`countHelper` 와 그
    전제를 고정하는 자체 테스트(`update-returning-rows.spec.ts:82-90`, "카운터는 주석 속 언급을
    세지 않는다"). 그 커밋 메시지 자체가 이유를 이렇게 적는다: "주석 언급이 카운트를 부풀리면
    **호출을 빠뜨린 파일이 주석만으로 통과**할 수 있다. 실제로 `auth-oauth.service.ts` 의
    docstring 이 처방을 설명하며 심벌을 적었다가 2로 셌다." `assertRowArray(` 를 세는 이 파일의
    `guards` 계산은 정규식이 동일한 형태(`정확한 함수명(` 리터럴 매치)이고 대상 파일
    (`execution-engine.service.ts`, `executions.service.ts`)도 겹치는데, 코멘트 스트리핑이
    빠져 있다. 지금 당장은 두 대상 파일에 `assertRowArray(` 를 언급하는 코멘트가 없어 GREEN 이지만
    (직접 grep 재확인: 실호출 각 1건, 코멘트 언급 0건), 방금 `updateReturningRows` 축에서 실제로
    발생했던 바로 그 형태의 회귀(신규 SELECT 지점을 추가하면서 `assertRowArray` 대신 문서만
    남기면, 문서 언급이 카운트에 섞여 "개수가 맞는다"고 조용히 통과)를 이 카운터는 여전히
    막지 못한다.
  - 제안: `update-returning-rows.spec.ts` 의 `stripComments`/`countHelper` 패턴(또는 공유 유틸로
    뽑아서)을 `assert-row-array.spec.ts:72` 의 `guards` 계산에도 그대로 적용한다. 이미
    `maintainability.md`(`22_45_24`/`23_07_11`)가 "두 자매 가드의 보일러플레이트 통합"을 INFO 로
    유예해 뒀는데, 이번 발견은 그 통합이 필요하다는 근거를 하나 더 추가한다 — 단순 중복 제거가
    아니라 **한쪽만 받은 하드닝이 다른 쪽에 누락된 안전성 갭**이기 때문이다.

- **[INFO]** (`00_20_21` testing WARNING 2 carried-forward, 의도적 미조치) `execution-engine.service.spec.ts`
  의 "0행 매칭(cap 초과)" admission 유닛 테스트는 여전히 이 PR 이 고친 튜플-shape 버그 자체에
  대해서는 판별력이 없다 — `admitExecutionOrDefer` 반환식이 `updateReturningRows(...).length === 1`
  라는 단일 등가 비교라서, 버그 상태(`[[],0].length===2`)와 정상 상태(언랩 후 `[].length===0`)
  둘 다 `!== 1` 이 되어 "deferred" 로 수렴한다. 회귀 탐지는 "admitted" 양성 테스트
  (`execution-engine.service.spec.ts:4405`) 한 건에 전적으로 의존한다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4426`
    (`it('실측 shape 로 0행 매칭(cap 초과)이면 admitted 가 아니어야 한다', …)`)
  - 상세: `00_20_21` 라운드가 이미 뮤테이션으로 재현·기록했고 "필요하면 보강할 수 있으나 필수는
    아니다 — 현재도 'admitted' 테스트 하나가 이 회귀를 잡는다"는 판단으로 LOW 등급을 매겨
    유예했다. 이후 커밋(`a53af772b`, `e34a85b44`)이 이 파일을 건드리지 않아 상태 변화 없음 —
    새로 발견한 항목이 아니라 기존 유예 판단이 여전히 유효한지 재확인 목적으로만 기재한다.
  - 제안: 조치 불요(기존 유예 유지). 필요하면 `queryMock` 인자 검증으로 보강 가능.

- **[INFO]** (`00_20_21` testing INFO carried-forward) 신규 e2e `auth-oauth-callback.e2e-spec.ts`
  의 거절 계열 3케이스(만료·부재·provider 불일치)는 여전히 `error=` 존재 여부만 단언해 어느
  분기가 거절했는지 구분하지 않는다.
  - 위치: `codebase/backend/test/auth-oauth-callback.e2e-spec.ts:110-117`(만료), `:119-124`(DB 부재),
    `:126-134`(provider 불일치) — 전부 `expect(location).toContain('error=')` 만 검사.
  - 상세: `00_20_21` 라운드가 이미 "판별력이 이 특정 버그에 한정해서만 약하다"고 정확히 지적했고,
    "e2e 에서 응답 코드까지 파고들 경우 인프라 비용 대비 가치가 낮을 수 있다"며 필수 아님으로
    분류했다. 이후 신규 `remember_me` e2e 테스트 2건(`:148-168`)이 같은 파일에 추가됐지만 이
    3케이스 자체는 손대지 않아 상태 변화 없음.
  - 제안: 조치 불요(기존 유예 유지). 회귀 탐지 책임은 이미 "성공" 케이스(`:89-96`)와 신규
    `remember_me` 판별 테스트(`:148-168`)가 지고 있고, 이 3케이스는 기능적으로는 여전히 유효한
    회귀 테스트다.

- **[INFO]** `update-returning-rows.spec.ts` 의 신규 `stripComments` 자체 테스트
  (`카운터는 주석 속 언급을 세지 않는다`)는 좋은 관행이지만, 검증 대상이 "인라인 예시" 하나뿐이라
  실제 프로덕션 소스에서 발생했던 정확한 형태(JSDoc 블록 안에 제네릭 타입 인자를 포함한 실사용
  예시 — `` `updateReturningRows<AuthOAuthState>` `` 형태)까지는 재현하지 않는다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts:82-90`
  - 상세: fixture 문자열(`:84-88`)이 블록 주석 1개 + 줄 주석 1개 + 실호출 1개로 최소 구성돼 있어
    "블록 주석과 줄 주석이 각각 스트립된다"는 두 갈래는 커버하지만, 실제 회귀를 낳았던 지점
    (`auth-oauth.service.ts` JSDoc 안에 제네릭 타입 표기까지 포함된 서술문)과 정확히 같은 형태는
    아니다. 기능적으로 정규식이 커버하므로 실질 위험은 낮다.
  - 제안: 필수 아님. 여유가 있으면 fixture 에 실제 발생했던 문구(`` `updateReturningRows<T>` `` 를
    포함한 제네릭 인용)를 하나 더 넣으면 회귀 재현이 문자 그대로 고정된다.

## 요약

핵심 결함(TypeORM UPDATE/DELETE RETURNING 튜플 shape 오독 + 그 아래 숨어 있던 snake_case 컬럼명
오독)에 대한 테스트 보강은 5~6 라운드에 걸쳐 매우 꼼꼼히 다져졌고, 직전 재검토(`00_20_21`)가 낸
WARNING 1건(auth-oauth 0행 테스트 판별력 부재)은 이번 최종 커밋에서 정확히 지적된 방식으로
고쳐졌으며 메시지 기반 분기 판별까지 뮤테이션 없이도 코드 대조로 확인된다. 이번 라운드에서 새로
발견한 것은 **같은 커밋이 자매 카운터(`updateReturningRows`)에 적용한 주석-스트리핑 하드닝을
`assertRowArray` 카운터에는 적용하지 않은 비대칭**이다 — 지금 당장 GREEN/RED 에 영향은 없지만,
이 PR 자신이 실측으로 증명한 "주석 언급이 가드를 약화시킨다"는 결함 클래스가 자매 함수에는 여전히
열려 있다는 점에서 방어 범위가 한 칸 좁게 잡힌 사례다. 나머지 두 건(execution-engine admission
0행 테스트, e2e 거절 3케이스의 판별력 부재)은 직전 라운드가 이미 근거를 남기고 명시적으로
유예한 항목으로 상태 변화가 없어 INFO 로 재확인만 한다.

## 위험도

LOW
