# 변경 범위(Scope) 리뷰 (5차, 00_34_09)

대상: branch `claude/push-guard-worktree-scope-20044c` (base `origin/main`), `git diff origin/main...HEAD` 50개 파일.
직전 4라운드(17_28_02 / 17_51_28 / 18_06_41 / 18_22_56)가 모두 scope=NONE 으로 수렴한 뒤,
병렬 세션이 같은 파일을 재구조화(#999/#1000, fail-open 관측)해 머지한 시점의 재이식(reimplant)
코드를 대상으로 함(plan `## origin/main 재구조화 흡수 (2026-07-24)` 절).

## 발견사항

없음.

## 점검 결과 상세

- **의도 이상의 변경**: 없음. `git diff origin/main...HEAD --stat` 로 정확히 50개 파일만 확인했다 —
  (1) `.claude/hooks/guard_review_before_push.py` 본체, (2) 신규 테스트
  `.claude/tests/test_push_guard_worktree_scope.py`, (3) `.claude/tests/README.md` 카탈로그 1행,
  (4) `plan/in-progress/push-guard-worktree-scope.md`, (5) 4라운드분 리뷰 산출물 46개
  (`review/code/2026/07/23/{17_28_02,17_51_28,18_06_41,18_22_56}/**`). 전부 "push 가드가 cwd 대신
  push 대상 worktree(들)을 평가" 라는 단일 의도 또는 그 의도의 리뷰 감사 기록에 종속된다.
- **머지 재이식(reimplant) 자체가 범위 이탈인지**: 아니다. `990c6c69a`(4라운드 수렴 시점)와 `HEAD`
  를 직접 diff 해 대조한 결과, 새로 생긴 것은 `failopen_state.py`/`guard_review_before_stop.py`/
  `test_e2e_exemption_paths_sync.py` 등 origin/main 쪽(#999/#1000 및 그 이전 커밋) 콘텐츠뿐이며,
  이들은 `git diff origin/main...HEAD`(3-dot, merge-base 기준) 에는 전혀 나타나지 않는다 — 이미
  origin/main 에 있던 것이 merge 로 유입된 것이지 이 branch 가 새로 만든 변경이 아니다. 이 branch
  가 실제로 얹은 것은 `_evaluate_over_targets()`(옛 `_run_gate` 를 main 의 `_run_gates` 구조에
  재이식) + 신규 테스트 1건(`test_degradation_is_counted_once_per_gate_not_per_target`, M9 대응)
  뿐이며, 둘 다 "worktree 스코핑" 과 "#999 fail-open 관측" 두 불변식이 **같은 루프 안에서
  충돌하지 않게 조정**하는 데 정확히 필요한 최소 변경이다(주석에도 두 불변식을 명시).
- **불필요한 리팩토링**: 없음. `_run_gate` → `_evaluate_over_targets` 개명·시그니처 변경은 새
  기능(리팩토링 아님)과 무관한 정리가 아니라, 병합된 main 구조(`_run_gates(outcome, targets)`)에
  맞춰 REVIEW/PLAN 두 게이트가 공유하던 옛 헬퍼를 그대로 이식하는 데 필요한 변경이다.
- **기능 확장(over-engineering)**: 없음. 새로 추가된 테스트 1건은 정확히 병합으로 새로 생긴
  상호작용(스코핑의 target-반복 루프가 #999 의 gate-당-1회 degraded 집계 불변식을 깨뜨리지
  않는지)만 고정한다 — 요청 범위를 넘는 기능 추가가 아니라 병합 회귀를 막는 규제.
- **무관한 수정**: 없음. `guard_review_before_stop.py`/`failopen_state.py`/`test_e2e_exemption_paths_sync.py`
  등은 이 diff 에 포함되지 않는다(위 대조 참고).
- **포맷팅 변경**: 실질 변경과 무관한 공백/줄바꿈 변경 섞임 없음.
- **주석 변경**: 기존 주석 삭제 없음. 재이식 과정에서 모듈 docstring 상단 문단(worktree 개요)이
  한 번 빠졌다가(990c6c69a→중간 커밋) 최종 상태에서는 `_evaluate_over_targets`/`_run_gates`
  docstring 안으로 재배치되어 남아있음 — 정보 손실 아님.
- **임포트 변경**: `import inspect`/`import subprocess` 는 이전 라운드에서 이미 모듈 top-level 로
  정리된 상태 그대로 유지. 이번 라운드에서 새로 추가되거나 정리된 임포트 없음.
- **설정 변경**: 없음.
- **review/ 산출물 46개**: CLAUDE.md 관례("review/ 는 gitignored 아님, SUMMARY·RESOLUTION 도
  커밋")와 정확히 일치하는 범위 내 변경. 4라운드 전부 이 branch 자신의 감사 기록이며, 각 문서가
  "대상: 커밋 <SHA>" 로 스냅샷 시점을 명시해 라인 번호가 현재 코드와 달라도 문제가 아니다(직전
  documentation.md 라운드가 이미 확인).

## 요약

이번 diff(누적 50개 파일)는 "push 가드가 cwd 단일 worktree 대신 push 대상 worktree(들)을 평가하도록
확장한다"는 단일 의도에서 벗어나지 않는다. 이번 라운드가 리뷰하는 신규 변경분은 병렬 세션이 같은
파일을 재구조화(#999/#1000 fail-open 관측)해 머지한 뒤 이 작업의 worktree 스코핑을 그 구조 위에
재이식한 것으로, `990c6c69a`(4라운드 수렴 시점) 대비 실제 diff 는 헬퍼 1개 재배선 + 회귀 테스트
1건뿐이며 둘 다 "두 기능이 같은 루프에서 충돌 없이 공존"하는 데 필요한 최소 변경이다. `git diff
origin/main...HEAD`(3-dot) 기준으로 정확히 50개 파일만 확인했고, 이 branch 가 만들지 않은 origin/main
쪽 병합 콘텐츠(`failopen_state.py` 등)는 이 diff 밖에 있음을 직접 대조로 확인했다. 무관한
파일·리팩토링·포맷팅·임포트·설정 변경은 발견되지 않았으며, 직전 4라운드 scope 리뷰(모두 위험도
NONE, CRITICAL/WARNING 0건)와 판정이 일치한다.

## 위험도

NONE
