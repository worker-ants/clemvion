# 변경 범위(Scope) 리뷰 결과

## 검토 방법

`prompt_file` 의 17개 파일 diff를 점검하고 `git show --stat 926bb1ecf` 로 실제 커밋 경계를
교차 검증했다. 이 커밋(`926bb1ecf`, `refactor(ci): flaky surfacing 리뷰(11_02_46) Warning 6
조치`)은 직전 세션(`review/code/2026/07/10/11_02_46/`)이 지적한 Warning 6건(W1~W6) + 명시된
INFO 항목들에 대한 fix 커밋이며, 커밋 메시지가 조치 항목을 W1~W6/INFO 로 정확히 열거하고
있어 그 목록을 기준으로 각 파일 변경을 대조했다.

## 발견사항

- **[WARNING]** 커밋 메시지에 언급되지 않은 기존 테스트 assertion 삭제 — 커버리지 조용한 축소
  - 위치: `.claude/tests/test_report_playwright_flaky.py` `RenderMarkdownTest.test_flaky_table_lists_each`
  - 상세: diff 는 `self.assertIn("테스트 2", md)` 한 줄을 제거했다. 커밋 이전 코드를 확인한 결과
    (`git show 926bb1ecf~1:.claude/tests/test_report_playwright_flaky.py`) 해당 테스트의
    `entries` fixture 는 여전히 `테스트 1`/`테스트 2` 두 항목을 그대로 유지하므로, 이 assertion
    제거는 fixture 축소에 따른 정리가 아니라 **검증 자체를 뺀 것**이다. 커밋 메시지의 W1~W6/INFO
    목록 어디에도 `render_markdown` 의 다중 항목 표시 검증을 줄이라는 항목은 없어, 의도된 조치
    범위 밖의 부수 변경으로 보인다. 실무 영향은 낮음(같은 테스트가 `flaky 2건`·두 위치·`테스트 1`
    은 여전히 검증하므로 완전 무방비는 아니다)이나, 두 번째 항목의 title 렌더 검증이 조용히
    빠졌다는 점은 향후 회귀(예: 다중 항목 중 마지막 행이 잘리는 버그)를 놓칠 여지를 만든다.
  - 제안: 의도된 정리라면 커밋 메시지에 사유를 남기고, 아니라면 `self.assertIn("테스트 2", md)`
    복원.

- **[INFO]** 기존에 이미 통과하던 테스트 3곳의 순수 포맷팅(멀티라인→원라인) 축약이 실질 변경과
  섞여 있음
  - 위치: `.claude/tests/test_report_playwright_flaky.py`
    — `RenderMarkdownTest.test_no_flaky_message`(`md = ...; self.assertIn(...)` 2줄 →
    `self.assertIn(..., flaky.render_markdown([]))` 1줄), `test_pipe_in_title_is_escaped`
    (멀티라인 호출 → 단일 라인), `MainIntegrationTest.test_missing_report_returns_zero`
    (`self.assertEqual(...)` 멀티라인 → 단일 라인, 신설 클래스로 이동하며 같은 축약 적용)
  - 상세: 세 곳 모두 동작·기대값 변경 없는 순수 줄바꿈 정리다. 커밋 메시지의 W1~W6/INFO 항목
    중 이런 리포맷팅을 언급한 것은 없어 stated scope 밖의 곁가지 정리로 보인다. `test_missing_
    report_returns_zero` 는 `MainSmokeTest` → `MainIntegrationTest` 로의 클래스 이동(W3 의도된
    통합, 정당)과 함께 이뤄져 그 자체는 문제 없으나, 이동과 무관한 줄바꿈 축약까지 같은 hunk 에
    끼어 diff 검토를 약간 무겁게 만든다.
  - 제안: 조치 불필요(무해). 향후 리팩터 커밋에서는 "동작 무관 포맷팅"과 "신규 케이스 추가"를
    분리하면 diff 가독성이 좋아진다.

