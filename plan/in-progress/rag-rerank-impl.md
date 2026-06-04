---
worktree: rag-rerank-impl
started: 2026-06-04
owner: developer
---
# RAG 리랭킹 P1 구현 (cross_encoder + 동적 컷)

> spec: [`spec/5-system/9-rag-search.md §3.3`](../../spec/5-system/9-rag-search.md) · [`spec/5-system/7-llm-client.md §3.6/§4.1/§5.6`](../../spec/5-system/7-llm-client.md) · [`spec/1-data-model.md §2.16.1`](../../spec/1-data-model.md)
> 결정 출처: [`spec-draft-rag-reranking.md`](./spec-draft-rag-reranking.md)(이미 main 머지 #455·#460)

## PoC 범위 (이번 PR)

- [ ] RerankConfig 엔티티 + 마이그레이션(**V073**) + 모듈/서비스(resolve) + 최소 CRUD
- [ ] KB rerank 컬럼 마이그레이션(**V074**) + KnowledgeBase 엔티티 컬럼 + DTO

> 마이그레이션 번호: V072 는 `integration-index-unify-2c7973`(미머지 PR) 선점 → V073/V074 사용.
- [ ] RerankClient 인터페이스 + RerankClientFactory(**tei**, **cohere**) + 클라이언트 2종
- [ ] RagSearchService: `rerank_mode = cross_encoder` 경로 (wide 회수 → rerank → 동적 점수 컷 → top-k). `off` 는 현행 유지
- [ ] ragDiagnostics.rerank 출력
- [ ] graceful degradation (rerank 실패 → cosine 경로 안전 강등)

### TDD/검증 체크리스트
- [ ] 테스트 선작성 (RerankClientFactory, Rerank 흐름, RagSearchService rerank path, RerankConfig service)
- [ ] TEST WORKFLOW (lint·unit·build·e2e)
- [ ] /ai-review + SUMMARY + Critical/Warning 0
- [ ] /consistency-check --impl-done spec/5-system/ (spec 연결 코드 변경)

## 후속 분리 (이번 PR 미포함 — partial-implementation)

> spec 의 일부만 구현하므로 아래 surface 는 `rag-rerank-followup.md` 로 분리하고
> 관련 spec frontmatter `status: partial` + `pending_plans` 등록 (spec-impl-evidence).

- [ ] `cross_encoder_llm` 모드 (listwise LLM grading 항상 수행) — chat 경로
- [ ] KB 폼 Reranking UI + 워크스페이스 RerankConfig 관리 UI (frontend)
- [ ] provider 확장: jina / voyage / local / builtin(Transformers.js 인프로세스)
- [ ] conditional escalate 정량 임계 (P0 평가셋 보정 후)

## 사전 검토
- [x] consistency-check --impl-prep spec/5-system/ (`09_30_18`) — **BLOCK: YES**, 단 Critical 분석 결과:
  - Critical #1 (V072 충돌): **실질** → V073/V074 로 교정(위).
  - Critical #2·#3·#4 (cross_encoder_llm/provider/RerankConfig 동시편집): **base-skew FP** — 충돌 대상 브랜치(`rag-quality-proposal-0c618c`#455·`rag-rerank-decisions-dd1d68`#460 는 squash-merge 후 stale 디렉토리; `integration-index-unify-2c7973` 는 #460 이전 옛 base 미리베이스)가 모두 main 반영 결정을 옛 상태로 보유. main 자체는 일관(검증). 리베이스/머지 시 해소. (memory `reference_consistency_check_main_baseline_fp` 패턴)
  - Critical #5 (skipReason): 리랭킹 무관 기존 갭.
  - → 실질 blocker 0. 사용자 확인 후 구현 재개.
- [x] cleanup 후 impl-prep 재실행(`09_48_46`) — Critical 5→1. 잔존 1건(ai-agent.md vs #459)·W4(kb-quality vs 5-knowledge-base)는 **본 구현 미수정 spec 파일** 이라 구조적 out-of-scope FP. **사용자 승인하에 구현 재개**(2026-06-04).
  - in-scope 처리: W1 오기(`LLMClient.rerank`→`RerankClient.rerank`) 수정, 9-rag-search `status: partial`+pending_plans, followup plan 생성.

## 진행 메모
- 2026-06-04 착수. 코드맵 확보(LLMConfig 미러·V071 최신·rag-search.service 구조).
- 교정: cross_encoder 는 chat() 아닌 별도 `/rerank` 엔드포인트 → RerankClient 신설.
