# Plan 정합성 검토 결과

**검토 대상**: `plan/in-progress/spec-draft-rag-reranking.md`
**검토 모드**: spec draft (--spec)
**검토 일시**: 2026-06-04

---

## 발견사항

### [WARNING] `spec/4-nodes/3-ai/1-ai-agent.md` 동시 수정 — active worktree 와 충돌 가능
- **target 위치**: `spec-draft-rag-reranking.md §5`, §10 항목 4 ("spec/4-nodes/3-ai/1-ai-agent.md — §1 ragTopK/ragThreshold 의미 보강 노트")
- **관련 plan**: `claude/ai-context-memory-9c7e6e` branch — `spec/4-nodes/3-ai/1-ai-agent.md` 에 `memoryTopK`/`memoryThreshold` 신규 필드 2개를 추가하는 커밋 포함 (commit `cddf4453` 외 5건). 해당 branch 는 PR 미생성 상태이나 Step 1·2 양쪽에서 stale 신호 없음 → Step 3 보수적 fallback: active.
- **상세**: target plan 이 merge 되어 `spec/4-nodes/3-ai/1-ai-agent.md §1` 의 `ragTopK`/`ragThreshold` 행에 "리랭크 후 top-k / 점수 임계 해석" 주석을 추가할 때, `ai-context-memory-9c7e6e` 가 같은 파일 §1 표에 `memoryTopK`/`memoryThreshold` 행을 삽입한 상태라면 merge conflict 또는 누락 위험이 있다. 두 변경은 서로 다른 행(ragTopK 행 수정 vs 신규 행 삽입)이므로 의미 충돌(semantic conflict)은 없고, merge 시 수동 resolve 만 필요할 가능성이 높다.
- **제안**: `ai-context-memory-9c7e6e` 의 PR 상태를 확인(branch 에 PR 이 없다면 닫혔거나 직접 push 예정). target plan 의 §10-4 spec 반영 시점에 `ai-context-memory-9c7e6e` 의 main merge 여부를 확인하고, 필요 시 한쪽이 다른 쪽 위에서 rebase/resolve 하도록 직렬화 권장.

---

### [INFO] 미해결 결정 3건 — target 이 일방 결정 없이 열어둠 (양호)
- **target 위치**: `spec-draft-rag-reranking.md §Rationale "남은 결정(착수 전)"`
- **관련 plan**: `rag-quality-improvement.md §6` 의 미해결 결정 목록
- **상세**: target 이 3건(① RerankConfig provider 1차 지원 범위, ② escalate 조건 정량 임계, ③ KB "정책 판단 KB" 표시 방법)을 모두 "미확정"으로 명시하고 있어 parent plan 의 미해결 결정과 충돌하지 않음. 단 parent plan `rag-quality-improvement.md §6` 의 "남은 결정" 목록에 ③(정책 판단 KB 표시 방법)이 명시적으로 등재되지 않아 추적 누락 가능.
- **제안**: `rag-quality-improvement.md §6` 에 "KB 정책 판단 KB 표시 방법(플래그 vs 휴리스틱)" 결정 항목 추가.

---

### [INFO] `spec-sync-*` plan 다수(worktree: spec-sync-audit) — stale skip
- **상세**: `spec-sync-embedding-pipeline-gaps.md`, `spec-sync-structural-followups.md` 등 `worktree: spec-sync-audit` 를 참조하는 plan 다수가 `spec/5-system/9-rag-search.md` 등을 간접 참조할 수 있으나, `claude/spec-sync-audit` branch 가 Step 2 (PR MERGED) 판정으로 stale skip. 검토 대상 제외.
- **제안**: 아래 "Stale 으로 skip 한 worktree" 섹션 참조 — cleanup 권장.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 stale 판정으로 검토에서 제외한 항목:

| worktree | branch | 판정 |
|---|---|---|
| `spec-sync-audit` | `claude/spec-sync-audit` | Step 2: PR MERGED |
| `fix-bg-context-followups` | `claude/fix-bg-context-followups` | Step 2: PR MERGED |
| `fix-spec-frontmatter-catalog` | `claude/fix-spec-frontmatter-catalog` | Step 2: PR MERGED |
| `spec-drift-gates-b26bce` | `claude/spec-drift-gates-b26bce` | Step 2: PR MERGED |
| `workflow-turn-timing-69fee2` | `claude/workflow-turn-timing-69fee2` | Step 2: PR MERGED |
| `conventions-code-data-9b32d5` | `claude/conventions-code-data-9b32d5` | Step 2: PR MERGED |
| `fix-presentation-tool-default-dcecc3` | `claude/fix-presentation-tool-default-dcecc3` | Step 2: PR MERGED |
| `fix-web-chat-demo-apibase-cors` | `claude/fix-web-chat-demo-apibase-cors` | Step 2: PR MERGED |
| `node-cancellation-engine-6bfcaa` | `claude/node-cancellation-engine-6bfcaa` | Step 2: PR MERGED |
| `plan-grooming-2ec306` | `claude/plan-grooming-2ec306` | Step 2: PR MERGED |
| `spec-drift-resolve-efb608` | `claude/spec-drift-resolve-efb608` | Step 2: PR MERGED |
| `spec-inprogress-groom-c7568b` | `claude/spec-inprogress-groom-c7568b` | Step 2: PR MERGED |
| `spec-inprogress-impl2` | `claude/spec-inprogress-impl2` | Step 1: ancestor (STALE) |
| `spec-promote-c-sync` | `claude/spec-promote-c-sync` | Step 2: PR MERGED |
| `spec-sync-impl-644d19` | `claude/spec-sync-impl-644d19` | Step 2: PR MERGED |
| `switch-regex-workspace-uq` | `claude/switch-regex-workspace-uq` | Step 2: PR MERGED |
| `system-status-recent-failed-86831b` | `claude/system-status-recent-failed-86831b` | Step 2: PR MERGED |
| `web-chat-followups-close` | `claude/web-chat-followups-close` | Step 2: PR MERGED |
| `workspace-allowed-origins-settings` | `claude/workspace-allowed-origins-settings` | Step 2: PR MERGED |
| `cafe24-api-catalog-1665bd` | `claude/cafe24-api-catalog-1665bd` | Step 2: PR MERGED |
| `code-node-sandbox-979a97` | `claude/code-node-sandbox-979a97` | Step 2: PR MERGED |

해당 worktree 들이 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`spec-draft-rag-reranking.md` 는 parent plan `rag-quality-improvement.md` 의 D1·D2 결정을 충실히 구체화하고 있으며, 3건의 미해결 결정(provider 범위·escalate 임계·정책 KB 표시)을 모두 열린 상태로 유지해 parent plan 과의 충돌이 없다. 주요 주의사항은 `spec/4-nodes/3-ai/1-ai-agent.md` 를 동시에 수정 중인 `claude/ai-context-memory-9c7e6e` branch (Step 3 fallback active, PR 없음) 와의 잠재적 merge conflict 이며, 의미 충돌은 아니나 직렬화 권장(WARNING). 다른 4개 target spec 파일(`spec/5-system/9-rag-search.md`, `spec/5-system/7-llm-client.md`, `spec/2-navigation/5-knowledge-base.md`, `spec/5-system/10-graph-rag.md`)은 현재 active worktree 에서 동시 수정이 없어 경합 없음. worktree 충돌 후보 21건 중 stale 21건 skip, active 1건 분석(ai-context-memory).

---

## 위험도

LOW
