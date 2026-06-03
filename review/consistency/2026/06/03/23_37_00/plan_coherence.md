# Plan 정합성 검토 결과

검토 모드: `--impl-done` (구현 완료 후, scope=`spec/4-nodes/3-ai/`, diff-base=origin/main)
검토 일시: 2026-06-03

---

## 발견사항

### [CRITICAL] kb-quality-fba2f2 worktree 와 동일 spec 파일 병렬 편집 충돌

- **target 위치**: `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/conventions/conversation-thread.md`
- **관련 plan**: `plan/in-progress/knowledge-base-quality-improvements.md` (worktree `kb-quality-fba2f2`)
- **상세**: worktree `kb-quality-fba2f2` (branch `claude/kb-quality-fba2f2`) 가 현재 ACTIVE 상태이며 target worktree `ai-context-memory-9c7e6e` 와 동일한 세 spec 파일을 동시 편집 중이다.
  - `spec/4-nodes/3-ai/0-common.md` — `ai-context-memory-9c7e6e` 는 frontmatter(`status: partial`, `pending_plans`), §10 `memoryStrategy` 행 및 설명 추가, §11.4 ordering [5]→[5a/5b/5c/6] 재구조화. `kb-quality-fba2f2` 는 동 파일 내 §10 cross-link 앵커 수정(`#23-v1-적용-범위` → `#23-적용-범위`) 및 §11.4/§Rationale 내 link anchor 수정.
  - `spec/4-nodes/3-ai/1-ai-agent.md` — `ai-context-memory-9c7e6e` 는 대규모 memory 관련 필드/로직/출력 구조 추가. `kb-quality-fba2f2` 는 동 파일 내 WebSocket cross-link 앵커 7건 및 다른 spec anchor fix.
  - `spec/conventions/conversation-thread.md` — 양쪽 모두 수정.
  - `kb-quality-fba2f2` 의 변경 성격은 **링크 앵커 fix(내용 변경 없음)** 이고, `ai-context-memory-9c7e6e` 의 변경은 **신규 기능 spec 추가(content 변경)**이므로 의미적 충돌은 없으나, 두 branch 를 merge 할 때 3-way conflict 가 발생할 가능성이 높다. 특히 `0-common.md §11.4` 부근과 `1-ai-agent.md §7.5` 부근은 양쪽 모두 인접 라인을 편집해 diff 충돌 가능성이 크다.
  - `kb-quality-fba2f2` 는 PR 미개설 (gh pr list 결과 없음), Step 3 fallback → active 처리.
- **제안**: 두 worktree 중 어느 쪽이 먼저 merge 되더라도 나머지 쪽이 rebase 시 수동 충돌 해소가 필요하다. `ai-context-memory-9c7e6e` 가 완성·PR 후 `kb-quality-fba2f2` 가 rebase 하거나, 반대로 `kb-quality-fba2f2` 가 먼저 merge 되어 anchor 가 확정된 후 `ai-context-memory-9c7e6e` 가 그 기준으로 anchor 를 맞추는 순서를 조율해야 한다. 병렬 merge 시도 시 충돌 해소자가 두 branch 의 변경 의도를 모두 파악해야 한다.

---

### [WARNING] ai-context-memory-followup-v2.md 의 spec 정밀화 항목이 target spec 에 미반영

- **target 위치**: `spec/4-nodes/3-ai/0-common.md §10`, `spec/4-nodes/3-ai/1-ai-agent.md §7/§6.1/§12.10/§12.11`, `spec/5-system/_product-overview.md`, `spec/conventions/conversation-thread.md §7`
- **관련 plan**: `plan/in-progress/ai-context-memory-followup-v2.md` §spec 정밀화 백로그
- **상세**: 다음 7개 항목이 followup-v2 plan 의 열린 체크박스(`[ ]`)로 명시되어 있으며 target spec 에 아직 반영되지 않은 상태:
  - W-11: `0-common.md §10` memoryStrategy 행에 `[AI Agent §12.9]` 근거 링크 누락
  - W-12: `0-common.md §10` `includeToolTurns` 행에 push/inject 분리 한 줄 누락
  - W-3: `1-ai-agent.md §7` Config echo 열거에 memory 5필드(`memoryStrategy`/`memoryTokenBudget`/`memoryKey`/`memoryTopK`/`memoryThreshold`) 추가 누락
  - W-7: `0-common.md §10` 첫 단락 "v1 세 노드 모두 push 출하, ai_agent 만 inject" 로 정밀화 누락
  - W-8: `1-ai-agent.md §6.1 d.5` summary_buffer vs persistent 분기 명시 누락
  - W-10: `spec/5-system/_product-overview.md` 에 AGM-01~07 등재 누락
  - I-11: `conversation-thread.md §7` Token-aware cap 에 "tokenizer-exact 는 v3 잔존" 명시 누락
  - W-6: Redis TTL 만료 시 runningSummary 유실 fallback 정책 명시 누락
  - I-6: `1-ai-agent.md §12.10/12.11` 에 요약 LLM 모델 재사용(별도 필드 없음) Rationale 소항 누락
  이 항목들은 plan 에 "의도적으로 v2 로 미룬" 것으로 기록되어 있으므로 현 구현 완료 후 검토 시점의 spec 상태와 plan 의 기대가 정합하다. 단, target spec 의 `pending_plans: plan/in-progress/ai-context-memory-followup-v2.md` 참조가 이 gap 을 추적하므로 spec 파일의 `status: partial` 이 올바름을 확인.
