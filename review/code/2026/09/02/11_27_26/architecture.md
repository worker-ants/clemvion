# 아키텍처(Architecture) 리뷰

## 개요

이번 변경은 `scripts/check-backend-typecheck-ratchet.py` 단일 스크립트에 있던 타입체크
ratchet 판정 로직을, 패키지 무관 판정 규칙(`scripts/_typecheck_ratchet.py`)과 패키지별
설정(`RatchetConfig` 주입)으로 분리하고, 그 판정 규칙을 `check-frontend-typecheck-ratchet.py`
에도 재사용하는 리팩터다. 아울러 frontend 전용 `tsconfig.typecheck.json` 신설, TS 모듈
경계 결함(`jest-axe.d.ts` 의 global-script 문맥에서 `declare module "vitest"` 가
augmentation 이 아니라 shadowing 이었던 버그) 수정, CI 워크플로/harness 경로 등재 갱신을
포함한다.

## 발견사항

- **[INFO]** "baseline 에 들어와도 되는 파일(=테스트 파일)" 판별 규칙이 프로덕션
  `RatchetConfig` 밖, 테스트 전용 딕셔너리에만 존재해 SoT 가 갈라져 있다.
  - 위치: `.claude/tests/test_typecheck_ratchet.py:77` (`TEST_FILE_RULES = {...}` 정의),
    소비처는 같은 파일 `:332`(`PerPackageShapeTest.test_baselines_only_list_test_files`)와
    `:378`(`FrontendTypecheckConfigTest.test_baseline_contains_files_the_base_config_excludes`).
  - 상세: `scripts/_typecheck_ratchet.py` 의 `RatchetConfig` (`scripts/_typecheck_ratchet.py:47`)
    는 `label`/`package_dir`/`tsconfig`/`baseline`/`script`/`blind_spot` 만 담고 "이 패키지에서
    무엇이 정당한 테스트 파일인가"라는 판별 규칙은 담지 않는다. 그 규칙은 오직
    `test_typecheck_ratchet.py` 의 `TEST_FILE_RULES` regex 로만 존재한다. 이 파일의 모듈
    docstring 이 정확히 지적하는 실패 클래스 — "같은 목적의 독립 사본이 조용히 갈리는" 것 —
    를 판정 로직 자체는 `_typecheck_ratchet.py` 로 통합해 막아 놓고, "baseline 에 무엇이 들어와도
    되는가"라는 인접한 불변식은 여전히 프로덕션 설정과 분리된 테스트 전용 사본으로 남겼다.
    당장은 fail-loud(테스트 실패)라 조용한 통과로 이어지지는 않지만, 세 번째 패키지가 추가되거나
    backend/frontend 의 테스트 파일 명명 규칙(`*.spec.ts` 외 확장)이 바뀌면 이 regex 만 별도로
    갱신해야 한다는 사실을 아는 사람에게 의존한다.
  - 제안: `TEST_FILE_RULES` 상당의 판별 규칙(또는 그 근거가 되는 tsconfig `exclude`/glob)을
    `RatchetConfig` 필드로 승격하거나, 최소한 각 엔트리포인트 파일(`scripts/check-*-typecheck-ratchet.py`)
    옆에 문서화해 프로덕션 설정과 테스트 판별 규칙이 같은 자리에서 갱신되도록 한다.

- **[INFO]** 모듈 간 연결이 파일시스템 경로 조작(`sys.path.insert`)에 의존한다 — 명시적
  패키지 임포트가 아니라 암묵적 위치 결합.
  - 위치: `scripts/check-backend-typecheck-ratchet.py:48`
    (`sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))`), 동일 패턴
    `scripts/check-frontend-typecheck-ratchet.py:50`.
  - 상세: `_typecheck_ratchet.py` 를 공유 코어로 끌어올린 방향은 옳지만, 임포트 메커니즘은
    같은 디렉터리에 있다는 사실에만 의존하는 `sys.path` 런타임 조작이다. `scripts/` 가
    정식 파이썬 패키지(`__init__.py` + 상대 임포트)가 아니라 독립 CLI 스크립트 모음이라는
    이 저장소의 기존 관례(`.claude/tests/_harness` 등)와는 일관되지만, 두 엔트리포인트가 각각
    같은 경로를 `sys.path` 앞에 삽입하므로 두 모듈을 한 프로세스에서 모두 로드하면(테스트
    파일이 실제로 그렇게 한다 — `ENTRYPOINTS.items()` 순회) `sys.path` 에 같은 항목이
    중복 삽입된다. 기능 영향은 없지만 모듈 경계가 타입 시스템이 아니라 프로세스 전역 상태로
    표현되는 결합이다.
  - 제안: 현 상태 유지 시 문제 없으나, 세 번째 이상 스크립트가 같은 패턴을 반복하기 전에
    `scripts/` 를 최소 네임스페이스 패키지로 승격하거나 `importlib` 명시 로더로 전환하는 것을
    고려할 것(당장 조치 불요, 관찰 기록).

