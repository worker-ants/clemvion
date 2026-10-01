# Cross-Spec 일관성 검토 (impl-done, scope=.claude/docs, diff-base=origin/main)

검토 대상: 브랜치 `claude/nerv-cutover-1-69b98d` HEAD(`b37c43b8f`). 이 브랜치의 `.claude/docs/**` 델타는 0개 파일이다(정상). 구현 diff 5개 파일은 모두 `codebase/frontend/src/lib/docs/__tests__/` 아래 docs 가드로, 미러 판정 `inNervMirror` 를 `collectSpecMarkdown` 에 넣어 NERV 미러(`spec/README.md` · `spec/CLE-*`)를 링크 무결성 · 영역 index 가드의 대상에서 뺀다.

실측한 것(전부 워크트리 절대경로 기준):
- `python3 .claude/tools/nerv-mirror/pull.py --check` → `미러 169편 · 문제 0`, exit 0.
- vitest 4파일(`spec-link-integrity` · `spec-area-index` · `tree-walk` · `stray-tool-tags`) → 69/69 통과.
- `git ls-files spec` 의 `.md` 중 미러 정규식에 걸리는 것은 170개(미러 169 + README), 안 걸리는 것은 옛 트리(`0-overview.md` · `1-data-model.md` · `2-navigation` … `conventions` 274 · `data-flow` 16)뿐이다. 옛 트리에 `CLE-` 이름은 0개다.
- 세 판정(`pull.py` · `consistency_orchestrator._NERV_MIRROR_REL` · `spec-links.ts` `NERV_MIRROR`)의 정규식 리터럴이 서로 같고, `MirrorPredicateParityTest` 가 실제 트리와 경계 이름에서 이를 묶는다.
- `collectSpecMarkdown` 호출자는 `spec-link-integrity` · `spec-area-index` · `tree-walk` 테스트뿐이다. `spec-frontmatter-parse.ts` 의 `INCLUDE_PREFIXES` · `spec_coverage_orchestrator` 의 INCLUDE 목록은 열거형이라 미러를 애초에 안 본다. 가드 스코프가 조용히 줄어드는 다른 호출자는 없다.

데이터 모델 · API 계약 · 요구사항 ID · 상태 전이에는 이 변경이 닿지 않는다. 새 요구사항 ID 도 부여하지 않는다.

### 발견사항

- **[WARNING]** 가드 스코프의 SoT 가 두 곳에서 서로 다르게 적혀 있고, 옛 쪽은 훅 때문에 도구로 고칠 수 없다
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts:37` · `spec-area-index.test.ts:19`(`// SoT: spec/conventions/spec-impl-evidence.md §4.2.`), `spec-links.ts:12`, `PROJECT.md` 의 두 가드 항목(이 브랜치가 고친 줄) 과 `### 검사 스코프 3가지` 절의 `SoT: spec/conventions/spec-impl-evidence.md`
  - 충돌 대상: `spec/conventions/spec-impl-evidence.md` §4.2 표(L133 `spec-link-integrity` 예외 칸 · L134 `spec-area-index` 예외 칸) 대 `spec/CLE-ENG/CLE-ENG-SPECEVIDENCE.md`(L176 · L177 · L184 · L255 와 Rationale R-12)
  - 상세: 새 가드 동작은 "링크 무결성은 `*-api-catalog/` 와 NERV 미러를 뺀다", "영역 index 는 `spec/conventions/` · 카탈로그 · NERV 미러를 면제한다" 이다. 이를 적은 쪽은 미러 사본(`CLE-ENG-SPECEVIDENCE`)과 PROJECT.md 뿐이다. 코드 주석과 PROJECT.md 가 SoT 로 가리키는 옛 문서는 `미러`/`mirror` 가 0건이고, 예외 칸에 카탈로그(와 conventions)만 적혀 있다. 그 옛 문서를 그대로 읽으면 "미러 `spec/CLE-*` 가 두 가드의 대상" 으로 읽혀 실제 동작과 반대다. 게다가 `guard_nerv_owned_paths.py` 가 `spec/` 전체를 막으므로 옛 문서를 고치는 길은 `BYPASS_NERV_OWNED_PATHS=1` 뿐이다. 이 브랜치는 PROJECT.md 만 고치고 코드 주석의 SoT 포인터는 그대로 뒀다.
  - 제안: 이 브랜치에서 둘 중 하나로 정리한다. (a) PROJECT.md 두 항목과 `### 검사 스코프 3가지` 절에 "미러 제외 규정의 근거는 `spec/CLE-ENG/CLE-ENG-SPECEVIDENCE.md` R-12" 한 줄을 더하고, 테스트 파일 머리 주석에도 같은 포인터를 둔다. (b) 옛 문서에 한 줄 정정을 직접 넣는다면 훅 우회와 planner 턴이 필요하다. (a) 가 더 싸다. 어느 쪽이든 두 문서가 다른 스코프를 말하는 기간(전환 단계 4f~5 까지)을 PROJECT.md 에 한 문장으로 적는다.

