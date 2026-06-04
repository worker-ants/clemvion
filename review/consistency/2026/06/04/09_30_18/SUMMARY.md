# Consistency Check 통합 보고서 (impl-prep spec/5-system/)

**BLOCK: YES** — Critical 발견. 구현 착수 차단.

## 전체 위험도
**CRITICAL** — Plan Coherence: 마이그레이션 번호 충돌 + 3개 핵심 spec 동시편집 상충 + Convention: skipReason 예외 미등재.

> 분석 노트(main Claude): Critical #2·#3·#4 의 충돌 대상 `rag-quality-proposal-0c618c`(#455)·`rag-rerank-decisions-dd1d68`(#460)는 **이미 main 머지된 stale 워크트리** — 로컬 디렉토리가 남아 plan_coherence 가 phantom 동시편집으로 오탐(stale-worktree FP). cleanup 으로 해소. Critical #1(V072 충돌)만 실질 → migration V073/V074 로 재번호. #5 skipReason 은 리랭킹 무관 기존 갭.

## Critical (BLOCK 사유)

| # | Checker | 위배 | 실체 | 조치 |
|---|---------|------|------|------|
| 1 | Plan Coherence | V072 충돌 — `integration-index-unify-2c7973` 가 `V072__integration_unify_store_identifier_index.sql` 선점 | **실질** | rag-rerank 마이그레이션을 V073(RerankConfig)·V074(KB rerank 컬럼)로 재번호 |
| 2 | Plan Coherence | `9-rag-search §3.3.1 cross_encoder_llm` 결정 상충(항상 vs conditional escalate) | **FP** — `rag-quality-proposal-0c618c`(merged #455)·`ai-context-memory-9c7e6e`(#459) 의 stale 상태. main 은 "항상"(#460) 확정 | stale 워크트리 cleanup |
| 3 | Plan Coherence | `7-llm-client` provider 범위 상충(tei+cohere vs 5종) | **FP** — stale `rag-quality-proposal-0c618c`. main 은 tei+cohere(#460) | stale 워크트리 cleanup |
| 4 | Plan Coherence | `1-data-model §2.16.1 RerankConfig` 동시편집 | **부분 FP** — `rag-quality-proposal-0c618c`(merged). `integration-index-unify` 의 §2.16.1 편집 여부 검증 필요 | cleanup + 검증 |
| 5 | Convention | `skipReason` lower_snake_case 예외 `error-codes.md §3` 미등재 | 리랭킹 무관 기존 갭 | 별도 처리/유보 |

## 경고 (WARNING) — 발췌
- W1(Rationale): `10-graph-rag.md` 4곳 무수식 "rerank" — W4 disambiguation 미적용(main 반영분은 일부만). → graph-rag 추가 정리 후속.
- W4(Plan): `rag-quality-improvement.md §6` 에 확정 항목이 "미확정"으로 잔존 → #460 머지 후 §6 갱신(이미 일부 [x] 처리됨, stale 워크트리 기준 오탐).
- W6(Plan): `rag-rerank-followup.md` 미생성 — partial-impl pending_plans 등록 불가 → 첫 커밋 시 생성.
- W2·W3·W5·W7·W8: 리랭킹 무관 기존 spec 갭(mcp/execution/error-handling).

## INFO — 발췌
- I3: RerankConfig RBAC 행 `1-auth.md §3.2` 미등재(Planned) → 구현 시 추가.
- I4: graph+rerank 동시 `origin` 규칙 미정의 → 'seed'/'expanded' 유지, 'reranked' 는 vector 전용.
- I5·I6: `9-rag-search`·`7-llm-client` `## Rationale` 절 부재 → 구현 PR 에서 신설.
- I11: `builtin` vs `local` provider 혼동 가능(Planned).

## 권장 조치 (구현 재개 조건)
1. stale 머지 워크트리(`rag-quality-proposal-0c618c`·`rag-rerank-decisions-dd1d68`) cleanup → Critical #2·#3·#4 해소.
2. migration 번호 V073/V074 로 재조정 → Critical #1 해소.
3. `integration-index-unify-2c7973` 가 실제로 1-data-model §2.16.1 을 편집하는지 검증.
4. (재개 후) `rag-rerank-followup.md` 생성, spec `## Rationale`·RBAC·origin 규칙은 구현 PR 에 포함.
