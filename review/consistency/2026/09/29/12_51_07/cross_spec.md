# Cross-Spec 일관성 검토 (impl-done, scope=.claude/docs)

검토 기준: 워킹트리 `/Volumes/project/private/clemvion/.claude/worktrees/nerv-cutover-1-69b98d` (HEAD). scope(`.claude/docs`) 델타는 0개 파일이다. 번들에 실린 구현 diff 는 프런트 가드 2개 파일이지만, 같은 브랜치에 편집 가드 훅(`guard_nerv_owned_paths.py`), `settings.json` 배선, consistency 오케스트레이터 제외, `spec/` 미러 169편이 함께 들어 있어 이것들까지 `.claude/docs` 규칙과 대조했다.

### 발견사항

- **[WARNING]** plan 이동 시 spec 인입 링크를 갱신하라는 규칙이 편집 훅과 CI 가드 사이에 갇힌다
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` `collectSpecMarkdown` (옛 트리는 그대로 검사 대상), `.claude/hooks/guard_nerv_owned_paths.py` `OWNED_ROOTS["spec"]` (옛 트리까지 `spec/` 전체 차단)
  - 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/nerv-cutover-1-69b98d/.claude/docs/plan-lifecycle.md` §3 "인입 참조" (`spec/` 등 살아있는 문서의 plan 링크는 이동과 동시에 갱신), §5 이동 체크리스트
  - 상세: 동결된 옛 트리 문서 중 `plan/` 링크를 가진 것이 29개이고, `plan/in-progress/` 를 가리키는 고유 대상이 12개다(예: `spec/5-system/1-auth.md`, `spec/1-data-model.md`, `spec/5-system/4-execution-engine.md`). 해당 plan 이 `complete/` 로 옮겨지면 `spec-link-integrity` scope 1 이 DEAD 로 실패한다. 가드 주석이 이미 "spec 문서에 쓴 plan 링크는 검사되고 plan 이 옮겨지면 빌드가 깨진다" 고 적고 있다. 그런데 plan-lifecycle §3 이 시키는 spec 링크 갱신은 훅이 exit 2 로 막는다. 통과 경로는 `BYPASS_NERV_OWNED_PATHS=1` 뿐이고 어떤 `.claude/docs` 문서도 이를 안내하지 않는다.
  - 제안: plan-lifecycle §3 에 "동결된 옛 `spec/` 트리의 인입 링크는 `BYPASS_NERV_OWNED_PATHS=1` 로 링크만 고친다" 는 좁은 예외를 적는다. 또는 옛 트리의 plan 링크 검사를 단계 5 까지 완화한다. 어느 쪽이든 `spec/` 를 못 고치는 상태에서 `plan/` 이동이 막히지 않게 결정이 필요하다.

- **[WARNING]** 훅이 `spec/` 을 막지만 거버넌스 문서는 아직 `spec/` 쓰기를 지시한다
  - target 위치: `.claude/hooks/guard_nerv_owned_paths.py` 모듈 docstring, `.claude/settings.json` PreToolUse(Write|Edit|MultiEdit|NotebookEdit) 배선
  - 충돌 대상: `CLAUDE.md` §Skill 체계와 §자기-반증형 소정정 (planner 는 `spec/` 쓰기 직전 `--spec` 의무, developer 는 예고 문장 소정정 가능), `.claude/skills/project-planner/SKILL.md` ("`spec/**` Read/Write — 주 작업 영역", "spec 반영 … `spec/<영역>/*.md` 에 적용"), `.claude/docs/plan-lifecycle.md` §5 Gate C (`spec_impact` 는 "본 작업이 건드린 spec 파일들")
  - 상세: 훅 docstring 은 "거버넌스 문서가 그 경로의 쓰기를 더는 안내하지 않을 때 더한다 — 먼저 막으면 문서가 시키는 일을 훅이 막는다" 고 정한다. 그런데 `spec/` 은 이 커밋에서 문서 개정 없이 막혔다(브랜치 diff 에 `CLAUDE.md`·SKILL·`.claude/docs` 변경이 0개). 훅 자신의 순서 규칙이 `spec/` 항목에서 깨진다. 결과적으로 planner 워크플로와 developer 소정정 예외가 훅에 의해 작동하지 않는다.
  - 제안: 같은 PR 에서 거버넌스 문서에 전환 상태를 적는다(planner 는 `spec/` 대신 NERV 초안, 소정정 예외는 미러 밖 옛 트리에 대해 `BYPASS` 필요 등). 소유가 `project-planner` 라서 이 세션이 고칠 수 없다면, 후속 planner 턴을 plan 에 명시하고 그 전까지 훅 차단이 문서와 어긋난다는 점을 CHANGELOG 나 `.claude/docs/README.md` 에 남긴다.

