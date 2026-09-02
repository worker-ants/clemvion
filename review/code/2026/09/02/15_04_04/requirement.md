# 요구사항(Requirement) 리뷰

## 전제 — 이 diff 는 이미 1라운드 리뷰(11_27_26)를 거친 결과물이다

프롬프트 diff base 에는 `review/code/2026/09/02/11_27_26/` 의 SUMMARY.md·RESOLUTION.md·각
reviewer 산출물이 신규 파일로 포함돼 있다. 그 라운드가 낸 CRITICAL 1건(`DIAGNOSTIC` 정규식이
Next.js route group `(main)/(editor)/(auth)` 경로의 tsc 진단을 조용히 누락)과 WARNING 1건
(`TEST_FILE_RULES["frontend"]` 이 tsconfig exclude 의 `.spec.ts(x)` 갈래를 빠뜨림)이 현재
워킹트리에서 실제로 고쳐졌는지를, 리포트 텍스트를 받아쓰지 않고 **직접 재현·재실행**해서
확인했다.

## 검증 방법 (읽기 전용 — 저장소에 아무것도 쓰지 않음)

- `scripts/_typecheck_ratchet.py`, `scripts/check-{backend,frontend}-typecheck-ratchet.py`,
  `scripts/frontend-typecheck-baseline.json`, `codebase/frontend/tsconfig.typecheck.json`,
  `codebase/frontend/src/test/{jest-axe,vitest-matchers}.d.ts`,
  `.claude/tests/test_typecheck_ratchet.py` 전문을 직접 `Read`.
- `python3 -m unittest discover -s .claude/tests -p 'test_typecheck_ratchet.py'` 실행 →
  **35 tests, OK**. 실행 로그에 `EntrypointWiringTest` 가 실제 `CONFIGS["backend"]`/
  `CONFIGS["frontend"]` 로 `CORE.main()` 을 태운 결과가 그대로 찍힌다:
  `OK: backend 타입 진단 199건 / 38파일 — baseline 과 일치.` /
  `OK: frontend 타입 진단 52건 / 15파일 — baseline 과 일치.`
- `python3 -m unittest discover -s .claude/tests -p 'test_workflow_yaml_structure.py'` →
  **13 tests, OK**. `python3 -m unittest discover -s .claude/tests -p 'test_harness_checks_paths_coverage.py'`
  → **26 tests, OK**.
- `scripts/frontend-typecheck-baseline.json` 을 직접 읽어 `src/app/(main)/w/[slug]/…/scope-tab.test.tsx`
  항목이 `1` 로 커밋돼 있음을 확인 — 1라운드가 지적한 "누락된 그 파일" 이 baseline 에 존재한다.
- `codebase/frontend/tsconfig.json` 의 실제 `exclude` 배열을 파싱해
  `FRONTEND_EXCLUDE_SAMPLES` 의 키 집합과 바이트 단위로 일치함을 확인(`test_sample_set_matches_the_real_tsconfig`
  가 이를 자동으로도 고정).
- `git status --short` 로 되돌릴 것이 없음을 재확인.

## 발견사항

- **[INFO]** `PROJECT.md` 신규 행의 서술이 frontend `tsconfig.json` 의 실제 exclude 갈래
  중 하나를 언급에서 빠뜨렸다 — 기능 결함은 아니고 요약 문장의 완전성 문제.
  - 위치: `PROJECT.md`(§"wrapper 4단계 밖의 CI 게이트" 표, "frontend 타입체크 ratchet" 행)
  - 상세: 이 행은 "`tsconfig.json` **자신이** `src/test/**`·`*.test.ts(x)`·`**/__tests__/**`
    를 exclude" 라고만 쓰는데, 실제 `codebase/frontend/tsconfig.json` 의 `exclude` 는
    `src/**/*.spec.ts`·`src/**/*.spec.tsx` 도 포함한다(직접 파싱 확인). 같은 사실을 서술하는
    다른 두 자리 — `codebase/frontend/tsconfig.typecheck.json` 의 `//` 주석과
    `scripts/check-frontend-typecheck-ratchet.py` 의 모듈 docstring — 은 `*.spec.ts(x)` 를
    명시한다. PROJECT.md 만 그 갈래가 빠진 축약형이라, 세 자리가 서로 다른 상세도로 같은
    사실을 반복하는 형태다. 코드·baseline·테스트(`TEST_FILE_RULES["frontend"]`,
    `FRONTEND_EXCLUDE_SAMPLES`)는 `.spec.ts(x)` 를 정확히 포함하므로 **동작에는 영향 없음** —
    순수 문서 완전성 이슈.
  - 제안: PROJECT.md 행에도 `*.spec.ts(x)` 를 추가해 세 서술을 동일한 상세도로 맞춘다(선택,
    우선순위 낮음).

