# Plan Coherence Review — Phase 3 Cafe24 Node UX Frontend

**Checker**: plan-coherence-checker
**Session**: review/consistency/2026/05/16/13_09_46/
**Worktree under review**: cafe24-node-ux-frontend-f5a3b8
**Target plan**: plan/in-progress/cafe24-node-resource-operation-ux.md (Phase 3)

---

### 발견사항

- **[CRITICAL]** i18n dict 파일을 이미 split 된 구조와 충돌하는 방식으로 수정 중
  - target 위치: Phase 3 worktree 의 uncommitted changes — `frontend/src/lib/i18n/dict/en.ts`, `frontend/src/lib/i18n/dict/ko.ts`
  - 관련 plan: PR #82 (`claude/i18n-dict-split-70d366`) 가 2026-05-16 main 에 머지되어 dict 를 `en/` / `ko/` 하위 22개 파일로 split 했다. Phase 3 worktree 는 현재 main 보다 12 commits 뒤에 있으며(`branch is behind 'origin/main' by 12 commits`), split 이전의 모놀리식 `en.ts`·`ko.ts` 를 직접 수정하고 있다.
  - 상세: Phase 3 가 추가하는 Cafe24 관련 i18n 키(`cafe24OperationSelectPlaceholder`, `cafe24FieldsRequired`, `cafe24FieldsOptional` 등)는 현재 main 기준으로는 `frontend/src/lib/i18n/dict/en/nodeConfigs.ts` 와 `frontend/src/lib/i18n/dict/ko/nodeConfigs.ts` 에 들어가야 한다. Phase 3 가 그대로 PR 을 올리면 이미 split 된 파일을 되돌리거나 두 모놀리식 파일이 동시에 존재하는 상태가 되어 빌드·테스트가 깨진다. harness-i18n-userguide-gap plan (PR #61) 이 도입한 `ko ↔ en parity 단위 테스트`도 split 구조를 전제하므로 동일하게 충돌한다.
  - 제안: Phase 3 worktree 를 main 으로 rebase(`git rebase origin/main`) 한 뒤 i18n 변경을 split 구조(`en/nodeConfigs.ts`, `ko/nodeConfigs.ts`)에 맞게 재작성해야 한다. 이 작업 없이는 PR 머지 불가.

- **[WARNING]** plan frontmatter 의 `worktree` 필드가 현재 작업 worktree 와 불일치
  - target 위치: `plan/in-progress/cafe24-node-resource-operation-ux.md` frontmatter 1행 — `worktree: cafe24-node-ux-catalog-4b8f2c (Phase 1) / cafe24-node-ux-impl-9d3e1a (Phase 2~)`
  - 관련 plan: Phase 3 는 `cafe24-node-ux-frontend-f5a3b8` worktree 에서 진행 중이지만 plan 에 이 worktree 이름이 등록되어 있지 않다. Phase 2 worktree (`cafe24-node-ux-impl-9d3e1a`) 는 PR #80 머지 후에도 제거되지 않고 남아 있으며, plan frontmatter 가 갱신되지 않아 plan_coherence 자동 검출(worktree 필드 기반)이 Phase 3 의 실제 작업 위치를 추적할 수 없다.
  - 제안: plan frontmatter 를 `worktree: cafe24-node-ux-frontend-f5a3b8 (Phase 3)` 로 갱신하고, `.claude/worktrees/cafe24-node-ux-impl-9d3e1a` worktree 를 `git worktree remove` 로 정리한다.

- **[WARNING]** Phase 2 체크박스가 plan 에서 미체크 상태이나 실제로는 완료됨
  - target 위치: `plan/in-progress/cafe24-node-resource-operation-ux.md` §Phase 2 체크리스트 — 10개 항목 전부 `[ ]`
  - 관련 plan: PR #80 (`claude/cafe24-node-ux-impl-9d3e1a`) 이 2026-05-16 main 에 머지되어 Phase 2 의 모든 백엔드 파일(`public-meta.ts`, `planned.ts`, `NodeComponent.extras`, `NodeDefinitionDto.extras` 등)이 main 에 존재함이 확인됐다. plan 문서는 갱신되지 않아 Phase 2 항목이 미완료로 보인다.
  - 제안: Phase 2 체크리스트 전체를 `[x]` 로 갱신하고 Phase 3 항목의 선행 조건 충족 여부를 명시한다. Phase 3 PR 올리기 전에 plan 을 동기화해야 혼선을 막는다.

- **[WARNING]** §9.9 Fields 편집 버퍼 Rationale 이 Phase 3 rewrite 로 부분 무효화될 수 있음
  - target 위치: `spec/4-nodes/4-integration/4-cafe24.md` §9.9 (Fields 편집 UI 의 내부 버퍼 분리)
  - 관련 plan: Phase 3 는 `Cafe24Config` 의 fields 영역을 KeyValueEditor 에서 metadata 기반 동적 폼(`required/optional 두 그룹, type 별 위젯`)으로 완전히 교체한다. §9.9 는 `Array<{key, value}>` 편집 버퍼 패턴을 "채택(B)" 로 기록하고 있으나, 이 패턴은 옛 KeyValueEditor 에 적용됐던 것이다. 새 동적 폼에서는 fields 가 `config.fields: Record<string, unknown>` 에 개별 위젯으로 직접 쓰이므로 `Array<{key, value}>` 버퍼가 더 이상 필요 없거나 다른 형태로 바뀐다. spec §2 가 이미 새 UX 를 기술하고 있으나, §9.9 는 옛 구조에 기반한 채로 남을 가능성이 있다.
  - 제안: Phase 3 구현이 완료된 뒤, spec §9.9 의 "채택(B)" 설명이 새 구현과 정합한지 확인하고, 더 이상 유효하지 않다면 project-planner 를 통해 §9.9 를 갱신하거나 Phase 3 의 새 fields 패턴을 명시하는 §9.10 을 추가한다. 본 PR 의 결정 사항이 아니므로 spec 수정은 후속 plan 에 기록한다.

- **[WARNING]** `cafe24-pending-polish.md` 의 `변경 1` FE 항목과 `shared.tsx` 수정의 잠재 중복 검토 필요
  - target 위치: Phase 3 변경 목록 — `shared.tsx` (SelectField disabled option 추가)
  - 관련 plan: `plan/in-progress/cafe24-pending-polish.md` 변경 1 에 `FE: reauthorize 버튼 비활성`, `FE: lastError.message status-badge detail 표시`, FE 폴링 훅 등 다수 frontend 항목이 미완료로 남아 있다. 해당 plan 의 worktree 는 `cafe24-pending-polish-7fdb7e` 이고 현재 활성 여부가 불분명하다. Phase 3 가 `shared.tsx` 에 SelectField disabled option 패턴을 추가하는데, 향후 변경 1 구현 시 동일 파일을 수정하게 되면 merge conflict 위험이 있다.
  - 제안: `cafe24-pending-polish.md` 의 변경 1 을 담당할 worktree 가 착수 전에 Phase 3 를 먼저 merge 한 main 기준으로 작업을 시작하도록 순서를 명시적으로 기록한다. `cafe24-pending-polish.md` 에 "Phase 3 PR 머지 후 착수" 메모를 추가한다.

- **[INFO]** Phase 2 worktree 미정리 — `cafe24-node-ux-impl-9d3e1a`
  - target 위치: `.claude/worktrees/cafe24-node-ux-impl-9d3e1a` (파일시스템에 존재)
  - 관련 plan: PR #80 머지 완료. CLAUDE.md 정책: "작업이 PR 로 merge 되면 즉시 `git worktree remove` 로 정리".
  - 제안: `git worktree remove .claude/worktrees/cafe24-node-ux-impl-9d3e1a` 로 정리.

- **[INFO]** `cafe24-pending-polish.md` — worktree 미등록 상태
  - target 위치: `plan/in-progress/cafe24-pending-polish.md` frontmatter `worktree: cafe24-pending-polish-7fdb7e`
  - 관련 plan: 해당 worktree 가 `.claude/worktrees/` 에 존재하지 않는다. plan 이 in-progress 상태이나 담당 worktree 가 없어 현재 어떤 상태인지 추적 불가. 변경 1 이하 다수 항목이 미완료.
  - 제안: 다음 착수자가 worktree 를 새로 만들고 frontmatter 를 갱신한다. 또는 plan 을 분기해 Phase 3 이후 신규 worktree 에서 이어받도록 한다.

---

### 요약

Phase 3 (`cafe24-node-ux-frontend-f5a3b8`) 의 핵심 구현 방향(integration-configs.tsx 재작성, shared.tsx SelectField disabled option, Cafe24Config 테스트)은 `spec/4-nodes/4-integration/4-cafe24.md` §2 의 목표 UX 와 정합하며, 다른 진행 중 plan 과 `integration-configs.tsx` 또는 `shared.tsx` 를 동시 수정하는 worktree 충돌은 발견되지 않았다. 그러나 가장 심각한 문제는 **i18n dict 구조 충돌**이다: PR #82 가 이미 main 에서 dict 를 22개 파일로 split 했는데 Phase 3 worktree 는 12 commits 뒤에 있어 모놀리식 `en.ts`·`ko.ts` 를 수정 중이다. rebase 없이 PR 을 올리면 빌드·parity 테스트가 즉시 깨진다. 추가로 plan frontmatter 의 worktree 필드 미갱신, Phase 2 체크박스 미갱신, §9.9 Rationale 의 잠재적 무효화, Phase 2 worktree 미정리 등 WARNING/INFO 수준의 추적 문제가 4건 발견됐다.

### 위험도

HIGH

---

*참조 파일*
- `plan/in-progress/cafe24-node-resource-operation-ux.md`
- `plan/in-progress/cafe24-pending-polish.md`
- `plan/in-progress/cafe24-pending-polish-followup.md`
- `plan/in-progress/cafe24-data-model-strengthen.md`
- `plan/in-progress/harness-i18n-userguide-gap.md`
- `spec/4-nodes/4-integration/4-cafe24.md` §2, §9.9
- `.claude/worktrees/cafe24-node-ux-frontend-f5a3b8/` (uncommitted: en.ts, ko.ts, integration-configs.tsx, shared.tsx)
- `.claude/worktrees/cafe24-node-ux-impl-9d3e1a/` (PR #80 머지 후 미정리)
