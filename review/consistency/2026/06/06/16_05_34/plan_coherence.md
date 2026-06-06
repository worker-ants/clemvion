# Plan 정합성 검토 결과

검토 모드: 구현 완료 후 (--impl-done)
대상 문서: `spec/5-system/9-rag-search.md` (구현 변경 diff 기반)
기준 시각: 2026-06-06

---

## 발견사항

### [INFO] rag-rerank-followup.md 의 conditional escalate 정량 임계 — 미해결 결정, 구현에서 provisional default 로 명시 처리됨
- target 위치: `codebase/backend/src/modules/knowledge-base/search/rerank.service.ts` lines 793–795 (`ESCALATE_TOP_SCORE_FLOOR = 0.6`, `ESCALATE_FLAT_REL_GAP = 0.05`)
- 관련 plan: `plan/in-progress/rag-rerank-followup.md` line 18 — "conditional escalate 정량 임계 A/B 확정은 P0 baseline 후속"
- 상세: `rag-rerank-followup.md` 가 "정량 임계 A/B 확정은 P0 골든셋 후속"으로 미결로 남겨둔 항목이다. 구현 diff 는 이 임계를 코드에서 provisional default 값(0.6 / 0.05)으로 채웠다. 그러나 이 사실은 `spec-draft-rag-dynamic-cut.md` §A8 에 "합리적 default 로 시작, P0 A/B 후속"으로 명문화되어 있고, `rag-dynamic-cut.md` 설계 결정 §D2 에 "정량 임계 A/B 확정은 실 골든셋 확보 후 follow-up"으로 사전 합의됐으며, `spec/5-system/9-rag-search.md` §3.3.2 v1 결정·Rationale 에도 동일 내용이 반영됐다. provisional 처리가 미해결 결정을 일방 확정한 것이 아니라 "합리적 default + 후속 A/B" 합의를 따른 것이므로 충돌로 볼 수 없다. 다만 `rag-rerank-followup.md` line 18 이 `[~]` 로 갱신되어 있는지 확인 권장.
- 제안: 이미 spec/plan 에 "provisional + 후속 A/B" 로 명문화됐으므로 추가 조치 불요. `rag-rerank-followup.md` line 18 이 `[~] conditional escalate — 메커니즘 구현 완료(rag-dynamic-cut PR), 정량 임계 A/B 후속` 으로 반영됐는지 최종 커밋 전 확인.

---

### [INFO] rag-dynamic-cut.md 체크리스트 §9·§10 미완료
- target 위치: `plan/in-progress/rag-dynamic-cut.md` 체크리스트 line 34–35
- 관련 plan: `plan/in-progress/rag-dynamic-cut.md` 자체
- 상세: 현재 diff 는 구현(§5–7)·TEST WORKFLOW(§8)가 완료된 상태다. `/ai-review + fix + consistency-check --impl-done`(§9) 와 plan 정리(§10) 는 아직 체크되지 않은 상태로 보인다. 본 consistency-check 실행은 `--impl-done` scope 의 일부이므로, 이 review 완료 후 체크박스 갱신 필요.
- 제안: 본 검토 완료 후 `rag-dynamic-cut.md` §9 체크박스 체크 + §10 plan 정리 진행.

---

### [INFO] pgvector ef_search / ivfflat.probes 후속 follow-up — plan 추적 누락
- target 위치: `spec/5-system/9-rag-search.md` §Rationale "pgvector 인덱스 파라미터 (follow-up)" 항목
- 관련 plan: 해당 follow-up 을 추적하는 in-progress plan 없음
- 상세: spec `9-rag-search.md` Rationale 에 "wide 회수(`LIMIT RAG_RECALL_K=50`) 도입으로 `hnsw.ef_search`/`ivfflat.probes` 파라미터 조정이 필요할 수 있다 — 프로덕션 부하 측정 후 후속"이 명시됐다. 이 follow-up 을 추적하는 plan 항목이 현재 in-progress 어디에도 없다.
- 제안: `rag-quality-improvement.md` §7.E(리뷰 backlog) 또는 `rag-rerank-followup.md` 에 pgvector 인덱스 파라미터 follow-up 1행 추가 권장 (비차단, INFO 수준).

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 분석: target plan `rag-dynamic-cut.md` 가 수정하는 파일군(`spec/5-system/9-rag-search.md`, `codebase/backend/src/modules/knowledge-base/search/`, `codebase/backend/src/nodes/ai/ai-agent/`, `codebase/frontend/src/content/docs/`, `codebase/frontend/src/lib/i18n/backend-labels.ts`) 과 다른 active worktree 간 중복 여부를 §5번 관점으로 검토했다.

