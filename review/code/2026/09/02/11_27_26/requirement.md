# 요구사항(Requirement) 리뷰

## 발견사항

- **[CRITICAL]** `DIAGNOSTIC` 정규식이 경로에 리터럴 `(` 를 포함한 tsc 진단 줄을 조용히 파싱 실패시킨다 — Next.js App Router route group(`src/app/(main)/`, `(editor)/`, `(auth)/`) 전체가 이 게이트의 사각지대이며, 이는 PR 자신이 막으려는 바로 그 실패 클래스("게이트가 조용히 통과하기 시작하면 사각이 그대로 돌아온다")의 재발이다.
  - 위치: `scripts/_typecheck_ratchet.py:40` (`DIAGNOSTIC = re.compile(...)`), `count_by_file()` 40/110-117
  - 상세: 직접 재현 확인(로컬 실측, 2회 재현 동일).
    - `cd codebase/frontend && npx tsc --noEmit -p tsconfig.typecheck.json` → **52건 / 15파일**.
    - 반면 실제 게이트 `python3 scripts/check-frontend-typecheck-ratchet.py` (repo 루트에서 실행) → `OK: frontend 타입 진단 51건 / 14파일 — baseline 과 일치.` (exit 0).
    - 차이는 정확히 한 줄: `src/app/(main)/w/[slug]/integrations/[id]/__tests__/scope-tab.test.tsx(44,3): error TS2322: ...`. `DIAGNOSTIC` 의 file 캡처 그룹 `[^(\s][^(]*` 은 첫 `(` 에서 매치를 멈춘다 — `src/app/` 까지만 소비하고 그다음 요구되는 `\(\d+,\d+\)` 가 실제로는 `main)/w/...` 이므로 전체 매치가 실패해 `DIAGNOSTIC.match(line)` 이 `None` 을 반환한다(단독 재현: `re.compile(r"^(?P<file>[^(\s][^(]*)\(...")` 에 해당 줄을 `match()` → `None`). `count_by_file()` 은 `if m:` 으로만 걸러 매치 실패 줄을 **조용히 버린다** — 파싱 실패를 감지하는 코드가 없다.
    - Next.js route group 폴더명은 이 저장소가 실제로 쓰는 구조다(`find codebase/frontend/src -iname '*(*'` → `(editor)`/`(main)`/`(auth)` 3개 디렉터리). `tsconfig.typecheck.json` 이 재선언한 `exclude: ["node_modules"]` 때문에 그 경로 아래 테스트 파일 전체가 스캔 대상인데, 그 안의 진단은 이 정규식으로 영구히 안 잡힌다 — 새 타입 오류가 `(main)/(editor)/(auth)` 아래 테스트 파일에 들어와도 `counts` 딕셔너리에 아예 등록되지 않으므로 baseline 대비 "증가"로 판정되지 않고 게이트는 계속 `OK` 를 출력한다.
    - 부수 효과: README.md/`check-frontend-typecheck-ratchet.py` 문서/`plan/in-progress/harness-review-gate-followups.md` 전반에 반복 인용된 "51건 / 14파일, 전부 테스트 파일" 실측 수치 자체도 부정확하다(실제 tsc 출력은 52건/15파일이며, 그중 `scope-tab.test.tsx` 1건은 baseline 에 없다).
  - 제안: `DIAGNOSTIC` 의 file 캡처 그룹을 첫 `(` 에서 정지하는 `[^(\s][^(]*` 대신, 줄 끝 쪽의 `(숫자,숫자): error TS숫자` 를 우선 매치하는 탐욕적 `.+` 로 바꾼다 (`^(?P<file>.+)\((?P<line>\d+),(?P<col>\d+)\): error (?P<code>TS\d+)`). 로컬 검증 결과 기존 `SAMPLE` 픽스처(연속·요약 줄 미매치)는 그대로 유지되면서 괄호 포함 경로도 정확히 매치된다. `ParseTest`/`count_by_file` 에 Next.js route group 스타일 경로(`src/app/(main)/.../x.test.tsx(1,2): error TS1: y`) 픽스처를 추가해 회귀를 막고, baseline 을 실측치(52/15)로 `--update` 재생성해야 한다.

- **[WARNING]** frontend `TEST_FILE_RULES` 정규식이 `tsconfig.json` 의 실제 `exclude` 패턴과 비대칭이다 — `__tests__/`·`.test.ts(x)$`·`src/test/` 세 얼터너티브만 있고 `tsconfig.json` 이 명시하는 `.spec.ts(x)$` 가 빠져 있다.
  - 위치: `.claude/tests/test_typecheck_ratchet.py:79` (`TEST_FILE_RULES["frontend"]`)
  - 상세: `codebase/frontend/tsconfig.json` 의 `exclude` 는 `src/**/*.spec.ts`·`src/**/*.spec.tsx` 를 명시적으로 포함하는데(`.spec.ts(x)` 를 유효한 테스트 파일 네이밍으로 인정), `TEST_FILE_RULES["frontend"]` 는 이 패턴을 얼터너티브로 두지 않았다. 현재는 우연히 통과한다 — 저장소의 `.spec.ts` 파일 3개(`src/lib/utils/__tests__/generate-unique-label.spec.ts` 등)가 전부 `__tests__/` 안에 있어 첫 얼터너티브로 걸린다(확인: `find codebase/frontend/src -iname '*.spec.ts*' ! -path '*__tests__*'` → 0건). 하지만 향후 `__tests__/` 밖에 colocated `*.spec.ts` 파일이 baseline 에 들어오면 `PerPackageShapeTest.test_baselines_only_list_test_files`/`FrontendTypecheckConfigTest.test_baseline_contains_files_the_base_config_excludes` 가 그것을 "production 파일" 로 오판해 거짓 실패를 낸다 — fail-safe 방향이라 위험하진 않지만, 이 PR 스스로 경고하는 "사본이 갈리는" 위험의 축소판이다(backend `TEST_FILE_RULES`(`\.spec\.tsx?$`)는 backend tsconfig 의 exclude 패턴과 정확히 대칭).
  - 제안: `TEST_FILE_RULES["frontend"]` 에 `\.spec\.tsx?$` 얼터너티브를 추가해 `tsconfig.json` 의 exclude 목록과 1:1 대응시킨다.

