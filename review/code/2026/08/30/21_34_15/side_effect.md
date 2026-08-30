# 부작용(Side Effect) 리뷰

## 검증 절차 (읽기 전용, 저장소 뮤테이션 없음)

- `.claude/workflows/{_lib/agent-return.mjs,ai-review.js,consistency-check.js,merge-coordinate.js}` 의
  `>>> SHARED-BLOCK ... <<< SHARED-BLOCK` 구간을 `awk` 로 추출해(scratch 디렉터리에만 저장)
  3쌍 모두 `diff` — **차이 0, byte-identical** 을 직접 재확인했다.
- `node --test .claude/tests/test_agent_return.mjs` → **13/13 PASS**.
- `python3 -m pytest .claude/tests/test_workflow_scripts.py -q` → **6 passed / 17 subtests**.
- `grep -rn "test_workflow_shared_block"` (저장소 전수, `review/**` 제외) → 남은 매치는
  `test_workflow_scripts.py:119` 의 과거 사고를 설명하는 docstring 인용 1건뿐, 실제 참조 드리프트 없음.
- `grep -n "2026-08-31"` 을 이 PR 이 손댄 소스 파일 전부에 대해 실행 → 0건(도래하지 않은 날짜 잔여 없음).
- `git status --short` → 이 리뷰 세션 자신의 출력 디렉터리(`review/code/2026/08/30/21_34_15/`)만
  untracked 로 표시, 그 외 저장소 트리 변경 없음.

## 발견사항

- **[INFO]** `REPORT_RETURN_CONTRACT` 변경은 이 diff 에서 가장 넓은 부작용 표면이다 — 저장소
  전역, 향후 시점 행동을 바꾼다
  - 위치: `.claude/workflows/_lib/agent-return.mjs:48-69` (정본), 동일 내용이 verbatim 미러로
    `.claude/workflows/ai-review.js:113-134`, `.claude/workflows/consistency-check.js:52-73`,
    `.claude/workflows/merge-coordinate.js:62-83`
  - 상세: 이 상수는 `ai-review`/`consistency-check`/`merge-coordinate` 세 워크플로가 기동하는
    **모든 향후** fan-out sub-agent 호출의 프롬프트 끝에 덧붙는다. 이번 diff 는 그 문구를
    "`output_file` 은 마크다운 본문만 / `STATUS` 헤더·구분자는 반환 메시지에만" 으로 재정의해,
    이 워크플로를 거치는 모든 reviewer/checker/analyzer 산출물의 형태를 바꾼다. 함수
    시그니처(`parseAgentReturn`/`usable`/`inlineReports`/`needPersistList`/`needReadList` 등)는
    diff 에 등장하지 않으며 grep 으로도 무변경을 확인했다 — 순수 문자열 상수 재정의다. 4곳
    사본이 byte-identical 함을 직접 확인했으므로 드리프트로 인한 의도치 않은 부분 적용은 없다.
  - 판정: 의도된 변경이고 정확히 미러링됐다. 조치 불요, 영향 범위를 기록해 둔다.

