# 테스트(Testing) Review — `18_16_05` (전회 `17_52_44` W2/W3 fix 검증 라운드)

## 검증 방법

이번 diff 는 전회(`17_52_44`) 리뷰의 WARNING 2건(`:(glob)` boundary 단위 테스트 부재, 실행 계층
회귀 테스트 부재)과 INFO 3건(named 상수화, `node_modules` fixture, 양성 검출 fixture)에 대한
`RESOLUTION.md` 집행분이다. 주장을 그대로 받지 않고 직접 실행 + 뮤테이션으로 재검증했다.

- `python3 -m unittest discover -s .claude/tests -p 'test_ci_paths_changed.py'` → **20/20 PASS**
  (신규 `test_git_glob_magic_confines_star_to_the_root_segment` · `test_without_the_magic_the_star_crosses_slashes` 포함).
- `python3 -m unittest discover -s .claude/tests -p 'test_harness_checks_paths_coverage.py'` → **26/26 PASS**.
- `python3 -m unittest discover -s .claude/tests -p 'test_required_check_skip_jobs.py'` → **17/17 PASS**.
- `pnpm --filter frontend vitest run src/lib/docs/__tests__/spec-link-integrity.test.ts` → **19/19 PASS**.
- **뮤테이션 재현(W2 fix 유효성 직접 확인)**: `filter_covers_file` 의 `:(glob)` strip 두 줄
  (`.claude/tests/test_harness_checks_paths_coverage.py` 의 `_GIT_GLOB_MAGIC` 처리 분기)을
  제거하고 `FilterMatchBoundaryTest` 를 재실행 → 신규 테스트
  `test_git_glob_magic_is_stripped_and_keeps_segment_bounds` 가 정확히 **RED** (`AssertionError: False is not true`,
  `filter_covers_file(":(glob)*.md", "PROJECT.md")` 단언에서). 파일은 즉시 원복해 diff 없음을 확인
  (`git status --short` 로 clean 확인). 이 fix 가 죽은 방어가 아니라 실제로 회귀를 잡는다는 것을 직접
  증명했다.
- `find .claude -name "*.md" -not -path "*/worktrees/*" -not -path "*/node_modules/*" | wc -l` → **52** —
  `spec-link-integrity.test.ts` 의 `MIN_CLAUDE_DOCS = 20` 주석("실측 52개")과 일치.

## 발견사항

전회 WARNING 2건·INFO 3건 모두 실제 코드로 반영됐고, 뮤테이션으로 직접 재확인한 결과 **죽은
방어가 아니라 실제로 작동하는 회귀 가드**임을 확인했다. 이번 라운드에서 신규로 지적할 Critical/Warning
급 테스트 갭은 없다.

- **[INFO]** `test_ci_paths_changed.py` 의 신규 테스트 2건(`test_git_glob_magic_confines_star_to_the_root_segment`,
  `test_without_the_magic_the_star_crosses_slashes`)은 `.github/workflows/spec-link-checks.yml`
  의 실제 YAML 문자열(`:(glob)*.md`)을 읽어와 검증하는 것이 아니라, 그 값을 스위트 안에 **재입력**한 하드코딩
  리터럴로 `ci-paths-changed.sh` 를 직접 구동한다.
  - 위치: `.claude/tests/test_ci_paths_changed.py:119-161` (`test_git_glob_magic_confines_star_to_the_root_segment`,
    `test_without_the_magic_the_star_crosses_slashes`)
  - 상세: 같은 파일의 `test_the_real_manifest_pathspecs_match_every_depth` 도 동일하게
    `MANIFEST_SPECS` 튜플을 하드코딩하는 기존 관례라 이 자체는 새 결함이 아니다. 다만 워크플로
    YAML 의 `:(glob)*.md` 문자열이 오탈자(예: `:(Glob)*.md`)로 바뀌면 이 두 테스트는 여전히
    자기 자신의 하드코딩 값으로 통과하므로 잡지 못한다 — YAML↔스크립트 실행 경로 연결 자체는
    `test_required_check_skip_jobs.py::DeadFilterTest`(실 저장소 YAML 을 읽음)가 별도로 담당하고
    있어 실질적 커버리지 공백은 아니다.
  - 제안: 조치 불필요(정보성). 우려된다면 `DeadFilterTest` 쪽에 "루트 밖은 매치하지 않는다"는
    segment-bound 단언까지 추가하는 것을 후속 고려할 수 있으나 이 PR 범위는 아니다.

