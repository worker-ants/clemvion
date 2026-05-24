# Plan 정합성 검토 결과

검토 대상: `plan/in-progress/form-resubmit-fix.md`
검토 모드: plan draft 검토 (--plan)
검토 일시: 2026-05-24

---

## 발견사항

### [WARNING] spec 변경 shape 가 기존 spec SoT 와 명시적 충돌

- **target 위치**: `plan/in-progress/form-resubmit-fix.md` §변경 범위 §코드 1번, §Spec 1번·2번
- **관련 plan**: `plan/in-progress/ai-presentation-tools.md` §4.1 (MERGED — PR #271, 2026-05-22) 및 현재 main 의 `spec/4-nodes/3-ai/1-ai-agent.md §6.2 step 2.c`, `spec/4-nodes/6-presentation/0-common.md §10.9 layer (4)`
- **상세**: 현재 spec 은 `render_form` submit 시 tool_result content 를 `{type:'form_submitted', data:{…}}` 로 정의한다 (ai-agent §6.2 step 2.c, presentation/0-common §10.9 표의 layer (4) 행). 이 shape 는 PR #271 (ai-presentation-tools) + PR #288 (render-form 수정) + PR #297 (render_form 인라인 통합) 을 거쳐 main 에 정착한 SoT 다. target plan 은 여기에 `ok: true`, `rendered: false`, `message: <안내문>` 3 필드를 추가하는 새 shape 를 제안한다. 이는 spec SoT 와 실질적으로 충돌하는 shape 변경이므로, project-planner 를 통한 spec 선행 갱신이 필요하다. plan 본문에 "project-planner 위임" 체크리스트 항목이 이미 있고 사용자 결정이 2026-05-24 에 명시적으로 기록되어 있으므로, **결정 자체는 적법하게 내려졌다**. 단, spec 갱신이 아직 미실행 상태( `[ ] project-planner 위임` )인 채 코드 구현 체크리스트까지 나열되어 있어 순서 선행 조건이 명확히 강제되지 않는 구조가 위험하다. 즉, spec 선행 갱신 없이 구현 착수가 가능한 체크리스트 순서가 되어 있다.
- **제안**: plan 체크리스트에서 `[ ] 코드 구현 (handler.ts + PRESENTATION_TOOLS_GUIDANCE)` 과 `[ ] 테스트 선작성` 이 `[ ] project-planner 위임` 에 명시적으로 의존함을 표기하거나, project-planner 위임 항목이 완료된 후에만 진행하도록 순서 주석을 보강할 것. (예: "↳ 선행: project-planner 위임 완료 후 진행")

---

### [WARNING] `ai-presentation-tools.md` 가 `plan/in-progress/` 에 잔존

- **target 위치**: 해당 없음 (target plan 의 `related_spec` 가 ai-presentation-tools 완료 결과물과 겹치는 spec 파일)
- **관련 plan**: `plan/in-progress/ai-presentation-tools.md` (worktree: `ai-presentation-tools-9b7c5c`)
- **상세**: `ai-presentation-tools-9b7c5c` 브랜치의 PR #271 은 2026-05-22 에 MERGED 됐다. 그러나 `plan/in-progress/ai-presentation-tools.md` 는 `plan/complete/` 로 이동되지 않은 채 `plan/in-progress/` 에 남아 있다. target plan 의 `related_spec` 파일 두 개(`spec/4-nodes/3-ai/1-ai-agent.md`, `spec/4-nodes/6-presentation/0-common.md`) 가 모두 ai-presentation-tools plan 이 다룬 파일과 동일하다. stale plan 문서가 in-progress 에 잔존하면 §1 미해결 결정 확인, §3 선행 조건 판단 시 혼란을 초래하고 cleanup-worktree-all.sh 등의 자동화 도구가 오판할 수 있다.
- **제안**: `git mv plan/in-progress/ai-presentation-tools.md plan/complete/ai-presentation-tools.md` 로 이동 후 form-resubmit-fix 작업을 진행할 것.

---

### [WARNING] `PRESENTATION_TOOLS_GUIDANCE` 안내문 변경이 다른 활성 plan 에 미치는 영향 미검토

- **target 위치**: `plan/in-progress/form-resubmit-fix.md` §변경 범위 §코드 2번
- **관련 plan**: `plan/in-progress/ai-timezone-kst-e2e.md` (pending worktree), `plan/in-progress/multiturn-error-preserve.md` (in-progress)
- **상세**: target plan 은 `PRESENTATION_TOOLS_GUIDANCE` 상수에 `form_submitted` 처리 안내 라인을 추가한다. 이 상수는 AI Agent 의 system prompt 일부이므로 LLM 행동에 영향을 준다. `ai-timezone-kst-e2e.md` 는 system prompt 내용을 단언하는 e2e spec 을 작성하고, `multiturn-error-preserve.md` 는 multi-turn 대화 흐름을 다루는 plan 이다. 두 plan 이 `PRESENTATION_TOOLS_GUIDANCE` 의 안내 라인 추가를 인지하지 못한 채로 system prompt 단언을 고정하면 회귀가 발생할 수 있다. 직접 충돌은 아니지만 후속 항목 갱신이 필요한 케이스다.
- **제안**: `ai-timezone-kst-e2e.md` 의 Phase B systemPrompt 단언이 안내 라인 추가 후에도 통과하는지 확인 주석을 target plan 에 추가하거나, 해당 plan 에 호환성 주의 노트를 추가할 것.

---

### [INFO] `form-resubmit-fix` worktree 브랜치가 main 과 동일 HEAD

- **target 위치**: `plan/in-progress/form-resubmit-fix.md` frontmatter `worktree: .claude/worktrees/form-resubmit-fix-b1caa8`
- **관련 plan**: 없음 (단순 관찰)
- **상세**: `claude/form-resubmit-fix-b1caa8` 브랜치의 HEAD(`f9fdd97f`)가 `origin/main` HEAD 와 동일하다. Step 1 ancestor 검사에서 STALE 신호가 나왔으나 plan 상태가 `status: in-progress` 이고 체크리스트에 미완료 항목이 다수 남아 있으므로 stale worktree 가 아니라 **이제 막 브랜치를 딴 초기 상태**다. 실제 작업이 아직 시작되지 않은 것으로 판단. 이후 첫 commit 이 push 되면 Step 1 결과가 ACTIVE 로 전환될 것이므로 현시점 worktree 충돌 우려 없음.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 검토 중 다음 항목이 stale 판정으로 제외됨:

- `ai-presentation-tools-9b7c5c` (branch `claude/ai-presentation-tools-9b7c5c`) — Step 1: ACTIVE (squash merge 로 commit hash 변환됨), Step 2: PR #271 MERGED (2026-05-22T14:08:16Z). Step 2 stale 판정으로 §5 worktree 충돌 검토 대상에서 제외. spec 파일이 이미 main 에 반영되어 있으므로 실질 경합 없음.
- `spec-slack-discord-chat-channel-bb4d35` (branch `claude/spec-slack-discord-chat-channel-bb4d35`) — Step 1: ACTIVE (squash merge), Step 2: PR #300 MERGED. target plan 의 관련 파일과 무관 (chat-channel 전용 파일 조작) — 충돌 대상 아님. stale 판정으로 skip.

**stale 으로 판정된 2개 worktree 가 활성으로 남아있을 이유가 없다.** `./cleanup-worktree-all.sh --yes --force` 실행을 권장한다.

---

## 요약

`form-resubmit-fix.md` plan 은 사용자 결정이 명시적으로 기록된 valid한 fix plan 이다. 주요 정합성 쟁점은 두 가지다. 첫째, target plan 이 제안하는 tool_result content shape (`ok: true` + `message` 가드 필드 추가) 가 현재 spec SoT (`spec/4-nodes/3-ai/1-ai-agent.md §6.2 step 2.c` 및 `spec/4-nodes/6-presentation/0-common.md §10.9 layer (4)`) 에 정의된 `{type:'form_submitted', data:{…}}` shape 와 충돌하므로, project-planner 위임을 통한 spec 선행 갱신이 코드 착수 전에 완료되어야 한다 (체크리스트 순서 강제 필요). 둘째, PR #271 (ai-presentation-tools) merge 이후 `plan/in-progress/ai-presentation-tools.md` 가 complete 로 이동되지 않아 같은 spec 파일을 다루는 stale 계획 문서가 in-progress 에 잔존 중이므로 cleanup 이 선행되면 혼선을 줄일 수 있다. worktree 충돌 후보 7건 중 stale 2건(ai-presentation-tools-9b7c5c, spec-slack-discord-chat-channel-bb4d35) skip, active 2건(apply-brand-logo-049314, form-resubmit-fix-b1caa8 초기 상태) 분석 — active 2건 모두 target plan 과의 파일 경합 없음.

---

## 위험도

MEDIUM
