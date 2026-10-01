# 부작용(Side Effect) 리뷰 — NERV 스펙 미러 도입 (전환 1)

### 발견사항

- **[WARNING]** `spec/` 편집 가드가 이 저장소가 아니라 세션이 건드리는 모든 git 체크아웃에 적용된다
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:62-80` (`checkout_root` · `owned_root`), 배선은 `.claude/settings.json:36-39`
  - 상세: 판정이 "대상 경로에서 위로 올라가며 처음 만나는 `.git`" 의 첫 경로 조각이 `spec` 인지만 본다. 이 저장소의 체크아웃인지는 확인하지 않는다. 스크래치 디렉터리에 만든 무관한 git 저장소 `other-repo/spec/x.md` 로 훅을 돌려 exit 2 (BLOCKED) 를 실측했다. 같은 세션에서 다른 프로젝트의 `spec/` 를 Write/Edit 하면 "NERV 가 정본" 이라는 잘못된 안내와 함께 막힌다. 테스트(`test_other_paths_are_allowed`)는 저장소 밖(`.git` 없음) 스크래치만 검증하고 "다른 저장소의 spec/" 은 검증하지 않는다.
  - 제안: 체크아웃 루트에 이 저장소의 표지가 있을 때만 막는다. 예: `(root / ".claude/tools/nerv-mirror/pull.py").exists()`. 커밋된 파일이라 main·워크트리 모두 성립한다. 테스트 fixture 에는 표지 파일을 심고, "표지 없는 다른 저장소의 `spec/` 는 통과" 케이스를 추가한다.

- **[WARNING]** 훅이 문서화된 워크플로를 막는데 거버넌스 문서는 그대로다 (훅 docstring 이 스스로 세운 규칙과 어긋남)
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:11-15` (docstring), 대상 문서 `CLAUDE.md` · `.claude/skills/project-planner/SKILL.md` (절차 5 "`spec/<영역>/*.md` 에 적용", 쓰기 권한 표 `spec/** Read/Write`) · `.claude/docs/worktree-policy.md` (Enforcement 4-layer 목록에 신규 훅 없음)
  - 상세: docstring 은 "거버넌스 문서가 그 경로의 쓰기를 더는 안내하지 않을 때 더한다 — 먼저 막으면 문서가 시키는 일을 훅이 막는다" 고 적는데, `spec/` 는 문서 변경 없이(HEAD 커밋 변경 목록에 `CLAUDE.md`·SKILL 없음, 세 문서 모두 `NERV` 언급 0건 grep 확인) 지금 막힌다. project-planner 의 `spec/` 쓰기, developer 의 "자기-반증형 소정정" 예외(다섯 조건), `consistency-check --spec` 게이트 전제가 모두 이 훅에 막힌다. 옛 `spec/<영역>/` 트리 동결도 이 훅 외에는 어디에도 안내되지 않는다. `BYPASS_NERV_OWNED_PATHS=1` 은 훅 프로세스 환경 변수라 Bash 명령 앞에 붙여도 닿지 않고 세션 환경으로만 줄 수 있다(기존 `BYPASS_DEFAULT_BRANCH_GUARD` 와 같은 구조지만 policy 문서에 적히지 않음).
  - 제안: 이 PR 은 developer 범위라 거버넌스 문서를 못 고친다. 머지 전에 project-planner 턴(같은 Task 의 후속 PR 이 아니라 머지 순서상 먼저 또는 함께)으로 CLAUDE.md · planner SKILL · worktree-policy 를 갱신하거나, 그 전까지 훅 배선을 보류한다. 최소한 PR 본문에 "문서 갱신 전까지 planner 의 spec 쓰기가 막힌다" 를 명시한다.

- **[WARNING]** `pull.py --all` 이 빈 export 를 받으면 미러 전체를 지우고 exit 0, CI `--check` 도 이를 못 잡는다
  - 위치: `.claude/tools/nerv-mirror/pull.py:279-293` (`cmd_all`), `:158-178` (`apply(prune=True)`), `:255-274` (`check`), `:384-389`
  - 상세: `docs_from_zip` 은 `specs/…md` 가 하나도 없는 유효한 zip(예: `manifest.json` 과 `llms.txt` 만)에서 빈 목록을 돌려주고, `apply(..., prune=True)` 는 `keep` 밖의 모든 `mirror_files` 를 `unlink()` 한다. 현재 미러 사본 위에서 실측했다: `before 169 after 0 rc 0`, `pull: 씀 0 · 그대로 0 · 지움 169`. README 도 영역 없이 다시 쓰인다. 서버 오류·권한 축소·`basis` 오지정이 200 + 빈 zip 으로 오면 조용히 전체 삭제다. 이어서 `--check` 는 `mirror_files` 를 순회하므로 미러 0편이면 "문제 0" 으로 exit 0 이라 CI `spec-mirror-integrity` 도 통과한다(단위 테스트 `test_the_repo_mirror_passes_its_own_check` 만 비어 있음을 잡는데, 이는 harness 잡 소속이다). 삭제·추가된 파일과 README 는 `--check` 대상이 아니다(중앙 매니페스트 없음이 D3 의 의도이므로 이 부분은 설계 한계로 기록만).
  - 제안: `--all` 은 `docs` 가 비었거나 지울 파일이 기존 미러의 일정 비율(예: 전부) 이상이면 중단하고 `--force-prune` 같은 명시 옵션을 요구한다. `--check` 는 미러 0편이면 실패로 돌린다(CI 가드가 공허하게 통과하지 않도록). 회귀 테스트 두 개 추가.

