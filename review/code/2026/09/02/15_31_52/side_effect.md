# 부작용(Side Effect) 리뷰

## 개요

이 diff 는 backend 전용이던 타입체크 ratchet 판정 로직을 `scripts/_typecheck_ratchet.py` 공유
코어로 추출하고, frontend 엔트리포인트(`check-frontend-typecheck-ratchet.py`)·전용
`tsconfig.typecheck.json`·CI job(`frontend-checks.yml::typecheck-ratchet`)을 신설한다. 이전 두
리뷰 라운드(`review/code/2026/09/02/11_27_26/`, `15_04_04/`)에서 지적된 Critical(게이트
자기-미등재)·Warning(모듈 이중 로드 등)은 이미 수정되어 이 diff 에 반영돼 있고, 이번 라운드에서
새로 추가된 것은 (a) `.claude/tests/test_workflow_run_inputs_covered.py` 신규 가드,
(b) `harness-checks.yml` pathspecs 확장(`scripts/check-frontend-typecheck-ratchet.py` ·
`scripts/frontend-typecheck-baseline.json` · `codebase/frontend/tsconfig.typecheck.json`),
(c) plan 문서 갱신이다. 아래는 부작용 관점에서 재확인·신규 관측한 항목이다.

## 발견사항

- **[INFO]** (재확인, 신규 아님) `sys.path` 전역 변경이 backend/frontend 두 엔트리포인트에서
  같은 디렉터리를 중복 삽입하는 형태로 남아 있다
  - 위치: `scripts/check-backend-typecheck-ratchet.py` (`sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))`), `scripts/check-frontend-typecheck-ratchet.py` 동일 패턴
  - 상세: `.claude/tests/test_typecheck_ratchet.py` 가 `ENTRYPOINTS.items()` 를 순회하며 두
    모듈을 한 프로세스에 모두 적재하므로, 같은 절대경로가 `sys.path` 에 두 번 들어가고 프로세스
    수명 동안 복원되지 않는다. `scripts/*.py` 에 stdlib/다른 테스트 모듈과 이름이 충돌하는
    파일이 없어(직접 확인) 현재 실질 충돌은 없다. 이전 두 라운드에서 이미 INFO 로 기록됐고
    이번 diff 로 새로 생긴 위험은 아니다.
  - 제안: 조치 불요. 스크립트가 더 늘면 `if path not in sys.path` 가드 고려.

- **[INFO]** (재확인, 신규 아님) `mock.patch.object(CORE.subprocess, "run", ...)` 가 시점상
  프로세스 전역 `subprocess.run` 을 패치한다
  - 위치: `.claude/tests/test_typecheck_ratchet.py` 의 `RunTscFailClosedTest`(`expect_exit_2` ·
    `test_clean_run_returns_empty_output` · `test_tsc_is_invoked_with_the_configured_tsconfig`)
  - 상세: `CORE.subprocess` 는 `_typecheck_ratchet.py` 가 `import subprocess` 로 바인딩한
    stdlib 싱글턴이므로 이 패치는 `CORE` 네임스페이스만이 아니라 그 시점 프로세스 전체의
    `subprocess.run` 을 가로챈다. `with` 블록으로 스코프가 제한돼 있고 삭제된 구 파일에도
    동일 패턴이 있었다.
  - 제안: 조치 불요.

- **[INFO]** (재확인, 신규 아님) `main()` 시그니처가 무인자 → `main(cfg: RatchetConfig,
  argv: Sequence[str] | None = None)` 로 바뀌었으나 CLI 계약은 보존된다
  - 위치: `scripts/_typecheck_ratchet.py` `def main(...)`, 호출부
    `scripts/check-backend-typecheck-ratchet.py`/`scripts/check-frontend-typecheck-ratchet.py`
    의 `sys.exit(main(CONFIG))`
  - 상세: `argv=None` 기본값에서 `parser.parse_args(None)` 이 `sys.argv[1:]` 로 폴백하므로
    `python3 scripts/check-*-typecheck-ratchet.py [--update]` 호출 계약은 그대로다. 저장소
    전체에서 구 `check-backend-typecheck-ratchet.py` 의 옛 함수들(`run_tsc`/`count_by_file`/
    `load_baseline`/`write_baseline`/`BASELINE`/`DIAGNOSTIC`)을 이 스크립트 가족과
    `test_typecheck_ratchet.py` 밖에서 import 하는 곳이 없음을 grep 으로 확인 — 외부 호출자
    영향 없음.
  - 제안: 조치 불요.

- **[INFO]** (신규) `test_workflow_run_inputs_covered.py` 가 이 테스트 스위트에서 **처음으로**
  다른 `test_*.py` 파일을 모듈째로 import 하는 패턴을 도입한다
  - 위치: `.claude/tests/test_workflow_run_inputs_covered.py:38`
    (`from test_harness_checks_paths_coverage import filter_covers_file`)
  - 상세: `.claude/tests/*.py` 전수를 grep 한 결과 `^from test_` 로 시작하는 import 는 이
    파일이 유일하다(다른 파일은 `_harness` 경유로만 서로 결합). `python3 -m unittest discover
    -s .claude/tests -p 'test_*.py'` 는 파일명 알파벳 순으로 각 모듈을 독립 로드해
    `loadTestsFromModule` 하므로, 이 import 가 `test_harness_checks_paths_coverage` 의
    TestCase 를 중복 등록하거나 순서에 따라 다른 결과를 내지는 않는다(직접 코드 확인 —
    `test_harness_checks_paths_coverage.py` 모듈 최상단에 import-time 부작용이 없고,
    `unittest discover` 는 이미 `sys.modules` 에 있는 모듈이라도 자신이 발견한 파일마다
    `loadTestsFromModule` 을 별도 호출한다). 다만 두 파일이 파일명 결합으로 묶이는 이
    구조는 이후 누군가 `test_harness_checks_paths_coverage.py` 의 `filter_covers_file` 시그니처를
    바꾸면 이 파일에서도 즉시 깨지는 새로운 결합점이다 — 기능 버그는 아니고 관측 기록.
  - 제안: 조치 불요. 참고로만 기록.

