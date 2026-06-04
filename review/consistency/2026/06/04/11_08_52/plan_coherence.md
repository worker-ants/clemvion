# Plan 정합성 검토 결과

검토 대상: `spec/5-system/` (--impl-done, diff-base=origin/main, worktree=rag-rerank-impl)
검토 시점: 2026-06-04

---

## 발견사항

### [WARNING] spec-draft-rag-reranking.md 의 남은 결정 미해소 — ai-agent.md ragThreshold 의미 재해석 미반영

- **target 위치**: `spec/5-system/9-rag-search.md §3.3.1` 검색 후처리 흐름; `spec/5-system/7-llm-client.md §5 config` 설명
- **관련 plan**: `plan/in-progress/spec-draft-rag-reranking.md §5 config` 항목 4 — `spec/4-nodes/3-ai/1-ai-agent.md §1 ragTopK/ragThreshold 의미 보강`(리랭크 후 top-k / `rerank_mode≠off` KB 에서는 rerank 점수 임계로 해석, W5)
- **상세**: `spec-draft-rag-reranking.md §10 반영 대상 spec` 항목 4는 `spec/4-nodes/3-ai/1-ai-agent.md §1 ragThreshold` 행에 "rerank_mode≠off 시 rerank 점수 임계로 해석"이라는 분기 주석을 명시하도록 요구한다. rag-rerank-impl 브랜치는 `spec/4-nodes/3-ai/1-ai-agent.md` 를 수정하지 않았다. 이 반영은 spec-draft plan 이 "일관성 검토 통과 후 반영 완료" 라고 표기한 6개 파일 중 하나이므로 누락이다.
- **제안**: `plan/in-progress/rag-rerank-followup.md` 에 "`spec/4-nodes/3-ai/1-ai-agent.md §1 ragThreshold` 의미 보강(rerank_mode 분기 주석)" 항목을 추가하거나, rag-rerank-impl PR 에서 ai-agent.md 를 수정해 반영한다. ai-context-memory-9c7e6e 가 이미 ai-agent.md §1 을 수정 중이므로(memoryTopK/memoryThreshold 추가), 머지 이후 수동 resolve 또는 직렬화 필요.

---

### [WARNING] ai-context-memory-9c7e6e 브랜치와 spec/1-data-model.md 동시 편집 (active worktree 경합)

- **target 위치**: `spec/1-data-model.md §2.11 KnowledgeBase` (rerank 컬럼 5개 변경) / `spec/1-data-model.md §1 ER 다이어그램` + `§2.23 AgentMemory`
- **관련 plan**: `plan/in-progress/spec-draft-rag-reranking.md §10` 항목 5 (data-model.md KnowledgeBase rerank 컬럼 + RerankConfig 엔티티)
- **상세**: `claude/rag-rerank-impl` 브랜치는 `spec/1-data-model.md §2.11` KnowledgeBase 테이블에 rerank 관련 컬럼 5개를 수정한다. `claude/ai-context-memory-9c7e6e` 브랜치(PR OPEN)는 동일 파일에서 `§1 ER 다이어그램` + `§2.23 AgentMemory 신규 섹션` + `§4 인덱스 표` 를 추가한다. 두 브랜치가 같은 파일의 서로 다른 섹션을 수정하므로 병합 시 충돌(특히 ER 다이어그램 라인 RerankConfig 항목)이 발생할 수 있다. spec-draft-rag-reranking.md §10 W5 주석은 이미 이 경합을 인지하고 "main merge 여부 확인" 을 명시했으나, 두 브랜치 모두 PR OPEN 상태이므로 여전히 미해소다.
- **제안**: 두 브랜치 중 먼저 머지되는 쪽이 `spec/1-data-model.md` 를 커밋하고, 나중 브랜치는 main 리베이스 후 충돌을 수동 해결한다. rag-rerank-impl 이 먼저 머지 예정이라면 ai-context-memory 브랜치가 rebase 해야 한다.

---

### [WARNING] spec/5-system/9-rag-search.md 의 pending_plans 에 존재하지 않는 plan 파일 참조

