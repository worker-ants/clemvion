# Requirement Review — doclink-guard-scope

## 발견사항

- **[WARNING] `[SPEC-DRIFT]` `spec-impl-evidence.md §4.2` 표가 신규 scope 3(거버넌스 문서)를 반영하지 않음**
  - 위치: `spec/conventions/spec-impl-evidence.md:132` (§4.2 표, `spec-link-integrity.test.ts` 행)
  - 상세: 이번 PR 은 `findBrokenGovernanceLinks`/`collectGovernanceMarkdown` (`codebase/frontend/src/lib/docs/__tests__/spec-links.ts:281-328`)로 가드에 **scope 3(루트 `*.md` + `.claude/**.md`)** 를 신설했고, `PROJECT.md` §문서 링크 검증 절(`PROJECT.md:345-352`)도 "검사 스코프 3가지"로 갱신해 이를 명시했다. 그런데 `PROJECT.md` 는 그 스코프 정의의 SoT 로 `spec/conventions/spec-impl-evidence.md §4.2` 를 인용하는데, 정작 그 문서의 §4.2 표는 여전히 "**(1)** `spec/**.md` 본문, **및 (2)** codebase 소스" 두 개만 서술하고 scope 3 언급이 없다. 코드·PROJECT.md·spec SoT 세 곳 중 spec SoT 만 낡아, SoT 를 읽는 사람이 실제 가드 동작(58개 거버넌스 파일도 검증됨)을 알 수 없다. `plan/in-progress/spec-sync-external-interaction-api-gaps.md:838-840` 의 집행 항목 (a)~(e) 목록에도 이 §4.2 표 갱신이 빠져 있어, PR 자체의 체크리스트에서도 누락으로 확인된다.
  - 판단 근거: 코드 쪽은 의도적이고 well-tested(vitest 18건 통과, 실측 근거 명시)인 합리적 확장이라 "코드가 틀림" 이 아니다 — spec 본문 갱신 누락에 해당한다.
  - 제안: 코드는 유지. `spec/conventions/spec-impl-evidence.md §4.2` 표의 `spec-link-integrity.test.ts` 행에 "**(3)** 거버넌스 문서(루트 `*.md` 비재귀 + `.claude/**.md`, `.claude/worktrees/`·`node_modules` 제외)" 를 추가 반영 (project-planner 턴 필요).

- **[WARNING] `:(glob)` 매직 스트립 로직의 전용 boundary 테스트 부재**
  - 위치: `.claude/tests/test_harness_checks_paths_coverage.py:212-224` (`filter_covers_file`, `_GIT_GLOB_MAGIC` 처리)
  - 상세: `filter_covers_file` 에 `:(glob)` 접두 스트립이 추가됐지만, 같은 파일의 `FilterMatchBoundaryTest` (기존에 `test_double_star_crosses_slashes`·`test_single_star_does_not_cross_a_slash` 등으로 각 분기를 독립 pin 하던 클래스)에는 이 신규 분기를 겨냥한 케이스가 없다. 현재는 `test_required_check_skip_jobs.py::DeadFilterTest.test_no_pathspec_is_a_dead_filter` 가 실제 저장소의 `spec-link-checks.yml` pathspecs(`:(glob)*.md` 포함)를 통해 **간접적으로만** 이 로직을 통과시킨다 — 실행해 통과함을 확인했다(로컬 재현, 25+17건 전부 green). 그러나 접두 오탈자(`:(Glob)`)·중간 등장·접두만 있고 패턴이 없는 경우 등은 어떤 테스트로도 고정돼 있지 않다.
  - 제안: `FilterMatchBoundaryTest` 에 `filter_covers_file(":(glob)*.md", "PROJECT.md") == True` 및 스트립 전 리터럴(`":(glob)*.md"` 자체를 경로로 오인하지 않음) 같은 직접 케이스 추가 권장 (testing reviewer 영역과 중복 가능).

## 실측 확인 (변경 정합성)

- `pnpm vitest run src/lib/docs/__tests__/spec-link-integrity.test.ts` → 18/18 통과(governance 신규 5건 포함) — 4건 사전 등재된 깨진 링크(`.claude/docs/test-wrapper.md:25`, `.claude/skills/spec-coverage/SKILL.md:75`, `PROJECT.md:50`, `PROJECT.md:246`)가 diff 내 각 파일 수정으로 모두 해소됨을 파일시스템 대조 + 테스트 실행 양쪽으로 확인.
- `python3 -m unittest discover -s .claude/tests -p 'test_harness_checks_paths_coverage.py'` (25건) · `-p 'test_required_check_skip_jobs.py'` (17건) 모두 통과 — `spec-link-checks.yml` 의 신규 `pathspecs`(`:(glob)*.md`, `.claude/**`)가 `test_no_pathspec_is_a_dead_filter`·`test_repo_guards_pathspec_covers_every_stack` 등 기존 가드를 깨지 않음을 확인.
- `git ls-files -- '*.md'` = 17,202 vs `git ls-files -- ':(glob)*.md'` = 6(`CHANGELOG.md`·`CLA.md`·`CLAUDE.md`·`LICENSE-COMMERCIAL.md`·`PROJECT.md`·`README.md`) — 워크플로 주석·plan 문서·`test_harness_checks_paths_coverage.py` 주석이 공통으로 주장하는 "글롭 매직 없으면 17,202개, 있으면 6개" 수치를 그대로 재현해 실측 근거가 정확함을 확인.
- `scripts/check-doc-links.py` 삭제 후 `.githooks/`·`.github/`·`Makefile`·`.claude/` 전체에 잔존 호출부 없음을 grep 으로 확인(과거 `review/**`·`plan/**` 문서 안 역사적 언급만 남음, 코드/CI 경로 아님).
- `collectGovernanceMarkdown`/`GOVERNANCE_SKIP_DIRS`(`spec-links.ts:291-310`)가 의존하는 `walkTree`(`tree-walk.ts`)의 `recurse:false`·`skipDir` 시맨틱을 직접 열어 확인 — 루트 비재귀 + `.claude/worktrees`·`node_modules` 서브트리 스킵이 설계 의도대로 구현됨.

## 요약

이 diff 는 doc-link 무결성 가드에 "거버넌스 문서"(루트 `*.md` + `.claude/**.md`) 스코프를 신설하고, 배선되지 않던 열등 중복 스크립트(`scripts/check-doc-links.py`)를 삭제하며, 새 스코프가 CI 에서 실제로 트리거되도록 `spec-link-checks.yml` pathspecs 와 하네스 `:(glob)` 매직 인식을 함께 갱신한 일관된 작업이다. 기능 완전성·엣지 케이스(비재귀 루트, worktrees 사본 배제, mkdtemp 런타임 fixture로 gitignore 전제 회피)·반환값·에러 시나리오 모두 vitest/unittest 로 직접 재현·확인했으며 실제 회귀(깨진 링크 4건)가 이 diff 로 해소됨을 파일시스템 대조로 검증했다. 유일한 실질 결함은 spec fidelity 축이다 — `PROJECT.md` 가 SoT 로 지목하는 `spec/conventions/spec-impl-evidence.md §4.2` 표가 신규 scope 3 를 반영하지 못해 코드/PROJECT.md/spec SoT 3자 간 서술이 어긋나는 SPEC-DRIFT 이며, PR 자신의 집행 체크리스트에도 이 갱신이 누락돼 있다. 부차적으로 신규 `:(glob)` 매직 스트립 로직에 대한 전용 boundary 단위테스트가 없어(간접 통합 테스트로만 커버) 회귀 검출력이 다소 약하다.

## 위험도

LOW
