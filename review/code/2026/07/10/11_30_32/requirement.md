## 발견사항

- **[INFO]** 관련 spec 문서 없음 (spec 누락)
  - 위치: `scripts/report_playwright_flaky.py`, `.github/workflows/e2e.yml`, `.github/workflows/harness-checks.yml`, `codebase/frontend/playwright.config.ts`
  - 상세: `spec/` 전체를 검색해도 이 CI flaky-surfacing 기능을 다루는 문서가 없다. 거버닝 문서는 `plan/complete/e2e-retry-visibility-followup.md`(frontmatter `spec_impact: none`)뿐이며, 이는 제품 요구사항이 아닌 CI 인프라 관측 도구이므로 spec 비대상으로 보는 것이 합리적이다.
  - 제안: 조치 불필요. spec-impact 없음으로 이미 명시돼 있어 정합함.

- **[INFO]** 이전 리뷰(11_02_46) Warning 6건 전량 — 실측 검증 결과 모두 실제로 해소됨
  - 위치: W1 `.github/workflows/harness-checks.yml` paths, W2/W3 `.claude/tests/test_report_playwright_flaky.py` (`WriteStepSummaryTest`, `MainIntegrationTest`), W4 `scripts/report_playwright_flaky.py:main()` + `.github/workflows/e2e.yml` `continue-on-error`, W5 `scripts/report_playwright_flaky.py`/`playwright.config.ts` 주석, W6 `CrossFilePathGuardTest`
  - 상세: `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 실행 결과 182/182 전부 PASS(신규 파서 테스트 19/19 포함, 커밋 메시지 claim 과 일치). `test_unexpected_schema_does_not_crash`(`{"suites": "표준아님"}`)가 실제로 `find_flaky` 내부에서 `AttributeError`를 유발하고 `main()`의 blanket `try/except`가 이를 흡수해 `rc=0`을 반환하는 것을 stdout 로그로 직접 확인(`AttributeError("'str' object has no attribute 'get'")` 출력 후 종료 0). `CrossFilePathGuardTest`도 실제 정규식 매칭으로 `DEFAULT_REPORT` == e2e.yml 인자 == `playwright.config.ts` outputFile 3자 일치를 검증하며 PASS. dangling plan 경로(`plan/in-progress/...`) 참조는 실제 코드/문서(스크립트 docstring, `playwright.config.ts` 주석, `PROJECT.md`)에서 전부 `plan/complete/...`로 갱신됐고, 잔존 참조는 `review/**` 히스토리 산출물뿐(과거 시점 기록이라 정당).
  - 제안: 조치 불필요 — fresh 검증 결과 clean.

- **[INFO]** `find_flaky`의 `line` 파싱도 `_safe_int`로 방어되도록 확장됐으나(이전엔 `int(spec.get("line") or 0)`가 try/except 밖에 있던 latent 버그), 이를 직접 겨냥한 비-정수 `line` 회귀 테스트는 없음(간접적으로 `SafeIntTest`가 `_safe_int` 자체를 검증)
  - 위치: `scripts/report_playwright_flaky.py` (`find_flaky`, `"line": _safe_int(spec.get("line"), 0)`)
  - 상세: 기능적으로는 개선(과거엔 비정수 line 값이 들어오면 미포착 예외로 죽는 latent 버그였음)이지만, `test_non_integer_retry_is_defended`처럼 `line`에 대한 전용 케이스가 빠져 있어 이 개선이 회귀로부터 완전히 잠기지 않았다.
  - 제안: 낮은 우선순위 — `_iter_specs`/`find_flaky` 케이스에 비정수 `line` fixture 하나 추가 권장(필수 아님, `_safe_int` 단위테스트로 대부분 커버됨).

- **[INFO]** `RenderMarkdownTest.test_flaky_table_lists_each`에서 `self.assertIn("테스트 2", md)` 단언이 제거됨(diff 로 확인, 이번 커밋 목적(Warning 6건 조치)과 무관한 변경)
  - 위치: `.claude/tests/test_report_playwright_flaky.py:150` 부근
  - 상세: 여전히 `flaky 2건`·양쪽 위치(`e2e/a.spec.ts:12`, `e2e/b.spec.ts`)·`테스트 1`은 검증하지만, 두 번째 entry 의 title 렌더는 더 이상 명시적으로 검증하지 않음. 기능 결함은 아니고 순수 커버리지 미세 감소.
  - 제안: 조치 불필요 수준이나, 원한다면 `assertIn("테스트 2", md)` 복원.

## 요약

리뷰 대상은 이전 코드 리뷰 세션(`review/code/2026/07/10/11_02_46`)이 지적한 Warning 6건(harness-checks 트리거 갭·`_write_step_summary`/`main()` happy-path 미검증·"항상 exit 0" 불변식 미보장·dangling plan 경로·리포트 경로 3중 하드코딩)에 대한 조치 커밋이다. 실제로 unittest를 재실행해 6건 모두가 구조적으로(단순 문서화가 아니라) 해소됐음을 직접 확인했다: harness-checks.yml paths 등재로 회귀 게이트가 실제 작동, `main()`의 blanket try/except + e2e.yml `continue-on-error`로 "항상 exit 0" 불변식이 이제 코드 레벨로 보장(비정형 스키마 입력에 대해 실측 검증), `_write_step_summary`/`main()` 통합 흐름이 신규 테스트로 커버, plan 경로 참조가 전부 `plan/complete/`로 정합, 리포트 경로 3곳(`DEFAULT_REPORT`/e2e.yml 인자/`outputFile`) 이 cross-file 가드로 실제 대조됨. spec 은 이 영역을 다루지 않으며 governing plan(`spec_impact: none`)과 일치해 spec fidelity 이슈 없음. 발견된 것은 전부 INFO 수준의 미세한 잔여 갭(비정수 `line` 전용 테스트 부재, title2 단언 제거)뿐으로 기능·비즈니스 로직·에러 시나리오·반환값 관점에서 실질적 결함은 없다.

## 위험도
LOW