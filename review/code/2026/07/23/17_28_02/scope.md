# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** 차단 메시지 `worktree:` 줄 추가는 핵심 로직 수정을 넘어서는 부수 개선
  - 위치: `.claude/hooks/guard_review_before_push.py` L447 (`_REVIEW_MSG`), L470 (`_PLAN_MSG`), L516/L536 (`.format(... worktree=...)`)
  - 상세: 이번 작업의 핵심 의도는 "게이트가 평가하는 worktree 를 cwd 단일 대상에서 push 대상(들)로 확장"하는 correctness fix 다. 여기에 차단 메시지에 `worktree: {worktree}` 줄을 추가하는 것은 core fix 범위를 살짝 벗어나는 UX 개선으로 볼 수 있다. 다만 (1) `plan/in-progress/push-guard-worktree-scope.md` L59-62 `## 부수 개선` 절에 명시적으로 사전 고지되어 있고, (2) 여러 worktree 를 평가하는 구조로 바뀐 이상 "어느 worktree 가 막았는지" 를 밝히지 않으면 결과가 모호해지므로 기능적으로도 사실상 필요한 보완에 가깝다. 은닉된 확장이 아니라 투명하게 문서화된 확장이라 위험도는 낮다.
  - 제안: 별도 조치 불요. (참고용 기록)

- **[INFO]** 신규 헬퍼 4개(`_worktree_branches`, `_mentions_branch`, `_accepts_cwd`, `_push_targets`)에 33줄 분량의 설계 배경 주석 블록(L314-346) 동반
  - 위치: `.claude/hooks/guard_review_before_push.py` L314-346
  - 상세: 분량이 크지만, 같은 파일의 기존 `_is_git_push`/`_redact_inert_text` 주변에 이미 동일한 스타일의 장문 설계-근거 주석(회귀 이력, 거부된 대안 등)이 다수 존재해 로컬 컨벤션과 일치한다. 무관한 리팩토링이나 별건 주석 변경이 아니라 이번에 추가된 코드 자체를 설명하는 주석이다.
  - 제안: 별도 조치 불요.

## 점검 결과 상세

- **의도 이상의 변경**: 없음. `_is_git_push`, `_redact_inert_text`, `_GIT_PUSH` 등 기존 push 탐지 로직은 diff 에 포함되지 않았고(`@@ -311,9 +311,140` 헝크가 L311 `return` 문 뒤부터 시작), 실제 수정은 "worktree 평가 대상 결정" 이라는 선언된 목적에 집중되어 있다.
- **불필요한 리팩토링**: 없음. 기존 함수의 시그니처·동작 변경 없이 새 헬퍼만 추가.
- **기능 확장(over-engineering)**: `_accepts_cwd()` 시그니처 probe 는 다소 방어적으로 보이지만, plan 문서(M3 mutation 실측, L83 `_accepts_cwd` probe 제거 시 기존 스위트 5건 회귀)에서 probe 제거가 실제로 silent fail-open 을 유발함을 실측으로 근거를 남겼다. 확인 결과 프로덕션 `_lib/review_guard.py:836`·`_lib/plan_guard.py:291` 의 `evaluate_review`/`evaluate_plan` 은 이미 `cwd: str | None = None` 시그니처를 가지고 있어(선행 작업에서 도입, 이번 diff 범위 밖) 이번 변경이 실제로 동작하는 경로다. over-engineering 으로 보기 어렵다.
- **무관한 수정**: 없음. `git diff --stat origin/main...HEAD` 확인 결과 정확히 4개 파일만 변경됨 — 훅 본체, 신규 테스트, 테스트 카탈로그(README) 1행, 신규 plan 문서. 전부 이번 worktree-scope 수정과 직접 연관.
- **포맷팅 변경**: 실질 변경과 무관한 공백/줄바꿈 변경 섞임 없음.
- **주석 변경**: 기존 주석의 삭제/수정 없음 — 전부 신규 코드에 대한 신규 주석 추가.
- **임포트 변경**: `import subprocess`(`_worktree_branches` 내부), `import inspect`(`_accepts_cwd` 내부) 는 함수 지역 스코프에 국한된 지연 임포트로, 사용하지 않는 임포트 추가나 전역 임포트 정리는 없음.
- **설정 변경**: 없음. `.claude/settings.json` 등 설정 파일 미변경.
- **README.md**: `test_tests_readme_catalog.py` 컨벤션(모든 `test_*.py` 는 카탈로그 행 필수)에 따른 1행 추가로, 신규 테스트 파일 추가에 필수적으로 수반되는 갱신 — 스코프 내.
- **plan 문서**: `plan/in-progress/push-guard-worktree-scope.md` 신설은 작업 추적 컨벤션(CLAUDE.md `plan/in-progress/<name>.md`)에 부합.

## 요약

4개 변경 파일(`guard_review_before_push.py`, 신규 테스트, README 카탈로그 1행, 신규 plan 문서) 모두 "push 가드가 cwd 대신 push 대상 worktree(들)을 평가하도록 확장"이라는 단일 의도에 밀접하게 종속되어 있으며, 무관한 파일·리팩토링·포맷팅·임포트·설정 변경은 발견되지 않았다. 차단 메시지에 `worktree:` 줄을 추가한 것은 core fix 를 살짝 벗어나는 부수 개선이지만 plan 문서에 사전 고지되어 있고 다중-worktree 평가 구조에서 사실상 필요한 보완이라 문제 삼기 어렵다. 새 헬퍼에 동반된 장문 주석도 파일의 기존 컨벤션과 일치한다. 전반적으로 범위 이탈이 없는 매우 타이트한 diff.

## 위험도

NONE
