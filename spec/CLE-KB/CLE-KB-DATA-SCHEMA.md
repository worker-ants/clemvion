---
id: "CLE-KB-DATA-SCHEMA"
title: "지식 저장소 데이터와 흐름 — 엔티티 스키마"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-KB-DATA"
ancestors: ["CLE-VISION", "CLE-KB", "CLE-KB-DATA"]
area: "CLE-KB"
content_hash: "fb066af241a5bb7f8275d5b6a1e3524670354282c317641e45e8ccdca897b419"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "fd78db47f9e0f8662be2dd982f1232057c6e93b54189f61db2744ac193b155d8"
etag: "sha256-82b514d7272e603425b815c9065af98ae6401d94fc9225c5e1a3feeb93d3dada"
---
## 개요

이 문서는 [지식 저장소 데이터와 흐름](CLE-KB-DATA.md) 의 하위 문서로 지식 저장소, 문서, 청크, Entity, Relation, 청크-Entity 매핑 테이블의 컬럼, 제약, 인덱스를 정한다. 저장 청크 차원을 채우고 NULL 로 되돌리는 규칙, 재처리 잠금의 상태 전이와 409 에러 코드, 스키마 결정의 근거(Rationale)도 여기서 정한다.

## KnowledgeBase (`knowledge_base`)

