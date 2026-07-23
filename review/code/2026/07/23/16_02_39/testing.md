# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** `fnmatch` 기반 워크스페이스 매칭이 pnpm 의 glob 의미론과 달라 `*` 가 경로 구분자(`/`)를 넘어 매칭됨 — 이 가드 자신이 방지하려는 "영구 무신호" 를 classifier 내부에서 재현할 수 있는 미검증 경계
  - 위치: `.claude/tests/test_dependabot_npm_coverage.py` L91 (`_independent_trees()` 내 `if any(fnmatch.fnmatch(pkg_dir, g.rstrip("/")) for g in globs):`)
  - 상세: `pnpm-workspace.yaml` 의 `codebase/packages/*` 글롭은 pnpm(micromatch 기반)에서 1단계 하위 디렉터리만 매칭하지만, 표준 라이브러리 `fnmatch.fnmatch` 는 `*` 를 `.*` 로 변환해 `/` 를 포함한 임의 문자열과 매칭한다. 직접 검증:
    ```
    >>> fnmatch.fnmatch('codebase/packages/foo/bar', 'codebase/packages/*')
    True
    ```
    즉 미래에 `codebase/packages/<pkg>/<sub>/package.json` 처럼 2단계 이상 중첩된 독립 npm 트리가 생기면, 실제로는 `pnpm audit` 범위 밖(pnpm 자체는 이 경로를 워크스페이스로 인식하지 않음)인데도 이 가드의 classifier 는 "워크스페이스 커버됨"으로 오분류해 `_independent_trees()` 에 잡히지 않는다. `test_dependabot_npm_coverage.py` 자신이 막으려는 "독립 트리가 dependabot 에 미등록인 채 영구 무신호" 사고를 classifier 레벨에서 재생산할 수 있는 구조다.
  - 제안: `_independent_trees()` 를 pnpm 이 실제로 쓰는 glob 의미론(단일 `*` 는 `/` 미포함, `**` 만 재귀)에 맞게 정밀화하거나, 최소한 이 경계를 고정하는 유닛 테스트(합성 fixture — `tmp_path` 에 임시 `pnpm-workspace.yaml`/tracked-path 리스트를 만들어 `codebase/packages/foo/sub/package.json` 형태가 "독립"으로 분류되는지 직접 단언)를 추가. 현재는 저장소에 그런 중첩 트리가 없어 실패로 드러나지 않는 잠재 결함(latent, 미노출)이다.

- **[WARNING]** 손수 짠 YAML 파서(`_workspace_globs`, `_dependabot_npm_directories`)가 실제 저장소 파일에 대해서만 검증되고, 파서 자체의 엣지 케이스(주석 위치·따옴표 스타일·`directory:` 줄 인라인 코멘트 등)를 고정하는 fixture 기반 유닛 테스트가 없음
  - 위치: `.claude/tests/test_dependabot_npm_coverage.py` L50-65 (`_workspace_globs`), L68-80 (`_dependabot_npm_directories`)
  - 상세: 두 함수 모두 모듈 레벨 상수(`WORKSPACE_YAML`, `DEPENDABOT_YAML`)를 직접 읽어 인자로 경로/텍스트를 주입할 수 없다(테스트 용이성 갭 — 의존성 주입 부재). 그 결과 `ParserSanityTest` 는 "현재 이 저장소 파일을 잘못 없이 파싱하는가"만 pin 하고, 파서의 정규식 경계(예: `directory: "/x"  # comment` 처럼 값 뒤에 인라인 주석이 붙으면 `^\s*directory:\s*["']?...["']?\s*$` 앵커가 매칭 실패해 그 항목이 조용히 `dirs` 집합에서 빠짐 — 직접 재현 확인함)는 어떤 테스트로도 고정돼 있지 않다. 다행히 이 경우는 "빈 결과로 무언 통과"가 아니라 `test_every_independent_npm_tree_is_registered` 가 "미등록"으로 (오탐) 실패하므로 fail-loud 이긴 하지만, 원인 파악에 혼선을 준다.
  - 제안: 두 파서 함수가 경로 대신 텍스트(`str`)를 받도록 시그니처를 바꿔 테스트에서 합성 문자열로 파서 경계(주석·따옴표·정렬 변형)를 직접 검증. 최소한 인라인 주석 케이스 1건은 추가할 가치가 있음.

