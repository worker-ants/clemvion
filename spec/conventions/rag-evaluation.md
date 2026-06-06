---
id: rag-evaluation
status: implemented
code:
  - codebase/backend/src/modules/knowledge-base/eval/golden-set.types.ts
  - codebase/backend/src/modules/knowledge-base/eval/retrieval-metrics.ts
  - codebase/backend/src/modules/knowledge-base/eval/retrieval-metrics.spec.ts
  - codebase/backend/src/modules/knowledge-base/eval/lang-detect.ts
  - codebase/backend/src/modules/knowledge-base/eval/eval-cli.module.ts
  - codebase/backend/src/scripts/cli-utils.ts
  - codebase/backend/src/scripts/generate-golden-set.ts
  - codebase/backend/src/scripts/eval-retrieval.ts
  - codebase/backend/eval/golden.example.json
  - codebase/backend/eval/README.md
---

# Convention: RAG 평가 하베스 (골든셋 · 검색 지표)

> 관련 문서: [Spec RAG 검색](../5-system/9-rag-search.md) · [Spec 임베딩 파이프라인](../5-system/8-embedding-pipeline.md) · [plan rag-quality-improvement](../../plan/in-progress/rag-quality-improvement.md)

---

## Overview

RAG 검색 품질 변경(리랭킹·하이브리드·청킹·임베딩 모델 교체 등)의 효과를 **정량·재현
가능**하게 측정하기 위한 경량 평가 하베스의 정식 규약. 1차 범위(P0 Phase 0+1)는
**자동 합성 골든셋 + 순수-TS 검색 지표**다. LLM-judge(생성 품질)·agentic 지표·실 CS
로그 마이닝·온라인 루프는 본 규약 범위 밖(후속 Phase).

핵심 원칙:

1. **자동 합성 위주(SME 최소)** — 골든셋은 KB 청크에서 질문을 역방향 생성해 대량
   확보하고, 사람은 스팟검수만 한다.
2. **검색 지표 우선** — 한국어 LLM-judge 신뢰도가 낮으므로(Fleiss κ≈0.3) 1차
   하베스는 LLM 비용 0 의 순수 검색 지표만 hard gate 로 쓴다.
3. **상대 비교 전용** — 합성 골든셋은 silver(미검수). 절대 점수는 신뢰하지 않고
   변경 전후 delta(off vs cross_encoder, PR 전후)로만 해석한다.

---

## 1. 골든셋 스키마

SoT 타입: `golden-set.types.ts`. 파일은 `{ meta, entries[] }` JSON.

| 필드 | 의미 |
| --- | --- |
| `id` | `kb+chunk+query` 해시 기반 안정 id(재생성 dedup 키) |
| `query` | 사용자 질문 |
| `language` | `ko` \| `en` |
| `knowledgeBaseId` | 대상 KB |
| `goldChunkIds` | 관련(정답) 청크 id 목록. `shouldRetrieve:true` 면 1개 이상 |
| `referenceAnswer` | 청크 근거 정답(생성 지표·디버깅용. 검색 지표엔 미사용) |
| `shouldRetrieve` | `false`=부정 케이스(KB 에 답 없어야 함). 검색 지표 macro 에서 제외 |
| `source` | `synthetic` \| `mined` \| `manual` |
| `reviewed` | SME 검수 통과 여부(`false`=silver, `true`=gold) |
| `difficulty` | `single`(자동 합성 유일 지원) \| `multi` \| `paraphrase` |
| `generatedFrom` | 자동 합성 추적(`chunkId`/`documentId`/`model`) |

### 역방향 생성으로 gold 라벨 확보

자동 합성은 청크 c 에서 질문 q 를 생성하므로 **c 가 q 의 gold 관련 chunk_id** 가
된다 — 별도 라벨링 없이 `(query, gold_chunk_id, reference_answer)` 가 동시 확정.
단일 청크 답변을 가정하므로 `difficulty:'single'` 만 자동 지원하고, multi-hop 은
수동/후속 범위다.

---

## 2. 검색 지표 (순수 TS, 결정적)

SoT: `retrieval-metrics.ts`. 모든 함수는 부수효과·난수 없이 입력만으로 결과를 정한다.

| 지표 | 정의 |
| --- | --- |
| Recall@k | `|gold ∩ top-k| / |gold|` |
| Precision@k | `|gold ∩ top-k| / k` (분모 **k 고정**) |
| hit-rate@k | top-k 안에 gold 1개라도 있으면 1, 아니면 0 |
| MRR@k | 첫 관련 청크의 1-based rank 역수, 없으면 0 |
| nDCG@k | binary relevance. `DCG/IDCG` |

### 결정성 규칙

- 회수 정렬은 **score 내림차순, 동점은 `chunkId` 사전순** 2차 정렬(`orderRetrieved`).
  → 동일 입력은 항상 동일 순위·동일 점수.
- gold 가 빈 entry 의 지표는 `NaN`(평가 제외 신호) → macro 평균에서 빠진다.
- 생성기(generate-golden-set)는 LLM 비결정적이므로, **산출 golden.json 을 고정**
  (커밋/보관)해 평가 입력을 안정화한다.

### 집계

