# 신규 식별자 충돌 검토 (naming_collision)

검토 모드: `--impl-done`, scope `.claude/docs`, diff-base `origin/main`. 기준 트리는 `/Volumes/project/private/clemvion/.claude/worktrees/nerv-cutover-1-69b98d`(HEAD `b37c43b8f`)와 짝 planner 브랜치 `claude/nerv-cutover-1-docs-c46df0`을 합친 상태다. 이 브랜치가 `.claude/docs` 를 바꾸지 않아 scope 델타는 0이고, 짝 브랜치가 `plan-lifecycle.md` 와 `worktree-policy.md` 를 고친다. 신규 식별자는 두 브랜치 diff 와 미러 169편에서 뽑아 저장소 전체와 대조했다.

## 실측으로 충돌이 없다고 확인한 것

| 항목 | 방법 | 결과 |
|---|---|---|
| NERV Task 키 12개(`CLE-T-0EZEYF` 외) | NERV REST 읽기 조회 | 12개 모두 실재한다. 제목의 `[전환 N]` 이 훅 docstring 의 단계표와 일치한다 |
| 미러 스펙 키 | 169파일 대조 | 파일명 중복 0, frontmatter `id` 가 파일명과 다른 것 0, `id` 중복 0 |
| 요구사항 ID `REQ-<접두>-<nnn>` | 미러 169편 전수 | 2,733개 중 둘 이상의 파일에서 정의된 것 0. 옛 트리(`spec/` 비미러)에는 `REQ-` 형태가 0건이다 |
| `CLE-` 접두 | 저장소 전체 grep | 미러·미러 도구·두 브랜치 diff 밖에서 다른 뜻으로 쓰인 곳 0 |
| `R-12`(미러 `CLE-ENG-SPECEVIDENCE`) | 옛 `spec/conventions/spec-impl-evidence.md` 와 대조 | 옛 문서는 R-11 까지다. R-12 는 미러에만 있고 저장소 어디서도 id 로 인용하지 않는다 |
| 파일 경로 | `git ls-files`, origin/main | `spec/README.md`, `guard_nerv_owned_paths.py`, `.claude/tools/nerv-mirror/`, 두 테스트 파일 모두 origin/main 에 없던 이름이다. 훅은 `guard_*`, 도구 폴더는 `mermaid-lint` 와 같은 kebab 이름 관례를 따른다 |
| CI 잡 `spec-mirror-integrity` | 워크플로 전수 grep | 다른 잡 id 와 겹치지 않는다. `test_workflow_yaml_structure.py` 에 등재됐다 |
| 클래스명 | `.claude/tests` 전수 | `MirrorPredicateParityTest`, `NervMirrorStaysOutOfTheOldCorpusTest` 는 유일하다. `CheckTest` 는 `test_check_e2e_playwright_config.py` 와 이름이 같지만 별개 모듈이라 충돌하지 않는다 |
| 모듈명 | 테스트 로더 확인 | `nerv_mirror_pull_under_test`, `guard_nerv_owned_paths_under_test` 로 등록해 `sys.modules` 충돌이 없다 |
| 환경변수 `NERV_SERVER` · `NERV_TOKEN` · `NERV_PROJECT` | `local_config.py`, `.mcp.json` 판정, worktree-policy §8 과 대조 | 같은 뜻으로 재사용한다. 새 의미가 아니다 |
| MCP 도구명(`nerv_spec_get` 외 9개), `blocked_reason=spec_conflict` | NERV 플러그인 0.3.14 대조 | 모두 실재한다 |
| 미러 frontmatter `source_paths` · `mirror_sha256` · `etag` | 옛 `spec/`, `.claude/`, `codebase/frontend/src/lib/docs` grep | 기존 사용처 0 |
| 병렬 브랜치 | `git log --all -- <새 경로>` | 이 브랜치 커밋 6개 외에 같은 경로를 만든 브랜치가 없다 |
| 신규 API endpoint | 해당 없음 | 이 변경은 저장소 API 를 추가하지 않는다. `pull.py` 가 부르는 NERV 주소(`/api/v1/projects/...`, `/api/projects/...`)는 외부 서버 것이다 |

## 발견사항

