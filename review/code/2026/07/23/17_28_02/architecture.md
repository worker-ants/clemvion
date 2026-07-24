# 아키텍처(Architecture) 리뷰

## 발견사항

- **[WARNING]** REVIEW/PLAN 게이트 루프의 DRY 위반 — `main()` 안에서 거의 동일한 for-loop 구조가 두 번 반복
  - 위치: `.claude/hooks/guard_review_before_push.py` 506-520행(REVIEW 게이트 루프), 524-540행(PLAN 게이트 루프)
  - 상세: `scoped = _accepts_cwd(evaluate_fn)` → `for target in targets if scoped else [None]:` → `try/except Exception: continue` → 조건부 block 메시지 출력 & `return 2` 라는 동일한 골격이 `evaluate_review`/`evaluate_plan` 두 번 그대로 복붙되어 있습니다. 로직(조기 return 조건, 예외 fail-open, worktree 순회)은 완전히 동일하고 달라지는 건 함수 참조와 메시지 템플릿뿐입니다. 이 파일은 이미 이전에 게이트 2개(review/plan) 구조를 병렬로 유지해 온 이력이 있어(원래 diff의 `-` 쪽도 대칭 구조), 세 번째 게이트가 추가되면 동일 버그(예: try/except 처리 누락, `continue` 빠뜨림)가 두 곳/세 곳에 따로 재현될 위험이 커집니다.
  - 제안: `_run_gate(evaluate_fn, targets, on_block: Callable[[Any, str], NoReturn | None]) -> int | None` 같은 공용 헬퍼로 추출해 REVIEW/PLAN 양쪽에서 재사용. 메시지 포맷팅만 콜백/템플릿으로 분리.

- **[WARNING]** `_accepts_cwd` 리플렉션 기반 capability probe 가 실제 production 함수 시그니처에 대해서는 직접 테스트되지 않음
  - 위치: `.claude/hooks/guard_review_before_push.py` 402-426행(`_accepts_cwd` 정의), 506행·524행(호출부)
  - 상세: `_accepts_cwd()` 는 `inspect.signature` 로 POSITIONAL_ONLY/POSITIONAL_OR_KEYWORD/VAR_POSITIONAL 파라미터 존재 여부만 검사합니다. 지금은 `review_guard.evaluate_review(cwd: str | None = None)` / `plan_guard.evaluate_plan(cwd: str | None = None)` 가 POSITIONAL_OR_KEYWORD 라 정상 동작하지만, 이 판정 로직과 두 함수의 실제 시그니처를 묶어주는 계약(타입/Protocol/테스트)이 코드베이스 어디에도 없습니다. `.claude/tests/test_guard_review_before_push_main.py` 는 **무인자** 스텁으로, `.claude/tests/test_push_guard_worktree_scope.py` 는 `cwd=None` 스텁으로 각각 한쪽 분기만 검증하며, 실제 `review_guard.py`/`plan_guard.py` 를 import 해 `_accepts_cwd(evaluate_review) is True` 를 직접 단언하는 테스트는 없습니다(grep 결과 `_accepts_cwd` 참조는 훅 파일 자신뿐). 만약 향후 누군가 `evaluate_review(*, cwd=None)` 처럼 keyword-only 로 리팩터하면 `_accepts_cwd` 는 조용히 False 를 반환하고, 훅은 이 PR 이 고치려는 바로 그 버그(cwd 미전달 → false ALLOW)로 소리 없이 회귀하지만, 어떤 테스트도 이를 잡지 못합니다. `_accepts_cwd` 자신의 docstring 이 "silently disabled gate" 위험을 명시적으로 경고하고 있는 것과 대비되는 갭입니다.
  - 제안: `review_guard.evaluate_review`/`plan_guard.evaluate_plan` 을 실제로 import 해 `_accepts_cwd(evaluate_review)`/`_accepts_cwd(evaluate_plan)` 이 `True` 임을 고정하는 짧은 계약 테스트를 추가하거나(가장 저비용), 장기적으로는 `typing.Protocol`(`class ScopedGate(Protocol): def __call__(self, cwd: str | None = ...) -> ...`) 로 명시적 인터페이스를 선언해 리플렉션 대신 타입 계약으로 결합.

