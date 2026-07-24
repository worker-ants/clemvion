# Documentation Review — push-guard-worktree-scope (session 01_25_15)

대상: `.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_push_guard_worktree_scope.py`,
`.claude/tests/README.md`

## 발견사항

- **[WARNING]** 회귀 테스트 docstring 의 리뷰 라운드 인용이 실제 발생 라운드와 다르다 (감사 이력 오귀속)
  - 위치: `.claude/tests/test_push_guard_worktree_scope.py:409` (`test_push_targets_crash_falls_back_to_cwd` docstring)
  - 상세: docstring 은 `"""main()'s except around _push_targets, pinned (17_51_28 WARNING 1)."""` 라고
    적혀 있다. 그러나 `plan/in-progress/push-guard-worktree-scope.md` 의 "3차 리뷰(18_06_41) 반영" 절과
    `review/code/2026/07/23/18_06_41/SUMMARY.md` WARNING #1("`main()`의 `_push_targets` 예외 폴백 경로가
    실제로는 어떤 테스트도 도달하지 못함")이 정확히 이 테스트(M7, "39/39 green" 생존 재현)를 낳은
    발견이다. `17_51_28`(2차 리뷰) WARNING 1 은 **다른 이슈**(per-target fail-open 미검증)이고, 이미
    같은 파일의 `test_per_target_fail_open_still_checks_remaining_targets` (라인 258-259 부근, `"""...
    per-target fail-open (review 17_51_28 W1)."""`) 가 정확히 그 이슈를 정확한 라운드로 인용하고 있다.
    즉 같은 라운드 번호가 서로 다른 두 테스트에 붙어 있고, 그중 하나(409행)는 틀렸다. 이 저장소는
    라운드 인용을 감사 이력으로 명시적으로 취급한다(README 관례 절 "리뷰 라운드 인용은 감사 이력이므로
    유지" — `test_run_gate` 이름 drift 정정 시에도 "리뷰 라운드 인용은 감사 이력이므로 유지" 라고
    명시했다). 잘못된 인용은 향후 이 테스트의 출처를 추적하려는 사람을 엉뚱한 리뷰 세션
    (`17_51_28`, 이미 다른 이슈로 소진됨)으로 안내한다. 기능에는 영향 없음(테스트 자체는 정확히
    동작).
  - 제안: `(17_51_28 WARNING 1)` → `(18_06_41 WARNING 1)` 로 정정.

- **[INFO]** `# SoR:` 주석이 이동된 plan 경로를 가리킨다 (이 PR 의 diff 범위 밖, pre-existing)
  - 위치: `.claude/hooks/guard_review_before_push.py:96`
  - 상세: `# SoR: plan/in-progress/harness-push-guard-subcommand-detection.md` 라고 적혀 있으나, 그
    plan 은 이미 `plan/complete/harness-push-guard-subcommand-detection.md` 로 이동했다(라이프사이클
    규칙상 완료 plan 은 `plan/complete/` 로 옮겨진다). `git diff <merge-base>..HEAD` 확인 결과 이
    줄은 본 PR(worktree-scope)이 건드리지 않은 기존 코드다 — 이 PR 의 책임은 아니지만, 이번에
    전체 파일 컨텍스트로 이 파일을 다시 읽으면서 발견된 실제 stale 참조다.
  - 제안: `SoR: plan/complete/harness-push-guard-subcommand-detection.md` 로 정정(이 PR 범위에
    포함시켜도 되고, 별도 사소 수정으로 미뤄도 무방).

- **[INFO]** `_run_gates` 의 새 `targets` 매개변수가 docstring 에 설명되지 않음
  - 위치: `.claude/hooks/guard_review_before_push.py:664-665`
  - 상세: 시그니처가 `_run_gates(outcome, targets)` 로 확장됐지만 docstring 은
    `"""Run both gates, recording into `outcome` what each one did."""` 한 줄 그대로다. 같은 파일의
    다른 신규 헬퍼(`_evaluate_over_targets`, `_push_targets`, `_worktree_branches`, `_accepts_cwd`)는
    모두 매개변수·근거를 상세히 문서화하는 이 파일의 지배적 관례에 비춰보면 사소한 비대칭이다.
    기능적 영향 없음.
  - 제안: 여유 있을 때 `targets` — "the worktrees to evaluate, cwd first" 정도 한 줄 추가.

## 확인된 양호 사항 (참고, 조치 불요)

- `.claude/tests/README.md` 는 신규 파일 `test_push_guard_worktree_scope.py` 행을 정확하고 상세하게
  추가했다(실제 커버 항목 — false-ALLOW 회귀 핀, PLAN 게이트 대칭 스코핑, `_accepts_cwd` 계약,
  두 fail-open 경로, `_mentions_branch` 경계, 절단 상한, `BYPASS_*` — 모두와 1:1 대응). 이 저장소의
  `test_tests_readme_catalog.py` 가드가 요구하는 "모든 테스트 파일이 표에 존재" 조건도 충족.
- 새 함수 5개(`_worktree_branches`, `_mentions_branch`, `_accepts_cwd`, `_push_targets`,
  `_evaluate_over_targets`) 모두 근거·엣지 케이스·안전 방향을 설명하는 상세 docstring 을 갖췄고,
  모듈 상단에 "Which worktree(s) does this push publish?" 설계 섹션이 결정·트레이드오프·잔여 갭을
  명시적으로 기록한다.
- 이 저장소는 CHANGELOG.md 대신 `plan/in-progress/push-guard-worktree-scope.md` 를 변경 이력으로
  쓰는 관례이며, 그 문서는 라운드별 반영 내역·mutation 실측표·"남은 갭(의도)" 절을 이 세션 기준
  최신 상태로 유지하고 있다(테스트 23건, mutation M1~M11, RESIDUAL GAP 3항목 모두 최신).
- 과거 라운드(00_34_09, 01_02_21)가 지적한 감사 문서 자기모순(RESOLUTION.md 헤더/표 불일치,
  SUMMARY.md 오귀속)은 append-only 정정 주석 방식으로 이미 해소되어 있다(원문 보존 + 정정 기록,
  이 저장소의 감사 무결성 관례와 일치).
- API 문서·환경변수 문서·예제 코드: 해당 없음 (harness 내부 pre-push 훅, 신규 공개 API·env var
  없음, `BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD` 는 기존 변수 재사용). 테스트 파일 자체가 신규
  함수들의 사용 예시 역할을 충분히 수행.

## 요약

이번 diff(worktree 스코핑 기능 — 훅 본체·회귀 테스트·README 카탈로그 3파일)는 문서화 수준이 전반적으로
매우 높다: 모든 신규 함수에 근거 있는 docstring, 모듈 설계 섹션, README 카탈로그 동기화, plan 기반
변경 이력이 모두 최신 상태를 유지한다. 유일한 실질적 결함은 회귀 테스트 하나의 docstring 이 인용하는
리뷰 라운드 타임스탬프가 실제 발견 라운드(`18_06_41`)가 아니라 이미 다른 이슈에 쓰인 `17_51_28`을
가리키는 것 — 이 프로젝트가 감사 이력으로 명시 취급하는 인용의 정확성 문제이므로 WARNING 으로 분류했다.
그 외에는 이 PR 범위 밖의 사소한 stale 참조(SoR 경로) 1건과 문서화 비대칭 1건을 INFO 로 남긴다.

## 위험도

LOW
