# 테스트(Testing) 리뷰 — push 가드 worktree 스코프

## 발견사항

- **[WARNING]** PLAN 게이트의 worktree 스코핑 경로가 e2e 테스트에서 전혀 검증되지 않음
  - 위치: `.claude/hooks/guard_review_before_push.py` 523-540행 (`main()`의 PLAN 게이트 루프), `.claude/tests/test_push_guard_worktree_scope.py` 60-73행 (`_PLAN_STUB`)
  - 상세: `main()`은 REVIEW 게이트(505-520행)와 PLAN 게이트(523-540행)에 대해 **동일한 구조의 루프**(`scoped = _accepts_cwd(fn)` → `for target in targets if scoped else [None]: ...`)를 복붙 형태로 각각 구현한다. 그런데 신설된 `test_push_guard_worktree_scope.py`의 `_PLAN_STUB.evaluate_plan()`은 항상 `untouched=False`(항상 clean)를 반환하도록 하드코딩돼 있어(60-73행), 이 스위트의 모든 케이스는 PLAN 게이트가 절대 block 하지 않는다. REVIEW 게이트가 block 되는 케이스는 `return 2`로 조기 종료되어 PLAN 루프에 도달조차 하지 않고, REVIEW 가 clean 인 케이스도 PLAN 이 항상 clean 이므로 PLAN 게이트 자체가 실질적으로 한 번도 "다른 worktree 를 보고 block" 하는 경로를 타지 않는다. 결과적으로 "PLAN 게이트가 cwd 가 아닌 다른 target 의 plan 상태를 보고 block 하는지", 그리고 새로 추가된 `_PLAN_MSG` 의 `worktree:` 필드(469행, `.format(..., worktree=target or base_cwd)` — 534-536행)가 올바르게 채워지는지는 이 테스트 파일에서 검증되지 않는다. `test_guard_review_before_push_main.py`의 기존 PLAN 관련 테스트(`test_push_blocked_by_plan_gate_when_review_clean` 등)도 no-arg stub 만 사용하므로 `scoped=False` 경로만 검증하고, scoped(멀티 worktree) PLAN 차단은 이번 변경 전체에서 미검증 상태다.
  - 제안: `_PLAN_STUB`을 `STUB_PLAN_UNTOUCHED_PATHS` 같은 경로-키 환경변수로 바꿔, REVIEW 는 clean 으로 고정한 채 PLAN 만 side worktree 에서 block 되는 케이스(`test_false_allow_hole_is_closed`의 PLAN 버전)를 최소 1건 추가할 것. `_PLAN_MSG`의 `worktree:` 라인이 실제로 target 경로를 담는지도 함께 단언.

- **[WARNING]** `_worktree_branches` 의 fail-open 경로(빈 리스트 반환)가 직접 단위 테스트되지 않음
  - 위치: `.claude/hooks/guard_review_before_push.py` 350-367행 (`_worktree_branches`)
  - 상세: 이 함수는 `git worktree list --porcelain` 서브프로세스가 비-0 종료하거나 예외(타임아웃 포함, `timeout=5.0`)를 던지면 `[]`를 반환하는 fail-open 계약을 docstring 에 명시한다("Best-effort: returns [] on any failure"). 그런데 이 파일에는 `_worktree_branches`를 직접 호출하는 단위 테스트가 하나도 없다(e2e 테스트를 통해 정상 경로만 간접 검증됨). git 이 없는 디렉터리, `git worktree list` 가 비-0 을 반환하는 경우, subprocess 가 timeout 되는 경우, detached HEAD worktree(포셀린 출력에 `branch ` 줄 없이 `detached` 만 있는 경우 — 현재 파서는 이를 조용히 건너뜀)와 같은 케이스가 전혀 커버되지 않는다.
  - 제안: `_worktree_branches`에 대한 전용 단위 테스트 클래스를 추가 — (1) 실제 포셀린 텍스트 샘플을 문자열로 주입해 정상 파싱을 확인(서브프로세스 없이 파싱 로직만 분리 테스트하거나, 최소 detached-HEAD 를 포함한 실제 저장소로 e2e 확장), (2) `cwd`가 git 저장소가 아닌 임의 디렉터리일 때 `[]`를 반환하는지, (3) `subprocess.run`이 예외를 던지는 상황(mock 또는 존재하지 않는 git 바이너리)에서 `[]`로 fail-open 하는지.

