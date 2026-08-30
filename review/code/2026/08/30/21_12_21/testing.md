# 테스트(Testing) 리뷰

## 검증 절차 (실측)

저장소 트리는 원상 복구 상태로 유지했다(`git status --short` 로 전후 확인):

- `node --test .claude/tests/test_agent_return.mjs` → **13/13 PASS** (원본, 무수정).
- `python3 -m pytest .claude/tests/test_workflow_scripts.py -q` → **6 passed / 17 subtests passed**.
- **뮤테이션 재현 #1** (scratch 디렉터리에서만, 저장소 미접촉): `_lib/agent-return.mjs` 를 scratch 로 복사해
  `REPORT_RETURN_CONTRACT` 의 1)·2)·3) 항목을 이 PR 이전 문구로 되돌리고 scratch 테스트 파일의 import
  경로만 그 mutant 를 향하도록 수정 → `node --test` 실행 결과 **정확히 신규 2건만 RED, 기존 11건은
  GREEN**. `plan/in-progress/backend-lint-gate-broken-on-main.md:366-368` 와
  `review/code/2026/08/30/20_46_48/testing.md` 의 동일 주장을 독립적으로 재현·확인했다 — vacuous 아님.
- **뮤테이션 재현 #2** (저장소 파일 직접 사용, `cp` 백업 후 `cp` 로 원복 — `git checkout`/`restore` 미사용):
  `.claude/workflows/ai-review.js:109` 의 로컬 헤더 주석 한 줄만 옛 이름(`test_workflow_shared_block.py`)
  으로 되돌리고(마커 줄은 그대로 둠 — 과거 실제로 발생했던 "마커만 고치고 헤더는 안 고침" 형태를 정확히
  재현) `pytest` 를 돌리니 신규 테스트 `test_guard_filename_references_point_at_this_file` 가 정확히 그
  줄(`ai-review.js:109`)을 지목하며 **RED** 로 실패했다. 이후 백업으로 `cp` 원복, 재실행하여
  **6 passed / 17 subtests** 로 복귀함을 확인했다. 원복 후 `git status --short` 에는 이 리뷰 세션이 만든
  `review/code/2026/08/30/21_12_21/` 외 잔여물 없음.
- `.claude/tests/(test_\w+\.py)` 패턴으로 `_lib/agent-return.mjs` + 3개 워크플로 파일을 직접 grep 한 결과
  현재 소스에는 `test_workflow_shared_block.py` 잔여 참조가 **0건**임을 확인했다(테스트가 통과할 만함).
- `plan/in-progress/backend-lint-gate-broken-on-main.md:357` 의 실측 주장("1행이 `STATUS=` 인 파일 536개,
  그중 2행이 구분자인 것 271개")을 `review/**` 전체를 훑어 독립 재현했다 — **536 / 271 로 정확히 일치**.

### 관측된 이상 상태 (세션 중 자연 발생, 자체 해소됨 — 보고 의무에 따라 기록)

검증 중 `git status --short` 를 두 번째로 실행했을 때 `.claude/workflows/ai-review.js` 가
**working tree 에서 수정된 상태**로 잡혔다(`git diff` 로 확인: 헤더 주석·SHARED-BLOCK 마커 줄이 모두
`test_workflow_shared_block.py` 로 되돌아가 있었음). 이 변경은 내가 만들지 않았다 — 동시에 도는 다른
fan-out reviewer 가 자신의 뮤테이션 재현을 저장소에서 직접 수행 중이었던 것으로 보인다. 몇 초 뒤
재확인하니 이미 원복되어 diff 가 비어 있었다(자체 해소, 조치 불요). 프로토콜에 따라 관측한 이상 상태를
그대로 기록한다 — 내가 되돌린 것이 아니며, 최종 확인 시점 저장소는 clean 하다.

## 발견사항

- **[INFO]** `.transaction(` 전수 카운트 불변식은 여전히 자동 정적 가드 없이 JSDoc 서술 + 수동 grep 에
  의존한다. 다만 이번 커밋(`ca260d87e`)이 이를 **의식적으로 유예**했고 근거를 명시했다 — "정규식으로
  콜백이 `updateExecutionStatus` 를 참조하는지 판정하려면 AST 수준이 필요한데, 그러면 유한한 문제를
  무한한 문제로 바꾸는 것"(이 저장소가 반복 확인한 원칙, `project_reaper_anchor_keep_and_push_guard_withdrawn`
  계열 선례와 일치). 이전 라운드(`review/code/2026/08/30/20_46_48/testing.md` WARNING #2)에서 이미
  WARNING 으로 지적됐고, 이번 커밋이 그 지적에 대해 "가드로 만들 수 있는 사각지대(파일명 드리프트)만
  가드로 만들고, AST 없이는 못 만드는 부분은 유예 근거를 남긴다"는 형태로 명시적으로 응답했으므로,
  같은 갭을 다시 WARNING 으로 반복하지 않고 확인 기록으로 남긴다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`updateExecutionStatus`
    상단 JSDoc), 유예 근거는 커밋 메시지 W2 및 `plan/in-progress/backend-lint-gate-broken-on-main.md`.
  - 제안: 유예 상태이므로 조치 불요. AST 기반 정적 가드가 실제로 저렴하게 만들 수 있는 시점이 오면
    (예: 프로젝트가 이미 사용 중인 TS AST 유틸이 있다면) 재검토할 만하다.

