# Plan 정합성 검토 결과

대상: `plan/in-progress/spec-draft-rag-reranking.md`
검토 모드: --spec (spec draft 검토)

---

## 발견사항

### [CRITICAL] spec/1-data-model.md 동시 편집 — active worktree 경합

- **target 위치**: `plan/in-progress/spec-draft-rag-reranking.md` §10 item 5 (W1·W2 — §2.11 KnowledgeBase 5개 rerank 컬럼 + §2.N RerankConfig 엔티티 등재); 현재 worktree `rag-rerank-decisions-dd1d68` 에서 `spec/1-data-model.md` 를 실제 편집 중
- **관련 plan**: worktree `ai-context-memory-9c7e6e` (branch `claude/ai-context-memory-9c7e6e`) 가 동일 파일을 편집 중. Step 1: ACTIVE. Step 2: GitHub PR 상태 OPEN
- **상세**: `ai-context-memory-9c7e6e` 는 `spec/1-data-model.md` §1 ER 다이어그램에 `AgentMemory (1:N)` 엔티티를 추가하고 §2.23 AgentMemory 테이블 정의를 신설한다. `rag-rerank-decisions-dd1d68` 는 동일 파일의 §2.16.1 `RerankConfig.provider` 열 설명을 "1차: `tei` + `cohere`" 로 좁히는 결정 반영 편집을 수행 중이다. 두 편집은 파일 내 서로 다른 섹션을 건드려 자동 merge 가 성공할 수도 있으나, 동일 index 베이스(`1943c2be`)에서 분기한 두 diff 가 merge 시 conflict 또는 silent lost-update 가능성이 있다. target plan §10 item 4의 ⚠️ W5 경고는 `spec/4-nodes/3-ai/1-ai-agent.md` 에 대한 `ai-context-memory-9c7e6e` 경합을 인지했으나, **동일 경합 위험이 `spec/1-data-model.md` 에도 해당**한다는 점은 누락되어 있다.
- **제안**: `rag-rerank-decisions-dd1d68` PR 를 올리기 전 `ai-context-memory-9c7e6e` 가 main 에 merge 됐는지 확인. merge 된 경우 `spec/1-data-model.md` 를 rebase 후 편집. 미merge 시 두 PR 중 선행 PR merge 후 후속 PR 이 rebase 하는 직렬화 필요. `spec-draft-rag-reranking.md` §10 item 5 의 ⚠️ 경고 문구를 `spec/1-data-model.md` 도 포함하도록 갱신 권장.

---

### [WARNING] cross_encoder_llm "항상 LLM grading" 결정이 현행 spec/5-system/9-rag-search.md 와 불일치 (현재 worktree 에서 수정 중)

- **target 위치**: `spec-draft-rag-reranking.md` §4.2 및 Rationale "남은 결정 — 2026-06-04 확정 ②"
- **관련 plan**: `plan/in-progress/rag-quality-improvement.md` §6 — `[ ] P1 cross-encoder + D2 escalate 임계`, `[ ] "정책 판단 KB" 표시 방법` 이 main HEAD 에서 미체크
- **상세**: main HEAD 의 `spec/5-system/9-rag-search.md §3.3.2` 는 아직 "escalate 조건 충족 시" (조건부)로 기재되어 있고, `rag-quality-improvement.md §6` 은 해당 결정을 `[ ]` 미체크로 보여준다. target 문서는 이 두 항목을 "2026-06-04 확정"으로 해결하고, 현재 worktree 는 (a) `spec/5-system/9-rag-search.md` 를 "항상"으로 갱신, (b) `rag-quality-improvement.md §6` 을 `[x]` 로 체크하는 diff 를 포함하고 있어 worktree 내부에서 정합성이 유지된다. review 시점 기준으로 일시적 불일치를 기록.
- **제안**: 현재 worktree 의 두 변경이 같은 PR 에 포함됨을 확인. 이미 포함되어 있으므로 추가 조치 불필요 — 기록 목적.

---

### [WARNING] spec/4-nodes/3-ai/1-ai-agent.md 경합 — kb-quality-fba2f2 (active PR OPEN #457) 누락

