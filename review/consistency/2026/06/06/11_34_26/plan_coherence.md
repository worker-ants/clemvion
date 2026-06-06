# Plan 정합성 검토 결과

검토 모드: `--impl-done` (구현 완료 후 검토)
Target 범위: `spec/5-system/` (변경 파일: `7-llm-client.md`, `8-embedding-pipeline.md`, `9-rag-search.md`, `17-agent-memory.md`)
Plan: `plan/in-progress/embedding-model-ux.md` (worktree: `embedding-model-ux-c40698`)

---

## 발견사항

### [INFO] rag-rerank-followup.md 의 유일 미해소 항목이 target 과 간접적으로 연관

- target 위치: `spec/5-system/7-llm-client.md` frontmatter `pending_plans: [plan/in-progress/rag-rerank-followup.md]`
- 관련 plan: `plan/in-progress/rag-rerank-followup.md` — 미해소 항목 1건: "conditional escalate 정량 임계 (P0 평가셋 보정 후 도입)"
- 상세: `rag-rerank-followup.md` 의 worktree(`rag-rerank-impl`)는 PR #465 로 이미 MERGED(stale). 그러나 plan 자체는 `in-progress/` 에 남아있고 `7-llm-client.md` frontmatter 가 이를 가리킨다. embedding-model-ux 는 `7-llm-client.md §3.3` 에 embed 시그니처를 추가하는데, 이 변경은 rag-rerank-followup 의 미해소 항목(conditional escalate 임계)과 직접 충돌하지는 않는다. 단, `7-llm-client.md` 의 `status: partial` 이 `rag-rerank-followup` 때문에 유지되는 상황에서 embedding-model-ux 가 해당 파일을 추가로 편집하고 있어 완료 조건 추적이 복잡해질 수 있다.
- 제안: embedding-model-ux 완료 후 `rag-rerank-followup.md` 를 `complete/` 로 이동하거나, conditional escalate 항목을 분리 plan 으로 추출해 `7-llm-client.md` frontmatter 갱신 여부 검토. embedding-model-ux plan 변경 불요.

---

### [INFO] ai-context-memory-followup-v2.md 가 17-agent-memory.md 에 남은 spec-drift 항목 5건 존재

- target 위치: `spec/5-system/17-agent-memory.md` frontmatter `pending_plans: [plan/in-progress/ai-context-memory-followup-v2.md]`
- 관련 plan: `plan/in-progress/ai-context-memory-followup-v2.md` (worktree: `ai-context-memory-9c7e6e`) — PR #459 MERGED(stale). plan 자체는 아직 `in-progress/` 에 있으며 미해소 항목 약 15건(SPEC-DRIFT 포함) 잔존.
- 상세: embedding-model-ux 는 `17-agent-memory.md §3·§4` 에 임베딩 계층 준수 주석과 비대칭 색인 안내를 추가한다. ai-context-memory-followup-v2 의 미해소 spec-drift 항목(`§3 AGM-04 "scheduleBackgroundBody snapshot" 표현 갱신` 등)은 embedding-model-ux 가 변경하는 섹션과 다른 섹션이므로 직접 충돌 없음. 최종 rebase 시 낮은 context-diff 충돌 가능성만 존재.
- 제안: 충돌 위험 낮음. embedding-model-ux 머지 후 ai-context-memory-followup-v2 작업자가 `17-agent-memory.md` rebase 시 context 확인 권장. plan 변경 불요.

---

### [INFO] 9-rag-search.md 를 수정한 두 worktree 가 이미 MERGED — 충돌 없음

- target 위치: `spec/5-system/9-rag-search.md` (비대칭 입력 1줄 추가)
- 관련: `rag-eval-harness-b8cc46`(PR MERGED) 와 `rag-eval-plan-hygiene-279c3e`(PR MERGED) 모두 `9-rag-search.md` 를 수정했으나 이미 main 에 반영됨. embedding-model-ux 의 변경은 origin/main 기준으로 깔끔하게 분기. 충돌 없음.
- 제안: 조치 불요. stale worktree cleanup 권장(아래 섹션 참조).

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 stale 판정으로 검토에서 제외된 항목:

- `rag-eval-harness-b8cc46` (branch `claude/rag-eval-harness-b8cc46`) — Step 1: ACTIVE → Step 2: PR state MERGED
  - `spec/5-system/9-rag-search.md` 수정 포함. 이미 main 에 반영됨.
- `rag-eval-plan-hygiene-279c3e` (branch `claude/rag-eval-plan-hygiene-279c3e`) — Step 1: ACTIVE → Step 2: PR state MERGED
  - `spec/5-system/9-rag-search.md` 수정 포함. 이미 main 에 반영됨.
- `ai-context-memory-9c7e6e` (worktree 디렉토리 없음, plan frontmatter 참조만 존재) — Step 2: PR #459 state MERGED
  - `spec/5-system/17-agent-memory.md` 수정 포함. 이미 main 에 반영됨.
- `rag-rerank-impl` (worktree 디렉토리 없음, plan frontmatter 참조만 존재) — Step 2: PR #465 state MERGED
  - `spec/5-system/7-llm-client.md` 수정 포함. 이미 main 에 반영됨.

이 worktree 들은 정리되지 않은 stale 상태. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

embedding-model-ux plan(`spec/5-system/7-llm-client.md`, `8-embedding-pipeline.md`, `9-rag-search.md`, `17-agent-memory.md` 갱신)은 현재 진행 중인 plan 들과 CRITICAL/WARNING 수준의 충돌 없음. 미해결 결정 우회 없음. 주요 확인 사항: `rag-rerank-followup.md` 가 `7-llm-client.md` 의 pending_plan 으로 등록된 상태에서 embedding-model-ux 도 동일 파일을 편집하나, 수정 섹션이 다르고 의미 충돌이 없어 INFO 등급. `ai-context-memory-followup-v2.md` 의 `17-agent-memory.md` 미해소 spec-drift 도 동일 이유로 INFO. 활성 worktree 중 `7-llm-client.md`, `8-embedding-pipeline.md`, `17-agent-memory.md` 를 동시에 수정하는 다른 worktree 없음. worktree 충돌 후보 4건 전부 stale skip (Step 2 PR MERGED 확인).

## 위험도

NONE