- **[WARNING]** I3(e2e.yml `paths-ignore` 누락) 수정에는 같은 PR 의 자매 항목 W5(dependabot coverage)와 달리 회귀 가드가 없음 — PROJECT.md §e2e 면제 화이트리스트 ↔ 실제 워크플로 `paths-ignore`/`paths` 목록 간 drift 재발을 막는 자동 테스트 부재
  - 위치: `.github/workflows/e2e.yml` L8-21 (주석으로만 "mirrors PROJECT.md §e2e 면제 화이트리스트" 명시), `.github/workflows/harness-checks.yml` paths 목록
  - 상세: 이번에 고친 결함(“`.github/**` 가 e2e 면제 화이트리스트에 있는데 `e2e.yml` `paths-ignore` 에는 없어서 CI 정의 변경만으로도 30분짜리 e2e 가 낭비된다”)은, 이 저장소가 이미 여러 번 겪은 "SoT 문서 ↔ 실제 설정 파일 수동 동기화가 drift" 클래스(harness-checks.yml 자체 주석이 언급하는 `.githooks/**`·`.claude/_shared/**` 사례와 동일 계열)다. 그런데 같은 PR 에서 W5 는 이 계열을 막는 전용 가드(`test_dependabot_npm_coverage.py`)를 새로 만든 반면, I3 는 값만 고치고 상응하는 가드는 추가하지 않았다. PROJECT.md 목록이 갱신되거나 `e2e.yml`/`harness-checks.yml` 의 paths-ignore/paths 목록이 다시 어긋나도 이를 잡아줄 자동 테스트가 없다.
  - 제안: PROJECT.md §e2e 면제 화이트리스트 항목과 `e2e.yml` `paths-ignore` 목록(및 `pull_request`/`push` 양쪽)의 최소 부분집합 관계를 검증하는 유닛 테스트를 `test_dependabot_npm_coverage.py` 와 같은 패턴(stdlib 파서 + sanity pin)으로 추가 고려. 지금 당장 필요하지 않다면 최소한 후속 항목으로 backlog 에 명시.

- **[INFO]** 파서 정규식이 `directory:` 값 줄에 인라인 주석이 붙으면 해당 항목을 조용히 누락시킴(위 WARNING 과 동일 근본 원인의 구체 사례) — fail-loud 이므로 안전성 문제는 아니나, 향후 dependabot.yml 편집자가 주석을 붙이면 혼란스러운 오탐(false "미등록") 실패 메시지를 받게 됨
  - 위치: `.claude/tests/test_dependabot_npm_coverage.py` L77 (`d = re.search(r"""^\s*directory:\s*["']?([^"'#\n]+?)["']?\s*$""", block, re.M)`)
  - 상세: 직접 재현 — `directory: "/.claude/tools/mermaid-lint"  # note` 형태 텍스트를 이 정규식에 넣으면 매칭 실패(`None`) 확인함. 현재 실제 `dependabot.yml` 에는 인라인 주석이 없어 드러나지 않는다.
  - 제안: 정규식에 `(?:\s*#.*)?` 트레일링 주석 허용을 추가하거나, 최소 docstring/주석으로 "인라인 주석 미지원" 제약을 명시.

- **[INFO]** 새 테스트들은 mock 없이 실제 저장소 파일(`pnpm-workspace.yaml`, `.github/dependabot.yml`)과 `git ls-files` 서브프로세스를 직접 읽는 integration 성격 — 이 파일이 원래 의도한 "drift guard" 목적(harness 의 `test_doc_sync_matrix` 류와 동일 패턴)에는 적절하며, `ParserSanityTest` 3건이 "빈 결과 → 항진명제" 위험을 잘 차단함. 테스트 간 공유 상태·순서 의존 없음(격리 양호). 다만 저장소 실제 상태에 결합되므로, 무관한 변경(예: 다른 팀원이 새 독립 npm 트리를 추가하고 등록을 잊음)에도 이 테스트가 실패할 수 있음 — 이는 가드의 의도된 동작이라 결함 아님.
  - 위치: 파일 전체 (`ParserSanityTest`, `DependabotCoverageTest`)
  - 제안: 없음(설계 의도에 부합). 문서화만 유지.

- **[INFO]** `test_dependabot_npm_coverage.py` 는 `harness-checks.yml` 의 `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 로 자동 discover 되고, 이번 diff 가 `harness-checks.yml` paths 에 `.github/dependabot.yml`/`pnpm-workspace.yaml` 을 동반 등재해 "가드 파일만 고친 PR 에서 가드가 안 도는" 자기 회귀 클래스도 막음. 로컬 실행(`python3 -m unittest discover -s .claude/tests -p 'test_dependabot_npm_coverage.py'`)으로 5건 전부 통과 확인함 — 새 코드 자체는 현재 저장소 상태에 대해 정상 동작.

## 요약

새로 추가된 `test_dependabot_npm_coverage.py` 는 목적(pnpm 워크스페이스 밖 npm 트리의 dependabot 등록 강제)에 맞게 양방향(미등록/stale 등록) 케이스와 파서 vacuity 가드를 갖춘 잘 설계된 harness 가드이며, CI 트리거(`harness-checks.yml` paths) 동반 등재도 정확하다. 다만 손수 짠 파서(`fnmatch`, YAML 정규식)는 실제 저장소 파일에 대해서만 검증되어 있어 fixture 기반 경계 테스트가 없고, 특히 `fnmatch` 가 pnpm 의 glob 의미론과 달리 `*` 를 경로 구분자까지 매칭한다는 점은 이 가드 자체가 막으려는 "독립 트리 영구 무신호" 를 classifier 내부에서 재현할 수 있는 잠재 결함이다(현재 저장소 구조에서는 미노출). 또한 같은 PR 에서 함께 고쳐진 e2e.yml `paths-ignore` 결함(I3)은 W5 와 달리 회귀 가드가 없어, PROJECT.md 화이트리스트와 실제 CI 트리거 간 drift 가 다시 조용히 발생할 여지가 남아 있다. 전반적으로 CRITICAL 수준의 결함은 없으나, 가드의 목적을 감안하면 두 WARNING(특히 fnmatch 경계) 은 후속 커밋에서 다루는 것이 바람직하다.

## 위험도
LOW
