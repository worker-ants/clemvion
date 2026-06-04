# Plan 정합성 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/5-system/)
대상 target: `spec/5-system/` 전체 (1-auth.md, 10-graph-rag.md, 11-mcp-client.md 포함)
실제 관련 구현 대상: `spec-draft-rag-reranking.md` §10 (rag-rerank P1 구현 착수)

---

## 발견사항

### [CRITICAL] `spec/4-nodes/3-ai/1-ai-agent.md` 동시 수정 경합 — active worktree 확인됨

- **target 위치**: `spec-draft-rag-reranking.md` §10 항목 4 — `spec/4-nodes/3-ai/1-ai-agent.md` 의 `ragTopK`/`ragThreshold` 의미 보강 노트. 파일 경로가 `spec/5-system/` 밖이지만 rag-rerank 구현 착수 시 수정 필수 파일임.
- **관련 plan**: `plan/in-progress/spec-draft-rag-reranking.md` §10 항목 4, W5 경고 명시 — "착수 전 `claude/ai-context-memory-9c7e6e` branch(같은 파일 §1 에 `memoryTopK`/`memoryThreshold` 추가, active·PR 없음) 의 main merge 여부 확인 — 미merge 시 직렬화/수동 resolve".
- **상세**: `claude/ai-context-memory-9c7e6e` 브랜치 (PR #459 OPEN)가 `spec/4-nodes/3-ai/1-ai-agent.md` §1 config 표에 `memoryStrategy`/`memoryTopK`/`memoryThreshold`/`memoryKey`/`memoryTokenBudget` 필드를 추가하고 §6.1 실행 흐름을 대규모 개정한다. rag-rerank 구현 시 같은 파일의 `ragTopK`/`ragThreshold` 행 의미 보강 노트를 추가해야 하므로, 두 변경이 동일 파일(같은 §1 표)에서 충돌한다. PR #459 가 merge 되지 않은 상태에서 rag-rerank 구현이 같은 파일을 수정하면 merge 시 conflict 가 발생한다.
- **제안**: rag-rerank P1 구현 착수 전 PR #459 (`claude/ai-context-memory-9c7e6e`) 의 main merge 여부를 확인하고, 미merge 시 직렬화(PR #459 먼저 merge 후 착수) 또는 두 브랜치 조율 후 수동 resolve 계획을 수립해야 한다. `spec-draft-rag-reranking.md` W5 에서 이미 명시한 사항이나 여전히 미해소 상태다.

---

### [WARNING] `spec/2-navigation/5-knowledge-base.md` 동시 수정 — active worktree 중복 작업 위험

- **target 위치**: `spec-draft-rag-reranking.md` §10 항목 3 — `spec/2-navigation/5-knowledge-base.md` 에 KB rerank 컬럼·UI, 워크스페이스 RerankConfig 관리 추가.
- **관련 plan**: `claude/kb-quality-fba2f2` 브랜치 (PR OPEN — `gh pr list` 조회 결과 OPEN) 가 `spec/2-navigation/5-knowledge-base.md` 를 수정 중. 이미 동 브랜치에서 reranking 관련 한 줄(`리랭킹 (Reranking)` 행)을 추가했다.
- **상세**: `git diff origin/main...claude/kb-quality-fba2f2 -- spec/2-navigation/5-knowledge-base.md` 결과에서 리랭킹 행이 이미 추가되어 있다. rag-rerank 구현이 같은 파일의 같은 섹션(KB 생성 폼 / 상세 화면 spec)을 추가로 수정하면 두 브랜치 간 파일 충돌이 발생할 수 있다.
- **제안**: `claude/kb-quality-fba2f2` 의 `spec/2-navigation/5-knowledge-base.md` 변경 범위를 파악해 rag-rerank 구현 시 중복 편집 또는 충돌 구간을 확인한다. kb-quality 브랜치가 reranking 항목을 일부 선반영했으므로 rag-rerank 착수 전 해당 PR 의 merge 상태 또는 변경 범위를 조율해야 한다.

---

### [WARNING] `rag-quality-improvement.md §6` 미결 결정 3건 — rag-rerank P1 구현 경계에 일부 포함

- **target 위치**: rag-rerank 구현 착수 범위인 P1 (검색 후처리: 동적컷 + cross-encoder + listwise grading).
- **관련 plan**: `plan/in-progress/rag-quality-improvement.md` §6 미결 결정 항목 — ① `cross_encoder_llm` escalate 조건의 정량 임계(점수 분산·평탄도, "P0 평가셋으로 튜닝") ② "정책 판단 KB" 표시 방법(플래그 vs 휴리스틱, `spec-draft-rag-reranking.md §4.2`). `spec-draft-rag-reranking.md` Rationale 의 "남은 결정(착수 전)" 에서도 ① RerankConfig provider 1차 지원 범위 ② escalate 조건 정량 임계 ③ KB "정책 판단 KB" 표시 방법 3건이 미결로 명시되어 있다.
- **상세**: escalate 조건(§4.2)과 "정책 판단 KB" 표시 방법은 `cross_encoder_llm` 모드 구현 시 코드로 결정을 내려야 하는 항목이다. spec 에서 "플래그 vs 휴리스틱" 이 미결인 상태에서 구현이 일방적으로 한 방식을 채택하면 §1 미해결 결정 우회에 해당한다. 단 `cross_encoder` (기본) 모드만 구현하는 경우 이 항목은 즉각적인 차단 사유가 되지 않는다.
- **제안**: P1 착수 시 `cross_encoder` 단독 구현 먼저 진행하고, `cross_encoder_llm` escalate 구현 전에 "정책 판단 KB 표시 방법" 과 "escalate 정량 임계" 를 사용자와 합의한 후 spec(`spec-draft-rag-reranking.md §4.2` + `spec/5-system/9-rag-search.md §3.3.2`) 를 보완한다.

---

### [INFO] `spec/5-system/1-auth.md` — `plan/in-progress/auth-config-webhook-followups.md` 미완 항목 다수 (구현 착수 무관)

- **target 위치**: `spec/5-system/1-auth.md` (frontmatter `pending_plans: auth-config-webhook-followups.md`).
- **관련 plan**: `plan/in-progress/auth-config-webhook-followups.md` §1 AuthConfig CRUD audit 기록 미구현, §3 spec 보완 미완. 해당 plan 의 worktree 는 `(assigned at impl-start)` 로 아직 미착수.
- **상세**: rag-rerank 구현은 `spec/5-system/1-auth.md` 를 수정할 이유가 없으므로 충돌 없음. 단 `spec/5-system/1-auth.md` 가 `partial` 상태인 이유가 본 followups 에 있음을 파악하는 용도로 기록.

---

### [INFO] `spec/5-system/11-mcp-client.md` — `spec-sync-mcp-client-gaps.md` 미구현 항목 (구현 착수 무관)

- **target 위치**: `spec/5-system/11-mcp-client.md` (frontmatter `pending_plans: spec-sync-mcp-client-gaps.md`).
- **관련 plan**: `plan/in-progress/spec-sync-mcp-client-gaps.md` — `mcpDiagnostics` 미구현 5건, `spec-sync-audit` worktree 소유.
- **상세**: rag-rerank 구현과 교차점 없음. 기록만.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 발견:
- `rag-quality-proposal-0c618c` (branch `claude/rag-quality-proposal-0c618c`) — Step 2 PR #455 MERGED → **stale skip**. 해당 plan 의 변경사항은 이미 main 에 포함(spec-draft-rag-reranking.md, rag-quality-improvement.md 가 PR #455 로 merge됨). worktree 가 활성으로 남아있을 이유 없음 — `./cleanup-worktree-all.sh --yes --force` 실행 권장.

active 충돌 후보:
- `ai-context-memory-9c7e6e` (branch `claude/ai-context-memory-9c7e6e`) — Step 1 ACTIVE, Step 2 PR #459 OPEN → active 처리. CRITICAL 분류.
- `kb-quality-fba2f2` (branch `claude/kb-quality-fba2f2`) — Step 2 PR OPEN → active 처리. WARNING 분류.

---

## 요약

`spec/5-system/` 의 핵심 rag-rerank 대상 파일들(`spec/5-system/9-rag-search.md`, `spec/5-system/7-llm-client.md`, `spec/5-system/10-graph-rag.md`)은 main 에서 Planned 표기로 이미 spec 반영이 완료되어 있어, 구현 착수를 위한 spec 기반이 갖춰져 있다. 그러나 rag-rerank 구현 시 필수 수정 파일인 `spec/4-nodes/3-ai/1-ai-agent.md` 가 active PR #459(`claude/ai-context-memory-9c7e6e`, OPEN) 와 동시 작업 충돌(CRITICAL)이 발생하며, `spec/2-navigation/5-knowledge-base.md` 도 active `claude/kb-quality-fba2f2` 브랜치와 중복 수정 위험(WARNING)이 있다. `cross_encoder_llm` escalate 조건의 미결 결정 2건도 구현 전 합의가 필요하다. worktree 충돌 후보 2건 중 stale 1건 skip(`rag-quality-proposal-0c618c`, PR #455 MERGED), active 2건 분석.

---

## 위험도

HIGH
