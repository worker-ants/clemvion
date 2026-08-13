# 요구사항(Requirement) 리뷰 결과

## 검토 방법

diff 대상 20개 파일 중 실제 기능 코드는 9개(`update-returning-rows.ts`/`.spec.ts`,
`assert-row-array.spec.ts`, `auth-oauth.service.ts`/`.spec.ts`,
`execution-engine.service.ts`/`.spec.ts`, `knowledge-base.service.ts`/`.spec.ts`)이고
나머지는 plan 문서 3개 + 이전 3라운드 리뷰 산출물(review/code/**, 자동 생성)이다. 프롬프트가
큰 파일을 truncate 했으므로 실제 소스 파일을 `Read`/`Bash`(grep·node 재현·jest 실행)로 직접
열어 대조했다:

- `updateReturningRows`/`assertRowArray` 두 구조적 회귀 가드(spec)의 정규식 카운트를 Node 로
  직접 재현해 `assert-row-array.spec.ts`(`{queries:3,guards:1}`, `{queries:1,guards:1}`)와
  `update-returning-rows.spec.ts`(헬퍼 호출 `[2,5,1]`, 소비 지점 `[3,10,0]`) 기대값이 실제
  파일 상태와 정확히 일치함을 확인.
- 관련 jest 스위트 4개(`update-returning-rows.spec.ts`, `assert-row-array.spec.ts`,
  `auth-oauth.service.spec.ts`, `execution-engine.service.spec.ts` + `knowledge-base.service.spec.ts`)
  를 직접 실행 — 전부 GREEN(35 + 505 passed, 실패 0).
- `spec/data-flow/2-auth.md` §1.3(OAuth state 소비 시퀀스), `spec/5-system/4-execution-engine.md`
  §8(admission gate), `spec/5-system/8-embedding-pipeline.md`/`10-graph-rag.md`(KB CAS 락 409
  코드), `spec/conventions/error-codes.md`(`OAUTH_STATE_MISMATCH` 명명)를 Read/Grep 으로 대조.
- `plan/in-progress/update-returning-tuple-shape.md` 전문을 읽고 처방·검증·체크리스트·후속
  항목이 실제 코드 상태와 어긋나지 않는지 확인.

## 발견사항

없음 (CRITICAL/WARNING). 아래는 참고용 INFO 1건이다.

- **[INFO]** spec 각주 소급 반영이 아직 미착수 상태로 plan 에만 등재돼 있다 (spec fidelity, 회색지대).
  - 위치: `plan/in-progress/update-returning-tuple-shape.md` §후속 "[planner 위임] 소급 각주"
    (5개 spec 문서 나열: `spec/5-system/4-execution-engine.md` §1.1,
    `spec/5-system/8-embedding-pipeline.md` §7.3, `spec/5-system/10-graph-rag.md` 동시 호출 표,
    `spec/data-flow/2-auth.md` OAuth state 소비, `spec/conventions/node-cancellation.md` §2.4)
  - 상세: 이번 PR 이 고친 8개 지점의 **동작 자체**(OAuth 400 코드, admission gate 조건, KB CAS
    락 409 코드)는 이미 spec 본문과 정확히 일치한다(위 대조 참조) — 버그가 spec 위반이었고 코드가
    spec 에 맞게 정정된 것이므로 이 부분은 spec fidelity 문제가 아니다. 남은 것은 "과거 라운드의
    mutation/coverage 서술이 실제로는 mock 경계 안쪽만 검증했다"는 **메타 각주**(주로
    `node-cancellation.md` §2.4 의 "✓ mutation 13/13 검증" 문구)이며, `developer` 는
    `spec/` 쓰기 권한이 없어 이 PR 로는 반영 불가하다는 점이 plan 본문에 이미 명시돼 있다.
  - 제안: 코드 변경 아님 — `project-planner` 턴에서 plan 이 나열한 5개 spec 문서에 각주를
    반영. 이번 코드 리뷰 관점에서는 조치 불요(이미 추적 중이며 새로 발견된 사항이 아님).

## 기능 완전성 점검 세부

- `updateReturningRows<T>(result, detail)`: 튜플(`[rows, count]`)·행 배열(SELECT/INSERT)·
  비배열(throw) 세 경로 모두 처리하며 spec 문서화한 실측 shape(`plan/.../update-returning-tuple-shape.md`
  §실측)과 정확히 일치. `detail` 인자가 필수로 승격돼(23_07_11 WARNING 4 조치) 신규 8개
  호출부(execution-engine 2 + knowledge-base 5 + auth-oauth 1) 전부에서 실제로 채워져 있음을
  grep 으로 확인(`KB re-extract CAS 락, kb ${id}` 등).
- 회귀 가드 두 벌 모두 "SELECT → assertRowArray, UPDATE/DELETE → updateReturningRows" 분담이
  실제 소스와 일치(`lockNonTerminalExecutionRow`/`computeChainDepth` 만 `assertRowArray` 잔존).
- `auth-oauth.service.ts` `handleCallback`: 0행(만료·재사용) 거절, `provider` 불일치 거절,
  `record.rememberMe` 후속 사용까지 spec 시퀀스(§1.3)와 line-level 일치. 신규 테스트 2건이
  RED→GREEN 경계(수정 전 실패, 수정 후 성공)를 명시적으로 검증.
- `execution-engine.service.ts` admission(`admitExecutionOrDefer`)·`updateExecutionStatus`:
  튜플 언랩 실패 시 admission 은 트랜잭션 롤백(throw 유지), 종결 갱신은 `persisted` 값으로
  emit 분기 — 두 곳 모두 "shape 오판 시 조용한 오상태보다 실패를 관측 가능하게" 라는 설계
  의도와 실제 구현이 일치. 신규 판별 테스트가 "정확한 값"(`toBe('admitted')`/`toBe('deferred')`,
  `persisted===true/false`)을 단언해 느슨한 `not.toBe` 로 인한 vacuous 회귀도 배제.
- `knowledge-base.service.ts` 5개 지점(CAS 락 2 + 재큐 2 + reset 1) 전부 헬퍼 경유로 전환되고
  각각 실측 shape 회귀 테스트 + 뮤테이션 사살 기록(RESOLUTION.md 참조)이 있음.

## TODO/FIXME/HACK/XXX

변경 파일 전수 grep 결과 없음.

## 반환값 · 에러 시나리오

모든 변경된 함수가 정상/0행/비배열 세 경로에서 명시적 값 또는 명시적 throw 를 반환 — 조용히
`undefined`/`NaN` 으로 흐르는 경로 없음(예: `updateReturningRows` 는 배열 아님 → throw,
빈 튜플 → `[]`, 튜플 → `[0]`).

## 요약

`UPDATE`/`DELETE … RETURNING` 이 TypeORM 0.3.31+pg 에서 `[rows, rowCount]` 튜플이라는 실측
결함을 단일 헬퍼(`updateReturningRows`)로 8개 소비 지점(execution-engine 2·knowledge-base 5·
auth-oauth 1)에 일관 적용한 변경이다. 구조적 회귀 가드(정규식 카운트)를 Node 로 직접 재현해
기대값이 실제 소스와 정확히 일치함을 검증했고, 관련 jest 스위트(35+505 테스트)를 실행해 전부
GREEN 을 확인했다. spec 문서(OAuth 시퀀스·admission gate·KB CAS 락 409 코드) 대조 결과도
line-level 로 일치하며, 이번 수정은 spec 을 어기던 버그를 spec 이 정의한 대로 되돌리는 성격이라
새로운 spec drift 를 만들지 않는다. TODO/FIXME 잔존 없음, 모든 경로에서 명시적 반환값/에러가
있음. 유일한 참고 사항(INFO)은 과거 라운드의 mutation-coverage 서술을 정정하는 spec 각주
반영이 `project-planner` 턴으로 아직 미착수 상태라는 것인데, 이는 plan 문서에 이미 추적되고
있어 이번 코드 리뷰의 새 발견이 아니다. CRITICAL/WARNING 급 요구사항 결함 없음.

## 위험도

NONE