- **[INFO]** spec fidelity — 이번 변경은 harness/CI 도구 계층(`.claude/tests/`,
  `scripts/`, `.github/workflows/`, `codebase/frontend/tsconfig.typecheck.json`)이며,
  `spec/` grep 결과 이 영역(타입체크 ratchet)을 규정하는 spec 문서는 없다(`spec/` 는
  제품 정의·기술 명세 전용이고, CLAUDE.md 의 정보 저장 위치 표에 따르면 harness/CI 정책은
  `PROJECT.md` + `.claude/tests/README.md` 관할). 두 문서 모두 이번 diff 에서 갱신됐고,
  실제 워크플로 구조(`frontend-checks.yml` 의 `typecheck-ratchet` 잡, `needs: changes` +
  표준 gating 문자열, `changes.pathspecs` 등재)와 line-level 로 일치함을 위 실행 결과로
  확인했다. spec 누락이 아니라 애초에 spec 범위 밖.

## 1라운드 CRITICAL/WARNING 조치 확인 (재발 아님)

- **C1 (route group 파싱 누락)** — `scripts/_typecheck_ratchet.py:49-50` 의 `DIAGNOSTIC`
  정규식이 `r"^(?P<file>[^\s].*?)\((?P<line>\d+),(?P<col>\d+)\): error (?P<code>TS\d+)"` 로
  교체돼 non-greedy file 캡처 + `(숫자,숫자): error TS` 앵커를 쓴다. `(main)` 처럼 숫자가
  아닌 괄호는 더 이상 매치를 끊지 못한다. 회귀 픽스처
  `test_paths_containing_parentheses_are_counted`(정방향) +
  `test_indented_continuation_with_a_position_is_still_ignored`(대조군, 들여쓴 줄이
  우연히 `(1,1): error TS…` 를 담아도 미스매치)가 양쪽을 고정하고, 둘 다 실제로 통과한다.
  baseline 은 52/15 로 재생성돼 커밋됐고, `frontend-typecheck-baseline.json` 에 문제의
  `scope-tab.test.tsx` 항목이 존재한다. **재발 아님, 조치 확인.**
- **W1 (TEST_FILE_RULES 비대칭)** — `.claude/tests/test_typecheck_ratchet.py:86` 의
  `TEST_FILE_RULES["frontend"]` 가 `\.(?:test|spec)\.tsx?$` 갈래를 포함해 tsconfig 의
  `.spec.ts(x)` 를 이제 커버한다. 추가로 `FrontendExcludeCoverageTest` 가 tsconfig 의
  exclude 글롭을 전수 열거한 `FRONTEND_EXCLUDE_SAMPLES` 로 규칙이 전부 덮는지, 그리고
  그 표본 집합 자체가 실제 tsconfig 와 같은 집합인지(전제 테스트)까지 자동으로 고정한다.
  **재발 아님, 조치 확인(원래 지적보다 강화됨).**
- **testing WARNING (모듈 이중 로드)** — `CORE = load_module(CORE_PATH, "_typecheck_ratchet")`
  로 엔트리포인트가 쓰는 이름과 통일했고, `EntrypointWiringTest.test_configs_are_instances_of_the_core_dataclass`
  가 `isinstance(cfg, CORE.RatchetConfig)` 를 직접 단언한다. 직접 실행 결과 통과.
  **재발 아님, 조치 확인.**
- **documentation/side_effect CRITICAL (pathspec 미등재)** — `frontend-checks.yml`/
  `backend-checks.yml` 의 `changes.pathspecs` 에 `scripts/_typecheck_ratchet.py` 등이
  등재됐음을 파일을 직접 열어 확인(요구사항 리뷰 범위는 아니지만 게이트 실효성에 직결되므로
  교차 확인).

## 요약

핵심 기능(backend/frontend 타입체크 ratchet 공유 코어화, frontend CI 잡·전용 tsconfig·
baseline·harness 등재 신설)은 요구사항 관점에서 완전하게 구현돼 있다. 1라운드에서 나온
CRITICAL(정규식이 Next.js route group 경로의 진단을 조용히 삼킴)과 WARNING(frontend 테스트
파일 판별 규칙이 tsconfig exclude 와 비대칭)을 코드·baseline·테스트를 직접 열어 재현하고
`python3 -m unittest`(35/35, 13/13, 26/26 전부 OK) 로 재실행해 확인한 결과, 둘 다 정확히
고쳐졌고 각각에 대해 정방향·대조군 회귀 테스트가 신설돼 재발을 구조적으로 막고 있다. 판정
규칙(`verdict()`), fail-closed 경로(`load_baseline`/`run_tsc`), `--update` 라운드트립 등
모든 반환 경로가 테스트로 실행·확인됐다. 남은 발견은 PROJECT.md 행의 `.spec.ts(x)` 언급 누락
INFO 하나뿐이며 동작에는 영향이 없다. `spec/` 에는 이 harness/CI 영역을 규정하는 문서가 없고
이는 프로젝트 관례상 정상(PROJECT.md/README.md 가 SoT).

## 위험도
NONE
