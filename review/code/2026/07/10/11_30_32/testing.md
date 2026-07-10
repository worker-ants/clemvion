# 테스트(Testing) 리뷰

대상: `refactor(ci): flaky surfacing 리뷰(11_02_46) Warning 6 조치` 커밋. 이전 리뷰(11_02_46)의 Warning 6건(테스트 커버리지·게이팅·정합 갭)을 조치하는 후속 커밋으로, `.claude/tests/test_report_playwright_flaky.py`(8→19 케이스)·`scripts/report_playwright_flaky.py`(헬퍼 추출+blanket try/except)·`.github/workflows/{e2e,harness-checks}.yml`·`PROJECT.md`·`playwright.config.ts` 주석을 함께 변경한다.

## 발견사항

- **[WARNING]** `test_flaky_table_lists_each` 가 2건 엔트리를 만들어 렌더하면서 두 번째 엔트리("테스트 2")의 title 렌더 검증을 제거함 — 다건(multi-entry) 렌더 커버리지 회귀
  - 위치: `.claude/tests/test_report_playwright_flaky.py:141-150` (`RenderMarkdownTest.test_flaky_table_lists_each`)
  - 상세: diff 상 `- self.assertIn("테스트 2", md)` 한 줄이 삭제됐다. `entries` 는 여전히 `테스트 1`/`테스트 2` 2건을 구성하고 `flaky 2건` 문자열 검증은 남아있지만, 두 번째 행이 실제로 렌더됐는지(제목 문자열 포함 여부)는 더 이상 검증되지 않는다. 이번 커밋의 목적(W1~W6 조치+견고성 강화)과 무관한 순수 삭제라 리팩터링 부산물로 보이며, `render_markdown` 이 다건 루프에서 두 번째 이후 행을 누락시키는 회귀를 이 테스트가 더 이상 잡지 못한다.
  - 제안: `self.assertIn("테스트 2", md)` (또는 `` `e2e/b.spec.ts` `` 행 전체의 title 포함 여부)를 복원.

- **[INFO]** `_emit_annotations`(`::warning::` 어노테이션 출력 + `_gha_escape` 적용)에 대한 직접/전용 테스트 부재
  - 위치: `scripts/report_playwright_flaky.py` `_emit_annotations`, `.claude/tests/test_report_playwright_flaky.py` `MainIntegrationTest`
  - 상세: `GhaEscapeTest` 는 `_gha_escape` 자체는 검증하지만, `_emit_annotations` 가 `file`/`title` 양쪽에 이를 실제로 적용해 `::warning file=...,line=...::` 포맷으로 출력하는지는 어떤 테스트도 stdout 을 캡처해 확인하지 않는다(`MainIntegrationTest` 는 step summary 파일 내용만 검사). title 에 개행이나 `%` 가 섞인 실제 e2e 스펙이 있을 경우 어노테이션이 깨지는 회귀를 잡을 테스트가 없다.
  - 제안: `contextlib.redirect_stdout` 으로 `main()` 또는 `_emit_annotations` 호출 결과를 캡처해 `::warning file=...,line=N::flaky (...): <escaped-title>` 포맷을 단언하는 케이스 추가.

- **[INFO]** `GhaEscapeTest` 가 함수가 명시적으로 처리하는 `\r`(캐리지 리턴) 케이스를 커버하지 않음
  - 위치: `.claude/tests/test_report_playwright_flaky.py:180-183` (`GhaEscapeTest`), `scripts/report_playwright_flaky.py:_gha_escape`
  - 상세: `_gha_escape` 는 `%`/`\r`/`\n` 3종을 escape 하는데 테스트는 `\n`/`%` 2종만 검증. `\r` 처리 회귀(예: 3-way `.replace` 체이닝 순서 변경 시 상호작용 버그)를 못 잡음.
  - 제안: `self.assertEqual(flaky._gha_escape("a\rb"), "a%0Db")` 케이스 추가.

