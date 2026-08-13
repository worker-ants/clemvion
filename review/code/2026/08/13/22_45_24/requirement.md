# 요구사항(Requirement) 리뷰

## 개요

이 diff 는 이전 리뷰 라운드(`20_36_35`/`20_36_36`)의 CRITICAL 2건·WARNING 다수를 조치한 결과물이다
(코드 수정 + 해당 라운드의 리뷰/컨시스턴시 산출물 커밋 + `RESOLUTION.md`). 핵심 프로덕션 변경은:

- `updateReturningRows()` 헬퍼 신설 — TypeORM 0.3.31+pg 가 `UPDATE`/`DELETE … RETURNING` 에
  대해 `[rows, rowCount]` 튜플을 돌려주는 실제 shape 을 흡수.
- `execution-engine.service.ts` 2곳(`admitExecutionOrDefer`, `updateExecutionStatus`),
  `knowledge-base.service.ts` 5곳, 그리고 이번 라운드에서 새로 발견/수정된
  `auth-oauth.service.ts` 1곳(소셜 로그인 콜백) — 총 8개 소비 지점을 헬퍼로 통일.

이전 라운드 CRITICAL 1(auth-oauth 소셜 로그인 상시 실패), CRITICAL 2(모순되는 옛 주석 잔존),
lint 실패(WARNING 2) 는 코드를 직접 열어 실측 검증한 결과 **실제로 수정돼 있다** — 아래 상세.

## 발견사항

- **[WARNING]** `RESOLUTION.md` 가 "engine `updateExecutionStatus` 는 이미 기존 스위트가
  real-shape mock 으로 덮는다" 고 주장하지만, 뮤테이션으로 직접 반증됨 — 실제로는 이 지점에
  실측(튜플) shape 로 신·구 코드를 가르는 회귀 테스트가 **하나도 없다**.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8549`
    (`const persisted = updateReturningRows<{ id: string }>(updated, ...).length > 0;`) /
    대응 mock 기본값 `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:331`
    (`query: jest.fn().mockResolvedValue([{ id: executionId }])`) 및 이 지점을 override 하는
    모든 테스트(`:1032`, `:3659`, `:5149`, `:5365`, `:5389`, `:5437`, `:5458`, `:5474`, `:5498`) /
    허위 주장 위치: `review/code/2026/08/13/20_36_35/RESOLUTION.md` WARNING 표 1번 행
  - 상세: 직접 뮤테이션 테스트로 확인했다 — 배열 가드(`Array.isArray` 체크, 던지는 동작)는
    그대로 둔 채 튜플 언랩만 되돌려 예전 버그(`updated.length > 0`, 튜플이면 항상 `length===2`
    → 항상 `true`)를 재현해도 `execution-engine.service.spec.ts` 전체 **446 tests 가 전부
    GREEN** 이다(재현 커맨드: `updateReturningRows(...)` 호출을 인라인 `Array.isArray` 가드 +
    `(updated as {id:string}[]).length > 0` 로 치환 후 `npx jest execution-engine.service.spec.ts`
    실행, 446 passed 확인 — 원본 파일은 즉시 원복해 재검증까지 마쳤다). 이유는 위 8개 override
    지점 전부가 `[{id}]`/`[]` 같은 **비-튜플**(SELECT/INSERT 형) shape 만 mock 하기 때문이다 —
    `updateReturningRows` 는 `Array.isArray(result[0])` 가 false 면 입력을 그대로 통과시키므로,
    이 mock shape 아래서는 신·구 코드가 항상 같은 결과를 낸다. 즉 plan 문서 스스로가 근본 원인으로
    지목한 "mock 이 틀린 현실을 인코딩해서 4개월간 결함을 못 봤다" 패턴이 **바로 이 지점에 그대로
    남아 있다** — 그런데 `RESOLUTION.md` 는 이 지점을 "이미 덮여 있다" 고 잘못 기록해 두었다.
    이 지점(`persisted`)은 이번 PR 이 촉발한 소급 조사에서 `ie-resume-turn-boundary-cancel.md`
    가 6~8차 라운드에 걸쳐 "동시 cancel 레이스를 닫았다" 고 **오판**한 바로 그 값이고, 그 plan
    자체가 "`plan/complete/` 로 옮기기 전에 6~8차 결론을 코드로 재검증할 것" 이라는 조건을 남겨
    두었다 — 그 재검증에 쓰일 유일한 안전망이 실은 판별력이 없는 상태다.
  - 제안: `updateExecutionStatus`(또는 이를 노출하는 `priv()` 경유)를 실측 튜플 shape
    (`[[{id}], 1]` = 적용됨 / `[[], 0]` = 0행 선점)로 무장한 최소 1개 신규 테스트로 검증하고,
    `RESOLUTION.md`/plan 문서의 해당 주장을 정정한다. `ie-resume-turn-boundary-cancel.md` 를
    `plan/complete/` 로 옮기기 전 필수로 처리할 것을 권고.

- **[WARNING]** `knowledge-base.service.ts` 의 5개 수정 지점 중 실측 튜플 shape 로 검증되는
  것은 **1곳뿐**이다 — `RESOLUTION.md` WARNING 1 의 "kb CAS 락에 실측 튜플 shape 테스트
  추가" 문구가 CAS 락 2곳 전부를 가리키는 것으로 읽히지만 실제로는 `reEmbedAll` 1곳만 추가됐다.
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.spec.ts:792-799`
    (신규, `reEmbedAll` CAS 0행 거절만 커버) — 대조: `:394-403`(`reExtractAll` CAS 락, 여전히
    `mockDataSource.query.mockResolvedValueOnce([])` 비-튜플), 임베딩/그래프 재큐(`:823` 부근
    ~), reset(`:1129` 부근~) 은 grep(`\[\[`) 결과 튜플 shape mock 이 전무.
  - 상세: `reExtractAll` CAS 락(`knowledge-base.service.ts:345`)은 원래 결함 목록(plan 문서
    "무엇이 깨져 있었나" 표)에서 `reEmbedAll` CAS 락과 동일한 심각도("락이 한 번도 거절하지
    않음")로 취급됐는데, 회귀 테스트는 `reEmbedAll` 쪽에만 붙었다. 임베딩/그래프 재큐(가짜 job
    2개 큐잉 버그, `rows.map(r => r.id)` → `[undefined, undefined]`)와 reset(빈 KB 좌초 버그)
    은 여전히 어떤 실측 shape 테스트도 없다 — 이 셋을 되돌려도(헬퍼 우회) 기존 스위트는 GREEN
    을 유지한다(이전 라운드 testing.md WARNING 2 가 지적한 상태와 동일, 부분만 해소됨).
  - 제안: 최소 `reExtractAll` CAS 락에 `reEmbedAll` 과 대칭되는 0행 거절 테스트 1건, 재큐/reset
    중 최소 1곳에 실측 shape("가짜 job 큐잉 안 됨"/"빈 KB idle 복귀") 회귀 테스트를 추가할 것.