- **[WARNING]** "spec/ 트리가 단일 진실" 이라는 서술이 두 곳에서 갈리고 새 README 가 옛 트리의 지위를 말하지 않는다
  - target 위치: `spec/README.md` ("정본은 NERV 다", 미러만 서술), 이 브랜치가 넣은 `spec/CLE-*` 미러 영역 24개
  - 충돌 대상: `spec/0-overview.md` §8 문서 맵 ("본 spec/ 트리는 제품의 단일 진실(single source of truth) 이다", 영역 표에 `CLE-*` 없음), `CLAUDE.md` §정보 저장 위치 (제품 정의·기술 명세의 위치를 `spec/<영역>/*.md` 로 지정)
  - 상세: `spec/` 아래에 옛 트리(`0-overview.md`, `5-system/` 등)와 미러(`CLE-*`)가 같은 제품을 다른 모양으로 담고 있다. `spec/README.md` 는 옛 트리가 동결·대체 대상이라는 말을 하지 않는다(변경 사실은 CHANGELOG 에만 있다). 옛 트리는 훅으로 잠겨 있어 `0-overview.md` §8 도 고칠 수 없다. 독자는 어느 쪽이 정본인지 문서만으로 판단할 수 없다.
  - 제안: `pull.py` 가 만드는 `spec/README.md` 템플릿에 "옛 `spec/<영역>/` 트리는 동결, 단계 5 에서 삭제 예정, 이 시점까지 정본이 아님" 을 한 단락 추가한다. 옛 트리 진입 문서에는 배너를 넣는 별도 planner 턴이 필요하다.

- **[INFO]** 새 훅과 우회 변수가 `.claude/docs` 의 열거에 없다
  - target 위치: `.claude/hooks/guard_nerv_owned_paths.py` (`BYPASS_NERV_OWNED_PATHS`)
  - 충돌 대상: `.claude/docs/worktree-policy.md` §5 Enforcement(편집 차단 계층은 `guard_default_branch_edit.py` 만 서술, 우회는 `BYPASS_DEFAULT_BRANCH_GUARD` 만), `.claude/docs/plan-lifecycle.md` §3 (`BYPASS_PLAN_GUARD`), `.claude/docs/orchestrator-workflow-migration.md` (`BYPASS_REVIEW_GUARD`)
  - 상세: 같은 PreToolUse(edit) 매처에 두 번째 차단 훅이 생겼는데 정책 문서가 다루지 않는다. 앞선 발견 1의 유일한 통과 경로가 문서에 없다.
  - 제안: `worktree-policy.md` §5 에 한 줄 또는 별도 소절로 추가한다.

