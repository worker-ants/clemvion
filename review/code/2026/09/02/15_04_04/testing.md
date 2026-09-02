# 테스트(Testing) 리뷰

## 개요

이 변경은 backend 타입체크 ratchet(`check-backend-typecheck-ratchet.py`)의 판정 규칙을
공유 코어(`scripts/_typecheck_ratchet.py`)로 추출하고, frontend 용 대응 게이트
(`check-frontend-typecheck-ratchet.py` + `tsconfig.typecheck.json`)를 신설한 리팩터다.
`.claude/tests/test_backend_typecheck_ratchet.py` 를 삭제하고 두 패키지를 함께 덮는
`.claude/tests/test_typecheck_ratchet.py`(540줄, 35 subTest 포함)로 병합했다. 직전 라운드
(`review/code/2026/09/02/11_27_26/`)의 Critical 2건(괄호 경로 파싱 누락, harness pathspec
미등재)·Warning 2건(TEST_FILE_RULES 비대칭, 모듈 이중 로드)이 실제로 코드에 반영돼 있는지
직접 `Read`로 확인했고, 35개 테스트를 직접 실행해 통과를 확인했다(`unittest discover -s
.claude/tests -p 'test_typecheck_ratchet.py'` → `Ran 35 tests ... OK`).

## 발견사항