- **제안**: target spec 의 현 상태(partial + pending_plans)는 plan 의 의도와 정합. 별도 갱신 불요. 단, followup-v2 착수 시 위 항목들이 spec 에 반영되었는지를 이 plan 정합성 검토로 재확인해야 한다.

---

### [WARNING] ai-agent-tool-connection-rewrite.md 의 5개 미결 설계 결정이 target spec §4 "재작성 예정" 박스와 연동

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md §1` 주의 박스 ("도구 연결 입력 경로 — 재작성 예정") 및 `§4 Tool Area 연동` 박스
- **관련 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §1 결정 항목 5개 (도구 등록 모델/시그니처 위치/실행 컨텍스트/결과 라우팅/ND-AG-21 유지 여부) 전부 TBD
- **상세**: target spec 은 `toolNodeIds`/`toolOverrides` 필드와 Tool Area UX 를 "재작성 예정 (현재 제거됨)" 으로 올바르게 표기하고 있다. `ai-agent-tool-connection-rewrite.md` 의 5개 설계 결정이 TBD 인 상태에서 target spec 이 이를 일방적으로 결정하지는 않았다 — 현행 spec 이 비활성 박스만 유지하므로 충돌 없음. 단, ai-context-memory 구현 과정에서 `ai-agent.handler.ts` 의 `classifyToolCalls` dispatcher 분류 표가 `cond_* → kb_* → mcp_* → render_*` 4-step 으로 고정되었으며, `tool-connection-rewrite.md` 의 §3 spec 작성 단계에서는 이 순서 표에 `tool_*` 5번째 단계를 추가해야 한다. 이 연동 사항은 `tool-connection-rewrite.md` 본문에 이미 명시되어 있어 plan 간 정합은 유지되고 있다.
- **제안**: 현재는 충돌 없음. `ai-agent-tool-connection-rewrite.md` 착수 전 `1-ai-agent.md §6.1 step 3a` 의 dispatcher 순서 표(현재 4-step)를 확인하고 `tool_*` 추가 시 5-step 으로 갱신하는 것을 plan §3 spec 작성 체크리스트에 명시해 두는 것이 권장된다.

---

### [INFO] fix-spec-frontmatter-catalog worktree 의 별도 spec 파일 편집

- **target 위치**: `spec/4-nodes/3-ai/` (간접)
- **관련 plan**: worktree `fix-spec-frontmatter-catalog` (branch `claude/fix-spec-frontmatter-catalog`)
- **상세**: `fix-spec-frontmatter-catalog` worktree 는 `plan/in-progress/fix-spec-frontmatter-catalog.md` 와 연관되며 spec frontmatter 정합화를 수행 중이다. git diff 결과 `spec/4-nodes/3-ai/` 파일들과의 직접 충돌은 없음 (0 overlap). 단, frontmatter `status`/`pending_plans` 관련 가드 로직이 두 worktree 에서 병렬 실행 중이므로 merge 순서를 주의해야 한다.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 stale 판정으로 skip 된 항목:

- `spec-inprogress-groom-c7568b` (branch `claude/spec-inprogress-impl2`) — Step 1: `git merge-base --is-ancestor` 결과 ACTIVE(exit 1, branch HEAD 가 main 의 조상 아님). Step 2: `gh pr list --state all --head claude/spec-inprogress-impl2` → PR state `MERGED`. **stale 판정(Step 2)**. `spec/4-nodes/3-ai/` 와의 파일 중복을 확인하지 않아도 이미 병합 완료된 branch 이므로 충돌 위험 없음. worktree cleanup 권장.

해당 worktree 가 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`ai-context-memory-9c7e6e` worktree 의 target spec(`spec/4-nodes/3-ai/`) 은 Plan 정합성 관점에서 대체로 양호하다. 미해결 설계 결정(`ai-agent-tool-connection-rewrite.md` 5개 TBD)을 spec 이 일방적으로 결정하지 않고 "재작성 예정" 박스로 올바르게 보존하고 있으며, followup-v2 의 spec 정밀화 backlog 항목들은 `pending_plans` 추적으로 관리되고 있다. 주요 위험은 **`kb-quality-fba2f2` worktree 와의 동일 파일 병렬 편집** 으로, 이 worktree 는 active 상태(PR 미개설, Step 1/2 모두 stale 아님, Step 3 fallback active)이며 link anchor 수정 목적이라 의미적 충돌은 없으나 3-way merge 시 diff 충돌이 예상된다. worktree 충돌 후보 7개 worktree 중 stale 1건(spec-inprogress-impl2 — MERGED PR 확인) skip, active 1건(kb-quality-fba2f2) 분석.

---

## 위험도

MEDIUM
