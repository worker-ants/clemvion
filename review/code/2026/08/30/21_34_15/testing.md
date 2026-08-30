# 테스트(Testing) 리뷰

## 검증 절차 (실측, 저장소 트리 무수정)

- `node --test .claude/tests/test_agent_return.mjs` → **13/13 PASS** (원본).
- `python3 -m pytest .claude/tests/test_workflow_scripts.py -v` → **6 passed / 17 subtests passed**.
- **뮤테이션 #1** (scratch 디렉터리 전체 복사, 저장소 미접촉): `_lib/agent-return.mjs` 의
  `REPORT_RETURN_CONTRACT` 1)·2)·3) 항목을 이 PR 이전 문구(`결과를 output_file 에 Write` /
  파일·반환 구분 없음)로 되돌리고 `node --test` 재실행 → **정확히 신규 2건만 RED
  (`step 1 tells the agent the FILE gets markdown only…`, `steps 2 and 3 are scoped to the
  RETURN message…`), 기존 11건은 GREEN**. PR/plan 이 적은 주장과 정확히 일치 — vacuous 아님.
- **뮤테이션 #2** (동일 scratch 복사본에서): `ai-review.js` 의 SHARED-BLOCK 마커 **밖** 로컬
  헤더 주석 한 줄만 옛 가드 파일명(`test_workflow_shared_block.py`)으로 되돌리고(마커 줄은
  그대로 둠 — 실제 과거 드리프트 형태를 정확히 재현) `pytest` 재실행 →
  `test_guard_filename_references_point_at_this_file` 이 정확히 그 줄(`ai-review.js:109`)을
  `subTest(file=…, line=109)` 로 지목하며 **RED**. 마커 안쪽만 보는
  `test_every_fan_out_workflow_mirrors_the_block_verbatim` 은 이 사각지대를 구조적으로 못 보는
  것도 재확인.
- `review/**` 의 오염 규모(`STATUS=` 로 시작하는 파일 수 / 그중 구분자를 포함하는 수)를
  독립적으로 재집계: **536 / 271** — 신규 테스트 도입부 주석·plan 서술과 정확히 일치.
- 저장소는 mutation 내내 건드리지 않았고(전량 `mktemp -d`류 scratch 사본), 종료 시점
  `git status --short` 는 이 리뷰 세션 자신의 출력 디렉터리 외 잔여물 없음을 확인.

## 발견사항

