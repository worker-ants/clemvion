# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-raw-query-results.md`

## 발견사항

- **[CRITICAL]** plan frontmatter 필수 필드 `started`/`owner` 누락 — build guard 실측 실패
  - target 위치: frontmatter (문서 최상단, `id`/`status`/`worktree`/`spec_impact` 4필드만 선언)
  - 위반 규약: [`.claude/docs/plan-lifecycle.md §4 Frontmatter 스키마`](../../../../../../.claude/docs/plan-lifecycle.md) — "세 필드(`worktree`·`started`·`owner`)는 top-level `plan/in-progress/*.md` 에서 **필수** — build guard `plan-frontmatter.test.ts` 가 강제한다." 카탈로그: [`spec/conventions/spec-impl-evidence.md §4.2`](../../../../../../spec/conventions/spec-impl-evidence.md) 표의 `plan-frontmatter.test.ts` 행.
  - 상세: target 은 `plan/in-progress/` top-level 문서인데 frontmatter 에 `started:`(ISO 날짜)와 `owner:` 가 아예 없다. 같은 디렉토리의 자매 "spec draft" 문서 2건(`spec-draft-eia-62-waiting-payload.md`, `spec-draft-eia-notification-payload-contract.md`)은 모두 `worktree`/`started`/`owner` 3필드를 정확히 갖추고 있어, 이 결손이 저장소 관행에서 벗어난 개별 사고임을 뒷받침한다. **실측**: `cd codebase/frontend && npx vitest run src/lib/docs/__tests__/plan-frontmatter.test.ts` 을 이 워크트리에서 그대로 돌리면 정확히 이 파일에서 2건 실패한다 —
    ```
    FAIL plan/in-progress/spec-draft-raw-query-results.md > `started` is an ISO date
      expected [ 'started=null' ] to deeply equal []
    FAIL plan/in-progress/spec-draft-raw-query-results.md > `owner` is set
      expected [ 'owner=undefined' ] to deeply equal []
    Test Files  1 failed (1) | Tests  2 failed | 147 passed (149)
    ```
    다른 147개 테스트(자매 plan 포함)는 전부 통과 — 이 문서 하나만의 결손이다. 현재는 `git status` 상 untracked 라 아직 CI 에 오르지 않았지만, 커밋되는 순간 frontend 빌드가 이 지점에서 확정적으로 깨진다(다른 시스템 — push gate 의 plan 연결 판정, `plan-stale-audit.sh` 등 — 이 이 스키마가 항상 채워져 있다고 가정하는 invariant 를 직접 위반).
  - 제안: frontmatter 에 `started: 2026-08-30`(또는 실제 작성일) 과 `owner: project-planner`(또는 실제 작성 역할)를 추가한다. 자매 문서들의 필드 순서(`title`/`status`/`worktree`/`started`/`owner`/`spec_impact`/`pending_plans`)를 그대로 따르는 편이 이후 diff 검토에서 자연스럽다.

- **[INFO]** frontmatter 가 plan 스키마와 spec 스키마를 혼용
  - target 위치: frontmatter `id:`/`status: draft` 두 키
  - 위반 규약: 직접 위반은 아님 — [`plan-lifecycle.md §4`](../../../../../../.claude/docs/plan-lifecycle.md) 는 `title`/`priority`/`status` 등 "추가 필드는 허용" 이라고 명시하므로 `id`/`status` 존재 자체는 허용 범위 안이다. 다만 [`spec-impl-evidence.md §2.2`](../../../../../../spec/conventions/spec-impl-evidence.md) 가 "spec frontmatter 의 `id`/`status` 어휘 도메인과 plan frontmatter 의 그것은 다르다" 고 명시적으로 구분해 둔 바로 그 지점과 겹친다.
  - 상세: 자매 spec-draft 문서 2건은 `title:`(제목)만 쓰고 `id:` 는 쓰지 않는데, 이 문서는 spec 문서 프런트매터 스타일(`id`/`status: draft`)을 plan 문서에 그대로 가져왔다. 위 CRITICAL 항목(필수 3필드 누락)과 함께 보면, 작성자가 plan 스키마가 아니라 spec 컨벤션 스키마를 기준으로 frontmatter 를 채웠을 가능성을 시사한다.
  - 제안: `id`/`status: draft` 를 제거하거나(불필요), 유지하려면 plan 필수 3필드를 **추가로** 채워 자매 문서와 스키마를 맞춘다.