- **[WARNING]** `main()`의 `_push_targets` 전체 실패 시 fail-open 경로(497-502행)가 미검증
  - 위치: `.claude/hooks/guard_review_before_push.py` 497-502행
  ```
  497:    try:
  498:        targets = _push_targets(command, base_cwd)
  499:    except Exception:
  500:        traceback.print_exc(file=sys.stderr)
  501:        targets = [base_cwd]  # fail open to legacy single-worktree behaviour
  ```
  - 상세: 이 경로가 트리거되면 정확히 이번 수정 전(cwd-only) 동작으로 되돌아간다 — 즉, 이 fix 가 닫으려는 바로 그 false-ALLOW 구멍이 예외 상황에서는 소리 없이 재발한다(stderr 에 traceback 만 남고 사용자에게 별도 신호 없음). `_worktree_branches` 자체가 이미 광범위한 `except Exception: return []`로 방어하고 있어 실제로 `_push_targets`가 예외를 던질 경로는 좁지만(예: `os.path.realpath`가 매우 특이한 경로에서 예외를 던지는 경우 등), 이 fallback 자체를 검증하는 테스트가 전무하다. `_accepts_cwd`의 docstring 이 "signature mismatch 를 조용히 fail-open 시키면 안 된다"는 교훈을 명시적으로 남겼는데, 그 옆의 이 fallback 은 같은 계열의 위험(제일 중요한 안전장치가 조용히 예전 취약 동작으로 퇴행)을 안고 있으면서 테스트가 없다.
  - 제안: `_push_targets`를 monkeypatch(단위 테스트 레벨, 서브프로세스 아님)해 예외를 던지도록 만들고, `main()`이 `targets = [base_cwd]`로 안전하게 폴백하며 REVIEW/PLAN 게이트가 여전히 cwd 기준으로는 정상 동작하는지 확인하는 회귀 테스트 1건 추가.

- **[INFO]** `_accepts_cwd`의 시그니처 판별 로직에 대한 격리된 단위 테스트 부재
  - 위치: `.claude/hooks/guard_review_before_push.py` 402-426행 (`_accepts_cwd`)
  - 상세: 이 함수의 docstring 은 스스로 "load-bearing"이라 명시하고, 초안에서 이미 한 번 실제 회귀(시그니처 불일치가 게이트 9건을 조용히 무력화)를 낸 이력이 있다. 현재는 실제 두 가지 구체적 형태(`evaluate_review(cwd=None)`류 dataclass 기반 stub, `evaluate_review()`류 no-arg stub)를 통한 e2e 검증과 plan 문서의 mutation table(M3)만 존재한다. `inspect.signature` 를 직접 호출하는 이 함수 자체를 다양한 시그니처(`lambda: None`, `def f(*args): ...`, `def f(*, cwd=None): ...`, `functools.partial`, `inspect.signature`가 예외를 던지는 C-확장 콜러블 등)로 직접 단위 테스트하면 e2e 서브프로세스보다 더 빠르고 명확하게 회귀를 잡을 수 있다.
  - 제안: `MentionsBranchTest`처럼 훅 모듈을 직접 import 해 `_accepts_cwd`만 겨냥하는 소규모 테스트 클래스 추가.

