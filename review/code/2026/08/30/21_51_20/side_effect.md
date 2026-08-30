# 부작용(Side Effect) 리뷰

## 검증 절차 (읽기 전용, 저장소 뮤테이션 없음)

- `node --test .claude/tests/test_agent_return.mjs` → **13/13 PASS** (직접 재실행).
- `python3 -m pytest .claude/tests/test_workflow_scripts.py -q` → **6 passed / 17 subtests** (직접 재실행).
- `.claude/workflows/{_lib/agent-return.mjs,ai-review.js,consistency-check.js,merge-coordinate.js}` 를
  직접 `Read` 해 `REPORT_RETURN_CONTRACT`·`parseAgentReturn`·`usable`·`inlineReports`·
  `needPersistList`·`needReadList` 등 함수 시그니처·로직이 이 diff 에서 전혀 바뀌지 않았음을 확인 —
  바뀐 것은 프롬프트 문자열 상수(`REPORT_RETURN_CONTRACT`)와 그 위 주석뿐이다.
- `codebase/backend/.../execution-engine.service.ts` 의 `.transaction(` 카운트를 독립 재현:
  제네릭 포함·주석 제외 방식으로 **정확히 36**(JSDoc 주장과 일치), 제네릭 누락 시 **35**,
  주석 포함(자기참조) 시 파일 자체 `grep -c` 로 **10**(개별 콜백 8 + 이 JSDoc 프로즈 2줄) —
  최신 커밋이 추가한 "39"(주석 포함 전체 스캔) 수치도 별도 grep 방법론상 타당함을 확인.
- `git status --short` → 이 리뷰 세션 자신의 출력 디렉터리(`review/code/2026/08/30/21_51_20/`)만
  untracked, 그 외 저장소 트리 변경 없음.

## 발견사항

