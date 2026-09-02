# 아키텍처(Architecture) 리뷰

## 개요

이번 diff 는 (1) `scripts/check-backend-typecheck-ratchet.py` 단일 스크립트에 있던 타입체크
ratchet 판정 로직을 패키지 무관 공유 코어(`scripts/_typecheck_ratchet.py`)와 패키지별 설정
(`RatchetConfig` 값 주입)으로 분리하고, (2) 그 코어를 재사용해 `check-frontend-typecheck-ratchet.py`
를 신설하며, (3) frontend 전용 `tsconfig.typecheck.json`, TS 앰비언트 선언 모듈 경계 수정
(`jest-axe.d.ts` → `vitest-matchers.d.ts` 분리), CI 워크플로/harness pathspec 등재 갱신을
포함한다. 또한 이 diff 는 동일 변경에 대한 1라운드 코드 리뷰 산출물
(`review/code/2026/09/02/11_27_26/**`)과 그 리뷰가 지적한 Critical 2건(진단 파서의 route
group 경로 누락, 신규 게이트 파일의 CI pathspec 미등재)·Warning 2건(TEST_FILE_RULES 비대칭,
테스트 하네스의 코어 이중 로드)에 대한 수정을 함께 담고 있다 — 대조 결과 네 건 모두 현재
코드에 반영되어 있음을 확인했다(`scripts/_typecheck_ratchet.py`의 `DIAGNOSTIC` 정규식이
non-greedy+앵커 형태로 교체됨, `.claude/tests/test_typecheck_ratchet.py`가 코어를
`"_typecheck_ratchet"` 실명으로 로드함, `TEST_FILE_RULES["frontend"]`에 `.spec.tsx?$` 갈래
추가됨, `frontend-checks.yml`/`backend-checks.yml`의 `changes.pathspecs`에 신규 파일 등재됨).

## 발견사항

- **[INFO]** "baseline 에 들어와도 되는 파일(=테스트 파일)" 판별 규칙이 여전히 프로덕션
  `RatchetConfig` 밖, 테스트 전용 딕셔너리에만 존재한다 — 1라운드 리뷰가 이미 지적했고
  의도적으로 미조치로 남긴 항목.
  - 위치: `.claude/tests/test_typecheck_ratchet.py:81`(`TEST_FILE_RULES = {...}` 정의),
    소비처는 같은 파일 `:376`(`PerPackageShapeTest.test_baselines_only_list_test_files`),
    `:432`/`:460`/`:531`(`FrontendExcludeCoverageTest`, `FrontendTypecheckConfigTest`).
    프로덕션 쪽 `RatchetConfig` 정의는 `scripts/_typecheck_ratchet.py:58-77`.
  - 상세: `RatchetConfig`(`scripts/_typecheck_ratchet.py:58`)는 `label`/`package_dir`/
    `tsconfig`/`baseline`/`script`/`blind_spot` 만 담고 "이 패키지에서 무엇이 정당한 테스트
    파일인가"라는 판별 규칙은 담지 않는다. 이 리뷰의 이전 라운드(`RESOLUTION.md`)는 이를 의도
    미조치로 명시했다 — "테스트 전용 규칙을 프로덕션 설정에 올리면 코어가 테스트 관심사를
    알게 된다"는 근거는 타당하다(코어가 baseline 대조라는 순수 정책만 알고, "무엇이 테스트
    파일인가"라는 프로젝트별 관례까지 알 필요는 없다는 SRP 판단). 다만 이 판별은 현재
    `PerPackageShapeTest`/`FrontendExcludeCoverageTest`가 tsconfig 의 실제 exclude 글롭과
    1:1 대응하는지 전수 확인하는 촘촘한 fail-loud 테스트로 방어되고 있어 조용한 통과로 이어질
    가능성은 낮다. 세 번째 패키지가 추가되면 이 규칙 갱신 지점이 (프로덕션 설정이 아니라)
    테스트 파일이라는 점을 아는 사람에게 계속 의존한다.
  - 제안: 현행 유지 가능(근거 있는 트레이드오프). 다만 세 번째 패키지 추가 시점에는 이
    규칙을 `RatchetConfig` 필드(또는 그 근거가 되는 tsconfig `exclude` 글롭 목록)로 승격할지
    재검토할 것 — 지금은 "테스트 전용 파일 하나"지만 패키지가 늘수록 "런타임에 쓰이지 않는
    설정을 테스트가 갖고 있다"는 형태 자체가 다음 사람에게는 부자연스러운 자리가 된다.

