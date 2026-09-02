# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** 새 공유 코어·frontend 전용 산출물이 **실제 CI job(`backend-checks.yml`/`frontend-checks.yml`)의 `changes` pathspecs 에 미등재** — 그 파일만 고친 PR 은 실제 `tsc` 검증이 no-op 으로 통과한다
  - 위치: `.github/workflows/frontend-checks.yml:41-64` (`changes` job 의 `pathspecs:` 블록 — 이 리뷰 diff 로는 건드리지 않은 기존 블록. 전체 파일 컨텍스트 게이트 기준)
  - 위치(참고, 이번 diff 밖 파일이지만 직접 `Read`로 확인): `.github/workflows/backend-checks.yml:60-73`
  - 상세: 이 PR 은 `scripts/_typecheck_ratchet.py`(공유 판정 코어), `scripts/check-frontend-typecheck-ratchet.py`, `scripts/frontend-typecheck-baseline.json`, `codebase/frontend/tsconfig.typecheck.json` 을 새로 도입하고, `harness-checks.yml` 의 pathspecs 에는 이 넷을 성실히 등재했다(단 `tsconfig.typecheck.json` 은 `codebase/frontend/**` 로 이미 커버). 그런데 **정작 실제 `tsc` 를 돌려 판정하는 `frontend-checks.yml` 자신의 `changes` job pathspecs 에는 `scripts/_typecheck_ratchet.py` · `scripts/check-frontend-typecheck-ratchet.py` · `scripts/frontend-typecheck-baseline.json` 셋 다 없다.** 직접 확인:
    ```
    $ grep -n "pathspecs: |" -A24 .github/workflows/frontend-checks.yml | head -25
    ```
    결과에 `codebase/frontend/**` · `codebase/channel-web-chat/**` · `codebase/packages/**` · `pnpm-lock.yaml` · `pnpm-workspace.yaml` · `scripts/ci-paths-changed.sh` · `.github/workflows/_changed-paths.yml` · `.github/actions/pnpm-workspace/action.yml` · `.github/workflows/frontend-checks.yml` 만 있고 신설 스크립트/코어/baseline 은 없다.
    `backend-checks.yml` 은 기존에 `scripts/check-backend-typecheck-ratchet.py` · `scripts/backend-typecheck-baseline.json` 은 등재돼 있었지만(이번 diff 이전부터), **이번에 새로 생긴 공유 코어 `scripts/_typecheck_ratchet.py` 는 여기에도 없다.**
    결과: `frontend-typecheck-baseline.json` 만 손대는 PR(코어 로직 자신의 주석이 `"baseline 만 손대는 PR 이 훨씬 흔하다"` 라고 스스로 적어 둔 바로 그 시나리오), 혹은 `_typecheck_ratchet.py`/`check-frontend-typecheck-ratchet.py` 만 고친 PR 은 `frontend-checks.yml` 의 `changes` job 이 `relevant=false` 를 내고, 신설 `typecheck-ratchet` job 은 "무관한 변경 — 검사 생략" no-op 으로 **통과**한다. `harness-checks.yml` 의 `test_typecheck_ratchet.py` 는 여전히 돌지만, 그건 합성 `SAMPLE` 텍스트와 mock 된 `run_tsc` 로 판정 로직만 검증할 뿐, **실제 `npx tsc` 를 실제 코드에 돌려 baseline 과 대조하는 유일한 지점을 우회**시킨다 — 이 저장소가 `harness-checks.yml` pathspec 주석에서 "이 클래스가 여섯 번 샜다"고 스스로 기록해 둔 바로 그 실패 형태(가드 자신의 파일이 그 가드를 트리거하는 목록에 없음)가, 이번엔 harness 계층이 아니라 **실제 검증 계층(backend/frontend-checks.yml)에서 새로 재현**됐다.
  - 제안: `frontend-checks.yml` 의 `changes` pathspecs 에 `scripts/_typecheck_ratchet.py` · `scripts/check-frontend-typecheck-ratchet.py` · `scripts/frontend-typecheck-baseline.json` 을, `backend-checks.yml` 의 `changes` pathspecs 에 `scripts/_typecheck_ratchet.py` 를 추가할 것. 가능하면 `test_harness_checks_paths_coverage.py` 류의 "가드가 참조하는 파일이 그 가드를 트리거하는 pathspecs 안에 있는가"를 `backend-checks.yml`/`frontend-checks.yml` 에도 일반화하는 후속 가드를 고려.

