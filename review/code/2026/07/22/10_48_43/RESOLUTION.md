# RESOLUTION — §A-1 lint-mermaid import fail-open

리뷰: `review/code/2026/07/22/10_48_43/SUMMARY.md` — RISK=LOW, Critical 0, Warning 3.

라우터가 forced 지정한 `scope`·`maintainability` 2명은 이 라운드에서 API connection
error(rate limit 아님)로 결과 미확보였다 → fix 반영 후 fresh 리뷰에서 재실행해 확보한다
(같은 diff 를 건드리므로 stale 재리뷰와 forced-reviewer 완료가 한 번에 해소).

## Warning (3) — 전부 반영

| # | 카테고리 | 조치 |
|---|----------|------|
| 1 | Testing | 두 번째 `await import("mermaid")` catch 가 dead branch(양쪽 dep 부재 시 jsdom catch 가 항상 선점)였다 → `test_lint_mermaid_exit_codes.py` 에 최소 stub jsdom 을 설치해 jsdom 은 성공·mermaid 만 실패시키는 `test_second_import_failure_also_exits_3` 추가. stderr `"could not import mermaid"` 단언으로 **두 번째** catch 가 발화했음을 고정(첫 catch 발화 시 `"could not import jsdom"` 이라 실패). |
| 2 | Requirement | exit code `3` 이 mjs/python/bash 3언어에 독립 하드코딩(MARKER_NAME 과 동일 cross-language 상수 클래스)인데 pinning 테스트 부재 → `ConsumerBindingTest.test_tooling_broken_exit_code_agrees_across_consumers` 추가: 세 소스에서 정규식으로 값 추출·상호 일치 단언. 한 소비처 상수만 드리프트하면 loud fail. |
| 3 | Documentation | `test_lint_mermaid_exit_codes.py` docstring 의 리뷰 경로 날짜 `2026/07/17` → 실제 `2026/07/18`(해당 폴더 `07/17/10_55_35` 부재 확인) 정정. |

## INFO 중 반영한 것

- INFO Documentation #7: `.githooks/pre-commit` exit-3 안내 메시지 괄호 어색함(`... npm install) ).`) → sibling(PostToolUse) 톤으로 정리(`skipped (tooling failed to load).` + 별도 `Reinstall with:` 줄).
- INFO Requirement #3: `plan/in-progress/harness-guard-followups.md` §A W1(10_55_35) 체크박스 `[ ]`→`[x]` + 구현/테스트 요약 갱신.

## INFO 중 미반영(사유)

- INFO Testing #5 (ready+node exit 0 happy-path 실행 테스트 부재): **선재 갭**, 이 diff 이전부터
  존재. 이번 스코프(exit-3 fail-open)와 무관하며 별건. `no_status`/skip 처리.
- INFO Requirement #4 (`new JSDOM()` 생성자·`mermaid.initialize()` 예외, 시그널 종료 음수 rc):
  원 리뷰 스코프 밖(리뷰어도 그렇게 판단). 이번 fix 는 "동적 import 실패"만 좁게 커버. 필요 시
  별도 후속. 과확장은 scope 오염.
- INFO Testing #6 / Side Effect #9/#10, Security #1/#2: 조치 불요로 리뷰어가 명시(트레이드오프
  문서화됨 / 로컬 세션 한정 / 프로덕션 결함 아님).

## 검증

- `python3 -m unittest test_lint_mermaid_exit_codes test_mermaid_lint_ready` → 19 tests OK.
- plan frontmatter(worktree/started/owner) 불변 — 체크박스는 본문이라 plan-frontmatter guard 무영향.