| 필드 | 타입 | 설명 |
|---|---|---|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace (CASCADE) |
| name | String | 지식 저장소 이름 |
| description | String? | 설명 |
| embedding_model_config_id | UUID? | FK → ModelConfig (SET NULL, 같은 워크스페이스, `kind=embedding`). 임베딩 모델 설정 참조(V091). 모델, 모델 프로바이더, 모델 출력 차원은 참조한 모델 설정에 있다. NULL 이면 워크스페이스 기본 Embedding 설정으로 해석한다. 유효 임베딩 모델은 API 응답의 읽기 전용 파생 값 `embeddingModel`(= 설정의 `defaultModel`)로 노출한다 |
| embedding_dimension | Integer? | 저장 청크 차원. 지금 저장된 청크 벡터의 실제 길이다. 아래 [임베딩 차원](#임베딩-차원) 참조 |
| chunk_size | Integer | 청크 크기 (기본 1000) |
| chunk_overlap | Integer | 청크 오버랩 (기본 200) |
| document_count | Integer | 문서 수 (캐시). 업로드 때 `COUNT(*)` 로 다시 센다 |
| reembed_status | Enum | 전체 재임베딩 재처리 잠금: `idle`(기본), `in_progress`. 원자적 비교 후 교체로 진입한다 |
| rag_mode | Enum | 검색 모드: `vector`(기본), `graph`. 만들 때만 정하고 바꿀 수 없다. CHECK `chk_kb_rag_mode` |
| extraction_llm_config_id | UUID? | FK → ModelConfig (SET NULL, 같은 워크스페이스, `kind=chat`). Graph 모드의 그래프 추출 LLM. NULL 이면 워크스페이스 기본 Chat 설정 |
| max_hops | Integer | Graph 검색의 최대 확장 깊이 (1 또는 2, 기본 1). CHECK `chk_kb_max_hops`. Vector 모드에서 무시 |
| vector_seed_top_k | Integer | Graph 검색의 vector seed 개수 (기본 5). Vector 모드에서 무시 |
| expanded_chunk_limit | Integer | Graph 확장으로 더 가져오는 청크 수의 상한 (기본 15). Vector 모드에서 무시 |
| entity_count | Integer | Entity 수 (캐시). Vector 모드는 늘 0 |
| relation_count | Integer | Relation 수 (캐시). Vector 모드는 늘 0 |
| reextract_status | Enum | 전체 그래프 재추출 재처리 잠금: `idle`(기본), `in_progress`. CHECK `chk_kb_reextract_status`. Vector 모드에서 쓰지 않음 |
| rerank_mode | Enum | 리랭킹 모드: `off`(기본), `cross_encoder`, `cross_encoder_llm` (V082). 검색할 때만 적용하므로 나중에 바꿀 수 있고 재임베딩이 필요 없다. `off` 면 아래 `rerank_*` 컬럼을 무시한다 |
| rerank_config_id | UUID? | FK → ModelConfig (SET NULL, 같은 워크스페이스, `kind=rerank`). 리랭커. NULL 이면 워크스페이스 기본 리랭커, 그것도 없으면 리랭킹 끔으로 강등 |
| rerank_candidate_k | Integer | 후보 풀: 리랭킹에 넣을 1차 후보 수 (기본 50, CHECK 1~200). `off` 에서 무시. 끔 경로의 내부 상수 `RAG_RECALL_K`(50)와 따로 돈다 |
| rerank_score_threshold | Float? | 점수 컷 임계: 리랭킹 점수가 이보다 낮은 후보를 버린다. `off` 에서 무시. NULL 일 때의 동작은 정의가 갈린다. [RAG 검색의 미결 사항](CLE-KB-SEARCH.md#미결-사항) 참조 |
| rerank_llm_config_id | UUID? | FK → ModelConfig (SET NULL, 같은 워크스페이스, `kind=chat`). `cross_encoder_llm` 의 LLM 그레이딩 모델. NULL 이면 워크스페이스 기본 Chat 설정 |
| created_at | Timestamp | 만든 시각 |
| updated_at | Timestamp | 고친 시각 |

인덱스: `(workspace_id)` (V128, CONCURRENTLY). 워크스페이스별 목록, 지식 저장소 선택 상자, 어시스턴트 도구 `list_knowledge_bases`, FK `ON DELETE CASCADE` 가 쓴다.

### 임베딩 차원

"차원" 은 두 가지를 구분해서 쓴다.

| 용어 | 필드 | 뜻 | 누가 채우나 |
|---|---|---|---|
| 모델 출력 차원 | `ModelConfig.dimension` | 그 모델이 내는 벡터 길이 | 모델 설정의 Embedding 연결 테스트가 감지해 자동 저장한다([모델 설정](../CLE-AI/CLE-AI-MODELS.md)) |
| 저장 청크 차원 | `knowledge_base.embedding_dimension` | 그 지식 저장소에 지금 저장된 청크 벡터의 실제 길이 | 적재 경로가 첫 배치의 벡터 길이로 채운다 |

저장 청크 차원의 규칙:

- 채우기: 문서의 첫 배치 임베딩 직후 `UPDATE knowledge_base SET embedding_dimension = $1 WHERE id = $2 AND (embedding_dimension IS NULL OR embedding_dimension = $1)` 로 채운다. 같은 지식 저장소의 첫 배치가 동시에 돌아도 같은 값이면 무해하다. 다른 값이면 0행이 바뀌고 다음 일관성 검사에서 문서가 실패한다([문서 임베딩](CLE-KB-EMBED.md)).
- NULL 로 되돌리는 경로는 둘이다.
  1. 전체 재임베딩의 잠금 진입 UPDATE(`reembed_status` `idle → in_progress`)와 같은 문장에서(V021).
  2. `PATCH /api/knowledge-bases/:id` 로 `embedding_model_config_id` 가 실제로 바뀔 때. 모델과 차원이 달라질 수 있어 다시 재야 한다.
- 전체 재임베딩의 마무리(잠금을 `idle` 로 되돌림)는 이 값을 건드리지 않는다. 다음 적재가 다시 채운다.
- NULL 은 "저장된 청크의 차원·벡터 공간이 현재 모델과 같다는 보장이 없다" 는 뜻이다. NULL 인 지식 저장소는 검색에서 미리 막는다([RAG 검색](CLE-KB-SEARCH.md)).
- 지식 저장소 폼의 임베딩 테스트(`POST /api/knowledge-bases/embedding-probe`)는 읽기 전용이다. 잰 값을 이 컬럼에 미리 저장하지 않는다. 모델 설정의 연결 테스트(`ModelConfig.dimension` 에 저장)와는 대상 필드가 달라 서로 보완한다.
- 검색은 이 값으로 `::vector(<dim>)` 캐스트와 `vector_dims` 필터를 건다. 지식 저장소를 묶는 기준도 `(embedding_model_config_id, embedding_dimension)` 이다.

두 값은 정상이라면 같다. 이미 벡터가 적재된 지식 저장소가 가리키는 Embedding 모델 설정의 차원은 나중에 바꿀 수 없다([모델 설정](../CLE-AI/CLE-AI-MODELS.md)). 두 값이 다를 때 어느 쪽을 기준으로 할지는 [미결 사항](CLE-KB-DATA.md#미결-사항) 에 있다.

### 재처리 잠금

지식 저장소 전체 재임베딩(`reembed_status`)과 전체 그래프 재추출(`reextract_status`)을 한 번에 하나만 돌게 하는 잠금이다.

| 상태 | 진입과 종료 |
|---|---|
| `idle` | 기본값. `idle → in_progress` 비교 후 교체로 진입한다 |
| `in_progress` | 전체 재임베딩·재추출이 진행 중이다. 같은 동작을 다시 요청하면 409 다(`KB_REEMBED_IN_PROGRESS`, `KB_REEXTRACT_IN_PROGRESS`). 마지막 작업의 마무리가 대기 중·처리 중 문서가 0건일 때만 한 번의 원자적 UPDATE 로 `idle` 로 되돌린다 |

- 재임베딩 잠금 진입 UPDATE 는 저장 청크 차원을 NULL 로 비우는 일을 함께 한다. 재추출 잠금은 차원을 건드리지 않는다.
- 문서가 없는 지식 저장소는 큐에 넣을 작업이 없어 진입할 때 바로 `idle` 로 되돌린다.
- 실패 문서 재시도는 잠금을 건드리지 않는다.
- 선점 판정은 바뀐 행 수로 한다([raw SQL 결과 읽기 규약](../CLE-ENG/CLE-ENG-RAWQUERY.md)).

## Document (`document`)

| 필드 | 타입 | 설명 |
|---|---|---|
| id | UUID | PK |
| knowledge_base_id | UUID | FK → KnowledgeBase (CASCADE) |
| name | String | 문서 이름 |
| file_type | Enum | `txt`, `md`, `pdf`, `csv` |
| file_url | String | 파일 저장소의 원본 키 |
| file_size | Integer | 파일 크기 (bytes) |
| embedding_status | Enum | `pending`, `processing`, `completed`, `error`, `failed`. `error` 는 재시도가 예약된 일시 오류, `failed` 는 재시도를 모두 썼거나 재시도하지 않는 에러로 인한 최종 실패다. 전이는 [문서 임베딩](CLE-KB-EMBED.md) |
| embedding_retry_count | Integer | 임베딩 재시도 누적 횟수. 성공하면 0 |
| embedding_last_attempted_at | Timestamp? | 마지막 임베딩 시도 시각. 처리 중 문서 회수의 임계 비교에 쓴다 |
| embedding_error_message | Text? | 마지막 임베딩 에러 메시지(사용자에게 보여도 되게 정리한 값). 성공하면 NULL |
| graph_extraction_status | Enum? | `pending`, `processing`, `completed`, `error`, `failed`. Vector 모드 문서는 NULL. 뜻은 `embedding_status` 와 같다 |
| graph_retry_count | Integer | 그래프 추출 재시도 누적 횟수. 성공하면 0 |
| graph_last_attempted_at | Timestamp? | 마지막 그래프 추출 시도 시각 |
| graph_error_message | Text? | 마지막 그래프 추출 에러 메시지 |
| chunk_count | Integer | 만든 청크 수 |
| tags | String[] | 태그 (업로드 때 `{}`) |
| metadata | JSONB | 메타데이터 (업로드 때 `{}`) |
| created_at | Timestamp | 만든 시각 |
| updated_at | Timestamp | 고친 시각 |

- `embedding_status` CHECK 는 V037 에서 `failed` 를 더했다(옛 CHECK 는 V039 에서 지움). `graph_extraction_status` 는 V025·V026 이다.
- V038 은 `embedding_status IN (error, failed)` 등에 부분 인덱스를 둬 재시도와 처리 중 문서 회수 조회를 받친다.

## DocumentChunk (`document_chunk`)

| 필드 | 타입 | 설명 |
|---|---|---|
| id | UUID | PK |
| document_id | UUID | FK → Document (CASCADE) |
| knowledge_base_id | UUID | FK → KnowledgeBase (CASCADE). 청크가 속한 지식 저장소. 적재할 때 문서의 지식 저장소를 함께 적는 비정규화 값이다(V005, 인덱스 `idx_document_chunk_kb`) |
| chunk_index | Integer | 청크 순서 (0부터) |
| content | Text | 청크 텍스트 원문 |
| embedding | Vector | 벡터 임베딩 (pgvector). 차원을 고정하지 않는다(V021) |
| token_count | Integer | 청크의 추정 토큰 수 |
| metadata | JSONB | `{ page?: number, section?: string }`. Markdown 은 `section`, PDF 는 `page`, 텍스트·CSV 는 `{}` |
| created_at | Timestamp | 만든 시각 |

제약: `UNIQUE(document_id, chunk_index)`

벡터 인덱스는 차원별 부분 HNSW 다. 차원이 다른 벡터를 한 인덱스에 섞지 않는다. 검색 SQL 은 인덱스 정의와 같은 캐스트 식과 `vector_dims` 조건을 써야 인덱스를 탄다.

| 마이그레이션 | 차원 | 형태 |
|---|---|---|
| V022 | 768 | `vector` |
| V023 | 3072 | `halfvec` (pgvector 는 `vector` 의 HNSW 차원에 제한이 있어 3072 는 `halfvec` 캐스트를 쓴다) |
| V030 | 384 | `vector` |
| V031 | 1536 | `vector` |
| V032 | 512 | `vector` |
| V033 | 1024 | `vector` |

모두 `CREATE INDEX CONCURRENTLY` 라 파일 하나에 인덱스 하나를 둔다. 지원 차원 목록은 공유 상수 `SUPPORTED_EMBEDDING_DIMS` 다. `ivfflat` 인덱스는 쓰지 않는다.

## Entity (`entity`, 구현: `GraphEntity`)

Graph 지식 저장소에서만 쓴다. 동작은 [Graph RAG](CLE-KB-GRAPH.md) 에서 정한다.

| 필드 | 타입 | 설명 |
|---|---|---|
| id | UUID | PK |
| knowledge_base_id | UUID | FK → KnowledgeBase (CASCADE) |
| name | String | 정규화한 이름 (소문자, trim) |
| display_name | String | 사용자에게 보여 줄 원형 |
| type | Enum (DB 는 TEXT + CHECK `chk_entity_type`) | `person`, `organization`, `concept`, `location`, `event`, `other` |
| description | Text? | LLM 이 뽑은 짧은 설명 |
| mention_count | Integer | 지식 저장소 안 청크에서 언급된 횟수 (캐시) |
| last_seen_chunk_id | UUID? | 마지막으로 등장한 청크 (FK → DocumentChunk, SET NULL) |
| created_at | Timestamp | 처음 추출한 시각 |
| updated_at | Timestamp | 마지막으로 갱신한 시각 |

제약: `UNIQUE(knowledge_base_id, name, type)` (`uq_entity_kb_name_type`). 같은 지식 저장소 안에서 이름과 타입이 같은 Entity 는 한 행이다.

인덱스:

- `(knowledge_base_id, type)` (`idx_entity_kb_type`): 타입별 조회.
- `(knowledge_base_id, mention_count DESC)` (`idx_entity_kb_mention`): 중심성 정렬.
- `(last_seen_chunk_id) WHERE last_seen_chunk_id IS NOT NULL` (V117): 청크가 지워질 때 FK SET NULL 조회용.

## Relation (`relation`, 구현: `GraphRelation`)

| 필드 | 타입 | 설명 |
|---|---|---|
| id | UUID | PK |
| knowledge_base_id | UUID | FK → KnowledgeBase (CASCADE) |
| head_entity_id | UUID | FK → Entity (CASCADE) |
| tail_entity_id | UUID | FK → Entity (CASCADE) |
| predicate | String | 관계 서술어 (예: `founded`, `employs`, `is_part_of`). P0 는 자유 문자열이고 snake_case 를 권장한다 |
| evidence_chunk_id | UUID? | 추출 근거 청크 (FK → DocumentChunk, SET NULL) |
| weight | Integer | 같은 (head, predicate, tail) 이 여러 청크에서 나온 누적 횟수 |
| created_at | Timestamp | 처음 추출한 시각 |
| updated_at | Timestamp | 마지막으로 갱신한 시각 |

제약: `UNIQUE(knowledge_base_id, head_entity_id, predicate, tail_entity_id)` (`uq_relation_kb_head_pred_tail`, V025)

인덱스:

- `(knowledge_base_id, head_entity_id)`, `(knowledge_base_id, tail_entity_id)` (V027): head 기준 확장과 tail 기준 역방향 확장. 지식 저장소를 아는 검색용이다.
- `(evidence_chunk_id) WHERE evidence_chunk_id IS NOT NULL` (V118): 청크가 지워질 때 FK SET NULL 조회용.
- `(head_entity_id)` (V119), `(tail_entity_id)` (V120): Entity 가 지워질 때 FK CASCADE 조회용.

## ChunkEntity (`chunk_entity`, 구현: `GraphChunkEntity`)

| 필드 | 타입 | 설명 |
|---|---|---|
| chunk_id | UUID | PK 일부, FK → DocumentChunk (CASCADE) |
| entity_id | UUID | PK 일부, FK → Entity (CASCADE) |
| mention_text | String? | 청크에 나온 원형 표기 (정규화 전) |

제약: `PRIMARY KEY (chunk_id, entity_id)`

인덱스: `(entity_id)`. Entity 에서 청크로 거꾸로 찾는 데 쓴다(검색의 확장 단계).

## Rationale

### 차원별 부분 HNSW 인덱스로 나눈 이유

저장 청크 차원은 지식 저장소마다 다르다(모델 프로바이더·모델별로 384, 512, 768, 1024, 1536, 3072 등). 한 인덱스에 여러 차원 벡터가 섞이면 검색이 비효율적이라 차원별 부분 HNSW 인덱스로 나눴다. 3072 차원은 pgvector 제약으로 V023 의 `halfvec` 인덱스를 쓴다.

### 저장 청크 차원을 실제 벡터 길이로 정의한 이유

검색이 이 값으로 캐스트하고 필터를 거는 이유는 저장된 청크와 새 질의를 같은 차원·공간에서 비교하기 위해서다. 그러려면 이 값은 모델이 내는 차원이 아니라 지금 저장된 벡터의 길이여야 한다. 그래서 적재 경로만 경쟁 없이 채운다. 임베딩 테스트로 잰 값은 미리 저장하지 않는다. 모델을 바꾼 뒤 새 모델 차원을 미리 넣으면 저장된 청크는 여전히 옛 차원·공간이라 두 가지 문제가 생긴다. 차원이 다르면 `vector_dims` 필터에서 모두 빠져 여전히 0건이다. 차원이 우연히 같으면 옛 벡터와 새 질의를 비교해 틀린 결과가 나온다. [용어 사전 — 결정이 필요한 표기](../CLE-GLOSSARY-OPEN.md) 의 「임베딩 차원이 파생 캐시인지 실측값인지」 항목(D46)은 이 구분에 따라 모델 출력 차원과 저장 청크 차원을 다른 용어로 정했다.

### 그래프 RAG 삭제 연쇄에 FK 인덱스 넷을 둔 이유 (2026-09-18)

`entity`, `relation` 의 기존 인덱스는 모두 `knowledge_base_id` 가 앞이다. FK 트리거의 조회는 지식 저장소를 모르므로 `last_seen_chunk_id`, `evidence_chunk_id` 로 찾을 때 테이블 전체를 훑는다. 비용은 "자식 테이블 크기 × 연쇄로 지워지는 부모 행 수" 다. 측정해 보니 가장 무거운 경로는 지식 저장소 삭제였다.

| 경로 | 연쇄 |
|---|---|
| 재임베딩(수동 재실행, 두 번째 이후 재시도. 문서의 청크를 지우고 다시 만든다), 문서 삭제 | 청크 하나마다 `entity.last_seen_chunk_id`, `relation.evidence_chunk_id` (SET NULL) |
| Entity 하나 삭제(관리 API) | `relation.head_entity_id`, `relation.tail_entity_id` (CASCADE) |
| 지식 저장소 삭제 | 모든 청크에 첫째 연쇄, 모든 Entity 에 둘째 연쇄 |

`head_entity_id`, `tail_entity_id` 는 위 공식의 전제 밖이다. `(knowledge_base_id, head_entity_id)` 가 이미 있어 PostgreSQL 18 의 skip scan 이 지식 저장소 값마다 건너뛰며 쓰므로 비용이 테이블 크기가 아니라 지식 저장소 수에 비례한다(Entity 하나 삭제에서 호출당 0.74 ms → 2.1 ms, 지식 저장소 100 → 400).

실측(PostgreSQL 18, V001~V116 적용, 지식 저장소마다 문서 50 × 청크 40, Entity 1,000, Relation 2,000, 워밍 뒤 1회):

| 규모 (청크 / Entity / Relation) | 재임베딩(문서 하나) | Entity 하나 삭제 | 지식 저장소 하나 삭제 |
|---|---|---|---|
| 200k / 100k / 200k (지식 저장소 100) | 434.4 ms | 1.47 ms | 20,841 ms |
| 800k / 400k / 800k (지식 저장소 400) | 1,795.7 ms | 4.25 ms | 129,941 ms |
| 800k, 인덱스 넷 추가 | 2.37 ms | 0.38 ms | 48.1 ms |

청크 쪽 둘(`last_seen_chunk_id`, `evidence_chunk_id`)만 더하면 지식 저장소 삭제가 1,238.5 ms 로 남는다. 그중 1.2 초가 `head`·`tail`(각 1,000회, 600 ms)이라 둘도 넣었다.

쓰기 비용(10만 행 INSERT 5회 중앙값, FK 컬럼을 모두 채운 최악): `entity` 부분 인덱스 `(last_seen_chunk_id)` 는 1,438.8 → 1,467.9 ms(+2.0%, 잡음 수준), `relation` 인덱스 셋은 1,879.3 → 2,084.0 ms(행당 +2.05 µs, +10.9%)다. 인덱스가 있는 쪽을 먼저 쟀으므로 오버헤드는 과대평가된 방향이다. 그래프 추출은 청크마다 LLM 호출(수백 ms~수 초) 뒤에 쓰므로 무시할 만하다. `last_seen_chunk_id` 와 `evidence_chunk_id` 는 NULL 을 허용해 부분 인덱스로 뒀다.

`chunk_entity` 는 `(chunk_id, entity_id)` PK 와 `(entity_id)` 인덱스가 모두 앞 컬럼이라 이미 쓰인다(지식 저장소 삭제에서 호출당 0.1 ms 미만).
