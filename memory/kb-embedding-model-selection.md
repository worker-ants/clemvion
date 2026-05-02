# 작업 메모: 지식베이스 임베딩 모델 사용자 선택 (2026-05-02)

## 배경

`spec/5-system/8-embedding-pipeline.md §5.3`이 명시한 "embedding 컬럼 가변 차원" 요구사항이 실제 마이그레이션 V005에 반영되지 않아 `vector(1536)`로 고정되어 있다. 또한 `9-rag-search.md §6` "임베딩 모델 일관성"(KB별 model로 query 임베딩, 그룹별 분리 검색)도 `rag-search.service.ts:36`에서 미구현. 본 작업은 이 spec 미구현분을 메우는 것이다.

플랜 파일: `~/.claude/plans/wiggly-bouncing-rose.md`.

## 사용자 결정

- 차원 지원: 다중 차원 (스키마 마이그레이션, partial HNSW 인덱스 도입)
- 모델 변경 정책: 변경 허용 + 수동 KB 단위 재임베딩 버튼
- RAG 검색 모델 일치 버그 같이 수정

## 핵심 결정 사항

- `document_chunk.embedding`을 `vector` (untyped)로 완화. pgvector는 untyped vector 컬럼에 ANN 인덱스를 직접 못 붙이므로 `(embedding::vector(N)) vector_cosine_ops` cast 표현식 + `WHERE vector_dims(embedding) = N` partial HNSW 인덱스로 처리.
- 검색 SQL도 동일한 cast/조건을 써야 partial 인덱스를 탐. `N`은 prepared param으로 못 받아 화이트리스트(768/1536/3072)에서 안전하게 인라인.
- `knowledge_base.embedding_dimension` 컬럼 추가, 첫 임베딩 시 자동 채움. KB 단위 재임베딩 시 NULL 초기화.
- LLM Config models API에 `?type=embedding` 필터 추가 (이미 OpenAI/Google client는 `ModelInfo.type`을 채움).
- RAG 검색은 KB를 `(embeddingModel, embeddingDimension)`로 그룹핑해 그룹별로 query 임베딩 + SQL 실행 후 결과 병합/topK.

## 진행 상황

(작업 중. 완료 시 갱신.)