- **[INFO]** `test_typecheck_ratchet.py` 가 공유 core 모듈을 프로세스 내에서 **두 개의 다른 모듈 객체**로 이중 로드한다.
  - 위치: `.claude/tests/test_typecheck_ratchet.py:63` (`CORE = load_module(CORE_PATH, "typecheck_ratchet_core")`), `:70-73` (`CONFIGS = {...}`)
  - 상세: `CORE` 는 `_typecheck_ratchet.py` 를 `"typecheck_ratchet_core"` 이름으로 직접 로드한 모듈이다. 반면 `CONFIGS[label]` 은 각 엔트리포인트(`check-backend/frontend-typecheck-ratchet.py`)를 로드할 때, 그 안의 `from _typecheck_ratchet import ...` 가 (테스트가 미리 `sys.modules["_typecheck_ratchet"]` 을 채워두지 않았으므로) sys.path 를 통해 **같은 소스 파일을 다시 실행**해 `"_typecheck_ratchet"` 이라는 별도 모듈을 만든다. 결과적으로 `CORE.RatchetConfig` 와 `CONFIGS[label]`(이 두 번째 모듈의 `RatchetConfig` 인스턴스)은 필드가 같아도 `__class__` 가 다르다. 현재 이 두 계열을 섞어 비교(`isinstance`/dataclass 기본 `__eq__`, 이는 `other.__class__ is self.__class__` 를 요구)하는 단언이 없어 실제 실패로 이어지지는 않는다(직접 실행 확인: 27/27 통과, `python3 -m unittest discover -s .claude/tests -p 'test_typecheck_ratchet.py'`). 다만 이 파일의 모듈 docstring 이 강조하는 "판정 규칙은 한 곳" 이라는 불변식을, 테스트 하네스 자신이 실행 시점에 두 벌의 모듈로 만들고 있어 향후 동등성 비교를 추가하는 사람에게 원인 불명의 실패를 안길 수 있다.
  - 제안: `CONFIGS` 를 로드하기 전에 `sys.modules["_typecheck_ratchet"] = CORE` 를 등록하거나, core 모듈 자체를 애초에 `"_typecheck_ratchet"` 이름으로 로드해 엔트리포인트들의 `import _typecheck_ratchet` 가 같은 모듈 객체를 재사용하도록 한다.

- **[INFO]** spec fidelity — 이번 변경은 harness/CI 도구 계층(`.claude/`, `scripts/`, `.github/workflows/`)이며, 규율 문서는 `PROJECT.md`(갱신됨)와 `.claude/tests/README.md`(갱신됨)다. `spec/` 아래 이 영역을 규정하는 문서는 없다(제품 요구사항이 아니라 개발 인프라 정책이므로 spec fidelity 점검 대상 밖). PROJECT.md/README.md 표 행 신설 내용은 실제 CI 워크플로 구조(`frontend-checks.yml` 의 `typecheck-ratchet` 잡, `needs: changes` + 두 표준 gating 문자열)와 line-level 로 일치함을 확인했고, `test_workflow_yaml_structure.py`/`test_required_check_skip_jobs.py`/`test_harness_checks_paths_coverage.py`/`test_doc_sync_matrix.py` 를 직접 실행해 전부 통과함을 확인했다(63/63 OK).

## 요약

핵심 기능(backend/frontend 타입체크 ratchet 을 공유 코어로 통합하고 frontend CI 잡·baseline·harness 등재를 신설하는 것)은 대체로 견고하게 구현됐고, 63개 관련 harness 유닛테스트를 직접 실행해 회귀 없음을 확인했으며 워크플로 배선(needs/if 게이팅/pathspec 등재)도 spec-급 문서(PROJECT.md/README)와 정확히 대응한다. 그러나 핵심 파싱 로직(`DIAGNOSTIC` 정규식)에 **재현·검증된 CRITICAL 결함**이 있다 — 경로에 `(` 를 포함하는 tsc 진단 줄(Next.js route group, 이 저장소가 실제로 쓰는 구조)을 조용히 누락시켜, 실측 52건/15파일 대비 게이트는 51건/14파일로 보고하며 "OK" 를 낸다. 이는 이 PR 이 명시적으로 막으려는 "게이트가 조용히 헐거워지는" 실패 클래스가 파서 버그로 그대로 재발한 것이며, 커밋된 baseline 과 관련 문서(README/스크립트 docstring/plan)의 실측 수치도 그로 인해 부정확하다. 이 CRITICAL 을 고치기 전에는 `(main)/(editor)/(auth)` 아래 테스트 파일의 향후 타입 회귀가 이 게이트를 영구히 통과한다.

## 위험도

HIGH
