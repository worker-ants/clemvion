# Maintainability Review — push-guard-worktree-scope (round 18_22_56)

## 검증 방법

`git log`/`git show` 로 직전 라운드(18_06_41, 커밋 `942412ea3`) 이후의 실질 diff 를 격리했다.
`.claude/hooks/guard_review_before_push.py` 는 **이번 라운드에서 무변경**(커밋 `89c3870b4` 는
`.claude/tests/test_push_guard_worktree_scope.py` +49줄, `plan/in-progress/push-guard-worktree-scope.md`
+35줄, 그리고 이전 라운드들의 review 산출물 커밋만 포함)이므로, 현재 파일 전체를 직접 `Read` 로
열어 과거 3라운드 maintainability WARNING/INFO 가 실제로 해소됐는지 코드로 재확인한 뒤, 이번
라운드의 신규 diff(테스트 파일)만 별도로 리뷰했다.

## 발견사항

- **[INFO]** 신규 테스트 `test_push_targets_crash_falls_back_to_cwd` 가 `_run()` 헬퍼를 우회해
  env 구성 + `subprocess.run` 호출을 세 번째로 손수 반복
  - 위치: `.claude/tests/test_push_guard_worktree_scope.py` 280-320행 (`test_push_targets_crash_falls_back_to_cwd`)
  - 상세: 같은 파일의 `_run()`(124-139행)은 `self.hook` 을 대상으로 env(`STUB_BLOCKED_PATHS`/`STUB_PLAN_BLOCKED_PATHS`/`STUB_RAISE_PATHS`)를 구성하고 `subprocess.run` 하는 보일러플레이트를 이미 추상화하고 있다. 그런데 이번 신규 테스트는 `main()` 의 `_push_targets` 폴백 경로를 찌르기 위해 원본 훅을 패치한 **다른 스크립트 파일**(`crashing`)을 실행해야 해서 `self.hook` 하드코딩인 `_run()` 을 그대로 쓸 수 없고, `test_bypass_still_applies_to_scoped_targets`(184-203행)에 이미 존재하던 것과 거의 동일한 형태의 env-dict 구성 + `subprocess.run(..., capture_output=True, text=True, env=...)` 코드를 다시 작성했다. 세 번째 유사 인스턴스가 나온 것이라 앞으로 "hook 경로를 바꿔 실행" 하는 케이스가 하나만 더 늘어도 같은 15줄 안팎이 또 반복될 가능성이 크다. 기능 결함은 아니며(회귀 위험 없음, 전량 green 확인됨), 이 파일이 테스트 픽스처라는 낮은 기준을 감안해도 누적되는 패턴이라 기록해 둔다.
  - 제안: 급하지 않음. `_run()` 에 `hook_path=None`(기본 `self.hook`) 키워드 인자를 추가해 이 신규 테스트도 재사용하도록 리팩터하면 세 인스턴스가 하나로 수렴한다. 이번 diff 로 인한 신규 리스크는 아니므로 별도 후속으로 미뤄도 무방.

## 검증한 항목 (직전 라운드 지적 → 여전히 해소 상태 확인)

- **[해소 유지]** REVIEW/PLAN 게이트 루프 DRY 위반(1차 WARNING 4) — `_run_gate(evaluate, bypass_env, targets, *, is_blocked, render)`(494-520행)로 계속 통합돼 있고, `main()`(523-563행)은 REVIEW/PLAN 각각 한 번의 짧은 호출만 남아 있다. 세 번째 게이트가 추가돼도 이 헬퍼를 그대로 재사용할 수 있는 형태.
- **[해소 유지]** `_run_gate(base_cwd)` 죽은 파라미터(2차 WARNING 2) — 현재 시그니처에 `base_cwd` 없음(`grep base_cwd` 결과 `main()` 안에서만 등장, 494행 시그니처에는 없음). 콜백 인자(`is_blocked=`/`render=`)는 여전히 keyword-only 로 호출부(542-560행)에서 역할이 이름으로 드러난다.
- **[해소 유지]** 지역 `import subprocess`/`import inspect`(1차 INFO) — 둘 다 모듈 최상단(28-34행)으로 이동된 상태 유지, 함수 내부 지연 import 잔재 없음.
- **[해소 유지]** `timeout=5.0` 매직넘버 근거 주석 부재(1차 INFO) — `_worktree_branches` 호출부(362-366행)에 "5s: same order as the other subprocess … fail open rather than hang" 근거 주석이 남아 있어, 이 파일의 다른 상수(`_OWNER_WINDOW`, `_MAX_REDACTION_INPUT`)와 같은 수준의 설명 관례를 따른다.
- **[변화 없음, 재확인]** 테스트 스텁 문자열 내부의 `raising`/`blocked` 경로-필터링 2줄 패턴 반복(3차 INFO) — `_REVIEW_STUB`(54-59행) 안에 여전히 동일 모양으로 남아 있다. 3차에서 이미 "축이 하나 더 늘면 헬퍼로 추출 고려" 로 급하지 않음 분류됐고 이번 라운드도 실행 코드가 아닌 테스트 픽스처 범위라 그 판단을 유지한다.

## 요약

`.claude/hooks/guard_review_before_push.py` 자체는 이번 라운드에서 변경되지 않았고, 지난 세 라운드에 걸쳐 제기된 maintainability WARNING(게이트 루프 DRY 위반, `_run_gate` 죽은 파라미터)과 INFO(지역 import, `timeout` 매직넘버 근거 부재) 는 전부 코드 레벨에서 해소된 상태가 그대로 유지되고 있음을 직접 확인했다. 이번 라운드의 실질 diff는 `main()`의 `_push_targets` 폴백 회귀를 고정하는 테스트 1건과 plan 문서 갱신뿐이며, 그 신규 테스트가 기존 `_run()` 헬퍼를 재사용하지 못해 유사한 env/subprocess 보일러플레이트를 세 번째로 반복하는 점만 경미한 INFO로 남는다. WARNING·CRITICAL 급 신규 유지보수성 이슈는 없다.

## 위험도
LOW
