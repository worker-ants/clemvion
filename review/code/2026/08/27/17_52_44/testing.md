# 테스트(Testing) 리뷰

## 검증 방법

리뷰 대상 9개 파일을 정독한 뒤, 다음을 직접 실행/실측했다:

- `codebase/frontend` 에서 `pnpm vitest run src/lib/docs/__tests__/spec-link-integrity.test.ts` → 18개 전부 PASS (governance scope 신규 테스트 포함).
- `python3 -m unittest discover -s .claude/tests -p 'test_harness_checks_paths_coverage.py'` → 25개 전부 PASS.
- `python3 -m unittest discover -s .claude/tests -p 'test_required_check_skip_jobs.py'` / `'test_ci_paths_changed.py'` → 각 17개/18개 전부 PASS.
- 임시 git 저장소를 만들어 `git diff --name-only -- '*.md'` vs `git diff --name-only -- ':(glob)*.md'` 를 직접 실행 — PR/plan 이 주장하는 "루트만 vs 재귀 매치" 차이를 실측 재현했다(전자는 `a/b/deep.md` 도 잡고 후자는 `root.md` 만 잡음). 이 부분의 코드 수정 자체는 옳다.
- `grep` 으로 `scripts/check-doc-links.py` 를 참조하는 CI/hook/스크립트가 전무함을 확인 → 삭제가 안전하다는 PR 의 주장과 일치.

## 발견사항

- **[WARNING]** `:(glob)*.md` 의 핵심 동작(git 이 실제로 `*` 를 세그먼트 경계에 가두는지)을 실행 계층에서 pin 하는 테스트가 없다
  - 위치: `.github/workflows/spec-link-checks.yml:60` (`:(glob)*.md` 추가) — 이 pathspec 은 `scripts/ci-paths-changed.sh` 의 `git diff --name-only "$MERGE_BASE" "$HEAD_SHA" -- "$@"` 로 그대로 전달되어 실 git 이 해석한다.
  - 상세: 이 PR 의 핵심 주장은 "`:(glob)` 없이는 git pathspec 의 `*` 가 `/` 를 넘어 17,202개를 잡고, 있으면 루트 6개만 잡는다"(실측했고 나도 재현했다)이다. 그런데 이 정확한 실행 경로 — `ci-paths-changed.sh` 가 `:(glob)*.md` 를 받아 실제로 루트만 매치시키는지 — 를 검증하는 테스트가 없다. `.claude/tests/test_ci_paths_changed.py` 는 실 git 저장소 + subprocess 로 `**`가 `/`를 넘는지, 중간 `**` 가 깊이 0을 놓치는지 등 이미 같은 클래스의 pathspec 세부 의미를 정확히 이 패턴(`test_nested_path_matches_the_glob`, `test_middle_double_star_alone_misses_depth_zero`)으로 pin 하고 있다 — 그런데 이번에 새로 등재한 `:(glob)` 매직에는 같은 처리를 하지 않았다. 대신 존재하는 유일한 방어는 `.claude/tests/test_required_check_skip_jobs.py` 의 `test_no_pathspec_is_a_dead_filter` 인데, 이건 Python 재구현 함수(`filter_covers_file`)가 "tracked 파일과 하나라도 매치하는가"만 확인할 뿐 "루트 밖은 매치하지 않는가"는 확인하지 않는다 — 즉 `:(glob)` 스트립 로직이 통째로 사라져도(예: 매직을 안 벗기고 리터럴로 취급) tracked 파일 중 우연히 콜론으로 시작하는 파일이 없는 한 dead-filter 로 걸리겠지만, "매직이 매치 범위를 좁힌다"는 원래 계약 자체는 어떤 테스트로도 관측되지 않는다. 이 저장소 자신의 문서(`.claude/tests/test_harness_checks_paths_coverage.py` 모듈 docstring)가 "이 클래스가 여섯 번 leak 됐다"고 적어 둔 바로 그 실패 모드(가드가 조용히 안 도는 것)를, 이번엔 반대 방향("가드가 의도보다 넓게/좁게 도는 것")으로 재현할 수 있는 자리인데 무방비다.
  - 제안: `test_ci_paths_changed.py` 의 `_RepoFixture` 를 재사용해 다음 두 케이스를 추가한다 — (1) 루트 `root.md` 변경 시 `:(glob)*.md` 로 `relevant=true`, (2) `nested/deep.md` 변경 시 `:(glob)*.md` 로 `relevant=false` (매직이 없었다면 `true` 가 됐을 케이스). 이렇게 하면 이 PR 의 존재 이유인 그 정확한 회귀를 미래에도 잡는다.