- **[INFO]** `worktree:` 값이 스키마 예시와 다른 표기(허용되는 변형이지만 비-정본)
  - target 위치: `worktree: .claude/worktrees/raw-update-guard-scope-0e154c`
  - 위반 규약: [`plan-lifecycle.md §4`](../../../../../../.claude/docs/plan-lifecycle.md) 스키마 예시는 `worktree: <task_name>-<slug>` — worktree **디렉토리 이름**만 적도록 돼 있다. 자매 문서 2건도 모두 `eia-r8-cache-scope-4ae434` 형태(경로 접두 없음)다.
  - 상세: 이 필드는 push gate(`plan_guard.py`)가 소비하는데, 그 구현의 `_normalize_worktree_value` 가 `.claude/worktrees/x` 형태의 leading path 를 명시적으로 잘라내도록 이미 작성돼 있고 docstring 도 이 변형을 "practice 에서 실제로 관측된 자유 형식" 으로 인정한다 — 따라서 **기능적으로는 깨지지 않는다.** 다만 §4 가 문서화한 정본 표기는 아니다.
  - 제안: 굳이 급하지 않음. 다음 편집 기회에 `raw-update-guard-scope-0e154c` (경로 접두 제거)로 정규화하면 자매 문서와 표기가 일치한다.

- **[WARNING]** §A 가 신규 `spec/conventions/raw-query-results.md` 의 필수 frontmatter(id/status/code)를 지시하지 않음
  - target 위치: `## A. 신규 spec/conventions/raw-query-results.md` 절 전체
  - 위반 규약: [`spec-impl-evidence.md §1·§2`](../../../../../../spec/conventions/spec-impl-evidence.md) — `spec/conventions/**.md` 는 frontmatter 의무 대상(inclusive list)이고, `status: implemented`/`partial` 이면 `code:` ≥1 매치가 build 가드(`spec-code-paths.test.ts`)로 강제된다.
  - 상세: §A 는 두 불변식의 본문·경계·집행 근거는 상세히 규정하지만, 실제로 파일이 생성될 때 채워야 할 `id`/`status`/`code:` 값은 언급하지 않는다. 이 규약이 정의하는 대상(`updateReturningRows`, `update-returning-rows.spec.ts` 등)은 이미 developer 턴(`#1241`)에서 구현이 끝났으므로 `status: implemented` + `code:` 목록이 자연스러운 선택인데, 초안에 그 지시가 없으면 실행 turn 에서 빠뜨릴 위험이 있다(다른 spec/conventions 문서 전부가 이 3필드를 갖추고 있는 것과 대비).
  - 제안: §A 말미에 권장 frontmatter 블록(`id: raw-query-results`, `status: implemented`, `code: [codebase/backend/src/common/utils/update-returning-rows.ts, codebase/backend/src/common/utils/update-returning-rows.spec.ts, ...]`)을 명시해 둔다.

## 요약

target 문서의 본문(신규 규약 A·소급 각주 B·frontmatter 갱신 C)은 관련 conventions(`migrations.md` 와의 경계, `spec-pending-plan-existence.test.ts` 가 요구하는 pending_plans 실존, §2.4 표 대신 소비 경로 단위로 caveat 를 거는 정밀도 등)를 정확히 이해하고 따르고 있고, `plan/in-progress/spec-draft-<name>.md` 네이밍도 consistency-checker SKILL 이 규정한 project-planner 워크플로 그대로다. 다만 문서 자신의 frontmatter 는 plan 라이프사이클 정식 규약(`plan-lifecycle.md §4`)이 top-level in-progress plan 에 강제하는 `started`/`owner` 두 필드가 빠져 있고, 이는 실제로 `plan-frontmatter.test.ts` build guard 를 즉시 실패시키는 것으로 실측 확인했다(2건 FAIL). 이 한 건이 유일한 CRITICAL 이며, 나머지는 스타일·완결성 수준의 WARNING/INFO 다.

## 위험도

HIGH