- **[INFO]** 옛 트리 링크 가드에서 미러를 빼면서 미러 내부 링크의 검증 주체가 없어졌다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:251-267` (`inNervMirror` · `collectSpecMarkdown`), `.claude/tools/nerv-mirror/pull.py:255-274`
  - 상세: `collectSpecMarkdown` 은 `spec-link-integrity` scope 1 과 `spec-area-index` 가 공유하므로 두 가드가 함께 미러를 놓는다. 대체 검증인 `pull.py --check` 는 본문 지문과 위치만 보고 링크는 보지 않는다. 현재는 죽은 상대 링크 0건(`spec/` 170편 실측)이라 지금 결함은 아니다. 다만 `--task` 는 ETag 가 같은 문서(304)를 다시 렌더하지 않으므로(`cmd_task` 의 `continue`), 다른 문서가 영역을 옮기면 안 바뀐 문서의 상대 링크가 옛 경로로 남을 수 있고 어느 CI 도 이를 잡지 않는다. CHANGELOG 의 "미러 무결성은 `pull --check` 가 본다" 는 링크 무결성까지는 보장하지 않는다.
  - 제안: `--check` 에 미러 상대 링크의 대상 파일 존재 검사를 더하거나, CHANGELOG/README 문구를 "본문 지문·위치" 로 좁힌다. `--task` 는 트리에 없는 이동이 있으면 304 문서도 링크만 다시 쓰는 경로를 고려한다.

- **[INFO]** 미러 경로 판정 정의가 세 곳에 복제되어 있다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:200` (`_NERV_MIRROR_REL`), `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:255` (`NERV_MIRROR`), `.claude/tools/nerv-mirror/pull.py:47-48` (`KEY_RE` · `mirror_files`)
  - 상세: 세 정규식이 각각 다른 표기(`CLE-[A-Z0-9-]+`, `KEY_RE` 는 `--` 계층 허용)로 같은 개념을 판정한다. 키 형식이 넓어지면(예: 소문자·다른 접두) 한쪽만 미러로 취급해, 옛 코퍼스에 섞이거나 무결성 검사에서 빠지는 조합이 생길 수 있다. 셋을 묶는 교차 테스트가 없다.
  - 제안: 당장 결함은 아니므로 후속으로 "같은 경로 목록에 세 판정이 일치" 하는 교차 테스트 하나면 충분하다.

- **[INFO]** 가드가 대소문자를 구분하고 심볼릭 링크를 풀지 않는다
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:59` (`normpath`), `:79-80`
  - 상세: macOS 기본 대소문자 무시 파일시스템에서 `SPEC/…` 는 같은 디렉터리인데 `first in OWNED_ROOTS` 로 통과한다. `realpath` 를 쓰지 않아 링크를 통한 경로도 통과한다. 소프트 가드이고 본문을 바꾸면 CI 지문 검사가 잡으므로 위험은 낮다.
  - 제안: 비교를 `first.lower()` 로 하고 판정 직전에 `realpath` 를 적용하는 것을 고려한다(단 realpath 는 워크트리 `.git` 파일 판정과 독립이라 안전).

### 요약

미러 파일 자체와 가드·CI 배선은 의도대로 격리되어 있다. 옛 코퍼스(consistency 번들, docs 가드)에서 미러를 빼는 변경은 `spec-frontmatter-parse.ts` 가 접두 목록 기반이라 이미 미러를 안 잡는 것을 포함해 다른 소비자에 새는 곳을 찾지 못했다. 다만 세 가지 부작용이 실재한다. (1) 편집 가드가 이 저장소를 식별하지 않아 다른 저장소의 `spec/` 까지 막는다(실측). (2) 거버넌스 문서는 여전히 planner·developer 에게 `spec/` 쓰기를 지시하는데 훅은 이미 막아 훅 자신의 docstring 규칙과 충돌하고, 이 PR 은 문서를 고칠 권한이 없다. (3) `pull.py --all` 은 빈 export 에 미러 169편을 지우고 정상 종료하며(실측), CI `--check` 도 빈 미러를 통과시킨다. 검증 프로브는 전부 저장소 밖 scratchpad 에서만 돌렸고 워킹트리는 건드리지 않았다(`git status` 는 리뷰 산출물 디렉터리 외 변경 없음).

### 위험도

MEDIUM