- **[WARNING]** `filter_covers_file` 에 새로 추가된 `:(glob)` 스트립 분기가 전용 boundary 테스트 없이 실 저장소 통합 테스트에만 얹혀 있다
  - 위치: `.claude/tests/test_harness_checks_paths_coverage.py:209-224` (`_GIT_GLOB_MAGIC` 상수 + `filter_covers_file` 수정), `FilterMatchBoundaryTest` 클래스는 `.claude/tests/test_harness_checks_paths_coverage.py:375`.
  - 상세: 같은 파일의 `FilterMatchBoundaryTest` 는 정확히 이런 함수-단위 경계 규칙(`*` 가 `/` 를 안 넘는다, 정확 매치, subtree vs bare dir 등)을 손으로 pin 하기 위해 존재하는 클래스인데, 이번에 추가된 유일한 신규 분기(`:(glob)` 접두 스트립)만 이 클래스에 테스트가 없다. 현재는 `harness-checks.yml` 자신의 `pathspecs:` 에 `:(glob)` 항목이 없어 `PathsCoverageTest`(실 저장소 기반)로도 이 분기가 전혀 실행되지 않는다 — `spec-link-checks.yml` 쪽 dead-filter 테스트(위 항목)를 통해서만 간접적으로 실행될 뿐이다. 결함이 생겨도 실패 메시지가 "pathspec 이 죽었다"로만 나와 원인(글롭 매직 처리 버그)을 즉시 지목하지 못한다.
  - 제안: `FilterMatchBoundaryTest` 에 `test_glob_magic_prefix_is_stripped_before_matching` 류를 추가 — `filter_covers_file(":(glob)*.md", "PROJECT.md")` 는 `True`, `filter_covers_file(":(glob)*.md", "spec/x.md")` 는 `False` 를 직접 pin.

