# 변경 범위(Scope) 리뷰 — push-guard-worktree-scope

## 발견사항

없음. 3개 리뷰 대상 파일(`git diff origin/main...HEAD` 354줄 + 신규 테스트 파일 595줄 + README 1줄)을
`plan/in-progress/push-guard-worktree-scope.md` 에 서술된 의도("push 가 실제로 publish 하는
worktree 를 게이트가 평가하도록 스코핑 — cwd-only 평가로 인한 cross-worktree false ALLOW 차단")와
대조했다. 추가된 모든 코드가 그 목적에 직접 대응한다:

- `.claude/hooks/guard_review_before_push.py`
  - `_worktree_branches`/`_mentions_branch`/`_accepts_cwd`/`_push_targets` — target(worktree) 선정.
    신규 `import inspect`(`_accepts_cwd` 시그니처 probe 용)·`import subprocess`(`git worktree list`
    호출용)는 둘 다 실사용처가 있다 — 미사용 임포트 없음.
  - `_evaluate_over_targets` — 기존 `_run_gates` 내 REVIEW/PLAN 인라인 try/except 블록을 대체하는
    루프 추출. plan 의 "origin/main 재구조화 흡수(2026-07-24)" 절이 설명하듯, 이 작업이 처음 만든
    `_run_gate` 헬퍼가 병렬 세션이 머지한 #999/#1000 의 `_run_gates(outcome)` 구조에 재이식되며
    이름이 바뀐 것 — 별도의 "불필요한 리팩토링" 이 아니라 두 동시 작업의 병합 산물로 plan 에 명시돼
    있고, `git diff origin/main...HEAD`(merge-base 기준 triple-dot) 는 origin/main 자체의 독립
    변경분(§J regex 등)을 포함하지 않는다 — 실제로 diff 에 `_GIT_PUSH`/`_MESSAGE_ARG` 등 탐지 로직
    변경은 전혀 없다.
  - `_REVIEW_MSG`/`_PLAN_MSG` 에 `worktree:` 줄 추가 — plan §"부수 개선" 에 "어느 worktree 가
    막았는지 안 밝혀 진단을 어렵게 만든 직접 원인" 이라고 명시적으로 근거를 남긴 항목. scope 이탈이
    아니라 이번 fix 가 도입하는 다중-target 평가 결과를 사용자에게 노출하는 데 필수적인 부분(target
    이 여럿이 되므로 "어느 target 이 막았는가" 표시가 없으면 오히려 새 회귀).
  - `main()` 의 `_push_targets` 호출 + try/except 폴백 — target 선정 실패 시 cwd 로 축소 폴백,
    `TARGET_SELECTION` degraded 기록. plan 의 "3차 리뷰(18_06_41)" 절이 다루는 항목과 정확히 일치.
- `.claude/tests/test_push_guard_worktree_scope.py` — 전체가 신규 파일이며 위 기능만을 검증한다
  (target 선정, PLAN 게이트 대칭 스코핑, `_accepts_cwd` 계약, fail-open 경로, 절단 상한, bypass
  상호작용). 무관한 assertion 없음.
- `.claude/tests/README.md` — 카탈로그에 신규 테스트 파일 1행 추가. 이 저장소의
  `test_tests_readme_catalog.py` 가 모든 `test_*.py` 에 카탈로그 행을 강제하므로, 신규 테스트 파일을
  추가하면 이 1줄 변경은 그 자체로 필수 동반 변경이지 별도 스코프가 아니다.

포맷팅 전용 변경, 무관한 주석 정리, 사용하지 않는 임포트, 설정 파일 변경, 요청 밖 기능 확장은
발견되지 않았다.

## 요약

세 파일의 변경분은 plan 문서에 서술된 단일 목적(push 가드의 worktree 스코핑, cross-worktree false
ALLOW 차단)에 정확히 대응하며, 부수적으로 보이는 항목(`worktree:` 메시지 줄, README 카탈로그 행,
`_evaluate_over_targets` 로의 리팩토링)도 모두 plan 본문에 근거·이력이 명시돼 있고 실질적으로 이번
fix 의 필수 구성요소이거나 프로젝트 관례가 강제하는 동반 변경이다. `git diff origin/main...HEAD`
(merge-base 기준)로 실측한 결과 origin/main 이 두 차례 앞서간 동시 작업(#999/#1000, #1001/#1002)의
독립 변경분은 포함돼 있지 않아, "의도 이상의 변경"이 섞여 들어올 여지도 없다. 스코프 이탈 없음.

## 위험도

NONE
