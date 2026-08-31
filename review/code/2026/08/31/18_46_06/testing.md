# 테스트(Testing) 리뷰

## 검증 방법

정적 분석 외에 실제로 실행/뮤테이션했다 (전부 원복 확인, `git status --short` 로 잔여물 없음 확인).
저장소 파일을 뮤테이션할 때는 규약대로 원본을 scratch 디렉터리에 `cp` 해 둔 뒤 고치고,
`cp` 로 되돌렸다(`git checkout`/`restore` 미사용).

- `.claude/tests/test_consistency_scope_census.py` — `python3 -m unittest`: **14/14 PASS**
  (이전 라운드의 12개 + 이번 커밋(`0883c4e43`)이 추가한 fold-boundary 케이스 2개).
- 위 스위트 대상 `_SCOPE_HITS_DISPLAY_LIMIT = 20` → `100` 으로 뮤테이션(scratch 백업 후 `cp` 복원)
  → `test_over_the_limit_folds_with_the_exact_remainder` 가 **정확히 RED**
  (`'… 외 5건' not found`). 커밋 메시지가 주장한 뮤테이션 결과를 독립적으로 재현·확인했다.
- `codebase/backend/.../workflow-assistant.controller.swagger.spec.ts` — `npx jest`: **2/2 PASS**.
- 위 스위트 대상 `list()` 라우트의 `@ApiUnauthorizedResponse` 데코레이터를 제거(scratch 백업 후
  `cp` 복원) → 두 번째 `it` 가 정확히 RED(`missing` 배열에 `GET /workflow-assistant/sessions` 리포트).
- `chat-channel.dispatcher.spec.ts` — `npx jest`: **43/43 PASS** (주석 전용 변경, 회귀 없음 확인).
- `websocket.service.spec.ts` — `npx jest`: **64/64 PASS** (테스트 설명 문자열의 `§4.4→§4.5` 만
  바뀌었고 단언 로직은 동일함을 확인).
- **`.claude/tests` 전체(`python3 -m unittest discover`, 1098 tests) 를 처음으로 풀 실행** —
  아래 WARNING 은 이 실행에서만 드러났다(개별 파일 단위 실행으로는 안 보인다).

## 발견사항