### 발견사항
- **[WARNING]** 미러 frontmatter `status: "draft"` 가 옛 트리 `status` 와 같은 키에 다른 뜻을 싣는다
  - target 신규 식별자: 미러 169편 전부의 `status: "draft"`(NERV 문서 상태)
  - 기존 사용처: `spec/conventions/spec-impl-evidence.md` §3(`status` 는 `implemented | partial | spec-only | backlog | archived` 의 구현 상태)와 같은 문서의 `status:` 키 주석(spec 과 plan 이 `status` 를 다른 뜻으로 공유하며 문서 타입으로 가른다고 적었다)
  - 상세: 같은 `spec/` 아래에서 `status` 가 옛 트리에서는 구현 상태, 미러에서는 NERV 승인 상태다. 미러 값 `"draft"` 는 옛 enum 에 없고, `read_as: "approved"` 인 문서도 `draft` 로 적혀 있어 승인 여부를 오해하기 쉽다. 구현 상태는 본문 머리의 `> 구현 상태:` 줄에 따로 있다. 지금은 프런트 가드의 `INCLUDE_PREFIXES`, spec-coverage 의 INCLUDE 목록, review_guard 의 `code:` 파서가 미러를 보지 않거나 `code:` 만 읽어서 깨지지 않는다. 그러나 `spec/**` 전체를 훑어 `status` 를 읽는 다음 도구는 enum 오류를 낸다.
  - 제안: 키를 바꾸지 않는다(NERV 가 주는 값이다). `render_readme()` 템플릿(`spec/README.md`)에 "미러의 `status` 는 NERV 문서 상태이고 옛 트리의 구현 상태와 다르다. 구현 상태는 본문 머리 줄을 본다" 한 줄을 더한다. 옛 SoT 의 `status:` 키 주석에 세 번째 도메인을 적는 일은 NERV `CLE-ENG-SPECEVIDENCE` 초안 쪽에서 한다.

- **[WARNING]** 검토 루브릭이 옛 명명 컨벤션을 가리키는데 짝 PR 이 그 출처 절을 지운다
  - target 신규 식별자: 미러 경로 `spec/<영역 키>/<KEY>.md`, NERV 키 규칙 `CLE-<영역>-<슬러그>`(짝 PR 의 project-planner SKILL `## 트리 규칙`)
  - 기존 사용처: `.claude/agents/convention-compliance-checker.md:16`, `.claude/skills/code-review-agents/lib/role_instructions.py:243`("`_product-overview.md`·`0-` prefix 등 CLAUDE.md 의 명명 컨벤션"), `.claude/agents/naming-collision-checker.md:19`, `role_instructions.py:266`("새 spec 파일 경로/이름이 기존 명명 컨벤션을 깨거나 기존 파일과 겹치는가")
  - 상세: 루브릭이 말하는 "명명 컨벤션" 의 실제 정의는 `project-planner/SKILL.md` 의 `## 명명 컨벤션` 이다(CLAUDE.md 에는 그 절이 원래 없다). 짝 PR 은 이 절을 `## 트리 규칙` 으로 바꾸고 옛 규칙(`_product-overview.md`, `N-name.md`)을 지운다. 네 곳의 루브릭은 건드리지 않는다. 그 결과 루브릭의 참조가 어디도 가리키지 않게 되고, 새 스펙 파일인 `spec/CLE-*/CLE-*.md` 는 모두 "기존 명명 컨벤션을 깬다" 는 판정을 받을 수 있다. 이 보고서를 쓰는 checker 자신이 그 루브릭으로 돈다.
  - 제안: 네 곳의 문구를 "옛 트리는 `N-name.md` 등, NERV 스펙은 `CLE-<영역>-<슬러그>` 키와 미러 경로 `spec/<영역 키>/<KEY>.md`" 로 바꾼다. 에이전트 정의 두 개는 짝 planner PR 에, `role_instructions.py` 는 이 PR(developer 소유)에 넣는 것이 소유 경계에 맞다.

- **[INFO]** 사용자 가이드 누출 가드가 새 내부 식별자 모양을 모른다
  - target 신규 식별자: 경로 `spec/CLE-…`, 키 `CLE-*`, 요구사항 ID `REQ-<접두>-<nnn>`
  - 기존 사용처: `codebase/frontend/src/lib/docs/__tests__/no-internal-refs.test.ts` 의 `spec/ path leak`(`spec/(0-overview|conventions/|[1-9]\d*-)` 만 매칭)과 `internal anchor id`(`(CCH|R)-[A-Z]+-[0-9]+` 만 매칭)
  - 상세: 새 모양은 두 정규식 어디에도 걸리지 않는다. 지금 가이드 MDX 에는 0건이라 당장 샌 것은 없다. 전환 단계 4b(가이드 참조를 NERV 키로)가 키를 MDX 근처로 끌어오므로 본문 누출을 막는 장치가 필요해진다.
  - 제안: 4b 또는 4f Task 의 범위에 "`CLE-`/`REQ-` 모양과 `spec/CLE-` 경로를 누출 패턴에 더한다" 를 적는다. 지금 패턴 두 줄을 더해도 비용이 작다.