- **[INFO]** `updateExecutionStatus` self-deadlock 불변식(호출부 20곳 · `.transaction(` 블록
  36개 전수 대조)은 여전히 자동 정적 가드 없이 JSDoc 서술 + 사람의 수동 grep/카운트에만
  의존한다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    (`updateExecutionStatus` 상단 JSDoc, "새 호출부나 새 `.transaction(` 블록을 추가하면 이
    대조를 다시 하라. 자동 가드는 없다" 문장)
  - 상세: 같은 파일의 JSDoc 자신이 "세 판에 걸쳐 수치가 틀렸다 고쳐졌다"(11→20, 어휘적→호출
    스택, 35→36)고 이력을 남기고 있을 만큼 이 불변식은 반복적으로 사람이 셌고 반복적으로
    틀렸던 축이다. 이런 반복 실패 패턴은 통상 "자동화되지 않은 커버리지 갭"의 신호이지만,
    이번 changeset(및 `plan/in-progress/backend-lint-gate-broken-on-main.md`)은 AST 없이는
    정규식 기반 "콜백이 `updateExecutionStatus`를 참조하는가" 판정이 불가능하고, 억지로
    만들면 유한한 문제를 무한한 문제로 바꾸는 트레이드오프라는 근거를 명시적으로 남기고
    의식적으로 유예했다 — 이 프로젝트가 이미 반복 확인한 원칙(정밀 파서로 무한 표면을
    떠안지 않는다)과 일치한다.
  - 제안: 조치 불요(유예 근거 타당, 이미 3라운드에 걸쳐 검토·확인됨). 향후 이 프로젝트에
    TS AST 유틸이 저렴하게 쓸 수 있는 시점이 오면, 최소한 "`.transaction(` 블록 안에서
    `this.updateExecutionStatus` 리터럴 호출이 나타나는가"만 잡는 좁은 스모크 체크 정도는
    재검토할 가치가 있다.

- **[INFO]** 신규 회귀 테스트 2건(`.claude/tests/test_agent_return.mjs:109-138`)은
  `REPORT_RETURN_CONTRACT.indexOf(step1)` / `indexOf('2)')` 문자열 탐색으로 계약 문구를
  슬라이스한다.
  - 위치: `.claude/tests/test_agent_return.mjs:113-114`
  - 상세: 현재는 뮤테이션 #1 로 정확히 의도한 두 테스트만 RED 로 반응하는 것을 실측했지만,
    파싱이 아니라 문자열 매칭이라 계약 문구가 늘어나 다른 곳에 부분 문자열 `"2)"` 가 먼저
    등장하면 슬라이스 경계가 조용히 어긋날 수 있는 이론적 취약점이 있다. 실제 위험은 낮다 —
    `REPORT_RETURN_CONTRACT` 는 이 두 테스트가 사는 같은 파일 저자가 관리하는 짧고 안정적인
    배열이다.
  - 제안: 조치 불요(참고). 견고하게 하려면 배열 원본(`REPORT_RETURN_CONTRACT_LINES`)을
    export 해 줄 단위 인덱스로 슬라이스하는 방법이 있으나, 현재 리스크 대비 과한 리팩터.

- **[INFO]** `test_guard_filename_references_point_at_this_file`
  (`.claude/tests/test_workflow_scripts.py:114-140`)의 정규식
  `r"\.claude/tests/(test_\w+\.py)"` 은 `.claude/tests/` 접두어가 붙은 참조만 포착한다.
  - 위치: `.claude/tests/test_workflow_scripts.py:127`
  - 상세: 대상 4개 파일(`_lib/agent-return.mjs` + 3개 워크플로)을 grep 한 결과 현재 모든
    가드 파일명 언급이 `.claude/tests/` 전체 경로 형태로만 존재해 실질적 사각지대는 없다.
    다만 앞으로 누군가 접두어 없이 `test_workflow_shared_block.py` 처럼 파일명만 적으면 이
    가드는 그 드리프트를 놓친다 — 정확히 이 테스트가 막으려던 것과 같은 종류의 실패다.
  - 제안: 조치 불요(참고). 정규식을 `r"test_\w+\.py"` 로 접두어를 옵셔널하게 넓히면 커버리지가
    늘지만, `.mjs`/`.md` 등 다른 위치에서 우연히 등장하는 `test_*.py` 문자열까지 잡을 위험도
    같이 늘어난다 — 현재의 좁은 스코프가 더 안전한 트레이드오프로 보인다.

## 확인된 양호 사항

- 신규 unit test 2건은 순수 함수(`REPORT_RETURN_CONTRACT` 문자열)만 다뤄 mock 이 전혀 없고,
  다른 테스트와 상태 공유가 없어 격리가 양호하다. 뮤테이션 #1 로 non-vacuous 함을 직접
  확인했다.
- 신규 Python 가드 테스트는 이전 라운드들이 반복 지적한 "SHARED-BLOCK 마커 밖 헤더 주석은
  드리프트 가드의 구조적 사각지대" WARNING 을 정확히 겨냥해 닫았다 — 파일명을 하드코딩하지
  않고 `Path(__file__).name` 과 대조해 리네임에 자기 갱신되도록 설계됐고, 뮤테이션 #2 로 정확히
  그 사각지대(마커 밖·바로 그 실패했던 줄)를 잡는 것을 확인했다.
- `parseAgentReturn`/`usable`/`inlineReports`/`needPersistList`/`needReadList` 를 검증하는
  기존 9개 테스트는 이번 diff 가 계약 **문구**만 바꾸고 파싱 로직은 그대로 두었으므로 회귀
  없이 유효함을 직접 재확인했다(13/13 통과).
- `execution-engine.service.ts` 변경은 JSDoc 블록 내부에 한정된 순수 주석 diff이고 코드 로직
  변경이 없음을 `git diff` 로 직접 확인했다 — 신규 테스트가 불필요하다는 판단이 타당하다.
- `plan/complete/spec-draft-raw-query-results.md`(날짜 오타 정정), `plan/in-progress/*.md`,
  `review/code/2026/08/30/{20_21_06,20_46_48,21_12_21}/**`(이전 라운드 리뷰 세션의 정적
  기록·meta.json·_retry_state.json)는 실행되는 애플리케이션 코드가 아니므로 테스트 부재를
  지적할 대상이 아니다.
- 3개 워크플로 파일(`ai-review.js`/`consistency-check.js`/`merge-coordinate.js`)은 top-level
  `return` 때문에 `node --test` 로 직접 로드할 수 없어, 계약 텍스트의 정합성은
  `test_workflow_scripts.py::test_every_fan_out_workflow_mirrors_the_block_verbatim` 에 전적으로
  의존하는 구조다 — 이번 diff 로 이 가드가 깨지지 않았음을 실행으로 재확인했다.

## 요약

이번 diff 의 실질 동작 변경은 리뷰 계약 문구(파일 sink vs 반환 메시지 sink 분리) + 회귀 가드
테스트 1건 신설(`test_guard_filename_references_point_at_this_file`, SHARED-BLOCK 마커 밖
사각지대를 닫음) + `execution-engine.service.ts`/plan 문서의 순수 서술 정정뿐이다. 신규
테스트(mjs 2건 + py 1건) 모두 독립 뮤테이션 재현으로 non-vacuous 함을 직접 재확인했고, 격리·
가독성·범위 모두 양호하며 기존 회귀 테스트는 그대로 유효하다. 이 diff 는 이미 3차례의 독립
리뷰 라운드(`20_21_06`→`20_46_48`→`21_12_21`)를 거치며 Critical 0·Warning 5→1→0 으로 수렴한
상태이고, 이번 검증은 그 수렴이 실제로 유지되고 있음을(테스트 실행·뮤테이션·수치 재현으로)
독립적으로 재확인한 것이다. 남은 유일한 커버리지 갭(self-deadlock 불변식의 자동 가드 부재)은
AST 없이는 유한하게 만들 수 없다는 근거로 이미 의식적으로 유예됐고 그 근거가 코드·plan 에
명시돼 있어, 신규 결함으로 다시 올리지 않는다.

## 위험도

LOW
