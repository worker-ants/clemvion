# 신규 식별자 충돌 검토 (--impl-done, scope=.claude/docs)

검토 기준은 HEAD 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/nerv-cutover-1-69b98d`)와 `origin/main` 대조다. scope(`.claude/docs`) 델타는 0개 파일이다. 도입된 새 식별자는 구현 diff(`spec-links.ts`, `spec-link-integrity.test.ts`)와 같은 브랜치의 NERV 미러 하네스 파일들에서 추출했다.

### 발견사항

- **[INFO]** 미러 판정 술어가 세 곳에서 서로 다른 이름과 엄격도로 정의됨
  - target 신규 식별자: `inNervMirror()` / `NERV_MIRROR` (`codebase/frontend/src/lib/docs/__tests__/spec-links.ts:255-258`)
  - 기존 사용처: `_NERV_MIRROR_REL` / `is_nerv_mirror()` (`.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:200-205`), `KEY_RE` / `mirror_files()` (`.claude/tools/nerv-mirror/pull.py:48,140`)
  - 상세: 이름 충돌은 없다. TS 와 orchestrator 의 정규식은 의미가 같다(`README.md | CLE-*.md | CLE-*/`). pull.py 는 `KEY_RE` 전체 일치를 요구하고 `README.md` 를 `mirror_files` 에서 뺀다. TS·Python 쪽은 `CLE-[A-Z0-9-]+` 로 느슨하다. 현재 `spec/` 에는 `CLE-` 접두 파일이 미러뿐이라 오차는 없다.
  - 제안: 조치 불필요. 미러 키 형식이 바뀌면 세 곳을 함께 고친다는 점을 `NERV_MIRROR` 주석에 한 줄 남기면 좋다.

- **[INFO]** 새 우회 환경변수가 기존 `BYPASS_*_GUARD` 명명 관례와 다르고 `.claude/docs` 에 등재되지 않음
  - target 신규 식별자: `BYPASS_NERV_OWNED_PATHS` (`.claude/hooks/guard_nerv_owned_paths.py:24,84`)
  - 기존 사용처: `BYPASS_DEFAULT_BRANCH_GUARD` (`.claude/docs/worktree-policy.md:27,80`), `BYPASS_PLAN_GUARD` (`plan-lifecycle.md:62`), `BYPASS_REVIEW_GUARD` (`orchestrator-workflow-migration.md:231`)
  - 상세: 값이 겹치는 변수는 없다. 다만 기존 세 개는 `_GUARD` 접미어를 쓰고 정책 문서에 우회 방법이 적혀 있다. 새 변수는 접미어가 없고 어느 `.claude/docs` 문서에도 없다. 훅 docstring 과 테스트에만 있다.
  - 제안: 이름은 바꾸지 않아도 충돌 위험이 없다. `worktree-policy.md` 의 가드·우회 서술에 이 훅과 변수를 넣을 때 planner 턴에서 함께 처리한다.

- **[INFO]** `spec/README.md` 는 `spec/` 루트의 첫 README 이고 기존 index 규칙과 이름이 겹침
  - target 신규 식별자: `spec/README.md` (미러 생성물)
  - 기존 사용처: `spec-area-index.test.ts` 의 `INDEX_RE = /^(_.*overview|_layout|0-.*|README)\.md$/`
  - 상세: `origin/main` 에는 `spec/**/README.md` 가 하나도 없었다. 루트 진입 문서는 `0-overview.md`(`0-` 접두) 관례다. `README` 는 `INDEX_RE` 에 걸리지만 `collectSpecMarkdown` 이 이제 `spec/README.md` 를 뺀다. 그래서 `spec/` 루트 영역의 sibling·index 판정은 이전과 같다.
  - 제안: 조치 불필요. `inNervMirror` 를 우회하는 새 수집기가 생기면 이 README 가 index 로 잡힐 수 있다는 점만 기억한다.

- **[INFO]** `CLE-` 접두 네임스페이스를 스펙 키와 NERV Task ID 가 함께 씀
  - target 신규 식별자: 미러 파일 키 `CLE-*` (예: `CLE-TRIG`, `CLE-WF`)
  - 기존 사용처: NERV Task ID `CLE-T-…` (`.claude/docs/worktree-policy.md:132`, `.claude/tools/local_config.py:4`)
  - 상세: `origin/main` 의 `spec/`·`CLAUDE.md`·`PROJECT.md`·`codebase` 에 `CLE-` 가 다른 의미로 쓰인 곳은 없다. `spec/` 아래 옛 파일명 중 `CLE-*` 나 `README*` 도 없다. `pull.py` 의 `KEY_RE` 는 문법상 `CLE-T-0EZEYF` 도 받는다. 현재 `T` 영역 키가 없어 충돌하지 않는다.
  - 제안: 조치 불필요. 이 브랜치가 만든 충돌이 아니라 NERV 쪽 ID 체계에서 오는 것이다.

### 충돌 없음 확인 항목

- `inNervMirror`, `NERV_MIRROR`: 저장소 전체 grep 에서 이 diff 밖의 다른 의미 사용이 없다. 형제 `inGeneratedCatalog` 와 명명 스타일이 같다.
- 새 테스트 제목 `excludes the NERV spec mirror from scope` · `inNervMirror matches only mirror paths` 는 기존 제목과 겹치지 않는다.
- CI 잡 `spec-mirror-integrity` 는 `.github/workflows` 에서 유일하다. `test_workflow_yaml_structure.py` 에 대응 항목이 있다.
- 새 경로 `.claude/tools/nerv-mirror/pull.py` 는 기존 kebab 디렉터리 관례(`mermaid-lint`)와 맞다. `guard_nerv_owned_paths.py` 는 `guard_*` 훅 관례를 따른다. 기존 파일과 겹치지 않는다.
- frontmatter 수집기(`collectApplicableSpecs`)는 `INCLUDE_PREFIXES` 로 옛 디렉터리만 보므로 미러의 새 필드(`etag` · `mirror_sha256` · `source_paths`)와 부딪치지 않는다.

### 요약

새로 도입된 식별자(`inNervMirror`, `NERV_MIRROR`, `BYPASS_NERV_OWNED_PATHS`, `spec-mirror-integrity`, `spec/CLE-*`, `spec/README.md`, `.claude/tools/nerv-mirror/`)는 기존 사용처와 다른 의미로 겹치는 곳이 없다. Critical 과 Warning 은 없다. INFO 는 넷이다. 미러 판정 술어가 TS·Python·pull.py 에 따로 있다는 점, 새 BYPASS 변수가 `_GUARD` 접미어 관례와 문서 등재에서 빠진 점, `spec/README.md` 의 index 패턴 중첩, `CLE-` 접두 공유이다. 모두 현 시점 동작에 영향이 없다.

### 위험도
LOW
