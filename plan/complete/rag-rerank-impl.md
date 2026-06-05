---
worktree: rag-rerank-impl
started: 2026-06-04
owner: developer
spec_impact:
  - spec/5-system/9-rag-search.md
  - spec/5-system/7-llm-client.md
  - spec/1-data-model.md
---
# RAG 리랭킹 P1 구현 (cross_encoder + 동적 컷)

> spec: [`spec/5-system/9-rag-search.md §3.3`](../../spec/5-system/9-rag-search.md) · [`spec/5-system/7-llm-client.md §3.6/§4.1/§5.6`](../../spec/5-system/7-llm-client.md) · [`spec/1-data-model.md §2.16.1`](../../spec/1-data-model.md)
> 결정 출처: [`spec-draft-rag-reranking.md`](./spec-draft-rag-reranking.md)(이미 main 머지 #455·#460)

## PoC 범위 (이번 PR)

- [x] RerankConfig 엔티티 + 마이그레이션(**V081**) + 모듈/서비스(resolve) + 최소 CRUD
- [x] KB rerank 컬럼 마이그레이션(**V082**) + KnowledgeBase 엔티티 컬럼 + DTO

> 마이그레이션 번호: main 이 V072(store-identifier)·V073~V080(agent_memory #459/#462) 선점 → V081/V082 사용.
- [x] RerankClient 인터페이스 + RerankClientFactory(**tei**, **cohere**) + 클라이언트 2종
- [x] RagSearchService: `rerank_mode = cross_encoder` 경로 (wide 회수 → rerank → 동적 점수 컷 → top-k). `off` 는 현행 유지
- [x] ragDiagnostics.rerank 출력
- [x] graceful degradation (rerank 실패 → cosine 경로 안전 강등)

### TDD/검증 체크리스트
- [x] 테스트 선작성/보강 (RerankClientFactory·clients·RerankConfig service·Rerank·RagSearchService rerank path)
- [x] backend lint(0 err)·unit(5899 pass)·build(tsc 0)
- [x] e2e: 1차 FAIL(`RerankConfig.apiKey` 명시 type 누락→DataTypeNotSupportedError) → `type:'varchar'` fix(cae68c59). 마이그레이션 V081/V082 정상(v082). **재실행 통과**(resolution-applier E2E=pass).
- [x] /ai-review(`10_44_49`) — Critical 0, Warning 7. resolution-applier 6/6 fix(코드 24112949 + spec 6136a036), W7(followup)·entity 별도 해소. ESCALATE=no. ⚠️ router 가 "코드 변경 없음" 오판해 code reviewer 12명 skip(requirement·documentation 만 실행) — 선택적 `--route=all` 재리뷰 여지.
- [x] /consistency-check --impl-done spec/5-system/ (진행)

## 후속 분리 (이번 PR 미포함 — partial-implementation)

> spec 의 일부만 구현하므로 아래 surface 는 `rag-rerank-followup.md` 로 분리하고
> 관련 spec frontmatter `status: partial` + `pending_plans` 등록 (spec-impl-evidence).

- [x] `cross_encoder_llm` 모드 → #478(A.1) 완료
- [x] 프론트 UI → #478(A.2) 완료
- [~] provider 확장 → DROP(A.3, 2026-06-05)
> conditional escalate 정량 임계는 [`rag-rerank-followup.md`](./rag-rerank-followup.md) 에서 추적 (P0 평가셋 의존). 본 P1 PoC + #478(A.1/A.2/A.5) 로 cross_encoder/cross_encoder_llm 구현 종결.

## 사전 검토
- [x] consistency-check --impl-prep spec/5-system/ (`09_30_18`) — **BLOCK: YES**, 단 Critical 분석 결과:
  - Critical #1 (V072 충돌): **실질** → V081/V082 로 교정(위, main V072~V080 선점 반영).
  - Critical #2·#3·#4 (cross_encoder_llm/provider/RerankConfig 동시편집): **base-skew FP** — 충돌 대상 브랜치(`rag-quality-proposal-0c618c`#455·`rag-rerank-decisions-dd1d68`#460 는 squash-merge 후 stale 디렉토리; `integration-index-unify-2c7973` 는 #460 이전 옛 base 미리베이스)가 모두 main 반영 결정을 옛 상태로 보유. main 자체는 일관(검증). 리베이스/머지 시 해소. (memory `reference_consistency_check_main_baseline_fp` 패턴)
  - Critical #5 (skipReason): 리랭킹 무관 기존 갭.
  - → 실질 blocker 0. 사용자 확인 후 구현 재개.
- [x] cleanup 후 impl-prep 재실행(`09_48_46`) — Critical 5→1. 잔존 1건(ai-agent.md vs #459)·W4(kb-quality vs 5-knowledge-base)는 **본 구현 미수정 spec 파일** 이라 구조적 out-of-scope FP. **사용자 승인하에 구현 재개**(2026-06-04).
  - in-scope 처리: W1 오기(`LLMClient.rerank`→`RerankClient.rerank`) 수정, 9-rag-search `status: partial`+pending_plans, followup plan 생성.

## 진행 메모
- 2026-06-04 착수. 코드맵 확보(LLMConfig 미러·V071 최신·rag-search.service 구조).
- 교정: cross_encoder 는 chat() 아닌 별도 `/rerank` 엔드포인트 → RerankClient 신설.
- 통합 설계: searchWithMeta 안 "단일 KB + cross_encoder" 분기(wide 회수 candidateK·cosine 임계 skip → RerankService → 동적 컷). 멀티-KB 리랭크는 followup.
- [x] KB 엔티티 rerank 컬럼 5개 추가
- [x] V082 마이그레이션(knowledge_base rerank 컬럼) — V081(rerank_config)은 신규모듈 에이전트가 생성
- [x] RagSearchService KbRow + KB SELECT 쿼리에 rerank 컬럼 추가
- [x] (에이전트) RerankConfig 엔티티/모듈/서비스 + RerankClient/Factory(tei·cohere) + RerankService + V081 + 단위테스트
- [x] (대기 후) searchWithMeta rerank 분기 + 모듈 와이어링(knowledge-base.module·app.module) + KB DTO rerank 필드 + 통합테스트
