# 문서화(Documentation) 리뷰 — push-guard-worktree-scope (5차, 00_34_09 — origin/main 재구조화 흡수 후)

이번 라운드의 실질 diff 는 병렬 세션이 origin/main 에 먼저 머지한 #999(push 게이트 fail-open
관측)·#1000(stop 게이트 관측 + `_lib` 공유)을 이 브랜치의 worktree-scoping 수정과 재이식(merge
`feda5b219`)한 결과다. 4차(`18_22_56`)에서 "5차 생략" 판정까지 났던 항목이므로, 이번 리뷰는 **그
재이식 과정 자체가 새로 만든 문서 드리프트**에 집중했다 — 과거 4라운드가 이미 INFO 로 defer 한
항목(모듈 docstring 요약 부재, Stop 훅 제외 근거 등)의 재확인이 아니라, 병합으로 실제 **회귀**한
것과 리네이밍 후 **갱신되지 않은** 참조를 소스와 직접 대조해 찾았다.

## 발견사항

- **[WARNING]** 4라운드 걸쳐 닫혔던 모듈 docstring 요약 한 줄이 병합 과정에서 소리 없이 사라짐 (문서 회귀)
  - 위치: `.claude/hooks/guard_review_before_push.py:14-24` (module docstring, "Only `git push` commands are inspected…" 문단)
  - 상세: 병합 직전 커밋 `990c6c69a`에서는 이 문단에 "Each gate evaluates not just the hook's own cwd but also any other checked-out worktree whose branch the command names — see 'Which worktree(s) does this push publish?' below for why (a cwd-only check was a working bypass)." 한 줄이 있었다(`git show 990c6c69a:.claude/hooks/guard_review_before_push.py` 로 직접 확인). 이 문장은 1~4차 리뷰가 4라운드 연속 INFO 로 지적해온 "모듈 상단 docstring 이 cross-worktree 평가 계약을 요약하지 않는다"를 4차(`18_22_56/RESOLUTION.md` INFO 16)에서 마침내 반영해 닫은 결과물이다. 그런데 현재 HEAD(`feda5b219`, origin/main 재구조화 흡수 머지)의 같은 문단에는 이 문장이 없다 — `sed -n '1,38p' guard_review_before_push.py | grep -i worktree` 결과 0건으로 직접 재확인했다. 원인은 병합 시 origin/main(`93e7ac344`) 쪽 docstring을 base로 채택했기 때문으로 보인다(`git show 93e7ac344:...`도 이 문장이 없음을 확인) — origin 브랜치엔애초에 이 기능이 없었으므로 당연하지만, 재이식 과정에서 로컬이 추가했던 그 한 줄을 다시 붙이는 걸 놓쳤다. plan 문서의 "origin/main 재구조화 흡수" 절(144-173행)은 `_run_gate → _evaluate_over_targets` 흡수, M9 신규 mutation, 하네스 사고 등은 상세히 기록하면서도 이 docstring 회귀는 언급이 없다 — 지금 이 사실을 아는 사람은 소스 diff 를 직접 대조한 이 리뷰뿐이다. 기능적 영향은 없지만(하단 314-349행의 상세 설계 블록은 그대로 살아있다), "4라운드 걸려 닫힌 문서 부채가 병합으로 재발했는데 그 사실 자체가 audit trail 에 없다"는 점은 이 PR 이 스스로 세운 "커버된다는 주장은 실측이어야 한다"는 교훈과 같은 종류의 문제다.
  - 제안: 그 한 줄을 다시 추가할 것(`990c6c69a`의 문장을 그대로 복원하면 됨). 겸사겸사 plan 의 "origin/main 재구조화 흡수" 절에 "병합 시 docstring 요약 한 줄이 유실됐다가 5차에서 복원" 한 줄을 남기면 이번에도 감사 추적이 비대칭이 되는 걸 막을 수 있다.

- **[WARNING]** 테스트 카탈로그와 테스트 docstring 두 곳이 병합으로 사라진 함수명 `_run_gate` 를 여전히 현재형으로 인용 (리네이밍 후 미갱신)
  - 위치: `.claude/tests/README.md:47` (`test_push_guard_worktree_scope.py` 카탈로그 행 — "both fail-open paths that could skip a gate entirely (`_run_gate`'s per-target `continue`, `main()`'s `_push_targets` fallback)"), `.claude/tests/test_push_guard_worktree_scope.py:247` (`test_per_target_fail_open_still_checks_remaining_targets`의 docstring 첫 줄 — "`_run_gate`'s per-target fail-open, pinned (review 17_51_28 WARNING 1).")
  - 상세: 병합 커밋(`feda5b219`)의 설계상, 2차 리뷰(17_51_28)에서 추출됐던 `_run_gate()` 헬퍼는 origin/main 의 `_run_gates(outcome, targets)` 에 흡수되어 사라지고, per-target fail-open 로직은 새 함수 `_evaluate_over_targets()` 로 옮겨졌다 — `guard_review_before_push.py`를 `grep -n "_run_gate\b"`로 확인한 결과 정의부·호출부 어디에도 `_run_gate`가 없다(0건). 그런데 위 두 문서(README 카탈로그 행, 테스트 docstring)는 여전히 그 옛 이름을 현재형으로("이 테스트는 `_run_gate`의 X를 핀한다") 서술한다. 흥미롭게도 **같은 파일** 안의 바로 다음 테스트(`test_degradation_is_counted_once_per_gate_not_per_target`, 263-272행)의 docstring은 새 이름 `_evaluate_over_targets`를 정확히 쓰고 있어(271행), 병합 시 일부 참조만 갱신되고 인접한 두 곳이 누락됐음을 보여준다. 앞으로 `_run_gate`를 grep 해 코드 위치를 찾으려는 사람은 이 두 문서에서만 그 이름을 발견하고 실제 소스에서는 찾지 못해 혼란을 겪을 것이다.
  - 제안: 두 곳 모두 `_run_gate` → `_evaluate_over_targets`로 정정(README 행은 "`_evaluate_over_targets`'s per-target `continue`"로, 테스트 docstring 은 "`_evaluate_over_targets`'s per-target fail-open, pinned…"으로). 리뷰 라운드 인용(`17_51_28 WARNING 1`)은 감사 이력이므로 그대로 둬도 무방.