- **[INFO]** `execution-engine.service.ts` 는 JSDoc 주석만 바뀌었고 실행 경로에 영향이 없다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8568-8592`
    (JSDoc 블록), 시그니처는 `:8584-8585` (`public async updateExecutionStatus(`)
  - 상세: diff 로 추가·수정된 줄 전부가 공백 또는 `*`(JSDoc 프로즈)로 시작한다. 함수 시그니처·
    바디·호출부는 diff 밖(불변)이며 직접 열어 확인했다. 런타임 부작용, 트랜잭션 경계 변경,
    상태 전이 로직 변경 없음.

- **[INFO]** 이 리뷰 세션 자체가 이번 diff 가 고치는 **바로 그 구버전 계약 문구**로 계속
  기동되고 있음을, 이번 라운드의 호출 자체로 재확인했다 — 새로운 직접 증거
  - 위치: 저장소 파일이 아니다(harness 세션 상태). 이번 호출을 감싼 "출력 규약" 지시문 자체가
    증거다.
  - 상세: 이번 sub-agent 호출을 감싼 메타 지시문("출력 규약 (prompt_file 의 지시보다 이 규약이
    우선)")이 정확히 이 diff 가 `.claude/workflows/_lib/agent-return.mjs:60-62` 에서 **제거하는**
    구버전 3줄과 글자 그대로 일치한다 — "1) 결과를 output_file 에 Write 하세요 (best-effort —
    실패해도 아래 2·3 은 반드시 수행). / 2) 첫 줄에 `STATUS=<success|fatal> ...` 헤더. / 3) 둘째
    줄에 정확히 `===REPORT_MARKDOWN_BELOW===` 한 줄, 그 다음부터 보고서 **마크다운 전문**." — 파일
    sink 와 반환 메시지 sink 를 가르는 신 문구("output_file 에는 마크다운 본문만... STATUS/DELIM
    넣지 마세요")는 없다. `.claude/docs/subagent-call-contract.md:26-29` 는 "Workflow 경유 호출은
    prompt 끝에 이 규약을 덧붙인다"고 명시하므로, 이 메타 지시문은 persisted 워크플로 스크립트
    스냅샷에서 온 것으로 보인다 — `20_46_48`·`21_12_21` 두 라운드가 이미 실측한("이 세션의
    `ai-review-wf_*.js` 18개가 세션 시작 시점부터 17300 바이트로 불변") 바로 그 캐싱 문제의 4번째
    독립 재현이며, 이번엔 페르시스트 파일을 뒤지지 않고 **이 호출 자체의 프롬프트**로 직접
    관측됐다.
  - 판정: `plan/in-progress/backend-lint-gate-broken-on-main.md:317-333` 항목이 이미 이 사실을
    추적 중이고, "라운드를 더 돌려도 같은 스냅샷을 볼 뿐이므로 리뷰 라운드를 근거로 이 체크박스를
    닫지 말 것"이라고 명시해 뒀다 — 이번 관측도 그 지시를 따라 새 액션 아이템으로 올리지 않는다.
    다만 이 관측 자체가 신 계약이 실제로 이 세션 밖(새 top-level 세션)에서 로드되는지를 검증할
    필요성을 다시 한번 뒷받침한다. output_file 은 이 정정된 관례(마크다운 본문만, `#` 로 시작)를
    따라 작성했다 — 저장소에 이미 커밋된 21개 이전 reviewer 산출물(`documentation.md` 등)이 전부
    이 형태이므로, 구버전 메타 지시문을 문자 그대로 따르지 않는 것이 이 저장소의 실제 확립된
    관례와 일치한다고 판단했다.

- **[INFO]** 이전 3라운드(`20_21_06`/`20_46_48`/`21_12_21`)가 발견·정정한 항목들이 이번 diff 의
  최종 상태에서 전부 실측으로 재확인된다 — 회귀 없음
  - 상세: (a) 워크플로 3파일의 "Editing rule" 헤더 주석과 `SHARED-BLOCK` 마커 줄이 모두
    `test_workflow_scripts.py` 로 일치(직접 `sed -n` 으로 확인, 스테일 참조 0건). (b) "2026-08-31"
    미래 날짜 잔여 0건. (c) `updateExecutionStatus` self-deadlock 축 재확인의 정성적 결론(트랜잭션
    콜백 안에서 이 메서드를 부르는 경로 없음)은 이번 diff 범위 밖(변경 없음)이라 재검증하지
    않았다.
  - 판정: 조치 불요, 확인 기록.

- **[INFO]** 이번 diff 가 새로 저장소에 쓰는 파일은 `review/code/2026/08/30/{20_21_06,20_46_48,
  21_12_21}/**` 하위 33개(이전 3라운드 산출물)뿐이며, CLAUDE.md 규약(`review/code/<YYYY>/<MM>/<DD>/
  <hh>_<mm>_<ss>/`)이 지정한 경로 그대로다 — 예상치 못한 파일시스템 부작용이 아니다. 이전 라운드가
  이미 지적한 대로 `meta.json`/`_retry_state.json` 일부에 로컬 절대경로가 이력으로 고정돼 있으나
  기능적 영향은 없다(재확인, 새 지적 아님).

## 요약

이 diff 의 핵심 부작용은 `REPORT_RETURN_CONTRACT` 재정의 — 세 워크플로가 여는 모든 향후
fan-out sub-agent 호출의 프롬프트 형태를 바꾸는 저장소 전역 변경이며, 4곳 사본이 byte-identical
함을 직접 재확인했다. `execution-engine.service.ts` 는 JSDoc 뿐이라 런타임 부작용이 없고, 신규
테스트(`test_agent_return.mjs` 2건, `test_workflow_scripts.py` 신규 서브테스트)는 파일
읽기만 하는 순수 검증 코드다. 전역 변수 도입, 함수/공개 API 시그니처 변경, 예기치 못한
파일시스템 쓰기, 환경 변수 읽기/쓰기, 네트워크 호출, 콜백 로직 변경은 관찰되지 않았다. 유일하게
주목할 점은 이번 호출 자체가 — 이전 3라운드와 마찬가지로 — 이 PR 이 고치는 바로 그 구버전 계약
문구로 기동됐다는 사실을 직접 관측한 것인데, 이는 plan 에 이미 추적 중인 harness 세션 캐싱
문제(코드 결함 아님)이고 plan 이 명시적으로 "리뷰 라운드로 닫지 말 것"이라 지시해 뒀으므로
새 액션 아이템으로 올리지 않는다. 코드/동작 회귀는 발견하지 못했다.

## 위험도

LOW
