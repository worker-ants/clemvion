---
id: "CLE-GLOSSARY-AI"
title: "용어 사전 — AI 와 지식 저장소"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-GLOSSARY"
ancestors: ["CLE-VISION", "CLE-GLOSSARY"]
area: null
content_hash: "5c3bcb50454ad3caabb43a3dea6eec53ca2d3e09932287b5ede613334d1350b8"
read_as: "approved_fallback"
task: "CLE-T-SJAYNM"
source_paths: []
mirror_sha256: "8a1bb7d5c24ac2894faa84458e5ef375637370c3e33ebbdf0e626b8785073f1a"
etag: "sha256-68478578e403fdcb8de759fdd002cd28c93fecca60a389feab261c626ca104e2"
---
## 개요

[용어 사전](CLE-GLOSSARY.md) 의 「AI 와 지식 저장소」 영역 용어다. 표기 원칙 · 약어 · 상태값 표기는 [용어 사전](CLE-GLOSSARY.md) 에 있고, 여러 영역에 걸친 같은 말은 [용어 사전 — 다의어 구분](CLE-GLOSSARY-POLY.md) 이 가른다.

표는 `표준 용어 · 영문과 코드 식별자 · 정의 · 쓰지 않는 표기 · 기준 문서` 순서다. "쓰지 않는 표기" 에 괄호로 붙은 조건은 그 뜻일 때만 쓰지 않는다는 뜻이다.

## 용어

