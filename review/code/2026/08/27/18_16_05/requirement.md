# 요구사항(Requirement) Review

## 컨텍스트

이 diff 는 이전 리뷰 라운드(`review/code/2026/08/27/17_52_44`, RISK=LOW, Critical 0, WARNING 3)의
fix 반영분을 포함한다. WARNING 3건 전부의 실제 반영 여부를 소스·spec·테스트 실행으로
직접 재검증했다.

- **W1 (SPEC-DRIFT, `spec-impl-evidence.md §4.2`)** — `spec/conventions/spec-impl-evidence.md:132`
  에 scope (3) 거버넌스 문서 서술이 실제로 추가됨을 확인. `PROJECT.md`·`spec-link-integrity.test.ts`·
  `spec-links.ts` 3곳이 인용하는 SoT 표와 코드가 다시 일치한다. **해소 확인**.
- **W2 (`filter_covers_file` boundary 테스트 부재)** — `test_harness_checks_paths_coverage.py`
  `FilterMatchBoundaryTest.test_git_glob_magic_is_stripped_and_keeps_segment_bounds` 추가 확인.
  `_GIT_GLOB_MAGIC` 스트립 로직 두 줄을 직접 삭제하는 뮤테이션으로 이 테스트가 RED 로 떨어짐을
  실측 재현(아래 검증 로그) — 회귀를 실제로 잡는 non-vacuous 테스트임을 확인. **해소 확인**.
- **W3 (실행 계층 `:(glob)` pin 부재)** — `test_ci_paths_changed.py` 에
  `test_git_glob_magic_confines_star_to_the_root_segment` + 대조군
  `test_without_the_magic_the_star_crosses_slashes` 추가 확인. `_RepoFixture` 를 재사용해 실제
  `git diff`(via `scripts/ci-paths-changed.sh`) 계층에서 세그먼트 경계를 pin. **해소 확인**.

## 검증 방법 (재현)

- `pnpm vitest run src/lib/docs/__tests__/spec-link-integrity.test.ts` (frontend) → **19/19 PASS**
  (신규 6케이스: governance vacuous-pass 가드 2 + `mkdtemp` 런타임 fixture 4).
- `python3 -m unittest test_ci_paths_changed test_harness_checks_paths_coverage
  test_required_check_skip_jobs` → **20 + 26 + 17 = 63/63 PASS**.
- **뮤테이션 재현**: `filter_covers_file` 의 `_GIT_GLOB_MAGIC` 스트립 두 줄을 주석 처리 →
  `test_no_pathspec_is_a_dead_filter`(workflow=`spec-link-checks.yml`, pathspec=`:(glob)*.md`)
  및 `test_git_glob_magic_is_stripped_and_keeps_segment_bounds` **둘 다 즉시 FAIL**로 전환됨을
  확인 후 원복(git diff 로 clean 상태 재확인). 이 두 테스트가 회귀를 실제로 잡는다는 것을
  직접 증명했다 — GREEN 만으로 끝내지 않았다.
- `grep -rn "check-doc-links"` 전체 저장소 — 남은 참조는 전부 `plan/complete/**`·
  `plan/in-progress/**`·`review/**` 의 시점 기록(역사적 언급)뿐, `.github/**`·`Makefile`·
  `.githooks/**`·활성 코드 경로에 잔존 참조 없음. 삭제가 안전하다는 diff 의 주장과 일치.
- `scripts/ci-paths-changed.sh` 를 직접 읽어 pathspec 인자가 `git diff --name-only … -- "$@"`
  로 **가공 없이** 전달됨을 확인 — `:(glob)*.md` 가 실행 계층까지 그대로 도달한다는 diff 의
  핵심 주장과 일치.
- `.github/workflows/_changed-paths.yml` 의 `read` 루프가 `#` 로 시작하는 줄만 주석으로 버리고
  나머지는 그대로 배열 원소로 넘김을 확인 — `spec-link-checks.yml` 에 추가된 두 pathspec
  (`:(glob)*.md`, `.claude/**`) 위의 3줄 근거 주석이 pathspec 오염 없이 정상적으로 걸러짐.
