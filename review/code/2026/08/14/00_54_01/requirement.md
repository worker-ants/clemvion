# 요구사항(Requirement) 리뷰

## 발견사항

없음(CRITICAL/WARNING 없음). 아래는 확인 근거다.

- **핵심 결함(튜플 shape 오인) 처방의 완전성**: `updateReturningRows(result, detail)`
  (`codebase/backend/src/common/utils/update-returning-rows.ts:36-57`)이 `UPDATE`/`DELETE
  … RETURNING` 이 TypeORM 0.3.31+pg 에서 `[rows, rowCount]` 튜플로 오는 문제를 흡수하고,
  8개 소비 지점(engine 2 · KB 5 · auth-oauth 1) 전수에 적용됐다 — `grep`으로 실측: 남은
  `query<{ id: string }[]>` 제네릭 2곳(`knowledge-base.service.ts:368,628`)은 모두
  `SELECT`(UPDATE 아님)라 헬퍼 대상이 아니고 정확히 원칙(SELECT→`assertRowArray`,
  UPDATE/DELETE→`updateReturningRows`)대로 남아 있다. `assertRowArray` 잔존 2곳
  (`execution-engine.service.ts:8223` `lockNonTerminalExecutionRow`,
  `executions.service.ts:325` `computeChainDepth`)도 둘 다 SELECT 자리다.
- **직전 라운드(`00_20_21`) CRITICAL 이 실제로 fix 됐는지 코드로 재확인**: `00_20_21/requirement.md`
  가 지적한 "`handleCallback` 이 튜플은 고쳤지만 `record.rememberMe` 가 raw snake_case 행에서
  항상 `undefined`" 결함은 `auth-oauth.service.ts:41-47`(`AuthOAuthStateRow.remember_me: boolean`)
  + `:192`(`const rememberMe = record.remember_me === true`)로 정정돼 있다. 회귀 테스트도
  판별력이 있다 — 단위(`auth-oauth.service.spec.ts` "propagates rememberMe through to token
  issuance")는 `remember_me: true`(가짜 양성이 `false`로 묻히지 않도록 대조군 아닌 `true`
  값)로 mock 하고, e2e(`test/auth-oauth-callback.e2e-spec.ts` "remember_me=true → refresh
  쿠키가 30일"/"remember_me=false…대조군")는 실제 쿠키 `Max-Age`(2592000 vs 604800)까지
  단언한다. 직접 실행해 확인: `npx jest update-returning-rows.spec.ts assert-row-array.spec.ts
  auth-oauth.service.spec.ts` 36 passed, `knowledge-base.service.spec.ts` 57 passed,
  `execution-engine.service.spec.ts` 448 passed.
- **엣지 케이스**: `updateReturningRows`는 0행 튜플(`[[], 0]`→`[]`), 비-튜플 행 배열
  통과, `undefined`/`null`/객체(비배열) 즉시 throw(+`detail` 메시지 포함, 뮤테이션으로
  판별력 확인됨 — `RESOLUTION.md 23_46_00`)까지 spec 테스트(`update-returning-rows.spec.ts`)로
  커버된다. `detail` 인자가 8개 호출부 전수에 채워져 있음을 직접 확인(engine 2·KB 5·
  auth-oauth 1) — 헬퍼 JSDoc이 명시한 "선택으로 두면 지켜지지 않는다"는 설계 목표가
  필수 파라미터화로 실제 관철됐다.
- **TODO/FIXME/HACK/XXX**: 이번 diff(`codebase/**`) 추가 줄에서 검색 결과 없음.
- **반환값**: `updateReturningRows`는 throw 아니면 항상 `T[]`를 반환하는 단일 경로 —
  모든 분기에서 값 또는 예외로 귀결.
- **비즈니스 로직 / 함수명-구현 일치**: `admitExecutionOrDefer`의 admission 게이트,
  `updateExecutionStatus`의 `persisted` 판정, KB CAS 락 두 곳(`reExtractAll`/`reEmbedAll`)
  거절 분기, 재큐 3곳(embedding/graph/reset) 언랩이 각각 "실제로 UPDATE 가 행을 갱신했는가"
  를 정확히 반영하도록 바뀌었다 — 튜플 길이가 상수(2)라 무의미했던 이전 판정을 실제 갱신
  건수 판정으로 교체.
- **spec fidelity**: `spec/data-flow/2-auth.md:121,123,128,274`가 서술하는 OAuth state
  소비 행동("row 없으면 400 OAUTH_STATE_MISMATCH", "provider 불일치도 거부", DB 컬럼명
  `remember_me`)과 코드가 line-level 로 일치한다. `spec/5-system/4-execution-engine.md`
  §1.1·`8-embedding-pipeline.md`§7.3·`10-graph-rag.md` 등 소급 영향을 받는 문서들에 대한
  caveat 반영은 developer 권한 밖(`spec/` write 불가)이라 `plan/in-progress/
  spec-update-node-cancellation-shutdown-classification.md`·`update-returning-tuple-shape.md`
  에 `[planner 위임]` 항목으로 정확히 등재돼 있다(실측: `spec/5-system/3-error-handling.md`
  내 `OAUTH_STATE_MISMATCH` 등재 0건 vs 자매 KB 코드 1·1건이라는 gap 도 위임 티켓에 기록).
  developer 스코프 밖이므로 이 PR 자체의 결함은 아니다(INFO 성격, 이미 추적 중).
- **plan 문서 자기모순 잔존 여부**: 과거 라운드(`23_46_00` documentation WARNING)가 지적한
  "`:215` 넷이다 vs 다섯 항목"·"`:228-230` stale `spec_impact: none` 유지 문구"는 현재
  `update-returning-tuple-shape.md`에서 각각 "다섯이다"로 정정, stale 문단 삭제 확인.

## 요약

핵심 결함(`UPDATE/DELETE RETURNING`이 `[rows, rowCount]` 튜플인데 8곳이 행 배열로 다뤄
소셜 로그인 상시 실패·KB CAS 락 무력화·admission 판정 오류가 발생하던 문제)에 대한 처방은
공용 헬퍼 도입·8개 소비 지점 전수 적용·구조적 회귀 가드(개수 일치 테스트)·실측 shape 기반
단위/e2e 테스트로 완결돼 있다. 직전 라운드(`00_20_21`)가 잡은 CRITICAL("튜플은 고쳤지만
`rememberMe` 컬럼명 shape 은 안 고쳐 로그인 유지가 침묵 무시됨")도 `AuthOAuthStateRow`
snake_case 타입 도입 + `remember_me === true` 정규화로 정정됐고, 판별력 있는 단위 테스트와
쿠키 `Max-Age`를 직접 단언하는 e2e 로 검증돼 있다. 직접 실행한 관련 테스트 스위트
(update-returning-rows/assert-row-array/auth-oauth/knowledge-base/execution-engine)
전부 GREEN. TODO/FIXME 잔존 없음, 모든 소비 지점에서 `detail` 필수 인자 관철, SELECT 자리는
의도대로 `assertRowArray`/제네릭 유지로 남아 헬퍼 오적용도 없다. spec 문서 caveat 반영은
developer 권한 밖이라 위임 티켓에 정확히 등재돼 있어 이 PR 자체의 요구사항 충족에는 영향이
없다. 신규 CRITICAL/WARNING 없음.

## 위험도

NONE