- **target 위치**: `spec/5-system/9-rag-search.md` frontmatter `pending_plans: [plan/in-progress/rag-rerank-followup.md]`
- **관련 plan**: `plan/in-progress/rag-rerank-followup.md` — rag-rerank-impl 브랜치 내에만 존재, main 에 미머지
- **상세**: rag-rerank-impl 브랜치가 `spec/5-system/9-rag-search.md` frontmatter 에 `plan/in-progress/rag-rerank-followup.md` 를 등록했는데, 이 파일은 현재 main 에 존재하지 않는다(브랜치 내부에만 있음). PR 이 머지될 때 `plan/in-progress/rag-rerank-followup.md` 가 main 에 없으면 `spec-pending-plan-existence` 가드가 FAIL 한다. 브랜치가 plan 파일과 spec frontmatter 를 함께 추가하는 것이 의도이므로, PR 범위에 `plan/in-progress/rag-rerank-followup.md` 도 포함되어야 한다.
- **제안**: git diff 로 확인하면 `rag-rerank-followup.md` 가 브랜치 커밋에 이미 포함되어 있는지 확인 필요. 포함되어 있다면 문제없음. 미포함 시 PR 에 추가한다.

---

### [INFO] rag-quality-improvement.md 의 미해결 결정 — Postgres 배포 환경(P2 선결) 및 정책 판단 KB 표시 방법

- **target 위치**: `spec/5-system/9-rag-search.md §3.3` 리랭킹 설명 전반
- **관련 plan**: `plan/in-progress/rag-quality-improvement.md §6 남은 결정`  
  - `Postgres 배포 환경(RDS/Aurora·Cloud SQL·Supabase·self-host) → P2 lexical 스택 분기. P2 최선결`  
  - `"정책 판단 KB" 표시 방법(플래그 vs 휴리스틱) — cross_encoder_llm escalate 조건의 판단 근거`
- **상세**: target(rag-rerank-impl)은 `cross_encoder` P1 구현을 완료했으며, 위 두 미결 결정은 P2(하이브리드 검색)와 `cross_encoder_llm` 모드(후속)에 해당한다. rag-rerank-impl PR 자체는 P1 범위만 다루므로 직접 충돌은 없다. 그러나 후속 구현자가 `cross_encoder_llm` 모드 착수 시 "정책 판단 KB 표시 방법" 결정이 선결 필요하다는 점을 인지하도록 `rag-rerank-followup.md` 에 명시 권장.
- **제안**: `plan/in-progress/rag-rerank-followup.md` 에 "착수 전 결정 필요: rag-quality-improvement.md §6 의 '정책 판단 KB 표시 방법' 결정 선행" 메모 추가.

---

### [INFO] kb-quality-fba2f2 브랜치(PR MERGED) — stale worktree 정리 권장

- **상세**: `claude/kb-quality-fba2f2` 브랜치는 Step 2 cascade 에서 PR #457 MERGED 확인. Step 1 에서 ancestor 검사가 ACTIVE 로 나온 것은 squash-merge 로 commit hash 가 변경되었기 때문이다. PR 이 종결됐으므로 해당 worktree(`kb-quality-fba2f2`)는 stale이다.

---

## Stale 으로 skip 한 worktree

worktree 충돌 후보 중 stale 판정으로 skip 된 항목:

- `rag-quality-proposal-0c618c` (branch `claude/rag-quality-proposal-0c618c`) — Step 1 ACTIVE, Step 2 PR MERGED. squash-merge 로 stale 확인. spec/5-system/9-rag-search.md 에 대한 plan 문서 worktree이나 코드·spec 변경 없음(리서치/제안 문서). 경합 없음으로 처리.
- `kb-quality-fba2f2` (branch `claude/kb-quality-fba2f2`) — Step 1 ACTIVE, Step 2 PR #457 MERGED. `spec/4-nodes/3-ai/1-ai-agent.md`·`spec/5-system/4-execution-engine.md` 등 수정이 있으나 PR 종결됨 → stale.

이 두 worktree 는 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`spec/5-system/` 구현 완료 검토 관점에서 CRITICAL 차단 사항은 없다. 주요 발견사항은 두 WARNING 이다: (1) `spec/4-nodes/3-ai/1-ai-agent.md §1 ragThreshold` 의미 보강이 rag-rerank-impl 브랜치에 누락 — spec-draft-rag-reranking.md 의 공표된 반영 목록 항목 4 미이행. (2) `claude/ai-context-memory-9c7e6e`(PR OPEN)가 `spec/1-data-model.md` 를 동시 편집 중이어서 머지 순서 조율이 필요하다. spec frontmatter pending_plans 파일 존재 여부는 브랜치 diff 포함 여부에 따라 무해할 수 있다(INFO 수준). worktree 충돌 후보 7건 중 stale 2건(rag-quality-proposal, kb-quality) skip, active 1건(ai-context-memory) 분석.

---

## 위험도

MEDIUM
