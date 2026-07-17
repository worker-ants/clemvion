# 성능(Performance) 리뷰 — guard_review_before_push.py / test_push_detection.py

## 발견사항

- **[INFO]** 모든 Bash 호출마다 `git push` 여부와 무관하게 3회의 전체 문자열 순회(O(n)×3)가 실행됨
  - 위치: `.claude/hooks/guard_review_before_push.py:523-528`(`main`) → `_is_git_push`(398) → `_has_hostile_control_characters`(184), `_tokenize`(204, `shlex` 기반), `_find_command_substitutions`(233, 수동 balanced-paren 스캔). Hook 등록: `.claude/settings.json:39`(`"matcher": "Bash"`) — `git push` 뿐 아니라 세션의 **모든** Bash 툴 호출에서 매번 새 `python3` 프로세스로 이 경로가 실행됨.
  - 상세: `_is_git_push`는 명령 문자열에 대해 (1) hostile 제어문자 스캔, (2) `shlex` 토큰화, (3) `$(...)`/backtick 균형 스캔을 순차로 수행한다. 세 함수 모두 순수 Python 문자 단위 루프이며, 조기 종료 조건이 없는 한(즉 hostile 문자·치환이 없는 일반적인 경우) 전체 문자열을 끝까지 훑는다. 재귀는 `_MAX_RECURSION_DEPTH=4`로 상한이 있고 각 재귀 레벨이 원본 문자열의 disjoint한 부분 문자열만 다시 스캔하므로 총 작업량은 O(depth×n)으로 지수적/이차 폭발 위험은 없다 — 이 부분은 잘 설계되어 있다. 다만 모듈 docstring(`_is_git_push`, 424번대)이 근거로 드는 "~6-24us(실측), 프로세스 기동 ~13ms 대비 무시 가능"이라는 결론은 "a range of real Bash-tool commands"를 대상으로 측정된 것으로 명시되어 있어, 이 리포지토리 자체 관례(heredoc 커밋 메시지, 대용량 SQL/스크립트 페이로드 등)에서 실제로 나타나는 수백 KB~MB 단위의 대형 heredoc 명령까지 그 결론이 일반화되는지는 별도로 측정되지 않았다. 여전히 선형이라 알고리즘적으로 위험하진 않지만, "negligible" 결론의 적용 범위가 측정 표본보다 넓게 서술되어 있다.
  - 제안: 액션이 필요한 결함은 아님(이전 세션에서 이미 유사 취지의 substring pre-filter가 unsound하다고 판명되어 제거된 이력이 있어, 안일한 사이즈 pre-filter 재도입은 피해야 함). 다만 command 길이 분포(특히 heredoc 포함 호출)에 대한 실측 샘플을 한 번 더 확보하거나, docstring의 "~6-24us" 문구에 "measured on short/typical commands, not large heredocs" 정도의 단서를 덧붙여 두면 향후 세션이 이 결론을 근거 없이 넓게 재인용하는 것을 막을 수 있다.

- **[INFO]** REVIEW/PLAN 두 게이트 간 잠재적 중복 I/O 여부는 이번 리뷰 대상 파일만으로는 확인 불가
  - 위치: `.claude/hooks/guard_review_before_push.py:534`(`evaluate_review()`), `:545`(`evaluate_plan()`) — 실제 구현은 `.claude/hooks/_lib/review_guard.py`, `.claude/hooks/_lib/plan_guard.py` (이번 리뷰 payload에 미포함).
  - 상세: 두 게이트 모두 "origin/main 대비 변경된 codebase/** 파일 목록", "연결된 plan 경로" 등 브랜치 상태를 각자 독립적으로 계산할 가능성이 있다. 만약 둘 다 내부적으로 `git diff`/`git log` 등 유사한 git 서브프로세스를 별도로 호출한다면 하나의 push 시도당 중복 I/O가 발생할 수 있다. 다만 이 게이트들은 `_is_git_push(command)`가 True일 때만(즉 실제 push 시도 시에만) 지연 호출되므로(523-528 라인, 이미 적절한 lazy-loading 패턴) 매 Bash 호출마다 발생하는 문제는 아니고, push 시도라는 드문 이벤트당 1회이므로 설령 중복이 있어도 영향은 제한적이다.
  - 제안: 이번 리뷰 스코프 밖이라 결함으로 단정하지 않음. 두 `_lib` 모듈을 별도로 검토할 기회가 있다면 "브랜치 diff 파일 목록" 등 공유 가능한 계산이 중복되고 있는지 확인해볼 가치는 있음.

## 요약

두 파일은 알고리즘적으로 견고하다. `_is_git_push`의 재귀는 `_MAX_RECURSION_DEPTH=4`로 명확히 상한이 있고 각 재귀 레벨이 원본 문자열의 겹치지 않는 부분 문자열만 재스캔하므로 총 비용은 O(depth×n)으로 지수적/이차 폭발이 없으며, 문자열 결합은 전부 `join`/`append` 기반으로 O(n²) 누적 패턴이 없다. `_GIT_OPTS_WITH_VALUE`/`_GIT_OPTS_NO_VALUE`/`_SHELL_INTERPRETERS` 등은 frozenset으로 O(1) 조회에 적합한 자료구조를 쓰고 있고, 비용이 더 큰 REVIEW/PLAN 게이트(`evaluate_review`/`evaluate_plan`)는 실제 `git push`가 감지됐을 때만 지연 호출되도록 이미 잘 설계되어 있다. 프로세스당 상태를 유지하지 않는 hook 구조상 메모리 누수 가능성도 없다. 유일한 관찰 포인트는 push 여부 판별을 위한 3중 O(n) 문자열 스캔이 `git push`뿐 아니라 세션의 모든 Bash 호출에서 매번 실행된다는 점인데, 이는 이전 세션에서 이미 실측(timeit)까지 거쳐 "프로세스 기동 비용(~13ms) 대비 무시 가능(~6-24us)"하다고 문서화된 의도적 트레이드오프이며, 그 실측이 전형적인 명령 길이를 대상으로 했다는 점만 인지하고 있으면 된다. Critical/Warning 급 성능 결함은 발견되지 않았다.

## 위험도

LOW
