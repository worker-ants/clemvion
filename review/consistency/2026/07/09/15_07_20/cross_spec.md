# Cross-Spec 일관성 검토 결과

## 검토 대상
- target: `plan/in-progress/spec-draft-nav-spec-cleanup.md` (worktree `nav-spec-cleanup-f2dc5e`)
- 변경 파일: `spec/2-navigation/11-error-empty-states.md`(evidence 정밀화), `spec/2-navigation/14-execution-history.md`(Overview 섹션 제거), `spec/2-navigation/_product-overview.md`(§3.15 신설, EH-* 매트릭스 수용)

## 발견사항

- **[CRITICAL]** target 브랜치가 origin/main 대비 3-커밋 stale — 이미 병합된 PR 이 동일 EH-DETAIL-06/12 표면을 수정해 둠
  - target 위치: `plan/in-progress/spec-draft-nav-spec-cleanup.md` 변경 2 전체(Overview 섹션 → `_product-overview.md §3.15` 이관) + 근거 문장 "cross-ref 무손상 확인: ... Overview/EH-* 매트릭스 anchor 참조는 없음"
  - 충돌 대상: `origin/main` 의 병합 완료 커밋 `1c09c1029`(#867 "실행 이력 EH-DETAIL-06 ID 범위 드리프트 해소") · `3da3db8fc`(#869 "워크스페이스 슬러그 라우팅 phase 2 — 에디터 slug화"). 현재 worktree 의 로컬 브랜치(`claude/nav-spec-cleanup-f2dc5e`, HEAD=`892009f04`)는 이 두 커밋을 아직 pull/rebase 하지 않은 상태(`git status`: "Your branch is behind 'origin/main' by 3 commits, and can be fast-forwarded").
  - 상세:
    1. **동일 섹션 이중 수정.** #867 은 `spec/2-navigation/14-execution-history.md` 의 바로 그 `## Overview (제품 정의)` 섹션 안에서 `EH-DETAIL-06`(단일 노드, ✅) / `EH-DETAIL-12`(cross-node v2, ❌) 를 분리하고 R-6 Rationale 을 추가했다(7줄 diff). target 은 로컬 stale 파일(그 분리가 반영되기 전 버전) 위에서 같은 섹션 **전체(57줄)를 들어내** `_product-overview.md` 로 옮긴다. 두 변경이 같은 파일의 겹치는 라인 범위를 건드리므로 이 브랜치를 origin/main 에 rebase 하는 순간 충돌이 거의 확실하다.
    2. **외부 cross-ref 3+1곳이 여전히 EH-DETAIL-06 을 가리킨 채 방치.** #867 은 cross-node 참조를 `EH-DETAIL-06` → `EH-DETAIL-12` 로 재배선한 5곳을 이미 고쳤다 — `spec/conventions/conversation-thread.md`(5곳, 그 중 417행은 `[Spec Execution History §EH-DETAIL-06](../2-navigation/14-execution-history.md)` 형태의 실제 markdown 링크였다가 `EH-DETAIL-12`로 수정됨) · `spec/conventions/data-hydration-surfaces.md`(72행) · `spec/4-nodes/3-ai/1-ai-agent.md`(1156행) · `spec/0-overview.md §6.3`(로드맵 미러 행, "[Execution History EH-DETAIL-12](./2-navigation/14-execution-history.md)" 신설). 이 4개 파일 전부 링크가 여전히 `14-execution-history.md` 를 직접 가리킨다(fragment 없음) — target 이 이관을 완료하면 이 4곳은 다시 `_product-overview.md#315-execution-history-실행-내역` (또는 그에 준하는 앵커)를 가리키도록 **2차 수정**이 필요한데, target 의 계획에는 이 4개 파일 언급이 전혀 없다. target 이 "본문 anchor 만 있고 Overview/EH-* 매트릭스 anchor 참조는 없음"이라고 검증했다고 주장하지만, 이 검증은 `2-navigation/` 내부 backlink 만 확인한 것으로 보이며 `conventions/`·`4-nodes/` 의 위 참조들은 포함되지 않았다.
    3. **frontmatter `code:` 추가 대상 파일이 로컬 워크트리에 존재하지 않음.** target 변경 1 은 `spec/2-navigation/11-error-empty-states.md` frontmatter 에 `lib/workspace/workspace-slug-gate.tsx` 를 추가한다. 이 파일은 #869 이 신설한 `<WorkspaceSlugGate>` 컴포넌트로, **로컬 워크트리 `codebase/frontend/src/lib/workspace/` 에는 아직 존재하지 않는다**(`find`/`grep` 결과 0건 — origin/main 에는 존재). 지금 상태로 커밋하면 spec-impl-evidence `code:` 참조가 로컬 fetch 기준 죽은 경로를 가리키는 상태로 남는다.
    4. target 문서 자체가 참조하는 근거 리뷰 경로 `review/consistency/2026/07/09/14_08_26`(§변경2 서두 인용) 도 **현재 워크트리에 존재하지 않는다** — 이 산출물은 #869 커밋 이력의 일부로 origin/main 에만 있다. target 이 원용하는 impl-done 검토 자체가 로컬에 없는 상태에서 그 후속 조치만 로컬 stale 브랜치 위에서 진행되고 있다는 정황 증거.
  - 제안: target 커밋 전에 **먼저 `origin/main` 으로 pull/rebase**(로컬은 diverge 없이 뒤처지기만 하므로 fast-forward 가능)해 #867·#869 를 반영한다. 그 위에서 (a) `14-execution-history.md` 의 `## Overview` 섹션(이미 EH-DETAIL-06/12 분리·R-6 반영된 버전)을 `_product-overview.md §3.15` 로 재이관하고 (b) `conversation-thread.md`(5곳) · `data-hydration-surfaces.md` · `1-ai-agent.md` · `0-overview.md §6.3` 의 EH-DETAIL-06/12 링크를 `_product-overview.md#315-...` 로 재배선하며 (c) `11-error-empty-states.md` frontmatter 의 `workspace-slug-gate.tsx` 참조가 실제 존재 경로와 일치하는지 재확인한다.

- **[WARNING]** `spec/0-overview.md` §4(영역별 진입 문서) 테이블의 "실행 이력" 행이 이관 후 사실과 어긋남
  - target 위치: 변경 2 (Overview 섹션을 `_product-overview.md §3.15` 로 이관)
  - 충돌 대상: `spec/0-overview.md` §4 "영역별 진입 문서" 테이블, 현재(로컬 워크트리 기준) 다음 행이 존재—
    `| 실행 이력 | (Overview 섹션 통합) | [./2-navigation/14-execution-history.md](...) |`
    바로 아래 Webhook·Graph RAG 행과 같은 분류(§8 문서 컨벤션의 "단일 spec 파일 영역(예: webhook, graph-rag)은 본문 상단에 `## Overview (제품 정의)` 섹션을 직접 둔다" 패턴)로 묶여 있다.
  - 상세: target 이 이관을 완료하면 `14-execution-history.md` 는 더 이상 "Overview 섹션 통합" 단일-파일 패턴이 아니라, 형제 파일들(`0-dashboard`·`1-workflow-list` 등)과 같은 "제품 정의는 `_product-overview.md`, 상세는 번호 파일" 표준 2-navigation 패턴을 따르게 된다. 그런데도 root 레벨 cross-cutting 문서인 `0-overview.md` §4 테이블은 여전히 "실행 이력"을 Webhook/Graph RAG 와 같은 예외 부류로 잘못 분류한 채 남는다 — 이 표는 이미 "내비게이션 | `2-navigation/_product-overview.md` | ..." 행을 별도로 갖고 있으므로, 이관 후에는 "실행 이력" 행이 사실상 그 행에 흡수되어 중복/오분류가 된다.
  - 제안: target 범위에 `spec/0-overview.md` §4 테이블 수정(해당 행 제거 또는 "제품 정의" 칸을 `2-navigation/_product-overview.md#315-...` 로 정정)을 포함시킨다. (§8 문서 컨벤션 예시 문장 자체는 "webhook, graph-rag" 만 명시하고 execution-history 를 이름으로 언급하지 않아 별도 수정은 불요.)

## 요약
target 자체(두 파일의 순수 spec-doc 재배치)는 데이터 모델·API 계약·RBAC·상태 전이 관점에서 다른 영역과 직접 충돌하지 않는다. 그러나 실제 git 이력을 대조한 결과, target 이 근거로 삼는 로컬 워크트리 브랜치가 `origin/main` 에 이미 병합된 두 커밋(#867 EH-DETAIL-06/12 분리, #869 에디터 slug 화 — `WorkspaceSlugGate` 신설 포함)보다 뒤처져 있고, 이 두 커밋이 target 이 지금 다시 손대려는 바로 그 `14-execution-history.md` Overview 섹션 및 그것을 참조하는 4개 외부 spec 파일(`conversation-thread.md`·`data-hydration-surfaces.md`·`1-ai-agent.md`·`0-overview.md §6.3`)을 이미 수정해 두었다. rebase 없이 현재 상태로 커밋을 진행하면 (a) 같은 섹션을 두 계통이 각각 편집해 병합 충돌이 발생하거나 (b) 충돌이 기계적으로 해소되더라도 외부 4개 파일의 EH-DETAIL-06/12 참조가 새 위치(`_product-overview.md §3.15`)를 가리키지 못한 채 dangling 으로 남을 위험이 크다. 추가로 root 레벨 `0-overview.md` §4 테이블의 "실행 이력 = Overview 섹션 통합" 분류도 이관 후 정정이 필요하다.

## 위험도
CRITICAL