## 검증한 항목 (문제 없음)

- `.claude/hooks/guard_review_before_push.py` 신설/유지 함수 전부(`_worktree_branches`/`_mentions_branch`/`_accepts_cwd`/`_push_targets`/`_evaluate_over_targets`/`_run_gates`) 는 실패 모드·설계 근거·실제 사고 사례(날짜 포함)를 담은 docstring 을 갖추고 있으며, 병합으로 새로 생긴 `_evaluate_over_targets`의 "두 불변식이 다른 방향에서 왔다" 서술(598-616행)은 이번 병합 배경과 정확히 일치함을 직접 확인했다.
- `test_degradation_is_counted_once_per_gate_not_per_target`(263-317행 부근, 병합 후 신설)은 plan 문서 §"재실측에서 드러난 것"(164-173행)이 서술하는 M9 생존·조치 내역과 정확히 대응한다.
- `plan/in-progress/push-guard-worktree-scope.md` 의 "origin/main 재구조화 흡수" 절(144-173행)은 병합 배경·해소 방식·두 불변식·하네스 사고(3번째)를 상세히 기록하고 있으며, mutation 표(120-129행)의 M1~M7 은 1~4차 라운드 이력과, M8·M9 은 이번 병합 이력과 각각 정합함을 확인했다. 다만 위 WARNING 1 이 지적한 docstring 회귀 자체는 이 절에 기록돼 있지 않다.
- 체크리스트 "테스트 21건"(104행)을 `grep -c "    def test_" .claude/tests/test_push_guard_worktree_scope.py`로 직접 재실행해 **21건**으로 실측 일치 확인.
- `.claude/tests/README.md:45`(`test_guard_review_before_push_main.py` 행)는 병합으로 들어온 fail-open OBSERVABILITY(§E) 정책을 이미 정확히 반영하고 있다(origin/main 쪽에서 미리 갱신된 상태) — 이번 병합으로 새로 어긋난 곳이 아님.
- `guard_review_before_stop.py`(병합으로 #1000 관측 로직이 들어왔으나 이번 PR의 worktree-scoping 대상은 아님)는 여전히 "지목할 다른 branch 개념이 구조적으로 없다"는 1~3차의 스코프-제외 판단과 상충하지 않으며, 그 판단은 plan 93-96행에 이미 남아 있음 — 새 차단 사유 아님.
- CHANGELOG.md·README(제품) API 문서·신규 환경변수 문서화 대상 없음 — 하네스 전용 변경이라 관례상 대상 밖(1~4차 판정과 동일).
- `review/code/2026/07/23/{17_28_02,17_51_28,18_06_41,18_22_56}/**` 산출물은 각 라운드 시점의 커밋 SHA 를 명시한 시점 스냅샷 감사 기록이며(프로젝트 관례상 `review/`는 커밋 대상), 이후 라인 번호·함수명이 달라져도 문제가 아니다. plan 본문 안의 `_run_gate` 언급(71·83·84·128행)은 각 라운드 시점의 실제 코드 상태를 가리키는 역사적 서술이라 위 WARNING 2 와 달리 정정 대상이 아니다(154행은 이미 이름 변경 자체를 명시적으로 서술).

## 요약

핵심 실행 코드(`guard_review_before_push.py`)의 신규/유지 함수는 여전히 이 파일의 "모든 설계 결정에 근거 주석" 관례를 충실히 지키고 있고, plan 문서의 병합 관련 서술도 상세하다. 다만 병렬 세션의 origin/main 재구조화를 흡수하는 3-way 재이식 과정에서 두 가지 문서 드리프트가 새로 생겼다: (1) 4라운드 걸려 닫혔던 모듈 docstring 의 cross-worktree 요약 한 줄이 조용히 유실되어 그 부채가 감사 기록 없이 재발했고, (2) 헬퍼 리네이밍(`_run_gate` → `_evaluate_over_targets`) 이 테스트 카탈로그 1행과 테스트 docstring 1곳에는 전파되지 않아 더 이상 존재하지 않는 함수명을 현재형으로 서술한다. 둘 다 기능적 결함은 아니고 한두 줄 수정으로 닫히지만, 코드 자체가 "커버된다는 주장은 실측이어야 한다"를 반복 교훈으로 삼아온 PR이라는 점에서 병합이 만든 이 조용한 회귀는 기록해 둘 가치가 있다. 그 외 발견된 새 문서화 결함은 없다.

## 위험도

LOW