충돌 후보 worktree 및 stale 판정 결과:

- `rag-rerank-impl` (branch `claude/rag-rerank-impl`) — Step 1: ACTIVE (비조상), Step 2: PR #478 MERGED → **stale**
- `rag-quality-proposal-0c618c` (branch `claude/rag-quality-proposal-0c618c`) — Step 1: ACTIVE, Step 2: PR MERGED → **stale**
- `exec-park-b2b-04a2f8` (branch `claude/exec-park-b2b-04a2f8`) — Step 1: ACTIVE, Step 2: PR MERGED → **stale** (RAG 파일 미접촉 확인)
- `harden-review-hooks-cb1c84` (branch `claude/harden-review-hooks-cb1c84`) — Step 1: ACTIVE, Step 2: PR #493 MERGED → **stale** (RAG 파일 미접촉 확인)
- `exec-park-durable-resume` (branch `claude/exec-park-pr-b2`) — Step 1: ACTIVE, Step 2: PR #494 MERGED → **stale** (RAG 파일 미접촉 확인)
- `plan-complete-p6-043804` (branch `claude/plan-complete-p6-043804`) — Step 1: ACTIVE, Step 2: PR MERGED → **stale** (RAG 파일 미접촉 확인)
- `impl-exec-concurrency-cap` (branch `claude/impl-concurrency-cap-pr2b`) — Step 1: ACTIVE, Step 2: PR 없음(빈 결과), Step 3: active 로 처리. 수정 파일: `plan/in-progress/exec-intake-queue-impl.md` 만 — RAG/knowledge-base/ai-agent 파일 미접촉. worktree 충돌 없음.

stale skip 된 worktree 들(`rag-rerank-impl`, `rag-quality-proposal-0c618c`, `exec-park-b2b-04a2f8`, `harden-review-hooks-cb1c84`, `exec-park-durable-resume`, `plan-complete-p6-043804`)은 PR 이 MERGED 상태이므로 활성으로 남아있을 이유가 없다. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target 구현 변경(`spec/5-system/9-rag-search.md` 범위, dynamic-cut 구현 diff)과 진행 중 plan 간의 정합성을 5개 관점으로 분석했다. **미해결 결정 충돌 없음** — conditional escalate 정량 임계의 provisional default 도입은 `rag-dynamic-cut.md`·`spec-draft-rag-dynamic-cut.md`·`rag-quality-improvement.md §6` 에서 사전 합의된 "합리적 default + P0 A/B 후속" 방침을 따른 것이다. **중복 작업 없음** — 다른 active worktree(`impl-exec-concurrency-cap`) 는 RAG 파일을 접촉하지 않는다. **선행 plan 미해소 없음** — spec 갱신(step 4a/4b)·TEST WORKFLOW(step 8)가 완료됐고 spec 은 구현과 정합한다. **후속 항목 누락** 관련 INFO 2건(체크리스트 §9·§10 미완, pgvector follow-up plan 추적 누락) 을 기록했으나 비차단이다. worktree 충돌 후보 7건 중 stale 6건 skip(PR MERGED), active 1건(`impl-exec-concurrency-cap`) 은 RAG 파일 미접촉으로 무충돌. 전체 위험도: **LOW**.

---

## 위험도

LOW