- **[INFO]** `BYPASS_NERV_OWNED_PATHS` 가 기존 `BYPASS_*_GUARD` 명명군과 어긋난다
  - target 신규 식별자: `BYPASS_NERV_OWNED_PATHS`
  - 기존 사용처: `BYPASS_DEFAULT_BRANCH_GUARD`, `BYPASS_PLAN_GUARD`, `BYPASS_REVIEW_GUARD`(전부 `_GUARD` 로 끝난다)
  - 상세: 이름이 겹치지는 않는다. 접미사 규칙만 다르다. 이 브랜치의 훅·테스트·문서에서 7줄, 짝 PR 문서에서 추가로 쓰고 있다.
  - 제안: 그대로 둔다. 바꾼다면 `BYPASS_NERV_OWNED_PATHS_GUARD` 로 한 번에 바꾼다. 훅의 stderr 안내와 짝 PR 의 `§5.1` 이 같은 이름을 쓰는지만 유지하면 된다.

- **[INFO]** `.nerv/cache/mirror/` 가 NERV 플러그인이 소유한 네임스페이스 안에 있다
  - target 신규 식별자: `.nerv/cache/mirror/<KEY>.md`(`pull.py --task` 의 원문 캐시)
  - 기존 사용처: 플러그인 0.3.14 가 쓰는 `.nerv/cache/claim.json`, `context-pack.json`, `specs/<spec_key>@v<n>.md`. 플러그인은 `NERV_CACHE_DIR`(기본 `.nerv/cache`)을 따른다. `.gitignore` 는 `.nerv` 로 막고, worktree-policy §8 은 `.nerv/` 를 "플러그인 캐시 · 오프라인 큐" 로 적는다
  - 상세: 지금은 충돌이 없다(플러그인 쪽에 `mirror` 문자열이 없다). 다만 `pull.py` 는 `NERV_CACHE_DIR` 를 무시하고 경로를 고정한다. 플러그인의 `specs/` 와 같은 종류의 본문 캐시가 형제 폴더에 따로 생기고, §8 표는 이 사용을 말하지 않는다. 캐시를 잃으면 조건부 요청을 안 할 뿐이라 영향은 작다.
  - 제안: §8 의 `.nerv/` 행에 "미러 도구 캐시(`cache/mirror/`, 지워도 된다)" 를 덧붙이거나, `pull.py` 가 `NERV_CACHE_DIR` 를 따르게 한다. 둘 중 하나면 된다.

- **[INFO]** 결정 번호 `D1`~`D11` 이 저장소 안에 정의가 없고 worktree-policy 의 Layer `D` 와 글자가 겹친다
  - target 신규 식별자: "결정 D1·D2·D3·D4"(`pull.py`), "결정 D3·D8·D10"(짝 PR 의 developer SKILL, CLAUDE.md, consistency-checker SKILL)
  - 기존 사용처: `.claude/docs/worktree-policy.md` §5 의 "D. PreToolUse (bash)" 와 "D 의 read/silent 정책". 짝 PR 의 `§5.1` 이 바로 그 아래에 들어간다
  - 상세: `D<n>` 이 가리키는 결정 기록은 저장소에서 찾을 수 없다(plan, spec, 미러 grep 0건). 읽는 사람은 정의를 못 찾고, §5 근처에서는 Layer D 로 오독할 수 있다. `pull.py` 는 D1·D2·D4 의 내용을 주석에 풀어 적어 읽힌다. 짝 PR 문서는 번호만 적은 곳이 있다.
  - 제안: 번호를 쓸 때 "NERV 결정 D3" 로 출처를 붙이고, 처음 나오는 문서(CLAUDE.md)에 결정 목록의 위치(NERV 의 어느 Task 또는 문서)를 한 번 적는다.

