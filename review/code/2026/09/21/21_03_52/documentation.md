# 문서화(Documentation) 리뷰

## 범위 및 검증 방법

`codebase/backend/test/helpers/concurrency.ts`(신규, `raceUnderHeldLock()`) + 이를 사용하도록
리팩터된 9개 e2e 동시성 테스트 파일(11 블록) + `PROJECT.md` e2e 가이드 갱신 +
`plan/in-progress/e2e-race-helper.md`. 프로덕션 코드(`codebase/backend/src/**`) 변경은 0건.

이번 라운드는 앞선 두 리뷰 라운드(`review/code/2026/09/21/20_26_50/documentation.md`,
`review/code/2026/09/21/20_45_43/documentation.md`)가 지적한 항목들이 반영된 이후의 상태를
검토한다. 저장소를 뮤테이션하지 않고 `Read`/`Bash`(`git diff origin/main HEAD -- <path>`,
직접 파일 열람)로만 확인했다 — 대상 파일들은 신규 추가/전량 치환이라 diff 게이트 번호가 곧
실제 파일의 1-기준 줄 번호와 일치함을 `codebase/backend/test/helpers/concurrency.ts`,
`PROJECT.md`, `plan/in-progress/e2e-race-helper.md` 를 직접 `Read` 하여 대조 확인했다.
`webauthn-credential-delete-concurrency.e2e-spec.ts` 는 프롬프트에서 diff 가 생략돼 있어
`git diff origin/main HEAD -- <path>` 로 직접 조회해 검토했다(2블록 모두 헬퍼 위임 주석이
원본 도메인 주석을 보존한 채 정확히 치환됨을 확인).

## 발견사항