- **[INFO]** "미러 경로" 정의가 손으로 동기화된 세 곳에 있다
  - target 위치: `spec-links.ts` `NERV_MIRROR`, 같은 테스트 파일의 인라인 정규식(`/^spec\/(README\.md|CLE-)/`)
  - 충돌 대상: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` `_NERV_MIRROR_REL`, `.claude/tools/nerv-mirror/pull.py` (`KEY_RE`, `README`, 배치 규칙 `spec/<영역>/<KEY>.md`)
  - 상세: 현재 세 정의는 동일한 경로 집합을 가리키지만 서로를 교차 검증하는 테스트가 없다. `pull.py` 의 배치 규칙이 바뀌면(예: 영역 키 접두 변경) 가드 쪽 정규식이 조용히 어긋나 미러가 다시 옛 트리 가드에 걸린다.
  - 제안: `pull.py` 가 실제로 쓰는 경로 전수가 두 정규식에 모두 매칭되는지 확인하는 패리티 테스트를 하나 둔다.

- **[INFO]** consistency 코퍼스에서 미러가 빠져 NERV 스펙은 `--spec` 게이트 대상이 아니다
  - target 위치: `consistency_orchestrator.py` `collect_context` (`is_nerv_mirror` 필터)
  - 충돌 대상: `.claude/docs/subagent-call-contract.md`, `CLAUDE.md` ("planner 는 `spec/` 쓰기 직전 `--spec` 의무")
  - 상세: 전환 기간에는 스펙 정본이 미러인데 검토 코퍼스는 동결된 옛 트리뿐이다. 코드 주석은 "코퍼스를 미러로 옮기는 일은 단계 4e" 라고 적었다. 단계 번호(1, 2, 3, 4e, 5)는 훅 docstring, `spec-links.ts`, 오케스트레이터 주석, 커밋 메시지에만 있고 저장소의 어떤 plan·docs 에도 정의가 없다.
  - 제안: 단계 표를 한 곳(plan 또는 `.claude/docs`)에 두고 세 주석이 그것을 가리키게 한다.

- **[INFO]** 새 테스트가 옛 트리 실재 여부에 결합돼 단계 5 에서 깨진다
  - target 위치: `spec-link-integrity.test.ts` "excludes the NERV spec mirror from scope" (`spec/5-system/1-auth.md` 존재 단언, `spec/CLE-VISION.md` 존재 단언)
  - 충돌 대상: `spec-links.ts` 주석의 "옛 트리는 NERV 전환 단계 5 에서 지운다"
  - 상세: 단계 5 에서 옛 트리를 지우면 이 단언이 실패한다. 이는 의도된 알람일 수 있으나 테스트 주석에 그 사실이 없다.
  - 제안: 단언 옆에 "단계 5 에서 이 줄을 함께 제거" 를 적는다.

확인했으나 충돌 없음: 요구사항 ID(`CLE-*` 키)는 옛 트리에서 쓰이지 않아 충돌하지 않는다. `spec-frontmatter` 계열 가드는 `INCLUDE_PREFIXES` 로 대상을 고정해 미러가 걸리지 않는다. `plan-lifecycle.md` §5 Gate C 의 `spec_impact` 실존 판정은 미러 파일 경로도 통과시킨다. `stray-tool-tags` 는 미러를 포함해 스캔하지만 하한(`spec: 190`)이 옛 트리 덕에 계속 유효하다.

### 요약

`.claude/docs` 자체는 바뀌지 않았고 데이터 모델·API·요구사항 ID·RBAC 충돌은 없다. 다만 이 브랜치가 `spec/` 을 훅으로 잠그면서 거버넌스 문서(`plan-lifecycle.md` §3·§5, `CLAUDE.md`, planner SKILL)는 여전히 `spec/` 쓰기를 지시하고 있어 규칙과 강제 사이가 어긋난다. 특히 동결된 옛 트리 문서 29개가 plan 을 링크하고 그 링크는 CI 가 검사하므로, plan 을 완료로 옮기는 정상 동선이 훅과 가드 사이에 갇힐 수 있다. 우회 변수가 있어 CRITICAL 은 아니지만 같은 PR 또는 바로 다음 planner 턴에서 문서를 맞추어야 한다.

### 위험도
MEDIUM