- **[WARNING]** 이 PR 이 신설한 `.claude/tests/test_consistency_scope_census.py` 가
  `.claude/tests/README.md` 의 "What's covered" 카탈로그에 등재되지 않아, 그 등재를 강제하는
  기존 가드 테스트가 **현재 RED** 다 — 재현 확인.
  - 위치: 실패 지점 `.claude/tests/test_tests_readme_catalog.py:71-77`
    (`CatalogCoverageTest.test_every_test_file_is_documented`). 원인 파일은
    `.claude/tests/test_consistency_scope_census.py`(이 PR 의 신규 파일 #2, 전체 diff 확인 완료 —
    프롬프트엔 diff 가 생략됐지만 실제로는 새 파일이다), 빠진 자리는
    `.claude/tests/README.md` "## What's covered" 표(`test_consistency_orchestrator_state.py` 등
    인접 `test_consistency_*` 항목들이 33~55행 부근에 몰려 있다).
  - 상세: 직접 재현했다 —
    ```
    AssertionError: Lists differ: ['test_consistency_scope_census.py'] != []
    ```
    `grep -n "test_consistency_scope_census" .claude/tests/README.md` 는 0건이다. 이 가드는
    바로 이 종류의 드리프트(신규 테스트 파일이 "무엇을 지키는지" 아무 데도 기록되지 않는 것)를
    막으려고 존재한다고 자기 docstring 에 명시돼 있다("It had reached 9 of 27 files unlisted
    ... before this guard"). 이번 PR 의 마지막 커밋(`0883c4e43`)이 "harness 102 tests" ·
    "docs 가드 3100 tests 통과" 를 검증 근거로 적었지만, 이 파일 단위 검증은 `test_*.py` 를
    개별로 돌렸을 때는 안 보이고 **`unittest discover` 로 스위트 전체를 함께 돌려야만** 노출된다
    — 즉 지금까지의 "통과했다" 서술이 이 축을 실제로 통과시킨 적이 없다.
  - 제안: README.md "## What's covered" 표에 한 행 추가.
    `| \`test_consistency_scope_census.py\` | ... |` — 무엇을 지키는지(census 가 "잘렸다" 와
    "없다" 를 구분한다는 목적, `_count_diff_files`/`_scope_delta_census`/fold 경계/배선)를
    파일 상단 모듈 docstring 에서 그대로 요약해 옮기면 된다. 이 한 줄이면 가드가 GREEN 이 된다.

- **[INFO]** `diff_lines`(구현 diff 줄 수) 값이 여전히 어떤 테스트에서도 실제 숫자로
  단언되지 않음 — 이전 라운드(`review/code/2026/08/31/18_30_55/testing.md`)의 INFO 를 그대로
  carry-over. 이번 커밋(`0883c4e43`)이 반영한 5건의 Warning 목록에 이 INFO 는 포함되지 않았고
  (우선순위 낮음으로 명시적으로 유보), 실제로도 아직 미반영이다.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:527`
    (`diff_lines = diff_text.count("\n") ...`), 대응 테스트
    `.claude/tests/test_consistency_scope_census.py:124-128`
    (`test_present_diff_warns_that_absence_below_means_truncation`)은 `"1개 파일"` 과
    `"예산에 잘렸다"` 문구만 확인하고 `{diff_lines}줄` 부분의 실제 숫자는 단언하지 않는다.
  - 상세: 표시용 부가 정보이고 판정 로직(census 의 핵심 목적인 "잘렸다 vs 없다" 구분)에는
    영향을 주지 않아 낮은 우선순위가 맞다. `ONE_FILE_DIFF` fixture 는 몇 줄인지 이미 알고 있는
    상수라 값 하나 추가하는 비용은 낮다.
  - 제안: `self.assertIn(f"{ONE_FILE_DIFF.count(chr(10))}줄", out)` 형태로 한 줄 추가(선택).

- **[INFO]** `spec-links` 가드가 마크다운 앵커 링크만 검사하고 `§4.x` 류 bare 프로즈 인용을
  검사하지 않는다는 커버리지 갭이, 이번 diff 가 스윕한 절 번호 이동 작업 중 뮤테이션으로 실측
  확인돼 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 새로 등재됐다(이 PR
  의 코드 수정 범위 밖, 문서 백로그 등재만).
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (`spec-links 가드가
    앵커를 검사하지 않는다` 항목 — 신규 등재).
  - 상세: 등재된 실측(`8-notifications.md` 앵커 4건을 존재하지 않는 프래그먼트로 바꾸고
    `spec-links.test.ts` 실행 → **22 passed(GREEN)**, 예측은 RED)을 근거로 삼는다. 이 자체는
    이번 diff 가 만든 결함이 아니라 이번 diff 작업 중 발견해 정직하게 기록해 둔 기존 갭이라
    조치 불요이나, 테스트 관점에서 "회귀를 잡는 가드가 실제로는 이 축을 못 본다" 는 실질적
    커버리지 공백이므로 인지 기록만 남긴다.
  - 제안: 조치 불요(이미 plan 에 후속 항목으로 등재됨). 통합 조율자가 후속 우선순위 판단.

## 회귀 테스트 검증 (변경된 기존 스펙)

- `chat-channel.dispatcher.spec.ts` / `chat-channel.dispatcher.ts` / `types.ts` — 세 파일 모두
  주석/JSDoc 안의 썩은 줄 번호(`line 536`, `line 89`)만 제거하고 §번호·앵커·로직은 그대로다.
  `git diff` 로 직접 대조해 실행 코드·타입 변경 0건을 확인했고, 실행 결과(43/43)로도 재확인했다.
- `websocket-events.types.ts` / `websocket.service.ts` / `websocket.service.spec.ts` — 문서
  주석과 테스트 설명 문자열(`it(...)`)의 `§4.4→§4.5` 텍스트만 바뀌었다. `emitNotificationEvent`
  의 실제 assertion(채널명·payload shape)은 무변경임을 diff 로 확인했고, 실행(64/64)으로 재확인.

## 신규 테스트 설계 품질

- `test_consistency_scope_census.py` 의 `_scope_says()` 헬퍼는 주어("scope(...) 델타")를 명시해
  형제 라인(diff 줄 카운트)과의 문자열 충돌을 피한다 — 이 저장소가 반복 지적해 온 "부정확한
  술어" 결함 클래스를 스스로 방어하는 설계다.
- 신규 fold-boundary 테스트 2건(`test_under_the_limit_lists_every_path_and_does_not_fold` /
  `test_over_the_limit_folds_with_the_exact_remainder`)은 20/25 로 경계를 양쪽에서 가르고,
  "목록은 접혀도 개수(`{n}개 파일`)는 정직해야 한다"는 요구사항을 별도로 단언한다 — 목록 절단과
  카운트 절단을 혼동하는 뮤턴트를 갈라내는 설계다. 위에서 뮤테이션으로 직접 확인.
- `workflow-assistant.controller.swagger.spec.ts` 는 `beforeAll` 로 프로브를 1회만 세우고
  두 `it` 가 그 결과(`operations`, 불변)만 읽는다 — 서로를 오염시키지 않는 독립 실행 구조이며,
  "라우트 7개 전제" 를 별도 `it` 로 분리해 공허 통과(0회 실행 GREEN)를 막는다.

## 요약

이 diff 의 핵심 코드 변경(`_scope_delta_census`/`_count_diff_files`, `workflow-assistant`
401 데코레이터)은 직전 리뷰 라운드(`18_30_55`)의 WARNING 5건을 반영한 후속 커밋(`0883c4e43`)
까지 포함하며, 그 반영 내용(fold 경계 커버리지 추가·매직넘버 상수화)을 이번 라운드에서 독립
재실행·재뮤테이션으로 확인했다 — 둘 다 예측대로 GREEN/RED. chat-channel·websocket 세 파일의
회귀 스펙도 실행 확인 완료. 새로 찾은 것은 이 PR 자체가 만든 잔여 갭 하나다: 신설 테스트 파일이
`.claude/tests/README.md` 카탈로그에 등재되지 않아 기존 가드(`test_tests_readme_catalog.py`)가
**현재 RED** 이고, 이는 개별 파일 실행으로는 드러나지 않고 `unittest discover` 전체 실행에서만
드러난다 — 이번 세션에서 처음 그렇게 돌려 확인했다. 수정은 README 한 행 추가로 끝나는 낮은 비용
이지만, 커밋 메시지의 "docs 가드 통과" 서술이 실제로는 이 축을 시험한 적이 없었다는 뜻이라
WARNING 으로 분류한다. 나머지는 이전에 유보된 저비용 INFO(`diff_lines` 미검증)의 이월과, 이
diff 작업 중 발견해 이미 plan 에 정직하게 등재된 기존 가드 갭(spec-links 앵커 미검사) 인지
기록뿐이다.

## 위험도

MEDIUM