- **target 위치**: `spec-draft-rag-reranking.md` §10 item 4 ⚠️ W5 경고 — `ai-context-memory-9c7e6e` 만 언급
- **관련 plan**: worktree `kb-quality-fba2f2` (PR #457 OPEN). Step 1 ACTIVE. Step 2 OPEN. 해당 워크트리가 `spec/4-nodes/3-ai/1-ai-agent.md` 를 편집 중
- **상세**: 현재 worktree(`rag-rerank-decisions-dd1d68`)는 `spec/4-nodes/3-ai/1-ai-agent.md` 를 직접 편집하지 않는다 — §10 item 4 의 실제 spec 반영은 이전 PR #455(`rag-quality-proposal-0c618c`, MERGED) 에서 완료됐다. 따라서 현재 PR 에서 직접 경합은 없다. 그러나 `kb-quality-fba2f2` 가 같은 파일을 편집 중이라는 사실이 W5 경고에서 누락되어 있다 — 향후 developer 가 spec 반영 작업을 시도할 경우 경합 위험을 사전에 인지해야 한다.
- **제안**: `spec-draft-rag-reranking.md` §10 item 4 의 W5 경고에 `kb-quality-fba2f2` PR #457 OPEN 도 추가 언급. 현재 worktree 가 해당 파일을 편집하지 않으므로 직접 차단은 아님.

---

### [INFO] rag-quality-proposal-0c618c worktree stale — cleanup 권장

- `rag-quality-proposal-0c618c` 워크트리(branch `claude/rag-quality-proposal-0c618c`)는 PR #455 MERGED(squash merge — Step 1 ACTIVE, Step 2 MERGED). Stale 로 판정. 현재 `spec/1-data-model.md` 등을 들고 있으나 main 에 이미 반영됨.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 stale 판정으로 skip 된 항목:

| worktree | branch | stale 판정 근거 |
|---|---|---|
| `rag-quality-proposal-0c618c` | `claude/rag-quality-proposal-0c618c` | Step 1 ACTIVE(squash-merge), Step 2 PR #455 MERGED |
| `competitive-analysis-e0569b` | `claude/competitive-analysis-e0569b` | Step 1 ACTIVE, Step 2 PR #454 MERGED |
| `fix-bg-context-followups` | `claude/fix-bg-context-followups` | Step 1 ACTIVE, Step 2 PR #451 MERGED |
| `fix-spec-frontmatter-catalog` | `claude/fix-spec-frontmatter-catalog` | Step 1 ACTIVE, Step 2 PR #453 MERGED |
| `makeshop-api-catalog-730deb` | `claude/makeshop-api-catalog-730deb` | Step 1 ACTIVE, Step 2 PR #456 MERGED |
| `spec-exec-intake-queue` | `claude/spec-exec-intake-queue` | Step 1 ACTIVE, Step 2 PR #458 MERGED |
| `spec-inprogress-groom-c7568b` | `claude/spec-inprogress-impl2` | Step 1 STALE (ancestor of main) |

해당 worktree들은 활성으로 남아있을 이유가 없다. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

**stale 판정 불가(active 처리):**
- `integration-index-unify-2c7973` (branch `claude/integration-index-unify-2c7973`): Step 1 ACTIVE, Step 2 PR 없음 → fallback ACTIVE. `spec/1-data-model.md` Integration.mall_id/index 관련 편집 중. stale 판정 cascade Step 1/2 모두 음성. active 로 처리 — 실제 stale 이면 `cleanup-worktree-all.sh` 실행 후 재검토 권장. 편집 영역이 `rag-rerank-decisions-dd1d68` 와 다른 섹션이라 직접 경합 없음.
- `persistent-enhance-32f236` (branch `claude/persistent-enhance-32f236`): Step 1 ACTIVE, Step 2 PR 없음 → fallback ACTIVE. `spec/1-data-model.md` 편집 중(AgentMemory 신설). stale 판정 cascade Step 1/2 모두 음성. active 로 처리 권장.

---

## 요약

`spec-draft-rag-reranking.md` 는 `rag-quality-improvement.md §6` 에서 열려있던 3항목(provider 1차 범위 / escalate→항상 / 정책 KB 표시)을 2026-06-04 기준으로 합법적으로 확정하고 있으며, 현재 worktree 내에서 `spec/5-system/9-rag-search.md`, `spec/5-system/7-llm-client.md`, `spec/1-data-model.md`, `rag-quality-improvement.md` 를 일관되게 갱신하고 있어 내부 정합성은 양호하다. 주요 위험은 `spec/1-data-model.md` 에 대한 `ai-context-memory-9c7e6e` (PR OPEN) 와의 동시 편집 경합으로, merge 시 conflict 또는 silent lost-update 가능성이 있다. `spec/4-nodes/3-ai/1-ai-agent.md` 는 현재 worktree 가 직접 편집하지 않아 직접 경합 없으나, W5 경고 대상에 `kb-quality-fba2f2` PR #457 이 누락된 정보 부재가 있다. worktree 충돌 후보 12건 중 stale 7건 skip, active 5건(ai-context-memory-9c7e6e [CRITICAL], kb-quality-fba2f2 [WARNING 간접], integration-index-unify-2c7973 [INFO], persistent-enhance-32f236 [INFO], rag-rerank-decisions-dd1d68 [target 자신]) 분석.

---

## 위험도

MEDIUM