- **[INFO]** `_typecheck_ratchet.py` 공유 코어가 테스트 하네스 안에서 서로 다른 두 모듈 이름으로 **이중 로드**되어, 구조적으로 동일하지만 별개인 `RatchetConfig` 클래스 두 벌이 생긴다
  - 위치: `.claude/tests/test_typecheck_ratchet.py:49-73` (`load_module()` 함수 및 `CORE`/`CONFIGS` 초기화)
  - 상세: `CORE = load_module(CORE_PATH, "typecheck_ratchet_core")` 는 `spec_from_file_location` 으로 `_typecheck_ratchet.py` 를 로드해 `sys.modules["typecheck_ratchet_core"]` 에 수동 등록한다. 반면 `CONFIGS = {label: load_module(path, f"ratchet_entry_{label}").CONFIG for ...}` 가 로드하는 `check-backend/frontend-typecheck-ratchet.py` 내부에서는 `from _typecheck_ratchet import ...` 라는 **평범한 import 문**을 쓰는데, 이 시점에 `sys.modules` 에는 `"_typecheck_ratchet"` 이라는 이름으로 등록된 모듈이 없으므로(있는 건 `"typecheck_ratchet_core"` 뿐) Python 이 같은 파일을 **다시 한 번, 별도 모듈로** 실행해 `sys.modules["_typecheck_ratchet"]` 를 새로 만든다. 그 결과 `CORE.RatchetConfig` 와 `CONFIGS["backend"].CONFIG`/`CONFIGS["frontend"].CONFIG` 가 참조하는 `RatchetConfig` 는 **서로 다른 클래스 객체**다(같은 소스지만 동일 타입 아님). 현재 테스트는 `cfg.label`/`cfg.package_dir` 등 속성 접근만 하므로 지금 당장 실패하지는 않지만, 향후 누군가 `isinstance(cfg, CORE.RatchetConfig)` 류 단언을 추가하면 조용히 깨진다 — 이 파일 docstring이 스스로 경계하는 "같은 목적의 독립 사본이 조용히 갈리는" 실패 클래스가 모듈 로딩 메커니즘 층위에서 미묘하게 재현된 형태.
  - 제안: 테스트가 두 엔트리포인트도 같은 이름(`"typecheck_ratchet_core"`)으로 미리 등록된 `CORE` 를 재사용하도록(예: entrypoint import 전에 `sys.modules["_typecheck_ratchet"] = CORE` 로 별칭 등록) 통일하거나, 최소한 주석으로 이중 로드 사실을 남길 것.

- **[INFO]** `sys.path.insert(0, ...)` 전역 상태 변경 — 저장소 기존 관례와 일치해 새 클래스의 결함은 아니지만, cleanup 없이 프로세스 수명 동안 유지되고 backend/frontend 두 엔트리포인트가 동일 디렉터리를 중복 삽입한다
  - 위치: `scripts/check-backend-typecheck-ratchet.py:48`, `scripts/check-frontend-typecheck-ratchet.py:50`
  - 상세: 두 엔트리포인트 모두 `sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))` 를 모듈 최상단에서 실행한다. `.claude/tests/_harness.py`·`scripts/check-review-gate.py` 등에 이미 같은 패턴이 있어 저장소 관례로 확인되므로 그 자체는 새 위험은 아니다. 다만 `harness-checks.yml` 의 `python3 -m unittest discover` 처럼 한 프로세스 안에서 `test_typecheck_ratchet.py` 가 두 엔트리포인트를 모두 import 하면 동일한 `scripts/` 절대경로가 `sys.path` 에 **중복** 삽입되고 복원되지 않는다. 이번 저장소의 `scripts/` 디렉터리에는 stdlib/다른 테스트 모듈과 이름이 충돌하는 파일이 없어 실질적 충돌은 관측되지 않았지만, 새 스크립트가 추가돼 이름이 겹치면 잠재적으로 예기치 않은 모듈 shadowing 을 일으킬 수 있는 표면이다.
  - 제안: 조치 불필요(기존 관례 범위 내). 장기적으로 스크립트 수가 늘면 `if path not in sys.path` 가드를 고려.

- **[INFO]** (관측 사실, 회귀 아님) `mock.patch.object(CORE.subprocess, "run", ...)` 는 실제로 프로세스 전역 `subprocess.run` 을 패치한다
  - 위치: `.claude/tests/test_typecheck_ratchet.py:192-245` (`RunTscFailClosedTest`)
  - 상세: `CORE.subprocess` 는 `_typecheck_ratchet` 모듈이 `import subprocess` 로 바인딩한 것과 같은 **stdlib `subprocess` 모듈 싱글턴**이므로, `mock.patch.object(CORE.subprocess, "run", ...)` 는 `CORE` 네임스페이스만이 아니라 그 시점 프로세스 전체의 `subprocess.run` 을 패치한다. 삭제된 구 파일(`test_backend_typecheck_ratchet.py`)에도 동일 패턴이 이미 있었으므로 이번 diff 가 새로 만든 위험은 아니고, `with` 블록으로 스코프가 제한돼 있어 현재는 문제를 일으키지 않는다. 기록 목적의 관측.

## 요약

핵심 부작용은 하나다 — 이번 PR 이 `harness-checks.yml` 의 pathspecs 는 신설 파일(`_typecheck_ratchet.py`·`check-frontend-typecheck-ratchet.py`·`frontend-typecheck-baseline.json`)까지 성실히 등재해 **단위 테스트(합성 fixture)** 트리거는 지켰지만, 정작 실제 `tsc` 를 실제 코드에 돌려 baseline 과 대조하는 `frontend-checks.yml`/`backend-checks.yml` 자신의 `changes` pathspecs 에는 그 파일들이 빠져 있다. 그 결과 baseline-only PR(코드 자체 주석이 "훨씬 흔하다"고 명시한 시나리오)이나 공유 코어만 고친 PR 은 실제 CI 검증이 no-op 으로 조용히 통과한다 — 이 저장소가 `harness-checks.yml` 주석에서 스스로 "여섯 번 샜다"고 기록한 것과 동일한 실패 형태가 실제 검증 계층에서 재발했다. 그 외에는 `write_baseline()`(`--update` 플래그로만 게이트된 파일 쓰기)·`sys.path` 조작·`subprocess.run` 전역 패치 모두 기존 저장소 관례를 그대로 계승한 것이고, `jest-axe.d.ts` 의 global-script → module 전환은 런타임 matcher 등록(`setup.ts`)에 영향을 주지 않는 순수 타입 레벨 수정으로 확인했다. 함수 시그니처 변경(`run_tsc()`→`run_tsc(cfg)` 등)은 모두 내부 전용이며 CLI 계약(`python3 scripts/check-*-typecheck-ratchet.py [--update]`)은 그대로 유지된다.

## 위험도

MEDIUM