- **[INFO]** (신규) `harness-checks.yml` 의 `changes.pathspecs` 확장이 `frontend-checks.yml`
  이 이미 덮는 경로를 재등재해 harness 스위트를 불필요하게 더 자주 트리거한다
  - 위치: `.github/workflows/harness-checks.yml` (신규 3줄:
    `scripts/check-frontend-typecheck-ratchet.py` · `scripts/frontend-typecheck-baseline.json` ·
    `codebase/frontend/tsconfig.typecheck.json`)
  - 상세: `codebase/frontend/tsconfig.typecheck.json` 은 이미 `frontend-checks.yml` 자신의
    `changes.pathspecs`(`codebase/frontend/**`)에 포함된다. `harness-checks.yml` 에 추가로
    등재한 근거 주석("frontend 는 전용 tsconfig 가 스캔 대상을 정한다 — 이 파일이 좁아지면
    진단이 0 으로 수렴하는데 그건 성공처럼 보인다")은 사실이지만, `.claude/tests/
    test_typecheck_ratchet.py` 의 어떤 테스트도 `tsconfig.typecheck.json` 파일의 실제 내용을
    읽지 않는다(grep 확인 — `run_tsc` 는 전부 mock 으로 대체됨). 즉 이 pathspec 등재가
    harness 잡을 더 자주 돌게 만들지만, 그렇게 도는 harness 잡 자체는 그 파일이 좁아지는
    회귀를 실제로 잡지 못한다(그 회귀를 잡는 것은 실 `tsc` 를 돌리는 `frontend-checks.yml::
    typecheck-ratchet` 뿐이다). 과소 등재(silent skip)가 아니라 **과다 트리거**라 fail-safe
    방향이며 harness 스위트 자체를 깨뜨리지 않으므로 기능 결함은 아니다.
  - 제안: 조치 불요(안전한 과다포함). 근거 주석을 "harness 가 잡는다" 대신 "frontend-checks
    가 잡는다" 로 조정하면 다음 사람의 오독을 줄일 수 있다.

- **[확인]** `write_baseline()` 은 여전히 `main()` 의 `args.update` 분기에서만 호출되고,
  `frontend-checks.yml`/`backend-checks.yml` 의 CI 스텝은 `--update` 없이 스크립트를
  호출한다 — CI 자동 실행 경로에서 baseline 파일이 조용히 갱신되는 파일시스템 부작용은
  없다. `EntrypointWiringTest.test_committed_baseline_round_trips_through_real_main` 이 실제
  `CONFIGS[label]`(커밋된 baseline 실경로)로 `CORE.main(cfg, [])` 를 태우지만 `args.update`
  는 전달되지 않으므로 실제 baseline 파일에는 읽기만 발생한다(코드 직접 확인).
- **[확인]** `codebase/frontend/src/test/jest-axe.d.ts` 에서 제거된 `declare namespace Vi`
  블록을 참조하는 다른 소스가 없음을 grep 으로 확인(`Vi.Assertion`/`Vi.AsymmetricMatchersContaining`
  0건) — 제거로 인한 타입 파괴 없음. 신규 `vitest-matchers.d.ts` 의 `declare module "vitest"`
  도 저장소 전체에서 유일한 선언(중복 augmentation 없음).
- **[확인]** `codebase/frontend/tsconfig.typecheck.json` 이 `incremental: false` 를 명시
  재선언 — base `tsconfig.json` 은 `incremental: true` 라 상속됐다면 `.tsbuildinfo` 캐시가
  저장소 트리에 쓰일 수 있었던 자리인데, 명시적 비활성화로 그 파일시스템 부작용 표면을
  사전 차단했다(설계 의도와 일치, 이전 라운드 관측 재확인).

## 요약

핵심 부작용 표면(신규 CI job 이 실제 `tsc` 를 실행하는 조건, `--update` 에 게이트된
baseline 파일 쓰기, `main()` 시그니처 변경의 호출자 영향, 공유 코어 모듈의 `sys.path`/
`sys.modules` 전역 상태)은 이전 두 라운드에서 이미 식별·검증됐고 이번 diff 에서도 변함없이
안전한 상태로 확인된다. 이번 라운드에서 새로 추가된 `test_workflow_run_inputs_covered.py`
(git ls-files 읽기 전용 subprocess + YAML 파싱, 파일시스템 쓰기 없음)와 `harness-checks.yml`
pathspec 확장은 기존 관례를 따르며 새로운 부작용을 만들지 않는다 — 유일하게 눈에 띄는 점은
`harness-checks.yml` 에 추가된 `tsconfig.typecheck.json` 등재가 그 파일 내용을 실제로 검증하지
않는 harness 스위트를 불필요하게 더 자주 트리거하는 것인데, 이는 과다포함(fail-safe 방향)이라
차단 사유가 아니다. Critical/Warning 급 신규 발견 없음.

## 위험도

LOW