- **[WARNING]** `run_tsc()`의 "tsc가 비-0으로 끝났지만 stdout에 실제 진단이 있다" 분기 —
  즉 이 게이트가 실전에서 가장 흔히 타는 경로(타입 오류가 있어 `tsc`가 exit 2로 끝나고
  진단을 stdout에 싣는 경우) — 가 `run_tsc()` 단위 테스트에서 한 번도 실행되지 않는다.
  - 위치: `scripts/_typecheck_ratchet.py:112`(`if proc.returncode != 0 and not out.strip():`),
    검증 대상 함수는 `scripts/_typecheck_ratchet.py:88`(`def run_tsc`). 테스트는
    `.claude/tests/test_typecheck_ratchet.py:228`(`class RunTscFailClosedTest`) 내
    `:243`(`test_timeout_is_undecidable`) · `:251`(`test_missing_executable_is_undecidable`) ·
    `:256`(`test_nonzero_exit_with_empty_stdout_is_undecidable`, returncode=2 stdout="") ·
    `:262`(`test_clean_run_returns_empty_output`, returncode=0 stdout="") ·
    `:270`(`test_tsc_is_invoked_with_the_configured_tsconfig`, returncode=0).
  - 상세: `subprocess.run` 을 직접 목으로 갈아 끼우는 `RunTscFailClosedTest` 의 다섯 테스트는
    전부 `returncode==0` 이거나 `stdout==""` 인 조합만 다룬다. "`returncode != 0` 이면서
    `stdout` 에 실제 진단 텍스트가 있는" 조합 — tsc 가 타입 오류를 찾았을 때의 정상 동작 —
    은 `run_tsc()` 수준에서 어떤 테스트도 만들지 않는다. `VerdictTest`/`UpdateBaselineTest`
    가 이 시나리오를 검증하는 것처럼 보이지만 그 클래스들은 `mock.patch.object(CORE,
    "run_tsc", lambda cfg: fake_output)` 로 `run_tsc` 자체를 **통째로 대체**하므로
    `:112` 의 조건문은 아예 실행되지 않는다(`.claude/tests/test_typecheck_ratchet.py:172`,
    `:306`, `:324` 참조).
    직접 뮤테이션으로 확인했다(저장소 트리에 `cp` 로 백업 후 편집, 검증 뒤 `cp` 로 즉시
    원복 — `git status --short` 로 클린 확인 완료): `:112` 를
    `if proc.returncode != 0 and not out.strip():` → `if proc.returncode != 0:` 로
    바꿔 "진단이 있어도 무조건 판단 불가로 처리" 하도록 약화시켰더니 **35개 테스트
    전부 그대로 통과했다**(`Ran 35 tests ... OK`). 이 뮤턴트가 실제로 커밋되면, baseline
    이 비어 있지 않은 한(현재 backend 199건/38파일, frontend 52건/15파일 — 항상 비어 있지
    않음) 실제 CI 실행에서 게이트가 **매번** `undecidable()`(exit 2, "설정/실행 오류로
    보인다")로 잘못 종료해 타입 오류 유무와 무관하게 영구 실패한다 — 이 파일의 모듈
    docstring(`scripts/_typecheck_ratchet.py:1-24`)이 지키려는 정확한 불변식("판단 불가가
    성공으로 흐르지 않는다")의 **반대편**(정상 판정이 판단 불가로 잘못 흐르는 것)이 뚫린
    채로 fast 테스트 스위트를 통과한다. 이 회귀는 `.claude/tools/run-test.sh` 4단계 wrapper
    에도 없는(스크립트 docstring 자체가 명시) 별도 게이트라 실제 tsc 실행(로컬 ~40-60초)
    전까지는 아무도 못 본다.
  - 제안: `RunTscFailClosedTest` 에 `returncode=2, stdout="a.ts(1,1): error TS1: x\n"` 같은
    Mock 을 주입해 `CORE.run_tsc(cfg)` 가 그 stdout 을 **그대로 반환**(예외 없이)하는지
    확인하는 테스트를 추가할 것 — "진단이 있어도 정상 반환된다"는 `:112` 조건의 반대
    방향을 직접 관측하는 대조군.

- **[WARNING]** 직전 라운드의 Critical #2("게이트가 자기 자신을 트리거하지 못한다" — 신규
  게이트가 실행하는 파일이 `frontend-checks.yml`/`backend-checks.yml` 자신의
  `changes.pathspecs` 에 없었던 문제)는 손으로 등재해 고쳤지만(diff 파일 5 게이트 65-68,
  파일 6 게이트 65-72), **같은 클래스의 재발을 막는 자동 회귀 테스트가 없다.**
  `harness-checks.yml` 은 `test_harness_checks_paths_coverage.py` 가 지키지만, 실제 검증을
  수행하는 `frontend-checks.yml`/`backend-checks.yml` 자신에는 대응 가드가 없다 — 직전
  라운드 documentation 리뷰어의 제안(`review/code/2026/09/02/11_27_26/documentation.md`
  "가능하면 `test_harness_checks_paths_coverage.py` 류의 커버리지 가드를 이 두 워크플로
  자신에도 일반화")이 이번 라운드에도 구현되지 않았다.
  - 위치: `.claude/tests/test_required_check_skip_jobs.py` — `DeadFilterTest`
    (`test_repo_guards_pathspec_covers_every_stack`, `test_no_pathspec_is_a_dead_filter`)가
    가장 가까운 커버리지 가드이지만, 이 클래스는 "등록된 pathspec 이 하나라도 tracked
    파일과 매치하는가(죽은 필터 방지)"만 검증한다 — "그 잡이 **실제로 실행하는** 파일이
    pathspec 에 **빠짐없이 등록됐는가**"는 검사 범위 밖이다. `.claude/tests/*.py` 전체를
    `grep -rn "typecheck-ratchet\|_typecheck_ratchet"` 로 확인해도 `frontend-checks.yml`/
    `backend-checks.yml` 의 `changes.pathspecs` 와 `scripts/_typecheck_ratchet.py` /
    `scripts/check-frontend-typecheck-ratchet.py` / `scripts/frontend-typecheck-baseline.json`
    을 대조하는 테스트는 없다.
  - 상세: 이번 PR 이 반복해서 서술하는 실패 클래스("게이트가 조용히 헐거워진다")가 그대로
    남아 있다 — 향후 누군가 `_typecheck_ratchet.py` 판정 규칙을 고치거나 `--update` 로
    baseline 만 갱신하는 커밋을 올릴 때, `frontend-checks.yml`/`backend-checks.yml` 의
    pathspec 등재를 빠뜨려도 어떤 테스트도 실패하지 않는다 — 오직 사람의 리뷰에만
    의존한다(정확히 이번 PR 이 직전 라운드에서 스스로 그 실수를 낸 자리다).
  - 제안: `test_harness_checks_paths_coverage.py` 의 `KNOWN_COVERAGE_DEPENDENCIES` 패턴을
    본떠, "`typecheck-ratchet` 잡의 `run:` 스텝이 참조하는 스크립트/baseline 파일 집합"과
    "그 워크플로 자신의 `changes.pathspecs`" 를 대조하는 테스트를 `test_required_check_skip_jobs.py`
    또는 별도 파일에 추가할 것.

- **[INFO]** `load_baseline()` 의 `data.get("files") if isinstance(data, dict) else None`
  삼항식에서 `else None` 분기(baseline JSON 최상위가 dict 가 아닌 경우, 예: `[]`·`"str"`·
  `42`)가 어떤 테스트에서도 실행되지 않는다.
  - 위치: `scripts/_typecheck_ratchet.py:141`. 대응 테스트
    `.claude/tests/test_typecheck_ratchet.py:198`(`class FailClosedTest`)의
    `:214`(`test_files_not_a_mapping_is_undecidable`)는 `{"files": []}` — 즉 최상위는
    이미 dict — 만 검사해 삼항식의 `isinstance(data, dict)` 참 분기만 지난다.
  - 상세: 코드 경로 자체는 두 분기 모두 결국 같은 `if not isinstance(files, dict):
    undecidable(...)` 로 수렴해 실제로는 안전하지만(대조: 만약 `files = data.get("files")`
    처럼 조건 없이 호출했다면 최상위가 리스트일 때 `AttributeError` 로 처리되지 않은
    예외가 새고, 이는 exit 1(traceback)이 되어 어휘상 "baseline 위반"과 구별되지 않는다 —
    바로 이런 회귀를 막기 위한 방어 코드로 보인다), 그 방어를 직접 겨냥한 테스트가 없어
    향후 리팩터가 이 분기를 실수로 제거해도 fast 스위트가 못 잡는다.
  - 제안: `self.call_load(lambda p: p.write_text(json.dumps([1, 2, 3]), "utf-8"))` 같은
    케이스를 `FailClosedTest` 에 추가.

## 긍정적으로 평가한 부분 (조치 불요)

- **직전 라운드 Critical/Warning 4건이 실제로 코드에 반영됨을 직접 확인**: 괄호 경로
  회귀 픽스처(`test_paths_containing_parentheses_are_counted`,
  `.claude/tests/test_typecheck_ratchet.py:136`)와 **반대 방향 대조군**
  (`test_indented_continuation_with_a_position_is_still_ignored`, `:154`) 둘 다 존재 —
  탐욕도 완화가 "너무 멀리" 가서 들여쓴 상세 줄까지 잡는 회귀를 막는다. 모듈 이중 로드
  문제는 `EntrypointWiringTest`(`:386`)가 `isinstance(cfg, CORE.RatchetConfig)` 로 직접
  잡고, `test_committed_baseline_round_trips_through_real_main`(`:402`)이 합성
  `fake_config` 가 아니라 **실제 엔트리포인트의 `CONFIG`** 를 실제 `main` 에 태워
  end-to-end 로 검증한다.
- **표본 집합 자체의 커버리지를 전제 테스트로 고정**: `FrontendExcludeCoverageTest`
  (`:421`)의 `test_sample_set_matches_the_real_tsconfig`(`:441`)는 `FRONTEND_EXCLUDE_SAMPLES`
  가 실제 `tsconfig.json` 의 `exclude` 목록과 같은 집합인지 검사해, 표본이 낡아도
  조용히 통과하는 것을 막는다 — "입력 집합 자체가 커버리지" 함정을 정확히 겨냥.
- **AmbientDeclarationIsAModuleTest**(`:466`)가 이번 사고(`jest-axe.d.ts` 의
  `declare module "vitest"` shadowing)의 핵심 불변식("이 파일은 top-level import/export
  가 있는 모듈이어야 한다")을 40초짜리 tsc 게이트와 별개로 밀리초 단위 가드로도 고정 —
  같은 불변식을 이중으로 지키는 좋은 설계.
- **Mock 적절성**: `run_tsc` 자체를 주입으로 대체하는 `VerdictTest`/`UpdateBaselineTest`
  는 "검증 대상은 tsc 가 아니라 대조 규칙" 이라는 docstring 의도와 정확히 일치하고,
  `RunTscFailClosedTest` 는 `subprocess.run` 만 목으로 갈아 `run_tsc` 자체의 fail-closed
  분기를 별도로 실행한다 — 계층 분리가 명확하다(다만 위 WARNING 이 지적하듯 그 계층
  분리 안에서 한 분기가 비어 있다).
- **테스트 가독성**: 모든 테스트 클래스·메서드에 "왜 이 테스트가 존재하는가"를 실패
  시나리오와 함께 서술하는 docstring/주석이 달려 있어 의도 파악이 쉽다.
- **회귀 테스트**: 삭제된 `test_backend_typecheck_ratchet.py` 의 전 테스트(`ParseTest`
  4개, `VerdictTest` 6개, `FailClosedTest` 4개, `RunTscFailClosedTest` 4개,
  `UpdateBaselineTest` 2개, `ShapeTest` 3개)가 새 `test_typecheck_ratchet.py` 에
  이름·의도 그대로 이관되었고(backend/frontend 양쪽을 도는 `subTest` 로 일반화된 것
  포함), 저장소 전체를 grep 해 옛 파일명에 대한 잔존 참조가 없음을 확인했다 — 커버리지
  손실 없음.
- **테스트 격리**: `tempfile.mkdtemp()` 로 매 테스트가 독립된 baseline 파일을 쓰고,
  `sys.modules` 등록도 엔트리포인트가 실제로 쓰는 이름으로 통일해 다른 테스트 파일과의
  충돌 여지를 최소화했다. 다만 `tempfile.mkdtemp()` 임시 디렉터리에 `tearDown`/
  `addCleanup` 이 없어(예: `:167`, `:202`, `:237`, `:265`, `:277`, `:301`, `:323`) 정리되지
  않고 누적되는데, 이는 저장소 기존 스타일을 계승한 것으로 직전 라운드에서도 낮은
  우선순위 INFO 로 이미 확인된 사안이라 재차 등급을 올리지 않는다.

## 요약

핵심 판정 로직(`count_by_file`/`verdict`/`load_baseline`/`main`)과 두 패키지 배선
(`EntrypointWiringTest`)에 대한 테스트는 두텁고 대조군까지 갖춘 고품질이며, 직전 라운드
지적사항의 반영도 직접 코드 열람과 35개 테스트 실행으로 확인했다. 다만 `run_tsc()` 의
"진단이 있는 정상 실패" 분기가 어떤 단위 테스트에서도 실행되지 않는다는 것을 뮤테이션으로
직접 실증했고(35/35 GREEN 유지), 그 분기가 깨지면 게이트가 타입 오류 유무와 무관하게
CI 에서 영구 exit 2 로 죽는다 — 조용한 통과는 아니지만 fast 스위트로는 잡히지 않는 실제
회귀다. 또한 직전 라운드가 스스로 지적한 "게이트가 자기 자신을 못 트리거한다" 클래스는
이번엔 손으로만 고쳐졌고 그 재발을 막는 자동 테스트가 여전히 없다 — 이 PR 이 반복해서
서술하는 "조용히 헐거워지는 게이트" 실패 클래스가 검증 계층 자체에 한 겹 남아 있다.

## 위험도

MEDIUM
