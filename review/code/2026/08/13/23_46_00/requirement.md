# 요구사항(Requirement) 리뷰 결과

## 검토 방법

`updateReturningRows` 헬퍼(신규) 및 8개 소비 지점(execution-engine 2·knowledge-base 5·
auth-oauth 1) 교체가 "TypeORM 0.3.31+pg 는 `UPDATE`/`DELETE ... RETURNING` 에만
`[rows, rowCount]` 튜플을 돌려준다" 결함을 실제로 닫는지 코드를 직접 열어 확인했고,
`npx jest`(assert-row-array.spec / update-returning-rows.spec / auth-oauth.service.spec /
execution-engine.service.spec / knowledge-base.service.spec)를 실행해 전량 GREEN(540 passed)
임을 재검증했다. 이 라운드는 이미 3차 리뷰(`20_36_35`→`22_45_24`→`23_07_11`)를 거친 뒤의
마무리 diff라, 이전 라운드가 지적한 항목의 실제 반영 여부를 코드에서 대조하는 데 집중했다.

## 발견사항

- **[WARNING]** plan 문서 자기모순 — frontmatter `spec_impact` 를 리스트로 고친 커밋
  (`d8ac4cb07`, 이 diff 안에 포함)이 문서 상단 caveat 는 갱신했지만, 같은 파일 하단
  `[planner 위임]` 항목의 결론 문장은 갱신하지 않고 남겨뒀다. 결과적으로 파일 하나 안에서
  "frontmatter 가 `none`이 아닌 이유"(상단)와 "frontmatter 는 `none` 을 유지한다"(하단)가
  동시에 존재한다. 자매 plan `retry-turn-terminal-guard.md` 는 이 정확히 같은 패턴을
  414행에서 "convention_compliance — 수정: `spec_impact: none` 이 본문과 자기모순" 으로
  스스로 잡아 완전히 정정했는데(`grep` 결과 잔존 없음), `update-returning-tuple-shape.md`
  쪽은 같은 정정 커밋에서 누락됐다.
  - 위치: `plan/in-progress/update-returning-tuple-shape.md:229` (`developer` 는 `spec/`
    쓰기 권한이 없어 이번 PR 로는 못 넣는다. 그래서 frontmatter 는 `spec_impact: none` 을
    유지한다 — …) — 실제 frontmatter 는 `plan/in-progress/update-returning-tuple-shape.md:8-13`
    에 5개 spec 경로 리스트로 이미 바뀌어 있어 정면으로 어긋난다.
  - 상세: 코드 동작에는 영향이 없으나, 이 문서는 `complete/` 이동 시 Gate C
    (`spec-plan-completion.test.ts`)가 참조하는 lifecycle 판단 근거이고, 바로 이 PR 자체가
    "같은 실수를 반복하지 말라"(§`왜 아무도 못 봤나`, §`1차 감사가 왜 놓쳤나`)는 교훈을
    본문에 명시하는 문서라 자기모순이 특히 눈에 띈다. 다음 사람이 하단 문장만 읽으면
    frontmatter 상태를 오인할 수 있다.
  - 제안: `developer` 권한 범위(plan/**) 안이므로 이번 세션에서 바로 정정 가능 — 229~230행을
    "frontmatter 는 리스트를 유지한다(Gate C 오판 방지, `23_27_49` WARNING 3)" 로 바꿔
    상단 caveat 와 일치시킨다. spec 자체를 건드리는 게 아니므로 project-planner 위임 불필요.

- **[INFO]** 핵심 로직 자체는 spec 본문과 line-level 로 일치한다 — 확인 완료, 결함 아님.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2943-2953`
    (admission), `:8546-8553`(`updateExecutionStatus`) / `spec/5-system/4-execution-engine.md:1138`
    (advisory-lock 직렬화 + 조건부 UPDATE RETURNING 설계)
  - 상세: spec 은 애초에 "조건부 UPDATE(`RETURNING`)로 admission 을 원자 처리한다" 는
    **의도된 동작**만 서술하고 TypeORM 반환 shape 의 구체적 형태까지는 규정하지 않는다 —
    즉 이번 결함은 spec 위반이 아니라 그 의도를 구현이 잘못 소비한 순수 코드 버그였고,
    수정 후 코드가 spec 서술(원자 admission, `RETURNING` 기반 affected 판정)과 정확히
    부합한다. `plan/in-progress/update-returning-tuple-shape.md` §후속의 `[planner 위임]`
    항목(4곳 spec 각주 추가)은 개발자 권한 밖의 사후 문서화이지 코드 결함이 아니다.
  - 제안: 없음.

- **[INFO]** `auth-oauth.service.ts` 수정은 8번째 소비 지점(1차 감사 사각지대)까지 정확히
  닫혔고, 신규 판별 테스트 2건(정상 콜백 성공 / 0행 거절)이 실제로 수정 전 RED, 수정 후
  GREEN 임을 로컬 재실행으로 확인했다(`auth-oauth.service.spec.ts` 16 passed 포함).
  `handleCallback` 의 `consumed.length === 0`(거절) / `consumed[0].provider`(provider 비교)
  로직이 실제 튜플 shape 을 `updateReturningRows` 로 올바르게 언랩한 뒤 소비한다.
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts:146-165`
  - 제안: 없음.

- **[INFO]** KB 5개 소비 지점 전부에 `detail` 진단 인자가 채워져 있다(이전 라운드
  `22_45_24` WARNING 3가 지적한 누락이 실제로 해소됨) — `knowledge-base.service.ts:346,
  544-547, 578-581, 729, 751-754` grep 확인.
  - 제안: 없음.

- **[INFO]** 이전 라운드(`23_07_11` maintainability WARNING)가 지적한
  `knowledge-base.service.ts` embedding 재큐 분기의 stale 제네릭(`query<{id:string}[]>`)은
  현재 파일에서 `unknown` 으로 통일돼 있어(`:533` 부근) 이미 해소된 상태다 — 재확인 결과
  잔존 없음.
  - 제안: 없음.

## 요약

핵심 기능(`updateReturningRows` 헬퍼 + 8개 소비 지점 교체)은 명시된 결함
("TypeORM `UPDATE`/`DELETE … RETURNING` 이 튜플인데 행 배열로 오인")을 코드 레벨에서
완전히 닫았다 — admission·종결 이벤트·KB CAS 락 2곳·재큐 2곳·reset·OAuth state 소비까지
전 지점에서 실제 shape 언랩이 올바르고, 신규 판별 테스트가 뮤테이션(문서 기록 기준
5/5, 2/2 등)으로 실제로 분기를 가른다는 근거가 있으며 로컬 재실행으로도 전량 GREEN 을
재확인했다. 반환값·에러 시나리오(`Array.isArray` 아니면 throw, 빈 배열 vs 튜플 구분)도
경계값을 정확히 처리한다. 유일한 실질 결함은 코드가 아니라 plan 문서 자기모순
(`update-returning-tuple-shape.md:229`)으로, frontmatter 를 리스트로 고친 동일 커밋이
정확히 같은 패턴을 자매 plan 에서는 고치고 이 파일에서는 놓쳤다 — 저비용 정정이며
`developer` 권한 범위 안이라 이번 PR 내에서 바로 처리 가능하다.

## 위험도

LOW
