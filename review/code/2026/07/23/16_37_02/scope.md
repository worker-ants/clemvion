# 변경 범위(Scope) 리뷰

## 발견사항

없음 (Critical/Warning/Info 대상 없음).

## 참고 (판단 근거, non-blocking)

- **`.claude/tests/README.md` 의 10행 추가가 스코프 내인지 검증**: diff 는 `test_tests_readme_catalog.py`
  1건 외에 9개 기존 테스트 파일(`test_plan_guard.py`, `test_guard_review_before_push_main.py`,
  `test_push_guard_allowlist.py`, `test_lint_mermaid_exit_codes.py`, `test_run_test_watchdog.py`,
  `test_report_playwright_flaky.py`, `test_check_e2e_playwright_config.py`,
  `test_consistency_impl_done.py`, `test_consistency_target_validation.py`)의 카탈로그 행도 함께
  추가한다. `git log --diff-filter=A` 로 이 9개 파일이 이번 커밋(695ed3d95) 이전(2026-06-19~2026-07-23
  범위)에 이미 존재했음을 확인했다 — 즉 이번 diff 가 새로 만든 파일이 아니라 기존에 README 카탈로그
  누락 상태였던 파일들이다. `plan/in-progress/harness-guard-followups.md` 의 해당 항목이 명시적으로
  "실측 27개 중 9개 미등재… 누락 10행 등재"라고 목표를 서술하므로, 이 9행 추가는 부수적 리팩토링이
  아니라 이번 작업이 닫으려는 결함 그 자체다. Scope 위반 아님.
- **plan 체크박스 diff**: `plan/in-progress/harness-guard-followups.md` 는 정확히 두 항목(W4, README
  카탈로그 신규 항목)만 `[ ]` → `[x]` 로 바뀌고 설명이 덧붙었다. 같은 문서 내 다른 미완료 항목(W1,
  W3, W8 등)은 무변경 — 관련 없는 체크박스를 함께 건드리지 않았다.
- **`test_mermaid_lint_ready.py`**: 파일 끝에 `PostToolUseImportFailOpenTest` 클래스 1개만 순수
  추가(fixture 셋업 + 테스트 2건). 기존 4개 클래스(`IsReadyTest`, `ConsumerBindingTest`,
  `PostToolUseExecutionTest`, `PreCommitExecutionTest`)에는 재포맷·리팩토링·주석 변경이 전혀 없다.
  (프롬프트 상 diff 블록과 전체 파일 컨텍스트 블록에 같은 클래스가 두 번 나오는 것처럼 보이나, 이는
  "변경분만" 뷰와 "최종 전체 파일" 뷰가 같은 신규 클래스를 각각 표시하는 프롬프트 조립 방식 때문이며,
  실제 파일에서 `grep -n "^class "` 로 클래스 정의가 정확히 5개·중복 없음을 확인했다.)
- **`test_tests_readme_catalog.py`(신규 파일)**: README 카탈로그 양방향 정합성만 검사하는 좁은
  스코프. `ParserSanityTest`(파서 자체의 vacuity 방지)까지 포함하나, 이는 프로젝트 컨벤션(손수 짠
  파서는 sanity 테스트로 "빈 결과=항진명제"를 차단해야 한다는 저장소 반복 패턴, 예:
  `test_dependabot_npm_coverage.py`)과 일치하는 범위이지 과잉 기능 확장이 아니다.
- **임포트/설정**: 신규 클래스가 쓰는 `os`/`shutil`/`subprocess`/`sys`/`tempfile`/`json`은 파일에
  이미 임포트돼 있어 추가 임포트가 없다. 설정 파일(`.github/**`, `package.json` 등) 변경 없음.
- **diff 완전성 검증**: `git diff origin/main --stat` 로 실제 커밋(695ed3d95)의 변경 파일 4개가
  리뷰 대상 4개 파일과 정확히 일치함을 확인 — 프롬프트에 누락된 무관 파일 변경 없음.

## 요약

4개 파일 변경(신규 테스트 파일 1개, 기존 테스트 파일에 클래스 1개 추가, README 카탈로그 10행 추가,
plan 체크박스 2건 갱신)이 `plan/in-progress/harness-guard-followups.md` 의 W4(import fail-open 실행
테스트) + README 카탈로그 drift 항목과 정확히 1:1 대응한다. README 에 9개 기존 파일의 행이 함께
추가되지만 이는 해당 항목이 명시한 목표(누락 10행 등재) 자체이지 스코프 이탈이 아니다. 무관한 파일
수정, drive-by 리팩토링, 포맷팅 잡음, 불필요한 임포트/주석/설정 변경 없음. 매우 타이트하게 스코프된
변경.

## 위험도

NONE
