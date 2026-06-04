### 발견사항

- **[WARNING]** `2-text-classifier.md` / `3-information-extractor.md` frontmatter가 main과 발산함
  - target 위치: `spec/4-nodes/3-ai/2-text-classifier.md` 및 `spec/4-nodes/3-ai/3-information-extractor.md` — frontmatter 전체
  - 관련 plan: `plan/complete/spec-sync-text-classifier-gaps.md` / `plan/complete/spec-sync-information-extractor-gaps.md` (이미 complete 이동 완료)
  - 상세: 현재 worktree(`ai-context-memory-9c7e6e`) 의 두 파일은 `status: partial` + `pending_plans: [spec-sync-text-classifier-gaps.md, spec-sync-information-extractor-gaps.md]` 를 유지하고 있다. 그러나 main 에서 PR #448 / #452 가 해당 spec-sync 항목을 전부 구현·완료하여 두 파일을 `status: implemented` 로 승격하고 `pending_plans` 키를 제거했다. 브랜치 fork 기준 커밋 `66f4ffd9` 이후 main 에 들어온 변경이므로 merge 시 해당 두 파일에서 충돌이 발생한다. `ai-context-memory-followup-v2.md` 의 "text_classifier / information_extractor 자동 주입(contextScope/memoryStrategy) 확장 v2" 항목은 이 충돌과 별개로 여전히 유효한 미구현 항목이나, 두 파일의 frontmatter 상태 표현이 엇갈린 채로 PR 을 열면 reviewer 혼선이 생긴다.
  - 제안: merge 전(또는 Phase G REVIEW 완료 직전) 에 두 파일을 main 의 `implemented` 상태로 rebase/revert 하거나, PR description 에 "이 두 파일의 frontmatter 는 main 에서 이미 `implemented` 로 갱신됐으므로 merge 시 main 버전 채택" 을 명시한다. `pending_plans` 가 이미 `plan/complete/` 에 이동됐으므로 spec frontmatter 에서도 제거가 맞다.

- **[INFO]** `ai-agent-tool-connection-rewrite.md` 미해결 결정과 충돌 없음
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §1 (config 스키마) / §4 (Tool Area 연동)
  - 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §1 — 도구 등록 모델·시그니처 위치·실행 컨텍스트·결과 라우팅 전부 TBD
  - 상세: target spec 은 "재작성 예정 (현재 제거됨)" 박스와 `(Planned)` 표기로 미해결 상태를 정확히 보존하고 있다. `toolNodeIds`/`toolOverrides` 필드, Tool Area UX, `tool_*` 도구 이름, `TOOL_EXECUTION_FAILED` 코드 등이 모두 비활성 주석 처리돼 있고 일방적 결정을 내리지 않았다. 정합.
  - 제안: 현 상태 유지. 결정 사항 없음.

- **[INFO]** Phase G (REVIEW) 미완 — 현재 진행 중인 검토의 의도된 미완료 상태
  - target 위치: `plan/in-progress/ai-context-memory-auto.md` §4 Phase G
  - 관련 plan: 동일 (`ai-context-memory-auto.md`)
  - 상세: Phase G `[ ]` 는 본 consistency check 가 Phase G 의 일부임. BLOCK 사유가 아니라 현재 실행 중인 검토의 기대 상태. Phase F 까지 모두 완료 표기됨.
  - 제안: 현재 consistency check + ai-review 완료 후 Phase G 체크박스 채우면 됨.

- **[INFO]** `ai-context-memory-followup-v2.md` v2 항목이 target spec 에 올바르게 미반영됨
  - target 위치: `spec/4-nodes/3-ai/0-common.md` §10 / `spec/conventions/conversation-thread.md` §2.3
  - 관련 plan: `plan/in-progress/ai-context-memory-followup-v2.md`
  - 상세: v2 항목 ("text_classifier / information_extractor 자동 주입 확장", "persistent 증분 추출", "persistent TTL", 등) 은 현재 spec 에 v2 로드맵으로만 언급되고 구현 약속을 하지 않는다. `0-common.md §10` 의 "v1 은 ai_agent 만 push + 자동 주입" 명시, `conversation-thread.md §2.3` 의 "v2 에 추가" 표기가 정확히 대응한다. 이 plan 이 `pending_plans` 로 등재돼 `status: partial` 을 유지하는 근거도 명확.
  - 제안: 현 상태 유지.

---

### Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 중 stale 판정 cascade 로 skip 된 항목:

- `workflow-turn-timing-69fee2` (branch `claude/workflow-turn-timing-69fee2`) — Step 1: ACTIVE (squash merge 로 ancestor 검사 통과 안 함) → Step 2: PR #445 state=MERGED → **stale**. `conversation-thread.md` 를 수정했으나 PR 머지 완료. target 브랜치 fork 기준(`66f4ffd9`) 이전 merge 임을 확인. 충돌 대상 제외.
- `claude/spec-sync-audit` (branch `claude/spec-sync-audit`) — Step 1: ACTIVE (squash) → Step 2: PR #443 state=MERGED → **stale**. target spec 과 동일 파일군 수정이 있었으나 PR 머지 완료. 충돌 대상 제외.
- `claude/kb-quality-fba2f2` (branch `claude/kb-quality-fba2f2`) — Step 1: STALE (ancestor 검사 통과) → **stale**.
- `claude/spec-inprogress-impl2` (branch `claude/spec-inprogress-impl2`) — Step 1: STALE → **stale**.

skip 된 4건 모두 정리되지 않은 worktree 로 남아 있을 수 있음. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

활성 worktree 중 target spec 과 중첩이 없는 것:
- `claude/fix-spec-frontmatter-catalog` — `spec/conventions/cafe24-api-catalog/_overview.md` / `spec/conventions/spec-impl-evidence.md` 만 수정. target 영역(`spec/4-nodes/3-ai/`) 과 무관. 충돌 없음.
- `claude/fix-bg-context-followups` / `claude/competitive-analysis-e0569b` — target spec 파일 미수정 확인.

---

### 요약

`spec/4-nodes/3-ai/` target 은 plan 정합성 측면에서 전반적으로 양호하다. 미해결 결정(`ai-agent-tool-connection-rewrite` TBD 항목) 을 일방적으로 우회하는 변경은 없고, `ai-context-memory-followup-v2` v2 항목도 spec 에 정직하게 "v2" 로만 표기돼 있다. 한 가지 주의 항목은 `2-text-classifier.md` / `3-information-extractor.md` 의 frontmatter 가 fork 이후 main 에서 `implemented` 로 승격된 것과 발산한다는 점으로(WARNING), merge 직전 두 파일 frontmatter 를 main 버전으로 맞춰야 충돌 없이 합쳐진다. worktree 충돌 후보 4건은 모두 stale(Step 2 MERGED 판정) 로 분류해 skip 했으며, 활성 worktree 중 target 영역과 실질적으로 경합하는 것은 없다.

### 위험도

LOW