## 긍정적으로 평가한 설계 결정 (참고용, 조치 불요)

- **DIP/전략 주입**: `main(cfg: RatchetConfig, argv)` 가 이전의 모듈 전역 상수
  (`BACKEND`, `BASELINE` 등, `scripts/check-backend-typecheck-ratchet.py` 구버전)를
  명시적 설정 객체 주입으로 교체했다. `RatchetConfig` 는 `@dataclass(frozen=True)` 로
  불변 값 객체다(`scripts/_typecheck_ratchet.py:46-66`). 테스트가 `fake_config()` 로
  실제 패키지를 건드리지 않고 판정 규칙만 독립적으로 검증할 수 있게 된 것이 이 주입의
  직접적 이익이다(`.claude/tests/test_typecheck_ratchet.py:90-99`).
- **SRP 분리**: 판정 규칙(파싱·verdict·fail-closed·baseline I/O)은 `_typecheck_ratchet.py`
  하나에, 패키지별 차이(디렉터리·tsconfig·baseline 경로·사각지대 설명)는 각 엔트리포인트의
  `CONFIG` 리터럴에만 있다. 순환 의존 없음 — 코어는 엔트리포인트를 모른다.
  이 리팩터가 막으려는 실패 클래스(`plan_guard.py` ↔ `plan-stale-audit.sh` 세 번째 drift,
  모듈 docstring `scripts/_typecheck_ratchet.py:5-8` 자체가 근거로 인용)에 정확히 대응한다.
- **TS 모듈 경계 수정**: `codebase/frontend/src/test/jest-axe.d.ts` 에서 `declare module
  "vitest"` augmentation 블록을 제거하고 `codebase/frontend/src/test/vitest-matchers.d.ts`
  로 분리하며 `import "vitest";` 를 추가했다 — global script 문맥의 `declare module` 이
  augmentation 이 아니라 shadowing 이 되는 TS 모듈 시스템 규칙을 정확히 겨냥한 수정이며,
  실측(1,256건의 phantom TS2305)으로 뒷받침된다.
- **확장 지점**: 세 번째 패키지 추가 시 `RatchetConfig` 인스턴스 하나 + 엔트리포인트 파일
  하나로 코어 변경 없이 확장 가능(OCP). CI/harness 등재는 이 저장소의 기존 다중 지점
  동기화 관례(`harness-checks.yml` pathspec, `PROJECT.md` 표, `.claude/tests/README.md`)를
  그대로 따르며 새로운 문제를 만들지 않는다.

## 요약

핵심 변경은 중복 로직 drift라는 이 저장소가 반복적으로 겪은 실패 클래스를 겨냥해 판정
규칙을 단일 코어로 통합하고 설정을 명시적으로 주입하는 정공법 리팩터다. SRP·DIP 적용이
적절하고, 순환 의존은 없으며, TS 앰비언트 선언의 모듈 경계 버그도 근거를 갖춰 바로잡았다.
남은 것은 실행 리스크가 아니라 유지보수 리스크 — "정당한 테스트 파일" 판별 규칙이
프로덕션 설정이 아니라 테스트 전용 사본으로만 존재해, 이 PR 이 막으려던 것과 같은 종류의
분리(다만 fail-loud라 안전한 형태)가 한 겹 남아 있다는 점, 그리고 `sys.path` 조작에
의존하는 암묵적 모듈 결합이다. 둘 다 즉각 차단 사유는 아니다.

## 위험도

LOW
