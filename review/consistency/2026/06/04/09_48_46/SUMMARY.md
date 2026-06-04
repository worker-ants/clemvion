# Consistency Check 통합 보고서 (impl-prep spec/5-system/, cleanup 후 재실행)

**BLOCK: YES** — 단 잔존 Critical 1건은 **본 구현(백엔드) 범위 밖**.

> 분석(main Claude): stale 워크트리 2개 cleanup 으로 Critical **5→1**. 잔존 Critical #1 은 `ai-agent.md §1` vs PR #459 충돌인데, **본 구현 PR 은 ai-agent.md 를 수정하지 않는다**(백엔드 코드 + 마이그레이션; ai-agent.md ragTopK/threshold 노트는 #455 에 이미 머지). → #459 가 main 과 reconcile 할 사항이지 본 구현의 blocker 아님. W4(kb-quality vs 5-knowledge-base.md)도 본 구현 미수정 파일 + diff 는 상대링크 경로 수정뿐.

## Critical (BLOCK 사유)

| # | Checker | 위배 | 본 구현 관련성 |
|---|---------|------|---------------|
| 1 | Plan Coherence | `ai-agent.md §1` 표 vs PR #459(ai-context-memory, OPEN) 의 memoryStrategy/memoryTopK/Threshold 추가 | **범위 밖** — 본 구현은 ai-agent.md 미수정. #459 의 rebase 사항 |

## 경고 (WARNING)

| # | Checker | 위배 | 처리 |
|---|---------|------|------|
| 1 | Cross-Spec | §3.3.2 주석 `LLMClient.rerank()` 오기 (실제는 `RerankClient`) | **내 spec 버그** → impl DOCUMENTATION 단계서 수정 |
| 2 | Convention | `9-rag-search.md status: implemented` 인데 Planned §3.3 존재 → `partial` + `pending_plans` | impl 의 partial-implementation 단계서 처리(followup plan + status) |
| 3 | Convention | `10-graph-rag.md` status 불일치 (§8 미결·§6 P2+) | 리랭킹 무관 기존 갭 |
| 4 | Plan Coherence | `5-knowledge-base.md` vs `kb-quality-fba2f2`(OPEN) | **범위 밖** — 본 구현 UI deferred(미수정). kb-quality diff 는 경로 수정뿐 |
| 5 | Plan Coherence | cross_encoder_llm escalate 임계·정책KB 미결 | **#460 에서 확정**(항상-grading·플래그 없음). 본 구현은 cross_encoder 단독 → cross_encoder_llm deferred(W5 권고와 일치) |

## INFO — 발췌 (impl 시 반영)
- I1·I10: graph "rerank" 용어·`ragSources` 필드명(`chunk`/`content`) 통일.
- I2: RerankConfig 관리 UI `6-config.md`(Planned) — UI followup.
- I3: ER FK 관계선 추가.
- I4~I7: `9-rag-search`·`7-llm-client` `## Rationale` 섹션 신설(폐기대안·pointwise 금지·v1 항상-grading 근거 이관).

## 결론
실질 in-scope 항목: W1 오기 수정 + W2 status/followup(impl 단계 정규 작업) + INFO Rationale/필드명. 잔존 Critical/W4 는 **동시 OPEN PR(#459·kb-quality)이 본 구현 미수정 spec 파일을 편집**한 구조적 FP — #459/kb-quality 머지 전까지 impl-prep 가 계속 flag (내 측 해소 불가). 본 구현(cross_encoder 백엔드)은 실질 blocker 없음.