- **[WARNING]** 거버넌스 문서가 안내하는 쓰기 권한과 새 편집 훅이 전 역할에 걸쳐 어긋난다
  - target 위치: `.claude/hooks/guard_nerv_owned_paths.py`(`OWNED_ROOTS = {"spec": …}`, `.claude/settings.json` 에 등록), 모듈 docstring "거버넌스 문서가 그 경로의 쓰기를 더는 안내하지 않을 때 더한다. 먼저 막으면 문서가 시키는 일을 훅이 막는다"
  - 충돌 대상: `CLAUDE.md` Skill 체계 표(`project-planner` 의 쓰기 권한 `spec/**`, `developer` 의 `spec/` read-only 와 "자기-반증형 소정정" 예외, "`project-planner` 는 `spec/` 쓰기 직전 `consistency-check --spec` 의무"), `.claude/skills/project-planner/SKILL.md` L14 · L22 · L36(`spec/**` Read/Write, "draft 의 변경을 `spec/<영역>/*.md` 에 적용"), `CLAUDE.md` "정보 저장 위치" 표(`spec/` 를 제품의 단일 진실로 적음)
  - 상세: 이 브랜치에서 `CLAUDE.md` 와 두 SKILL.md 는 NERV 를 한 번도 언급하지 않는다(`grep -n "NERV" CLAUDE.md .claude/skills/{project-planner,developer,consistency-checker}/SKILL.md` 가 0건). 그런데 훅은 단계 1 부터 `spec/**` 쓰기를 모든 역할에서 막는다. 훅 docstring 자신의 규칙("문서가 안내하지 않을 때 더한다")을 이 PR 이 `spec/` 에 대해 어긴다. 결과적으로 planner 가 SKILL 대로 `spec/` 에 쓰면 훅이 차단하고, developer 의 자기-반증형 소정정 5조건은 대상 파일이 동결돼 적용 불가가 된다. 차단 메시지가 `/nerv:spec edit` 으로 안내하므로 교착은 아니고, 안내가 PROJECT.md `### NERV 스펙 미러` 와 `spec/README.md` 에만 있다. 이 상태는 훅 docstring 이 전환 단계 4d(거버넌스 경로, Task `CLE-T-BR8BNZ`)로 미뤄 두었다. 미룬 것 자체는 의도지만 중간 상태가 역할 정의와 직접 모순이라 WARNING 으로 둔다.
  - 제안: 4d 이전에 최소한 `CLAUDE.md` Skill 표 아래나 §0 에 "단계 1 부터 `spec/**` 는 NERV 미러라 도구 편집이 막힌다. 스펙 변경은 `/nerv:spec edit`, 우회는 `BYPASS_NERV_OWNED_PATHS=1`" 한 줄을 planner 턴으로 넣는다. `.claude/docs/**` 쪽은 델타가 0이라 영향이 없지만(아래 INFO 참조), CLAUDE.md 와 SKILL.md 는 `project-planner` 소유라 developer 가 이 PR 에서 고칠 수 없다. 이 항목은 planner 턴 위임 대상이다.

- **[INFO]** 검토 코퍼스에서 미러를 빼면 cross-spec · convention checker 의 비교 대상은 동결된 옛 트리뿐이다
  - target 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 의 `is_nerv_mirror` / `collect_context`(`all_spec_files` 필터)
  - 충돌 대상: `spec/CLE-ENG/CLE-ENG-SPECEVIDENCE.md` L257(스펙 변경의 사전 검토는 NERV `nerv_spec_check` 5개 검사기), 오케스트레이터 주석의 "코퍼스를 미러로 옮기는 일은 단계 4e(`CLE-T-VP5KDJ`)"
  - 상세: 대상(`scope_files`)은 필터를 거치지 않으므로 미러 문서를 scope 로 검토하는 것은 된다. 다만 "다른 영역" 코퍼스에는 미러가 없다. 단계 1~4e 동안은 구현 PR 이 새로 받은 미러 스펙이 동결된 옛 문서와 어긋나도 이 checker 가 못 본다. 주석과 테스트 설명에 이 공백이 명시돼 있고 NERV 쪽 검사기가 메운다고 적혀 있어 모순은 아니다.
  - 제안: 조치 불필요. `.claude/skills/consistency-checker/SKILL.md` 가 코퍼스 구성을 설명한다면 4e 에서 함께 갱신한다.

