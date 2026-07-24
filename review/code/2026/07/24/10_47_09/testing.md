# 테스트(Testing) 리뷰 — push-guard-worktree-scope

## 대상
- `.claude/hooks/guard_review_before_push.py`
- `.claude/tests/test_push_guard_worktree_scope.py`
- `.claude/tests/README.md`

## 발견사항

- **[WARNING]** 블록+fail-open 동시발생 시 배너 노출 자체는 미검증
  - 위치: `.claude/tests/test_push_guard_worktree_scope.py:286-301` (`test_per_target_fail_open_still_checks_remaining_targets`) / `.claude/hooks/guard_review_before_push.py:741-744` (`main()`의 `finally` 주석) / `.claude/hooks/guard_review_before_push.py:590-625` (`_report_fail_open`, 스트림 선택은 605)
  - 상세: `main()`의 `finally` 주석은 "a gate can block while the OTHER one failed open — that is exactly when it would otherwise be quietest"라고 명시하며 이 co-occurrence 를 `finally` 도입의 핵심 근거로 든다. `test_per_target_fail_open_still_checks_remaining_targets`는 정확히 이 시나리오(`raise_paths=[main_wt]` + `blocked_paths=[side_wt]`)를 만들지만, 검증은 `returncode == 2`와 `side_wt in r.stderr`뿐이다. 이 테스트는 `hooks_dir/_lib`에 `failopen_state.py`를 복사하지 않으므로 `_report_fail_open`의 폴백 경로(606-616행, `failopen_state is None`)가 실행되어 exit_code==2 → stderr에 "⚠️ push guard: 게이트가 판정하지 못하고…" 배너가 함께 출력되어야 하는데, 이 배너/`REVIEW gate —` 문구가 실제로 stderr에 존재하는지는 어떤 assert 도 하지 않는다. `finally` 가 조기 예외로 스킵되거나 폴백 프린트가 조용히 실패해도(616행 `except Exception: pass`) 이 테스트는 green 을 유지한다 — §E 관측성이 가장 필요한 바로 그 조합이 회귀 시 감지되지 않는다.
  - 제안: 동일 테스트 또는 별도 테스트에서 `r.stderr`(exit_code==2 이므로)에 fail-open 배너 문구(`게이트가 판정하지 못하고` 등)와 `REVIEW gate —` 항목이 포함되는지 assert 추가.

- **[INFO]** `_worktree_branches`의 detached-HEAD 항목 처리가 회귀 핀 없이 "우연히 안전"
  - 위치: `.claude/hooks/guard_review_before_push.py:424-495` (`_worktree_branches`, porcelain 파서는 485-494)
  - 상세: `git worktree list --porcelain`은 detached HEAD 인 worktree 에 대해 `branch ` 라인을 내지 않는다(`detached` 라인만). 현재 파서는 `elif line.startswith("branch ") and path:` 에서만 `pairs`에 추가하므로 이런 항목은 조용히 제외된다 — 코드 주석(415행 부근)이 "uncovered" 로 이미 문서화한 의도된 잔여 갭이지만, `test_push_guard_worktree_scope.py`에는 detached-HEAD worktree 를 만들어 이 배제 동작을 고정하는 테스트가 없다. 이 파일의 모든 시나리오는 subprocess + 실제 git 리포로 간접 구동되므로, 향후 porcelain 파서를 손볼 때 이 케이스가 실수로 흡수(예: HEAD 해시를 branch 로 오인)되어도 어떤 테스트도 잡지 못한다.
  - 제안: `git worktree add --detach`로 만든 worktree 를 세 번째 worktree 로 추가해, `_worktree_branches`(또는 `_push_targets`)가 그 경로를 pairs 에 포함하지 않음을 직접 pin.