- **[INFO]** `CrossFilePathGuardTest` 의 cross-file 정합 검증이 정규식 기반 텍스트 매칭이라 소스 포맷팅(quote 스타일·공백)에 결합됨
  - 위치: `.claude/tests/test_report_playwright_flaky.py:225-241`
  - 상세: `r'"json",\s*\{\s*outputFile:\s*"([^"]+)"'` 와 `r"report_playwright_flaky\.py\s+(\S+)"` 는 실제 경로 값이 아니라 소스 텍스트의 정확한 표기(따옴표 종류, 줄바꿈 없음 등)에 의존한다. prettier/eslint --fix 등이 `playwright.config.ts` 의 reporter 배열 포맷(예: 줄바꿈 추가, single→double quote 전환은 없지만 개행 삽입 등)을 바꾸면 실제 경로는 안 바뀌었는데도 정규식 미매치로 테스트가 실패해(오탐 CI 차단) 원래 목적(경로 drift 감지)과 무관한 잡음을 유발할 수 있다.
  - 제안: 현재로선 실익 대비 낮은 리스크(포맷터가 이 스타일을 잘 안 건드림)라 필수 아님. 다만 실패 시 assert message 가 "경로 못 찾음"과 "경로 불일치"를 구분하도록 이미 잘 되어 있어(`assertIsNotNone` 별도 메시지), 향후 실패 원인 진단은 용이함 — 조치 불필요, 참고만.

- **[INFO]** `test_unexpected_schema_does_not_crash` 가 `rc == 0` 만 단언하고, 예외 발생 시 step summary 가 (부분 상태로) 기록되지 않았는지는 검증하지 않음
  - 위치: `.claude/tests/test_report_playwright_flaky.py:216-219`
  - 상세: blanket `try/except` 가 `find_flaky` 호출 시점에 예외를 던지므로 현재 구현상 `_write_step_summary` 는 호출되지 않는다. 하지만 이 테스트는 그 사실(= 부분 side-effect 없음)을 명시적으로 고정하지 않아, 향후 `main()` 내부 순서가 바뀌어 "일부 처리 후 예외"가 나는 경우를 회귀로 못 잡는다.
  - 제안: 이번 `_run_main` 헬퍼가 이미 `written` 을 반환하므로 `self.assertEqual(written, "")` 한 줄 추가로 저비용 보강 가능.

- **[INFO]** `continue-on-error: true` (`e2e.yml`) 추가는 어떤 테스트로도 가드되지 않음
  - 위치: `.github/workflows/e2e.yml` (`Surface flaky (retry-passed) tests` step)
  - 상세: 이는 W4 의 "이중 방어" 중 2차 방어선(1차는 `main()` blanket try/except, 이미 `test_unexpected_schema_does_not_crash` 로 테스트됨)이다. YAML 필드라 unittest 로 직접 검증하긴 부자연스럽고 1차 방어가 실질적으로 예외를 흡수하므로 실무 영향은 낮지만, 향후 이 줄이 실수로 제거돼도 어떤 회귀 테스트도 알려주지 않는다.
  - 제안: 조치 불필요(낮은 우선순위). 원한다면 `CrossFilePathGuardTest` 와 유사하게 해당 step 블록에 `continue-on-error: true` 존재를 정규식으로 확인하는 케이스 추가 가능.

## 요약

이전 리뷰(11_02_46) 가 지적한 Warning 6건(harness-checks 트리거 갭·`_write_step_summary`/`main()` happy-path 미검증·blanket exception 부재·dangling plan 경로·리포트 경로 3중 하드코딩)을 모두 신규/보강 테스트로 실질적으로 조치했다 — 파서 테스트가 8→19로 늘었고, `_safe_int`/`_max_flaky_retry`/`_gha_escape`/`_load_report` 헬퍼 추출은 순수 함수 단위 테스트 용이성을 개선했으며, `tempfile`+`mock.patch.dict` 를 이용한 실제 파일 I/O·env 격리 방식은 mock 남용 없이 적절하다. 다만 diff 를 정밀히 보면 `test_flaky_table_lists_each` 에서 다건 렌더 검증 한 줄이 의도치 않게 삭제되어(WARNING) 이 회귀 조치 커밋 자체가 작은 커버리지 후퇴를 동반했다. 그 외에는 `_emit_annotations`/`\r` escape/CI YAML 2차 방어선 등 저비용으로 보강 가능한 INFO 수준 갭들이다. 전반적으로 테스트 격리·가독성·구조는 양호하다.

## 위험도
LOW