- **[INFO]** 옛 트리 가드 정리 시점이 문서마다 4f 와 5 로 다르게 적혀 있다
  - target 위치: `spec-links.ts` 주석("옛 트리는 NERV 전환 단계 5(Task `CLE-T-7M4C4X`)에서 지운다")
  - 충돌 대상: `guard_nerv_owned_paths.py` docstring(4f "개별 가드" `CLE-T-RXMB2X`, 5 "옛 spec 트리 삭제"), `CLE-ENG-SPECEVIDENCE` R-12("전환 단계 5 에서 두 가드의 옛 트리 범위와 이 예외를 함께 정리")
  - 상세: 두 가드의 옛 트리 범위와 미러 예외를 4f 가 정리하는지 5 가 정리하는지 문서마다 다르다. 코드 동작에는 영향이 없다.
  - 제안: 다음 번 해당 문서를 만질 때 한쪽으로 맞춘다(R-12 는 NERV 스펙이라 `/nerv:spec edit` 경로).

- **[INFO]** "미러 제외" 테스트가 미러의 영역 밖 문서가 있다는 전제에 묶여 있다
  - target 위치: `spec-link-integrity.test.ts` 의 "excludes the NERV spec mirror from scope"(`spec/CLE-*.md` 최상위 파일이 1개 이상이어야 통과, 주석은 "특정 키에 묶지 않는다")
  - 충돌 대상: `spec/README.md` · `PROJECT.md ### NERV 스펙 미러`("미러는 구현된 스펙의 스냅샷", 부분 스냅샷)
  - 상세: 지금은 `CLE-VISION.md` · `CLE-GLOSSARY.md` 가 있어 통과한다. 미러가 `--task` 로 조금씩만 받는 부분 스냅샷이라는 문서 전제와, 최상위 영역 밖 문서가 항상 있다는 테스트 전제가 같지 않다. 지금은 문제가 아니고 `--all` 이 둘을 다시 받는다.
  - 제안: 필요해지면 `readdirSync` 후보를 최상위 `CLE-*.md` 로 한정하지 말고 `inNervMirror` 가 참인 어떤 `.md` 든(영역 폴더 안 포함)으로 넓힌다.

### 요약

이 변경은 NERV 미러를 옛 트리 전용 가드(링크 무결성 · 영역 index)에서 빼는 하네스 테스트 코드이고, 데이터 모델 · API · 요구사항 ID · 상태 전이와는 닿지 않는다. 구현과 미러 쪽 spec(`CLE-ENG-SPECEVIDENCE` L176~L184 · L255 · R-12), `PROJECT.md`, 워크플로(`spec-link-checks.yml` 의 `spec-mirror-integrity`, `harness-checks.yml` 경로 목록), 세 곳의 미러 판정(정규식 동일, parity 테스트)은 서로 맞고 실측(`--check` 문제 0, vitest 69/69)도 통과한다. 남은 문제는 두 가지다. 하나는 가드 스코프의 SoT 로 코드 주석과 PROJECT.md 가 가리키는 옛 `spec/conventions/spec-impl-evidence.md` 가 미러 제외를 모르는 채 동결돼 미러 사본과 반대로 읽힌다는 점이다. 다른 하나는 `spec/**` 쓰기를 모든 역할에서 막는 새 훅이 아직 갱신되지 않은 `CLAUDE.md` · `project-planner` SKILL.md 의 권한 안내와 어긋난다는 점이다. 후자는 전환 단계 4d 로 미뤄진 의도된 중간 상태지만 훅 자신의 선행 조건과 맞지 않는다. CRITICAL 은 없다. `.claude/docs/**` 는 이 브랜치에서 바뀌지 않았고 NERV 연동 절(worktree-policy §8)만 이미 반영돼 있어 이 변경과 충돌하는 문장은 찾지 못했다(plan-lifecycle §5 Gate C 의 `spec/5-system/…` 예시 등 옛 트리 서술은 4d 에서 정리될 대상이다).

### 위험도
LOW

STATUS=success ISSUES=5 PATH=/Volumes/project/private/clemvion/.claude/worktrees/nerv-cutover-1-69b98d/review/consistency/2026/10/01/09_05_51/cross_spec.md