- **[INFO]** `knowledge-base.service.ts` 의 5개 `updateReturningRows` 호출부는 선택적
  `detail` 진단 인자를 하나도 쓰지 않는다 — `execution-engine.service.ts` 의 2곳은 모두 쓴다.
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:345`, `:541`,
    `:572`, `:719`, `:740`
  - 상세: `update-returning-rows.ts` JSDoc 은 `detail` 도입 이유를 "종전 `assertRowArray` 가
    주던 진단을 잃지 않기 위함" 이라고 명시하는데, KB 쪽은 애초에 `assertRowArray` 를 쓴 적이
    없어(직접 `.length` 비교) 손실이 새로 생긴 것은 아니다. 다만 KB 는 같은 파일 안에 5개
    지점(CAS 락 2·재큐 2·reset 1)이 몰려 있어, 방어 분기가 실제로 트리거되는 극단 상황에서는
    engine 쪽과 달리 어느 지점인지 로그만으로 구분하기 더 어렵다.
  - 제안: 필수는 아님. 여력이 되면 5곳에도 `detail`(예: `` `reExtractAll CAS, kb ${id}` ``)을
    붙여 진단 일관성을 맞출 것.

- **[검증 완료, 문제 없음]** 이전 라운드 CRITICAL 1(소셜 로그인 상시 실패) — 실제 코드로 수정
  확인.
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts:146-164`
  - 상세: `consumed = updateReturningRows<AuthOAuthState>(await this.dataSource.query(...))` 로
    교체돼 `consumed.length === 0`/`consumed[0].provider` 판정이 정상화됐다. 신규 테스트 2건
    (`auth-oauth.service.spec.ts:234-253`, 실측 shape `[[validState],1]`/`[[],0]`)이 실제로
    판별력을 갖는지 코드 대조로 확인 — `updateReturningRows` 를 우회하면(구 코드) `[[validState],1]`
    입력에서 `consumed.length===0` 이 항상 거짓 → 상시 `OAUTH_STATE_MISMATCH`, 즉 신규 성공
    테스트가 RED 로 떨어진다. 실제 discriminator다.