- **[INFO]** worktree 토폴로지 헬퍼가 `_lib/` 이 아닌 훅 스크립트 안에 직접 위치 — 기존 레이어링과의 비대칭
  - 위치: `.claude/hooks/guard_review_before_push.py` 347-441행(`_BRANCH_CHAR`, `_worktree_branches`, `_mentions_branch`, `_accepts_cwd`, `_push_targets`)
  - 상세: 이 모듈은 이미 "훅 엔트리포인트는 얇게, 도메인 판정 로직은 `_lib/review_guard.py`·`_lib/plan_guard.py` 로 분리" 라는 레이어링을 갖고 있습니다(모듈 docstring 10-23행이 그 계약을 설명). 이번 변경으로 추가된 `_worktree_branches`(git subprocess + porcelain 파싱)·`_mentions_branch`(경계 매칭)·`_push_targets`(대상 선정) 는 push 탐지(`_is_git_push` 계열, 기존에도 훅 파일에 있음)와는 성격이 다른 새로운 관심사 — "이 저장소의 worktree 토폴로지를 질의/해석" — 인데도 `_lib` 로 분리되지 않고 훅 파일에 직접 추가되어, 파일이 이미 250줄을 넘는 정규식/파싱 로직(push 탐지)에 더해 또 다른 파싱 로직(worktree 목록)까지 떠안는 "god hook" 방향으로 자라고 있습니다.
  - 제안: 당장 문제를 일으키진 않지만(테스트도 통과, import 구조도 단순), 향후 Stop 훅 등 다른 훅이 동일한 worktree-scoping 이 필요해지면 `_lib/worktree_scope.py` 로 뽑아 재사용성과 `_lib` 레벨 단위테스트 대칭성을 확보할 것을 권장.

- **[INFO]** 시그니처 기반 legacy degrade 는 명시적 계약(Protocol/ABC) 대신 duck-typing 위에 설계된 pragmatic 절충
  - 위치: `.claude/hooks/guard_review_before_push.py` 402-426행
  - 상세: `_accepts_cwd` 는 "정상 시그니처가 아니면 legacy 단일-worktree 호출로 degrade" 라는 설계를 런타임 리플렉션으로 구현합니다. 프로젝트 전반이 이미 "정밀 파서보다 blind/방어적 판정" 철학(`_is_git_push` 의 긴 docstring 이 그 근거)을 따르고 있어 스타일적으로는 일관됩니다. 다만 이는 "함수가 cwd 를 받는가" 라는 암묵적 인터페이스를 코드 전체(훅 + review_guard + plan_guard + 두 테스트 스텁)가 공유하면서도 어디에도 타입으로 선언돼 있지 않다는 뜻이라, 위 WARNING 항목의 근본 원인이기도 합니다. 결함이라기보다는 "이 프로젝트 표준에서는 수용 가능하지만 계약을 명문화하면 더 안전해지는" INFO 성격.

## 요약

이번 변경은 기존 `guard_review_before_push.py` 의 "훅 = 얇은 오케스트레이터, 도메인 판정 = `_lib/*_guard.py`" 레이어링을 유지한 채, cwd 미전달로 인한 false-ALLOW 를 worktree 스코프 확장으로 정확히 겨냥해 고쳤고, `_accepts_cwd` probe 로 시그니처 불일치가 게이트를 조용히 무력화하는 것을 방지하려는 설계 의도가 코드·docstring·plan 문서에 일관되게 기록되어 있습니다. 순환 의존성이나 레이어 위반은 없으며 fail-open 철학도 기존 코드와 일치합니다. 다만 (1) REVIEW/PLAN 두 게이트 루프의 완전한 구조적 중복, (2) 이 기능 전체가 의존하는 `_accepts_cwd` 리플렉션 계약이 실제 production 함수 시그니처에 대해서는 테스트로 고정되지 않아 향후 조용한 회귀 가능성이 남아 있는 점, (3) 새 worktree-topology 헬퍼가 기존 `_lib` 분리 관례와 다르게 훅 파일에 직접 추가되어 파일이 계속 커지는 점은 구조적으로 개선 여지가 있습니다. 치명적 결함은 아니며 CRITICAL 은 없습니다.

## 위험도

LOW