`evaluateRetrieval(goldenSet, retrievedByEntryId, ks=[1,3,5,10])` → `EvalReport`:
positive(`shouldRetrieve:true` 이면서 `goldChunkIds` 1개 이상) entry 의 overall macro +
언어별(KO/EN) macro + negatives 통계(`retrievedAnyRate`, 정보 지표) + per-entry 상세.

---

## 3. 실행 경로 (CLI)

| 단계 | 도구 | 비고 |
| --- | --- | --- |
| ① 자동 합성 | `npm run eval:golden:generate -- --workspace-id .. --kb-id .. [--sample N]` | 제품 `LlmService` 사용. silver 산출 |
| ③ SME 스팟검수 | golden.json 직접 편집 | 통과분 `reviewed:true` 승격. 20~30% 표본 |
| 지표 실행 | `npm run eval:retrieval -- --golden eval/golden.json [--ks ..] [--threshold 0] [--fail-metric .. --fail-k .. --fail-under ..]` | `--threshold 0`: 검색 점수 하한(기본 0). KB `rerank_mode=off` 시 cosine 임계, `cross_encoder` 시 rerank 점수 임계로 해석. `--fail-under` 로 CI 게이트 |

**부트스트랩 격리**: 두 스크립트는 `EvalCliModule`(전용 경량 DI)로 부팅한다 —
`KnowledgeBaseModule` 은 BullMQ 큐·프로세서를 동반하므로 `AppModule` 부팅 시 운영
워커가 실 작업 job 을 소비한다. EvalCliModule 은 큐·프로세서를 제외하고 검색 경로와
`LlmService` 만 재구성하며, 엔티티 목록은 `src/database/root-entities.ts` 의
`ROOT_ENTITIES`(app.module 과 공유)를 재사용한다.

---

## 4. 산출물·커밋 정책

- **코드**: `src/modules/knowledge-base/eval/**`, `src/scripts/{generate-golden-set,eval-retrieval}.ts`.
- **스키마 예시**: `eval/golden.example.json` (커밋).
- **실 골든셋**: `eval/golden.json` — 고객 문서 파편(질문·정답·식별자) 포함 가능 →
  **기본 git 미커밋**(`.gitignore`). 커밋 여부는 워크스페이스 소유자가 PII·기밀
  검토 후 결정.

---

## 5. 해석 가이드 (금지·주의)

- 금지: 합성 silver 골든셋의 **절대 점수로 품질을 단정하지 않는다**. 변경 전후 상대
  delta 로만 판단.
- 금지: 한국어 LLM-judge raw 점수를 hard gate 로 쓰지 않는다(κ≈0.3). 본 1차 하베스는
  LLM-judge 자체를 포함하지 않는다.
- 허용: 같은 골든셋으로 `rerank_mode` off ↔ cross_encoder 를 번갈아 돌려 회귀를 본다.
- 허용: KO/EN 격차는 언어별 macro 로 관찰한다.

---

## Rationale

- **D-E1 (역방향 생성 → gold 공짜)**: 골든셋 라벨링이 P0 의 최대 수작업 비용인데,
  청크→질문 역방향 생성은 정답 청크 id 를 부수적으로 확정해 라벨 비용을 0 으로
  만든다. 대신 단일 청크 답변 가정이 따라오므로 multi-hop 은 명시적으로 범위 밖.
- **D-E2 (언어 휴리스틱)**: 한국어 CS 문서는 영문 식별자(SKU·코드)를 다수 포함하므로
  라틴이 우세하지 않은 한 한글 일부만으로도 `ko` 판정(낮은 컷 0.2). 외부 의존 없는
  문자 비율 방식으로 충분.
- **D-E3 (제품 LlmService 경유)**: 생성기는 `claude -p`/SDK 직접 호출 대신 제품 자체
  `LlmService.chat()`(graph-extraction 과 동일 패턴)을 쓴다 — 워크스페이스 LLM 설정·
  암복호화·provider client 를 재사용하고, 운영과 동일 경로로 비용·로깅을 일원화.
- **D-E4 (결정성)**: 지표는 순수·결정적(동점 `chunkId` tie-break)이어야 CI 회귀
  비교가 안정적. 생성기의 비결정성은 산출물 고정(커밋)으로 격리.
- **D-E5 (검색 지표 우선 / LLM-judge 보류)**: 한국어 judge 신뢰도(Fleiss κ≈0.3,
  arXiv 2505.12201)가 낮아 raw judge 를 hard gate 로 쓰면 잡음이 크다. retrieval
  지표는 LLM 비용 0·완전 결정적이라 1차 게이트로 적합. LLM-judge 는 후속 Phase 에서
  ensemble·느슨 게이트로 별도 도입.
- **D-E6 (silver/gold 상대비교)**: 합성 골든셋은 "너무 깔끔"해 실제 한국어 CS 표현과
  분포가 다르다 → 절대값 신뢰 금지, 상대 delta·SME 스팟검수로 보정. 부정 케이스는
  gold negative 라벨 부재로 정/오 판정을 보류하고 정보 지표(`retrievedAnyRate`)로만
  집계.

> 상위 로드맵·증거 출처(CAR·fin.ai·Self-RAG·한국어 judge κ): [plan rag-quality-improvement §P0·§5](../../plan/in-progress/rag-quality-improvement.md).