- **[검증 완료, 문제 없음]** 이전 라운드 CRITICAL 2(모순되는 옛 주석) — `admitExecutionOrDefer`
  안의 "`RETURNING id` 이므로 실제 shape 은 행 배열이다" 문장이 삭제되고 정정된 단일 주석으로
  통합됨을 `execution-engine.service.ts:2916-2920` 직접 Read 로 확인.

- **[검증 완료, 문제 없음]** lint 게이트(이전 라운드 WARNING) — `npx eslint` 를 대상 6개 파일에
  직접 재실행, 출력 없음(0 오류/경고) 확인.

- **[검증 완료, 문제 없음]** 구조적 회귀 가드 수치 — `updateReturningRows(` 호출 수를 각 서비스
  파일에서 직접 grep 재검증: `execution-engine.service.ts` 2, `knowledge-base.service.ts` 5,
  `auth-oauth.service.ts` 1 — `update-returning-rows.spec.ts` 의 `EXPECTED` 배열과 일치.
  `assertRowArray(` 잔존 호출도 `execution-engine.service.ts` 1건(`lockNonTerminalExecutionRow`)
  으로 `assert-row-array.spec.ts` 의 갱신된 `guards: 1` 기대값과 일치.

- **[정보/검증]** spec fidelity — `spec/5-system/4-execution-engine.md`(§8 admission gate),
  `spec/5-system/8-embedding-pipeline.md`(CAS 락 409, 빈 KB idle 복귀) 는 이번 diff 로 변경되지
  않았고, 이전 컨시스턴시 라운드(`20_36_36`)가 line-level 로 대조한 결과와 마찬가지로 이번
  수정은 spec 이 이미 규정한 동작을 코드가 위반하던 것을 원복한 것이지 spec 이탈이 아니다 —
  SPEC-DRIFT 아님, 확인 결과 재확인.

## 요약

프로덕션 코드 자체는 견고하다 — 이전 라운드 CRITICAL 2건(소셜 로그인 상시 실패, 모순 주석)과
lint 실패가 실측 확인 결과 실제로 해소됐고, 구조적 회귀 가드 수치·spec 정합성도 재검증에서
일치했다. 다만 이번 라운드에서 커밋된 `RESOLUTION.md` 가 "`updateExecutionStatus` 는 이미
실측 shape mock 으로 덮인다" 고 주장한 부분은 직접 뮤테이션으로 반증됐다 — 배열 가드는 유지한
채 튜플 언랩만 되돌려도 기존 446개 테스트가 전부 GREEN 이다. 이 지점(`persisted`)은 다른 plan
(`ie-resume-turn-boundary-cancel.md`)이 3라운드에 걸쳐 레이스가 닫혔다고 오판한 바로 그 값이고,
그 plan 은 "코드로 재검증할 것"을 완료 전 조건으로 남겨 두었는데, 재검증에 쓰일 회귀 안전망이
실은 판별력이 없다. KB 쪽도 5개 수정 지점 중 1곳(`reEmbedAll` CAS)만 실측 shape 테스트로
커버되고 나머지 4곳(CAS 락 1·재큐 2·reset 1)은 여전히 비-튜플 mock 에 의존해 회귀를 못 잡는다.
요구사항 자체("튜플 shape 오인 수정")는 프로덕션 코드 수준에서 충족됐으나, "재발을 막는다"는
이 PR 의 핵심 목적 대비 회귀 테스트 커버리지와 그 커버리지에 대한 문서 상 주장 사이에 실측으로
확인된 괴리가 남아 있다.

## 위험도

MEDIUM — 프로덕션 결함은 없음(라이브 버그 없음, 이전 CRITICAL 전원 검증됨)이나, 이 PR 이
스스로 표방한 재발 방지 목적에 대해 committed 된 `RESOLUTION.md` 의 검증 완료 주장이 실측으로
반증되는 지점(`updateExecutionStatus`)이 있고, 그 지점은 별도 plan 의 다회 오판과 직접 연결돼
있어 방치 시 동일 실패 패턴(거짓 GREEN)이 반복될 실질적 위험이 있다.
