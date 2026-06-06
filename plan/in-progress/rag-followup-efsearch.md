---
worktree: rag-followup-efsearch-b6c8e8
started: 2026-06-06
owner: developer
spec_impact:
  - spec/5-system/9-rag-search.md
  - spec/5-system/7-llm-client.md
  - spec/5-system/10-graph-rag.md
  - spec/4-nodes/4-integration/_product-overview.md
---
# RAG P1 후속 — #3 pgvector ef_search recall 보전 + #2 주변 spec 정합

> [`rag-quality-improvement.md`](./rag-quality-improvement.md) §P1 후속. PR #500(D1/D2)이 머지된 main 위에서 **standalone** 으로 재착수(원래 #500 브랜치에서 진행했으나 #500 머지+worktree cleanup 으로 unpushed 커밋 orphan → main 기준 재상륙).

## 배경
- PR #500(D1 동적 컷 + D2 conditional escalate) **머지 완료**(`adfb10de`). 단 **ef_search recall 보전(#3)은 미포함** — D1 이 회수폭을 LIMIT 5→50 으로 넓혔으나 HNSW 기본 `ef_search=40` < 50 이라 main 은 현재 recall@50 저하 상태. 본 PR 이 그 correctness gap 을 닫는다.

## 범위
- **#3 ef_search**: `searchVectorGroup` wide 회수를 트랜잭션 안 `SET LOCAL hnsw.ef_search = clamp(LIMIT×2,40,1000)`(`hnswEfSearchFor`)로 상향. SET LOCAL=txn 스코프(풀 오염 없음), pgvector 표준 GUC=전 매니지드 동작. graph seed(seedTopK<40) 미적용. 단위테스트 포함.
- **#2 주변 spec 정합**: 7-llm-client §3.6(rerank opts.topK=candidates.length)·10-graph-rag KB-GR-SR-05·4-integration KB-AG-04·9-rag-search §1/§3.3.2/§3.4/§6.
- (이미 #500 브랜치에서 ai-review 17_16_40 LOW·C0 검수된 코드 — 본 PR 에서 main 기준 재검증.)

## #1 D2 정량 임계 A/B — 보류
실 골든셋(§7.B) 데이터 미확보(사용자 확인 2026-06-06)로 cross_encoder vs cross_encoder_llm A/B 불가. 메커니즘은 #500 에 기구현. `rag-quality-improvement §7.C` 추적.

## 체크리스트
- [x] 0. worktree (rag-followup-efsearch-b6c8e8, off origin/main)
- [x] 1. 작업 복구 (orphaned #2/#3 diff → fresh main 적용)
- [x] 2. TEST WORKFLOW — lint·unit·build·e2e(176) 통과. (부수: PR #498 Gate C main breakage 해소)
- [x] 3. /ai-review 18_06_44(MEDIUM=W1 scope FP 견인, 실코드 NONE/LOW) + consistency --impl-done 18_06_44 **BLOCK: NO**. W1 stale-local-main FP 반증(merge-base), 나머지 LOW nit advisory disposition(RESOLUTION).
- [ ] 4. push + PR
