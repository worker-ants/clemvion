# 신규 식별자 충돌 검토 — spec-draft-nav-spec-cleanup

대상: `plan/in-progress/spec-draft-nav-spec-cleanup.md` (target) + worktree `nav-spec-cleanup-f2dc5e` 의
uncommitted 변경 3파일(`spec/2-navigation/11-error-empty-states.md`,
`spec/2-navigation/14-execution-history.md`, `spec/2-navigation/_product-overview.md`).

## 발견사항

- **[CRITICAL]** 브랜치 stale로 `EH-DETAIL-12` 를 중복 발급 — 이미 `origin/main` 에 동일 ID 존재
  - target 신규 식별자: `EH-DETAIL-12` (target 의 uncommitted diff 가 `_product-overview.md §3.15` 에 신규 추가. 커밋 HEAD(`892009f04`, #866) 기준으로는 이 ID 가 저장소 어디에도 없어 "신규"로 보인다)
  - 기존 사용처: `origin/main` 커밋 `1c09c1029` — `docs(spec): 실행 이력 EH-DETAIL-06 ID 범위 드리프트 해소 — 단일 노드(06)/cross-node v2(12) 분리 (#867)`. 이 PR 이 이미 `EH-DETAIL-06`/`EH-DETAIL-12` 를 분리 발급했고 `14-execution-history.md` 의 `## Rationale` 에 이유를 설명하는 `### R-6. EH-DETAIL-06(단일 노드) 과 EH-DETAIL-12(cross-node v2) 를 별도 ID 로 분리한 이유` 섹션까지 추가했다. `origin/main` 은 이후 `#868`·`#869`(에디터 slug화 phase 2)까지 진행돼 현재 `nav-spec-cleanup-f2dc5e` 브랜치보다 3커밋 앞서 있다(`git merge-base --is-ancestor` 로 확인 — 이 브랜치 HEAD 는 `origin/main` 의 조상).
  - 상세: target 의 `EH-DETAIL-12` 본문("(v2) cross-node **ConversationThread 재구성 view**...정책·UI 미정...")은 `origin/main` 의 것과 의미는 같지만 텍스트가 다르다 — `origin/main` 판은 "NodeExecution 분산 저장(`output.interaction` + `output.result.messages`)에서 재구성하는 derived view (park resume durable 스냅샷과 목적·소비처 분리)" 문장이 추가돼 있다. 게다가 `origin/main` 이 붙인 `R-6` rationale 은 이 브랜치의 `14-execution-history.md` 에 전혀 없다. target 의 plan 본문은 "EH-DETAIL-06 clarifier·EH-DETAIL-12(#867) 는 이관 매트릭스에 보존"이라고 적어 #867 을 인지하고 있는 것처럼 보이지만, 실제로 이 worktree 는 #867 커밋을 포함하지 않는다 — 즉 계획서 작성자가 `origin/main` 을 보고 내용을 수동으로 재현했을 뿐, 브랜치 자체는 rebase 되지 않았다. 이 상태로 머지/rebase 하면 `14-execution-history.md`(→ 이번 target 이 `_product-overview.md` 로 옮기려는 바로 그 매트릭스)에서 충돌이 발생하고, `R-6` rationale 이 "이 문서"(14-execution-history.md)를 지칭하는 문장을 그대로 둔 채 매트릭스만 `_product-overview.md` 로 빠져나가면 R-6 자체가 자기참조 모순(stale self-reference)이 된다.
  - 제안: `spec-draft-nav-spec-cleanup` 을 확정하기 전에 `nav-spec-cleanup-f2dc5e` worktree/브랜치를 `origin/main`(`3da3db8fc`, #869)으로 rebase 한다. rebase 후에는 `EH-DETAIL-06/12` 분리 자체는 이미 완료된 상태이므로 target plan 에서 해당 부분을 제거하고, "Overview → `_product-overview.md §3.15` 이관" 작업만 순수하게 수행한다. 이관 시 `R-6` rationale 문장의 "이 문서" 지칭을 "`_product-overview.md §3.15`"로 갱신해 self-reference 를 유지한다.

- **[CRITICAL]** `WorkspaceSlugGate` / `lib/workspace/workspace-slug-gate.tsx` — 이 브랜치 자체 코드에는 미존재(증거 미검증), 서술도 브랜치 내 다른 문서와 모순
  - target 신규 식별자: `WorkspaceSlugGate` 컴포넌트명 + `codebase/frontend/src/lib/workspace/workspace-slug-gate.tsx` 경로 (target 이 `11-error-empty-states.md` frontmatter `code:` 및 §1.3 본문에 신규 추가)
  - 기존 사용처: (a) 이 worktree 자신의 코드 트리 — `codebase/frontend/src/lib/workspace/` 디렉터리에는 `href.ts`/`resolve-fallback.ts`/`safe-path.ts`/`types.ts`/`use-workspace-slug.ts`/`use-workspaces.ts` 만 존재하고 `workspace-slug-gate.tsx` 는 없다. `(main)/w/[slug]/layout.tsx` 의 실제 export 명은 `WorkspaceSlugGate` 가 아니라 `WorkspaceSlugLayout` 이며, `(editor)` 그룹은 `(editor)/workflows/[id]`(slug 없음)만 존재한다. (b) `spec/2-navigation/9-user-profile.md` §3 (이 브랜치의 현재 버전) — "**phase 1 범위 밖(slug 무관)**: 에디터(`/workflows/[id]`... slug화는 phase 2)"라고 명시해 에디터가 아직 slug 밖이라고 서술한다. 이는 target 이 새로 추가한 "`(main)`·`(editor)` 양 slug layout 이 이 게이트를 공유한다(슬러그 라우팅 phase 2)"와 **정면으로 모순**한다 — 심지어 target 문장이 스스로 참조하는 링크(`9-user-profile.md#3-워크스페이스-전환`) 대상 섹션과 충돌한다.
  - 상세: `origin/main`(#869, `3da3db8fc feat(navigation): 워크스페이스 슬러그 라우팅 phase 2 — 에디터 slug화`) 커밋 메시지를 확인한 결과 "`lib/workspace/workspace-slug-gate.tsx` `<WorkspaceSlugGate>` 로 추출 — `(main)/w/[slug]/layout` 과 에디터 layout 이 공유"라고 정확히 기술돼 있어, target 의 서술 자체는 **`origin/main` 기준으로는 사실**이다. 문제는 이 worktree(`nav-spec-cleanup-f2dc5e`, HEAD `892009f04`)가 #867·#868·#869 를 아직 포함하지 않는다는 것 — 즉 target 이 인용하는 파일·컴포넌트가 **이 브랜치 자신의 코드에는 존재하지 않는데도** frontmatter 증거로 등재되고, 같은 브랜치 안의 다른 spec 파일(9-user-profile.md §3)은 여전히 구 서술("phase 2 는 미착수")을 유지한 채로 남는다. `RoleGate`(`codebase/frontend/src/components/auth/role-gate.tsx`)처럼 저장소에 "*Gate = 별도 추출된 재사용 컴포넌트" 관례가 이미 있어, 독자가 `WorkspaceSlugGate` 도 그런 컴포넌트로 신뢰하기 쉬운데 이 브랜치 자체에서는 검증 불가능한 상태다.
  - 제안: 위 finding 과 동일한 rebase 로 해결된다. rebase 전에 이 상태로 push/PR 을 만들면 (a) `code:` frontmatter 증거가 이 브랜치 diff 시점 기준 실존하지 않는 경로를 가리키고, (b) `9-user-profile.md §3` 과 자기 모순되는 두 서술이 같은 PR 안에 공존하게 된다. rebase 후 재검증 필요.

- **[INFO]** 참조 리뷰 산출물 경로 부재 — 근거 문서가 다른 worktree 소속
  - target 신규 식별자: target 본문이 인용하는 `review/consistency/2026/07/09/14_08_26` (impl-done 산출물 경로)
  - 기존 사용처: 이 worktree(`nav-spec-cleanup-f2dc5e`) 의 `review/consistency/2026/07/09/` 하위에는 `08_55_51`·`09_00_08`·`11_31_49`·`15_07_20` 만 존재하고 `14_08_26` 은 없다.
  - 상세: 해당 리뷰는 실제로는 `editor-slug-phase2-f9a46b` worktree(PR #869 작업)에서 생성된 것으로 추정된다. 위 두 CRITICAL 항목과 동일한 원인(브랜치 미동기화)의 정황 증거일 뿐 그 자체로 새 식별자 충돌은 아니다.
  - 제안: rebase 후 해당 경로가 실제로 필요하면 함께 확인. 정보성으로만 기록.

## 요약

target 이 신규 도입하는 식별자(`EH-DETAIL-12`, `WorkspaceSlugGate`/`workspace-slug-gate.tsx`) 자체는 "다른 의미로 이미 쓰이는 이름과의 충돌"은 아니다 — 오히려 `origin/main` 에 이미 병합된 PR #867(EH-DETAIL-06/12 분리)·#869(에디터 slug화 phase 2, `WorkspaceSlugGate` 추출)의 내용과 **의미상 일치**한다. 그러나 `nav-spec-cleanup-f2dc5e` 브랜치가 그 두 PR 을 포함하지 않은 채(3커밋 뒤처진 상태) 같은 파일·같은 ID 를 독자적으로 재현하고 있어, 이 상태로 확정·머지하면 (1) `EH-DETAIL-12` 요구사항 ID 와 그 rationale(`R-6`)이 중복/충돌 정의되고 (2) `WorkspaceSlugGate` 관련 서술이 같은 브랜치의 `9-user-profile.md §3`(자신이 인용하는 링크 대상)와 정면 모순된 채로 공존한다. 근본 원인은 "신규 식별자 오설계"가 아니라 "브랜치 미동기화"이므로, `spec-draft-nav-spec-cleanup` 확정 전 `origin/main` 으로 rebase 하고 이미 상류에서 처리된 EH-DETAIL 분리 부분을 target 범위에서 제거하는 것이 최우선 조치다.

## 위험도

CRITICAL
