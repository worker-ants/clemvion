---
worktree: rag-rerank-impl
started: 2026-06-04
owner: developer
---
# RAG 리랭킹 후속 (P1 PoC 이후 미구현 surface)

> 본 plan 은 [`rag-rerank-impl.md`](./rag-rerank-impl.md) PoC 가 구현하지 않은 spec surface 를 추적한다.
> 관련 spec frontmatter `pending_plans` 가 본 파일을 가리킨다 (spec-impl-evidence §3).
> SoT: [`spec/5-system/9-rag-search.md §3.3`](../../spec/5-system/9-rag-search.md) · [`spec/5-system/7-llm-client.md`](../../spec/5-system/7-llm-client.md) · [`spec/2-navigation/5-knowledge-base.md`](../../spec/2-navigation/5-knowledge-base.md)

## 미구현 surface (후속)

- [ ] **`cross_encoder_llm` 모드** — cross-encoder 후 항상 listwise LLM grading 1콜 (chat 경로, `rerank_llm_config_id`). PoC 는 `cross_encoder` 단독.
- [ ] **KB 폼 Reranking UI** (`spec/2-navigation/5-knowledge-base.md §2.2`) — frontend.
- [ ] **워크스페이스 RerankConfig 관리 UI** (`6-config.md`, LLMConfig 패턴) — frontend.
- [ ] **provider 확장**: `jina` / `voyage` / `local` / `builtin`(Transformers.js 인프로세스). PoC 는 `tei` + `cohere`.
- [ ] **conditional escalate 정량 임계** (점수 평탄/모호) — P0 평가셋 보정 후 도입. PoC 는 cross_encoder_llm 미구현이라 무관.
- [ ] RerankConfig RBAC 행 (`spec/5-system/1-auth.md §3.2`).
- [ ] `## Rationale` 섹션 신설 (`9-rag-search.md`·`7-llm-client.md`) — 폐기 대안·pointwise 금지·v1 항상-grading 근거 이관 (impl-prep INFO 4~7).

## 비고
- 모든 surface 가 구현되면 `9-rag-search.md`·`7-llm-client.md`·`1-data-model.md` frontmatter 를 `status: implemented` 로 승격하고 본 plan 을 `complete/` 로 이동.