- **[INFO]** `.claude/tests/test_agent_return.mjs:109-125,127-138` 의 신규 두 테스트는
  `REPORT_RETURN_CONTRACT.indexOf('1)')`/`indexOf('2)')` 문자열 탐색 + `lines.find(l => l.trim().startsWith(n))`
  방식으로 계약 문구를 슬라이싱한다. 현재는 정확히 의도한 범위만 잘라내는 것을 실측 확인했지만(위
  재현 절차), 문자열 매칭 기반이라 계약 문구가 늘어나 다른 곳에 부분 문자열 `"2)"` 가 먼저 등장하면
  슬라이스 경계가 어긋날 수 있다. 이전 라운드(SUMMARY INFO #6, `20_46_48/testing.md` INFO)에서 이미
  지적·처분(조치 불요)된 사항으로, 등급을 올리지 않고 재확인만 기록한다.
  - 위치: `.claude/tests/test_agent_return.mjs:113-114` (`indexOf(step1)` / `indexOf('2)')`)
  - 제안: 조치 불요(참고). 굳이 견고하게 하려면 `1)`/`2)`/`3)` 대신 배열 인덱스 자체(`REPORT_RETURN_CONTRACT_LINES`
    같은 원본 배열)를 export 해 줄 단위로 슬라이스하는 방법이 있으나, 현재 리스크에 비해 과한 리팩터일 수 있다.

- **[INFO]** `plan/in-progress/backend-lint-gate-broken-on-main.md:317-329` 는 "새 계약이 실제 워크플로
  실행 경로(persisted `Workflow({name:"ai-review"})` 스냅샷)에 반영됐는지"를 **이 세션에서는 검증
  불가능**하다고 정직하게 열어 둔 채로 다음 세션의 확인 절차(`grep -c "마크다운 본문만" <persisted script>`)
  를 등재했다. 코드/테스트 자체의 결함은 아니지만, "출력 규약이 실제로 agent 프롬프트에 붙는가" 라는
  E2E 성격의 검증이 아직 어떤 테스트로도 자동화돼 있지 않다는 뜻이다.
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:317-329`
  - 제안: 다음 세션에서 실측 확인 시, 가능하면 그 확인 절차를 1회성 grep 이 아니라 harness 쪽에
    재사용 가능한 스모크 체크로 남기는 것을 고려할 것(재발 시 같은 grep 을 매번 손으로 재현하지
    않도록).

## 확인된 양호 사항

- 신규 unit test 2건(`.claude/tests/test_agent_return.mjs:109-125,127-138`)은 pure function
  (`REPORT_RETURN_CONTRACT` 문자열)만 다뤄 mock 이 전혀 없고, 테스트 간 상태 공유·실행 순서 의존도
  없어 격리가 양호하다. 두 종류의 독립 뮤테이션(스크래치 전체 되돌리기 / 저장소 파일 부분 되돌리기)
  으로 각각 non-vacuous 함을 재확인했다.
- `parseAgentReturn`/`usable`/`inlineReports`/`needPersistList`/`needReadList` 를 검증하는 기존 9개
  테스트는 이번 diff 가 계약 **문구**만 바꾸고 파싱 로직은 그대로 두었으므로 회귀 없이 유효하다
  (13/13 통과 직접 확인).
- 신규 Python 가드 테스트 `test_guard_filename_references_point_at_this_file`
  (`.claude/tests/test_workflow_scripts.py:114-140`)은 이전 라운드(`20_21_06`, `20_46_48`)가 반복
  지적한 "SHARED-BLOCK 마커 밖 로컬 헤더 주석은 드리프트 가드의 구조적 사각지대" WARNING 을 정확히
  닫는다 — 파일명을 하드코딩하지 않고 `Path(__file__).name` 과 대조해 자기 갱신되도록 설계했고,
  `.py` 확장자만 매칭해 `.mjs` 참조와의 오탐도 피했다. `subTest(file=…, line=…)` 로 실패 지점을
  정확히 지목한다. 위 뮤테이션 재현 #2 로 이 테스트가 정확히 겨냥한 정규식/시나리오를 잡아내는 것을
  확인했다.
- `parseAgentReturn` 등 로직에 변경이 없는 `execution-engine.service.ts` (JSDoc-only)·
  `plan/complete/spec-draft-raw-query-results.md` (날짜 오타 1글자)는 기능 변경이 없어 신규 테스트가
  불필요하다는 판단이 타당하다.
- 3개 워크플로 파일(`ai-review.js`/`consistency-check.js`/`merge-coordinate.js`)은 top-level `return`
  때문에 `node --test` 로 직접 로드할 수 없어, verbatim 미러링 여부는 `test_workflow_scripts.py::
  test_every_fan_out_workflow_mirrors_the_block_verbatim` 에 전적으로 의존한다 — 직접 실행해 통과를
  재확인했다(정상, 이번 diff 로 회귀 없음).
- `review/code/2026/08/30/{20_21_06,20_46_48}/**` (RESOLUTION.md·SUMMARY.md·`_retry_state.json`·
  meta.json·per-reviewer `*.md`)는 실행되는 애플리케이션 코드가 아니라 이전 라운드 리뷰 세션의 정적
  기록이므로, 테스트 부재를 지적할 대상이 아니다.

## 요약

이번 diff 의 실질 동작 변경은 리뷰 계약 **문구**(파일 sink vs 반환 메시지 sink 분리, 이전 커밋에서
이미 도입된 것을 이번엔 그대로 두고) + 새 회귀 가드 테스트 1건(파일명 드리프트 사각지대를 닫음) +
`execution-engine.service.ts`/plan 문서의 순수 서술 정정뿐이다. 신규 테스트(mjs 2건 + py 1건) 모두
독립 뮤테이션 재현으로 non-vacuous 함을 직접 확인했고, 격리·가독성·범위 모두 양호하다. 특히 이번
Python 가드 테스트는 두 번의 이전 리뷰 라운드가 지적한 "재발 이력이 있는데 자동 테스트로 안 닫힘"
WARNING 을 정확히 겨냥해 닫았다는 점에서 모범적인 fix-the-cause 패턴이다. 유일하게 남은 커버리지 갭
(`.transaction(` 카운트 자동 가드)은 AST 없이는 유한하게 만들 수 없다는 근거로 의식적으로 유예됐고
그 근거가 커밋/plan 에 명시돼 있어, 재차 WARNING 으로 올리지 않고 확인 기록으로만 남긴다. 검증 중
다른 병렬 리뷰어의 저장소 뮤테이션을 한 차례 우연히 관측했으나 자체 해소됐고 이 diff 의 결함은 아니다.

## 위험도

LOW