- **[INFO]** 이번 호출(`21_51_20`) 자체가 이 diff 가 고치는 **구버전 계약 문구**로 기동됐다 —
  같은 세션에서 5번째 재현
  - 위치: 저장소 파일이 아님(harness 세션 상태). 이번 호출을 감싼 "출력 규약" 메타 지시문 자체가
    증거 — `.claude/workflows/_lib/agent-return.mjs:61-63` 이 이번 diff 에서 **제거하는** 구버전
    3줄("1) 결과를 output_file 에 Write 하세요 (best-effort — 실패해도 아래 2·3 은 반드시 수행).
    / 2) 첫 줄에 `STATUS=<success|fatal> ...` 헤더. / 3) 둘째 줄에 정확히
    `===REPORT_MARKDOWN_BELOW===` 한 줄...")와 이번 호출의 메타 지시문이 글자 그대로 일치한다.
    파일 sink 와 반환 메시지 sink 를 가르는 신 문구("output_file 에는 마크다운 본문만 —
    STATUS/DELIM 넣지 마세요")는 없었다.
  - 상세: `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 "새 계약이 실제 실행 경로에
    붙는지 다음 세션에서 확인" 항목이 이미 이 사실을 추적 중이다. `20_46_48`·`21_12_21`·`21_34_15`
    세 라운드가 이 세션의 persisted `ai-review-wf_*.js` 스크립트 18개가 세션 시작 시점부터
    17300 바이트로 불변임을 측정으로 확정해 뒀고("같은 세션의 새 라운드로는 원리적으로 검증
    불가 — 새로운 top-level 세션에서만 확인된다"), 이번 관측은 그 예측의 **5번째 독립 재현**이다.
  - 판정: 이 diff 가 손대는 코드의 결함이 아니라 harness/세션 캐싱 문제이고, plan 이 이미
    "리뷰 라운드를 근거로 이 체크박스를 닫지 말 것"이라 명시해 뒀으므로 새 액션 아이템으로
    올리지 않는다. `output_file` 은 저장소에 이미 커밋된 이전 라운드 21개 산출물과 일관되게
    정정된 관례(마크다운 본문만, `#` 로 시작)를 따라 작성했다.

- **[INFO]** `REPORT_RETURN_CONTRACT` 재정의는 이 diff 에서 가장 넓은 부작용 표면이다 — 저장소
  전역, 향후 시점 행동을 바꾸지만 정확히 미러링됐다
  - 위치: `.claude/workflows/_lib/agent-return.mjs:48-69`(정본) / `.claude/workflows/ai-review.js:113-134`
    / `.claude/workflows/consistency-check.js:52-73` / `.claude/workflows/merge-coordinate.js:62-83`
    (verbatim 미러 3곳)
  - 상세: 이 문자열 상수는 `ai-review`/`consistency-check`/`merge-coordinate` 세 워크플로가
    기동하는 **모든 향후** fan-out sub-agent 호출의 프롬프트 끝에 덧붙는다. 이번 diff 는 파일
    sink(`output_file`)와 반환 메시지 sink 를 명시적으로 갈라, 이 워크플로를 거치는 모든
    reviewer/checker/analyzer 산출물의 파일 형태를 바꾼다. `parseAgentReturn` 은 여전히 **반환
    텍스트**(`text` 인자)만 파싱하고 파일 내용은 읽지 않으므로, 계약 문구 변경이 기존 파싱
    로직과 결합을 깨지 않는다 — `needReadList` 로 파일을 `Read` 하라고 안내받는 경로도 파일
    내용에서 STATUS 를 벗겨내야 한다는 가정이 없어(SUMMARY 프롬프트에 그런 지시 없음) 회귀
    표면이 아니다. `.claude/tests/test_agent_return.mjs` 로 4곳이 byte-identical 함을 재확인.
  - 판정: 의도된 변경이고 정확히 적용됐다. 조치 불요, 영향 범위만 기록.

- **[INFO]** `execution-engine.service.ts` 는 JSDoc 주석만 바뀌었고 실행 경로에 영향이 없다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` —
    `updateExecutionStatus` 선언 바로 위 JSDoc 블록(diff 게이트 8571-8584), 시그니처는
    diff 밖(불변, `public async updateExecutionStatus(`)
  - 상세: 이번 diff 로 추가·수정된 모든 줄이 공백 또는 `*`(JSDoc 프로즈)로 시작한다 — 함수
    시그니처·바디·호출부·트랜잭션 경계 로직은 diff 에 등장하지 않는다. 직접 파일을 열어
    재확인했다. 이 파일이 유발하는 런타임 부작용, 상태 전이 로직 변경, 새 함수/공개 API 시그니처
    변경 없음.

- **[INFO]** 신규 테스트 2건(`test_agent_return.mjs`)과 신규 서브테스트(`test_workflow_scripts.py`)는
  전부 읽기 전용/순수 함수 검증이다 — 부작용 표면을 넓히지 않았다
  - 위치: `.claude/tests/test_agent_return.mjs:109-125`(step1 검증), `:127-138`(step2·3 검증),
    `.claude/tests/test_workflow_scripts.py:114-140`(`test_guard_filename_references_point_at_this_file`)
  - 상세: 전자 둘은 `REPORT_RETURN_CONTRACT` 문자열을 슬라이스·정규식 매칭만 한다(파일 I/O 없음).
    후자는 `LIB`+`FAN_OUT` 대상 파일을 `Path.read_text()` 로 읽기만 한다 — 파일 생성·수정·삭제,
    전역 상태 변경, 환경 변수, 네트워크 호출 전혀 없음. 직접 `node --test`/`pytest` 로 재실행해
    통과를 확인했다(위 검증 절차).

- **[INFO]** `plan/complete/spec-draft-raw-query-results.md`·`plan/in-progress/update-returning-tuple-shape.md`
  변경은 순수 텍스트(날짜 오기 정정, 참조 문단 추가)이며 코드 실행 경로와 무관하다
  - 위치: `plan/complete/spec-draft-raw-query-results.md:16`, `plan/in-progress/update-returning-tuple-shape.md:243-248`
  - 상세: 전자는 "2026-08-31" → "2026-08-30" 날짜 오기 정정 한 줄. 후자는 self-deadlock JSDoc
    개정 이력을 요약하는 인용문 추가. 둘 다 markdown 산문이며 어떤 코드도 이 파일들을
    파싱하지 않는다(grep 확인 — `plan/**` 을 런타임에 읽는 backend/frontend 코드 없음).

- **[INFO]** 이번 diff 가 새로 커밋하는 `review/code/2026/08/30/{20_21_06,20_46_48,21_12_21,21_34_15}/**`
  하위 파일들은 CLAUDE.md 규약이 지정한 경로 그대로다 — 예상치 못한 파일시스템 부작용이 아니다
  - 위치: 예) `review/code/2026/08/30/20_21_06/meta.json`, `.../21_34_15/_retry_state.json`
  - 상세: 이전 라운드들이 이미 지적한 대로 일부 `meta.json`/`_retry_state.json` 에
    `/Users/gehrig/orca/workspaces/...` 형태의 로컬 절대경로가 이력으로 고정돼 있으나(재확인,
    새 지적 아님), 다른 머신에서 파싱 실패로 이어지지는 않는다 — 참조 불가능한 경로가 남을
    뿐이다.

## 요약

이 diff 의 핵심 부작용은 `REPORT_RETURN_CONTRACT` 재정의 — 세 워크플로(`ai-review`/`consistency-check`/
`merge-coordinate`)가 여는 **모든 향후** fan-out sub-agent 호출의 프롬프트 형태를 바꾸는 저장소
전역·시점 행동 변경이다. 4곳 사본(`_lib` 정본 + 3개 워크플로 미러)이 byte-identical 함을 직접
재확인했고, `parseAgentReturn` 등 실제 파싱 로직은 반환 텍스트만 다루므로 계약 문구 변경이
기존 로직과의 결합을 깨지 않는다. `execution-engine.service.ts` 는 JSDoc 뿐이라 런타임 부작용이
없고(수치 재검증 완료), 신규 테스트는 파일 읽기/순수 문자열 검증만 하는 부작용-없는 코드다.
plan/spec-draft 문서 편집은 순수 텍스트이며 어떤 코드도 그 파일을 파싱하지 않는다. 전역 변수
도입, 함수/공개 API 시그니처 변경, 예기치 못한 파일시스템 쓰기, 환경 변수 읽기/쓰기, 네트워크
호출, 이벤트/콜백 로직 변경은 관찰되지 않았다. 유일하게 반복 관측되는 현상은 이 리뷰 호출
자체가 — 이 세션의 이전 네 라운드와 마찬가지로 — 이 PR 이 고치는 바로 그 구버전 계약 문구로
기동됐다는 점인데(5번째 재현), 이는 코드 결함이 아니라 이미 plan 에 추적 중인 harness 세션
캐싱 특성이고 plan 이 "리뷰 라운드를 근거로 닫지 말 것"이라 명시해 두었으므로 새 액션
아이템으로 올리지 않는다.

## 위험도

LOW
