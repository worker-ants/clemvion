# 아키텍처(Architecture) 리뷰

리뷰 대상: mermaid-lint 설치 가드 3건(락 liveness·throttle·공유 판정 SoT) 변경.
`git diff origin/main`으로 확인한 실제 신규/변경 범위:
- 신규: `.claude/hooks/_lib/mermaid_lint_ready.py`, `.claude/tests/test_bootstrap_mermaid_install.py`, `.claude/tests/test_mermaid_lint_ready.py`
- 변경: `.claude/hooks/lint_mermaid_posttooluse.py`(SoT 임포트로 치환), `.claude/tools/bootstrap-session.sh`(책임#2 가 ~7줄 → ~70줄로 확장: 마커+mkdir 락+PID liveness+실패 throttle), `.githooks/pre-commit`(SoT CLI 호출로 치환)

## 발견사항

- **[WARNING]** `bootstrap-session.sh` 책임#2(mermaid-lint 설치)가 SRP를 어기며 비대해지는 중 — 같은 파일의 책임#4(reap)와의 처리 방식 불일치
  - 위치: `.claude/tools/bootstrap-session.sh` 22~68행 부근(섹션 "2. Ensure mermaid-lint deps"), 대비 393~413행(섹션 "4. Reap …")
  - 상세: 이번 변경으로 책임#2 로직이 `[ -d node_modules ]` 한 줄 검사에서 마커 파일 기록 + owner-aware `mkdir` 락 + PID liveness 기반 stale-lock 탈취 + 실패 throttle 쿨다운까지 포함하는 약 70줄의 비자명한 동시성 상태 머신으로 커졌다. 그런데 같은 파일이 이미 갖고 있는 책임#4(reap)는 정확히 이런 종류의 복잡도를, 별도 스크립트(`reap-merged-worktrees.sh`) + 별도 격리 테스트(`test_reap_merged_worktrees.py`, 자체 fixture로 그 스크립트만 직접 실행)로 분리해 두었다. 책임#2 는 그 선례를 따르지 않고 `bootstrap-session.sh` 안에 인라인으로 남아, 4가지 무관한 책임(githooks 활성화·설치·상태 GC·reap)이 한 파일에 응집도 낮게 뒤섞인 상태다. 그 결과가 테스트에도 드러난다 — `test_bootstrap_mermaid_install.py`는 책임#2 하나만 검증하려고 매번 `bootstrap-session.sh` 전체(4개 책임 전부)를 서브프로세스로 복사·실행해야 하고, 무관한 reap 섹션을 조용히 무력화하기 위해 `REAP_MIN_INTERVAL`/`REAP_GH_BIN` 환경변수까지 명시적으로 채워 넣는다(`_env()`의 주석: "reap section is inert here … regardless of these"). 앞으로 SessionStart 에 책임이 더 늘어날 때마다 이 "무관한 섹션을 죽여서 격리" 패턴이 누적된다.
  - 제안: 책임#2를 `.claude/tools/reap-merged-worktrees.sh`와 대칭적으로 별도 스크립트(예: `ensure-mermaid-lint-deps.sh`)로 추출하고, `bootstrap-session.sh`는 그 스크립트를 호출만 하도록 축소. 내부 로직이 이미 `_install_throttled`/`_lock_is_dead` 같은 이름 있는 predicate 함수로 잘 분해되어 있어 파일 경계만 옮기는 기계적 리팩터로 가능하다. `test_bootstrap_mermaid_install.py`도 `test_reap_merged_worktrees.py`처럼 그 스크립트 하나만 대상으로 하는 격리 테스트로 단순화된다.

- **[WARNING]** `lint_mermaid_posttooluse.py`의 신규 SoT import 가 같은 `_lib` 소비 계열의 기존 방어적 import 관례에서 벗어남
  - 위치: `.claude/hooks/lint_mermaid_posttooluse.py` 38~39행, 대비 `.claude/hooks/guard_default_branch_edit.py` 27~37행 / `guard_default_branch_prompt.py` 동일 패턴
  - 상세: 기존 관례(`guard_default_branch_edit.py`, `guard_default_branch_prompt.py`)는 `sys.path.insert(0, THIS_DIR)`로 **hooks/ 디렉터리 자체**를 경로에 얹고 `from _lib.branch_guard import evaluate`로 `_lib` 패키지 네임스페이스를 유지하며, 이 import 자체를 `try/except Exception: traceback.print_exc(); sys.exit(0)`로 감싸 "공유 모듈이 깨져도 반드시 fail-open"을 import 경계에서 명시적으로 보장한다. 신규 코드는 `sys.path.insert(0, os.path.join(..., "_lib"))`로 **`_lib` 자체**를 경로에 얹어 `mermaid_lint_ready`를 `_lib` 패키지를 우회한 flat top-level 모듈로 import하고, 이 import 문에 방어 래핑이 없다. 실행 결과 자체는 이 훅의 문서화된 계약("any other [exit code] → treated as a runtime error; non-blocking")상 uncaught ImportError 도 결국 fail-open으로 수렴할 개연성이 높지만, 그것은 CPython 기본 예외 처리 동작에 암묵적으로 기대는 것이지, 형제 훅들이 하듯 import 경계에서 명시적으로 보장하는 것이 아니다. 같은 위험(공유 모듈 로드 실패)에 대해 같은 디렉터리 안에서 두 가지 다른 방어 수준이 공존하게 된다.
  - 제안: `sys.path.insert(0, hooks_dir)` + `from _lib.mermaid_lint_ready import is_ready`로 패키지 네임스페이스를 맞추고, `guard_default_branch_edit.py`와 동일하게 `try/except Exception: traceback.print_exc(); sys.exit(0)`로 감싸 import 실패 시 fail-open을 명시적으로 보장.

- **[INFO]** "git-common-dir 로 main 체크아웃 루트를 구한다" 로직의 4중 중복 — 이번 변경이 만든 것은 아니나, 이번에 새로 생긴 SoT 모듈의 교훈이 여기엔 적용되지 않음
  - 위치: `bootstrap-session.sh` 22행, `reap-merged-worktrees.sh` 95행, `.githooks/pre-commit` 26행(모두 기존 코드, 이번 diff 밖) + `lint_mermaid_posttooluse.py` `_resolve_tool_dir`(168~171행, subprocess 로 동일 git 호출 재현)
  - 상세: 동일한 `git rev-parse --path-format=absolute --git-common-dir` → `dirname` 패턴이 이제 3개 bash 파일 + 1개 python 파일(subprocess 경유)에 나온다. `mermaid_lint_ready.py`의 docstring은 정확히 이 클래스의 위험("a bash file and a python file cannot share a runtime constant")을 명시하고, 마커 이름 하나에 대해서는 binding 테스트(`ConsumerBindingTest`)로 drift 를 막아 두었다. 그런데 그보다 더 복잡하고 동일하게 drift 위험이 있는 "main 루트 계산" 로직에는 같은 교훈이 적용되지 않았다. 이번 diff 가 만든 결함은 아니고(3곳은 미변경), 신규로 건드린 파일들도 이미 이 패턴을 그대로 재사용했을 뿐이라 이번 변경 범위 안에서 새로 발생한 리스크는 아니다.
  - 제안: 지금 당장 조치 불필요. 향후 이 4개 파일 중 하나를 다시 손볼 일이 생기면, `mermaid_lint_ready.py`와 같은 성격의 단일 SoT(예: 공유 셸 함수 + python 헬퍼 쌍, 혹은 최소한 binding 테스트)로 통합할 것을 권고.

- **[INFO]** 테스트 파일 간 모듈 로딩 방식 불일치
  - 위치: `.claude/tests/test_mermaid_lint_ready.py` 17~20행(`_harness.load_module_by_path(...)`) 대비 `.claude/tests/test_branch_guard.py` 16~17행(`from _lib import branch_guard as bg`)
  - 상세: `_lib`에 이미 `__init__.py`가 있고 `_harness` 임포트가 `hooks/`를 `sys.path`에 얹으므로, `test_mermaid_lint_ready.py`도 형제 테스트처럼 `from _lib import mermaid_lint_ready as ready`로 충분히 동작했을 것이다. 대신 `_harness.load_module_by_path`라는 별도 경로-기반 로더를 새로 사용해, 같은 테스트 스위트 안에 두 가지 모듈 로딩 관례가 공존한다. 기능상 문제는 없음(둘 다 동작).
  - 제안: 우선순위 낮음. 다음에 이 파일을 만질 때 형제 테스트와 같은 `from _lib import ...` 스타일로 맞추면 테스트 스위트 내부 일관성이 좋아진다.

## 긍정적으로 평가할 설계

- `mermaid_lint_ready.py`는 이 저장소가 이미 `branch_guard.py`로 검증한 패턴(하나의 파이썬 모듈을 python 훅에는 직접 import, bash 훅에는 CLI + exit code 로 노출)을 그대로 재사용한 것으로, cross-language SoT 문제에 대한 임시방편이 아니라 기존 컨벤션의 일관된 확장이다. 모듈 자체는 외부 의존성 0, 순환 참조 0인 순수 leaf 모듈로 결합도가 낮고 응집도가 높다.
- 마커 이름(`MARKER_NAME`)이 bash 쓰기 측(`bootstrap-session.sh`)에는 하드코딩 문자열로만 존재할 수밖에 없는 cross-language 제약을 회피하지 않고, `test_mermaid_lint_ready.py::ConsumerBindingTest`로 3개 소비자(bootstrap 작성, pre-commit/posttooluse 읽기)가 같은 문자열에 합의하는지 자동으로 검증한다 — 이는 결함이 아니라 의도적으로 인지되고 테스트로 방어된 트레이드오프다.
- `bootstrap-session.sh`의 "항상 exit 0" 불변식은 이번 확장(락/마커/throttle 추가) 전 구간에서도 `|| true`/`2>/dev/null` 로 일관되게 지켜지고 있어, 책임#2 내부 복잡도 증가가 파일 전체의 core invariant를 깨지 않는다.

## 요약

이번 변경의 핵심 산출물인 `mermaid_lint_ready.py`는 이 저장소의 기존 `branch_guard.py` 패턴을 그대로 계승한 잘 설계된 단일 진실 공급원으로, DIP 적용·순환 의존성 부재·낮은 결합도라는 점에서 아키텍처적으로 견고하다. 다만 그 SoT를 뒷받침하는 두 소비 지점의 구현 방식에서 기존 관례와의 불일치가 보인다 — (1) `bootstrap-session.sh`는 설치 락 로직이 크게 복잡해졌음에도 같은 파일의 reap 책임이 이미 보여준 "별도 스크립트로 추출" 선례를 따르지 않아 SRP/응집도 측면에서 아쉬우며, 이는 테스트가 무관한 섹션을 명시적으로 무력화해야 하는 형태로 이미 드러나고 있다. (2) `lint_mermaid_posttooluse.py`의 신규 import는 형제 훅들이 확립한 "import 경계에서 명시적 fail-open 보장" 관례를 따르지 않았다. 두 사안 모두 동작을 깨뜨리는 결함이라기보다 유지보수성·일관성 측면의 개선 여지이며, 향후 SessionStart 책임이 더 늘어나거나 공유 모듈이 더 늘어날 때 복리로 커질 수 있는 성격이라 지금 단계에서 정리해 두는 편이 저비용이다.

## 위험도

LOW