| 표준 용어 | 영문 · 코드 식별자 | 정의 | 쓰지 않는 표기 | 기준 문서 |
| --- | --- | --- | --- | --- |
| LLM | Large Language Model | 대규모 언어 모델. 번역하지 않는다. | 언어 모델(단독) | [LLM 클라이언트](CLE-AI/CLE-AI-LLM.md) |
| LLM 클라이언트 | `LLMClient`, `LlmService` | 여러 모델 프로바이더를 한 인터페이스로 부르는 계층. 캐시·재시도·사용량 기록을 함께 맡는다. | LLM Client(본문) | [LLM 클라이언트](CLE-AI/CLE-AI-LLM.md) |
| 모델 설정 | Model settings, `ModelConfig` | 워크스페이스가 등록한 AI 모델 연결(프로바이더·API 키·주소·기본 모델). 종류는 Chat·Embedding·Rerank 세 가지다. 메뉴 이름과 같다. | LLM 설정, LLM Config, LLMConfig, Model Config, LLM 프로바이더 설정, Models(본문) | [모델 설정](CLE-AI/CLE-AI-MODELS.md) |
| 모델 종류 | `ModelConfig.kind` | `chat`, `embedding`, `rerank` 세 값. 화면 탭은 Chat·Embedding·Rerank 다. | 없음 | [모델 설정](CLE-AI/CLE-AI-MODELS.md) |
| 모델 프로바이더 | model provider, `provider` | 모델을 제공하는 서비스(openai, anthropic, google, azure, local, 리랭커는 tei·cohere). 화면 라벨은 "프로바이더" 다. | 제공자(이 뜻으로), LLM Provider | [모델 설정](CLE-AI/CLE-AI-MODELS.md) |
| 기본 모델 | default model, `default_model` | 모델 설정 하나에서 쓸 모델 ID. | 없음 | [모델 설정](CLE-AI/CLE-AI-MODELS.md) |
| 워크스페이스 기본 설정 | default config, `is_default` | 종류마다 하나씩 정하는 기본 모델 설정. 노드나 지식 저장소가 모델 설정을 지정하지 않으면 이것을 쓴다. | 워크스페이스 default, 기본 프로바이더 | [모델 설정](CLE-AI/CLE-AI-MODELS.md) |
| 기본 파라미터 | `default_params` | Chat 모델 설정의 temperature·max_tokens 같은 기본값. AI 노드가 따로 덮어쓸 수 있다. | 모델 파라미터 기본값 | [모델 설정](CLE-AI/CLE-AI-MODELS.md) |
| 모델 목록 항목 | `ModelInfo` | 프로바이더에서 불러온 모델 목록의 한 항목. 모델 설정과 다르다. | 없음 | [모델 설정](CLE-AI/CLE-AI-MODELS.md) |
| 모델 설정 참조 필드 | `llmConfigId`, `llm_config_id` | 노드와 지식 저장소가 모델 설정을 가리키는 옛 이름 필드. 코드 식별자라 이름을 바꾸지 않는다. | LLM 설정 ID(본문) | [모델 설정](CLE-AI/CLE-AI-MODELS.md) |
| LLM 사용량 | LLM usage, `LlmUsageLog` | Chat 계열 LLM 호출마다 토큰 수와 비용을 쌓는 기록. 임베딩 호출은 쌓지 않는다. | usage log(이 뜻으로) | [LLM 사용량 기록](CLE-AI/CLE-AI-USAGE.md) |
| 사용량 귀속 | `LlmCallContext` | LLM 사용량 행을 워크플로우·실행·노드 실행에 잇는 값. | attribution(본문) | [LLM 사용량 기록](CLE-AI/CLE-AI-USAGE.md) |
| LLM 스텁 모드 | `LLM_STUB_MODE` | e2e 테스트용으로 늘 같은 답을 내는 LLM 클라이언트. 운영 환경에서는 켤 수 없다. | 없음 | [LLM 클라이언트](CLE-AI/CLE-AI-LLM.md) |
| 지식 저장소 | Knowledge Base, `KnowledgeBase` | 문서를 올려 임베딩하고 AI 노드가 검색하는 워크스페이스 단위 저장소. | 지식 베이스, 지식베이스, 지식저장소, Knowledge Base(본문), 컬렉션(이 뜻으로) | [지식 저장소 관리](CLE-KB/CLE-KB-MANAGE.md) |
| 문서 | Document, `document` | 지식 저장소에 올린 원본 파일 한 개(txt, md, pdf, csv). | 없음 | [지식 저장소 데이터와 흐름](CLE-KB/CLE-KB-DATA.md) |
| 청크 | chunk, `DocumentChunk` | 문서를 나눈 텍스트 조각과 그 벡터. 검색 단위다. | chunk(본문) | [문서 임베딩](CLE-KB/CLE-KB-EMBED.md) |
| 청크 크기·청크 오버랩 | `chunk_size`, `chunk_overlap` | 청크 하나의 추정 토큰 수와 이웃 청크가 겹치는 양. 토큰 수는 실제 토크나이저가 아니라 추정값이다. | 청크 최대 토큰 수 | [문서 임베딩](CLE-KB/CLE-KB-EMBED.md) |
| 임베딩 | embedding | 텍스트를 벡터로 바꾸는 일과 그 결과. | 벡터 임베딩 | [문서 임베딩](CLE-KB/CLE-KB-EMBED.md) |
| 임베딩 모델 설정 | embedding model config | 지식 저장소가 쓰는 Embedding 종류 모델 설정. 비워 두면 워크스페이스 기본 설정을 쓴다. | 없음 | [문서 임베딩](CLE-KB/CLE-KB-EMBED.md) |
| 임베딩 차원 | dimension, `ModelConfig.dimension`, `embedding_dimension` | 벡터 길이. 모델 설정의 `dimension` 은 모델 출력 차원이고 지식 저장소의 `embedding_dimension` 은 저장된 청크의 실제 차원이다. | 차원(단독) | [문서 임베딩](CLE-KB/CLE-KB-EMBED.md) |
| 임베딩 상태 | `embedding_status` | 문서마다 두는 처리 상태. 대기 중·처리 중·준비됨·재시도 중·실패 다섯 값이다. | 없음 | [문서 임베딩](CLE-KB/CLE-KB-EMBED.md) |
| 재임베딩 | re-embed | 청크를 지우고 다시 임베딩하는 작업. 문서 하나 단위와 지식 저장소 전체 단위가 있다. | 재색인, 재인덱싱 | [문서 임베딩](CLE-KB/CLE-KB-EMBED.md) |
| 재처리 잠금 | `reembed_status`, `reextract_status` | 지식 저장소 전체 재임베딩과 그래프 재추출을 한 번에 하나만 돌게 하는 잠금(`idle`, `in_progress`). | KB 잠금 | [지식 저장소 데이터와 흐름](CLE-KB/CLE-KB-DATA.md) |
| 실패 문서 재시도 | `retry-failed` | 최종 실패한 문서를 다시 큐에 넣는 동작. 재시도 횟수가 0으로 돌아간다. | 없음 | [문서 임베딩](CLE-KB/CLE-KB-EMBED.md) |
| 처리 중 문서 회수 | stuck document recovery | 서버가 뜰 때 10분 넘게 처리 중인 문서를 대기 중으로 되돌리는 동작. 실행 엔진 복구와 다르다. | Stuck 회수(단독) | [문서 임베딩](CLE-KB/CLE-KB-EMBED.md) |
| 검색 불가 | `not_searchable`, `kb_unsearchable` | 임베딩 차원을 몰라 지식 저장소가 검색에서 빠진 상태. 모델을 바꾼 뒤 재임베딩하지 않았거나 재임베딩 중일 때다. | 검색불가 | [RAG 검색](CLE-KB/CLE-KB-SEARCH.md) |
| RAG | Retrieval-Augmented Generation | 검색 결과를 LLM 입력에 넣어 답을 만드는 방식. 번역하지 않는다. 풀어 쓸 때는 "RAG(검색 보강)" 로 쓴다. | 없음 | [RAG 검색](CLE-KB/CLE-KB-SEARCH.md) |
| 검색 모드 | `rag_mode` | 지식 저장소의 검색 방식. Vector RAG(기본)와 Graph RAG 가 있고 만든 뒤 바꿀 수 없다. | KB 모드, 모드 배지(개념 이름으로) | [지식 저장소 관리](CLE-KB/CLE-KB-MANAGE.md) |
| Vector RAG | `rag_mode=vector` | 유사도로만 청크를 찾는 기본 검색 모드. "Vector 모드" 로 줄여 쓸 수 있다. | 없음 | [RAG 검색](CLE-KB/CLE-KB-SEARCH.md) |
| Graph RAG | `rag_mode=graph` | 문서에서 뽑은 Entity·Relation 그래프로 검색을 넓히는 모드. "Graph 모드" 로 줄여 쓸 수 있다. | 그래프 RAG, Hybrid 흐름, PRD 9 | [Graph RAG](CLE-KB/CLE-KB-GRAPH.md) |
| Entity | Entity, `GraphEntity`, `entity` | 청크에서 LLM 으로 뽑은 의미 단위(인물·조직·개념 등). 데이터 모델 엔티티와 구분하려고 영문으로 쓴다. | 엔티티(이 뜻으로) | [Graph RAG](CLE-KB/CLE-KB-GRAPH.md) |
| Relation | Relation, `GraphRelation` | 두 Entity 사이의 방향 있는 관계(head, predicate, tail). | 관계(단독) | [Graph RAG](CLE-KB/CLE-KB-GRAPH.md) |
| 청크-Entity 매핑 | `ChunkEntity` | 어느 청크가 어떤 Entity 를 언급했는지의 연결. | 없음 | [Graph RAG](CLE-KB/CLE-KB-GRAPH.md) |
| 그래프 추출 | graph extraction | 청크에서 Entity·Relation 을 뽑는 작업. 전체를 다시 하면 "그래프 재추출" 이다. | 추출(단독) | [Graph RAG](CLE-KB/CLE-KB-GRAPH.md) |
| 그래프 추출 LLM | `extraction_llm_config_id` | 그래프 추출에 쓰는 Chat 모델 설정. | 추출 LLM(단독) | [Graph RAG](CLE-KB/CLE-KB-GRAPH.md) |
| 그래프 검색 파라미터 | `max_hops`, `vector_seed_top_k`, `expanded_chunk_limit` | 최대 확장 깊이·Vector seed 개수·확장 청크 상한. | 없음 | [Graph RAG](CLE-KB/CLE-KB-GRAPH.md) |
| 중심성 가중치 | `centrality_weight` | Graph 모드에서 확장 청크 점수에 곱하는 Entity 등장 빈도 가중치. 리랭킹과 다르다. | rerank(이 뜻으로), score 재정렬 | [Graph RAG](CLE-KB/CLE-KB-GRAPH.md) |
| 리랭킹 | reranking, `rerank_mode` | 검색 후보를 cross-encoder 로 다시 점수 매겨 정렬하는 후처리. 모드는 사용 안 함·Cross-encoder·Cross-encoder + LLM grading 이다. | 리랭크, 재점수화(기능 이름으로), 검색 후처리 | [RAG 검색](CLE-KB/CLE-KB-SEARCH.md) |
| 리랭커 | reranker | 리랭킹에 쓰는 Rerank 종류 모델 설정. | Reranker(본문) | [모델 설정](CLE-AI/CLE-AI-MODELS.md) |
| LLM 그레이딩 | LLM grading | cross-encoder 점수가 서로 비슷할 때만 LLM 으로 후보 순위를 한 번 더 매기는 단계. | listwise LLM grading(본문) | [RAG 검색](CLE-KB/CLE-KB-SEARCH.md) |
| 후보 풀 | `rerank_candidate_k` | 리랭킹 전에 넓게 가져오는 후보 수. | candidate pool, 회수 폭 | [RAG 검색](CLE-KB/CLE-KB-SEARCH.md) |
| 점수 컷 임계 | `rerank_score_threshold` | 리랭킹 점수가 이 값보다 낮은 후보를 버리는 기준. | 없음 | [RAG 검색](CLE-KB/CLE-KB-SEARCH.md) |
| 유사도 임계값 | `ragThreshold` | 검색 결과를 자르는 최소 관련도(기본 0.7). 리랭킹이 켜지면 리랭킹 점수 기준으로 해석한다. | θ(본문), Score cutoff | [RAG 검색](CLE-KB/CLE-KB-SEARCH.md) |
| 동적 점수 컷 | `applyDynamicCut` | 점수 순으로 토큰 예산과 개수 상한까지만 청크를 넣는 규칙. | 동적 컷, token-budget + inject-cap | [RAG 검색](CLE-KB/CLE-KB-SEARCH.md) |
| 주입 상한 | `ragTopK` | LLM 에 넣을 청크 수의 선택적 상한. 비우면 동적 점수 컷이 정한다. | Top-K(고정 개수 뜻으로) | [RAG 검색](CLE-KB/CLE-KB-SEARCH.md) |
| 검색 인용 메타 | `meta.ragSources`, `meta.ragDiagnostics` | AI 노드 출력에 남는 인용 청크 목록과 검색 진단. | 없음 | [RAG 검색](CLE-KB/CLE-KB-SEARCH.md) |
| 입력 유형 | `inputType`: query, document | 비대칭 임베딩 모델에서 검색문과 문서를 다르게 인코딩하는 힌트. | passage(이 값 이름으로) | [문서 임베딩](CLE-KB/CLE-KB-EMBED.md) |
| RAG 품질 평가 | RAG evaluation | 골든셋으로 검색 지표를 재는 오프라인 평가. | 없음 | [RAG 품질 평가](CLE-KB/CLE-KB-EVAL.md) |
| 골든셋 | golden set, `GoldenSet` | 질의와 정답 청크를 묶은 평가 데이터. 검수 전은 silver, 검수 후는 gold 다. | 없음 | [RAG 품질 평가](CLE-KB/CLE-KB-EVAL.md) |
| 평가 하네스 | evaluation harness | 골든셋 생성과 지표 계산을 하는 CLI 묶음. | 하베스 | [RAG 품질 평가](CLE-KB/CLE-KB-EVAL.md) |
| 에이전트 메모리 | Agent Memory, `AgentMemory` | AI 노드가 실행을 넘어 사실·선호를 기억하는 영속 메모리. 메모리 전략이 `persistent` 일 때만 쓴다. AI 에이전트와 정보 추출기가 함께 쓴다. | Agent Memory(본문), 장기 메모리, 영속 메모리, persistent 메모리, 세션 간 메모리 | [에이전트 메모리](CLE-AI/CLE-AI-MEMORY.md) |
| 메모리 범위 키 | `scope_key`, `memoryKey` | 메모리가 쌓이는 네임스페이스. 노드 설정 `memoryKey` 의 평가값을 정리한 값이고 없으면 실행 ID 를 쓴다. 화면 라벨은 "scope" 다. | 스코프 키, scope(단독) | [에이전트 메모리](CLE-AI/CLE-AI-MEMORY.md) |
| 메모리 종류 | `metadata.kind`: fact, preference, entity | 추출한 메모리의 분류. 화면 라벨은 사실·선호·엔티티다. Graph RAG 의 Entity 와 다르다. | 개체 | [에이전트 메모리](CLE-AI/CLE-AI-MEMORY.md) |
| 메모리 추출 | memory extraction | 턴 경계에서 대화로부터 기억할 사실을 뽑아 저장하는 비동기 작업. | 추출(단독) | [에이전트 메모리](CLE-AI/CLE-AI-MEMORY.md) |
| 메모리 회수 | memory recall | LLM 을 부르기 직전 관련 메모리를 의미 검색으로 가져오는 동작. | 회수(단독) | [에이전트 메모리](CLE-AI/CLE-AI-MEMORY.md) |
| 추출 기준점 | `lastExtractionTurnSeq` | 직전 추출이 다룬 마지막 대화 기록 항목 번호. | watermark | [에이전트 메모리](CLE-AI/CLE-AI-MEMORY.md) |
| 메모리 주입 경계 | data-fence | 회수한 메모리를 지시가 아닌 데이터로 감싸는 표시. | 없음 | [에이전트 메모리](CLE-AI/CLE-AI-MEMORY.md) |
| 메모리 정리 | memory eviction | 만료된 행을 지우고 범위마다 최신 1000건만 남기는 정리. 기준은 만든 시각이다. | LRU, FIFO/LRU | [에이전트 메모리](CLE-AI/CLE-AI-MEMORY.md) |

## Rationale

2026-10-02 까지 이 표는 [용어 사전](CLE-GLOSSARY.md) 한 문서의 「AI 와 지식 저장소」 절이었다. 그 문서가 약 195KB 가 되어 NERV 초안 저장 한 번에 담기지 않아 영역별 문서로 나눴다. 정의는 옮기기만 했다. 표준을 고른 기준과 검토한 다른 선택은 [용어 사전](CLE-GLOSSARY.md) 의 Rationale 에 있다.