- `CLAUDE.md` 에 `worktree-기반-작업-정책` 헤딩이 실제로 **존재하지 않음**을 grep 으로 확인 —
  "존재한 적 없는 앵커"라는 diff 의 주장과 일치. `.claude/docs/worktree-policy.md` 로 정정된
  링크는 실재 파일을 가리킴.
- `.claude/test-stages.sh.example` 이 `.claude/` 레벨에 실재하고 `.claude/docs/` 레벨에는
  없음을 확인 — `test-wrapper.md` 의 `../test-stages.sh.example` 정정이 정확함.
- `registry.test.ts` 의 `"모든 .mdx frontmatter 의 spec/code 경로가 실재해요"` 테스트가
  삭제된 `check-doc-links.py::check_mdx_frontmatter` 와 동일 역할(spec:/code: 경로 실재 검증)을
  이미 수행하고 있음을 직접 읽어 확인 — "고유 기능 0"이라는 RESOLUTION.md 의 뮤테이션 근거
  주장이 타당함을 재확인.

## 발견사항

없음 — Critical/Warning 없음.

## 참고 (INFO)

- **[INFO]** `spec-links.ts` 의 `GOVERNANCE_SKIP_DIRS` JSDoc 주석은 `"worktrees"` 항목의
  제외 근거(저장소 사본 → 중복 스캔)만 설명하고 `"node_modules"` 항목의 근거는 별도로
  적혀 있지 않다 (자명하다고 판단했을 수 있으나 이 저장소는 "이름 없는 결정" 을 반복 지적해
  온 관례가 있음).
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:286-291` (`GOVERNANCE_SKIP_DIRS`
    선언부 JSDoc)
  - 제안: 조치 불필요(자명한 제외 규칙). 다음 편집 때 한 줄 추가해도 좋음.
- **[INFO]** `PROJECT.md` §문서 링크 검증의 "검사 스코프 3가지" 요약(345-351행)은
  `.claude/worktrees/` 제외만 언급하고 `spec-impl-evidence.md §4.2` 본문이 함께 서술하는
  `node_modules` 제외는 생략했다. `PROJECT.md` 는 요약이고 SoT 는 spec 문서로 명시돼 있어
  (`spec-impl-evidence.md §4.2` 링크 동반) 불일치라기보다 요약 축약으로 판단.
  - 위치: `PROJECT.md:350-351`
  - 제안: 조치 불필요(선택적 보강 대상).

## 요약

이전 라운드(`17_52_44`)에서 지적된 WARNING 3건(SPEC-DRIFT §4.2 표 미반영, `:(glob)` 매직
스트립 boundary 테스트 부재, 실행 계층 pin 부재) 전부가 이번 diff 에서 실제로 반영됐음을
소스 대조·spec 본문 대조·테스트 실행(vitest 19/19, unittest 63/63)·뮤테이션 재현(두 신규
테스트가 실제로 회귀를 잡는지 RED 확인 후 원복)으로 직접 검증했다. `scripts/check-doc-links.py`
삭제는 저장소 전역 grep 으로 활성 참조 없음을 확인했고, 그 스크립트의 MDX frontmatter 검증
기능은 이미 배선된 `registry.test.ts` 가 중복 수행하고 있어 기능 손실이 없다. 신규
`collectGovernanceMarkdown`/`findBrokenGovernanceLinks` 는 기존 `collectSpecMarkdown`/
`findBrokenLinks` 쌍과 동일한 공유 코어(`findBrokenLinksInFiles`)를 옵션으로 분기해 재사용하고,
`walkTree` 의 `recurse`/`skipDir` 계약을 정확히 따른다. 링크 3건(`test-wrapper.md`·
`spec-coverage/SKILL.md`·`PROJECT.md`)의 정정도 파일시스템 대조로 정확함을 확인했다. spec
fidelity 축(SPEC-DRIFT)은 이번 diff 자체에 planner 턴 산출물로 포함되어 완전히 해소됐다.
Critical/Warning 없음, INFO 2건은 모두 조치 불요 수준의 사소한 문서 완결성 관찰이다.

## 위험도

NONE
