# 부작용(Side Effect) 리뷰

이번 diff 는 backend 전용이던 typecheck ratchet 판정 로직을 `scripts/_typecheck_ratchet.py` 공유
코어로 추출하고, frontend 용 엔트리포인트(`check-frontend-typecheck-ratchet.py`)·CI job(`frontend-checks.yml::typecheck-ratchet`)·전용 tsconfig(`tsconfig.typecheck.json`)를 신설한다. 동시에 이전 리뷰 라운드(`review/code/2026/09/02/11_27_26/`)의 Critical 2건·Warning 2건에 대한 수정분(진단 정규식 non-greedy 화, CI pathspecs 등재, 모듈 이중 로드 해소, TEST_FILE_RULES 대칭화)도 포함돼 있다. 아래는 이번 라운드에 남아 있거나 새로 관측된 부작용 관점 항목이다.

## 발견사항

- **[INFO]** `sys.path` 전역 변경이 backend/frontend 두 엔트리포인트가 같은 디렉터리를 중복 삽입하는 형태로 유지된다
  - 위치: `scripts/check-backend-typecheck-ratchet.py` (`sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))`), `scripts/check-frontend-typecheck-ratchet.py` (동일 패턴)
  - 상세: 두 엔트리포인트 모두 모듈 최상단에서 `scripts/` 절대경로를 `sys.path[0]` 에 삽입한다. 프로덕션 단독 실행(`python3 scripts/check-*-typecheck-ratchet.py`)에서는 문제 없지만, `harness-checks.yml` 의 `python3 -m unittest discover` 처럼 한 프로세스 안에서 `.claude/tests/test_typecheck_ratchet.py` 가 두 엔트리포인트를 모두 `load_module()` 로 import 하면 같은 절대경로가 `sys.path` 에 **두 번** 삽입되고 프로세스 수명 동안 복원되지 않는다. `scripts/` 디렉터리에 현재 stdlib/다른 테스트 모듈과 이름이 충돌하는 파일은 없어 실질 충돌은 없다(직접 확인: `ls scripts/*.py` — `json`/`re` 등 stdlib 이름과 충돌 없음). 이전 라운드(11_27_26)에서 이미 INFO 로 관측된 것과 동일한 성격이며 이번 diff 로 새로 생긴 위험은 아니다.
  - 제안: 조치 불필요(기존 관례 범위 내). 스크립트 수가 늘면 `if path not in sys.path` 가드 고려.

- **[INFO]** `mock.patch.object(CORE.subprocess, "run", ...)` 가 시점상 프로세스 전역 `subprocess.run` 을 패치한다
  - 위치: `.claude/tests/test_typecheck_ratchet.py` (`RunTscFailClosedTest.expect_exit_2`, `test_clean_run_returns_empty_output`, `test_tsc_is_invoked_with_the_configured_tsconfig`)
  - 상세: `CORE.subprocess` 는 `_typecheck_ratchet.py` 가 `import subprocess` 로 바인딩한 것과 같은 stdlib `subprocess` 모듈 싱글턴이므로, 이 패치는 `CORE` 네임스페이스만이 아니라 그 시점 프로세스 전체의 `subprocess.run` 을 가로챈다. `with` 블록으로 스코프가 제한돼 있고, 삭제된 구 파일(`test_backend_typecheck_ratchet.py`)에도 동일 패턴이 있었으므로 이번 diff 가 새로 만든 위험은 아니다.
  - 제안: 조치 불필요. 기록 목적의 관측.

- **[INFO]** `_typecheck_ratchet.py` 의 이중 로드 방지가 `sys.modules` 등록 순서에 의존한다
  - 위치: `.claude/tests/test_typecheck_ratchet.py` (`load_module()` 함수, `CORE = load_module(CORE_PATH, "_typecheck_ratchet")` → 이어서 `CONFIGS = {...}` 초기화)
  - 상세: 이전 라운드 INFO(공유 코어 이중 로드, `CORE.RatchetConfig is not real.RatchetConfig`)는 CORE 를 엔트리포인트가 실제로 쓰는 이름(`"_typecheck_ratchet"`)으로 `sys.modules` 에 먼저 등록하는 방식으로 해소됐다 — `EntrypointWiringTest.test_configs_are_instances_of_the_core_dataclass` 로 회귀 확인됨. 다만 이 해소는 **모듈 최상단 문장의 실행 순서**(`CORE` 로드가 `CONFIGS` 초기화보다 먼저 와야 함)에 암묵적으로 의존하는 전역 레지스트리(`sys.modules`) 상태다. 순서가 바뀌면 엔트리포인트의 `from _typecheck_ratchet import ...` 가 다시 디스크에서 별도 모듈을 만들어 이전 라운드의 이중 로드 결함이 조용히 재발한다. 다행히 `PerPackageShapeTest`/`EntrypointWiringTest` 가 그 재발을 즉시 잡는 회귀 가드로 이미 존재한다.
  - 제안: 조치 불필요(가드가 이미 존재). 참고로만 기록.

