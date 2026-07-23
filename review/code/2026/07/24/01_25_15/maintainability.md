# Maintainability Review — push-guard-worktree-scope

## 발견사항

- **[WARNING]** `_run_gates()` 내 REVIEW/PLAN 두 게이트 블록이 구조적으로 거의 동일하게 중복
  - 위치: `.claude/hooks/guard_review_before_push.py:664-711` (함수 `_run_gates`)
  - 상세: `BYPASS_*` 환경변수 체크 → `evaluate_* is None` 시 `_import_reason` 으로 degraded 기록 → `_evaluate_over_targets` 호출 → `blocked is not None` 이면 stderr 출력 후 `return 2` 라는 20줄짜리 패턴이 REVIEW(668-687)와 PLAN(690-709) 두 번 그대로 반복된다. 이미 `_evaluate_over_targets`가 대부분의 공유 로직(스코핑, degraded 기록, per-target fail-open)을 추출해 놓은 상태라 이 블록 자체도 파라미터화 가능한 형태다. 파일 상단 주석(`_ALL_GATES` 관련, line 557-559)이 "미래에 세 번째 게이트가 추가될 수 있다"를 명시적으로 전제하고 있어, 그 시점에 이 20줄이 다시 한 번 복붙될 위험이 실재한다.
  - 제안: `_run_one_gate(name, bypass_env, evaluate, evaluate_module, evaluate_symbol, import_error, outcome, targets, is_blocked, render)` 형태의 헬퍼로 통합하고 `_run_gates`는 REVIEW/PLAN 두 번 호출만 하도록 축소. (동작 변경은 없는 순수 리팩터이므로 별도 PR/커밋으로 분리해도 됨 — 이번 변경 스코프를 넘는다면 후속 과제로 남겨도 무방.)

- **[INFO]** `_import_reason()` 의 백슬래시 라인 연속(line continuation)이 관례를 벗어나고 후속 편집에 취약
  - 위치: `.claude/hooks/guard_review_before_push.py:650-654` (함수 `_import_reason`)
  - 상세: `return f"..." if error else \` 다음 줄이 들여쓰기 없이(컬럼 0에서) 이어진다. 파일의 다른 모든 멀티라인 표현식은 괄호를 이용한 암묵적 라인 결합을 쓰는데(예: `_MESSAGE_ARG`, `_GIT_PUSH`, docstring 내 함수 호출들) 이 함수만 `\` 이어붙이기를 쓰고 있어 스타일 일관성이 깨진다. `\` 뒤에 trailing whitespace 가 붙으면 조용히 SyntaxError 가 나거나(공백만 있으면 에러) 의도와 다르게 파싱될 수 있어 향후 편집 시 사고 여지가 있다.
  - 제안: `return (f"..." if error else f"...")` 처럼 괄호로 감싸 들여쓰기를 정렬하고 관례를 통일.

- **[INFO]** `_evaluate_over_targets()` 파라미터가 파일의 나머지 함수와 달리 타입힌트가 전혀 없음
  - 위치: `.claude/hooks/guard_review_before_push.py:617` (함수 시그니처 `_evaluate_over_targets(evaluate, targets, *, gate, outcome, is_blocked, render)`)
  - 상세: 같은 파일의 `_push_targets(command: str, cwd: str) -> list[str]`, `_mentions_branch(command: str, branch: str) -> bool`, `_accepts_cwd(fn) -> bool` 등은 일관되게 타입힌트를 붙이는데, 게이트 실행의 핵심 허브인 이 함수만 전무하다. `evaluate`/`is_blocked`/`render`는 콜러블이라 정밀한 타입이 번거롭더라도 `targets: list[str]`, `gate: str`, `outcome` 정도는 힌트를 붙일 수 있다.
  - 제안: 최소한 `targets: list[str]`, `gate: str` 는 타입힌트 추가. 콜러블 3종은 `Callable[..., object]` 등 느슨한 타입으로도 일관성 개선 가능.

- **[INFO]** 테스트 파일에서 특수 시나리오 4건이 공용 `_run()` 헬퍼를 쓰지 않고 `subprocess.run` 을 직접 재구성
  - 위치: `.claude/tests/test_push_guard_worktree_scope.py` — `test_bypass_still_applies_to_scoped_targets`(195-214), `test_degradation_is_counted_once_per_gate_not_per_target`(274-319), `test_target_selection_failure_is_counted_not_silent`(342-389), `test_push_targets_crash_falls_back_to_cwd`(408-449)
  - 상세: 이 4개 테스트는 각각 `CLAUDE_PROJECT_DIR` 오버라이드, `failopen_state.py` 사전 복사, 훅 소스 patch-and-copy 등 `_run()` 이 지원하지 않는 부가 설정이 필요해 boilerplate(env 구성 5-6줄 + subprocess.run 호출)가 매 테스트마다 반복된다. 각 테스트가 요구하는 부가 설정이 서로 달라 기계적 추출이 always-win은 아니지만, 공통 부분(payload JSON 구성, capture_output/text 옵션)만이라도 작은 헬퍼로 뽑으면 가독성이 개선된다.
  - 제안: 급하지 않음(기능 결함 아님). 리팩터링 시 `_run_with_env(command, cwd, extra_env)` 같은 저수준 헬퍼를 두고 `_run()`이 그 위에 얹히도록 하면 boilerplate 축소 가능.

## 요약

이번 변경(`guard_review_before_push.py`의 워크트리 스코핑 확장, 대응 테스트, README 카탈로그 갱신)은 전반적으로 유지보수성이 높다. 함수 단위가 작고 단일 책임에 가깝고(`_push_targets`, `_mentions_branch`, `_accepts_cwd`, `_worktree_branches` 등), 네이밍이 목적을 명확히 드러내며, 매직 넘버(`_OWNER_WINDOW`, `_MAX_REDACTION_INPUT`, `timeout=5.0`)는 모두 이름이 붙고 그 값을 고른 근거가 주석으로 남아 있다. 과거 3라운드에 걸친 리뷰 회귀(ReDoS, false-ALLOW 등)를 반영해 "왜 이렇게 짰는지"를 설명하는 주석 밀도가 매우 높아 다음 편집자가 안전한 변경 범위를 판단하기 쉽다. 테스트 파일도 실제 하위 프로세스로 훅 전체를 구동하는 e2e 스타일을 취해, mock 이 놓치는 제어 흐름(교차 워크트리 false-ALLOW, per-target fail-open, `_accepts_cwd` 시그니처 계약)을 실측으로 고정한다. 유일하게 실질적인 개선 여지는 `_run_gates()`의 REVIEW/PLAN 블록 중복(WARNING) — 파일 스스로가 "미래의 세 번째 게이트"를 상정하고 있는 만큼, 지금 추출해두면 다음 게이트 추가 시 복붙 리스크를 없앨 수 있다. 나머지는 스타일 사소 편차(INFO) 수준으로 병합을 막을 사안은 아니다.

## 위험도
LOW
