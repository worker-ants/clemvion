# 테스트(Testing) 코드 리뷰

## 사전 확인

이 배치(B-1~B-8)는 이미 3라운드의 `/ai-review`(`12_53_08`→`13_34_28`→`14_01_56`)를 거쳤고, 각
라운드의 RESOLUTION.md 를 읽어 이미 처리된 항목(orphaned JSDoc 수정, `production-build-devdep.spec.ts`
`it.each` 통합, cafe24/makeshop 두 표면 파라미터화, `enclosingScopeName` 죽은 분기 삭제 등)을
재-flag 하지 않도록 실제 소스(`Read`/`grep`, `git diff origin/main...HEAD`)를 직접 열어 현재
상태를 확인했다. 아래 발견사항은 그 세 라운드가 이미 다룬 것과 **다른** 자리만 담는다.

## 발견사항

- **[WARNING]** 새로 승격된 공용 함수 `enclosingScopeName` 의 두 fallback 분기(변수명 사용,
  `'<module>'` 기본값)가 어느 fixture 로도 관측되지 않는다 — 이 세션이 방금 그 자매 분기(`isFn`)를
  똑같은 방식으로 죽은 코드로 잡아낸 자리다
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts` 함수
    `enclosingScopeName` (122~130행 부근, `fallback` 대입과 `return fallback ?? '<module>'`)
  - 상세: 이 함수는 이번 PR 에서 `user-entity-exposure-guard.ts` 로부터
    `source-scan.ts` 로 승격돼 `endpoint-path-conflict-wrap-guard.ts` 와 공유된다.
    `source-scan.spec.ts` 를 열어 보면 같은 파일의 다른 모든 export
    (`stripComments`·`countRawUpdateReturning`·`stripLiterals`·`collectTsFiles`·
    `toPosixPath`/`toPosixRelative`)는 전부 자기 이름의 `describe` 블록과 양성/음성 fixture 를
    갖는데, `enclosingScopeName` 만 어디에도 직접 테스트가 없다(`grep -rn
    "enclosingScopeName"` → 선언 1곳 + 두 소비 가드 2곳뿐). 두 소비 spec
    (`user-entity-exposure.spec.ts`·`endpoint-path-conflict-wrap.spec.ts`)이 간접적으로
    돌리기는 하지만, 두 spec 의 fixture 를 모두 훑어도 **감싸는 메서드/함수/getter 가 없는
    자리**(모듈 최상위 `const x = repo.find(...)` 형태)가 하나도 없다 — 즉 "메서드 우선" 분기만
    실제로 관측되고, "변수 이름으로 fallback" 분기와 "`'<module>'` 기본값" 분기는 **한 번도
    실행되지 않은 코드는 아니지만 그 결과가 옳은지 어떤 단언도 검사하지 않는다.** 이 함수가
    바로 이 세션(RESOLUTION.md W1, `14_01_56` testing WARNING#1)에서 뮤테이션 테스트로
    `isFn` 분기가 죽은 코드임을 실측해 삭제한 그 함수라는 점에서, 남은 두 분기도 같은 방식으로
    검증해 두지 않으면 다음에 또 같은 형태의 재발이 나올 수 있다. 실질적 위험은 낮다 —
    `EXPECTED_*` 배열이 키 값을 `toEqual` 로 정확 비교하므로 잘못된 fallback 이 벌어져도
    위반 탐지 자체(보안 축)는 놓치지 않고, 사람이 읽는 라벨만 틀리게 나온다.
  - 제안: `source-scan.spec.ts` 에 `describe('enclosingScopeName', ...)` 을 추가해 (1) 감싸는
    메서드가 있으면 메서드 이름, (2) 메서드는 없고 감싸는 변수만 있으면 변수 이름, (3) 어느
    것도 없으면 `'<module>'` 세 갈래를 각각 인라인 `ts.createSourceFile` 스니펫으로 직접
    단언한다. 이 파일의 다른 함수들이 이미 그 패턴(작은 소스 문자열 + `describe`)을 쓰고 있어
    관례 이탈이 아니다.

- **[INFO]** `.claude/test-stages.sh` 의 신설 `_cmd_typecheck_ratchets()` 와 `cmd_build()` 로의
  배선이 harness 자체 테스트로 검증되지 않는다 (기존 관례와 같은 성격이라 새 회귀는 아님)
  - 위치: `.claude/test-stages.sh` 함수 `_cmd_typecheck_ratchets` 및 `cmd_build()` 안의
    `_cmd_typecheck_ratchets &&` 호출부
  - 상세: `.claude/tests/test_run_test_watchdog.py` 는 `test-stages.sh` 를 **stub 으로 주입**해
    watchdog(타임아웃/프로세스그룹 kill) 동작만 검증하고, 실제 `cmd_build`/`cmd_lint` 등 내부
    커맨드 함수의 조합 로직은 어떤 `.claude/tests/test_*.py` 도 실행하지 않는다(확인:
    `grep -rn "cmd_build\|cmd_lint\|cmd_unit\|cmd_e2e" .claude/tests/*.py` → 0건). 즉 "두
    ratchet 스크립트가 `&&` 로 순차 실행되고, 어느 한쪽이 실패하면 `cmd_build` 전체가
    실패한다"는 이번 배선의 핵심 계약이 자동 테스트로 고정돼 있지 않다 — 예를 들어 `&&` 가
    실수로 `;` 로 바뀌어도 어떤 CI/unittest 도 잡지 못한다. 다만 이는 `test-stages.sh` 의
    기존 관례(내부 `cmd_*` 함수 자체는 원래 unittest 대상이 아니었다)와 같은 성격이라 이번
    diff 가 새로 만든 사각지대는 아니다. 각 ratchet 스크립트의 핵심 판정 로직(`_typecheck_ratchet.py`
    공용 코어)은 `test_typecheck_ratchet.py` 가 이미 별도로 커버한다.
  - 제안: 급하지 않음. 다음에 `test-stages.sh` 의 harness 테스트를 정비할 기회가 있으면
    `cmd_build` 를 실제로 실행하되 `pnpm --filter backend build` 등 무거운 하위 호출은
    가짜 함수로 치환하고 `_cmd_typecheck_ratchets` 자리만 exit code 전파를 검사하는 얇은
    통합 테스트를 고려할 만하다.

## 확인한 강점 (재-flag 아님, 참고용)

- `endpoint-path-conflict-wrap.spec.ts` + `endpoint-path-save.fixture.ts`: "현재 저장소가
  규칙을 지킨다"와 "이 함수가 위반을 잡는다"를 분리해 양성/음성 대조군(`catchButNotWrapping`·
  `mentionsButDoesNotCall`·`wrappedViaVariable`·`otherRepositorySave`·`twoSaves`)을 갖췄고,
  fail-open 회귀(`.catch` 텍스트에 이름만 있어도 통과하던 형태)를 대조군으로 고정해 두었다.
- `http-exception.filter.spec.ts` 의 신규 두 테스트는 raw 표면 23505→409 와 raw 표면
  non-23505→500 을 **짝**으로 두어, 판정이 넓어져도(모든 에러가 409) 좁아져도(23505 raw 를
  다시 놓쳐도) 어느 한쪽이 RED 가 되도록 설계됐다. `Logger` spy 사용 여부도 실제 필터 코드의
  로깅 분기(`isPostgresUniqueViolation` 분기는 로깅 안 함, `else if (exception instanceof
  Error)` 분기는 `logger.error` 호출)와 정확히 대응한다.
- `workspaces.service.spec.ts` 의 신규 `select` 단언은 "반환 키 단언만으로는 투영을 되돌려도
  초록"이라는 vacuous 위험을 명시하고, 뮤테이션(`select` 제거)으로 새 단언 1건만 RED 임을
  확인했다고 기록했다 — 실측 기반 테스트 설계 근거의 좋은 예다. `beforeEach` 마다
  `Test.createTestingModule` 을 새로 만들어 `memberRepo.find.mock.calls[0][0]` 조회가 이전
  테스트의 호출과 섞이지 않도록 격리돼 있다.
- `webhook-trigger.e2e-spec.ts` B4: 단위 테스트가 mock 하는 드라이버 에러 형태가 실제 DB 가
  주는 형태와 같은지는 e2e 만이 검증할 수 있다는 점을 스스로 docstring 에 적고, 실제
  `(workspace_id, endpoint_path)` UNIQUE 를 밟는 유일한 자리로 배치했다. `details` 를 부분
  필드가 아니라 객체 전체로 단언하고 드라이버 원문 비노출까지 같은 테스트에서 검사해 테스트
  성격이 겹치지 않는다.
- `integration-oauth.service.{cafe24,makeshop}.spec.ts` 의 `it.each(raceErrorSurfaces)` 는
  에러 객체를 배열 리터럴이 아니라 **팩토리 함수**(`() => Error`)로 담아 파라미터화된 실행
  사이에 mutable 상태가 공유되지 않도록 했다.
- `production-build-devdep.spec.ts`: 직전 라운드가 지적한 orphaned JSDoc(주석-코드 대응 깨짐)이
  실제로 복원돼 있음을 확인했다 — `buildFiles` 캐싱 주석과 "먼저 vacuous 방지" 주석이 각각
  올바른 테스트 위로 이동했다.

## 요약

이 배치는 세 라운드의 자체 리뷰-수정 루프를 거치며 테스트 관점의 지적 대부분(orphaned 주석,
반복 `it()` 미파라미터화, cafe24/makeshop 표면 편향, `enclosingScopeName` 의 죽은 분기)이 이미
해소됐다. 이번 라운드에서 새로 확인한 것은 딱 하나 — 이번에 승격된 공용 함수
`enclosingScopeName` 이 자매 함수들과 달리 직접 단위 테스트가 없고, 그 결과 두 fallback 분기가
"죽은 코드는 아니지만 검증되지 않은 코드"로 남아 있다는 점이다(같은 세션이 형제 분기를 정확히
이 방법으로 잡아낸 직후라는 점에서 지적할 가치가 있다). `test-stages.sh` 배선 자체의 harness
테스트 부재는 기존 관례와 같은 성격이라 참고용 INFO 로만 남긴다. 나머지 신규/변경 테스트
(전역 예외 필터 raw 표면 회귀, `listMembers` DB 투영 단언, 트리거 409 e2e, AST 래칫 fixture)는
전부 mock 충실도·격리·엣지 케이스·회귀 고정 축에서 이 저장소의 높은 테스트 규율을 그대로
유지하고 있다.

## 위험도

LOW
