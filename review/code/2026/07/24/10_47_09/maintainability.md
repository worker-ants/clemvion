### 발견사항

- **[WARNING]** `_run_gates`의 REVIEW/PLAN 게이트 처리 블록이 거의 동일한 구조로 중복됨
  - 위치: `.claude/hooks/guard_review_before_push.py:692-739` (함수 `_run_gates`)
  - 상세: `BYPASS_*` 체크 → `evaluate_* is None`(import 실패) 처리 → `_evaluate_over_targets` 호출 → `blocked is not None`이면 stderr 출력 후 `return 2` 라는 동일한 4단계 흐름이 REVIEW(692-714)와 PLAN(717-736) 두 번 손으로 반복되어 있다. `_evaluate_over_targets`가 이미 `is_blocked`/`render` 콜백을 받는 테이블-드리븐 형태로 설계돼 있음에도, 정작 호출부(`_run_gates`)는 그 패턴을 게이트 목록으로 일반화하지 않았다. 이 파일 자체의 docstring과 테스트 주석(`review 17_28_02 WARNING 1` — "PLAN 게이트 스코핑이 REVIEW에만 테스트가 있어 전혀 검증되지 않았다")이 바로 이런 REVIEW/PLAN 비대칭 구현에서 실제로 결함이 나온 이력을 증언하고 있어, 향후 한쪽 블록만 수정되고 다른 쪽이 누락되는 drift 위험이 현실적이다.
  - 제안: `(env_var, evaluate_fn, import_error, gate_name, is_blocked, render)` 형태의 게이트 명세 리스트를 만들고 동일 루프로 처리하면 두 블록이 구조적으로 하나의 코드 경로를 공유하게 되어, 새 게이트 추가나 한쪽만 고치는 실수를 원천적으로 줄일 수 있다. (단, 이 파일의 다른 정규식/파서 로직처럼 "무한 표면"을 정밀화하는 리팩터는 아니므로 — 순수 dict/list 기반 dispatch라 안전하게 적용 가능하다.)

- **[WARNING]** 테스트 헬퍼 `_run`이 커스텀 env(BYPASS_*, CLAUDE_PROJECT_DIR)·대체 스크립트 경로를 지원하지 않아 5개 테스트가 `subprocess.run(...)` 호출을 통째로 복붙함
  - 위치: `.claude/tests/test_push_guard_worktree_scope.py:195-214`(`test_bypass_still_applies_to_scoped_targets`), `:216-243`(`test_bypass_plan_also_suppresses_a_scoped_block`), `:303-348`(`test_degradation_is_counted_once_per_gate_not_per_target`), `:371-419`(`test_target_selection_failure_is_counted_not_silent`), `:437-478`(`test_push_targets_crash_falls_back_to_cwd`)
  - 상세: `_run(self, command, cwd, blocked_paths=(), plan_blocked_paths=(), raise_paths=())` 헬퍼(135-150행)는 `BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD`/`CLAUDE_PROJECT_DIR` 추가나 실행할 스크립트 경로 교체(크래시 재현용 패치 파일)를 지원하지 않는다. 그 결과 위 5개 테스트가 `env = dict(os.environ)` 구성, `json.dumps({"tool_input": {"command": ...}, "cwd": ...})` 구성, `subprocess.run([sys.executable, ...], capture_output=True, text=True, env=env)` 호출, `env.pop("BYPASS_REVIEW_GUARD", None)` / `env.pop("BYPASS_PLAN_GUARD", None)` 라인을 각각 손으로 반복한다. 파일 전체가 (하네스 신뢰도를 위해) 의도적으로 실제 subprocess를 띄우는 스타일이라 완전한 DRY가 목표는 아니지만, 이 정도 boilerplate 반복은 한 곳을 고치고 다른 곳을 빠뜨리는 전형적인 테스트 drift 위험을 만든다.
  - 제안: `_run`에 `extra_env: dict | None = None`, `script: Path | None = None` 키워드 인자를 추가해 위 5개 테스트를 헬퍼 경유로 통합하면 중복이 크게 줄어든다.

- **[INFO]** 삼항식이 백슬래시 줄바꿈으로 쪼개지며 두 번째 줄 들여쓰기가 0칸으로 깨져 있음
  - 위치: `.claude/hooks/guard_review_before_push.py:641-642` (함수 `_import_reason`)
  - 상세: `return f"{module} failed to import — {error}" if error else \` 다음 줄이 `f"{module} imported but {symbol} is None"`으로, 함수 본문(4칸 들여쓰기) 대비 들여쓰기가 전혀 없다. 백슬래시 줄바꿈은 문법상 유효하지만(괄호 연속과 달리 들여쓰기가 무의미), 파일의 나머지 부분이 전부 괄호 기반 멀티라인 표현을 쓰는 것과 스타일이 어긋나 시각적으로 코드가 끊겨 보인다.
  - 제안: `(...)` 괄호로 감싸 표준 들여쓰기를 적용하거나, `if/else` 블록으로 풀어써서 나머지 코드베이스 스타일과 맞춘다.

- **[INFO]** 모듈 상단 주석 밀도가 매우 높아(일부 블록 20~40줄) 핵심 정규식/로직을 한눈에 읽기 어려움
  - 위치: `.claude/hooks/guard_review_before_push.py:84-230` 부근 (`_GIT_PUSH` 정규식과 `_redact_inert_text` 관련 주석군)
  - 상세: 세 차례 리뷰 라운드에서 발견된 회귀들을 문서화하려는 의도적 선택으로 보이며(주석 자체가 그 근거를 명시), 실질적 버그는 아니다. 다만 신규 기여자 입장에서 정규식/함수 로직과 그 근거 서술이 강하게 인터리빙되어 있어 "코드가 어디서 시작하는지" 파악에 시간이 걸린다.
  - 제안: 필요하다면 근거 서술을 별도 SoR 문서(`plan/complete/harness-push-guard-subcommand-detection.md`, 이미 언급됨)로 옮기고 코드 옆에는 요약 1~2줄만 남기는 것도 고려할 수 있으나, 이 프로젝트의 반복된 회귀 이력을 볼 때 "왜 이렇게 짰는가"를 코드 옆에 두는 현재 방식도 합리적 트레이드오프이므로 강제 수정 사항은 아니다.

### 요약

전반적으로 네이밍(`_is_git_push`, `_push_targets`, `_mentions_branch`, `_accepts_cwd` 등)과 함수 분리는 명확하고, 매직 넘버(`_OWNER_WINDOW`, `_MAX_REDACTION_INPUT`, `timeout=5.0`)는 모두 이유가 주석으로 설명되어 있어 진짜 "의미 불명 하드코딩"은 없다. 가장 실질적인 유지보수성 이슈는 `_run_gates`의 REVIEW/PLAN 블록 중복(이 프로젝트가 과거 이 비대칭에서 실제 결함을 낸 이력이 있음)과, 테스트 헬퍼 `_run`의 표현력 부족으로 인한 5개 테스트의 subprocess 호출 boilerplate 반복이다. 둘 다 기능 결함은 아니고 향후 drift 위험을 낮추는 리팩터 기회이며, 나머지(과도한 주석 밀도, 삼항식 들여쓰기)는 사소한 스타일 이슈다.

### 위험도
LOW
