---
worktree: rag-rerank-impl
started: 2026-06-04
owner: developer
spec_impact:
  - spec/5-system/9-rag-search.md
  - spec/5-system/7-llm-client.md
  - spec/2-navigation/5-knowledge-base.md
  - spec/2-navigation/6-config.md
  - spec/5-system/1-auth.md
  - spec/1-data-model.md
---
# RAG 리랭킹 후속 (P1 PoC 이후 미구현 surface)

> **완료 (2026-07-08 grooming)**: 구현 surface(cross_encoder_llm·KB Reranking UI·RerankConfig 관리 UI·RBAC·Rationale·RerankConfig 리소스 spec 완결성) 전량 `[x]` 확인. `[~]` 2건은 해소: provider 확장=DROP(2026-06-05 결정), conditional escalate=메커니즘 rag-dynamic-cut D2 로 구현·정량 임계 A/B 는 `rag-quality-improvement §7.B`(P0 baseline)로 이관. `7-llm-client` pending_plans 가 본 plan 단독이라 status→implemented 승격(lifecycle guard c). `9-rag-search` 는 rag-dynamic-cut 잔존으로 partial 유지. → `complete/` 이동.

> 본 plan 은 [`rag-rerank-impl.md`](./rag-rerank-impl.md) PoC 가 구현하지 않은 spec surface 를 추적한다.
> 관련 spec frontmatter `pending_plans` 가 본 파일을 가리킨다 (spec-impl-evidence §3).
> SoT: [`spec/5-system/9-rag-search.md §3.3`](../../spec/5-system/9-rag-search.md) · [`spec/5-system/7-llm-client.md`](../../spec/5-system/7-llm-client.md) · [`spec/2-navigation/5-knowledge-base.md`](../../spec/2-navigation/5-knowledge-base.md)

## 미구현 surface (후속)

- [x] **`cross_encoder_llm` 모드** — cross-encoder 후 항상 listwise LLM grading 1콜 (chat 경로, `rerank_llm_config_id`). PoC 는 `cross_encoder` 단독.
- [x] **KB 폼 Reranking UI** (`spec/2-navigation/5-knowledge-base.md §2.2`) — frontend.
- [x] **워크스페이스 RerankConfig 관리 UI** (`6-config.md`, LLMConfig 패턴) — frontend.
- [~] **provider 확장** (jina/voyage/local/builtin) — **DROP (2026-06-05 사용자 결정, A.3)**. 1차 tei+cohere 로 종결.
- [~] **conditional escalate** (점수 평탄/모호) — **메커니즘**(escalate 진입 구조 + 합리적 default 임계)은 `rag-dynamic-cut` PR(D2)에서 구현. cross_encoder_llm 은 이제 "항상 grading" 이 아니라 상위 점수 평탄/모호 시에만 escalate. **정량 임계 A/B 확정**은 P0 baseline([`rag-quality-improvement.md §7.B`](./rag-quality-improvement.md)) 확보 후 후속.
- [x] RerankConfig RBAC 행 (`spec/5-system/1-auth.md §3.2`).
- [x] `## Rationale` 섹션 신설 (`9-rag-search.md`·`7-llm-client.md`) — resolution-applier 가 반영 완료.

## RerankConfig 리소스 spec 완결성 (impl-done `11_08_52` INFO)
- [x] `spec/5-system/1-auth.md §3.2` RBAC 매트릭스에 `Rerank Config | CRUD | CRUD | R | R` 행 추가 (LLMConfig 패턴, I1).
- [x] `spec/5-system/1-auth.md §4.1` 감사 로그에 `rerank_config.create/update/delete` 추가 (I2).
- [x] `spec/2-navigation/6-config.md` 에 `/api/rerank-configs` CRUD 절 추가 (`/api/llm-configs` 대칭, I10).
- [x] `spec/2-navigation/5-knowledge-base.md` 리랭킹 행 `(Planned, 선택)` → `(선택, cross_encoder v1 구현됨)` 동기화 (I4).
- [x] `1-data-model §2.16.1` 제목 "(Planned)" — 전 provider 구현 시 제거(앵커 변경 동반 주의, I3).
- [x] (선결 결정) `rag-quality-improvement.md §6` "정책 판단 KB 표시 방법" — cross_encoder_llm 구현 전 확정 (I9).

## 비고
- 모든 surface 가 구현되면 `9-rag-search.md`·`7-llm-client.md`·`1-data-model.md` frontmatter 를 `status: implemented` 로 승격하고 본 plan 을 `complete/` 로 이동.
