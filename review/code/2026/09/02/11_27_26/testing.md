# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** `test_typecheck_ratchet.py` 가 공유 코어를 두 개의 서로 다른 `sys.modules` 키로 이중 로드해, 실제 엔트리포인트가 쓰는 `RatchetConfig`/`main` 과 테스트가 검증하는 `RatchetConfig`/`main` 이 **다른 클래스·다른 함수 객체**가 된다 — 엔트리포인트의 실제 `CONFIG`↔`main` 배선은 어떤 테스트에서도 end-to-end 로 실행되지 않는다.
  - 위치: `.claude/tests/test_typecheck_ratchet.py:63` (`CORE = load_module(CORE_PATH, "typecheck_ratchet_core")`) 와 `:70-73` (`CONFIGS = {...}`); 대응 엔트리포인트 쪽 임포트는 `scripts/check-backend-typecheck-ratchet.py:50`, `scripts/check-frontend-typecheck-ratchet.py:52` (둘 다 `from _typecheck_ratchet import REPO_ROOT, RatchetConfig, main`)
  - 상세: `load_module()` 은 `importlib.util.spec_from_file_location` + 수동 `sys.modules[name] = mod` 로 `scripts/_typecheck_ratchet.py` 를 로드하는데, 테스트는 이 코어를 `"typecheck_ratchet_core"` 라는 이름으로 등록한다(`CORE`). 반면 `check-backend-typecheck-ratchet.py`/`check-frontend-typecheck-ratchet.py` 는 자기 파일 안에서 평범한 `from _typecheck_ratchet import ...` 문을 쓰므로, Python 의 표준 import 머신이 `sys.modules["_typecheck_ratchet"]` 를 찾다가 못 찾고 **같은 소스 파일을 두 번째로, 별개 모듈 객체로 재실행**한다. 실측(현재 코드로 직접 재현, 저장소 파일은 미변경):
    ```
    sys.modules 키: ['typecheck_ratchet_core', 'ratchet_entry_backend', '_typecheck_ratchet', 'ratchet_entry_frontend']
    isinstance(CONFIGS["backend"], CORE.RatchetConfig) → False
    id(CORE.RatchetConfig) != id(type(CONFIGS["backend"]))
    ```
    그 결과 `PerPackageShapeTest`/`FrontendTypecheckConfigTest` 가 검사하는 `CONFIGS[label]` 은 엔트리포인트가 실제로 `sys.exit(main(CONFIG))` 에 넘기는 그 객체의 **속성값은 같지만 클래스가 다른 복제본**이고, `VerdictTest`/`FailClosedTest`/`RunTscFailClosedTest` 가 실행하는 `CORE.main(...)` 은 `CONFIGS[label]` 을 받아 실행하는 경우가 한 번도 없다(전부 `fake_config()` 로 새로 만든 `CORE.RatchetConfig` 인스턴스만 넘긴다). 즉 "실제 엔트리포인트가 임포트한 `main` 이 실제 엔트리포인트의 `CONFIG` 로 정말 정상 동작하는지"는 이 스위트에서 한 번도 검증되지 않는다 — 삭제된 구버전(`test_backend_typecheck_ratchet.py`, backend 단일 스크립트를 직접 로드해 `MOD.main()` 을 그대로 호출)에는 없던 회귀다. 코드 자체는 단순해 프로덕션에서 문제를 일으킬 가능성은 낮지만("판단 재료" 자체가 프록시로 바뀐 사례), 향후 누군가 `isinstance(cfg, CORE.RatchetConfig)` 류의 자연스러운 단언을 추가하면 이 중복 로드 때문에 뜬금없이 실패한다.
  - 제안: `load_module(CORE_PATH, "typecheck_ratchet_core")` 대신 실제 엔트리포인트가 임포트하는 이름 그대로 `load_module(CORE_PATH, "_typecheck_ratchet")` 로 등록할 것. 재현 확인: 이렇게만 바꾸면 엔트리포인트 로드 시 `from _typecheck_ratchet import ...` 가 이미 등록된 같은 모듈을 재사용해 `isinstance(CONFIGS["backend"], CORE.RatchetConfig)` 가 `True` 가 되고, `CORE.main(CONFIGS["backend"], ...)` 을 mock 과 함께 직접 돌려 실제 엔트리포인트 배선을 end-to-end 로 검증할 수 있다.