- **[INFO]** `_evaluate_over_targets`의 `result is None` 방어 분기가 어떤 테스트로도 구동되지 않음
  - 위치: `.claude/hooks/guard_review_before_push.py:645-689` (`_evaluate_over_targets`, 해당 분기는 674-681)
  - 상세: 주석 자체가 "Neither gate returns None today … so this is defensive"라고 명시하고, "If a gate ever returns None on purpose, that silence needs its own `degraded` reason here"라고 미해결 상태임을 인정한다. 현재 `_REVIEW_STUB`/`_PLAN_STUB` 모두 `None`을 반환하는 경로를 갖지 않아 이 분기는 스위트 전체에서 unreachable 이다. 지금은 사실상 dead code 라 위험은 낮지만, 향후 게이트가 의도적으로 `None`을 반환하게 되는 순간 `answered`가 세팅되지 않는 이 동작이 load-bearing 해지는데 그 시점에 대비한 회귀 테스트가 없다.
  - 제안: 낮은 우선순위. 스텁 게이트에 `None`을 반환하는 세 번째 케이스를 추가해 `outcome.answered`에 게이트가 안 들어가는 것과, streak 리셋에 기여하지 않는 것을 pin 하면 향후 이 분기가 실제로 쓰일 때 안전망이 된다.

- **[INFO]** `_push_targets`/`_worktree_branches` 순수 로직에 대한 in-process 단위 테스트 부재 (전량 subprocess E2E)
  - 위치: `.claude/hooks/guard_review_before_push.py:424-524` (`_worktree_branches`, `_push_targets`) / `.claude/tests/test_push_guard_worktree_scope.py` 전체
  - 상세: false-ALLOW 회귀 핀으로서 실제 hook 을 subprocess 로, 실제 git worktree 로 검증하는 설계는 신뢰도 면에서 합리적이고(README §Conventions 의 "Mocking would assert our model of git, not git" 원칙과 일치) 오히려 권장할 만하다. 다만 `_push_targets`의 "Order-stable, de-duplicated, cwd first" 라는 명시적 계약(503-506행 docstring)을 직접 겨냥한 순수 함수 단위 테스트는 없다 — 예컨대 동일 realpath 를 가리키는 두 worktree 항목이 있거나, 브랜치명과 경로 둘 다로 매치되는 케이스에서 target 이 중복 추가되지 않는지는 현재 시나리오 조합상 우연히 통과할 뿐 직접 겨냥되지 않았다.
  - 제안: 필수는 아니나, `_worktree_branches`가 반환할 `[(path, branch), …]` 리스트를 직접 몽키패치해 `_push_targets`를 순수 함수로 빠르게 단위 테스트하면 subprocess 왕복 없이 dedup/순서 계약을 더 저렴하게 고정할 수 있다.

## 요약

`test_push_guard_worktree_scope.py`는 이번 변경(교차 worktree false-ALLOW 홀 차단)의 핵심 시나리오 — false-ALLOW 회귀 핀, REVIEW/PLAN 양쪽 스코핑 대칭, `_accepts_cwd`의 실제 게이트 시그니처 계약, per-target fail-open, `_MAX_REDACTION_INPUT` 절단, stale/미해결 worktree degrade — 를 실제 git 리포 + 실제 hook subprocess 로 폭넓고 매우 잘 문서화된 방식으로(각 케이스가 이전 리뷰 라운드 번호까지 인용) 커버한다. Mock(스텁 게이트)은 실제 시그니처와의 drift 를 `AcceptsCwdContractTest`로 별도 고정해 괴리 위험이 낮고, 테스트 격리(tempdir+addCleanup, 명시적 env dict)도 양호하다. 남은 갭은 모두 지엽적 — 가장 눈여겨볼 것은 `main()`의 `finally` 존재 이유로 명시된 "블록 중에도 다른 게이트의 fail-open 이 조용해지면 안 된다"는 속성이 정확히 그 시나리오를 만드는 테스트에서마저 실제로 검증되지 않는다는 점(WARNING)이고, 나머지(detached-HEAD 파싱, `result is None` 방어분기, 순수 함수 단위 테스트 부재)는 현재 동작을 깨뜨리지 않는 INFO 수준 커버리지 보강 여지다.

## 위험도

LOW