- **[INFO]** `_push_targets`가 명령이 **2개 이상**의 worktree branch 를 동시에 언급하는 케이스 미검증
  - 위치: `.claude/hooks/guard_review_before_push.py` 429-441행 (`_push_targets`)
  - 상세: docstring 은 "Order-stable, de-duplicated, cwd first"를 명시적으로 계약하지만, 현재 e2e 테스트는 모두 "cwd + 최대 1개의 추가 target" 케이스만 다룬다. 여러 worktree branch 가 동시에 언급되는 명령(예: 두 브랜치명을 모두 포함한 커밋 메시지, 또는 `git push origin a && git push origin b`)에서 순서·중복제거가 계약대로 동작하는지 확인하는 테스트가 없다.
  - 제안: 3개 이상의 linked worktree 를 만들고, 명령이 그중 2개의 branch 를 언급하는 케이스에서 `_push_targets`(또는 e2e 로 두 worktree 모두 block 되는지)를 확인하는 테스트 1건 추가.

- **[INFO]** stale(디스크에서 사라진) worktree 항목에 대한 방어 로직(436행 `not os.path.isdir(path)`) 미검증
  - 위치: `.claude/hooks/guard_review_before_push.py` 436행
  - 상세: `git worktree list`가 보고하지만 실제 디렉터리는 이미 삭제된 worktree(reaper 가 지웠지만 `git worktree prune` 이 아직 안 된 상태 등, 이 저장소의 reaper 관련 메모에 비춰 실제로 흔히 발생 가능한 상황)에 대해 `isdir` 가드가 있지만, 이를 직접 자극하는 테스트가 없다.
  - 제안: 낮은 우선순위. 여유가 되면 side worktree 디렉터리만 `shutil.rmtree`로 지우고(`.git/worktrees/` 메타데이터는 남긴 채) `_push_targets`가 해당 target 을 건너뛰는지 확인.

- **[INFO]** `MentionsBranchTest.setUp`이 프로젝트 컨벤션(`_harness.load_module_by_path`) 대신 수동 `sys.path.insert`+`importlib.import_module` 사용
  - 위치: `.claude/tests/test_push_guard_worktree_scope.py` 205-209행
  - 상세: `.claude/tests/README.md`의 "Conventions for new tests"는 `_lib` 패키지명 충돌을 피하려 `_harness.load_module_by_path`를 쓰라고 명시한다. `guard_review_before_push`는 충돌 대상이 아니라 당장 문제는 없지만, 매 테스트 메서드(`setUp`)마다 `sys.path`에 같은 경로를 누적 삽입하고 정리(`tearDown`/`addCleanup`)하지 않는 점은 사소한 위생 이슈다. 다른 테스트 파일이 나중에 같은 이름의 모듈을 다른 경로에서 import 하려 할 때 `sys.modules` 캐시로 인해 혼선을 줄 여지가 있다.
  - 제안: 모듈 레벨에서 1회만 import 하거나 `_harness.load_module_by_path`로 통일.

## 요약

새로 추가된 `test_push_guard_worktree_scope.py`(9건)는 이번 fix 의 핵심 회귀(cwd 가 clean 인데 push 대상 worktree 가 unreviewed 인 false-ALLOW)를 정확히 겨냥한 `test_false_allow_hole_is_closed`를 필두로, cwd 상시평가·무관 worktree 비차단·BYPASS 전파·non-push 무영향까지 실제 git 저장소·실제 subprocess·경로-키 stub 게이트로 견고하게 검증하며, 기존 `test_guard_review_before_push_main.py` 20건도 전부 회귀 없이 통과함을 직접 실행으로 확인했다(9+20건 green, mutation 4건 기록 확인). 다만 REVIEW 게이트와 완전히 대칭인 PLAN 게이트의 스코핑 경로가 하드코딩된 `_PLAN_STUB`(항상 clean) 탓에 한 번도 block 경로를 타지 않아 미검증 상태이고, `_worktree_branches`/`_push_targets`의 fail-open(예외/git 실패) 분기와 `_accepts_cwd`의 시그니처 판별 로직도 e2e 간접 검증에만 의존한다 — 이 세 곳 모두 "정합성 fix가 조용히 예전 취약 동작으로 퇴행"할 수 있는 지점이라는 점에서 보강 가치가 있다. 발견된 코드 버그는 없다.

## 위험도
MEDIUM