- **[INFO]** `_spec()` 헬퍼 docstring 축약 — 파라미터 설명 손실
  - 위치: `.claude/tests/test_report_playwright_flaky.py:75-81`
  - 상세: 기존 docstring 은 `status`/`retries` 파라미터의 의미를 각각 한 줄로 설명했는데, 이번
    diff 는 이를 `"""Playwright JSON 리포트의 spec 노드 하나(단일 test)."""` 한 줄로 축약했다.
    커밋 메시지의 INFO 목록(escape·재시도 flaky-only·타입힌트·`_safe_int`/`_max_flaky_retry`
    추출·PROJECT.md·main docstring)에 이 헬퍼 docstring 간소화는 포함돼 있지 않다. 실질 영향은
    미미(테스트 헬퍼 내부 문서)하나, 의도된 조치 목록 밖의 문서 손실이라는 점에서 참고용으로
    기록한다.
  - 제안: 조치 불필요(사소). 필요 시 파라미터 설명 복원.

- **[NONE]** `review/code/2026/07/10/11_02_46/*` (11개 파일) 신규 추가는 스코프 위반 아님
  - 위치: `review/code/2026/07/10/11_02_46/{SUMMARY,RESOLUTION,meta,_retry_state,documentation,
    maintainability,requirement,scope,security,side_effect,testing}.{md,json}`
  - 상세: 이 파일들은 이번 fix 가 대상으로 하는 바로 그 이전 리뷰 세션의 산출물이다.
    `review/` 는 gitignore 대상이 아니고, 개발자가 `RESOLUTION.md` 를 작성해 조치 내역을 남기는
    것이 프로젝트 표준 워크플로(SUMMARY/RESOLUTION 도 커밋 대상)이므로, 리뷰를 유발한 fix 커밋과
    함께 이 리뷰 아티팩트들을 커밋하는 것은 관례에 부합하는 정상 동작이며 무관한 파일 추가가
    아니다.
  - 제안: 조치 불필요.

- **[NONE]** 나머지 5개 실질 코드/설정 파일 변경은 커밋 메시지의 W1~W6/INFO 항목과 1:1 대응
  - 위치: `.github/workflows/harness-checks.yml`(W1) · `.github/workflows/e2e.yml`(W4 의
    `continue-on-error`) · `PROJECT.md`(INFO 등재) · `codebase/frontend/playwright.config.ts`
    (W5, dangling plan 경로 1곳) · `scripts/report_playwright_flaky.py`(W4/W6/INFO 전체 —
    `_safe_int`/`_max_flaky_retry` 추출, 타입힌트, `_gha_escape`, blanket try/except, docstring,
    `plan/in-progress`→`plan/complete` 경로 정정)
  - 상세: 각 hunk 를 커밋 메시지 항목과 대조한 결과 기능과 무관한 리팩토링·설정 변경·미사용
    import 추가는 없었다. `scripts/report_playwright_flaky.py` 에 추가된 `from typing import
    Any, Iterator` 는 새로 추가된 타입힌트에서 실제로 사용된다(미사용 import 아님).
  - 제안: 조치 불필요.

## 요약

이번 커밋은 직전 리뷰 세션(11_02_46)이 지적한 Warning 6건과 명시된 INFO 항목들을 좁게, 그리고
거의 전량 정확히 대응하는 fix 커밋이다. `scripts/report_playwright_flaky.py`·두 워크플로
파일·`PROJECT.md`·`playwright.config.ts`·리뷰 아티팩트 11개는 모두 커밋 메시지가 열거한 조치
항목 또는 표준 리뷰 워크플로 관례에 정확히 대응해 의도 이상의 변경이나 무관한 파일 수정은
없었다. 다만 테스트 파일(`test_report_playwright_flaky.py`) diff 안에 (1) 커밋 메시지에 없는
기존 assertion(`테스트 2` 문자열 검증) 삭제 1건과 (2) 동작 무관 순수 포맷팅 축약 3건 + docstring
축약 1건이 실질 변경과 뒤섞여 있다 — 전자는 조용한 커버리지 축소로 WARNING, 나머지는 무해한
곁가지 정리로 INFO 처리한다. 전체적으로 스코프 일탈의 정도는 경미하다.

## 위험도
LOW
