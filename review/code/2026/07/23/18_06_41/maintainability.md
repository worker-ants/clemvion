# Maintainability Review — push-guard-worktree-scope (round 18_06_41)

이 라운드의 실질 코드 diff(`4a516b03a..942412ea3`)는 직전 라운드(17_51_28)가 남긴
maintainability WARNING 1건 + INFO 1건을 정확히 해소하는 좁은 리팩터와, 그 리팩터가 만든
새 불변식(per-target fail-open)을 고정하는 테스트 1건 추가로 구성된다.

## 발견사항

- **[INFO]** 새 테스트 스텁의 `raising` 경로-필터링이 바로 위 `blocked` 필터링과 동일한
  두 줄짜리 패턴을 그대로 반복
  - 위치: `.claude/tests/test_push_guard_worktree_scope.py` (`evaluate_review` 스텁, `_REVIEW_STUB` 문자열 내부, `raising = [...]`/`blocked = [...]` 및 각각의 `os.path.realpath` 리스트 컴프리헨션 두 쌍)
  - 상세: `STUB_RAISE_PATHS` 를 읽어 대상 경로 목록을 만드는 코드가 바로 아래 `STUB_BLOCKED_PATHS` 를 읽는 기존 코드와 `[p for p in os.environ.get(...).split(os.pathsep) if p]` + `os.path.realpath` 매칭까지 완전히 동일한 모양이다. 기존 코드의 패턴을 그대로 복사해 새 스텁 조건을 추가한 것이라 새로운 스타일 이탈은 아니고, 이 파일은 테스트 픽스처(문자열로 임베드된 스텁 모듈 소스)라 실제 실행 코드보다 허용 기준이 낮다. 다만 세 번째 `STUB_*_PATHS` 축이 추가되면 같은 4줄이 또 반복될 것이다.
  - 제안: 급하지 않음(테스트 스텁, 기능 영향 없음). 축이 하나 더 늘어나는 시점에 `_paths_from_env(name)` 같은 헬퍼로 추출 고려.

## 검증한 항목 (직전 라운드 지적 → 해소 확인)

- **[해소]** `_run_gate()` 의 죽은 파라미터 `base_cwd` — 17_51_28 WARNING 1. 이번 diff 에서 시그니처가
  `def _run_gate(evaluate, bypass_env, targets, *, is_blocked, render) -> bool:` 로 바뀌어
  `base_cwd` 자체가 제거됐고, 함수 본문·두 호출부(`guard_review_before_push.py` `main()` 내
  REVIEW/PLAN 호출) 모두 더 이상 이를 언급하지 않는다. `grep -n base_cwd` 결과 이 파일에 0건.
- **[해소]** `_run_gate` 호출부의 위치 인자 6개 나열로 인한 가독성 저하 — 17_51_28 INFO. `*` 로
  콜백 인자를 keyword-only 로 강제해 두 호출부 모두 `is_blocked=lambda ...`, `render=lambda ...`
  형태가 되었고, 역할이 호출부만 보고도 드러난다.
- 신규 테스트 `test_per_target_fail_open_still_checks_remaining_targets` 는 이름·docstring·구조가
  같은 파일의 기존 테스트들과 일관되고(케이스별 한 줄 요약 + 근거 리뷰 라운드 인용), 이 라운드가
  고친 불변식("per-target fail-open" — 한 target 의 예외가 나머지 target 검사를 막지 않음)을
  정확히 겨냥한다. 길이·중첩도 다른 테스트와 동일 수준.
- `_run()` 헬퍼에 `raise_paths=()` 매개변수를 기존 `blocked_paths=()`/`plan_blocked_paths=()` 와
  동일한 관례(기본값 빈 튜플, `os.pathsep.join` 으로 env 주입)로 자연스럽게 확장했다 — 새 분기
  로직 추가 없이 기존 패턴 재사용.
- 17_51_28 이 남긴 나머지 INFO 2건(`_run()` 을 우회하는 BYPASS 테스트, `_mentions_branch` 의
  `or " "` 트릭에 인라인 주석 부재)은 이번 diff 범위 밖이라 미반영 상태로 남아 있으나, 둘 다
  전 라운드에서도 "급하지 않음" 으로 분류된 비차단 항목이라 이번 라운드의 위험도에 영향 없음.

## 요약

이번 라운드는 리팩터 자체가 아니라 "리팩터가 만든 드리프트를 되돌리는" 좁은 정정 diff로,
목표한 WARNING·INFO 를 정확히 겨냥해 해소했고 새로 추가한 테스트도 기존 파일의 네이밍·구조
컨벤션과 완전히 일치한다. 남은 것은 테스트 픽스처 내부의 사소한 패턴 반복(INFO) 뿐이며 실행
코드(`guard_review_before_push.py`) 쪽에는 신규 유지보수성 이슈가 없다.

## 위험도
LOW