- **[INFO]** `area` 와 `영역` 이 두 가지 뜻으로 쓰인다
  - target 신규 식별자: `pull.py` 의 `Doc.area`, `mirror_relpath(key, area)`, `area_map()`(미러 폴더), 문서의 `spec/<영역 키>/`
  - 기존 사용처: `pull.py` 의 `folder_of(key, type_, area)`(frontmatter `area`), 옛 문서의 `spec/<영역>/`(숫자 접두 폴더), 프런트 `spec-area-index.test.ts` 의 `Area`
  - 상세: 모듈 docstring 이 "이 도구의 `area` 인자는 미러 폴더를 뜻한다" 고 밝혀 두었고 동작은 맞다. 그래도 같은 식별자가 함수에 따라 frontmatter 값 또는 폴더를 가리킨다. 문서의 `<영역>` 과 `<영역 키>` 는 한 단어 차이로 옛 트리와 새 미러를 가른다.
  - 제안: 코드는 폴더 쪽을 `folder` 로 바꾸면 docstring 의 예외 문장이 필요 없다(선택). 문서는 지금처럼 "키" 를 붙이는 규칙을 유지한다.

- **[INFO]** "mirror" 어휘와 `--spec` 플래그가 기존 쓰임과 겹친다
  - target 신규 식별자: CI 잡 `spec-mirror-integrity`, 폴더 `nerv-mirror/`, `inNervMirror` · `is_nerv_mirror` · `NERV_MIRROR`, `pull.py --spec <KEY>`, `--check`
  - 기존 사용처: CI 잡 `mirror-guard`("마커 SoT 미러 재발 가드", `.github/workflows/repo-guards.yml:62`), `masked-marker-mirror*.ts`, code-review README 와 `router_safety.py` 의 "미러링" 표, consistency 오케스트레이터의 `--spec <path>`(모드 선택)
  - 상세: 이름이 같은 것은 없다. 새 이름은 모두 `spec-` 또는 `nerv-` 한정어가 붙어 구분된다. `--spec` 은 `pull.py` 에서는 키, 오케스트레이터에서는 초안 경로를 받는다. 두 도구가 다르므로 실행 충돌은 없고, 짝 PR 의 developer SKILL 이 인접 줄에서 둘을 함께 적는다.
  - 제안: 문서에서 "mirror-guard" 를 한정어 없이 쓰지 않는다. `--spec` 을 적을 때는 항상 전체 명령(`pull.py --task … --spec <KEY>`)으로 쓴다.

- **[INFO]** `.claude/docs/README.md` 색인 행이 새 절의 범위를 말하지 않는다
  - target 신규 식별자: `worktree-policy.md §5.1`(NERV 소유 경로 가드)
  - 기존 사용처: `.claude/docs/README.md` 표의 worktree-policy 행("the 4-layer default-branch guard")
  - 상세: 색인은 이 문서를 브랜치 가드의 SSOT 로 소개한다. §5.1 은 브랜치와 무관한 경로 가드라 이 설명 밖에 있다. 절 번호와 제목("4-layer 와 별개")은 충돌 없이 구분돼 있다.
  - 제안: 짝 PR 에서 그 행에 "NERV-owned path guard" 를 덧붙인다.

### 요약
신규 식별자와 기존 사용처가 실제로 부딪히는 곳은 없다. 미러 키 169개, 요구사항 ID 2,733개, 파일 경로, CI 잡 이름, 환경변수, Task 키 12개, MCP 도구명을 전수 또는 실조회로 대조했고 중복이나 잘못된 참조가 나오지 않았다. 환경변수 `NERV_*` 는 기존과 같은 뜻으로 재사용된다. 주의할 곳은 같은 이름에 다른 뜻이 실리는 두 군데다. 미러의 `status: "draft"` 는 옛 트리의 구현 상태 enum 과 값 영역이 달라 README 에 한 줄이 필요하다. 검토 루브릭 네 곳은 짝 PR 이 지우는 "명명 컨벤션" 절을 가리켜, 이후 `CLE-*` 파일이 일괄로 위반 판정을 받을 수 있다. 나머지는 명명 일관성과 장래 누출 가드에 관한 INFO 다.

### 위험도
LOW

STATUS=success ISSUES=9 PATH=/Volumes/project/private/clemvion/.claude/worktrees/nerv-cutover-1-69b98d/review/consistency/2026/10/01/09_05_51/naming_collision.md