- **[INFO]** `GOVERNANCE_SKIP_DIRS` 의 두 제외 대상 중 `node_modules` 는 회귀 fixture가 없다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:291` (`GOVERNANCE_SKIP_DIRS = new Set(["worktrees", "node_modules"])`), 관련 테스트: `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts:132-167` (`describe("governance scope — 제외 규칙"`).
  - 상세: 같은 테스트 파일의 주석(1520-1531번째 unified-diff 줄, 실 파일 기준 119-131)이 "실 저장소로 테스트하면 공허해진다"는 이유로 `mkdtemp` 런타임 fixture 를 도입한 논리는 `worktrees` 뿐 아니라 `node_modules` 에도 그대로 적용된다 — 이 체크아웃에는 `.claude/**` 하위에 `node_modules` 가 하나도 없다(`.claude/tools/mermaid-lint/` 는 `npm install` 전까지는 없음)는 것을 확인했다. 즉 `node_modules` 스킵은 지금 어떤 테스트로도 관측되지 않는 죽은 방어일 수 있다 — 실수로 지워져도 아무 테스트도 안 깨진다.
  - 제안: 기존 `beforeAll` fixture 에 `w(".claude/tools/x/node_modules/pkg/README.md", "[깨짐](./gone.md)\n")` 한 줄을 추가하고, `worktrees` 와 같은 패턴으로 "두 제외 대상이 실제로 존재한다(전제)" 단언에도 포함시킨다.

- **[INFO]** `findBrokenGovernanceLinks` 자체가 스코프 **안**의 깨진 링크를 잡는지 직접 pin 하는 fixture 가 없다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts:154-167` (`governance scope — 제외 규칙` 블록의 fixture).
  - 상세: 해당 fixture 는 스코프 **밖**(`nested/deep.md`, `.claude/worktrees/copy/...`)의 깨진 링크가 위반으로 안 올라오는 것만 증명하고, 스코프 **안**(`README.md`/`.claude/docs/policy.md`)에는 깨진 링크를 하나도 심지 않았다 — 그 두 파일은 유효한 링크만 담고 있다. 탐지 자체(`DEAD`/`ANCHOR` 판정 엔진인 `findBrokenLinksInFiles`)는 같은 파일의 scope 1/2 테스트로 이미 충분히 커버되므로 위험도는 낮지만, `findBrokenGovernanceLinks` 진입점 자체가 실제로 위반을 검출한다는 것은 지금 "실 저장소가 현재 깨끗하다"는 사실에만 의존한다(회귀 시점 = 이 항목이 실제로 뭔가를 잡을 때인데, 그 순간이 이 PR 안에는 없다).
  - 제안: 위 fixture 의 `README.md` 본문에 `[깨짐](.claude/docs/gone.md)` 한 줄을 추가해 `findBrokenGovernanceLinks(fixture)` 가 그것을 `DEAD` 로 잡는지 양성 케이스로 pin.

## 좋은 점 (회귀 테스트 관점)

- `spec-link-integrity.test.ts` 의 신규 scope 3 테스트는 "vacuous pass 방지" 패턴(개수 하한 단언)을 scope 1/2 와 동일하게 반복 적용했고, 실제로 실행해 18/18 PASS 를 확인했다.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 가 주장하는 "4건의 실제 깨진 링크"가 이번 PR 로 고쳐졌고, 신규 real-repo 테스트(`has no broken in-repo links or heading anchors in governance docs`)가 그 회귀를 그대로 고정한다 — 고친 파일 3개(`test-wrapper.md`, `spec-coverage/SKILL.md`, `PROJECT.md`)가 모두 이번 diff 에 포함되어 fix-and-pin 원칙을 지켰다.
- `scripts/check-doc-links.py` 삭제는 `.github/**`·`Makefile`·`package.json`·`.githooks/**` 어디에서도 참조되지 않음을 직접 grep 으로 확인했다 — 회귀 없는 안전한 삭제.
- `.claude/tests/test_harness_checks_paths_coverage.py` 의 `KNOWN_COVERAGE_DEPENDENCIES` / `test_each_historical_leak_is_load_bearing` 패턴(필터를 제거하면 실제로 uncovered 가 되는지까지 확인)은 뮤테이션 유효성까지 스스로 검증하는 좋은 설계로, 이번 PR 이 건드리지 않은 부분이지만 신규 로직에도 같은 수준을 요구할 근거가 된다(위 WARNING 두 건의 근거).
- `mkdtemp` 기반 fixture 로 전환한 결정(커밋된 fixture 로는 `.git/info/exclude` 의 `worktrees` 전역 규칙 때문에 CI 에서 공허해진다는 것을 실측하고 회피)은 이 프로젝트가 과거 반복적으로 겪은 "로컬 GREEN, CI 무관측" 클래스를 정확히 인지하고 설계한 것으로 판단된다.

## 요약

핵심 코드 변경(governance 문서 링크 가드 확장, `:(glob)` pathspec 매직 도입, 죽은 스크립트 삭제)은 실측(직접 실행)으로 전부 정상 동작을 확인했고 회귀도 없다. 다만 이번 PR 이 고치는 문제의 클래스 자체가 "가드가 조용히 원하는 범위를 못 지킨다"는 것인데, 그 새 방어선의 가장 예민한 지점 — `:(glob)` 매직이 실제 `git diff` 실행 경로에서 세그먼트 경계를 지키는지 — 를 pin 하는 실행 계층 테스트가 빠져 있다. 같은 저장소의 자매 테스트(`test_ci_paths_changed.py`)가 이미 이 정확한 패턴의 도구를 갖추고 있어 추가 비용은 낮다. 나머지 발견(`:(glob)` boundary 단위 테스트, `node_modules` 제외 fixture, governance 스코프 양성 검출 fixture)은 방어 심도(defense-in-depth) 성격의 INFO/WARNING 이며 현재 동작을 위협하지 않는다.

## 위험도

LOW–MEDIUM (기능은 정상 확인됐으나, 이 PR 의 존재 이유인 핵심 회귀 클래스를 실행 계층에서 pin 하는 테스트가 빠져 있어 향후 동일 클래스 재발 시 조용히 통과할 위험이 있음)
