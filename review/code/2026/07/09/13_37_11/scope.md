<!-- main 이 journal(wf_7f9e5923-759)에서 복원 — subagent write 격리. -->

# 변경 범위(Scope) Review — 에디터 슬러그 라우팅 phase 2

## 검증 방법
`review/code/2026/07/09/13_37_11/_prompts/scope.md` 의 28개 파일 diff 전량을 검토했고, 실제 worktree(`/Volumes/project/private/clemvion/.claude/worktrees/editor-slug-phase2-f9a46b`)에서 `git diff --stat origin/main...HEAD -- codebase/ plan/ spec/` 로 대조해 **payload 의 28개 파일이 실제 changeset 과 정확히 일치**함을 확인했다. 또한 payload 상 `editor-loader.tsx`/`page.tsx` 가 "new file" 로 표시된 부분은 git 이 100% rename 유사도로 인식한 순수 이동(diff 0 lines)이며, 구 경로(`(editor)/workflows/[id]/*`)가 dangling 으로 남지 않았음을 실측 확인했다.

### 발견사항

- **[INFO]** `(main)/w/[slug]/layout.tsx` 대규모 diff(-60줄)는 게이트 로직을 `lib/workspace/workspace-slug-gate.tsx` 로 추출하는 순수 리팩터
  - 위치: `codebase/frontend/src/app/(main)/w/[slug]/layout.tsx`, `codebase/frontend/src/lib/workspace/workspace-slug-gate.tsx`
  - 상세: 라인 diff 만 보면 "관련 없는 대규모 리팩터"로 보일 수 있으나, `plan/in-progress/editor-slug-phase2.md` 의 "잠금된 결정(사용자 확인)" 절에 "(main)/w/[slug]/layout.tsx 의 로직을 공용 컴포넌트로 추출해 (editor) 와 공유" 가 명시적으로 사전 승인돼 있다. 추출된 `WorkspaceSlugGate` 내용을 원본 inline 로직과 대조한 결과 로직·동작 변경 없이 그대로 이동(pure extraction)했다.
  - 제안: 조치 불필요 — 계획된 범위 내 정당한 리팩터.

- **[INFO]** spec/ 문서 7개(`0-dashboard.md`, `1-workflow-list.md`, `14-execution-history.md`, `9-user-profile.md`, `_layout.md`, `2-edge.md`, `data-flow/12-workspace.md`)가 developer 워크트리에서 직접 수정됨
  - 위치: `spec/2-navigation/*.md`, `spec/3-workflow-editor/2-edge.md`, `spec/data-flow/12-workspace.md`
  - 상세: CLAUDE.md 규약상 developer 는 `spec/` read-only 이고 spec 변경 필요 시 project-planner 위임이 원칙이나, plan 파일 자체가 이를 인지하고("S7 은 spec 변경이라 developer 권한 밖... phase-1 은 code+spec 원자 PR 였음" 선례 인용) 코드-스펙 원자 PR 로 진행하기로 명시적으로 기록해뒀다. 내용도 이번 코드 변경(에디터 slug 편입) 사실만 정정하는 최소 diff(각 파일 1~2줄)라 "무관한 수정"에는 해당하지 않는다.
  - 제안: 코드 관점에서는 문제 없음. 다만 이 PR 이 실제로 project-planner 경유 없이 병합되는 것이 이번 프로젝트의 정식 프로세스 선례(phase-1)와 일치하는지는 별도 프로세스 확인 사항으로 남겨둘 만하다(scope reviewer 소관 밖의 policy 이슈로만 인지).

- **[INFO]** `no-raw-editor-href.test.ts` 신규 guard 테스트는 기존 `no-raw-execution-href.test.ts` 패턴을 대칭 복제한 방어 코드
  - 위치: `codebase/frontend/src/lib/workspace/__tests__/no-raw-editor-href.test.ts`
  - 상세: 이번 변경으로 에디터 캔버스도 slug-aware 링크가 필수가 되었으므로, 기존에 이미 존재하는 실행-경로 guard 와 동일한 방어 테스트를 신설하는 것은 "요청하지 않은 기능 확장"이 아니라 이번 변경이 만든 새 invariant(“에디터 링크는 항상 `buildEditorHref` 를 통해야 한다”)를 지키기 위한 필수 부대 조치로 판단된다. plan 의 S5 항목에도 "에디터 캔버스 링크 guard 추가 여부는 구현 중 판단"으로 명시돼 있어 계획된 의사결정 범위 안에 있다.
  - 제안: 조치 불필요.

- **[INFO]** `auth-provider.tsx`, `editor-toolbar.tsx`, `no-raw-execution-href.test.ts` 는 순수 주석/설명 문구 갱신만 포함
  - 위치: 위 3개 파일
  - 상세: 실제 로직 diff 없이 "phase 1 예외" 서술을 "phase 2 편입" 사실에 맞게 정정하는 주석뿐이며, 실질 코드 변경과 섞여 있지 않고 별도 diff hunk 로 분리돼 있다. plan S4/S5 에 정확히 대응한다.

발견된 나머지 22개 파일(`href.ts` 신규 `buildEditorHref` 추가, 라우트 이동 2건, 소비처 slug href 배선 8건, e2e/유닛 테스트 4건, layout 3건)은 모두 plan 의 S1~S6 작업 표면과 1:1 대응하며, 무관한 파일·포맷팅 노이즈·불필요한 임포트·설정 변경은 발견되지 않았다.

### 요약

리뷰 대상 28개 파일은 `plan/in-progress/editor-slug-phase2.md` 에 사전 기록된 S1~S7 작업 항목과 정확히 1:1 대응하며, 실제 git 히스토리 대조로도 changeset 이 payload 와 완전히 일치함을 확인했다. `(main)/w/[slug]/layout.tsx` 의 대규모 diff 와 spec/ 문서 7건 수정은 표면적으로는 "범위 이상"으로 보일 수 있으나, 둘 다 사용자가 사전 승인한 "잠금된 결정"에 정확히 부합하고 phase-1 선례를 따른 것이라 실질적인 scope creep 이 아니다. 포맷팅 전용 변경, 무관한 파일 수정, 불필요한 리팩토링, 미사용 임포트, 과도한 기능 확장은 발견되지 않았다.

### 위험도
NONE