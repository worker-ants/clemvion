# Plan 정합성 검토 결과

검토 모드: `--impl-done` (scope: `spec/5-system/9-rag-search.md`, diff-base: origin/main)
Target: `codebase/backend/src/modules/knowledge-base/search/{dynamic-cut.util.ts, rag-search.service.ts}` + 테스트 (hnswEfSearchFor 함수 + SET LOCAL 트랜잭션 래핑)

---

## 발견사항

### [WARNING] spec §3.4 follow-up 항목을 "측정 후 조건부 조정"이 아닌 "항상 적용"으로 선구현 — 미해결 결정 우회 가능성

- **target 위치**: `rag-search.service.ts` `searchVectorGroup` 메서드 — `dataSource.transaction` + `SET LOCAL hnsw.ef_search = ${efSearch}` 무조건 적용
- **관련 plan**: `plan/in-progress/rag-quality-improvement.md §7.E` (활성)
  ```
  - [ ] pgvector ANN 파라미터 조정 (D1 wide 회수 후속) —
        프로덕션 부하 측정 후 조정 (필요 시 DB 세션 파라미터/KB config 노출).
        SoT: spec/5-system/9-rag-search.md §3.4 follow-up 노트.
  ```
  `spec/5-system/9-rag-search.md §3.4` follow-up 노트:
  ```
  pgvector 인덱스 파라미터 (follow-up): … hnsw.ef_search … 프로덕션 부하 측정 후
  조정이 필요할 수 있다 — 필요 시 DB 세션 파라미터 또는 KB config 로 노출(후속).
  ```
- **상세**: spec + plan 양쪽 모두 이 조정을 "측정 결과를 확인한 뒤 필요하면 적용하는 후속(follow-up)"으로 기록하고 있다. target 구현은 `hnswEfSearchFor(topK)` 를 항상 호출하여 `SET LOCAL hnsw.ef_search` 를 모든 recall 쿼리에 무조건 적용한다. 프로덕션 부하 측정 없이 "정적 clamp(LIMIT×2, [40,1000])" 공식을 결정적으로 채택한 것으로, spec/plan 의 "측정 후 조건부" 전제와 결이 다르다.

  단, 구현 논리 자체는 pgvector 정설(`ef_search ≥ LIMIT` 권장)에 부합하며 안전 방어적(clamp 보장, SET LOCAL 트랜잭션 스코프라 커넥션 오염 없음)이다. spec 이 "필요할 수 있다"는 완화 표현을 쓴 것은 실질적 재현율 저하 여부가 인덱스 구성·데이터 분포에 따라 다르기 때문이다. 따라서 이는 "결정 미합의" 보다는 "spec/plan 의 후속 추적 항목 체크박스가 미처리인 상태에서 구현이 먼저 완료된" 상황에 가깝다.

- **제안**:
  1. `rag-quality-improvement.md §7.E` 의 ANN 파라미터 조정 항목을 `[x]` 완료 처리하고 "SET LOCAL LIMIT×2 clamp 방식으로 구현 완료(rag-followup-efsearch branch)" 로 갱신.
  2. `spec/5-system/9-rag-search.md §3.4` follow-up 노트를 "구현 완료" 로 갱신하고 채택한 공식(`LIMIT×2, [40,1000] clamp, SET LOCAL transaction scope`) 및 graph 경로 미적용 근거(`seedTopK < 40`)를 명문화. "측정 후 조정 필요할 수 있다" 표현을 "구현됨; 운영 측정 후 clamp 범위 재검토 가능" 으로 보완.
  3. `rag-dynamic-cut.md §비차단 후속` 에 이 ef_search 구현이 선행 advisory 항목을 해소했음을 기록(plan cross-ref 정합).

---

### [INFO] rag-dynamic-cut.md worktree 참조 정합 — stale worktree 정리 권장

- **관련 plan**: `plan/in-progress/rag-dynamic-cut.md` (`worktree: rag-dynamic-cut-12fac1`, `spec-draft-rag-dynamic-cut.md` 동일)
- **상세**: PR #500 이 MERGED 상태이나 `rag-dynamic-cut.md` plan 은 `in-progress/` 에 남아 있고 `worktree: rag-dynamic-cut-12fac1` 필드를 보유한다. 물리 worktree 체크아웃(`/.claude/worktrees/rag-dynamic-cut-12fac1/`)은 현재 존재하지 않는다. target 구현이 rag-dynamic-cut plan 의 "비차단 후속 §후속" 항목을 해소했으므로, 해당 plan 갱신 시 이 stale worktree 참조도 함께 정리 권장.
- **제안**: plan-lifecycle 에 따라 `rag-dynamic-cut.md` 의 미완 eval-retrieval 추적이 완료되면 `plan/complete/` 으로 이동. 그 전에라도 worktree 필드를 `(merged, cleanup 대기)` 로 표시.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 4건 분석:

| worktree | branch | 판정 | 근거 |
|---|---|---|---|
| `exec-park-polish-080a4d` | `claude/exec-park-polish-080a4d` | **STALE** | Step 1: `merge-base --is-ancestor` → exit 0 (main 조상) |
| `rag-dynamic-cut-12fac1` | `claude/rag-dynamic-cut-12fac1` | **STALE** | Step 1: exit 1 (squash merge) → Step 2: PR #500 `MERGED` |
| `impl-exec-concurrency-cap` | `claude/impl-concurrency-cap-pr2b` | ACTIVE | diff: `plan/in-progress/exec-intake-queue-impl.md` 만 변경, RAG/knowledge-base 파일 접촉 없음 → 충돌 후보 아님 |
| `rag-followup-efsearch-b6c8e8` | `claude/rag-followup-efsearch-b6c8e8` | ACTIVE (target) | — |

- `exec-park-polish-080a4d` (branch `claude/exec-park-polish-080a4d`) — Step 1 ancestor (main 에 포함)
- `rag-dynamic-cut-12fac1` (branch `claude/rag-dynamic-cut-12fac1`) — Step 2 PR #500 MERGED

해당 worktree 가 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target 구현(`hnswEfSearchFor` + `SET LOCAL hnsw.ef_search` 트랜잭션 래핑)은 pgvector 정설에 부합하는 안전한 recall 보전 조치이며, 다른 plan 의 미결 결정을 우회하거나 병렬 worktree 와 파일 충돌을 일으키지 않는다. 유일한 정합 간극은 spec §3.4 follow-up 노트 및 `rag-quality-improvement §7.E` 백로그 항목이 "측정 후 필요 시 적용" 으로 남아있는 상태에서 구현이 먼저 완료된 것이다 — 기술적으로 충돌이라기보다 문서 갱신 누락이다. spec + plan 체크박스 갱신으로 완전 해소 가능하며 구현 자체를 되돌릴 이유는 없다. worktree 충돌 후보 4건 중 stale 2건(exec-park-polish, rag-dynamic-cut) skip, active 1건(impl-concurrency-cap) 은 RAG 파일 비접촉으로 충돌 없음.

---

## 위험도

LOW