- **[INFO]** `main()` 시그니처가 무인자 → `main(cfg: RatchetConfig, argv=None)` 로 바뀌었으나 영향은 내부에 국한된다
  - 위치: `scripts/_typecheck_ratchet.py` (`def main(cfg: RatchetConfig, argv: Sequence[str] | None = None) -> int`), 호출부 `scripts/check-backend-typecheck-ratchet.py`/`scripts/check-frontend-typecheck-ratchet.py` 의 `sys.exit(main(CONFIG))`
  - 상세: 구 `check-backend-typecheck-ratchet.py::main()` 은 무인자였고 `argparse.parse_args()`(암묵적으로 `sys.argv[1:]`)를 썼다. 신규 공유 `main` 은 `argv=None` 기본값에서 `parser.parse_args(None)` 을 호출해 동일하게 `sys.argv[1:]` 로 폴백하므로 CLI 계약(`python3 scripts/check-*-typecheck-ratchet.py [--update]`)은 그대로 유지된다. 저장소 전체에서 `check-backend-typecheck-ratchet.py`/`check-frontend-typecheck-ratchet.py` 의 구 함수들(`run_tsc`/`count_by_file`/`load_baseline`/`write_baseline`/`BASELINE`/`DIAGNOSTIC` 등)을 이 두 스크립트 자신과 `.claude/tests/test_typecheck_ratchet.py` 이외에서 import 하는 곳이 없음을 grep 으로 확인 — 외부 호출자에 미치는 영향 없음.
  - 제안: 조치 불필요.

## 이전 라운드 대비 확인된 해소 사항 (참고)

- **[해소 확인]** 이전 라운드 WARNING("신규 스크립트/공유 코어/baseline 이 `frontend-checks.yml`/`backend-checks.yml` 자신의 `changes.pathspecs` 에 미등재돼 baseline-only/코어 전용 PR 이 실제 tsc 없이 통과") — `frontend-checks.yml` 에 `scripts/_typecheck_ratchet.py`·`scripts/check-frontend-typecheck-ratchet.py`·`scripts/frontend-typecheck-baseline.json` 3건, `backend-checks.yml` 에 `scripts/_typecheck_ratchet.py` 1건이 각각 `changes` job pathspecs 에 추가된 것을 diff 로 직접 확인함.
- **[해소 확인]** 신규 `typecheck-ratchet` job(`frontend-checks.yml`) 의 job-level `if: ${{ !cancelled() }}` 은 `.claude/tests/test_workflow_yaml_structure.py::_JOB_CONDITIONS` 에 `("frontend-checks.yml", "typecheck-ratchet")` 로 등재됐고, step-level `if:` 두 문자열(`needs.changes.outputs.relevant == 'false'` / `!= 'false'`) 은 `frontend-checks.yml` 이 이미 `_SKIP_JOB_WORKFLOWS` 집합에 속해 있어 개별 등재 없이 일반 규칙으로 커버됨 — 등록 갭 없음.
- **[해소 확인]** `write_baseline()` 은 여전히 `main()` 의 `args.update` 분기에서만 호출되고, `frontend-checks.yml`/`backend-checks.yml` 의 CI 스텝은 `--update` 없이 스크립트를 호출한다 — CI 실행 중 baseline 파일이 조용히 갱신되는 경로 없음. `EntrypointWiringTest` 가 실제 커밋된 `CONFIGS[label]`(실경로)로 `CORE.main(cfg, [])` 을 태우지만 `run_tsc` 만 주입 대체되고 `args.update` 는 전달되지 않으므로 실제 baseline 파일에는 읽기만 발생, 쓰기 없음(직접 코드 확인).
- **[참고]** `codebase/frontend/tsconfig.typecheck.json` 이 `incremental: false` 를 명시적으로 재선언 — base `tsconfig.json` 은 `incremental: true` 인데, `--noEmit` 조합에서 그대로 상속됐다면 `.tsbuildinfo` 캐시 파일이 저장소 트리에 쓰일 수 있었던 자리다. 명시적 비활성화로 그 파일시스템 부작용 표면을 사전에 차단한 것으로 확인됨(설계 의도와 일치).

## 요약

이전 라운드에서 지적된 유일한 Critical/Warning 급 부작용(신설 파일들이 그 파일들을 실제로 실행하는 `frontend-checks.yml`/`backend-checks.yml` 자신의 `changes.pathspecs` 에 없어 baseline-only/코어 전용 PR 이 tsc 없이 조용히 통과하는 문제)은 두 워크플로 모두에 등재가 추가되어 해소됐고, CI 잡·스텝 조건 레지스트리(`test_workflow_yaml_structure.py`)에도 신규 job 이 정확히 반영됐다. 이전 라운드 INFO 였던 공유 코어 모듈 이중 로드(`sys.modules` 두 벌 → `RatchetConfig` 클래스 불일치)도 `_typecheck_ratchet` 이름으로 선등록하는 방식으로 해소되고 회귀 가드까지 추가됐다. 남은 항목은 전부 기존 저장소 관례를 그대로 계승한 저위험 INFO(`sys.path` 중복 삽입, 테스트 스코프의 전역 `subprocess.run` 패치, `sys.modules` 등록 순서 의존)이며, 프로덕션 파일시스템 쓰기는 `--update` 플래그로만 게이트돼 CI 자동 실행 경로에서는 발생하지 않는다. 함수 시그니처 변경(`main()` 무인자 → `main(cfg, argv=None)`)은 CLI 계약을 보존하며 영향 범위가 이 스크립트 가족 내부로 완전히 국한됨을 grep 으로 확인했다. 신규 공개 인터페이스(CI 필수 체크 `frontend-checks.yml::typecheck-ratchet`)는 기존 backend 잡과 동일한 skip-job 패턴을 따르며 등록 갭이 없다.

## 위험도

LOW
