---
worktree: rag-dynamic-cut-12fac1
started: 2026-06-06
owner: developer
spec_impact: yes
---
# RAG P1 — D1 점수 기반 동적 컷 (+ D2 escalate 메커니즘)

> SoT 로드맵: [`rag-quality-improvement.md`](./rag-quality-improvement.md) §P1·§2(D1/D2).
> 본 노트 = 이번 PR 의 실행 체크리스트. D1 = 최우선(재임베딩 불요·독립).

## 설계 결정 (2026-06-06, 사용자 confirm)

- **D1 주입 상한 의미**: 내부 ceiling(12) + `top_k` 명시 override. 기본 동작 = wide 회수(~50) → θ 게이트 → token-budget(~8k) → 내부 ceiling(~12)까지 주입. LLM `top_k` 또는 노드 `ragTopK` **명시 시** 그 값이 ceiling override. `ragTopK` 기본값(5) 은 "미지정 시 dynamic cut 지배" 로 재해석 → zod `.default(5)` 제거하고 `.optional()` 로 변경.
- **config 노출**: 신규 config 필드 없음. 회수폭 50 / token-budget 8000 / inject-cap 12 는 내부 상수. θ(`ragThreshold`)·`top_k` 만 사용자/LLM 노출 유지 (spec Rationale I4 일관).
- **D2 범위**: conditional escalate 메커니즘 + "근거 없음" agent 전달까지 구현. 정량 임계 A/B 확정은 실 골든셋/workspace baseline(SoT §7.B) 확보 후 follow-up.

## 영향 범위

- 구현: `codebase/backend/src/modules/knowledge-base/search/{rag-search.service.ts, rerank.service.ts, dynamic-cut.ts(신규)}`, `kb-tool-provider.ts`, `ai-agent.schema.ts`(ragTopK optional).
- spec(planner): `spec/5-system/9-rag-search.md` §3.1·§3.3(컷 정책·흐름)·Rationale, `spec/4-nodes/3-ai/1-ai-agent.md`(ragTopK/threshold 의미·default JSON).
- 프론트 doc-sync: ai-agent 노드 FieldTable + i18n dict(ragTopK hint/label) — 노드 schema 변경 매트릭스.

## 체크리스트

- [ ] 0. worktree (rag-dynamic-cut-12fac1, origin/main 최신)
- [ ] 1. 스펙 분석 (완료: 9-rag-search, 1-ai-agent, 코드 일독)
- [ ] 2. 모호성 해소 (완료: 사용자 confirm 3건)
- [x] 3. consistency-check --impl-prep (BLOCK:YES → spec-first 로 해소, 13_24_24)
- [x] 4a. spec 갱신 (project-planner) — 6 spec 파일 적용, consistency `--spec 14_53_44` BLOCK:NO
- [ ] 4b. 프론트 doc-sync (ai-agent FieldTable + i18n ragTopK) — developer 단계
- [ ] 5-7. 테스트 선작성 + D1/D2 구현 + 보강
- [ ] 8. TEST WORKFLOW (lint·unit·build·e2e)
- [ ] 9. /ai-review + fix + consistency-check --impl-done
- [ ] eval-retrieval 동적컷 전/후 지표 비교
- [ ] 10. plan 정리

## 진행 메모

### 2026-06-06 consistency-check --impl-prep → BLOCK: YES (4 Critical)
산출: `review/consistency/2026/06/06/13_24_24/SUMMARY.md`. 모든 Critical = "spec/plan 선갱신 후 구현" (SDD 정상 순서). 설계 자체는 OK.
- C1/C2: §3.3.1 `off` "byte-identical 하위호환" 약속을 D1 동작으로 갱신 필요.
- C3: ragTopK 기본값 5 → 4개 spec 위치(1-ai-agent §1, 0-common §2, 9-rag-search §2.1·§3.1) 선갱신 필요.
- C4: D2 conditional escalate 가 spec v1 결정·rag-rerank-followup pending 선결 우회.

### D2 범위 — 사용자 confirm (2026-06-06)
**D2 메커니즘도 이번 PR 포함** (option B). spec §3.3.1·§3.3.2·Rationale 에 "왜 지금·합리적 default 임계·정량 A/B 후속" 명문화 + `rag-rerank-followup.md` pending 항목을 범위 제한으로 재협상.

### 네이밍 정비 (gate W10/I7/I9)
- 상수: `RAG_INJECT_TOKEN_BUDGET`(=8000), `RAG_RECALL_K`(=50), `RAG_MAX_INJECT_COUNT`(=12) — RAG prefix.
- 파일: `dynamic-cut.util.ts` (type suffix).
- char/3 추정(text-chunker) 의도적 분리 — spec 에 근거(I2).

### 다음 단계
project-planner 로 spec/plan 선갱신 → `--spec` BLOCK:NO 확인 → developer TDD 구현.