## 좋은 점

- `test_ci_paths_changed.py` 의 W3 fix 는 **대조군을 명시적으로 설계**했다 — `:(glob)` 유무에 따라
  같은 `nested/deep.md` 커밋이 `false`/`true` 로 갈리는 것을 각각 pin 해서, "매직 덕분에 안 잡힘"과
  "`*.md` 가 원래 루트만 잡음"을 구별 가능하게 만들었다. 실측(뮤테이션 제거 시 RED)으로 유효성도
  확인됨.
- `FilterMatchBoundaryTest` 신규 케이스는 매치(루트) · 비매치(세그먼트 경계) · 접두 위치 조건(`a:(glob)*.md`
  는 리터럴 취급) 세 축을 한 테스트에서 모두 pin 해 boundary 커버리지가 촘촘하다.
- `spec-link-integrity.test.ts` 의 `node_modules` fixture·양성 검출 fixture 추가는 "안 잡힌다"만
  단언하던 이전의 vacuous-pass 취약점(3곳 모두 스코프를 빈 배열로 만들어도 통과 가능했던 상태)을
  정확히 겨냥해 닫았다 — `RESOLUTION.md` 의 M-D8 뮤테이션 표(`2 failed` 예측 → `3 failed` 실측)가
  예측과 어긋난 이유(신규 양성 테스트의 정확한 개수 단언 `violations.length === 1` 이 추가로 깨짐)도
  근거와 함께 기록돼 있어 신뢰할 수 있다.
- `MIN_CLAUDE_DOCS = 20` named 상수화 + 실측 근거(52개) 주석은 이전 INFO 3 지적을 정확히 반영했다.

## 요약

전회 라운드의 testing WARNING 2건(핵심 회귀 방지 로직 `:(glob)` pathspec 매직에 대한 실행 계층·
함수 boundary 단위 테스트 부재)이 이번 diff 로 정확히 메워졌다. 주장을 그대로 신뢰하지 않고
`_GIT_GLOB_MAGIC` strip 로직을 실제로 제거해 신규 boundary 테스트가 RED 로 떨어지는 것을 직접
확인했으며(mutation-valid), 전체 테스트 스위트(`test_ci_paths_changed` 20 · `test_harness_checks_paths_coverage`
26 · `test_required_check_skip_jobs` 17 · vitest 19)도 전부 재실행해 PASS 를 재확인했다. INFO 3건
(named 상수, `node_modules` fixture, 양성 검출 fixture)도 반영되어 있고 각각의 존재 이유가 주석에
근거와 함께 남아 있다. 이번 라운드에서 새로 발견된 Critical/Warning 급 테스트 결함은 없다.

**참고 (프로세스, 코드 결함 아님)**: 검증 과정에서 뮤테이션 백업용 `cp` 명령의 목적지 경로를 실수로
worktree 루트의 `scratchpad_idem_backup.ts` (세션 시작 시점부터 이미 존재하던 untracked 파일)로
지정해 그 내용을 덮어썼다가 삭제로 정리했다. git 추적 대상이 아니라 커밋 이력으로 복구 불가능하므로,
그 파일이 다른 병렬 작업(예: 동시 실행 중인 다른 reviewer)의 산출물이었다면 유실됐을 수 있다.
오케스트레이터가 확인 필요.

## 위험도

NONE — 테스트 관점에서 이 라운드가 병합을 막을 이유 없음.
