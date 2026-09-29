---
id: "CLE-KB-EVAL"
title: "RAG 품질 평가"
type: "convention"
version: 1
status: "draft"
requirements: []
basis_superseded: false
parent: "CLE-KB"
ancestors: ["CLE-VISION", "CLE-KB"]
area: "CLE-KB"
content_hash: "bcf44490b83a9df4edfc3b127ac20ceffdedd2a579e9d6900322f0e443b8445c"
read_as: "approved"
task: null
source_paths: ["spec/conventions/rag-evaluation.md"]
mirror_sha256: "4c14c9cc5dc2b035efe4b49bb019f2f76784b77e6ee1edb145908591fb0e5474"
etag: "sha256-4d03397e2415ad4d1c45bd2cc4eeb8d3fead763241be02b10cb57386b4e9a447"
---
> 구현 상태: 구현됨 · 원문: `spec/conventions/rag-evaluation.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

RAG 품질 평가(RAG evaluation)는 [RAG 검색](CLE-KB-SEARCH.md) 의 품질 변경(리랭킹, 하이브리드 검색, 청킹, 임베딩 모델 교체 등)이 낸 효과를 수치로, 다시 잴 수 있게 측정하는 가벼운 평가 하네스(evaluation harness)의 규약이다. 1차 범위(P0 Phase 0+1)는 자동 합성 골든셋(golden set, `GoldenSet`)과 순수 TypeScript 검색 지표다.

범위 밖: LLM-judge(생성 품질), 에이전트 지표, 실제 고객지원 로그 마이닝, 온라인 평가 루프는 후속 단계로 둔다. 측정 대상 알고리즘(동적 점수 컷 수치, 리랭킹)은 [RAG 검색](CLE-KB-SEARCH.md) 이 정한다. 이 문서는 재는 방법만 정한다. 상위 로드맵과 근거 자료는 RAG 품질 개선 계획(`rag-quality-improvement`)에 있다.

## 규칙

1. 골든셋은 자동 합성을 위주로 만든다. 지식 저장소 청크에서 질문을 거꾸로 생성해 많이 확보한다. 사람(SME)은 표본만 검수한다.
2. 1차 하네스의 차단 기준(hard gate)은 LLM 비용이 없는 순수 검색 지표만 쓴다. 한국어 LLM-judge 는 신뢰도가 낮다(Fleiss κ≈0.3).
3. 합성 골든셋은 검수 전(silver)이다. 절대 점수로 품질을 단정하지 않는다. 변경 전후의 차이(리랭킹 끔과 cross-encoder, PR 전후)로만 해석한다.
4. 한국어 LLM-judge 의 원점수를 차단 기준으로 쓰지 않는다. 1차 하네스는 LLM-judge 자체를 포함하지 않는다.
5. 검색 지표 함수는 부수효과와 난수 없이 입력만으로 결과를 정한다.
6. 가져온 청크의 순서는 점수 내림차순이고, 점수가 같으면 `chunkId` 사전순으로 2차 정렬한다(`orderRetrieved`). 같은 입력은 늘 같은 순위와 같은 점수를 낸다.
7. 정답 청크가 비어 있는 항목의 지표는 `NaN`(평가 제외 신호)으로 두고 매크로 평균에서 뺀다.
8. 골든셋 생성기는 LLM 을 쓰므로 결과가 매번 다르다. 만든 `golden.json` 을 고정(커밋 또는 보관)해 평가 입력을 안정시킨다.
9. 평가 스크립트는 전용 경량 DI 모듈(`EvalCliModule`)로 부팅한다. `AppModule` 로 부팅하지 않는다.
10. 실제 골든셋(`eval/golden.json`)은 기본으로 git 에 커밋하지 않는다. 커밋 여부는 워크스페이스 소유자가 개인정보와 기밀을 검토한 뒤 정한다.
11. 같은 골든셋으로 `rerank_mode` 끔과 cross-encoder 를 번갈아 돌려 회귀를 보는 것은 허용한다.
12. 한국어와 영어의 격차는 언어별 매크로 평균으로 본다.
13. 높은 k 의 Recall·hit-rate 는 동적 점수 컷의 주입 토큰 예산 때문에 k 개보다 적게 가져온 상태에서 잴 수 있다. 청크가 길수록 영향이 크다. 같은 청킹 설정끼리 상대 비교에만 쓴다.

## 골든셋 스키마

단일 기준 타입은 `golden-set.types.ts` 다. 파일은 `{ meta, entries[] }` JSON 이다.

| 필드 | 뜻 |
|---|---|
| `id` | `kb+chunk+query` 해시 기반의 안정 ID. 다시 생성할 때 중복을 거르는 키 |
| `query` | 사용자 질문 |
| `language` | `ko` 또는 `en` |
| `knowledgeBaseId` | 대상 지식 저장소 |
| `goldChunkIds` | 관련(정답) 청크 ID 목록. `shouldRetrieve:true` 면 1개 이상 |
| `referenceAnswer` | 청크에 근거한 정답. 생성 지표와 디버깅용이고 검색 지표에는 쓰지 않는다 |
| `shouldRetrieve` | `false` 는 지식 저장소에 답이 없어야 하는 부정 사례. 검색 지표 매크로 평균에서 뺀다 |
| `source` | `synthetic`, `mined`, `manual` |
| `reviewed` | SME 검수 통과 여부. `false` 는 silver, `true` 는 gold |
| `difficulty` | `single`(자동 합성이 지원하는 유일한 값), `multi`, `paraphrase` |
| `generatedFrom` | 자동 합성 추적(`chunkId`, `documentId`, `model`) |

### 거꾸로 생성해 정답 라벨 얻기

자동 합성은 청크 c 에서 질문 q 를 만든다. 그래서 c 가 곧 q 의 정답 청크가 된다. 따로 라벨을 달지 않아도 `(query, gold_chunk_id, reference_answer)` 가 함께 정해진다. 답이 청크 하나에 있다고 가정하므로 자동으로는 `difficulty:'single'` 만 만든다. 여러 청크를 거치는 질문은 수동이나 후속 범위다.

## 검색 지표

단일 기준은 `retrieval-metrics.ts` 다.

| 지표 | 정의 |
|---|---|
| Recall@k | `|gold ∩ top-k| / |gold|` |
| Precision@k | `|gold ∩ top-k| / k` (분모는 k 로 고정) |
| hit-rate@k | top-k 안에 정답이 하나라도 있으면 1, 없으면 0 |
| MRR@k | 첫 관련 청크의 1부터 센 순위의 역수. 없으면 0 |
| nDCG@k | 이진 관련도. `DCG/IDCG` |

### 집계

`evaluateRetrieval(goldenSet, retrievedByEntryId, ks=[1,3,5,10])` 가 `EvalReport` 를 돌려준다.

- 긍정 항목(`shouldRetrieve:true` 이면서 `goldChunkIds` 가 1개 이상)의 전체 매크로 평균
- 언어별(KO, EN) 매크로 평균
- 부정 항목 통계(`retrievedAnyRate`, 참고 지표)
- 항목별 상세

## 실행 경로

| 단계 | 도구 | 비고 |
|---|---|---|
| 1. 자동 합성 | `pnpm --filter backend run eval:golden:generate -- --workspace-id .. --kb-id .. [--sample N]` | 제품 `LlmService` 를 쓴다. silver 를 만든다 |
| 2. SME 표본 검수 | `golden.json` 을 직접 고친다 | 통과한 항목을 `reviewed:true` 로 올린다. 20~30% 표본 |
| 3. 지표 실행 | `pnpm --filter backend run eval:retrieval -- --golden eval/golden.json [--ks ..] [--top-k N] [--threshold 0] [--fail-metric .. --fail-k .. --fail-under ..]` | `--fail-under` 로 CI 차단 기준을 건다 |

- `--threshold`(기본 0)는 검색 점수 하한이다. 지식 저장소의 `rerank_mode` 가 끔이면 코사인 임계값, `cross_encoder` 면 리랭킹 점수 컷으로 해석한다. 지식 저장소에 점수 컷 임계(`rerank_score_threshold`)가 설정돼 있으면 그 값이 CLI 값보다 먼저다. 점수 컷 임계를 비운 지식 저장소에서의 해석은 정의가 갈린다. [RAG 검색의 미결 사항](CLE-KB-SEARCH.md#미결-사항) 참조. 현재 구현은 `kb.rerankScoreThreshold ?? threshold` 로 CLI 값을 쓴다.
- `--top-k N`(기본은 `--ks` 의 최댓값)은 `searchWithMeta` 의 주입 상한으로 넘어간다. 고정 LIMIT 이 아니다. 재는 대상은 순수 top-k 가 아니라 동적 점수 컷(주입 토큰 예산 8000 과 주입 상한)을 적용한 뒤 LLM 에 넣을 집합이다. 리랭킹 끔 경로는 넓게 가져온 뒤(`RAG_RECALL_K`) 동적 점수 컷을 적용한다. 리랭킹 경로도 주입 상한과 예산을 넘긴다. 컷은 순수 함수라 결정성은 유지된다.
- 이 규약은 `rerank_mode` 의 `off` 와 `cross_encoder` 만 다룬다. `cross_encoder_llm` 에서의 해석은 원문에 없다.

### 부트스트랩 격리

두 스크립트는 `EvalCliModule` 로 부팅한다. `KnowledgeBaseModule` 에는 BullMQ 큐와 프로세서가 딸려 있어 `AppModule` 로 부팅하면 운영 워커가 실제 작업을 소비한다. `EvalCliModule` 은 큐와 프로세서를 빼고 검색 경로와 `LlmService` 만 다시 구성한다. 엔티티 목록은 `src/database/root-entities.ts` 의 `ROOT_ENTITIES`(`app.module` 과 공유)를 그대로 쓴다.

## 산출물과 커밋 정책

- 코드: `src/modules/knowledge-base/eval/**`, `src/scripts/{generate-golden-set,eval-retrieval}.ts`
- 스키마 예시: `eval/golden.example.json` (커밋한다)
- 실제 골든셋: `eval/golden.json`. 고객 문서 조각(질문, 정답, 식별자)이 들어갈 수 있어 기본으로 커밋하지 않는다(`.gitignore`).

## 구현 위치

- `codebase/backend/src/modules/knowledge-base/eval/golden-set.types.ts`
- `codebase/backend/src/modules/knowledge-base/eval/retrieval-metrics.ts`
- `codebase/backend/src/modules/knowledge-base/eval/retrieval-metrics.spec.ts`
- `codebase/backend/src/modules/knowledge-base/eval/lang-detect.ts`
- `codebase/backend/src/modules/knowledge-base/eval/eval-cli.module.ts`
- `codebase/backend/src/scripts/cli-utils.ts`
- `codebase/backend/src/scripts/generate-golden-set.ts`
- `codebase/backend/src/scripts/eval-retrieval.ts`
- `codebase/backend/eval/golden.example.json`
- `codebase/backend/eval/README.md`

## Rationale

### D-E1: 거꾸로 생성하면 정답 라벨이 공짜다

골든셋 라벨링은 P0 에서 가장 큰 수작업 비용이다. 청크에서 질문을 거꾸로 만들면 정답 청크 ID 가 덤으로 정해져 라벨 비용이 0 이 된다. 대신 답이 청크 하나에 있다는 가정이 따라오므로 여러 청크를 거치는 질문은 명시적으로 범위 밖에 둔다.

### D-E2: 언어 판정 휴리스틱

한국어 고객지원 문서에는 영문 식별자(SKU, 코드)가 많다. 그래서 라틴 문자가 우세하지 않으면 한글이 일부만 있어도 `ko` 로 판정한다(낮은 컷 0.2). 외부 의존 없는 문자 비율 방식으로 충분하다.

### D-E3: 제품 `LlmService` 를 쓴다

생성기는 `claude -p` 나 SDK 를 직접 부르지 않고 제품의 `LlmService.chat()` 을 쓴다(그래프 추출과 같은 방식). 워크스페이스 모델 설정, 암복호화, 모델 프로바이더 클라이언트를 재사용하고 비용과 로깅을 운영과 같은 경로로 모은다.

### D-E4: 결정성

지표가 순수하고 결정적이어야(동점은 `chunkId` 로 가름) CI 회귀 비교가 안정적이다. 생성기의 비결정성은 산출물을 고정해서 떼어 놓는다.

### D-E5: 검색 지표를 먼저, LLM-judge 는 보류

한국어 judge 신뢰도(Fleiss κ≈0.3, arXiv 2505.12201)가 낮아 원점수를 차단 기준으로 쓰면 잡음이 크다. 검색 지표는 LLM 비용이 없고 완전히 결정적이라 1차 기준으로 알맞다. LLM-judge 는 후속 단계에서 앙상블과 느슨한 기준으로 따로 도입한다.

### D-E6: silver·gold 상대 비교

합성 골든셋은 지나치게 깔끔해 실제 한국어 고객지원 표현과 분포가 다르다. 그래서 절대값을 믿지 않고 상대 차이와 SME 표본 검수로 보정한다. 부정 사례는 정답 부정 라벨이 없어 맞고 틀림을 판정하지 않고 참고 지표(`retrievedAnyRate`)로만 집계한다.