- **[INFO]** `raceUnderHeldLock()` 의 `@throws` 가 `locker.query('BEGIN')` 자체의 실패 경로는
  다루지 않는다
  - 위치: `codebase/backend/test/helpers/concurrency.ts:62-64`(`@throws` 세 줄) vs
    `codebase/backend/test/helpers/concurrency.ts:89`(`await locker.query('BEGIN');`, `try` 블록
    **밖**에서 실행됨)
  - 상세: 현재 `@throws` 는 세 경로(`fires.length < 2`, `lock.sql` 실패, 공허성 가드 실패)를
    정확히 문서화한다(이는 이전 두 라운드가 지적했던 "`fires.length < 2` 경로 누락"·"`lock.sql`
    실패 경로 누락" INFO 가 이미 해소된 상태임을 뜻한다). 다만 `BEGIN` 쿼리는 `try` 진입 **전**에
    실행되므로, 이것이 실패하면 `finally` 의 `ROLLBACK`/`pending?.catch` 를 거치지 않고 그대로
    전파된다 — `lock.sql` 실패(트랜잭션이 이미 열린 상태에서 실패, `finally` 가 개입)와는 정리
    경로가 다른데 `@throws` 문구("`lock.sql` 자체가 실패하면")는 이 둘을 구분하지 않는다. 실무
    영향은 거의 없다(BEGIN 실패는 커넥션 자체가 죽은 극단적 상황에서만 발생하고, 11개 호출부
    전부 `beforeAll` 에서 갓 연결한 `locker` 를 쓴다).
  - 제안: 선택 사항. 필요하면 `@throws` 문구를 "`BEGIN`/`lock.sql` 자체가 실패하면"으로 한 단어만
    넓히면 충분하다. blocking 사유 아님.

## 확인한 항목 (문제 없음 — 재검증)

- **PROJECT.md 갱신의 정확성 재확인**: `PROJECT.md:337-342` 의 "선례 9파일:
  `*-delete-concurrency.e2e-spec.ts` · `member-remove-concurrency.e2e-spec.ts`" 서술을
  `ls codebase/backend/test/*concurrency*` 로 재대조 — glob 매칭 8파일(`auth-config-`,
  `integration-`, `model-config-`, `schedule-`, `trigger-`, `webauthn-credential-`, `workflow-`,
  `workspace-delete-concurrency`) + 별도 명시한 `member-remove-concurrency` = 9파일, plan 문서의
  "아홉 파일 11 블록"과도 일치. `integration-rotate-concurrency.e2e-spec.ts` 를 "갱신 경합이라
  구조가 다르다"고 제외 언급한 것도 실제 diff 에 그 파일이 없는 것과 일치.
- **`KNOWN_LOCK_TIMEOUTS_MS` / `VACUITY_GUARD_MS` 문서의 주장 범위 — 라운드 2 이후 정정 확인**:
  이전 라운드(`20_45_43/concurrency.md`)가 지적한 "assert 가 '프로덕션 전체 최소 상한'이 아니라
  '알려진 상수 목록 하나'만 검사한다"는 INFO 는, 후속 커밋(`905e1f696`)에서 JSDoc 문구 자체가
  "다만 검사 범위는 «프로덕션 전체의 최소 상한» 이 아니라 `KNOWN_LOCK_TIMEOUTS_MS` 에 적힌
  것뿐이다"(`concurrency.ts:23-25`)로 스스로 그 한계를 명시하도록 정정됐다 — 코드가 자신의
  주장 범위를 과장하지 않는 상태로 확인된다. 이는 문서화 관점에서 바람직한 정정이다.
  `KNOWN_LOCK_TIMEOUTS_MS` 선언부 JSDoc(`:6-11`)도 "여기 있는 것만 검사된다" ·
  "추가하지 않으면 검사는 통과하지만 그 호출부의 가드는 오탐한다"고 향후 확장 시의 책임
  소재를 명시적으로 남겨, 열 번째 호출부 작성자가 참고할 수 있다.
- **JSDoc 완전성**: `raceUnderHeldLock()` 은 모듈 목적("왜 헬퍼인가")·겹침을 만드는 방법·
  `@param`(`locker`/`lock`/`fires` 각각의 제약과 이유)·`@returns`(정렬 안 함 명시)·`@throws`(3개
  경로)·`@example`(정렬자 오용 시 위험까지 안내)을 모두 갖춘 모범적 수준. 상수 선언(`VACUITY_GUARD_MS`)도
  함수 정의보다 위에 위치해 선형 가독성을 해치지 않는다(이전 라운드가 지적한 "상수가 함수 아래
  선언돼 있다"는 문제도 이미 해소돼 있음).
- **주석-코드 정합성 (9파일 11블록 전수)**: 각 호출부에 남은 도메인 설명 주석(예:
  `auth-config-delete-concurrency.e2e-spec.ts` "둘 다 무락 `findById` 를 통과한 뒤 DELETE 에서
  이 락을 기다린다", `webauthn-credential-delete-concurrency.e2e-spec.ts` 두 번째 블록의 "이것이
  논쟁이 된 인터리빙이다")이 리팩터 전 원본과 문자 그대로 보존되며, 실제 헬퍼 위임 사실과
  모순되지 않는다. 오래된 주석(stale comment)은 발견되지 않았다.
- **plan 문서(`plan/in-progress/e2e-race-helper.md`)**: frontmatter(`spec_impact: none`,
  `worktree` 명시) 컨벤션 준수. §B 실측 표·§C 판별 실험(음성 대조군 예측 11 RED/실측 11 RED,
  실패 사유까지 `Received: "settled"` 확인)이 근거를 구체적으로 남겼고, 체크리스트 마지막 세
  항목(`/ai-review` 수렴·`--impl-done`·트래커 이관)이 미체크인 것은 이 리뷰가 그 첫 항목을
  수행 중인 정상 진행 상태를 정확히 반영한다.
- **README/CHANGELOG/API 문서**: 프로덕션 API·환경변수·설정 옵션 변경이 없고
  (`codebase/backend/src/**` 변경 0), `spec_impact: none` 이 실제 diff 와 일치해 README·API
  문서·CHANGELOG 갱신 대상이 아니다.

## 요약

`raceUnderHeldLock()` 추출은 문서화 관점에서 이미 두 차례의 리뷰 라운드를 거치며 지적된
항목(신규 헬퍼가 `PROJECT.md` 에 없음 · `@throws` 누락 두 건 · 근거 중복 서술 · 상수 선언
위치)이 순차적으로 해소된 상태다. 특히 주목할 점은, 이전 라운드가 "assert 의 주장 범위가
넓다"고 지적한 것에 대해 코드 작성자가 후속 커밋에서 JSDoc 문구 자체를 실제 검사 범위에
맞게 축소 정정했다는 것 — 문서가 구현보다 넓게 말하지 않도록 스스로 좁혀 놓은 좋은 사례다.
남은 것은 `@throws` 가 `BEGIN` 쿼리 자체의 실패와 `lock.sql` 실패를 문구상 구분하지 않는다는
극히 경미한 INFO 하나뿐이며, 정리 경로(finally 개입 여부)가 다르다는 점을 제외하면 실무
영향은 없다. CRITICAL/WARNING 은 발견되지 않았다.

## 위험도

NONE