- **[INFO]** ambient 타입 선언이 "모듈 파일이어야 augmentation 이 된다"는 이번 사고의 핵심 불변식을 고정하는 빠른(비-tsc) 회귀 테스트가 없다.
  - 위치: `codebase/frontend/src/test/vitest-matchers.d.ts` (파일 전체 — 특히 `import "vitest";` 줄)
  - 상세: 이 파일 자신의 주석이 "지우면 조용히 shadowing 으로 되돌아간다" 고 명시할 만큼 위험한 지점인데, 이를 지키는 유일한 장치는 ~40초짜리 전체 `tsc --noEmit` ratchet 뿐이다(baseline 51건이 수천 건으로 튀는 것으로 간접 검출). 이 저장소는 `test_workflow_yaml_structure.py::DetectorTest`(`BROKEN_SAMPLE` 로 2026-08-01 사고 텍스트를 직접 재생)처럼, 과거 사고를 **빠른 fixture 기반 유닛 테스트**로 고정하는 관례를 갖고 있다. 이 사고(1,256건 phantom TS2305)에는 그런 빠른 pin 이 없다.
  - 제안: 필수는 아니지만, `.d.ts` 파일이 top-level `import`/`export` 를 가져야 module context 가 된다는 사실을 문자열 파싱 수준에서 고정하는 가벼운 유닛 테스트(예: `vitest-matchers.d.ts` 소스에 `^import ` 또는 `^export ` 로 시작하는 줄이 있는지 assert)를 추가하면, tsc 를 돌리지 않고도 이 회귀를 즉시 잡을 수 있다.

- **[INFO]** `tempfile.mkdtemp()` 로 만든 임시 baseline 파일들이 `tearDown`/`addCleanup` 없이 그대로 남는다.
  - 위치: `.claude/tests/test_typecheck_ratchet.py:123` (`VerdictTest.run_main`) 을 비롯해 `FailClosedTest.call_load`, `RunTscFailClosedTest.expect_exit_2`/`test_clean_run_returns_empty_output`/`test_tsc_is_invoked_with_the_configured_tsconfig`, `UpdateBaselineTest` 의 각 테스트 전반
  - 상세: 삭제된 `test_backend_typecheck_ratchet.py` 에도 있던 기존 스타일이라 이번 diff 가 새로 만든 결함은 아니지만, backend 전용이던 스위트가 backend+frontend 겸용으로 통합되면서 같은 패턴의 호출 지점 수가 늘었다. 기능적으로는 무해하다(OS temp 디렉터리는 재부팅/CI 러너 재활용 시 정리됨).
  - 제안: 우선순위 낮음. 정리하려면 `addCleanup(shutil.rmtree, tmp.parent, ignore_errors=True)` 를 헬퍼에 한 번 추가하면 전체에 적용된다.

## 요약

신규/이관된 테스트(`test_typecheck_ratchet.py`, 27개, 로컬 실행 전부 GREEN·0.006s)는 이전 코드 리뷰가 지적했던 두 WARNING(“`run_tsc()` fail-closed 3분기 무증거”, “`--update` 정상 경로 미검증”)을 각각 `RunTscFailClosedTest`·`UpdateBaselineTest` 로 정확히 메웠고, baseline 형태·증가/감소/신규파일/파일소거 판정을 `main()` 을 실제로 구동해 검증하는 기존의 좋은 테스트 경계를 그대로 유지한다. backend/frontend 겸용 승격도 `PerPackageShapeTest`/`FrontendTypecheckConfigTest` 를 `subTest` 로 두 패키지 모두 도는 형태로 잘 확장했고, `test_workflow_yaml_structure.py`/`test_harness_checks_paths_coverage.py`/`test_required_check_skip_jobs.py` 관련 레지스트리 갱신도 실행 확인 결과 전부 GREEN 이며 신규 job 을 빠짐없이 강제한다(양방향 등재 확인 완료). 다만 공유 코어를 리팩터링하며 테스트가 코어를 엔트리포인트와 다른 `sys.modules` 이름으로 이중 로드하게 됐고, 이 때문에 "실제 엔트리포인트의 `CONFIG`+`main` 조합이 정말 동작하는가"라는, 구버전 스위트는 갖고 있던 end-to-end 신뢰가 조용히 프록시(합성 `fake_config`)로 대체됐다 — 실행으로 재현 확인했고 고치기 쉬운 한 줄짜리 결함이라 WARNING 으로 남긴다. 그 외에는 CRITICAL 급 결함 없음.

## 위험도

LOW