- **[INFO]** 모듈 간 연결이 여전히 파일시스템 경로 조작(`sys.path.insert`)에 의존한다 —
  명시적 패키지 임포트가 아니라 프로세스 전역 상태를 통한 암묵적 결합.
  - 위치: `scripts/check-backend-typecheck-ratchet.py:48`
    (`sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))`), 동일 패턴
    `scripts/check-frontend-typecheck-ratchet.py:51`.
  - 상세: 공유 코어(`scripts/_typecheck_ratchet.py`)로 판정 로직을 끌어올린 방향 자체는
    옳지만, 두 엔트리포인트가 각각 `import _typecheck_ratchet` 이전에 같은 디렉터리를
    `sys.path` 맨 앞에 삽입한다. `.claude/tests/test_typecheck_ratchet.py` 가 두 엔트리포인트를
    한 프로세스에서 모두 로드하므로(`ENTRYPOINTS.items()` 순회, `load_module()`) 같은 경로가
    `sys.path` 에 중복 삽입되지만, `EntrypointWiringTest.test_configs_are_instances_of_the_core_dataclass`
    가 `isinstance(cfg, CORE.RatchetConfig)` 를 실측으로 통과시키는 것으로 보아 현재는 무해하다
    (코어가 `"_typecheck_ratchet"` 실명으로 먼저 등록되어 두 엔트리포인트가 같은 모듈 객체를
    재사용). 다만 모듈 경계가 타입 시스템/패키지 구조가 아니라 "먼저 로드된 쪽이 이긴다"는
    프로세스 전역 순서에 의존하는 형태는 여전하다 — 세 번째 이상 스크립트가 같은 패턴을
    반복하거나 `scripts/` 안에 stdlib/서드파티와 이름이 겹치는 모듈이 생기면 잠재적으로
    shadowing 표면이 된다.
  - 제안: 당장 조치 불요(관찰 기록 유지). 스크립트 수가 늘어나기 전에 `scripts/` 를 최소
    네임스페이스 패키지(`__init__.py`)로 승격하거나, `sys.modules` 사전 등록을 코어 자신의
    책임으로 옮기는 것을 고려할 것.

- **[INFO]** CI 오케스트레이션 레이어(GitHub Actions YAML)는 Python 코어만큼 통합되지
  않았다 — `frontend-checks.yml` 의 신설 `typecheck-ratchet` job 이 `backend-checks.yml` 의
  기존 동명 job 과 구조(스킵 스텝 → checkout → 공유 액션 → setup-python → 실행 스텝)를
  손으로 복제한다.
  - 위치: `.github/workflows/frontend-checks.yml` 게이트 107-135(`typecheck-ratchet:` job),
    대응 backend job 은 이 diff 밖(`.github/workflows/backend-checks.yml`, 기존 파일).
  - 상세: 이 PR 이 정확히 겨냥한 실패 클래스("판정 규칙 사본이 조용히 갈린다")는 Python 코어
    레벨에서는 `_typecheck_ratchet.py` 로 잘 봉합됐지만, 그 코어를 호출하는 CI job 정의
    자체는 여전히 워크플로 파일마다 손으로 복제된 YAML 이다. 다만 이 저장소는 `if:` 게이팅
    문자열과 `on.pull_request` 키 집합을 레지스트리로 강제하는
    `test_workflow_yaml_structure.py`(`_STEP_CONDITIONS`/`_PULL_REQUEST_KEYS`)를 이미 갖고
    있어 — 이번 diff 도 `test_workflow_yaml_structure.py` 게이트 254 한 줄을 갱신했다 — 최소한
    게이팅 조건의 drift 는 harness 가 잡는다. 다만 스텝 **순서·구성**(setup-python 위치,
    공유 액션 뒤에 두는 이유 등) 자체를 검증하는 레지스트리는 없어, 향후 세 번째 패키지가
    같은 job 을 또 손으로 복제하면 그 형태 차이는 어떤 가드에도 걸리지 않는다.
  - 제안: 당장 조치 불요 — job 두 개로는 재사용 워크플로/합성 액션으로 뽑아낼 이득이 크지
    않다. 세 번째 패키지(예: `codebase/channel-web-chat`)에 동일 게이트가 필요해지는 시점에는
    reusable workflow(`workflow_call`) 또는 이 스텝 시퀀스를 검증하는 레지스트리 테스트를
    고려할 것.

