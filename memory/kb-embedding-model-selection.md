# 작업 메모: 지식베이스 임베딩 모델 사용자 선택 (2026-05-02 완료)

## 배경

`spec/5-system/8-embedding-pipeline.md §5.3`이 명시한 "embedding 컬럼 가변 차원" 요구사항이 실제 마이그레이션 V005에 반영되지 않아 `vector(1536)`로 고정되어 있었다. 또한 `9-rag-search.md §6` "임베딩 모델 일관성"(KB별 model로 query 임베딩, 그룹별 분리 검색)도 미구현. 본 작업은 spec 미구현분을 메우고 사용자가 KB 생성/수정 시 임베딩 모델을 선택할 수 있도록 한 것.

## 사용자 결정

- 차원 지원: 다중 차원 (스키마 마이그레이션 + partial HNSW 인덱스 도입)
- 모델 변경 정책: 변경 허용 + 수동 KB 단위 재임베딩 버튼
- RAG 검색 모델 일치 버그 같이 수정

## 핵심 결과

- **V021** (`backend/migrations/V021__variable_embedding_dimension.sql`): `document_chunk.embedding` 을 untyped `vector` 로 변경, `knowledge_base.embedding_dimension` 컬럼 추가, `embedding_model` default 통일, V005 NOTE 인덱스(`idx_document_chunk_embedding`) IF EXISTS 정리.
- **V022** (+ `.conf`): 차원별 partial HNSW 인덱스(768/1536/3072) `CREATE INDEX CONCURRENTLY` 로 분리. `executeInTransaction=false`.
- **EmbeddingService**: 첫 임베딩 시 KB.embeddingDimension 자동 채움, 이후 배치는 차원 일관성 강제. 빈 vector 도 throw.
- **KnowledgeBaseService**: `update` 에서 embeddingModel 실제 변경 시 `embeddingDimension = null` 함께 reset. `reEmbedAll(id, ws)` 신설 — `inFlightReEmbeds` in-memory 잠금(중복 호출 409) + `p-limit(5)` 동시 큐잉 상한.
- **KnowledgeBaseController**: `POST /:id/re-embed` (HTTP 202, editor, `@Throttle 3/min`), 응답에 `satisfies KbReEmbedAcceptedDto`.
- **RagSearchService**: KB 메타를 한 번에 조회 → `(model, dim)` 그룹핑 → `Promise.all` 로 그룹별 query 임베딩 + 차원 cast SQL 병렬 처리. NULL/unsupported 차원 KB 는 검색 제외(unsupported 는 ERROR 로그). `searchGroup` private 헬퍼 추출.
- **공유 상수** `embedding/embedding-dimensions.const.ts`: `SUPPORTED_EMBEDDING_DIMS`, `EMBEDDING_MODEL_PATTERN`. RagSearch + Create/Update DTO 가 모두 참조.
- **LlmService.listModels**: `{ type?: 'chat'|'embedding' }` 옵션을 서비스 레이어에서 필터링. `LlmConfigController` 는 `@ApiQuery` 데코레이터 추가.
- **프론트엔드**: `EmbeddingModelCombobox` 신설(default LLM Config 의 embedding 모델 datalist + graceful degrade). KB 생성 폼/상세 설정 모달에서 사용. KB 상세에 "지식 베이스 설정" 모달, "KB 전체 재임베딩" 버튼 + 확인 모달, embeddingDimension 메타 노출. payload 타입 `KbUpdatePayload` 명시, reEmbedAll 응답 envelope unwrap, chunkSize/chunkOverlap 사전 검증.

## 검증

- backend: 146 suites / 2317 tests pass, `nest build` clean
- frontend: 94 files / 1034 tests pass, `next build --webpack` clean

## 후속 검토(별도 PR 권장)

- EmbeddingService 폴링 동시성(MAX_CONCURRENT) → 세마포어 패턴 교체
- reEmbedAll fire-and-forget → BullMQ 같은 지속형 큐 + `reEmbedStatus` 상태 컬럼
- 인라인 모달 3개 → 공용 ConfirmModal 추출
- `allEmbeddings` 메모리 누적 → 배치 임베딩 직후 스트리밍 INSERT
- 다중 인스턴스 환경의 reEmbedAll 분산 잠금 (advisory lock 또는 DB 컬럼)

## 후속 적용 (2026-05-02)

- **V023 halfvec 인덱스**: pgvector 0.7+ 의 halfvec 으로 3072 차원에도 partial
  HNSW 인덱스 부착. `getEmbeddingCastType(dim)` 로 차원별 cast(vector/halfvec)
  동적 결정, RagSearch SQL 이 인덱스 정의와 동일 표현식을 쓰도록 동기화.
- **V024 reembed_status + BullMQ 'document-embedding' 큐**: fire-and-forget
  + in-memory 잠금을 BullMQ 큐 + DB 컬럼으로 교체. 세 진입점(uploadDocument/
  단건 reEmbed/KB reEmbedAll) 모두 큐로 라우팅. KB reEmbedAll 잠금은 atomic
  `UPDATE ... WHERE reembed_status='idle' RETURNING id` 으로 race-free.
  Worker concurrency=3 이 EmbeddingService MAX_CONCURRENT 폴링을 대체.
  마지막 child job 의 completed/failed 시점에 Processor 가 남은 pending/processing
  문서 0건이면 reembed_status='idle' 로 reset. spec/5-system/8-embedding-pipeline.md
  §7 / spec/1-data-model.md §2.11 / spec/2-navigation/5-knowledge-base.md API 표 갱신.

리뷰 결과 및 조치 내역: `review/2026-05-02_13-18-24/SUMMARY.md` + `RESOLUTION.md`.