## 긍정적으로 평가한 설계 결정 (참고용, 조치 불요)

- **DIP/설정 주입**: `main(cfg: RatchetConfig, argv)` 가 이전의 모듈 전역 상수(`BACKEND`,
  `BASELINE`)를 명시적 `@dataclass(frozen=True)` 값 객체 주입으로 교체했다
  (`scripts/_typecheck_ratchet.py:58-77`). 테스트가 `fake_config()`/실제 `CONFIGS[label]`
  양쪽으로 판정 규칙과 배선을 독립적으로 검증할 수 있다.
- **SRP + OCP**: 판정 규칙(파싱·verdict·fail-closed·baseline I/O, `run_tsc`/`count_by_file`/
  `load_baseline`/`write_baseline`/`verdict`/`main`)은 코어 하나에, 패키지별 차이는 각
  엔트리포인트의 `CONFIG` 리터럴에만 있다. 순환 의존 없음 — 코어는 엔트리포인트를 모른다.
  세 번째 패키지 추가 시 `RatchetConfig` 인스턴스 + 엔트리포인트 파일 하나면 되고 코어 변경이
  불필요하다.
- **테스트가 실제 배선을 검증**: `EntrypointWiringTest`(`.claude/tests/test_typecheck_ratchet.py:386-418`)
  가 합성 config 가 아니라 엔트리포인트의 실제 `CONFIG` 를 실제 `main` 에 태워 코어-엔트리포인트
  결합이 진짜로 동작하는지 end-to-end 로 확인한다 — 1라운드 리뷰가 지적한 "이중 로드로 실제
  배선이 무증거" 결함이 근본적으로(우회 아니라 검증 추가로) 해소됐다.
- **TS 모듈 경계 수정**: `jest-axe.d.ts` 에서 `declare module "vitest"` augmentation 블록을
  제거하고 `vitest-matchers.d.ts` 로 분리하며 `import "vitest";` 를 추가했다 — global script
  문맥의 `declare module` 이 augmentation 이 아니라 shadowing 이 되는 TS 모듈 시스템 규칙을
  정확히 겨냥한 수정이며, 그 불변식("top-level import/export 가 있어야 모듈")을 지키는 빠른
  단위 테스트(`AmbientDeclarationIsAModuleTest`)까지 별도로 고정해 40초짜리 tsc 게이트에만
  의존하지 않는다.

## 요약

핵심 변경은 "같은 판정 로직의 독립 사본이 조용히 갈린다"는 이 저장소의 반복된 실패 클래스를
정면으로 겨냥해 판정 규칙을 단일 코어로 통합하고 설정을 명시적으로 주입하는 정공법 리팩터다.
SRP·DIP·OCP 적용이 적절하고 순환 의존은 없으며, 1라운드 리뷰가 지적한 두 건의 아키텍처
인접 결함(코어 이중 로드로 인한 무증거 배선, TEST_FILE_RULES 비대칭) 중 전자는
`EntrypointWiringTest` 신설로 근본 해소됐고 후자도 tsconfig exclude 글롭 전수 대조 테스트로
방어됐다. 남은 것은 실행 리스크가 아니라 유지보수 리스크다 — "정당한 테스트 파일" 판별
규칙이 여전히 프로덕션 설정이 아닌 테스트 전용 사본으로만 존재하는 것(근거 있는 트레이드오프),
`sys.path` 조작에 의존하는 암묵적 모듈 결합, 그리고 Python 코어는 통합됐지만 그것을 호출하는
CI job 정의(YAML)는 워크플로 파일마다 아직 손으로 복제되는 비대칭이다. 셋 다 당장의 차단
사유는 아니며, 모두 "세 번째 패키지가 추가될 때" 라는 동일한 트리거를 공유한다.

## 위험도

LOW
